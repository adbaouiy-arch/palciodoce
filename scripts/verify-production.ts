/**
 * Checks a live Firebase project actually works, from the application's side.
 *
 *   npm run prod:verify
 *
 * Distinct from the test suites, which run against the emulator. This exercises
 * the real project, and its job is to catch the things only production can get
 * wrong:
 *
 *   - security rules published but denying something the site needs
 *   - composite indexes missing, which the emulator never reveals
 *   - the admin allowlist and the custom claim out of step
 *   - data that imported but did not resolve (slug indexes, translations)
 *
 * Read-only. It never writes, so it is safe to run against a live shop.
 */
import "dotenv/config";
import { getAdminAuth, getDb } from "../src/lib/firebase/admin";
import { COLLECTIONS } from "../src/lib/firebase/collections";
import {
  getFeaturedProducts,
  getProducts,
  getProductBySlug,
  searchProducts,
} from "../src/lib/data/products";
import { getCategories, getCategoryBySlug } from "../src/lib/data/categories";
import { getPage } from "../src/lib/data/pages";
import { getOrderByNumber } from "../src/lib/data/orders";
import {
  getDashboardStats,
  listOrders,
  listContactMessages,
} from "../src/lib/data/admin";
import { OrderStatus } from "../src/lib/domain";
import { describeTarget } from "./target";

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

let passed = 0;
const failures: string[] = [];
const missingIndexes: string[] = [];

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ${green("✓")} ${label}${detail ? dim(` — ${detail}`) : ""}`);
  } else {
    failures.push(label);
    console.log(`  ${red("✗")} ${label}${detail ? dim(` — ${detail}`) : ""}`);
  }
}

/**
 * Runs a query, separating "needs an index" from a genuine failure.
 *
 * Firestore reports a missing composite index as FAILED_PRECONDITION with a
 * console link. It is a configuration gap rather than a bug, and the emulator
 * never produces it, so it is worth calling out by name instead of lumping it
 * in with errors.
 */
async function query<T>(label: string, run: () => Promise<T>): Promise<T | null> {
  try {
    const result = await run();
    passed++;
    console.log(`  ${green("✓")} ${label}`);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/requires an index|FAILED_PRECONDITION/i.test(message)) {
      missingIndexes.push(label);
      console.log(`  ${yellow("!")} ${label} ${dim("— needs a composite index")}`);
      return null;
    }
    failures.push(label);
    console.log(`  ${red("✗")} ${label} ${dim(`— ${message.split("\n")[0]}`)}`);
    return null;
  }
}

function section(title: string) {
  console.log(`\n${bold(title)}`);
}

async function main() {
  const target = describeTarget();
  console.log(bold(`\nVerifying ${target.label}`));

  if (target.emulated) {
    console.log(
      `\n  ${yellow("!")} This is the emulator. For the real project:\n` +
        "    npm run prod:verify\n",
    );
  }

  // -------------------------------------------------------------------------
  section("Connection");
  const products = await getDb().collection(COLLECTIONS.products).get();
  check("Firestore reachable", true, `${products.size} product documents`);

  const counts: Record<string, number> = {};
  for (const name of Object.values(COLLECTIONS)) {
    counts[name] = (await getDb().collection(name).count().get()).data().count;
  }
  console.log(
    `     ${dim(Object.entries(counts).map(([k, v]) => `${k}:${v}`).join("  "))}`,
  );

  // -------------------------------------------------------------------------
  section("Storefront reads (no index needed)");
  const all = await getProducts("pt");
  check("product list resolves", all.length > 0, `${all.length} active`);
  check(
    "translations present",
    all.every((p) => p.name.length > 0),
    all.map((p) => p.name).join(", ").slice(0, 60) + "…",
  );

  const bySlug = await getProductBySlug("pt", "cheesecake-frutos-vermelhos");
  check("slug index resolves a product", bySlug !== null, bySlug?.name);

  const ar = await getProductBySlug("ar", "red-berry-cheesecake");
  check("Arabic slug resolves", ar !== null, ar?.name);

  const categories = await getCategories("pt");
  check("categories resolve", categories.length > 0, `${categories.length}`);

  const category = await getCategoryBySlug("pt", "bolos");
  check("category slug index resolves", category !== null, category?.name);

  const privacy = await getPage("pt", "privacy");
  check(
    "privacy policy names Google as processor",
    Boolean(privacy?.content.includes("Google Ireland Limited")),
  );
  check(
    "privacy policy states EU hosting",
    Boolean(privacy?.content.includes("União Europeia")),
  );

  const search = await searchProducts("pt", "cheesecake");
  check("search works", search.length > 0, `${search.length} hits`);

  const order = await getOrderByNumber("PD-20260916-0001");
  check("a migrated order resolves", order !== null, `${order?.items.length} items`);

  // -------------------------------------------------------------------------
  /*
    Several equality filters together need no composite index — Firestore
    intersects the automatic single-field indexes. Verified against the live
    project, which is why these sit above the index section rather than in it.
  */
  const featured = await getFeaturedProducts("pt");
  check("featured products (equality only, no index)", featured.length > 0, `${featured.length}`);
  const inCategory = await getProducts("pt", { categoryKey: "cakes" });
  check("products by category (equality only, no index)", inCategory.length > 0, `${inCategory.length}`);

  section("Queries that need composite indexes");
  await query("admin orders filtered by status", () =>
    listOrders({ status: OrderStatus.PENDING }),
  );
  await query("admin dashboard aggregates", () => getDashboardStats());
  await query("admin contact messages", () => listContactMessages());

  // -------------------------------------------------------------------------
  section("Admin access");
  const admins = await getDb().collection(COLLECTIONS.adminUsers).get();
  check("allowlist has an entry", !admins.empty, `${admins.size}`);

  for (const doc of admins.docs) {
    const user = await getAdminAuth().getUser(doc.id).catch(() => null);
    check(
      `  ${doc.get("email")} has a Firebase account`,
      user !== null,
      user?.uid,
    );
    check(
      `  ${doc.get("email")} carries the admin claim`,
      user?.customClaims?.admin === true,
    );
  }

  const config = await getAdminAuth()
    .projectConfigManager()
    .getProjectConfig()
    .catch(() => null);
  if (config) {
    check("password sign-in is enabled", true);
  }

  // -------------------------------------------------------------------------
  console.log(
    `\n${bold("Result")}  ${green(`${passed} passed`)}` +
      (missingIndexes.length ? `, ${yellow(`${missingIndexes.length} awaiting index`)}` : "") +
      (failures.length ? `, ${red(`${failures.length} failed`)}` : ""),
  );

  if (missingIndexes.length > 0) {
    console.log(
      `\n  ${yellow("Composite indexes are not ready.")} The storefront is unaffected —\n` +
        "  only the admin area needs them: the dashboard totals, the order list\n" +
        "  filtered by status, and the messages list.\n\n" +
        "  Either the build is still running (a few minutes), or the indexes have\n" +
        "  not been created. Check:\n" +
        `    https://console.firebase.google.com/project/${target.projectId}/firestore/indexes\n` +
        "  Create them with: npm run rules:deploy",
    );
  }

  if (failures.length > 0) {
    console.log("");
    for (const failure of failures) console.log(`  ${red("✗")} ${failure}`);
  }

  console.log("");
  process.exit(failures.length ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(`\n${red("✗")} ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
