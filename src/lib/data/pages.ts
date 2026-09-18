import { prisma } from "@/lib/prisma";
import type { AppLocale } from "@/i18n/routing";
import { routing } from "@/i18n/routing";

/**
 * Informational pages (privacy policy, terms, cookie policy) are stored
 * in the database rather than hard-coded, so their wording can be
 * updated per language from the admin area without a deploy — which
 * matters most for legal copy.
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

export async function getPage(
  locale: AppLocale,
  key: PageKey,
): Promise<PageContent | null> {
  const page = await prisma.page.findUnique({
    where: { key },
    include: { translations: { where: { locale } } },
  });

  const translation = page?.translations[0];
  if (!page || !translation) return null;

  return {
    key: page.key,
    title: translation.title,
    content: translation.content,
    // Legal pages don't always carry bespoke SEO copy; the page title is
    // a sensible, non-empty fallback.
    seoTitle: translation.seoTitle ?? translation.title,
    seoDescription: translation.seoDescription ?? translation.title,
    updatedAt: page.updatedAt,
  };
}

/**
 * The locales a given page has been translated into. Used by the sitemap
 * so we never advertise an hreflang alternate for a page that has no
 * content in that language.
 */
export async function getPageLocales(key: PageKey): Promise<AppLocale[]> {
  const page = await prisma.page.findUnique({
    where: { key },
    include: { translations: { select: { locale: true } } },
  });
  if (!page) return [];

  const available = new Set(page.translations.map((t) => t.locale as string));
  return routing.locales.filter((locale) => available.has(locale));
}
