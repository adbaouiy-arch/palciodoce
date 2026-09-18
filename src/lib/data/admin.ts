import {
  AggregateField,
  FieldValue,
  Timestamp,
  type DocumentData,
  type Query,
} from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/collections";
import {
  pickTranslation,
  readTranslations,
  requireDate,
  toBoolean,
  toDate,
  toNullableNumber,
  toNumberOr,
  toStringOr,
  toStringOrNull,
} from "@/lib/firebase/mappers";
import { routing, type AppLocale } from "@/i18n/routing";
import {
  FulfillmentMethod,
  OrderStatus,
  PaymentStatus,
  isFulfillmentMethod,
  isOrderStatus,
  isPaymentMethod,
  isPaymentStatus,
  type PaymentMethod,
} from "@/lib/domain";

/**
 * Reads and writes for the admin area.
 *
 * Separate from the customer-facing data layer because these intentionally
 * expose what customers never see — full contact details, every order
 * regardless of owner, unhandled enquiries. Anything importing this file must
 * sit behind `requireAdmin()`.
 *
 * Unlike the catalogue modules, the queries here use real `orderBy` with
 * filters, because order volume grows without bound. Those combinations need
 * composite indexes, declared in `firestore.indexes.json`. The emulator does
 * not enforce index requirements, so a missing declaration surfaces only in
 * production — every query below has a matching entry in that file.
 */

export type AdminOrderListItem = {
  id: string;
  orderNumber: string;
  orderLanguage: AppLocale;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillmentMethod: FulfillmentMethod;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  totalCents: number;
  requestedDate: Date | null;
  createdAt: Date;
  itemCount: number;
};

export type AdminDashboardStats = {
  totalOrders: number;
  openOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  awaitingPayment: number;
  revenueCents: number;
  unhandledMessages: number;
  ordersByStatus: { status: OrderStatus; count: number }[];
};

/** Statuses that still need someone to act on them. */
const OPEN_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
];

function toListItem(id: string, data: DocumentData): AdminOrderListItem {
  return {
    id,
    orderNumber: toStringOr(data.orderNumber, id),
    orderLanguage: toStringOr(data.orderLanguage, "pt") as AppLocale,
    customerName: toStringOr(data.customerName, ""),
    customerEmail: toStringOr(data.customerEmail, ""),
    customerPhone: toStringOr(data.customerPhone, ""),
    fulfillmentMethod: isFulfillmentMethod(data.fulfillmentMethod)
      ? data.fulfillmentMethod
      : FulfillmentMethod.PICKUP,
    paymentMethod: isPaymentMethod(data.paymentMethod) ? data.paymentMethod : "MBWAY",
    paymentStatus: isPaymentStatus(data.paymentStatus)
      ? data.paymentStatus
      : PaymentStatus.PENDING,
    status: isOrderStatus(data.status) ? data.status : OrderStatus.PENDING,
    totalCents: toNumberOr(data.totalCents, 0),
    requestedDate: toDate(data.requestedDate),
    createdAt: requireDate(data.createdAt),
    itemCount: Array.isArray(data.items) ? data.items.length : 0,
  };
}

async function countWhere(build: (q: Query) => Query): Promise<number> {
  const snapshot = await build(getDb().collection(COLLECTIONS.orders))
    .count()
    .get();
  return snapshot.data().count;
}

export async function getDashboardStats(): Promise<AdminDashboardStats> {
  const db = getDb();
  const orders = db.collection(COLLECTIONS.orders);

  /*
    Server-side aggregations rather than reading every document. `count()` and
    `sum()` are billed per batch of index entries scanned, not per document, so
    this stays cheap as the order table grows — and no order payload crosses
    the wire just to be counted.
  */
  const [
    totalOrders,
    openOrders,
    completedOrders,
    cancelledOrders,
    awaitingPayment,
    revenue,
    unhandledMessages,
    byStatus,
  ] = await Promise.all([
    countWhere((q) => q),
    countWhere((q) => q.where("status", "in", OPEN_STATUSES)),
    countWhere((q) => q.where("status", "==", OrderStatus.COMPLETED)),
    countWhere((q) => q.where("status", "==", OrderStatus.CANCELLED)),
    countWhere((q) => q.where("paymentStatus", "==", PaymentStatus.PENDING)),
    // Revenue counts money actually received, so it excludes orders that are
    // merely placed and unpaid, and excludes cancellations.
    orders
      .where("paymentStatus", "==", PaymentStatus.PAID)
      .where("status", "!=", OrderStatus.CANCELLED)
      .aggregate({ total: AggregateField.sum("totalCents") })
      .get(),
    db
      .collection(COLLECTIONS.contactMessages)
      .where("isHandled", "==", false)
      .count()
      .get(),
    Promise.all(
      Object.values(OrderStatus).map(async (status) => ({
        status,
        count: await countWhere((q) => q.where("status", "==", status)),
      })),
    ),
  ]);

  return {
    totalOrders,
    openOrders,
    completedOrders,
    cancelledOrders,
    awaitingPayment,
    revenueCents: toNumberOr(revenue.data().total, 0),
    unhandledMessages: unhandledMessages.data().count,
    ordersByStatus: byStatus.filter((row) => row.count > 0),
  };
}

export const ORDERS_PER_PAGE = 20;

export async function listOrders({
  status,
  page = 1,
}: {
  status?: OrderStatus;
  page?: number;
} = {}): Promise<{
  orders: AdminOrderListItem[];
  total: number;
  pages: number;
}> {
  const db = getDb();
  const safePage = Math.max(1, Math.floor(page));

  let base: Query = db.collection(COLLECTIONS.orders);
  if (status) base = base.where("status", "==", status);

  const [countSnapshot, pageSnapshot] = await Promise.all([
    base.count().get(),
    /*
      Offset pagination. Firestore bills the skipped documents, so this is the
      wrong tool for deep paging — but it preserves the existing page-number UI
      and the admin rarely goes past the first few pages. Switch to cursor
      paging (`startAfter` on the last `createdAt`) if that stops being true.
    */
    base
      .orderBy("createdAt", "desc")
      .offset((safePage - 1) * ORDERS_PER_PAGE)
      .limit(ORDERS_PER_PAGE)
      .get(),
  ]);

  const total = countSnapshot.data().count;

  return {
    orders: pageSnapshot.docs.map((doc) => toListItem(doc.id, doc.data())),
    total,
    pages: Math.max(1, Math.ceil(total / ORDERS_PER_PAGE)),
  };
}

export type AdminOrderDetail = AdminOrderListItem & {
  deliveryAddress: string | null;
  deliveryCity: string | null;
  deliveryPostalCode: string | null;
  pickupNotes: string | null;
  notes: string | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  items: {
    id: string;
    quantity: number;
    unitPriceCents: number;
    totalPriceCents: number;
    productNameSnapshot: string;
    productSlugSnapshot: string;
  }[];
};

export async function getAdminOrder(
  orderNumber: string,
): Promise<AdminOrderDetail | null> {
  const doc = await getDb()
    .collection(COLLECTIONS.orders)
    .doc(orderNumber.trim())
    .get();

  if (!doc.exists) return null;

  const data = doc.data() ?? {};
  const rawItems = Array.isArray(data.items) ? data.items : [];

  return {
    ...toListItem(doc.id, data),
    deliveryAddress: toStringOrNull(data.deliveryAddress),
    deliveryCity: toStringOrNull(data.deliveryCity),
    deliveryPostalCode: toStringOrNull(data.deliveryPostalCode),
    pickupNotes: toStringOrNull(data.pickupNotes),
    notes: toStringOrNull(data.notes),
    subtotalCents: toNumberOr(data.subtotalCents, 0),
    deliveryFeeCents: toNumberOr(data.deliveryFeeCents, 0),
    items: rawItems.map((item: DocumentData, index: number) => ({
      id: `${doc.id}-${index}`,
      quantity: toNumberOr(item?.quantity, 0),
      unitPriceCents: toNumberOr(item?.unitPriceCents, 0),
      totalPriceCents: toNumberOr(item?.totalPriceCents, 0),
      productNameSnapshot: toStringOr(item?.productNameSnapshot, ""),
      productSlugSnapshot: toStringOr(item?.productSlugSnapshot, ""),
    })),
  };
}

/**
 * Changes an order's status, returning reserved stock when it is cancelled.
 *
 * Without the restock, cancelling would quietly consume inventory forever:
 * checkout decrements `stock` when the order is placed, so those units have to
 * be handed back when the order will never be fulfilled.
 *
 * Runs in a transaction, and the early return when the status is unchanged is
 * what makes cancelling an already-cancelled order a no-op rather than a
 * second restock.
 */
export async function updateOrderStatus({
  orderNumber,
  status,
}: {
  orderNumber: string;
  status: OrderStatus;
}): Promise<boolean> {
  const db = getDb();
  const orderRef = db.collection(COLLECTIONS.orders).doc(orderNumber.trim());

  return db.runTransaction(async (tx) => {
    const orderDoc = await tx.get(orderRef);
    if (!orderDoc.exists) return false;

    const data = orderDoc.data() ?? {};
    const current = isOrderStatus(data.status) ? data.status : OrderStatus.PENDING;
    if (current === status) return true;

    const isBecomingCancelled =
      status === OrderStatus.CANCELLED && current !== OrderStatus.CANCELLED;

    // Reads first: Firestore forbids a read after a write in a transaction.
    const restock: { productId: string; stock: number; quantity: number }[] = [];
    if (isBecomingCancelled) {
      const items = Array.isArray(data.items) ? data.items : [];
      const withProduct = items.filter(
        (item: DocumentData) => typeof item?.productId === "string",
      );

      if (withProduct.length > 0) {
        const refs = withProduct.map((item: DocumentData) =>
          db.collection(COLLECTIONS.products).doc(item.productId as string),
        );
        const productDocs = await tx.getAll(...refs);

        productDocs.forEach((productDoc, index) => {
          if (!productDoc.exists) return;
          const stock = toNullableNumber(productDoc.get("stock"));
          // `null` means made-to-order, so there is nothing to give back.
          if (stock === null) return;
          restock.push({
            productId: productDoc.id,
            stock,
            quantity: toNumberOr(withProduct[index]?.quantity, 0),
          });
        });
      }
    }

    tx.update(orderRef, { status, updatedAt: FieldValue.serverTimestamp() });

    for (const entry of restock) {
      tx.update(db.collection(COLLECTIONS.products).doc(entry.productId), {
        stock: entry.stock + entry.quantity,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return true;
  });
}

export async function updatePaymentStatus({
  orderNumber,
  paymentStatus,
}: {
  orderNumber: string;
  paymentStatus: PaymentStatus;
}): Promise<boolean> {
  const ref = getDb().collection(COLLECTIONS.orders).doc(orderNumber.trim());
  const doc = await ref.get();
  if (!doc.exists) return false;

  await ref.update({
    paymentStatus,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return true;
}

// --- Products -------------------------------------------------------------

export type AdminProductRow = {
  id: string;
  sku: string;
  name: string;
  priceCents: number;
  stock: number | null;
  isActive: boolean;
  isFeatured: boolean;
  categoryName: string | null;
  translationLocales: AppLocale[];
};

/**
 * Product overview for the admin area, listed with the Portuguese name (the
 * admin area is Portuguese-only) plus which locales each product has been
 * translated into, so a missing translation is visible at a glance.
 */
export async function listAdminProducts(): Promise<AdminProductRow[]> {
  const db = getDb();

  // Includes inactive products, unlike the storefront reads.
  const [productsSnapshot, categoriesSnapshot] = await Promise.all([
    db.collection(COLLECTIONS.products).get(),
    db.collection(COLLECTIONS.categories).get(),
  ]);

  // Category names resolved once into a map rather than per product — there is
  // no join, so the alternative is one read per row.
  const categoryNames = new Map<string, string>();
  for (const doc of categoriesSnapshot.docs) {
    const translations = readTranslations<{ name?: string }>(
      doc.get("translations"),
    );
    const name = pickTranslation(translations, "pt")?.name;
    if (name) categoryNames.set(doc.id, name);
  }

  return productsSnapshot.docs
    .map((doc) => {
      const data = doc.data();
      const translations = readTranslations<{ name?: string }>(data.translations);
      const sku = toStringOr(data.sku, doc.id);

      return {
        position: toNumberOr(data.position, 0),
        row: {
          id: doc.id,
          sku,
          name: toStringOr(translations.pt?.name, sku),
          priceCents: toNumberOr(data.priceCents, 0),
          stock: toNullableNumber(data.stock),
          isActive: toBoolean(data.isActive),
          isFeatured: toBoolean(data.isFeatured),
          categoryName:
            typeof data.categoryId === "string"
              ? (categoryNames.get(data.categoryId) ?? null)
              : null,
          translationLocales: routing.locales.filter(
            (locale) => translations[locale]?.name,
          ),
        },
      };
    })
    .sort((a, b) => a.position - b.position)
    .map((entry) => entry.row);
}

// --- Contact messages -----------------------------------------------------

export type AdminContactMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  locale: AppLocale;
  isHandled: boolean;
  createdAt: Date;
};

export async function listContactMessages(): Promise<AdminContactMessage[]> {
  // Unhandled first, then newest — the queue reads as a to-do list.
  // Needs the composite index declared in firestore.indexes.json.
  const snapshot = await getDb()
    .collection(COLLECTIONS.contactMessages)
    .orderBy("isHandled", "asc")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: toStringOr(data.name, ""),
      email: toStringOr(data.email, ""),
      message: toStringOr(data.message, ""),
      locale: toStringOr(data.locale, "pt") as AppLocale,
      isHandled: toBoolean(data.isHandled),
      createdAt: requireDate(data.createdAt),
    };
  });
}

export async function setContactMessageHandled({
  id,
  isHandled,
}: {
  id: string;
  isHandled: boolean;
}): Promise<void> {
  await getDb()
    .collection(COLLECTIONS.contactMessages)
    .doc(id)
    .update({ isHandled, updatedAt: Timestamp.now() });
}
