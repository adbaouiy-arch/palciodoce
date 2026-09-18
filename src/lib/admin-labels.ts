import {
  FulfillmentMethod,
  Locale,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/generated/prisma/enums";

/**
 * Portuguese labels for the admin area.
 *
 * The admin dashboard is deliberately Portuguese-only — it is used by the
 * shop's own team, and it sits outside the locale routing entirely (see
 * the matcher in src/proxy.ts), so next-intl has no locale to work from
 * here. These records are typed against the enums, so adding a status to
 * the schema fails to compile until it has a label.
 */

export const ORDER_STATUS_PT: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: "Pendente",
  [OrderStatus.CONFIRMED]: "Confirmado",
  [OrderStatus.PREPARING]: "Em Preparação",
  [OrderStatus.READY]: "Pronto",
  [OrderStatus.OUT_FOR_DELIVERY]: "A Caminho",
  [OrderStatus.COMPLETED]: "Concluído",
  [OrderStatus.CANCELLED]: "Cancelado",
};

export const PAYMENT_STATUS_PT: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: "Pendente",
  [PaymentStatus.PAID]: "Pago",
  [PaymentStatus.FAILED]: "Falhado",
  [PaymentStatus.REFUNDED]: "Reembolsado",
};

export const PAYMENT_METHOD_PT: Record<PaymentMethod, string> = {
  [PaymentMethod.MBWAY]: "MB WAY",
  [PaymentMethod.BANK_TRANSFER]: "Transferência Bancária",
  [PaymentMethod.CASH_ON_PICKUP]: "Dinheiro na Recolha",
  [PaymentMethod.CASH_ON_DELIVERY]: "Dinheiro na Entrega",
};

export const FULFILLMENT_PT: Record<FulfillmentMethod, string> = {
  [FulfillmentMethod.DELIVERY]: "Entrega",
  [FulfillmentMethod.PICKUP]: "Recolha",
};

export const LOCALE_PT: Record<Locale, string> = {
  [Locale.pt]: "Português",
  [Locale.en]: "Inglês",
  [Locale.ar]: "Árabe",
};

/**
 * Tailwind classes per status so the list scans quickly. Colour is only
 * ever a secondary cue — every badge also carries its text label, so the
 * status is never conveyed by colour alone.
 */
export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: "bg-cream-dark text-cocoa border-line",
  [OrderStatus.CONFIRMED]: "bg-gold/15 text-cocoa border-gold/40",
  [OrderStatus.PREPARING]: "bg-gold/15 text-cocoa border-gold/40",
  [OrderStatus.READY]: "bg-gold/25 text-cocoa border-gold/60",
  [OrderStatus.OUT_FOR_DELIVERY]: "bg-gold/25 text-cocoa border-gold/60",
  [OrderStatus.COMPLETED]: "bg-emerald-50 text-emerald-900 border-emerald-200",
  [OrderStatus.CANCELLED]: "bg-berry/10 text-berry border-berry/30",
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: "bg-cream-dark text-cocoa-soft border-line",
  [PaymentStatus.PAID]: "bg-emerald-50 text-emerald-900 border-emerald-200",
  [PaymentStatus.FAILED]: "bg-berry/10 text-berry border-berry/30",
  [PaymentStatus.REFUNDED]: "bg-cream-dark text-cocoa-soft border-line",
};
