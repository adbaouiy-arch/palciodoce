/**
 * Verifies that every locale's message catalogue is structurally
 * identical: same namespaces, same keys, no empty strings.
 *
 * A missing key in one language surfaces at runtime as a raw key name
 * rendered on the page, which is exactly the kind of defect that is easy
 * to ship and embarrassing to discover in production. Run with:
 *
 *   node scripts/check-messages.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const messagesDir = join(here, "..", "messages");
const locales = ["pt", "en", "ar"];

/** Collects "Namespace.key" paths, recursing into nested objects. */
function flatten(value, prefix = "") {
  const out = new Map();
  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      for (const [k, v] of flatten(entry, path)) out.set(k, v);
    } else {
      out.set(path, entry);
    }
  }
  return out;
}

const catalogues = new Map();
let failures = 0;

function fail(message) {
  console.error(`  ✗ ${message}`);
  failures++;
}

for (const locale of locales) {
  const file = join(messagesDir, `${locale}.json`);
  try {
    catalogues.set(locale, flatten(JSON.parse(readFileSync(file, "utf8"))));
  } catch (error) {
    fail(`${locale}.json is not valid JSON: ${error.message}`);
  }
}

if (failures > 0) process.exit(1);

const [reference, ...others] = locales;
const referenceKeys = catalogues.get(reference);

console.log(`Reference locale: ${reference} (${referenceKeys.size} keys)`);

for (const locale of others) {
  const keys = catalogues.get(locale);
  const missing = [...referenceKeys.keys()].filter((k) => !keys.has(k));
  const extra = [...keys.keys()].filter((k) => !referenceKeys.has(k));

  if (missing.length > 0) fail(`${locale} is missing: ${missing.join(", ")}`);
  if (extra.length > 0) fail(`${locale} has unexpected keys: ${extra.join(", ")}`);
  if (missing.length === 0 && extra.length === 0) {
    console.log(`  ✓ ${locale} matches ${reference} (${keys.size} keys)`);
  }
}

// Placeholder parity: a message using {name} in one language must use it
// in every language, or the interpolated value silently disappears.
for (const key of referenceKeys.keys()) {
  const placeholdersFor = (locale) => {
    const value = catalogues.get(locale)?.get(key);
    if (typeof value !== "string") return new Set();
    // Only real ICU argument names: an identifier directly followed by
    // `}` or `,`. This deliberately skips plural sub-messages such as
    // the `{Nenhum produto}` inside `{count, plural, =0 {...}}`, which
    // are translated prose rather than placeholders.
    return new Set(
      [...value.matchAll(/\{\s*(\w+)\s*(?:,|\})/g)].map((m) => m[1]),
    );
  };

  const expected = placeholdersFor(reference);
  for (const locale of others) {
    const actual = placeholdersFor(locale);
    const missing = [...expected].filter((p) => !actual.has(p));
    if (missing.length > 0) {
      fail(`${locale}.${key} is missing placeholder(s): ${missing.join(", ")}`);
    }
  }
}

for (const locale of locales) {
  for (const [key, value] of catalogues.get(locale)) {
    if (typeof value === "string" && value.trim() === "") {
      fail(`${locale}.${key} is empty`);
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} message catalogue problem(s) found.`);
  process.exit(1);
}

console.log("\nAll message catalogues are consistent.");
