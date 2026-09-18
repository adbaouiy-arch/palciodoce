import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { routing, type AppLocale } from "@/i18n/routing";
import { getPathname } from "@/i18n/navigation";
import { getProductBySlug, getProducts } from "@/lib/data/products";
import { formatPrice } from "@/lib/format-price";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ProductCard } from "@/components/product/product-card";
import { ProductPurchasePanel } from "@/components/product/product-purchase-panel";
import { buildPageMetadata, absoluteUrl } from "@/lib/seo";
import { ProductJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";
import {
  PublishAlternateLinks,
  type AlternateHref,
} from "@/lib/alternate-links";

/**
 * Builds the per-locale href map for this product. Because each locale
 * has its own slug (pt: /produto/cheesecake-frutos-vermelhos,
 * en: /en/product/red-berry-cheesecake), this is what makes both the
 * hreflang alternates and the header language switcher resolve to the
 * SAME product in the target language instead of dropping the visitor
 * on the homepage.
 */
function buildPerLocaleHref(
  translations: { locale: AppLocale; slug: string }[],
) {
  const perLocaleHref: Partial<
    Record<AppLocale, { pathname: "/product/[slug]"; params: { slug: string } }>
  > = {};
  for (const target of routing.locales) {
    const match = translations.find((t) => t.locale === target);
    if (match) {
      perLocaleHref[target] = {
        pathname: "/product/[slug]",
        params: { slug: match.slug },
      };
    }
  }
  return perLocaleHref;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale as AppLocale;

  const product = await getProductBySlug(locale, slug);
  if (!product) return {};

  return buildPageMetadata({
    locale,
    href: { pathname: "/product/[slug]", params: { slug } },
    perLocaleHref: buildPerLocaleHref(product.translations),
    title: product.seoTitle,
    description: product.seoDescription,
    images: product.images.map((image) => image.url),
    type: "article",
  });
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale as AppLocale;

  const product = await getProductBySlug(locale, slug);
  if (!product) {
    notFound();
  }

  const t = await getTranslations("Product");
  const tCommon = await getTranslations("Common");

  // Related products from the same category, excluding this one.
  const related = product.categoryKey
    ? (await getProducts(locale, { categoryKey: product.categoryKey }))
        .filter((candidate) => candidate.id !== product.id)
        .slice(0, 3)
    : [];

  /*
    Internal route descriptors, not resolved URLs: the language switcher
    passes these to next-intl's router, which applies the locale prefix
    and updates the locale cookie. Handing it an already-prefixed path
    would produce a doubled prefix (/en/en/product/...).
  */
  const alternateLinks: Partial<Record<AppLocale, AlternateHref>> = {};
  for (const target of routing.locales) {
    const match = product.translations.find((tr) => tr.locale === target);
    if (match) {
      alternateLinks[target] = {
        pathname: "/product/[slug]",
        params: { slug: match.slug },
      };
    }
  }

  const breadcrumbItems = [
    { label: t("breadcrumbHome"), href: "/" as const },
    { label: t("breadcrumbShop"), href: "/shop" as const },
    ...(product.categoryName && product.categorySlug
      ? [
          {
            label: product.categoryName,
            href: {
              pathname: "/category/[slug]" as const,
              params: { slug: product.categorySlug },
            },
          },
        ]
      : []),
    { label: product.name },
  ];

  const availabilityLabel =
    product.stock === null
      ? t("availabilityMadeToOrder")
      : product.stock > 0
        ? t("availabilityInStock")
        : t("availabilityOutOfStock");

  const details: { title: string; body: string }[] = [
    { title: t("ingredientsTitle"), body: product.ingredients },
    { title: t("allergensTitle"), body: product.allergens },
    { title: t("storageTitle"), body: product.storageInformation },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PublishAlternateLinks links={alternateLinks} />
      <ProductJsonLd locale={locale} product={product} />
      <BreadcrumbJsonLd
        items={[
          { name: t("breadcrumbHome"), url: absoluteUrl(getPathname({ locale, href: "/" })) },
          {
            name: t("breadcrumbShop"),
            url: absoluteUrl(getPathname({ locale, href: "/shop" })),
          },
          {
            name: product.name,
            url: absoluteUrl(
              getPathname({
                locale,
                href: { pathname: "/product/[slug]", params: { slug: product.slug } },
              }),
            ),
          },
        ]}
      />

      <Breadcrumbs label={product.name} items={breadcrumbItems} />

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        {/* Product imagery */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-cream-dark">
            {product.image ? (
              <Image
                src={product.image.url}
                alt={product.image.alt}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-cocoa-soft">
                Palácio Doce
              </div>
            )}
          </div>

          {product.images.length > 1 && (
            <ul className="mt-3 grid grid-cols-4 gap-3">
              {product.images.slice(1).map((image, index) => (
                <li
                  key={index}
                  className="relative aspect-square overflow-hidden rounded-lg border border-line"
                >
                  <Image
                    src={image.url}
                    alt={image.alt}
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Purchase details */}
        <div>
          <h1 className="font-heading text-3xl font-semibold leading-tight text-cocoa sm:text-4xl">
            {product.name}
          </h1>

          <p className="mt-4 text-lg leading-relaxed text-cocoa-soft">
            {product.shortDescription}
          </p>

          <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-2">
            {/* dir="ltr" keeps the euro amount readable in RTL layouts */}
            <p className="text-3xl font-semibold text-cocoa" dir="ltr">
              {formatPrice(product.priceCents, locale)}
            </p>
            <span className="text-sm font-medium text-cocoa-soft">
              {availabilityLabel}
            </span>
          </div>

          <div className="mt-8">
            <ProductPurchasePanel
              productId={product.id}
              isOutOfStock={product.stock !== null && product.stock <= 0}
            />
          </div>

          <dl className="mt-8 flex flex-col gap-1 border-t border-line pt-5 text-sm">
            <div className="flex gap-2">
              <dt className="font-medium text-cocoa">{t("skuLabel")}:</dt>
              <dd className="text-cocoa-soft" dir="ltr">
                {product.sku}
              </dd>
            </div>
            {product.weightGrams && (
              <div className="flex gap-2">
                <dt className="font-medium text-cocoa">{tCommon("quantity")}:</dt>
                <dd className="text-cocoa-soft" dir="ltr">
                  {product.weightGrams} g
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Long description */}
      <section className="mt-14 max-w-3xl">
        <h2 className="font-heading text-2xl font-semibold text-cocoa">
          {t("descriptionTitle")}
        </h2>
        <p className="mt-4 whitespace-pre-line leading-relaxed text-cocoa-soft">
          {product.description}
        </p>
      </section>

      {/* Ingredients / allergens / storage */}
      <section className="mt-12 grid gap-6 md:grid-cols-3">
        {details.map((detail) => (
          <div
            key={detail.title}
            className="rounded-xl border border-line bg-paper p-6"
          >
            <h2 className="font-heading text-lg font-semibold text-cocoa">
              {detail.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-cocoa-soft">
              {detail.body}
            </p>
          </div>
        ))}
      </section>

      {/* Related products */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="font-heading text-2xl font-semibold text-cocoa">
            {t("relatedTitle")}
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((candidate) => (
              <ProductCard key={candidate.id} product={candidate} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
