import {
  FulfillmentMethod,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/lib/domain";

/**
 * Maps order enums onto message keys.
 *
 * Keeping the mapping in one place means the customer-facing tracking
 * page and the admin dashboard always describe the same status with the
 * same words, and adding a status to the schema surfaces as a TypeScript
 * error here rather than as a raw enum name leaking into the UI.
 */

/** Keys within the `TrackOrder` namespace. */
export const ORDER_STATUS_MESSAGE_KEY: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: "statusPending",
  [OrderStatus.CONFIRMED]: "statusConfirmed",
  [OrderStatus.PREPARING]: "statusPreparing",
  [OrderStatus.READY]: "statusReady",
  [OrderStatus.OUT_FOR_DELIVERY]: "statusOutForDelivery",
  [OrderStatus.COMPLETED]: "statusCompleted",
  [OrderStatus.CANCELLED]: "statusCancelled",
};

/** Keys within the `Checkout` namespace. */
export const PAYMENT_METHOD_MESSAGE_KEY: Record<PaymentMethod, string> = {
  [PaymentMethod.MBWAY]: "paymentMbway",
  [PaymentMethod.BANK_TRANSFER]: "paymentBankTransfer",
  [PaymentMethod.CASH_ON_PICKUP]: "paymentCashOnPickup",
  [PaymentMethod.CASH_ON_DELIVERY]: "paymentCashOnDelivery",
};

/** Keys within the `Checkout` namespace. */
export const FULFILLMENT_MESSAGE_KEY: Record<FulfillmentMethod, string> = {
  [FulfillmentMethod.DELIVERY]: "fulfillmentDelivery",
  [FulfillmentMethod.PICKUP]: "fulfillmentPickup",
};

/**
 * The order of the fulfilment pipeline, used to render progress. Cancelled
 * is deliberately absent: it is an exit from the pipeline, not a step
 * along it, and showing it as "progress" would be misleading.
 */
export const ORDER_STATUS_SEQUENCE: readonly OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.COMPLETED,
];

/**
 * Statuses a pickup order never reaches — there is no delivery leg — so
 * the tracker doesn't show a step the customer will never see completed.
 */
export function statusSequenceFor(
  fulfillmentMethod: FulfillmentMethod,
): readonly OrderStatus[] {
  if (fulfillmentMethod === FulfillmentMethod.PICKUP) {
    return ORDER_STATUS_SEQUENCE.filter(
      (status) => status !== OrderStatus.OUT_FOR_DELIVERY,
    );
  }
  return ORDER_STATUS_SEQUENCE;
}

export const PAYMENT_STATUS_MESSAGE_KEY: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: "paymentStatusPending",
  [PaymentStatus.PAID]: "paymentStatusPaid",
  [PaymentStatus.FAILED]: "paymentStatusFailed",
  [PaymentStatus.REFUNDED]: "paymentStatusRefunded",
};
