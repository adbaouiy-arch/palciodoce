import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { OrderDetails } from "@/components/order/order-details";
import { getOrderByNumber } from "@/lib/data/orders";
import { ORDER_ACCESS_COOKIE, hasOrderAccess } from "@/lib/order-access";
import { BUSINESS } from "@/lib/business";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; orderNumber: string }>;
}): Promise<Metadata> {
  const { locale, orderNumber } = await params;
  const t = await getTranslations({ locale, namespace: "OrderConfirmation" });

  return {
    ...buildPageMetadata({
      locale: locale as AppLocale,
      href: {
        pathname: "/order-confirmation/[orderNumber]",
        params: { orderNumber },
      },
      title: t("title"),
      description: t("summaryTitle"),
    }),
    // Never index a page that can contain a customer's name and address.
    robots: { index: false, follow: false },
  };
}

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ locale: string; orderNumber: string }>;
}) {
  const { locale: rawLocale, orderNumber } = await params;
  const locale = rawLocale as AppLocale;

  const order = await getOrderByNumber(orderNumber);
  if (!order) {
    notFound();
  }

  const t = await getTranslations("OrderConfirmation");
  const tTrack = await getTranslations("TrackOrder");

  /*
    Order references are sequential (PD-20260916-0001), so knowing one is
    not proof of ownership. Full details — name, phone, delivery address —
    are shown only to the browser that placed the order, identified by the
    signed, short-lived cookie issued by /api/orders. Anyone else is sent
    to the tracking page, which requires the order's email address.
  */
  const cookieStore = await cookies();
  const isAuthorised = await hasOrderAccess({
    token: cookieStore.get(ORDER_ACCESS_COOKIE)?.value,
    orderNumber: order.orderNumber,
  });

  if (!isAuthorised) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-line bg-paper px-6 py-12 text-center">
          <h1 className="font-heading text-2xl font-semibold text-cocoa">
            {tTrack("title")}
          </h1>
          <p className="mt-3 leading-relaxed text-cocoa-soft">
            {tTrack("notFoundHint")}
          </p>
          <Link
            href="/track-order"
            className="mt-7 inline-block rounded-full bg-cocoa px-7 py-3.5 text-base font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {tTrack("submit")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="rounded-2xl border border-gold/40 bg-gold/10 px-6 py-10 text-center">
        {/* Decorative tick; the heading already conveys the outcome. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="mx-auto h-12 w-12 text-gold"
        >
          <circle cx="12" cy="12" r="10" strokeOpacity="0.35" />
          <path d="m8 12.5 2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <h1 className="mt-4 font-heading text-3xl font-semibold text-cocoa sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 text-lg text-cocoa-soft">
          {t("thankYou", { name: order.customerName })}
        </p>
        <p className="mt-2 text-sm text-cocoa-soft">
          {t("confirmationEmailNotice", { email: order.customerEmail })}
        </p>
      </header>

      <div className="mt-8">
        <OrderDetails order={order} locale={locale} />
      </div>

      <p className="mt-6 rounded-lg border border-line bg-cream-dark px-5 py-4 text-sm leading-relaxed text-cocoa-soft">
        {t("paymentPendingNotice")}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/track-order"
          className="rounded-full bg-cocoa px-7 py-3.5 text-base font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          {t("trackOrderCta")}
        </Link>
        <Link
          href="/shop"
          className="rounded-full border border-cocoa px-7 py-3.5 text-base font-semibold text-cocoa transition-colors hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          {t("continueShoppingCta")}
        </Link>
      </div>

      <p className="mt-8 text-sm leading-relaxed text-cocoa-soft">
        {t.rich("questionsNotice", {
          phone: BUSINESS.phoneDisplay,
          contact: (chunks) => (
            <Link
              href="/contact"
              className="font-medium text-cocoa underline underline-offset-4 hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
