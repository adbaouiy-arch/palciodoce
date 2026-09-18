/**
 * Prints the environment variables Vercel needs, ready to paste.
 *
 *   npm run vercel:env              -> writes vercel-env.txt
 *   npm run vercel:env -- --stdout  -> prints them instead (careful: secrets)
 *
 * Derived from `.env.production` rather than retyped, so the values cannot drift
 * from the ones already proven to work locally.
 *
 * Deliberately not a copy of `.env.production`:
 *
 *   - The emulator variables are dropped. They exist in that file only to
 *     override `.env`, which Next.js layers underneath it locally. Vercel has no
 *     `.env` to override — it is gitignored and never deployed — so setting them
 *     there would be noise, and `src/lib/firebase/admin.ts` refuses to start if
 *     an emulator host is ever set against a real project id.
 *
 *   - ADMIN_EMAIL is dropped. Only the admin:grant and admin:revoke scripts read
 *     it, and those run from a laptop, never on the server.
 *
 *   - NEXT_PUBLIC_SITE_URL is added. Canonical URLs, hreflang, the sitemap and
 *     the structured data all derive from it, so without it a deployment on a
 *     .vercel.app address tells search engines that palaciodoce.pt is the
 *     canonical home of pages it is not yet serving.
 *
 * Writes to a file by default because three of these are secrets and a terminal
 * scrollback is a bad place for them.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const SOURCE = ".env.production";
const OUT = "vercel-env.txt";

/** Read by the running application — everything here must reach Vercel. */
const REQUIRED = [
  "AUTH_SECRET",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

/** Present in .env.production but pointless or harmful on Vercel. */
const EXCLUDED = new Set([
  "FIRESTORE_EMULATOR_HOST",
  "FIREBASE_AUTH_EMULATOR_HOST",
  "NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST",
  "ADMIN_EMAIL",
]);

/** Useful if present, not fatal if absent. */
const OPTIONAL = [
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
] as const;

function parseEnvFile(path: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    // Strip surrounding quotes without the `s` flag, which needs a newer
    // target than tsconfig sets: [^] matches any character including newlines.
    const value = trimmed.slice(eq + 1).trim().replace(/^"([^]*)"$/, "$1");
    out.set(key, value);
  }
  return out;
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const value = process.argv[i + 1];
  return i === -1 || !value || value.startsWith("--") ? undefined : value;
}

function main() {
  if (!existsSync(SOURCE)) {
    throw new Error(
      `${SOURCE} does not exist. Create it with:\n  npm run setup:production`,
    );
  }

  const env = parseEnvFile(SOURCE);

  const missing = REQUIRED.filter((key) => !env.get(key));
  if (missing.length > 0) {
    throw new Error(
      `${SOURCE} is missing: ${missing.join(", ")}.\n` +
        "Re-run `npm run setup:production` to regenerate it.",
    );
  }

  const siteUrl =
    flag("site-url") ?? env.get("NEXT_PUBLIC_SITE_URL") ?? "https://palaciodoce.pt";

  const lines: string[] = [];
  for (const key of REQUIRED) lines.push(`${key}=${env.get(key)}`);
  for (const key of OPTIONAL) {
    const value = env.get(key);
    if (value) lines.push(`${key}=${value}`);
  }
  lines.push(`NEXT_PUBLIC_SITE_URL=${siteUrl}`);

  const body = lines.join("\n") + "\n";

  if (process.argv.includes("--stdout")) {
    process.stdout.write(body);
    return;
  }

  writeFileSync(OUT, body, { encoding: "utf8", mode: 0o600 });

  console.log(`\nWrote ${OUT} — ${lines.length} variables, mode 600.\n`);
  console.log("  Paste the whole file into Vercel:");
  console.log("    Project → Settings → Environment Variables → paste into the");
  console.log("    key field. Vercel parses a .env-style block and expands it.");
  console.log("\n  Apply to Production, Preview and Development.\n");
  console.log(`  Excluded on purpose: ${[...EXCLUDED].join(", ")}`);
  console.log(`  Site URL set to: ${siteUrl}`);
  console.log(
    `    Override with: npm run vercel:env -- --site-url https://your-app.vercel.app\n`,
  );
  console.log(`  ${OUT} is gitignored. Delete it once pasted.\n`);

  // Three of these are secrets; say which, so they are treated accordingly.
  console.log("  Secret (do not share): AUTH_SECRET, FIREBASE_PRIVATE_KEY,");
  console.log("                         FIREBASE_CLIENT_EMAIL");
  console.log("  Public by design:      every NEXT_PUBLIC_* value\n");
}

try {
  main();
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
