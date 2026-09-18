/**
 * Restores a `db:export` backup into Firestore.
 *
 *   npm run db:restore -- --file backups/firestore-....json --dry-run
 *   npm run db:restore -- --file backups/firestore-....json
 *   npm run db:restore -- --file ... --force      overwrite a non-empty database
 *
 * Writes each document back under its original id, so restoring twice converges
 * rather than duplicating. Documents added since the backup are left alone: this
 * is a restore, not a mirror, and deleting data the backup happens not to
 * mention is not something a recovery tool should decide to do.
 *
 * Refuses to touch a database that already holds documents unless `--force` is
 * given. The likeliest reason to run this is a bad day, and overwriting live
 * orders with a week-old copy because of a mistyped project id would make it
 * considerably worse.
 *
 * Starts with `--dry-run`: it reports exactly what would be written, and is the
 * only way to check a backup against the wrong-project mistake before it
 * happens.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { getDb } from "../src/lib/firebase/admin";
import { COLLECTIONS } from "../src/lib/firebase/collections";
import { EXPORT_FORMAT, decode } from "./backup-format";
import { describeTarget } from "./target";

/** Firestore caps a batched write at 500 operations. */
const BATCH_LIMIT = 500;

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const value = process.argv[i + 1];
  return i === -1 || !value || value.startsWith("--") ? undefined : value;
}

type Backup = {
  format?: unknown;
  exportedAt?: unknown;
  projectId?: unknown;
  emulated?: unknown;
  collections?: unknown;
};

function readBackup(path: string): {
  exportedAt: string;
  projectId: string | null;
  collections: Record<string, Record<string, Record<string, unknown>>>;
} {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Backup;

  if (parsed.format !== EXPORT_FORMAT) {
    throw new Error(
      `${path} is not a ${EXPORT_FORMAT} backup (found ${JSON.stringify(parsed.format)}).\n` +
        "The pre-Firestore relational export is restored with a different script:\n" +
        "  npm run db:import -- --file <file>",
    );
  }

  if (typeof parsed.collections !== "object" || parsed.collections === null) {
    throw new Error(`${path} has no "collections" object.`);
  }

  const known = new Set<string>(Object.values(COLLECTIONS));
  const unknown = Object.keys(parsed.collections).filter((n) => !known.has(n));
  if (unknown.length > 0) {
    // Security rules deny every collection not named explicitly, so writing an
    // unrecognised one would create data nothing can ever read.
    throw new Error(
      `${path} contains collections this application does not know: ${unknown.join(", ")}.\n` +
        "Add them to src/lib/firebase/collections.ts and firestore.rules first.",
    );
  }

  return {
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : "unknown",
    projectId: typeof parsed.projectId === "string" ? parsed.projectId : null,
    collections: parsed.collections as Record<
      string,
      Record<string, Record<string, unknown>>
    >,
  };
}

async function main() {
  const file = arg("file");
  if (!file) {
    throw new Error(
      "No backup given. Use: npm run db:restore -- --file backups/firestore-....json",
    );
  }

  const backup = readBackup(file);
  const db = getDb();

  const target = describeTarget();

  console.log(`\nRestoring ${file}`);
  console.log(`  taken:  ${backup.exportedAt}`);
  console.log(`  from:   ${backup.projectId ?? "unknown project"}`);
  console.log(`  into:   ${target.label}`);
  if (dryRun) console.log(`  mode:   dry run, nothing will be written`);
  console.log("");

  // ---------------------------------------------------------------------
  // Guard: is there already data here?
  // ---------------------------------------------------------------------
  if (!dryRun && !force) {
    const occupied: string[] = [];
    for (const name of Object.values(COLLECTIONS)) {
      const existing = await db.collection(name).limit(1).get();
      if (!existing.empty) occupied.push(name);
    }

    if (occupied.length > 0) {
      throw new Error(
        `${target.label} already holds documents in: ${occupied.join(", ")}.\n\n` +
          "Restoring would overwrite them. If that is what you want, re-run with --force.\n" +
          "To see what would change first:\n" +
          `  npm run db:restore -- --file ${file} --dry-run`,
      );
    }
  }

  // ---------------------------------------------------------------------
  let written = 0;
  let batch = db.batch();
  let pending = 0;

  for (const [name, documents] of Object.entries(backup.collections)) {
    const entries = Object.entries(documents);
    console.log(`  ${String(entries.length).padStart(4)}  ${name}`);

    for (const [id, data] of entries) {
      if (dryRun) {
        written++;
        continue;
      }

      batch.set(db.collection(name).doc(id), decode(data) as Record<string, unknown>);
      pending++;
      written++;

      if (pending >= BATCH_LIMIT) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    }
  }

  if (!dryRun && pending > 0) await batch.commit();

  console.log(`  ${"-".repeat(4)}`);
  console.log(
    `  ${String(written).padStart(4)}  documents ${dryRun ? "would be restored" : "restored"}\n`,
  );

  if (!dryRun) {
    /*
      The allowlist is keyed by Firebase Auth uid. Restoring into a different
      project brings the documents across but not the accounts they name, which
      leaves entries that grant nothing — better said out loud than discovered
      at a locked login screen.
    */
    console.log(
      "  Check that admin access survived the restore:\n" +
        "    npm run admin:list\n" +
        "  Entries reported as stale need: npm run admin:grant -- --email <address>\n",
    );
  }
}

main().catch((error: unknown) => {
  console.error(
    `\nRestore failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
