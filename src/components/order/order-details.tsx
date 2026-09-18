import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import type { OrderSummary } from "@/lib/data/orders";
import { FulfillmentMethod } from "@/generated/prisma/enums";
import { formatPrice } from "@/lib/format-price";
import { formatDate } from "@/lib/format-date";
import {
  FULFILLMENT_MESSAGE_KEY,
  ORDER_STATUS_MESSAGE_KEY,
  PAYMENT_METHOD_MESSAGE_KEY,
} from "@/lib/order-status";

/**
 * Read-only rendering of an order: line items and money, plus the
 * fulfilment and payment choices.
 *
 * Shared by the confirmation page and the tracking page so a customer
 * sees identical figures whichever route they arrive by. Line items come
 * from the stored snapshots rather than from the live catalogue, so an
 * old order still shows what was actually bought, at the price actually
 * charged, in the language it was ordered in.
 */
export async function OrderDetails({
  order,
  locale,
}: {
  order: OrderSummary;
  locale: AppLocale;
}) {
  const t = await getTranslations("OrderConfirmation");
  const tCart = await getTranslations("Cart");
  const tCommon = await getTranslations("Common");
  const tCheckout = await getTranslations("Checkout");
  const tTrack = await getTranslations("TrackOrder");

  const isDelivery = order.fulfillmentMethod === FulfillmentMethod.DELIVERY;

  return (
    <div className="rounded-2xl border border-line bg-paper p-6 sm:p-8">
      <h2 className="font-heading text-2xl font-semibold text-cocoa">
        {t("summaryTitle")}
      </h2>

      <dl className="mt-5 grid gap-4 border-b border-line pb-6 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-cocoa-soft">{t("orderNumberLabel")}</dt>
          <dd dir="ltr" className="mt-1 font-semibold text-cocoa">
            {order.orderNumber}
          </dd>
        </div>
        <div>
          <dt className="text-cocoa-soft">{tTrack("statusLabel")}</dt>
          <dd className="mt-1 font-semibold text-cocoa">
            {tTrack(ORDER_STATUS_MESSAGE_KEY[order.status])}
          </dd>
        </div>
        <div>
          <dt className="text-cocoa-soft">{tTrack("orderDateLabel")}</dt>
          <dd className="mt-1 text-cocoa">
            <time dateTime={order.createdAt.toISOString()}>
              {formatDate(order.createdAt, locale)}
            </time>
          </dd>
        </div>
        {order.requestedDate && (
          <div>
            <dt className="text-cocoa-soft">{tTrack("requestedDateLabel")}</dt>
            <dd className="mt-1 text-cocoa">
              <time dateTime={order.requestedDate.toISOString()}>
                {formatDate(order.requestedDate, locale)}
              </time>
            </dd>
          </div>
        )}
        <div>
          <dt className="text-cocoa-soft">
            {tCheckout("fulfillmentMethodLabel")}
          </dt>
          <dd className="mt-1 text-cocoa">
            {tCheckout(FULFILLMENT_MESSAGE_KEY[order.fulfillmentMethod])}
          </dd>
        </div>
        <div>
          <dt className="text-cocoa-soft">{tCheckout("paymentMethodLabel")}</dt>
          <dd className="mt-1 text-cocoa">
            {tCheckout(PAYMENT_METHOD_MESSAGE_KEY[order.paymentMethod])}
          </dd>
        </div>
      </dl>

      <ul className="mt-6 flex flex-col divide-y divide-line">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-4 py-3">
            <span className="min-w-0">
              <span className="font-medium text-cocoa">
                {item.productNameSnapshot}
              </span>
              <span className="mt-0.5 block text-sm text-cocoa-soft" dir="ltr">
                {item.quantity} × {formatPrice(item.unitPriceCents, locale)}
              </span>
            </span>
            <span dir="ltr" className="shrink-0 font-semibold text-cocoa">
              {formatPrice(item.totalPriceCents, locale)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="mt-5 flex flex-col gap-3 border-t border-line pt-5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-cocoa-soft">{tCart("subtotal")}</dt>
          <dd dir="ltr" className="font-semibold text-cocoa">
            {formatPrice(order.subtotalCents, locale)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-cocoa-soft">{tCart("deliveryFee")}</dt>
          <dd dir="ltr" className="font-semibold text-cocoa">
            {order.deliveryFeeCents === 0
              ? tCommon("free")
              : formatPrice(order.deliveryFeeCents, locale)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-line pt-3">
          <dt className="font-semibold text-cocoa">{tCart("total")}</dt>
          <dd dir="ltr" className="text-xl font-semibold text-cocoa">
            {formatPrice(order.totalCents, locale)}
          </dd>
        </div>
      </dl>

      <p className="mt-6 rounded-lg bg-cream-dark px-4 py-3 text-sm leading-relaxed text-cocoa-soft">
        {isDelivery
          ? t("fulfillmentDeliveryNotice", {
              address: [
                order.deliveryAddress,
                order.deliveryPostalCode,
                order.deliveryCity,
              ]
                .filter(Boolean)
                .join(", "),
            })
          : t("fulfillmentPickupNotice")}
      </p>

      {order.notes && (
        <div className="mt-4 rounded-lg border border-line px-4 py-3">
          <p className="text-sm font-medium text-cocoa">
            {tCheckout("notesLabel")}
          </p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-cocoa-soft">
            {order.notes}
          </p>
        </div>
      )}
    </div>
  );
}
