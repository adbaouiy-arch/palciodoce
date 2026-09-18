import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getCategories } from "@/lib/data/categories";
import { getFeaturedProducts, getProducts } from "@/lib/data/products";
import { ProductCard } from "@/components/product/product-card";
import { buildPageMetadata } from "@/lib/seo";
import {
  BUSINESS,
  BUSINESS_ADDRESS_ONE_LINE,
  SOCIAL_PROFILES,
} from "@/lib/business";
import { LocalBusinessJsonLd } from "@/components/seo/json-ld";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return buildPageMetadata({
    locale: locale as AppLocale,
    href: "/",
    title: t("defaultTitle"),
    description: t("defaultDescription"),
    images: ["/images/products/strawberry-cheesecake.webp"],
  });
}

/**
 * Sets the `--pd-delay` custom property used to stagger the hero's
 * entrance animation. Typed loosely because CSS custom properties aren't
 * part of React's `CSSProperties`.
 */
function delay(ms: number): CSSProperties {
  return { "--pd-delay": `${ms}ms` } as CSSProperties;
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as AppLocale;

  const t = await getTranslations("Home");
  const tCommon = await getTranslations("Common");
  const [categories, featured, allProducts] = await Promise.all([
    getCategories(locale),
    getFeaturedProducts(locale, 4),
    getProducts(locale),
  ]);

  const highlights = [
    t("highlightFresh"),
    t("highlightCrafted"),
    t("highlightLocal"),
  ];

  // Our own product photography, reused as a visual teaser for the
  // Instagram feed — no third-party embed, so no extra scripts or cookies.
  const galleryImages = allProducts
    .map((product) => product.image)
    .filter((image): image is NonNullable<typeof image> => image !== null)
    .slice(0, 5);

  return (
    <>
      <LocalBusinessJsonLd locale={locale} />

      {/* ---------------------------------------------------------------- Hero */}
      {/* `isolate` gives the decorative glow its own stacking context, so its
          negative z-index stays inside the hero and above the page background. */}
      <section className="relative isolate overflow-hidden border-b border-line">
        <div aria-hidden="true" className="pd-hero-glow" />

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <p
              // `gold-deep` + a near-opaque pill: gold at text size needs
              // 4.5:1, which the lighter brand gold cannot reach on cream.
              className="pd-rise inline-flex items-center gap-2.5 rounded-full border border-gold/40 bg-paper/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gold-deep"
              style={delay(0)}
            >
              {/* Pulsing dot: purely decorative, so it carries no text. */}
              <span
                aria-hidden="true"
                className="pd-pulse relative inline-block h-2 w-2 shrink-0 rounded-full bg-gold"
              />
              {t("heroEyebrow")}
            </p>

            <h1
              className="pd-rise mt-6 font-heading text-4xl font-semibold leading-[1.08] text-cocoa sm:text-5xl lg:text-6xl"
              style={delay(90)}
            >
              {t("heroHeadline")}
            </h1>

            <p
              className="pd-rise mt-6 max-w-xl text-lg leading-relaxed text-cocoa-soft"
              style={delay(180)}
            >
              {t("heroSubheadline")}
            </p>

            <div className="pd-rise mt-9 flex flex-wrap gap-3" style={delay(270)}>
              <Link
                href="/shop"
                className="rounded-full bg-cocoa px-7 py-3.5 text-base font-semibold text-cream shadow-sm transition-all hover:-translate-y-0.5 hover:bg-cocoa-soft hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                {t("heroCta")}
              </Link>
              <Link
                href="/shop"
                className="rounded-full border border-cocoa bg-paper/60 px-7 py-3.5 text-base font-semibold text-cocoa transition-all hover:-translate-y-0.5 hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                {t("heroSecondaryCta")}
              </Link>
            </div>

            <ul
              className="pd-rise mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-cocoa-soft"
              style={delay(360)}
            >
              {highlights.map((highlight) => (
                <li key={highlight} className="flex items-center gap-2">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    className="h-4 w-4 shrink-0 text-gold"
                  >
                    <path
                      d="m5 12.5 4.5 4.5L19 7.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {highlight}
                </li>
              ))}
            </ul>
          </div>

          <div className="pd-float relative">
            <div className="relative aspect-4/3 overflow-hidden rounded-[1.75rem] border border-line bg-paper shadow-lg lg:aspect-square">
              <Image
                src="/images/products/strawberry-cheesecake.webp"
                alt={t("heroHeadline")}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- Categories */}
      <section className="pd-reveal mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-heading text-3xl font-semibold text-cocoa">
          {t("categoriesTitle")}
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                href={{ pathname: "/category/[slug]", params: { slug: category.slug } }}
                className="group flex h-full items-center justify-between gap-3 rounded-xl border border-line bg-paper/65 px-5 py-6 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-paper hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                <span className="font-heading text-xl font-semibold text-cocoa">
                  {category.name}
                </span>
                {/* Chevron: directional, so it flips in RTL. It also nudges
                    along the inline axis on hover, which mirrors correctly
                    because the whole icon is scaled in RTL. */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5 shrink-0 text-gold transition-transform group-hover:translate-x-1 rtl:-scale-x-100"
                >
                  <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------- Featured products */}
      {featured.length > 0 && (
        <section className="pd-reveal border-y border-line bg-paper/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-heading text-3xl font-semibold text-cocoa">
                  {t("featuredTitle")}
                </h2>
                <p className="mt-2 text-cocoa-soft">{t("featuredSubtitle")}</p>
              </div>
              <Link
                href="/shop"
                className="text-sm font-semibold text-cocoa underline underline-offset-4 hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                {tCommon("viewAll")}
              </Link>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------- About teaser */}
      <section className="pd-reveal mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <div className="relative aspect-4/3 overflow-hidden rounded-[1.75rem] border border-line shadow-md">
          <Image
            src="/images/products/almond-tarts.webp"
            alt={t("aboutTeaserTitle")}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
        <div>
          <h2 className="font-heading text-3xl font-semibold text-cocoa">
            {t("aboutTeaserTitle")}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-cocoa-soft">
            {t("aboutTeaserBody")}
          </p>
          <Link
            href="/about"
            className="mt-7 inline-block rounded-full border border-cocoa bg-paper/60 px-6 py-3 text-base font-semibold text-cocoa transition-all hover:-translate-y-0.5 hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {t("aboutTeaserCta")}
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------ Delivery/pickup */}
      <section className="pd-reveal border-t border-line bg-cream-dark/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-heading text-3xl font-semibold text-cocoa">
            {t("deliveryTitle")}
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-cocoa-soft">
            {t("deliveryBody")}
          </p>
          <address className="mt-4 text-cocoa-soft not-italic">
            {BUSINESS_ADDRESS_ONE_LINE}
            <br />
            <a
              href={`tel:${BUSINESS.phoneE164}`}
              dir="ltr"
              className="underline underline-offset-4 hover:text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {BUSINESS.phoneDisplay}
            </a>
          </address>
          <Link
            href="/delivery-pickup"
            className="mt-7 inline-block rounded-full bg-cocoa px-6 py-3 text-base font-semibold text-cream transition-all hover:-translate-y-0.5 hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {t("deliveryCta")}
          </Link>
        </div>
      </section>

      {/* --------------------------------------------------------- Social feeds */}
      {galleryImages.length > 0 && (
        <section
          aria-labelledby="home-social-title"
          className="pd-reveal mx-auto max-w-6xl px-4 py-16 text-center sm:px-6"
        >
          <h2
            id="home-social-title"
            className="font-heading text-3xl font-semibold text-cocoa"
          >
            {t("socialTitle")}
          </h2>

          <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {SOCIAL_PROFILES.map((profile) => (
              <li key={profile.name}>
                <a
                  href={profile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  className="inline-block text-lg font-medium text-gold-deep underline underline-offset-4 transition-colors hover:text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  {profile.name}{" "}
                  <span className="text-cocoa-soft">{profile.handle}</span>
                </a>
              </li>
            ))}
          </ul>

          <ul className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {galleryImages.map((image, index) => (
              <li
                key={image.url}
                className="relative aspect-square overflow-hidden rounded-xl border border-line bg-cream-dark"
              >
                <Image
                  src={image.url}
                  alt={image.alt}
                  fill
                  // Below the fold on every viewport, so it stays lazy.
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  className="object-cover transition-transform duration-500 hover:scale-105"
                  // Only the first couple are ever likely to be seen quickly.
                  loading={index < 2 ? "eager" : "lazy"}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Local SEO intro copy — natural prose, per-language, not keyword spam */}
      <section className="pd-reveal mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <h2 className="font-heading text-2xl font-semibold text-cocoa">
          {t("seoIntroTitle")}
        </h2>
        <p className="mt-3 leading-relaxed text-cocoa-soft">{t("seoIntroBody")}</p>
      </section>
    </>
  );
}
