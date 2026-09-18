import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ContactForm } from "@/components/contact/contact-form";
import { LocalBusinessJsonLd } from "@/components/seo/json-ld";
import { BUSINESS, BUSINESS_ADDRESS_ONE_LINE } from "@/lib/business";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Contact" });
  const tMeta = await getTranslations({ locale, namespace: "Metadata" });

  return buildPageMetadata({
    locale: locale as AppLocale,
    href: "/contact",
    title: `${t("title")} — ${tMeta("siteName")}`,
    description: t("subtitle"),
  });
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as AppLocale;

  const t = await getTranslations("Contact");
  const tProduct = await getTranslations("Product");

  const mapQuery = encodeURIComponent(BUSINESS_ADDRESS_ONE_LINE);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <LocalBusinessJsonLd locale={locale} />

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
        <p className="mt-3 text-lg leading-relaxed text-cocoa-soft">
          {t("subtitle")}
        </p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-line bg-paper p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-cocoa">
              {t("addressTitle")}
            </h2>
            <address className="mt-3 text-base not-italic leading-relaxed text-cocoa-soft">
              {t("address")}
            </address>
          </section>

          <section className="rounded-2xl border border-line bg-paper p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-cocoa">
              {t("phoneTitle")}
            </h2>
            <p className="mt-3">
              <a
                href={`tel:${BUSINESS.phoneE164}`}
                dir="ltr"
                className="text-base font-medium text-cocoa underline underline-offset-4 transition-colors hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                {t("phone")}
              </a>
            </p>
          </section>

          <section className="rounded-2xl border border-line bg-paper p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-cocoa">
              {t("instagramTitle")}
            </h2>
            <p className="mt-3">
              <a
                href={BUSINESS.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="text-base font-medium text-cocoa underline underline-offset-4 transition-colors hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                {t("instagram")}
              </a>
            </p>
          </section>
        </div>

        <section
          aria-labelledby="contact-form-title"
          className="rounded-2xl border border-line bg-cream-dark p-6 sm:p-8"
        >
          <h2
            id="contact-form-title"
            className="font-heading text-2xl font-semibold text-cocoa"
          >
            {t("formTitle")}
          </h2>
          <div className="mt-6">
            <ContactForm />
          </div>
        </section>
      </div>

      <section aria-labelledby="contact-map-title" className="mt-12">
        <h2
          id="contact-map-title"
          className="font-heading text-2xl font-semibold text-cocoa"
        >
          {t("mapTitle")}
        </h2>
        <div className="mt-5 overflow-hidden rounded-2xl border border-line">
          {/*
            Loaded lazily and without cookies-bearing embeds beyond what
            the map itself needs; the visitor sees the shop location
            without us shipping any third-party tracking script.
          */}
          <iframe
            title={t("mapTitle")}
            src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-80 w-full border-0"
          />
        </div>
      </section>
    </div>
  );
}
