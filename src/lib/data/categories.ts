import { getDb } from "@/lib/firebase/admin";
import { COLLECTIONS, slugDocId } from "@/lib/firebase/collections";
import {
  pickTranslation,
  readTranslations,
  requireDate,
  toBoolean,
  toNumberOr,
  toStringOr,
  toStringOrNull,
} from "@/lib/firebase/mappers";
import type { TranslationMap } from "@/lib/firebase/mappers";
import { routing, type AppLocale } from "@/i18n/routing";

/**
 * Category reads, backed by Firestore.
 *
 * Note on sorting: the catalogue is deliberately sorted in memory rather than
 * with `.orderBy()`. Combining an equality filter with an order on a different
 * field (`where('isActive','==',true).orderBy('position')`) requires a
 * composite index in Firestore — and the emulator does *not* enforce index
 * requirements, so such a query passes locally and then fails in production
 * with "The query requires an index". For a catalogue of a handful of
 * categories, filtering on one field and sorting the result set here is both
 * cheaper and impossible to get wrong. Order listings, which do grow, use
 * declared indexes instead.
 */

export type CategorySummary = {
  id: string;
  key: string;
  name: string;
  slug: string;
};

type CategoryTranslation = {
  name?: string;
  slug?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
};

export type CategoryDetail = {
  id: string;
  key: string;
  isActive: boolean;
  name: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  /** Every locale this category has a slug in, for hreflang and the switcher. */
  slugByLocale: Partial<Record<AppLocale, string>>;
};

function slugMap(
  translations: TranslationMap<CategoryTranslation>,
): Partial<Record<AppLocale, string>> {
  const out: Partial<Record<AppLocale, string>> = {};
  for (const locale of routing.locales) {
    const slug = translations[locale]?.slug;
    if (slug) out[locale] = slug;
  }
  return out;
}

/**
 * All active categories, translated into the given locale and ordered for
 * display in navigation and filters.
 */
export async function getCategories(
  locale: AppLocale,
): Promise<CategorySummary[]> {
  const snapshot = await getDb()
    .collection(COLLECTIONS.categories)
    .where("isActive", "==", true)
    .get();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      const translations = readTranslations<CategoryTranslation>(
        data.translations,
      );
      const translation = pickTranslation(translations, locale);
      const key = toStringOr(data.key, doc.id);

      return {
        position: toNumberOr(data.position, 0),
        summary: {
          id: doc.id,
          key,
          name: toStringOr(translation?.name, key),
          slug: toStringOr(translation?.slug, key),
        },
      };
    })
    .sort((a, b) => a.position - b.position)
    .map((entry) => entry.summary);
}

/**
 * Resolves a localised slug to a category.
 *
 * Goes through the `categorySlugs` index rather than querying, because the
 * document ID there is `{locale}_{slug}` — a single `get()` by key, and the
 * same mechanism that enforces slug uniqueness on write.
 */
export async function getCategoryBySlug(
  locale: AppLocale,
  slug: string,
): Promise<CategoryDetail | null> {
  const db = getDb();

  const slugDoc = await db
    .collection(COLLECTIONS.categorySlugs)
    .doc(slugDocId(locale, slug))
    .get();
  if (!slugDoc.exists) return null;

  const categoryId = slugDoc.get("categoryId");
  if (typeof categoryId !== "string") return null;

  const doc = await db.collection(COLLECTIONS.categories).doc(categoryId).get();
  if (!doc.exists) return null;

  const data = doc.data() ?? {};
  const translations = readTranslations<CategoryTranslation>(data.translations);
  const translation = pickTranslation(translations, locale);
  const key = toStringOr(data.key, doc.id);

  return {
    id: doc.id,
    key,
    isActive: toBoolean(data.isActive),
    name: toStringOr(translation?.name, key),
    slug: toStringOr(translation?.slug, slug),
    description: toStringOrNull(translation?.description),
    seoTitle: toStringOrNull(translation?.seoTitle),
    seoDescription: toStringOrNull(translation?.seoDescription),
    slugByLocale: slugMap(translations),
  };
}

/**
 * Every active category with its slug in each locale, for the sitemap.
 * The slug differs per language, so hreflang alternates need all of them.
 */
export async function getCategorySitemapEntries(): Promise<
  { slugByLocale: Partial<Record<AppLocale, string>>; updatedAt: Date }[]
> {
  const snapshot = await getDb()
    .collection(COLLECTIONS.categories)
    .where("isActive", "==", true)
    .get();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        position: toNumberOr(data.position, 0),
        entry: {
          slugByLocale: slugMap(
            readTranslations<CategoryTranslation>(data.translations),
          ),
          updatedAt: requireDate(data.updatedAt),
        },
      };
    })
    .sort((a, b) => a.position - b.position)
    .map((row) => row.entry);
}
