import type { AppLocale } from "@/i18n/routing";

/**
 * Locale tags used for date formatting.
 *
 * Portuguese is regionally qualified (European Portuguese, not
 * Brazilian). Arabic requests the Latin numbering system so dates read
 * the same way prices do — the project deliberately keeps figures in
 * Latin digits so numbers stay instantly readable for the mixed
 * Arabic-speaking audience in Portugal.
 */
const INTL_LOCALE: Record<AppLocale, string> = {
  pt: "pt-PT",
  en: "en-GB",
  ar: "ar-u-nu-latn",
};

export function formatDate(date: Date, locale: AppLocale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatDateTime(date: Date, locale: AppLocale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
