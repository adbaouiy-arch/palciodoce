import { getDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/collections";
import {
  pickTranslation,
  readTranslations,
  requireDate,
  toStringOr,
} from "@/lib/firebase/mappers";
import { routing, type AppLocale } from "@/i18n/routing";

/**
 * Informational pages (privacy policy, terms, cookie policy).
 *
 * Stored in the database rather than hard-coded so legal wording can be
 * updated per language without a deploy. The page key is the document ID,
 * which both gives the uniqueness the old `@unique` constraint provided and
 * makes every lookup a single keyed read.
 */

/** Page keys that have a corresponding route in the app. */
export const PAGE_KEYS = ["privacy", "terms", "cookies"] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

export type PageContent = {
  key: string;
  title: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
  updatedAt: Date;
};

type PageTranslation = {
  title?: string;
  content?: string;
  seoTitle?: string;
  seoDescription?: string;
};

export async function getPage(
  locale: AppLocale,
  key: PageKey,
): Promise<PageContent | null> {
  const doc = await getDb().collection(COLLECTIONS.pages).doc(key).get();
  if (!doc.exists) return null;

  const data = doc.data() ?? {};
  const translations = readTranslations<PageTranslation>(data.translations);
  const translation = pickTranslation(translations, locale);
  if (!translation) return null;

  const title = toStringOr(translation.title, key);

  return {
    key: doc.id,
    title,
    content: toStringOr(translation.content, ""),
    // Legal pages don't always carry bespoke SEO copy; the title is a
    // sensible, non-empty fallback.
    seoTitle: toStringOr(translation.seoTitle, title),
    seoDescription: toStringOr(translation.seoDescription, title),
    updatedAt: requireDate(data.updatedAt),
  };
}

/**
 * The locales a given page has been translated into. Used by the sitemap so we
 * never advertise an hreflang alternate for a page with no content in that
 * language.
 */
export async function getPageLocales(key: PageKey): Promise<AppLocale[]> {
  const doc = await getDb().collection(COLLECTIONS.pages).doc(key).get();
  if (!doc.exists) return [];

  const translations = readTranslations<PageTranslation>(doc.get("translations"));
  return routing.locales.filter((locale) => {
    const translation = translations[locale];
    return Boolean(translation?.title && translation?.content);
  });
}
