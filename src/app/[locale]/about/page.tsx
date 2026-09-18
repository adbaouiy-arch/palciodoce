import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { BUSINESS } from "@/lib/business";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });
  const tMeta = await getTranslations({ locale, namespace: "Metadata" });

  return buildPageMetadata({
    locale: locale as AppLocale,
    href: "/about",
    title: `${t("title")} — ${tMeta("siteName")}`,
    description: t("heroBody"),
  });
}

export default async function AboutPage() {
  const t = await getTranslations("About");
  const tProduct = await getTranslations("Product");

  const values = [
    { title: t("valueQualityTitle"), body: t("valueQualityBody") },
    { title: t("valueCraftTitle"), body: t("valueCraftBody") },
    { title: t("valueCommunityTitle"), body: t("valueCommunityBody") },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Breadcrumbs
        label={t("title")}
        items={[
          { label: tProduct("breadcrumbHome"), href: "/" },
          { label: t("title") },
        ]}
      />

      <header className="mt-6 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-gold-deep">
          {t("title")}
        </p>
        <h1 className="mt-3 font-heading text-4xl font-semibold leading-tight text-cocoa sm:text-5xl">
          {t("heroTitle")}
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-cocoa-soft">
          {t("heroBody")}
        </p>
      </header>

      <section className="mt-14 max-w-3xl">
        <h2 className="font-heading text-2xl font-semibold text-cocoa">
          {t("storyTitle")}
        </h2>
        <p className="mt-4 leading-relaxed text-cocoa-soft">{t("storyBody")}</p>
      </section>

      <section className="mt-14">
        <h2 className="font-heading text-2xl font-semibold text-cocoa">
          {t("valuesTitle")}
        </h2>
        <ul className="mt-6 grid gap-5 md:grid-cols-3">
          {values.map((value) => (
            <li
              key={value.title}
              className="rounded-xl border border-line bg-paper p-6"
            >
              <h3 className="font-heading text-lg font-semibold text-cocoa">
                {value.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-cocoa-soft">
                {value.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14 rounded-2xl border border-line bg-cream-dark px-6 py-10 text-center sm:px-10">
        <h2 className="font-heading text-2xl font-semibold text-cocoa">
          {t("ctaTitle")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl leading-relaxed text-cocoa-soft">
          {t("ctaBody")}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/shop"
            className="rounded-full bg-cocoa px-7 py-3.5 text-base font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {t("ctaButton")}
          </Link>
          <a
            href={`tel:${BUSINESS.phoneE164}`}
            dir="ltr"
            className="rounded-full border border-cocoa px-7 py-3.5 text-base font-semibold text-cocoa transition-colors hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {BUSINESS.phoneDisplay}
          </a>
        </div>
      </section>
    </div>
  );
}
