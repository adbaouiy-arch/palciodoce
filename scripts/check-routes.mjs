/**
 * Verifies that every route declared in `src/i18n/routing.ts` has a
 * matching page file.
 *
 * The routing config is the contract: a pathname listed there is linked
 * from the header, footer or a redirect, so a missing page file is a live
 * 404 rather than a compile error. This check catches that.
 *
 *   node scripts/check-routes.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const source = readFileSync(join(root, "src/i18n/routing.ts"), "utf8");
const pathnamesBlock = source.slice(source.indexOf("pathnames:"));

// Top-level keys of the `pathnames` map, e.g. "/", "/shop", "/product/[slug]".
const routes = [...pathnamesBlock.matchAll(/^ {4}"(\/[^"]*)":/gm)].map((m) => m[1]);

if (routes.length === 0) {
  console.error("Could not parse any routes from src/i18n/routing.ts");
  process.exit(1);
}

let missing = 0;

for (const route of routes) {
  const segment = route === "/" ? "" : route;
  const file = `src/app/[locale]${segment}/page.tsx`;

  if (existsSync(join(root, file))) {
    console.log(`  ✓ ${route.padEnd(36)} ${file}`);
  } else {
    console.log(`  ✗ ${route.padEnd(36)} MISSING ${file}`);
    missing++;
  }
}

console.log(
  `\n${routes.length} declared route${routes.length === 1 ? "" : "s"}, ${missing} missing.`,
);

process.exit(missing > 0 ? 1 : 0);
