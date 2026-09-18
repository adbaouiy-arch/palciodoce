import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
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

/*
  The per-locale slug map used to be a second database query from this page.
  It now arrives on the category itself as `slugByLocale`, because the whole
  category — including every translation — is a single Firestore document.
  That is what keeps hreflang alternates and the language switcher pointing at
  the same category instead of falling back to the homepage.
*/

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale as AppLocale;

  const category = await getCategoryBySlug(locale, slug);
  if (!category) return {};

  const slugsByLocale = category.slugByLocale;
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
    title: category.seoTitle ?? category.name,
    description: category.seoDescription ?? category.description ?? "",
  });
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale as AppLocale;

  const category = await getCategoryBySlug(locale, slug);
  if (!category || !category.isActive) {
    notFound();
  }

  const t = await getTranslations("Shop");
  const tProduct = await getTranslations("Product");
  const slugsByLocale = category.slugByLocale;
  const [categories, products] = await Promise.all([
    getCategories(locale),
    getProducts(locale, { categoryKey: category.key }),
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
        label={category.name}
        items={[
          { label: tProduct("breadcrumbHome"), href: "/" },
          { label: tProduct("breadcrumbShop"), href: "/shop" },
          { label: category.name },
        ]}
      />

      <header className="mt-6">
        <h1 className="font-heading text-4xl font-semibold text-cocoa">
          {category.name}
        </h1>
        {category.description && (
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-cocoa-soft">
            {category.description}
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
