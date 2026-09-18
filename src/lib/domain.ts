/**
 * Domain enumerations.
 *
 * Until the move to Firestore these were generated from a SQL schema. Firestore
 * has no schema to generate from, so they are declared here by hand and this
 * module is the single source of truth for every status and method value in the
 * system.
 *
 * The shape (`const` object plus a matching type of the same name) reproduces
 * what the generator used to emit, and the string values are unchanged, so
 * records written before the migration remain readable. It also means
 * `Record<OrderStatus, string>` lookup tables still fail to compile when a
 * member is added without a label — which is how the admin labels and message
 * keys stay complete.
 */

export const Locale = {
  pt: "pt",
  en: "en",
  ar: "ar",
} as const;
export type Locale = (typeof Locale)[keyof typeof Locale];

export const OrderStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  PREPARING: "PREPARING",
  READY: "READY",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const FulfillmentMethod = {
  DELIVERY: "DELIVERY",
  PICKUP: "PICKUP",
} as const;
export type FulfillmentMethod =
  (typeof FulfillmentMethod)[keyof typeof FulfillmentMethod];

export const PaymentMethod = {
  MBWAY: "MBWAY",
  BANK_TRANSFER: "BANK_TRANSFER",
  CASH_ON_PICKUP: "CASH_ON_PICKUP",
  CASH_ON_DELIVERY: "CASH_ON_DELIVERY",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

/**
 * Narrowing helpers for values arriving from outside the application —
 * a query string, a form field, or a Firestore document written by an older
 * version of the code. Firestore enforces no schema, so a document *can*
 * legitimately contain a value this build has never heard of.
 */
export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && value in OrderStatus;
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && value in PaymentStatus;
}

export function isFulfillmentMethod(value: unknown): value is FulfillmentMethod {
  return typeof value === "string" && value in FulfillmentMethod;
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && value in PaymentMethod;
}
