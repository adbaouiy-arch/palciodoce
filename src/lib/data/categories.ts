import { prisma } from "@/lib/prisma";
import type { AppLocale } from "@/i18n/routing";

export type CategorySummary = {
  id: string;
  key: string;
  name: string;
  slug: string;
};

/**
 * All active categories, translated into the given locale, ordered for
 * display in navigation / filters. Falls back gracefully to an empty
 * name if a translation is somehow missing (should not happen given the
 * unique [categoryId, locale] constraint enforced by every write path).
 */
export async function getCategories(locale: AppLocale): Promise<CategorySummary[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { position: "asc" },
    include: {
      translations: {
        where: { locale },
      },
    },
  });

  return categories.map((category) => ({
    id: category.id,
    key: category.key,
    name: category.translations[0]?.name ?? category.key,
    slug: category.translations[0]?.slug ?? category.key,
  }));
}

export async function getCategoryBySlug(locale: AppLocale, slug: string) {
  const translation = await prisma.categoryTranslation.findUnique({
    where: { locale_slug: { locale, slug } },
    include: { category: true },
  });

  return translation;
}

/**
 * Every active category with its slug in each locale, for the sitemap.
 * See `getProductSitemapEntries` — same reasoning: the slug differs per
 * language, so hreflang alternates need all of them.
 */
export async function getCategorySitemapEntries(): Promise<
  { slugByLocale: Partial<Record<AppLocale, string>>; updatedAt: Date }[]
> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { position: "asc" },
    select: {
      updatedAt: true,
      translations: { select: { locale: true, slug: true } },
    },
  });

  return categories.map((category) => {
    const slugByLocale: Partial<Record<AppLocale, string>> = {};
    for (const translation of category.translations) {
      slugByLocale[translation.locale as AppLocale] = translation.slug;
    }
    return { slugByLocale, updatedAt: category.updatedAt };
  });
}
