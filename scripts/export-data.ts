/**
 * Backs up every Firestore collection to portable JSON.
 *
 *   npm run db:export                      -> backups/firestore-<timestamp>.json
 *   npm run db:export -- --out path.json
 *
 * Restore with `npm run db:restore`. The pair is symmetric: whatever comes out
 * here goes back in there, document id for document id.
 *
 * Firestore has no `pg_dump`, and the managed export in the console writes an
 * opaque binary format to a Cloud Storage bucket that only Firestore can read.
 * This writes plain JSON instead, which can be read, diffed, grepped and
 * committed to a safe place — worth more than efficiency at this size.
 *
 * `Timestamp` values are tagged rather than flattened to ISO strings. A bare
 * string would come back as a string, and every date in the application would
 * quietly change type on the first restore.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getDb } from "../src/lib/firebase/admin";
import { COLLECTIONS } from "../src/lib/firebase/collections";
import { EXPORT_FORMAT, encode } from "./backup-format";
import { describeTarget } from "./target";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const value = process.argv[i + 1];
  return i === -1 || !value || value.startsWith("--") ? undefined : value;
}

async function main() {
  // Resolved and printed first, so which database this came from is the first
  // thing on screen rather than something inferred afterwards.
  const target = describeTarget();
  console.log(`\nExporting from ${target.label}`);

  const db = getDb();

  const collections: Record<string, Record<string, unknown>> = {};
  const counts: Array<[string, number]> = [];

  for (const name of Object.values(COLLECTIONS)) {
    const snapshot = await db.collection(name).get();

    collections[name] = Object.fromEntries(
      snapshot.docs.map((doc) => [doc.id, encode(doc.data(), `${name}/${doc.id}`)]),
    );
    counts.push([name, snapshot.size]);
  }

  const payload = {
    format: EXPORT_FORMAT,
    exportedAt: new Date().toISOString(),
    projectId: target.projectId,
    emulated: target.emulated,
    collections,
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = arg("out") ?? join("backups", `firestore-${stamp}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Wrote ${out}\n`);

  let total = 0;
  for (const [name, size] of counts) {
    total += size;
    console.log(`  ${String(size).padStart(4)}  ${name}`);
  }
  console.log(`  ${"-".repeat(4)}`);
  console.log(`  ${String(total).padStart(4)}  documents\n`);

  if (target.emulated) {
    // Worth saying plainly: emulator data disappears when the emulator stops,
    // so an export taken from it is a snapshot of test data, not a backup.
    console.log(
      "  Note: this came from the emulator, not a real project — it is a\n" +
        "  snapshot of test data, not a backup. Use `npm run prod:export` to\n" +
        "  back up live data.\n",
    );
  }
}

main().catch((error: unknown) => {
  console.error(
    `\nExport failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
