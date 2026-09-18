/**
 * Probes firestore.rules as enforced on the LIVE project, using nothing but the
 * public web API key — i.e. exactly what a hostile browser has.
 *
 * Note on `list` vs `get`: a conditional read rule (`allow read: if
 * resource.data.isActive == true`) makes Firestore reject any query that cannot
 * itself guarantee every result passes. So an unfiltered "give me all products"
 * is denied while `where('isActive','==',true)` succeeds. That is the rule
 * working, not blocking legitimate access — and it is why an unfiltered list
 * returning 403 belongs in the "as intended" column.
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.production", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const PROJECT = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const KEY = env.NEXT_PUBLIC_FIREBASE_API_KEY;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

let wrong = 0;

function report(expectAllowed, label, status) {
  const allowed = status === 200;
  const ok = allowed === expectAllowed;
  if (!ok) wrong++;
  const want = expectAllowed ? "allow " : "deny  ";
  console.log(
    `  ${want} ${label.padEnd(40)} ${status}  ${ok ? "as intended" : "!!! WRONG !!!"}`,
  );
}

async function get(label, path, expectAllowed) {
  const r = await fetch(`${BASE}/${path}?key=${KEY}`);
  report(expectAllowed, label, r.status);
  return r;
}

/** A structured query, which is what the client SDK actually sends. */
async function runQuery(label, structuredQuery, expectAllowed) {
  const r = await fetch(`${BASE}:runQuery?key=${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery }),
  });
  report(expectAllowed, label, r.status);
  return r;
}

const activeFilter = {
  fieldFilter: {
    field: { fieldPath: "isActive" },
    op: "EQUAL",
    value: { booleanValue: true },
  },
};

console.log(`\nProbing live project ${PROJECT} with the public web API key only\n`);

console.log("Published catalogue — should be reachable the way the rules intend");
await runQuery(
  "products WHERE isActive == true",
  { from: [{ collectionId: "products" }], where: activeFilter },
  true,
);
await runQuery(
  "categories WHERE isActive == true",
  { from: [{ collectionId: "categories" }], where: activeFilter },
  true,
);
await get("legal pages (unconditional read)", "pages", true);
await get("product slug index", "productSlugs", true);
await get("category slug index", "categorySlugs", true);

// A single active document by id.
const firstActive = await fetch(`${BASE}:runQuery?key=${KEY}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    structuredQuery: {
      from: [{ collectionId: "products" }],
      where: activeFilter,
      limit: 1,
    },
  }),
});
const firstId = (await firstActive.json())[0]?.document?.name?.split("/").pop();
if (firstId) await get(`a single active product by id`, `products/${firstId}`, true);

console.log("\nUnfiltered listing — denied, because the rule is conditional");
await get("products, no isActive filter", "products", false);
await get("categories, no isActive filter", "categories", false);

console.log("\nPersonal data — denied outright");
await get("ORDERS (names, addresses, phones)", "orders", false);
await get("a specific order by its number", "orders/PD-20260916-0001", false);
await get("CONTACT MESSAGES", "contactMessages", false);
await get("CONSENT LOG", "consentLogs", false);
await get("ADMIN ALLOWLIST", "adminUsers", false);
await get("ORDER COUNTERS", "counters", false);

console.log("\nWrites — nothing, anywhere");
for (const [label, path] of [
  ["create a product", "products?documentId=injected"],
  ["create an order", "orders?documentId=PD-99999999-0001"],
  ["create a page", "pages?documentId=injected"],
]) {
  const r = await fetch(`${BASE}/${path}&key=${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { priceCents: { integerValue: "1" } } }),
  });
  report(false, label, r.status);
}

const patch = await fetch(
  `${BASE}/products/${firstId}?key=${KEY}&updateMask.fieldPaths=priceCents`,
  {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { priceCents: { integerValue: "1" } } }),
  },
);
report(false, "rewrite a product's price", patch.status);

const del = await fetch(`${BASE}/products/${firstId}?key=${KEY}`, { method: "DELETE" });
report(false, "delete a product", del.status);

console.log(
  wrong === 0
    ? "\nEvery rule behaved as intended.\n"
    : `\n${wrong} rule(s) did NOT behave as intended.\n`,
);
process.exit(wrong === 0 ? 0 : 1);
