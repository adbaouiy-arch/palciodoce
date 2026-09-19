/**
 * Publishes firestore.rules and the composite indexes, via the REST APIs.
 *
 *   npm run rules:deploy
 *
 * `firebase deploy --only firestore` would be the obvious way, and it is what
 * the documentation says. It does not work with the default Firebase Admin SDK
 * service account: before deploying anything it calls Service Usage to confirm
 * the Firestore API is enabled, and that account has no permission to *read*
 * service state — a precondition check that fails even though the deploy itself
 * would have succeeded.
 *
 * Talking to the two APIs directly skips the check. Both operations are ones the
 * Admin SDK account is entitled to perform:
 *
 *   firebaserules.googleapis.com   create a ruleset, point the release at it
 *   firestore.googleapis.com       create composite indexes
 *
 * The alternative is granting the key `roles/serviceusage.serviceUsageConsumer`
 * so the CLI's check passes. Not worth widening a long-lived credential to
 * satisfy a check on something already known to be true.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import type { AuthClient } from "google-auth-library";
import { describeTarget } from "./target";
import { googleApiClient } from "./google-auth";

const RULES_FILE = "firestore.rules";
const INDEXES_FILE = "firestore.indexes.json";
const DATABASE = "(default)";

/** The release name Firestore reads its active ruleset from. */
const RELEASE = "cloud.firestore";

type IndexField = { fieldPath: string; order?: string; arrayConfig?: string };
type IndexSpec = {
  collectionGroup: string;
  queryScope?: string;
  fields: IndexField[];
};

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

let client: AuthClient;

async function api<T>(
  url: string,
  init: { method?: string; data?: unknown } = {},
): Promise<T> {
  const response = await client.request<T>({
    url,
    method: init.method ?? "GET",
    ...(init.data === undefined ? {} : { data: init.data }),
  });
  return response.data;
}

function errorOf(error: unknown): { code: number; status: string; message: string } {
  const response = (
    error as {
      response?: {
        status?: number;
        data?: { error?: { message?: string; status?: string } };
      };
    }
  ).response;
  return {
    code: response?.status ?? 0,
    status: response?.data?.error?.status ?? "",
    message:
      response?.data?.error?.message ??
      (error instanceof Error ? error.message : String(error)),
  };
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

async function deployRules(project: string) {
  const source = readFileSync(RULES_FILE, "utf8");

  const ruleset = await api<{ name: string }>(
    `https://firebaserules.googleapis.com/v1/projects/${project}/rulesets`,
    {
      method: "POST",
      data: { source: { files: [{ name: RULES_FILE, content: source }] } },
    },
  );
  console.log(`  ${green("✓")} compiled ${RULES_FILE} ${dim(`(${ruleset.name.split("/").pop()})`)}`);

  const releaseName = `projects/${project}/releases/${RELEASE}`;
  const body = { name: releaseName, rulesetName: ruleset.name };

  try {
    // The release already exists on any project where a database has been
    // created, so an update is the normal path.
    await api(`https://firebaserules.googleapis.com/v1/${releaseName}`, {
      method: "PATCH",
      data: { release: body },
    });
  } catch (error) {
    const { code } = errorOf(error);
    if (code !== 404) throw error;
    // First ever deploy to a project with no release yet.
    await api(`https://firebaserules.googleapis.com/v1/projects/${project}/releases`, {
      method: "POST",
      data: body,
    });
  }

  console.log(`  ${green("✓")} published — these rules are now live`);
}

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

/** A canonical string for an index, so declared and actual can be compared. */
function signature(collectionGroup: string, fields: IndexField[]): string {
  const relevant = fields
    // Firestore appends `__name__` to every composite index by itself, so it is
    // not part of what was asked for.
    .filter((field) => field.fieldPath !== "__name__")
    .map((field) => `${field.fieldPath}:${field.order ?? field.arrayConfig ?? ""}`);
  return `${collectionGroup}|${relevant.join(",")}`;
}

/**
 * Deletes composite indexes that `firestore.indexes.json` does not declare.
 *
 * Opt-in via `--prune`, because it deletes. Without it, a definition that is
 * edited — as the revenue index was, to add `totalCents` — leaves the superseded
 * version behind forever, and the file stops describing the database. With it,
 * the file is the source of truth.
 *
 * Only ever touches composite indexes. The automatic single-field indexes
 * Firestore maintains are not listed here and are not candidates.
 */
async function pruneIndexes(project: string, declared: IndexSpec[]) {
  const wanted = new Set(
    declared.map((index) => signature(index.collectionGroup, index.fields)),
  );

  // The API's collectionGroup path segment does not actually filter the list,
  // so one call returns every composite index in the database.
  const listed = await api<{
    indexes?: Array<{ name: string; fields: IndexField[] }>;
  }>(
    `https://firestore.googleapis.com/v1/projects/${project}/databases/${DATABASE}` +
      `/collectionGroups/-/indexes`,
  );

  for (const index of listed.indexes ?? []) {
    // name: projects/p/databases/d/collectionGroups/<cg>/indexes/<id>
    const parts = index.name.split("/");
    const collectionGroup = parts[parts.indexOf("collectionGroups") + 1];
    const sig = signature(collectionGroup, index.fields);

    // Single-field indexes come back with one real field; they are automatic
    // and must be left alone.
    const realFields = index.fields.filter((f) => f.fieldPath !== "__name__");
    if (realFields.length < 2) continue;

    if (wanted.has(sig)) continue;

    await api(`https://firestore.googleapis.com/v1/${index.name}`, {
      method: "DELETE",
    });
    console.log(
      `  ${yellow("−")} deleted   ${collectionGroup}: ${realFields
        .map((f) => `${f.fieldPath} ${f.order === "DESCENDING" ? "desc" : "asc"}`)
        .join(", ")} ${dim("(not declared)")}`,
    );
  }
}

function readIndexes(): IndexSpec[] {
  const parsed = JSON.parse(readFileSync(INDEXES_FILE, "utf8")) as {
    indexes?: IndexSpec[];
  };
  return parsed.indexes ?? [];
}

/** Exit code meaning "rules published, indexes need a permission grant". */
const EXIT_INDEXES_DENIED = 3;

/** `--prune` deletes composite indexes the file no longer declares. */
const prune = process.argv.includes("--prune");

async function deployIndexes(project: string): Promise<{ denied: boolean }> {
  const indexes = readIndexes();
  let created = 0;
  let already = 0;
  let denied = false;

  for (const index of indexes) {
    const url =
      `https://firestore.googleapis.com/v1/projects/${project}/databases/${DATABASE}` +
      `/collectionGroups/${index.collectionGroup}/indexes`;

    // Strip the `//` comment keys the file uses for documentation; the API
    // rejects unknown fields.
    const body = {
      queryScope: index.queryScope ?? "COLLECTION",
      fields: index.fields.map((field) => ({
        fieldPath: field.fieldPath,
        ...(field.order ? { order: field.order } : {}),
        ...(field.arrayConfig ? { arrayConfig: field.arrayConfig } : {}),
      })),
    };

    const label = `${index.collectionGroup}: ${index.fields
      .map((f) => `${f.fieldPath} ${f.order === "DESCENDING" ? "desc" : "asc"}`)
      .join(", ")}`;

    try {
      await api(url, { method: "POST", data: body });
      console.log(`  ${green("✓")} creating  ${label}`);
      created++;
    } catch (error) {
      const { status, code, message } = errorOf(error);

      if (status === "ALREADY_EXISTS" || message.includes("already exists")) {
        console.log(`  ${dim("·")} ${dim(`exists    ${label}`)}`);
        already++;
        continue;
      }

      /*
        Index creation needs `datastore.indexes.create`, which the default
        Firebase Admin SDK service account does not carry — its role covers
        reading and writing data, not changing the database's shape.

        Reported once rather than thrown, because the rules deployed above are
        the security-critical half and have already succeeded. Losing that
        because of a separate permission gap would be the wrong trade.
      */
      if (status === "PERMISSION_DENIED" || code === 403) {
        denied = true;
        break;
      }

      throw new Error(`Index ${label} failed: ${message}`);
    }
  }

  if (denied) {
    console.log(`  ${yellow("!")} not permitted to create indexes with this key\n`);
    console.log(`  ${bold("Grant it once:")}`);
    console.log(
      `    https://console.cloud.google.com/iam-admin/iam?project=${project}\n`,
    );
    console.log(`    Find  ${dim("firebase-adminsdk-fbsvc@" + project + ".iam.gserviceaccount.com")}`);
    console.log("    Edit (pencil) → Add another role → " + bold("Cloud Datastore Index Admin"));
    console.log("    Save, wait a few seconds, then: " + bold("npm run rules:deploy"));
    console.log(
      `\n  ${dim(`Or add the ${indexes.length} indexes by hand at`)}\n` +
        `  ${dim(`https://console.firebase.google.com/project/${project}/firestore/indexes`)}\n` +
        `  ${dim("using the field lists in firestore.indexes.json.")}`,
    );
    console.log(
      `\n  ${dim("Until they exist the storefront is fine, but the admin dashboard,")}\n` +
        `  ${dim('order filters and messages list report "The query requires an index".')}`,
    );
    return { denied: true };
  }

  if (prune) await pruneIndexes(project, indexes);

  if (created > 0) {
    /*
      Index builds are asynchronous. Until they finish, the admin order listings
      fail with "The query requires an index" — the same error as a missing one,
      which makes it easy to think the deploy did not work.
    */
    console.log(
      `\n  ${created} index${created === 1 ? "" : "es"} building. This takes a few minutes on an\n` +
        "  empty database. Until they finish, admin order listings will report\n" +
        '  "The query requires an index". Progress:\n' +
        `  https://console.firebase.google.com/project/${project}/firestore/indexes`,
    );
  } else {
    console.log(`\n  All ${already} indexes were already in place.`);
  }

  return { denied: false };
}

// ---------------------------------------------------------------------------

async function main() {
  const target = describeTarget();

  if (target.emulated) {
    throw new Error(
      `Target is ${target.label}.\n\n` +
        "The emulator loads firestore.rules from firebase.json on startup and\n" +
        "applies index definitions not at all, so there is nothing to deploy.\n" +
        "To publish to the real project:\n" +
        "  npm run rules:deploy",
    );
  }

  const project = target.projectId;
  console.log(bold(`\nPublishing rules and indexes to ${target.label}\n`));

  client = await googleApiClient();

  await deployRules(project);
  console.log("");
  const { denied } = await deployIndexes(project);
  console.log("");

  // A distinct code so callers can tell "needs a permission grant" apart from
  // "the deploy broke".
  if (denied) process.exit(EXIT_INDEXES_DENIED);
}

main().catch((error: unknown) => {
  console.error(
    `\nDeploy failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
