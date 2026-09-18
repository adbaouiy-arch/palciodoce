import type { MetadataRoute } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { absoluteUrl, HREFLANG } from "@/lib/seo";
import { getProductSitemapEntries } from "@/lib/data/products";
import { getCategorySitemapEntries } from "@/lib/data/categories";
import { PAGE_KEYS, getPageLocales } from "@/lib/data/pages";

/**
 * Sitemap covering every indexable URL in all three languages.
 *
 * Each entry lists its `alternates.languages`, so search engines are told
 * explicitly that the Portuguese, English and Arabic URLs are the same
 * page in different languages rather than duplicate content — which
 * matters here because the URL *segments* are translated too
 * (/loja vs /en/shop) and the relationship isn't guessable from the path.
 *
 * Excluded on purpose: the cart, checkout, order confirmation, order
 * tracking and the admin area. They are either per-visitor, transactional
 * or private, and all of them already send `noindex`.
 */

type Alternates = Record<string, string>;

/** Builds the hreflang map for a route present in the given locales. */
function alternatesFor(
  pathnameFor: (locale: AppLocale) => string | null,
  locales: readonly AppLocale[],
): Alternates {
  const languages: Alternates = {};

  for (const locale of locales) {
    const pathname = pathnameFor(locale);
    if (pathname) languages[HREFLANG[locale]] = absoluteUrl(pathname);
  }

  const defaultPathname = pathnameFor(routing.defaultLocale);
  if (defaultPathname) {
    languages["x-default"] = absoluteUrl(defaultPathname);
  }

  return languages;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    getProductSitemapEntries(),
    getCategorySitemapEntries(),
  ]);

  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  // --- Static routes, one entry per locale ------------------------------
  const staticRoutes = [
    { href: "/" as const, priority: 1, changeFrequency: "weekly" as const },
    { href: "/shop" as const, priority: 0.9, changeFrequency: "daily" as const },
    { href: "/about" as const, priority: 0.6, changeFrequency: "monthly" as const },
    { href: "/contact" as const, priority: 0.6, changeFrequency: "monthly" as const },
    {
      href: "/delivery-pickup" as const,
      priority: 0.5,
      changeFrequency: "monthly" as const,
    },
  ];

  for (const route of staticRoutes) {
    const languages = alternatesFor(
      (locale) => getPathname({ locale, href: route.href }),
      routing.locales,
    );

    for (const locale of routing.locales) {
      entries.push({
        url: absoluteUrl(getPathname({ locale, href: route.href })),
        lastModified: now,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: { languages },
      });
    }
  }

  // --- Categories -------------------------------------------------------
  for (const category of categories) {
    const pathnameFor = (locale: AppLocale) => {
      const slug = category.slugByLocale[locale];
      return slug
        ? getPathname({ locale, href: { pathname: "/category/[slug]", params: { slug } } })
        : null;
    };
    const languages = alternatesFor(pathnameFor, routing.locales);

    for (const locale of routing.locales) {
      const pathname = pathnameFor(locale);
      if (!pathname) continue;

      entries.push({
        url: absoluteUrl(pathname),
        lastModified: category.updatedAt,
        changeFrequency: "weekly",
        priority: 0.8,
        alternates: { languages },
      });
    }
  }

  // --- Products ---------------------------------------------------------
  for (const product of products) {
    const pathnameFor = (locale: AppLocale) => {
      const slug = product.slugByLocale[locale];
      return slug
        ? getPathname({ locale, href: { pathname: "/product/[slug]", params: { slug } } })
        : null;
    };
    const languages = alternatesFor(pathnameFor, routing.locales);

    for (const locale of routing.locales) {
      const pathname = pathnameFor(locale);
      if (!pathname) continue;

      entries.push({
        url: absoluteUrl(pathname),
        lastModified: product.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
        alternates: { languages },
      });
    }
  }

  // --- Database-backed legal pages --------------------------------------
  // Only the locales a page has actually been translated into are listed,
  // so we never advertise an alternate that would 404.
  const pageLocales = await Promise.all(
    PAGE_KEYS.map(async (key) => ({ key, locales: await getPageLocales(key) })),
  );

  for (const { key, locales } of pageLocales) {
    const href = `/${key}` as "/privacy" | "/terms" | "/cookies";
    const languages = alternatesFor(
      (locale) => (locales.includes(locale) ? getPathname({ locale, href }) : null),
      locales,
    );

    for (const locale of locales) {
      entries.push({
        url: absoluteUrl(getPathname({ locale, href })),
        lastModified: now,
        changeFrequency: "yearly",
        priority: 0.3,
        alternates: { languages },
      });
    }
  }

  return entries;
}
