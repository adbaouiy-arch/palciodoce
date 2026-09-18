/**
 * Integration tests for the Firestore data layer, run against the emulator.
 *
 *   npm run emulators        # terminal 1
 *   npm run test:data        # terminal 2
 *
 * Requires the catalogue and the sample orders to be loaded first:
 * `npm run db:import -- --file backups/<relational export>.json`. `db:seed`
 * alone is not enough — several assertions read the migrated orders.
 *
 * Re-runnable. Counts are asserted as agreement between code paths rather than
 * as absolute numbers, because this suite places orders of its own and
 * `npm run smoke` writes to the same emulator.
 *
 * These cover the properties SQL used to guarantee and Firestore does not, so
 * they are the regression net for the migration: unique order numbers, the
 * no-overselling stock guard under genuine concurrency, stock restoration on
 * cancellation, and correct per-locale reads.
 */
import "dotenv/config";
import { getCategories, getCategoryBySlug } from "../src/lib/data/categories";
import {
  getFeaturedProducts,
  getProducts,
  getProductBySlug,
  searchProducts,
  getProductsForCart,
} from "../src/lib/data/products";
import { getPage, getPageLocales } from "../src/lib/data/pages";
import {
  createOrder,
  getOrderByNumber,
  findOrderForTracking,
} from "../src/lib/data/orders";
import {
  getDashboardStats,
  listOrders,
  getAdminOrder,
  listAdminProducts,
  listContactMessages,
  updateOrderStatus,
  ORDERS_PER_PAGE,
} from "../src/lib/data/admin";
import { getDb } from "../src/lib/firebase/admin";
import { COLLECTIONS } from "../src/lib/firebase/collections";
import { FulfillmentMethod, OrderStatus, PaymentStatus } from "../src/lib/domain";

/** What `npm run db:import` loads, and therefore the floor for any count. */
const SEEDED_ORDERS = 10;
const SEEDED_MESSAGE_EMAIL = "elatmanianiq@gmail.com";

let pass = 0, fail = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (ok) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`); }
  else { fail++; failures.push(label); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`); }
}

async function main() {
  console.log("\n— catalogue reads —");
  const catsPt = await getCategories("pt");
  const catsAr = await getCategories("ar");
  check("getCategories(pt)", catsPt.length === 4, catsPt.map((c) => c.name).join(", "));
  check("getCategories(ar) localised", catsAr[0]?.name !== catsPt[0]?.name, `ar: ${catsAr[0]?.name}`);
  check("ordered by position", catsPt[0]?.key === "sweets", `first: ${catsPt[0]?.key}`);

  const cat = await getCategoryBySlug("pt", "bolos");
  check("getCategoryBySlug(pt, bolos)", cat?.key === "cakes", cat?.name);
  check("  slugByLocale populated", Object.keys(cat?.slugByLocale ?? {}).length === 3, JSON.stringify(cat?.slugByLocale));
  check("  unknown slug -> null", (await getCategoryBySlug("pt", "nope")) === null);

  const featured = await getFeaturedProducts("pt", 4);
  check("getFeaturedProducts", featured.length === 4, `${featured.length} items`);
  const all = await getProducts("pt");
  check("getProducts(pt)", all.length === 5);
  const cakes = await getProducts("pt", { categoryKey: "cakes" });
  check("getProducts filtered by category", cakes.length === 1, cakes[0]?.name);

  const p = await getProductBySlug("pt", "cheesecake-frutos-vermelhos");
  check("getProductBySlug(pt)", p?.sku === "PD-CHK-001", p?.name);
  check("  price preserved", p?.priceCents === 2450, `${p?.priceCents}`);
  check("  image carried over", p?.image !== null, p?.image?.url);
  check("  category resolved", p?.categoryName === "Bolos", `${p?.categoryName} / ${p?.categorySlug}`);
  check("  3 locale slugs", p?.translations.length === 3, JSON.stringify(p?.translations.map((t) => t.locale)));
  check("  stock null = made-to-order", p?.stock === null, JSON.stringify(p?.stock));

  const pEn = await getProductBySlug("en", "red-berry-cheesecake");
  check("getProductBySlug(en) same product", pEn?.id === p?.id, pEn?.name);
  const pAr = await getProductBySlug("ar", "red-berry-cheesecake");
  check("getProductBySlug(ar) arabic name", pAr?.name !== pEn?.name, pAr?.name);

  console.log("\n— cross-locale search —");
  const s1 = await searchProducts("pt", "cheesecake");
  check("search pt 'cheesecake'", s1.length >= 1, `${s1.length} hits`);
  const s2 = await searchProducts("pt", "تشيز");
  check("arabic query returns pt results", s2.length >= 1, s2.map((x) => x.name).join(", "));

  console.log("\n— pages —");
  const priv = await getPage("pt", "privacy");
  check("getPage(pt, privacy)", (priv?.content.length ?? 0) > 500, `${priv?.content.length} chars`);
  check("  title", priv?.title === "Política de Privacidade", priv?.title);
  const locales = await getPageLocales("privacy");
  check("getPageLocales", locales.length === 3, locales.join(","));

  console.log("\n— migrated orders —");
  const o = await getOrderByNumber("PD-20260916-0001");
  check("getOrderByNumber", o?.customerName === "Ana Silva", o?.customerName);
  check("  items embedded", (o?.items.length ?? 0) === 1, `${o?.items.length} items`);
  check("  totals preserved", o?.totalCents === 900, `${o?.subtotalCents}+${o?.deliveryFeeCents}=${o?.totalCents}`);
  check("  snapshot name", o?.items[0]?.productNameSnapshot.includes("Copo") ?? false, o?.items[0]?.productNameSnapshot);

  const track = await findOrderForTracking({ orderNumber: "PD-20260916-0001", email: "ANA@EXAMPLE.PT" });
  check("tracking: uppercase email matches", track !== null);
  const trackBad = await findOrderForTracking({ orderNumber: "PD-20260916-0001", email: "attacker@evil.com" });
  check("tracking: wrong email rejected", trackBad === null);

  /*
    The admin assertions below check *agreement between two code paths* rather
    than absolute row counts.

    They used to assert "10 orders", which made the suite pass exactly once: its
    own concurrency test places orders, and `npm run smoke` adds an order and a
    contact message to the same emulator. A count that has to be edited whenever
    anything else runs is not testing the aggregation, it is recording a
    coincidence. Comparing `getDashboardStats` against `listOrders` and a direct
    read is a stronger check and holds no matter how much data has accumulated.
  */
  console.log("\n— admin —");
  const stats = await getDashboardStats();
  const list = await listOrders({ page: 1 });

  check(
    "getDashboardStats totalOrders agrees with listOrders",
    stats.totalOrders === list.total && stats.totalOrders >= SEEDED_ORDERS,
    `${stats.totalOrders} vs ${list.total}`,
  );
  check(
    "  status breakdown sums to the total",
    stats.ordersByStatus.reduce((sum, row) => sum + row.count, 0) === stats.totalOrders,
    `${stats.ordersByStatus.map((r) => `${r.status}:${r.count}`).join(" ")}`,
  );

  // Recompute revenue from the orders themselves: paid, not cancelled.
  const allOrderDocs = await getDb().collection(COLLECTIONS.orders).get();
  const expectedRevenue = allOrderDocs.docs
    .map((doc) => doc.data())
    .filter(
      (order) =>
        order.paymentStatus === PaymentStatus.PAID &&
        order.status !== OrderStatus.CANCELLED,
    )
    .reduce((sum, order) => sum + (order.totalCents as number), 0);
  check(
    "  revenue counts paid, non-cancelled orders only",
    stats.revenueCents === expectedRevenue,
    `${stats.revenueCents} vs ${expectedRevenue}`,
  );

  const messages = await listContactMessages();
  check(
    "  unhandled messages agrees with listContactMessages",
    stats.unhandledMessages === messages.filter((m) => !m.isHandled).length,
    `${stats.unhandledMessages}`,
  );

  check(
    "listOrders fills a page up to ORDERS_PER_PAGE",
    list.orders.length === Math.min(list.total, ORDERS_PER_PAGE),
    `${list.orders.length}/${list.total}, page size ${ORDERS_PER_PAGE}`,
  );
  check(
    "  newest first",
    list.orders.every(
      (order, i) =>
        i === 0 ||
        order.createdAt.getTime() <= list.orders[i - 1].createdAt.getTime(),
    ),
  );
  const filtered = await listOrders({ status: OrderStatus.PENDING });
  check("listOrders filtered by status", filtered.total >= 1, `${filtered.total} pending`);
  check(
    "  every filtered result actually has that status",
    filtered.orders.every((order) => order.status === OrderStatus.PENDING),
  );
  const adminOrder = await getAdminOrder("PD-20260916-0001");
  check("getAdminOrder shows PII", adminOrder?.customerPhone !== "", adminOrder?.customerPhone);
  const adminProducts = await listAdminProducts();
  check("listAdminProducts", adminProducts.length === 5);
  check("  translations complete", adminProducts.every((r) => r.translationLocales.length === 3));
  check(
    "listContactMessages includes the seeded enquiry",
    messages.some((m) => m.email === SEEDED_MESSAGE_EMAIL),
    messages.map((m) => m.email).join(", "),
  );

  console.log("\n— order pipeline: stock guard —");
  const db = getDb();
  const cupId = all.find((x) => x.sku === "PD-DES-003")?.id;
  if (!cupId) throw new Error("PD-DES-003 not found");
  await db.collection(COLLECTIONS.products).doc(cupId).update({ stock: 3 });

  const over = await createOrder({
    locale: "pt",
    customer: { name: "Guard Test", email: "g@example.pt", phone: "+351911000000" },
    fulfillment: { method: FulfillmentMethod.PICKUP },
    paymentMethod: "CASH_ON_PICKUP",
    items: [{ productId: cupId, quantity: 5 }],
  });
  check("ordering 5 of 3 refused", over.ok === false && over.error === "unavailable_items", JSON.stringify(over));
  const stockAfterFail = (await db.collection(COLLECTIONS.products).doc(cupId).get()).get("stock");
  check("  stock untouched", stockAfterFail === 3, `${stockAfterFail}`);

  const exact = await createOrder({
    locale: "pt",
    customer: { name: "Guard Test", email: "g@example.pt", phone: "+351911000000" },
    fulfillment: { method: FulfillmentMethod.PICKUP },
    paymentMethod: "CASH_ON_PICKUP",
    items: [{ productId: cupId, quantity: 3 }],
  });
  check("ordering exactly 3 succeeds", exact.ok === true, exact.ok ? exact.order.orderNumber : JSON.stringify(exact));
  const stockNow = (await db.collection(COLLECTIONS.products).doc(cupId).get()).get("stock");
  check("  stock decremented to 0", stockNow === 0, `${stockNow}`);

  const none = await createOrder({
    locale: "pt",
    customer: { name: "Guard Test", email: "g@example.pt", phone: "+351911000000" },
    fulfillment: { method: FulfillmentMethod.PICKUP },
    paymentMethod: "CASH_ON_PICKUP",
    items: [{ productId: cupId, quantity: 1 }],
  });
  check("ordering from 0 refused", none.ok === false);

  console.log("\n— CONCURRENCY: two simultaneous checkouts for the last item —");
  await db.collection(COLLECTIONS.products).doc(cupId).update({ stock: 1 });
  const race = await Promise.all([
    createOrder({ locale: "pt", customer: { name: "A", email: "a@example.pt", phone: "+351911000000" }, fulfillment: { method: FulfillmentMethod.PICKUP }, paymentMethod: "CASH_ON_PICKUP", items: [{ productId: cupId, quantity: 1 }] }),
    createOrder({ locale: "pt", customer: { name: "B", email: "b@example.pt", phone: "+351911000000" }, fulfillment: { method: FulfillmentMethod.PICKUP }, paymentMethod: "CASH_ON_PICKUP", items: [{ productId: cupId, quantity: 1 }] }),
  ]);
  const wins = race.filter((r) => r.ok).length;
  const finalStock = (await db.collection(COLLECTIONS.products).doc(cupId).get()).get("stock");
  check("exactly one checkout wins (no overselling)", wins === 1, `${wins} succeeded`);
  check("  stock is 0, never negative", finalStock === 0, `${finalStock}`);

  const numbers = race.filter((r) => r.ok).map((r) => (r as { order: { orderNumber: string } }).order.orderNumber);
  check("order numbers unique", new Set(numbers).size === numbers.length, numbers.join(", "));

  console.log("\n— order number continues the migrated sequence —");
  const placed = race.find((r) => r.ok);
  if (placed?.ok) {
    const match = /^PD-(\d{8})-(\d{4})$/.exec(placed.order.orderNumber);
    check("format PD-YYYYMMDD-NNNN", match !== null, placed.order.orderNumber);
    check("  did not restart at 0001", match ? Number(match[2]) > 1 : false, placed.order.orderNumber);
  }

  console.log("\n— cancel restores stock —");
  if (exact.ok) {
    await db.collection(COLLECTIONS.products).doc(cupId).update({ stock: 5 });
    await updateOrderStatus({ orderNumber: exact.order.orderNumber, status: OrderStatus.CANCELLED });
    const restored = (await db.collection(COLLECTIONS.products).doc(cupId).get()).get("stock");
    check("stock restored on cancel", restored === 8, `5 + 3 = ${restored}`);
    await updateOrderStatus({ orderNumber: exact.order.orderNumber, status: OrderStatus.CANCELLED });
    const again = (await db.collection(COLLECTIONS.products).doc(cupId).get()).get("stock");
    check("  re-cancel does not double-restock", again === 8, `${again}`);
  }

  console.log("\n— cart hydration —");
  const cart = await getProductsForCart("ar", [cupId, "does-not-exist"]);
  check("getProductsForCart resolves known ids", cart.size === 1);
  check("  localised to ar", /[\u0600-\u06FF]/.test(cart.get(cupId)?.name ?? ""), cart.get(cupId)?.name);

  // Restore made-to-order state and remove test orders.
  await db.collection(COLLECTIONS.products).doc(cupId).update({ stock: null });
  for (const r of [...race, exact]) {
    if (r.ok) await db.collection(COLLECTIONS.orders).doc(r.order.orderNumber).delete();
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`passed: ${pass}   failed: ${fail}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`\nFATAL: ${e instanceof Error ? e.stack : e}`);
  process.exit(1);
});
