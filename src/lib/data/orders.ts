import { prisma } from "@/lib/prisma";
import type { AppLocale } from "@/i18n/routing";
import {
  FulfillmentMethod,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/generated/prisma/enums";
import {
  calculateOrderTotals,
  isPaymentMethodAllowed,
} from "@/lib/order-pricing";

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
  requestedDate: Date | null;
  notes: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  createdAt: Date;
  items: {
    id: string;
    quantity: number;
    unitPriceCents: number;
    totalPriceCents: number;
    productNameSnapshot: string;
    productSlugSnapshot: string;
    productId: string | null;
  }[];
};

export type CreateOrderResult =
  | { ok: true; order: OrderSummary }
  | {
      ok: false;
      error: "empty_cart" | "unavailable_items" | "payment_not_allowed";
      unavailableProductIds?: string[];
    };

/**
 * Builds the next human-friendly order reference, e.g. PD-20260916-0007.
 *
 * The counter restarts each day, which keeps references short and makes
 * them easy to read out over the phone. Because the value is derived from
 * a count it can race under concurrent checkouts; `orderNumber` is unique
 * in the schema and `createOrder` retries, so a collision costs one
 * retry rather than a corrupted order.
 */
async function nextOrderNumber(now: Date): Promise<string> {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfNextDay = new Date(startOfDay);
  startOfNextDay.setDate(startOfNextDay.getDate() + 1);

  const todayCount = await prisma.order.count({
    where: { createdAt: { gte: startOfDay, lt: startOfNextDay } },
  });

  const datePart = [
    startOfDay.getFullYear(),
    String(startOfDay.getMonth() + 1).padStart(2, "0"),
    String(startOfDay.getDate()).padStart(2, "0"),
  ].join("");

  return `PD-${datePart}-${String(todayCount + 1).padStart(4, "0")}`;
}

function toOrderSummary(order: {
  id: string;
  orderNumber: string;
  orderLanguage: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillmentMethod: string;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  deliveryPostalCode: string | null;
  requestedDate: Date | null;
  notes: string | null;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  createdAt: Date;
  items: {
    id: string;
    quantity: number;
    unitPriceCents: number;
    totalPriceCents: number;
    productNameSnapshot: string;
    productSlugSnapshot: string;
    productId: string | null;
  }[];
}): OrderSummary {
  return {
    ...order,
    orderLanguage: order.orderLanguage as AppLocale,
    fulfillmentMethod: order.fulfillmentMethod as FulfillmentMethod,
    paymentMethod: order.paymentMethod as PaymentMethod,
    paymentStatus: order.paymentStatus as PaymentStatus,
    status: order.status as OrderStatus,
  };
}

/**
 * Creates an order from a cart.
 *
 * Prices, names and availability are read from the database — the caller
 * supplies only product ids and quantities. This is deliberate: a client
 * cannot influence what it is charged, and the stored line items are a
 * snapshot of what was genuinely on sale at that moment.
 *
 * The whole write runs in one transaction, and stock is decremented with
 * a guarded update so two simultaneous checkouts cannot oversell the last
 * item.
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

  // Collapse any duplicate ids so a repeated product becomes one line.
  const quantityByProductId = new Map<string, number>();
  for (const item of items) {
    quantityByProductId.set(
      item.productId,
      (quantityByProductId.get(item.productId) ?? 0) + item.quantity,
    );
  }

  const products = await prisma.product.findMany({
    where: { id: { in: [...quantityByProductId.keys()] }, isActive: true },
    include: { translations: { where: { locale } } },
  });

  const productsById = new Map(products.map((product) => [product.id, product]));

  // Anything missing, deactivated, untranslated or short on stock blocks
  // the order rather than being silently dropped from it.
  const unavailableProductIds: string[] = [];
  for (const [productId, quantity] of quantityByProductId) {
    const product = productsById.get(productId);
    if (!product || !product.translations[0]) {
      unavailableProductIds.push(productId);
      continue;
    }
    if (product.stock !== null && product.stock < quantity) {
      unavailableProductIds.push(productId);
    }
  }

  if (unavailableProductIds.length > 0) {
    return { ok: false, error: "unavailable_items", unavailableProductIds };
  }

  const lines = [...quantityByProductId].map(([productId, quantity]) => {
    const product = productsById.get(productId)!;
    const translation = product.translations[0]!;

    return {
      productId,
      quantity,
      priceCents: product.priceCents,
      hasFiniteStock: product.stock !== null,
      productNameSnapshot: translation.name,
      productSlugSnapshot: translation.slug,
    };
  });

  const totals = calculateOrderTotals({
    lines,
    fulfillmentMethod: fulfillment.method,
  });

  const isDelivery = fulfillment.method === FulfillmentMethod.DELIVERY;

  // Retry covers the small window in which two checkouts derive the same
  // daily sequence number before either has committed.
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const orderNumber = await nextOrderNumber(new Date());

    try {
      const created = await prisma.$transaction(async (tx) => {
        for (const line of lines) {
          if (!line.hasFiniteStock) continue;

          // Guarded decrement: the `stock >= quantity` predicate means a
          // concurrent order that already took the last unit causes this
          // update to match zero rows, and we abort instead of overselling.
          const result = await tx.product.updateMany({
            where: { id: line.productId, stock: { gte: line.quantity } },
            data: { stock: { decrement: line.quantity } },
          });

          if (result.count === 0) {
            throw new OutOfStockError(line.productId);
          }
        }

        return tx.order.create({
          data: {
            orderNumber,
            orderLanguage: locale,
            customerName: customer.name,
            customerEmail: customer.email,
            customerPhone: customer.phone,
            fulfillmentMethod: fulfillment.method,
            deliveryAddress: isDelivery ? fulfillment.deliveryAddress : null,
            deliveryCity: isDelivery ? fulfillment.deliveryCity : null,
            deliveryPostalCode: isDelivery
              ? fulfillment.deliveryPostalCode
              : null,
            pickupNotes: isDelivery ? null : fulfillment.pickupNotes,
            requestedDate: fulfillment.requestedDate ?? null,
            notes: fulfillment.notes ?? null,
            paymentMethod,
            paymentStatus: PaymentStatus.PENDING,
            status: OrderStatus.PENDING,
            subtotalCents: totals.subtotalCents,
            deliveryFeeCents: totals.deliveryFeeCents,
            totalCents: totals.totalCents,
            items: {
              create: lines.map((line) => ({
                productId: line.productId,
                quantity: line.quantity,
                unitPriceCents: line.priceCents,
                totalPriceCents: line.priceCents * line.quantity,
                productNameSnapshot: line.productNameSnapshot,
                productSlugSnapshot: line.productSlugSnapshot,
              })),
            },
          },
          include: { items: true },
        });
      });

      return { ok: true, order: toOrderSummary(created) };
    } catch (error) {
      if (error instanceof OutOfStockError) {
        return {
          ok: false,
          error: "unavailable_items",
          unavailableProductIds: [error.productId],
        };
      }
      if (isUniqueConstraintError(error) && attempt < MAX_ATTEMPTS) {
        continue;
      }
      throw error;
    }
  }

  // Every attempt lost the order-number race, which in practice means
  // sustained concurrent checkouts; surfacing it as a server error is
  // better than inventing a non-sequential reference.
  throw new Error("Could not allocate a unique order number");
}

class OutOfStockError extends Error {
  constructor(public readonly productId: string) {
    super(`Product ${productId} went out of stock during checkout`);
    this.name = "OutOfStockError";
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function getOrderByNumber(
  orderNumber: string,
): Promise<OrderSummary | null> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true },
  });

  return order ? toOrderSummary(order) : null;
}

/**
 * Order lookup for the public tracking page.
 *
 * Requires the email address used at checkout in addition to the order
 * number. Order numbers are sequential and therefore guessable, so the
 * email is what actually prevents someone enumerating references to read
 * other customers' names, addresses and phone numbers. The comparison is
 * case-insensitive because email domains are, and customers rarely
 * reproduce their own capitalisation.
 */
export async function findOrderForTracking({
  orderNumber,
  email,
}: {
  orderNumber: string;
  email: string;
}): Promise<OrderSummary | null> {
  const order = await prisma.order.findUnique({
    where: { orderNumber: orderNumber.trim().toUpperCase() },
    include: { items: true },
  });

  if (!order) return null;
  if (
    order.customerEmail.trim().toLocaleLowerCase() !==
    email.trim().toLocaleLowerCase()
  ) {
    return null;
  }

  return toOrderSummary(order);
}
