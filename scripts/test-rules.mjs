/**
 * Security-rules tests for firestore.rules, run against the emulator.
 *
 *   npm run emulators          # terminal 1
 *   npm run test:rules         # terminal 2
 *
 * These assert the rules from the perspective of a *browser* — that is, the
 * client SDK. Server code uses the Admin SDK, which bypasses rules entirely,
 * so none of this constrains the application; it constrains an attacker with
 * the (public) web API key.
 *
 * The important cases are the negative ones. A ruleset that allows what it
 * should is easy; the value is in proving it denies what it must.
 */
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

/*
  A *different* project ID from the application's ("demo-palaciodoce").

  The emulator keeps a separate datastore per project, so this gives the rules
  tests their own database. They call `clearFirestore()`, and pointing that at
  the app's project would delete the migrated catalogue and orders every time
  the suite ran — which it did, until this was separated out. `firebase.json`
  deliberately leaves `singleProjectMode` off so both can coexist.
*/
const PROJECT_ID = "demo-palaciodoce-rules";
const HOST = "127.0.0.1";
const PORT = 8080;

let passed = 0;
let failed = 0;
const failures = [];

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

async function expect(label, promise) {
  try {
    await promise;
    passed++;
    console.log(`  ${green("✓")} ${label}`);
  } catch (error) {
    failed++;
    failures.push(`${label} — ${error.message?.split("\n")[0] ?? error}`);
    console.log(`  ${red("✗")} ${label}`);
  }
}

function section(title) {
  console.log(`\n${bold(title)}`);
}

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: {
    host: HOST,
    port: PORT,
    rules: readFileSync("firestore.rules", "utf8"),
  },
});

await testEnv.clearFirestore();

// Seed fixtures with rules disabled — this is the Admin-SDK equivalent, i.e.
// how the real application writes.
await testEnv.withSecurityRulesDisabled(async (context) => {
  const db = context.firestore();
  await setDoc(doc(db, "products/live"), { isActive: true, sku: "PD-1", priceCents: 550 });
  await setDoc(doc(db, "products/draft"), { isActive: false, sku: "PD-2", priceCents: 550 });
  await setDoc(doc(db, "categories/live"), { isActive: true, key: "cakes" });
  await setDoc(doc(db, "categories/draft"), { isActive: false, key: "secret" });
  await setDoc(doc(db, "pages/privacy"), { key: "privacy" });
  await setDoc(doc(db, "productSlugs/pt_bolo"), { productId: "live" });
  await setDoc(doc(db, "categorySlugs/pt_bolos"), { categoryId: "live" });
  await setDoc(doc(db, "orders/PD-20260916-0001"), {
    customerName: "Ana Silva",
    customerEmail: "ana@example.pt",
    customerPhone: "+351912345678",
    totalCents: 900,
  });
  await setDoc(doc(db, "contactMessages/m1"), { name: "Ana", email: "ana@example.pt" });
  await setDoc(doc(db, "consentLogs/c1"), { visitorId: "v1", analytics: false });
  await setDoc(doc(db, "adminUsers/uid1"), { email: "admin@palaciodoce.pt" });
  await setDoc(doc(db, "counters/orders-20260916"), { seq: 7 });
});

const anon = testEnv.unauthenticatedContext().firestore();
const user = testEnv.authenticatedContext("random-signup").firestore();
const admin = testEnv
  .authenticatedContext("admin-uid", { admin: true })
  .firestore();

// ---------------------------------------------------------------------------
section("Anonymous visitor — published catalogue is readable");
await expect("reads an active product", assertSucceeds(getDoc(doc(anon, "products/live"))));
await expect("reads an active category", assertSucceeds(getDoc(doc(anon, "categories/live"))));
await expect("reads a page", assertSucceeds(getDoc(doc(anon, "pages/privacy"))));
await expect("reads a product slug index", assertSucceeds(getDoc(doc(anon, "productSlugs/pt_bolo"))));
await expect("reads a category slug index", assertSucceeds(getDoc(doc(anon, "categorySlugs/pt_bolos"))));
await expect(
  "lists products when constrained to isActive == true",
  assertSucceeds(getDocs(query(collection(anon, "products"), where("isActive", "==", true)))),
);

section("Anonymous visitor — unpublished catalogue is hidden");
await expect("CANNOT read an inactive product", assertFails(getDoc(doc(anon, "products/draft"))));
await expect("CANNOT read an inactive category", assertFails(getDoc(doc(anon, "categories/draft"))));
await expect(
  "CANNOT list all products unconstrained",
  assertFails(getDocs(collection(anon, "products"))),
);

section("Anonymous visitor — personal data is denied");
await expect("CANNOT read an order", assertFails(getDoc(doc(anon, "orders/PD-20260916-0001"))));
await expect("CANNOT enumerate orders", assertFails(getDocs(collection(anon, "orders"))));
await expect("CANNOT read a contact message", assertFails(getDoc(doc(anon, "contactMessages/m1"))));
await expect("CANNOT read a consent log", assertFails(getDoc(doc(anon, "consentLogs/c1"))));
await expect("CANNOT read the admin allowlist", assertFails(getDoc(doc(anon, "adminUsers/uid1"))));
await expect("CANNOT read the order counter", assertFails(getDoc(doc(anon, "counters/orders-20260916"))));

section("Anonymous visitor — every write is denied");
await expect("CANNOT create a product", assertFails(setDoc(doc(anon, "products/evil"), { isActive: true })));
await expect("CANNOT modify a product price", assertFails(updateDoc(doc(anon, "products/live"), { priceCents: 1 })));
await expect("CANNOT delete a product", assertFails(deleteDoc(doc(anon, "products/live"))));
await expect("CANNOT forge an order", assertFails(setDoc(doc(anon, "orders/PD-99999999-9999"), { totalCents: 1 })));
await expect("CANNOT tamper with an order total", assertFails(updateDoc(doc(anon, "orders/PD-20260916-0001"), { totalCents: 1 })));
await expect("CANNOT write a contact message", assertFails(setDoc(doc(anon, "contactMessages/evil"), { name: "x" })));
await expect("CANNOT forge a consent record", assertFails(setDoc(doc(anon, "consentLogs/evil"), { analytics: true })));
await expect("CANNOT add itself to the admin allowlist", assertFails(setDoc(doc(anon, "adminUsers/evil"), { email: "evil@example.com" })));
await expect("CANNOT tamper with the order counter", assertFails(updateDoc(doc(anon, "counters/orders-20260916"), { seq: 0 })));
await expect("CANNOT write to an unmapped collection", assertFails(setDoc(doc(anon, "somethingNew/x"), { a: 1 })));

section("Signed-in user WITHOUT the admin claim — no privilege gained");
await expect("CANNOT read an order", assertFails(getDoc(doc(user, "orders/PD-20260916-0001"))));
await expect("CANNOT read contact messages", assertFails(getDoc(doc(user, "contactMessages/m1"))));
await expect("CANNOT read an inactive product", assertFails(getDoc(doc(user, "products/draft"))));
await expect("CANNOT write anything", assertFails(setDoc(doc(user, "products/evil2"), { isActive: true })));

section("Admin claim — may read, still may not write");
await expect("reads an order", assertSucceeds(getDoc(doc(admin, "orders/PD-20260916-0001"))));
await expect("enumerates orders", assertSucceeds(getDocs(collection(admin, "orders"))));
await expect("reads contact messages", assertSucceeds(getDoc(doc(admin, "contactMessages/m1"))));
await expect("reads consent logs", assertSucceeds(getDoc(doc(admin, "consentLogs/c1"))));
await expect("reads an inactive product", assertSucceeds(getDoc(doc(admin, "products/draft"))));
await expect("CANNOT write an order (writes go through validated server code)", assertFails(updateDoc(doc(admin, "orders/PD-20260916-0001"), { status: "COMPLETED" })));
await expect("CANNOT write a product", assertFails(updateDoc(doc(admin, "products/live"), { priceCents: 1 })));
await expect("CANNOT read the admin allowlist", assertFails(getDoc(doc(admin, "adminUsers/uid1"))));
await expect("CANNOT read the order counter", assertFails(getDoc(doc(admin, "counters/orders-20260916"))));

/*
  Clear the fixtures again on the way out. The emulator is shared with the
  running application and the migration, so leaving `products/live` and friends
  behind makes them show up as real catalogue entries in other tests — which is
  exactly what happened the first time this ran.
*/
await testEnv.clearFirestore();
await testEnv.cleanup();

console.log(`\n${"─".repeat(52)}`);
console.log(`passed: ${green(passed)}   failed: ${failed ? red(failed) : failed}`);
if (failures.length > 0) {
  console.log(`\n${bold("Failures")}`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
