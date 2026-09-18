import { BUSINESS } from "@/lib/business";
import { FulfillmentMethod, PaymentMethod } from "@/lib/domain";

/**
 * The single source of truth for order money maths.
 *
 * Both the checkout UI and the order API import these functions, so the
 * total a customer is shown is computed by exactly the same code that
 * computes the total actually stored on the order. The API still derives
 * every figure from database prices rather than the request body — this
 * module never sees a client-supplied price.
 *
 * All amounts are integer cents; there is no floating point anywhere in
 * the pricing path.
 */

export type PriceableLine = { priceCents: number; quantity: number };

export function calculateSubtotalCents(lines: PriceableLine[]): number {
  return lines.reduce(
    (sum, line) => sum + line.priceCents * line.quantity,
    0,
  );
}

/**
 * Delivery is free for pickup (nothing to deliver) and free for delivery
 * orders at or above the threshold; otherwise the flat Braga-area fee
 * applies. An empty order is never charged a delivery fee.
 */
export function calculateDeliveryFeeCents({
  subtotalCents,
  fulfillmentMethod,
}: {
  subtotalCents: number;
  fulfillmentMethod: FulfillmentMethod;
}): number {
  if (fulfillmentMethod === FulfillmentMethod.PICKUP) return 0;
  if (subtotalCents <= 0) return 0;
  if (subtotalCents >= BUSINESS.freeDeliveryThresholdCents) return 0;
  return BUSINESS.deliveryFeeCents;
}

export type OrderTotals = {
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
};

export function calculateOrderTotals({
  lines,
  fulfillmentMethod,
}: {
  lines: PriceableLine[];
  fulfillmentMethod: FulfillmentMethod;
}): OrderTotals {
  const subtotalCents = calculateSubtotalCents(lines);
  const deliveryFeeCents = calculateDeliveryFeeCents({
    subtotalCents,
    fulfillmentMethod,
  });

  return {
    subtotalCents,
    deliveryFeeCents,
    totalCents: subtotalCents + deliveryFeeCents,
  };
}

/**
 * Which payment methods make sense for each fulfilment choice. "Cash on
 * pickup" is meaningless for a delivery order and vice versa, so the
 * pairing is enforced rather than left to the UI to get right.
 */
export const PAYMENT_METHODS_BY_FULFILLMENT: Record<
  FulfillmentMethod,
  readonly PaymentMethod[]
> = {
  [FulfillmentMethod.DELIVERY]: [
    PaymentMethod.MBWAY,
    PaymentMethod.BANK_TRANSFER,
    PaymentMethod.CASH_ON_DELIVERY,
  ],
  [FulfillmentMethod.PICKUP]: [
    PaymentMethod.MBWAY,
    PaymentMethod.BANK_TRANSFER,
    PaymentMethod.CASH_ON_PICKUP,
  ],
};

export function isPaymentMethodAllowed({
  fulfillmentMethod,
  paymentMethod,
}: {
  fulfillmentMethod: FulfillmentMethod;
  paymentMethod: PaymentMethod;
}): boolean {
  return PAYMENT_METHODS_BY_FULFILLMENT[fulfillmentMethod].includes(
    paymentMethod,
  );
}
