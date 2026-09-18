import {
  FieldValue,
  Timestamp,
  type DocumentData,
  type Transaction,
} from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import { COLLECTIONS, orderCounterDocId } from "@/lib/firebase/collections";
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
import type { AppLocale } from "@/i18n/routing";
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
import { calculateOrderTotals, isPaymentMethodAllowed } from "@/lib/order-pricing";

export type OrderLineInput = { productId: string; quantity: number };

export type OrderCustomerInput = {
  name: string;
  email: string;
  phone: string;
};

export type OrderFulfillmentInput = {
  method: FulfillmentMethod;
  deliveryAddress?: string | null;
  deliveryCity?: string | null;
  deliveryPostalCode?: string | null;
  pickupNotes?: string | null;
  requestedDate?: Date | null;
  notes?: string | null;
};

export type OrderItemSummary = {
  id: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  productNameSnapshot: string;
  productSlugSnapshot: string;
  productId: string | null;
};

export type OrderSummary = {
  id: string;
  orderNumber: string;
  orderLanguage: AppLocale;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillmentMethod: FulfillmentMethod;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  deliveryPostalCode: string | null;
  pickupNotes: string | null;
  requestedDate: Date | null;
  notes: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  createdAt: Date;
  items: OrderItemSummary[];
};

export type CreateOrderResult =
  | { ok: true; order: OrderSummary }
  | {
      ok: false;
      error: "empty_cart" | "unavailable_items" | "payment_not_allowed";
      unavailableProductIds?: string[];
    };

/** Thrown inside the transaction to abort it with a specific cause. */
class UnavailableItemsError extends Error {
  constructor(public readonly productIds: string[]) {
    super(`Unavailable products: ${productIds.join(", ")}`);
    this.name = "UnavailableItemsError";
  }
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function mapOrder(id: string, data: DocumentData): OrderSummary {
  const rawItems = Array.isArray(data.items) ? data.items : [];

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
    deliveryAddress: toStringOrNull(data.deliveryAddress),
    deliveryCity: toStringOrNull(data.deliveryCity),
    deliveryPostalCode: toStringOrNull(data.deliveryPostalCode),
    pickupNotes: toStringOrNull(data.pickupNotes),
    requestedDate: toDate(data.requestedDate),
    notes: toStringOrNull(data.notes),
    paymentMethod: isPaymentMethod(data.paymentMethod)
      ? data.paymentMethod
      : "MBWAY",
    paymentStatus: isPaymentStatus(data.paymentStatus)
      ? data.paymentStatus
      : PaymentStatus.PENDING,
    status: isOrderStatus(data.status) ? data.status : OrderStatus.PENDING,
    subtotalCents: toNumberOr(data.subtotalCents, 0),
    deliveryFeeCents: toNumberOr(data.deliveryFeeCents, 0),
    totalCents: toNumberOr(data.totalCents, 0),
    createdAt: requireDate(data.createdAt),
    items: rawItems.map((item: DocumentData, index: number) => ({
      // Embedded array entries have no document ID of their own, so one is
      // synthesised. It is stable for a given order because the array order
      // never changes after creation.
      id: `${id}-${index}`,
      quantity: toNumberOr(item?.quantity, 0),
      unitPriceCents: toNumberOr(item?.unitPriceCents, 0),
      totalPriceCents: toNumberOr(item?.totalPriceCents, 0),
      productNameSnapshot: toStringOr(item?.productNameSnapshot, ""),
      productSlugSnapshot: toStringOr(item?.productSlugSnapshot, ""),
      productId: toStringOrNull(item?.productId),
    })),
  };
}

export async function getOrderByNumber(
  orderNumber: string,
): Promise<OrderSummary | null> {
  const doc = await getDb()
    .collection(COLLECTIONS.orders)
    .doc(orderNumber.trim())
    .get();

  return doc.exists ? mapOrder(doc.id, doc.data() ?? {}) : null;
}

/**
 * Order lookup for the public tracking page.
 *
 * Requires the email address used at checkout in addition to the order number.
 * Order numbers are sequential and therefore guessable, so the email is what
 * actually prevents someone enumerating references to read other customers'
 * names, addresses and phone numbers.
 *
 * The comparison is case-insensitive because email domains are, and customers
 * rarely reproduce their own capitalisation. Firestore cannot compare
 * case-insensitively, which is exactly why `customerEmailLower` is stored
 * alongside the original at write time.
 */
export async function findOrderForTracking({
  orderNumber,
  email,
}: {
  orderNumber: string;
  email: string;
}): Promise<OrderSummary | null> {
  const doc = await getDb()
    .collection(COLLECTIONS.orders)
    .doc(orderNumber.trim().toUpperCase())
    .get();

  if (!doc.exists) return null;

  const data = doc.data() ?? {};
  const storedLower =
    toStringOrNull(data.customerEmailLower) ??
    toStringOr(data.customerEmail, "").toLocaleLowerCase();

  if (storedLower !== email.trim().toLocaleLowerCase()) return null;

  return mapOrder(doc.id, data);
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

function formatOrderNumber(date: Date, sequence: number): string {
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");

  return `PD-${datePart}-${String(sequence).padStart(4, "0")}`;
}

/**
 * Creates an order from a cart.
 *
 * Prices, names and availability are read from the database — the caller
 * supplies only product IDs and quantities, so a client cannot influence what
 * it is charged, and the stored line items are a snapshot of what was
 * genuinely on sale at that moment.
 *
 * Everything happens in one Firestore transaction, which is what replaces the
 * two guarantees SQL provided:
 *
 *  - **No overselling.** Stock is read inside the transaction and written back
 *    decremented. Firestore tracks every document read in a transaction and
 *    aborts the commit if any of them changed in the meantime, retrying the
 *    whole callback. Two simultaneous checkouts for the last item therefore
 *    cannot both succeed — the loser re-reads the reduced stock and fails the
 *    availability check. This is the equivalent of the old guarded
 *    `UPDATE ... WHERE stock >= n`.
 *
 *  - **Unique order numbers.** The daily sequence lives in a counter document
 *    that is also read inside the transaction, so concurrent orders contend on
 *    it and are serialised. The order is then written with the number as its
 *    document ID, and `create` fails if that ID already exists — a second,
 *    independent guarantee rather than a hope.
 *
 * Note the ordering constraint: Firestore requires all reads in a transaction
 * to precede all writes, so products and counter are read up front and every
 * mutation is issued afterwards.
 */
export async function createOrder({
  locale,
  customer,
  fulfillment,
  paymentMethod,
  items,
}: {
  locale: AppLocale;
  customer: OrderCustomerInput;
  fulfillment: OrderFulfillmentInput;
  paymentMethod: PaymentMethod;
  items: OrderLineInput[];
}): Promise<CreateOrderResult> {
  if (items.length === 0) {
    return { ok: false, error: "empty_cart" };
  }

  if (
    !isPaymentMethodAllowed({
      fulfillmentMethod: fulfillment.method,
      paymentMethod,
    })
  ) {
    return { ok: false, error: "payment_not_allowed" };
  }

  // Collapse duplicate IDs so a repeated product becomes one line.
  const quantityByProductId = new Map<string, number>();
  for (const item of items) {
    quantityByProductId.set(
      item.productId,
      (quantityByProductId.get(item.productId) ?? 0) + item.quantity,
    );
  }

  const db = getDb();
  const productIds = [...quantityByProductId.keys()];
  const isDelivery = fulfillment.method === FulfillmentMethod.DELIVERY;
  const now = new Date();

  try {
    const created = await db.runTransaction(async (tx: Transaction) => {
      // ---- reads (must all precede writes) ----------------------------
      const productRefs = productIds.map((id) =>
        db.collection(COLLECTIONS.products).doc(id),
      );
      const productDocs = await tx.getAll(...productRefs);

      const counterRef = db
        .collection(COLLECTIONS.counters)
        .doc(orderCounterDocId(now));
      const counterDoc = await tx.get(counterRef);

      // ---- validate ---------------------------------------------------
      const unavailable: string[] = [];
      const lines: {
        productId: string;
        quantity: number;
        priceCents: number;
        hasFiniteStock: boolean;
        currentStock: number | null;
        productNameSnapshot: string;
        productSlugSnapshot: string;
      }[] = [];

      for (const doc of productDocs) {
        const productId = doc.id;
        const quantity = quantityByProductId.get(productId) ?? 0;

        if (!doc.exists) {
          unavailable.push(productId);
          continue;
        }

        const data = doc.data() ?? {};
        if (!toBoolean(data.isActive)) {
          unavailable.push(productId);
          continue;
        }

        const stock = toNullableNumber(data.stock);
        if (stock !== null && stock < quantity) {
          unavailable.push(productId);
          continue;
        }

        const translations = readTranslations<{ name?: string; slug?: string }>(
          data.translations,
        );
        const translation = pickTranslation(translations, locale);
        if (!translation?.name || !translation?.slug) {
          // An untranslated product cannot be snapshotted meaningfully in the
          // customer's language, so it blocks the order rather than being
          // recorded with a placeholder.
          unavailable.push(productId);
          continue;
        }

        lines.push({
          productId,
          quantity,
          priceCents: toNumberOr(data.priceCents, 0),
          hasFiniteStock: stock !== null,
          currentStock: stock,
          productNameSnapshot: translation.name,
          productSlugSnapshot: translation.slug,
        });
      }

      if (unavailable.length > 0) {
        throw new UnavailableItemsError(unavailable);
      }

      const totals = calculateOrderTotals({
        lines,
        fulfillmentMethod: fulfillment.method,
      });

      const sequence = toNumberOr(counterDoc.get("seq"), 0) + 1;
      const orderNumber = formatOrderNumber(now, sequence);
      const orderRef = db.collection(COLLECTIONS.orders).doc(orderNumber);

      // ---- writes -----------------------------------------------------
      for (const line of lines) {
        if (!line.hasFiniteStock || line.currentStock === null) continue;
        tx.update(db.collection(COLLECTIONS.products).doc(line.productId), {
          stock: line.currentStock - line.quantity,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      tx.set(counterRef, { seq: sequence }, { merge: true });

      const orderData = {
        orderNumber,
        orderLanguage: locale,
        customerName: customer.name,
        customerEmail: customer.email,
        // Lowercased copy so the tracking page can match case-insensitively.
        customerEmailLower: customer.email.trim().toLocaleLowerCase(),
        customerPhone: customer.phone,
        fulfillmentMethod: fulfillment.method,
        deliveryAddress: isDelivery ? (fulfillment.deliveryAddress ?? null) : null,
        deliveryCity: isDelivery ? (fulfillment.deliveryCity ?? null) : null,
        deliveryPostalCode: isDelivery
          ? (fulfillment.deliveryPostalCode ?? null)
          : null,
        pickupNotes: isDelivery ? null : (fulfillment.pickupNotes ?? null),
        requestedDate: fulfillment.requestedDate
          ? Timestamp.fromDate(fulfillment.requestedDate)
          : null,
        notes: fulfillment.notes ?? null,
        paymentMethod,
        paymentStatus: PaymentStatus.PENDING,
        status: OrderStatus.PENDING,
        subtotalCents: totals.subtotalCents,
        deliveryFeeCents: totals.deliveryFeeCents,
        totalCents: totals.totalCents,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
        items: lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPriceCents: line.priceCents,
          totalPriceCents: line.priceCents * line.quantity,
          productNameSnapshot: line.productNameSnapshot,
          productSlugSnapshot: line.productSlugSnapshot,
        })),
      };

      // `create` rather than `set`: if this order number somehow already
      // exists, fail loudly instead of overwriting a real order.
      tx.create(orderRef, orderData);

      return { orderNumber, orderData };
    });

    return {
      ok: true,
      order: mapOrder(created.orderNumber, created.orderData),
    };
  } catch (error) {
    if (error instanceof UnavailableItemsError) {
      return {
        ok: false,
        error: "unavailable_items",
        unavailableProductIds: error.productIds,
      };
    }
    throw error;
  }
}
