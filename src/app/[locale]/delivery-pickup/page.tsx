import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { BUSINESS, BUSINESS_ADDRESS_ONE_LINE } from "@/lib/business";
import { formatPrice } from "@/lib/format-price";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "DeliveryPickup" });
  const tMeta = await getTranslations({ locale, namespace: "Metadata" });

  return buildPageMetadata({
    locale: locale as AppLocale,
    href: "/delivery-pickup",
    title: `${t("title")} — ${tMeta("siteName")}`,
    description: t("deliveryBody"),
  });
}

export default async function DeliveryPickupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as AppLocale;

  const t = await getTranslations("DeliveryPickup");
  const tProduct = await getTranslations("Product");
  const tCart = await getTranslations("Cart");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Breadcrumbs
        label={t("title")}
        items={[
          { label: tProduct("breadcrumbHome"), href: "/" },
          { label: t("title") },
        ]}
      />

      <header className="mt-6 max-w-2xl">
        <h1 className="font-heading text-4xl font-semibold leading-tight text-cocoa">
          {t("title")}
        </h1>
      </header>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-line bg-paper p-7">
          <h2 className="font-heading text-2xl font-semibold text-cocoa">
            {t("deliveryTitle")}
          </h2>
          <p className="mt-4 leading-relaxed text-cocoa-soft">
            {t("deliveryBody")}
          </p>

          <dl className="mt-6 flex flex-col gap-3 border-t border-line pt-5 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-cocoa-soft">{tCart("deliveryFee")}</dt>
              <dd dir="ltr" className="font-semibold text-cocoa">
                {formatPrice(BUSINESS.deliveryFeeCents, locale)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-cocoa-soft">{t("freeDeliveryLabel")}</dt>
              <dd dir="ltr" className="font-semibold text-cocoa">
                {formatPrice(BUSINESS.freeDeliveryThresholdCents, locale)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-line bg-paper p-7">
          <h2 className="font-heading text-2xl font-semibold text-cocoa">
            {t("pickupTitle")}
          </h2>
          <p className="mt-4 leading-relaxed text-cocoa-soft">
            {t("pickupBody")}
          </p>

          <address className="mt-6 border-t border-line pt-5 text-sm not-italic leading-relaxed text-cocoa-soft">
            {t("pickupAddress")}
          </address>

          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              BUSINESS_ADDRESS_ONE_LINE,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm font-medium text-cocoa underline underline-offset-4 transition-colors hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {t("directionsCta")}
          </a>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-cream-dark p-7">
        <h2 className="font-heading text-2xl font-semibold text-cocoa">
          {t("hoursTitle")}
        </h2>
        <p className="mt-4 leading-relaxed text-cocoa-soft">{t("hoursBody")}</p>
        <p className="mt-4 text-sm text-cocoa-soft">
          <a
            href={`tel:${BUSINESS.phoneE164}`}
            dir="ltr"
            className="font-medium text-cocoa underline underline-offset-4 transition-colors hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {BUSINESS.phoneDisplay}
          </a>
        </p>
      </section>

      <div className="mt-10">
        <Link
          href="/shop"
          className="inline-block rounded-full bg-cocoa px-7 py-3.5 text-base font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          {tCart("continueShopping")}
        </Link>
      </div>
    </div>
  );
}
