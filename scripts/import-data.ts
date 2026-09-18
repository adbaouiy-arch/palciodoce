/**
 * Imports a `db:export` JSON file into Firestore.
 *
 *   npm run db:import -- --file backups/export-....json
 *   npm run db:import -- --file ... --dry-run
 *
 * This is where the relational shape becomes documents:
 *
 *   4 categories + 12 categoryTranslations  ->  4 category docs
 *   5 products + 15 translations + 5 images ->  5 product docs
 *   3 pages + 9 pageTranslations            ->  3 page docs
 *   10 orders + 25 orderItems               -> 10 order docs (items embedded)
 *
 * It also builds the `productSlugs` / `categorySlugs` index documents that
 * replace the old `@@unique([locale, slug])` constraints, and seeds the daily
 * order counters so newly placed orders continue the existing sequence instead
 * of restarting at 0001 and colliding with a migrated order.
 *
 * Idempotent: documents are keyed by stable IDs and written with `set`, so
 * re-running converges rather than duplicating.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "../src/lib/firebase/admin";
import { describeTarget } from "./target";
import { COLLECTIONS, slugDocId } from "../src/lib/firebase/collections";
import { routing, type AppLocale } from "../src/i18n/routing";

type Row = Record<string, unknown>;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const dryRun = process.argv.includes("--dry-run");

/*
  `--orders-only` skips the catalogue and the informational pages.

  It exists because this file and `data/catalogue.json` both describe products,
  categories and pages — and this one describes them as they were *before* the
  migration. Running it after `db:seed` therefore reverses any edit made since,
  which is how the privacy policy silently reverted to a version that did not
  name Google as a processor.

  Orders, by contrast, exist nowhere else: they are the only reason to still
  run this. So provisioning uses this flag, and the tracked catalogue stays
  authoritative for everything it covers.
*/
const ordersOnly = process.argv.includes("--orders-only");

function asDate(value: unknown): Timestamp {
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return Timestamp.fromDate(d);
  }
  if (value instanceof Date) return Timestamp.fromDate(value);
  return Timestamp.fromDate(new Date(0));
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableNum(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  // SQLite stores booleans as 0/1.
  if (typeof value === "number") return value !== 0;
  return fallback;
}

/** Groups child rows by the parent id they point at. */
function groupBy<T extends Row>(rows: T[], key: string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const id = str(row[key]);
    if (!id) continue;
    const list = out.get(id);
    if (list) list.push(row);
    else out.set(id, [row]);
  }
  return out;
}

/** Builds a `{ pt: {...}, en: {...} }` map from translation rows. */
function translationMap(
  rows: Row[],
  pick: (row: Row) => Record<string, unknown>,
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const row of rows) {
    const locale = str(row.locale);
    if (!routing.locales.includes(locale as AppLocale)) continue;
    out[locale] = pick(row);
  }
  return out;
}

async function main() {
  const file = arg("file");
  if (!file) {
    throw new Error(
      "Pass the export to import:\n  npm run db:import -- --file backups/export-....json",
    );
  }

  const data = JSON.parse(readFileSync(file, "utf8")) as Record<string, Row[]>;
  const db = getDb();

  console.log(`source     : ${file}`);
  console.log(`target     : ${describeTarget().label}`);
  console.log(`mode       : ${dryRun ? "dry run (no writes)" : "writing"}\n`);

  // A batch caps at 500 writes; the dataset is small but this keeps it honest.
  let batch = db.batch();
  let queued = 0;
  const written: Record<string, number> = {};

  async function flush() {
    if (queued === 0) return;
    if (!dryRun) await batch.commit();
    batch = db.batch();
    queued = 0;
  }

  async function write(collection: string, id: string, doc: Row) {
    batch.set(db.collection(collection).doc(id), doc, { merge: true });
    written[collection] = (written[collection] ?? 0) + 1;
    queued++;
    if (queued >= 400) await flush();
  }

  // --- categories ---------------------------------------------------------
  if (!ordersOnly) {
  const categoryTranslations = groupBy(data.categoryTranslations ?? [], "categoryId");
  for (const category of data.categories ?? []) {
    const id = str(category.id);
    const translations = translationMap(
      categoryTranslations.get(id) ?? [],
      (row) => ({
        name: str(row.name),
        slug: str(row.slug),
        description: str(row.description) || null,
        seoTitle: str(row.seoTitle) || null,
        seoDescription: str(row.seoDescription) || null,
      }),
    );

    await write(COLLECTIONS.categories, id, {
      key: str(category.key),
      position: num(category.position),
      isActive: bool(category.isActive, true),
      translations,
      createdAt: asDate(category.createdAt),
      updatedAt: asDate(category.updatedAt),
    });

    for (const [locale, translation] of Object.entries(translations)) {
      const slug = str(translation.slug);
      if (!slug) continue;
      await write(
        COLLECTIONS.categorySlugs,
        slugDocId(locale as AppLocale, slug),
        { categoryId: id, locale, slug },
      );
    }
  }

  } // end categories

  // --- products -----------------------------------------------------------
  if (!ordersOnly) {
  const productTranslations = groupBy(data.productTranslations ?? [], "productId");
  const productImages = groupBy(data.productImages ?? [], "productId");
  const categoryKeyById = new Map(
    (data.categories ?? []).map((c) => [str(c.id), str(c.key)]),
  );

  for (const product of data.products ?? []) {
    const id = str(product.id);
    const categoryId = str(product.categoryId) || null;

    const translations = translationMap(
      productTranslations.get(id) ?? [],
      (row) => ({
        name: str(row.name),
        slug: str(row.slug),
        shortDescription: str(row.shortDescription),
        description: str(row.description),
        ingredients: str(row.ingredients),
        allergens: str(row.allergens),
        storageInformation: str(row.storageInformation),
        seoTitle: str(row.seoTitle),
        seoDescription: str(row.seoDescription),
      }),
    );

    const images = (productImages.get(id) ?? [])
      .slice()
      .sort((a, b) => num(a.position) - num(b.position))
      .map((image) => ({
        url: str(image.url),
        alt: str(image.alt) || null,
        position: num(image.position),
      }));

    await write(COLLECTIONS.products, id, {
      sku: str(product.sku),
      priceCents: num(product.priceCents),
      isActive: bool(product.isActive, true),
      isFeatured: bool(product.isFeatured),
      stock: nullableNum(product.stock),
      weightGrams: nullableNum(product.weightGrams),
      position: num(product.position),
      categoryId,
      // Denormalised so the shop can filter by category without a join.
      categoryKey: categoryId ? (categoryKeyById.get(categoryId) ?? null) : null,
      images,
      translations,
      createdAt: asDate(product.createdAt),
      updatedAt: asDate(product.updatedAt),
    });

    for (const [locale, translation] of Object.entries(translations)) {
      const slug = str(translation.slug);
      if (!slug) continue;
      await write(
        COLLECTIONS.productSlugs,
        slugDocId(locale as AppLocale, slug),
        { productId: id, locale, slug },
      );
    }
  }

  } // end products

  // --- pages --------------------------------------------------------------
  if (!ordersOnly) {
  const pageTranslations = groupBy(data.pageTranslations ?? [], "pageId");
  for (const page of data.pages ?? []) {
    const id = str(page.id);
    const key = str(page.key);
    // The key becomes the document ID, replacing the old @unique constraint.
    await write(COLLECTIONS.pages, key, {
      key,
      translations: translationMap(pageTranslations.get(id) ?? [], (row) => ({
        title: str(row.title),
        content: str(row.content),
        seoTitle: str(row.seoTitle) || null,
        seoDescription: str(row.seoDescription) || null,
      })),
      createdAt: asDate(page.createdAt),
      updatedAt: asDate(page.updatedAt),
    });
  }
  } // end pages

  // --- orders -------------------------------------------------------------
  const orderItems = groupBy(data.orderItems ?? [], "orderId");
  // Highest sequence seen per day, so the counters resume correctly.
  const maxSequenceByDay = new Map<string, number>();

  for (const order of data.orders ?? []) {
    const id = str(order.id);
    const orderNumber = str(order.orderNumber);
    if (!orderNumber) continue;

    const items = (orderItems.get(id) ?? []).map((item) => ({
      productId: str(item.productId) || null,
      quantity: num(item.quantity),
      unitPriceCents: num(item.unitPriceCents),
      totalPriceCents: num(item.totalPriceCents),
      productNameSnapshot: str(item.productNameSnapshot),
      productSlugSnapshot: str(item.productSlugSnapshot),
    }));

    const email = str(order.customerEmail);

    // The order number is the document ID, replacing @unique orderNumber.
    await write(COLLECTIONS.orders, orderNumber, {
      orderNumber,
      orderLanguage: str(order.orderLanguage, "pt"),
      customerName: str(order.customerName),
      customerEmail: email,
      // Required for the tracking page: Firestore cannot compare
      // case-insensitively, so the lowercased form is stored explicitly.
      customerEmailLower: email.toLocaleLowerCase(),
      customerPhone: str(order.customerPhone),
      fulfillmentMethod: str(order.fulfillmentMethod, "PICKUP"),
      deliveryAddress: str(order.deliveryAddress) || null,
      deliveryCity: str(order.deliveryCity) || null,
      deliveryPostalCode: str(order.deliveryPostalCode) || null,
      pickupNotes: str(order.pickupNotes) || null,
      requestedDate: order.requestedDate ? asDate(order.requestedDate) : null,
      notes: str(order.notes) || null,
      paymentMethod: str(order.paymentMethod, "MBWAY"),
      paymentStatus: str(order.paymentStatus, "PENDING"),
      status: str(order.status, "PENDING"),
      subtotalCents: num(order.subtotalCents),
      deliveryFeeCents: num(order.deliveryFeeCents),
      totalCents: num(order.totalCents),
      items,
      createdAt: asDate(order.createdAt),
      updatedAt: asDate(order.updatedAt),
    });

    // PD-20260916-0007 -> day 20260916, sequence 7
    const match = /^PD-(\d{8})-(\d+)$/.exec(orderNumber);
    if (match) {
      const [, day, sequence] = match;
      maxSequenceByDay.set(
        day,
        Math.max(maxSequenceByDay.get(day) ?? 0, Number(sequence)),
      );
    }
  }

  // --- contact messages ---------------------------------------------------
  for (const message of data.contactMessages ?? []) {
    const id = str(message.id);
    if (!id) continue;
    const email = str(message.email);

    await write(COLLECTIONS.contactMessages, id, {
      name: str(message.name),
      email,
      emailLower: email.toLocaleLowerCase(),
      message: str(message.message),
      locale: str(message.locale, "pt"),
      isHandled: bool(message.isHandled),
      createdAt: asDate(message.createdAt),
    });
  }

  // --- consent logs -------------------------------------------------------
  // The GDPR audit trail. Carried over rather than discarded: it is the
  // evidence that consent was given, and its value is precisely its history.
  for (const log of data.consentLogs ?? []) {
    const id = str(log.id);
    if (!id) continue;

    await write(COLLECTIONS.consentLogs, id, {
      visitorId: str(log.visitorId),
      necessary: bool(log.necessary, true),
      analytics: bool(log.analytics),
      marketing: bool(log.marketing),
      locale: str(log.locale, "pt"),
      createdAt: asDate(log.createdAt),
    });
  }

  /*
    Seed the counters. Without this, the first order placed on a day that
    already has migrated orders would be allocated sequence 1 — and the order
    document `create` would collide with the existing PD-<day>-0001, failing
    checkout. The counter has to know where the sequence left off.
  */
  for (const [day, sequence] of maxSequenceByDay) {
    await write(COLLECTIONS.counters, `orders-${day}`, { seq: sequence });
  }

  await flush();

  // --- report -------------------------------------------------------------
  console.log("written:");
  let total = 0;
  for (const [collection, count] of Object.entries(written).sort()) {
    total += count;
    console.log(`  ${String(count).padStart(4)}  ${collection}`);
  }
  console.log(`  ${"-".repeat(4)}`);
  console.log(`  ${String(total).padStart(4)}  documents\n`);

  if (maxSequenceByDay.size > 0) {
    console.log("order counters seeded (next order continues from these):");
    for (const [day, sequence] of [...maxSequenceByDay].sort()) {
      console.log(`  orders-${day}: seq=${sequence}`);
    }
  }

  const adminCount = (data.adminUsers ?? []).length;
  if (adminCount > 0) {
    console.log(
      `\nNote: ${adminCount} admin user(s) were NOT imported. Firebase Auth now owns\n` +
        "      identity, so the stored bcrypt hashes are meaningless. Create the\n" +
        "      Firebase account and grant access with:  npm run admin:grant",
    );
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(`\nImport failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  },
);
