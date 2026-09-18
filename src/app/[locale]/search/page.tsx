import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { searchProducts } from "@/lib/data/products";
import { ProductCard } from "@/components/product/product-card";
import { SearchForm } from "@/components/layout/search-form";
import { Link } from "@/i18n/navigation";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Search" });

  return {
    ...buildPageMetadata({
      locale: locale as AppLocale,
      href: "/search",
      title: t("title"),
      description: t("placeholder"),
    }),
    // Search result pages shouldn't compete with real content in the index.
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as AppLocale;
  const { q } = await searchParams;

  const query = (Array.isArray(q) ? q[0] : q) ?? "";
  const t = await getTranslations("Search");
  const tShop = await getTranslations("Shop");
  const tCommon = await getTranslations("Common");

  const results = query ? await searchProducts(locale, query) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-heading text-4xl font-semibold text-cocoa">
        {t("title")}
      </h1>

      <div className="mt-6 max-w-xl">
        <SearchForm />
      </div>

      {query && (
        <>
          <p className="mt-8 text-lg text-cocoa">{t("resultsFor", { query })}</p>
          <p className="mt-1 text-sm text-cocoa-soft">
            {tShop("resultsCount", { count: results.length })}
          </p>
        </>
      )}

      {query && results.length === 0 && (
        <div className="mt-8 rounded-xl border border-line bg-paper p-8 text-center">
          <p className="text-cocoa">{t("noResults", { query })}</p>
          <p className="mt-2 text-sm text-cocoa-soft">{t("noResultsHint")}</p>
          <Link
            href="/shop"
            className="mt-5 inline-block rounded-full bg-cocoa px-6 py-3 text-sm font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {tCommon("viewAll")}
          </Link>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
