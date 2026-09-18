"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import clsx from "clsx";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { useCart } from "@/lib/cart-store";
import { useHydratedCart } from "@/lib/use-hydrated-cart";
import { formatPrice } from "@/lib/format-price";
import { BUSINESS } from "@/lib/business";

/**
 * The cart page body.
 *
 * Every product detail shown here (name, price, image, availability) is
 * resolved server-side for the *active* locale via useHydratedCart —
 * the cart itself only ever stores productId + quantity. That's what
 * lets a customer switch language on this page and immediately see the
 * translated names instead of whatever language they added the items in.
 */
export function CartView() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Cart");
  const tCommon = useTranslations("Common");
  const tProduct = useTranslations("Product");
  const { updateQuantity, removeItem } = useCart();
  const { lines, isReady, hasError, retry } = useHydratedCart();

  if (!isReady) {
    return (
      <p role="status" aria-live="polite" className="text-cocoa-soft">
        {tCommon("loading")}
      </p>
    );
  }

  /*
    The cart holds items but we couldn't load their details. Saying "your
    cart is empty" here would be a lie that makes a customer think they
    lost their basket, so offer a retry instead.
  */
  if (hasError) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-berry/30 bg-berry/5 px-6 py-12 text-center"
      >
        <p className="font-heading text-xl font-semibold text-cocoa">
          {tCommon("error")}
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-6 rounded-full bg-cocoa px-7 py-3.5 text-base font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          {tCommon("tryAgain")}
        </button>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-paper px-6 py-14 text-center">
        <p className="font-heading text-xl font-semibold text-cocoa">
          {t("empty")}
        </p>
        <p className="mx-auto mt-2 max-w-md text-cocoa-soft">{t("emptyHint")}</p>
        <Link
          href="/shop"
          className="mt-6 inline-block rounded-full bg-cocoa px-7 py-3.5 text-base font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          {t("continueShopping")}
        </Link>
      </div>
    );
  }

  // Unavailable lines (deactivated or out of stock since being added)
  // are shown but excluded from the payable total, so the figure the
  // customer sees always matches what checkout will actually charge.
  const payableLines = lines.filter((line) => line.isAvailable);
  const hasUnavailable = payableLines.length !== lines.length;

  const payableSubtotalCents = payableLines.reduce(
    (sum, line) => sum + line.priceCents * line.quantity,
    0,
  );
  const itemCount = payableLines.reduce((sum, line) => sum + line.quantity, 0);

  const qualifiesForFreeDelivery =
    payableSubtotalCents >= BUSINESS.freeDeliveryThresholdCents;
  const remainingForFreeDelivery =
    BUSINESS.freeDeliveryThresholdCents - payableSubtotalCents;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem] lg:items-start">
      <section aria-label={t("title")}>
        <p className="text-sm text-cocoa-soft">{t("itemCount", { count: itemCount })}</p>

        <ul className="mt-4 flex flex-col divide-y divide-line border-y border-line">
          {lines.map((line) => {
            const lineTotalCents = line.priceCents * line.quantity;

            return (
              <li
                key={line.productId}
                className={clsx(
                  "flex flex-wrap items-start gap-4 py-5 sm:flex-nowrap",
                  !line.isAvailable && "opacity-60",
                )}
              >
                <Link
                  href={{ pathname: "/product/[slug]", params: { slug: line.slug } }}
                  className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-cream-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  aria-hidden={!line.image}
                  tabIndex={line.image ? undefined : -1}
                >
                  {line.image && (
                    <Image
                      src={line.image.url}
                      alt={line.image.alt}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <h2 className="font-heading text-lg font-semibold leading-snug text-cocoa">
                    <Link
                      href={{
                        pathname: "/product/[slug]",
                        params: { slug: line.slug },
                      }}
                      className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                    >
                      {line.name}
                    </Link>
                  </h2>

                  <p className="mt-1 text-sm text-cocoa-soft">
                    <span dir="ltr">{formatPrice(line.priceCents, locale)}</span>{" "}
                    {tProduct("perUnit")}
                  </p>

                  {!line.isAvailable && (
                    <p className="mt-1 text-sm font-medium text-berry">
                      {t("itemUnavailable")}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <div className="flex items-center rounded-full border border-line bg-paper">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(line.productId, line.quantity - 1)
                        }
                        aria-label={t("updateQuantity")}
                        className="px-3.5 py-1.5 text-lg text-cocoa transition-colors hover:bg-cream-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                      >
                        −
                      </button>
                      <span
                        dir="ltr"
                        className="w-10 text-center text-base font-semibold text-cocoa"
                      >
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            line.productId,
                            Math.min(50, line.quantity + 1),
                          )
                        }
                        aria-label={t("updateQuantity")}
                        className="px-3.5 py-1.5 text-lg text-cocoa transition-colors hover:bg-cream-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(line.productId)}
                      className="text-sm font-medium text-cocoa-soft underline underline-offset-4 transition-colors hover:text-berry focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                    >
                      {t("remove")}
                    </button>
                  </div>
                </div>

                <p
                  dir="ltr"
                  className="w-full text-lg font-semibold text-cocoa sm:w-auto sm:text-end"
                >
                  {formatPrice(lineTotalCents, locale)}
                </p>
              </li>
            );
          })}
        </ul>

        <Link
          href="/shop"
          className="mt-6 inline-block text-sm font-medium text-cocoa underline underline-offset-4 hover:text-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          {t("continueShopping")}
        </Link>
      </section>

      <aside
        aria-labelledby="cart-summary-title"
        className="rounded-2xl border border-line bg-paper p-6 lg:sticky lg:top-24"
      >
        <h2
          id="cart-summary-title"
          className="font-heading text-xl font-semibold text-cocoa"
        >
          {t("summaryTitle")}
        </h2>

        {hasUnavailable && (
          <p className="mt-4 rounded-lg border border-berry/30 bg-berry/5 px-4 py-3 text-sm text-berry">
            {t("unavailableNotice")}
          </p>
        )}

        <dl className="mt-5 flex flex-col gap-3 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-cocoa-soft">{t("subtotal")}</dt>
            <dd dir="ltr" className="font-semibold text-cocoa">
              {formatPrice(payableSubtotalCents, locale)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-cocoa-soft">{t("deliveryFee")}</dt>
            <dd className="text-end text-cocoa-soft">
              {t("deliveryFeeCalculated")}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
            <dt className="font-semibold text-cocoa">{t("total")}</dt>
            <dd dir="ltr" className="text-xl font-semibold text-cocoa">
              {formatPrice(payableSubtotalCents, locale)}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-sm text-cocoa-soft">
          {qualifiesForFreeDelivery
            ? t("freeDeliveryQualified")
            : t("freeDeliveryRemaining", {
                amount: formatPrice(remainingForFreeDelivery, locale),
              })}
        </p>

        {payableLines.length > 0 ? (
          <Link
            href="/checkout"
            className="mt-6 block rounded-full bg-cocoa px-6 py-3.5 text-center text-base font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {t("checkoutCta")}
          </Link>
        ) : (
          <p className="mt-6 rounded-full bg-cream-dark px-6 py-3.5 text-center text-base font-semibold text-cocoa-soft">
            {t("checkoutCta")}
          </p>
        )}
      </aside>
    </div>
  );
}
