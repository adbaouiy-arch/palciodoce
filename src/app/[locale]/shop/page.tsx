import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { getCategories } from "@/lib/data/categories";
import { getProducts } from "@/lib/data/products";
import { ProductCard } from "@/components/product/product-card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CategoryFilter } from "@/components/product/category-filter";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Shop" });
  const tMeta = await getTranslations({ locale, namespace: "Metadata" });

  return buildPageMetadata({
    locale: locale as AppLocale,
    href: "/shop",
    title: `${t("title")} — ${tMeta("siteName")}`,
    description: t("subtitle"),
  });
}

export default async function ShopPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as AppLocale;

  const t = await getTranslations("Shop");
  const tProduct = await getTranslations("Product");
  const [categories, products] = await Promise.all([
    getCategories(locale),
    getProducts(locale),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Breadcrumbs
        label={t("title")}
        items={[
          { label: tProduct("breadcrumbHome"), href: "/" },
          { label: t("title") },
        ]}
      />

      <header className="mt-6">
        <h1 className="font-heading text-4xl font-semibold text-cocoa">
          {t("title")}
        </h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-cocoa-soft">
          {t("subtitle")}
        </p>
      </header>

      <div className="mt-8">
        <CategoryFilter categories={categories} activeSlug={null} />
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
