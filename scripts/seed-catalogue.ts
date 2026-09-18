/**
 * Loads `data/catalogue.json` into Firestore.
 *
 *   npm run db:seed
 *   npm run db:seed -- --dry-run
 *   npm run db:seed -- --file data/catalogue.json
 *
 * This is the catalogue and the informational pages — products, categories,
 * their slug indexes, and the privacy, terms and cookie policies. It is tracked
 * in git, unlike the backups, for two reasons: the emulator forgets everything
 * when it stops, so this is what makes `npm run dev` produce a working shop from
 * a clean checkout; and the legal copy is a document that should be reviewable
 * in a diff rather than living only inside a database.
 *
 * Deliberately excluded: orders, contact messages, consent logs, the admin
 * allowlist and the order counters. Those are either personal data, which has no
 * business in a repository, or specific to one environment.
 *
 * Safe to re-run. Every document is written under its own id with `set`, so this
 * converges on the file's contents instead of duplicating. It does not delete —
 * a product removed from the file stays in Firestore until removed on purpose.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { getDb } from "../src/lib/firebase/admin";
import { COLLECTIONS } from "../src/lib/firebase/collections";
import { EXPORT_FORMAT, decode } from "./backup-format";
import { describeTarget } from "./target";

const DEFAULT_FILE = "data/catalogue.json";

/** Only these may appear in the seed file. */
const SEEDABLE: readonly string[] = [
  COLLECTIONS.categories,
  COLLECTIONS.categorySlugs,
  COLLECTIONS.products,
  COLLECTIONS.productSlugs,
  COLLECTIONS.pages,
];

const dryRun = process.argv.includes("--dry-run");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const value = process.argv[i + 1];
  return i === -1 || !value || value.startsWith("--") ? undefined : value;
}

function readSeed(path: string) {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as {
    format?: unknown;
    collections?: unknown;
  };

  if (parsed.format !== EXPORT_FORMAT) {
    throw new Error(
      `${path} is not a ${EXPORT_FORMAT} file (found ${JSON.stringify(parsed.format)}).`,
    );
  }
  if (typeof parsed.collections !== "object" || parsed.collections === null) {
    throw new Error(`${path} has no "collections" object.`);
  }

  const collections = parsed.collections as Record<
    string,
    Record<string, Record<string, unknown>>
  >;

  /*
    Refuse anything outside the catalogue. The seed file is tracked in git, so
    this is the check that stops an order or a contact message — somebody's name,
    address and phone number — being committed by accident after a careless
    export.
  */
  const forbidden = Object.keys(collections).filter((n) => !SEEDABLE.includes(n));
  if (forbidden.length > 0) {
    throw new Error(
      `${path} contains collections that must not be seeded: ${forbidden.join(", ")}.\n` +
        "The seed file is tracked in git and holds no personal data. Orders, contact\n" +
        "messages, consent logs, the admin allowlist and the counters belong in a\n" +
        "backup (npm run db:export), not here.",
    );
  }

  return collections;
}

async function main() {
  const file = arg("file") ?? DEFAULT_FILE;
  const collections = readSeed(file);
  const db = getDb();

  const target = describeTarget();

  console.log(`\nSeeding ${file} into ${target.label}`);
  if (dryRun) console.log("  dry run, nothing will be written");
  console.log("");

  const batch = db.batch();
  let written = 0;

  // Well under Firestore's 500-operation batch limit at this size, so one batch
  // is enough and the whole seed lands atomically.
  for (const name of SEEDABLE) {
    const documents = collections[name] ?? {};
    const entries = Object.entries(documents);
    console.log(`  ${String(entries.length).padStart(4)}  ${name}`);

    for (const [id, data] of entries) {
      if (!dryRun) {
        batch.set(db.collection(name).doc(id), decode(data) as Record<string, unknown>);
      }
      written++;
    }
  }

  if (!dryRun && written > 0) await batch.commit();

  console.log(`  ${"-".repeat(4)}`);
  console.log(
    `  ${String(written).padStart(4)}  documents ${dryRun ? "would be seeded" : "seeded"}\n`,
  );

  if (!dryRun) {
    console.log(
      "  Orders, messages and the admin allowlist are not part of the seed.\n" +
        "  Create an administrator with: npm run admin:grant -- --generate\n",
    );
  }
}

main().catch((error: unknown) => {
  console.error(
    `\nSeed failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
