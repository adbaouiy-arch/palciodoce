import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { routing, type AppLocale } from "@/i18n/routing";
import { getCategories, getCategoryBySlug } from "@/lib/data/categories";
import { getProducts } from "@/lib/data/products";
import { ProductCard } from "@/components/product/product-card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CategoryFilter } from "@/components/product/category-filter";
import { buildPageMetadata } from "@/lib/seo";
import {
  PublishAlternateLinks,
  type AlternateHref,
} from "@/lib/alternate-links";

/**
 * Resolves the equivalent category slug in every locale, so hreflang
 * alternates and the language switcher point at the same category
 * rather than falling back to the homepage.
 */
async function getSlugsByLocale(categoryId: string) {
  const translations = await prisma.categoryTranslation.findMany({
    where: { categoryId },
    select: { locale: true, slug: true },
  });

  const map: Partial<Record<AppLocale, string>> = {};
  for (const t of translations) {
    map[t.locale as AppLocale] = t.slug;
  }
  return map;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale as AppLocale;

  const translation = await getCategoryBySlug(locale, slug);
  if (!translation) return {};

  const slugsByLocale = await getSlugsByLocale(translation.categoryId);
  const perLocaleHref: Partial<
    Record<AppLocale, { pathname: "/category/[slug]"; params: { slug: string } }>
  > = {};
  for (const target of routing.locales) {
    const targetSlug = slugsByLocale[target];
    if (targetSlug) {
      perLocaleHref[target] = {
        pathname: "/category/[slug]",
        params: { slug: targetSlug },
      };
    }
  }

  return buildPageMetadata({
    locale,
    href: { pathname: "/category/[slug]", params: { slug } },
    perLocaleHref,
    title: translation.seoTitle ?? translation.name,
    description: translation.seoDescription ?? translation.description ?? "",
  });
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale as AppLocale;

  const translation = await getCategoryBySlug(locale, slug);
  if (!translation || !translation.category.isActive) {
    notFound();
  }

  const t = await getTranslations("Shop");
  const tProduct = await getTranslations("Product");
  const [categories, products, slugsByLocale] = await Promise.all([
    getCategories(locale),
    getProducts(locale, { categoryKey: translation.category.key }),
    getSlugsByLocale(translation.categoryId),
  ]);

  /*
    Internal route descriptors, not resolved URLs — next-intl's router
    adds the locale prefix itself. See lib/alternate-links.tsx.
  */
  const alternateLinks: Partial<Record<AppLocale, AlternateHref>> = {};
  for (const target of routing.locales) {
    const targetSlug = slugsByLocale[target];
    if (targetSlug) {
      alternateLinks[target] = {
        pathname: "/category/[slug]",
        params: { slug: targetSlug },
      };
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PublishAlternateLinks links={alternateLinks} />

      <Breadcrumbs
        label={translation.name}
        items={[
          { label: tProduct("breadcrumbHome"), href: "/" },
          { label: tProduct("breadcrumbShop"), href: "/shop" },
          { label: translation.name },
        ]}
      />

      <header className="mt-6">
        <h1 className="font-heading text-4xl font-semibold text-cocoa">
          {translation.name}
        </h1>
        {translation.description && (
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-cocoa-soft">
            {translation.description}
          </p>
        )}
      </header>

      <div className="mt-8">
        <CategoryFilter categories={categories} activeSlug={slug} />
      </div>

      <p className="mt-6 text-sm text-cocoa-soft">
        {t("resultsCount", { count: products.length })}
      </p>

      {products.length === 0 ? (
        <p className="mt-8 rounded-xl border border-line bg-paper p-8 text-center text-cocoa-soft">
          {t("noResults")}
        </p>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
