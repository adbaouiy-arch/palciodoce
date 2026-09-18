import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { OrderDetails } from "@/components/order/order-details";
import { OrderStatusTimeline } from "@/components/order/order-status-timeline";
import { TrackOrderForm } from "@/components/order/track-order-form";
import { getOrderByNumber } from "@/lib/data/orders";
import { ORDER_ACCESS_COOKIE, readOrderAccess } from "@/lib/order-access";
import { buildPageMetadata } from "@/lib/seo";
import { clearTrackedOrderAction } from "./actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "TrackOrder" });
  const tMeta = await getTranslations({ locale, namespace: "Metadata" });

  return {
    ...buildPageMetadata({
      locale: locale as AppLocale,
      href: "/track-order",
      title: `${t("title")} — ${tMeta("siteName")}`,
      description: t("notFoundHint"),
    }),
    // The form itself is indexable, but a rendered order never should be.
    robots: { index: false, follow: true },
  };
}

export default async function TrackOrderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as AppLocale;

  const t = await getTranslations("TrackOrder");
  const tProduct = await getTranslations("Product");

  /*
    A visitor reaches the order view only by holding a valid signed access
    token — issued either by checkout or by proving, on the form below,
    that they know the email the order was placed with.
  */
  const cookieStore = await cookies();
  const trackedOrderNumber = await readOrderAccess(
    cookieStore.get(ORDER_ACCESS_COOKIE)?.value,
  );
  const order = trackedOrderNumber
    ? await getOrderByNumber(trackedOrderNumber)
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Breadcrumbs
        label={t("title")}
        items={[
          { label: tProduct("breadcrumbHome"), href: "/" },
          { label: t("title") },
        ]}
      />

      <header className="mt-6">
        <h1 className="font-heading text-4xl font-semibold leading-tight text-cocoa">
          {t("title")}
        </h1>
      </header>

      {order ? (
        <div className="mt-10 flex flex-col gap-8">
          <section className="rounded-2xl border border-line bg-cream-dark p-6 sm:p-8">
            <OrderStatusTimeline
              status={order.status}
              fulfillmentMethod={order.fulfillmentMethod}
            />
          </section>

          <OrderDetails order={order} locale={locale} />

          <form action={clearTrackedOrderAction}>
            <button
              type="submit"
              className="text-sm font-medium text-cocoa underline underline-offset-4 transition-colors hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {t("trackAnother")}
            </button>
          </form>
        </div>
      ) : (
        <div className="mt-10 rounded-2xl border border-line bg-paper p-6 sm:p-8">
          <p className="text-cocoa-soft">{t("notFoundHint")}</p>
          <div className="mt-6">
            <TrackOrderForm />
          </div>
        </div>
      )}
    </div>
  );
}
