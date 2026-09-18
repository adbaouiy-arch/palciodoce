import type { AppLocale } from "@/i18n/routing";

/**
 * Formats a price in EUR cents.
 *
 * The brand's house style — stated in the spec — is "€12,50": euro sign
 * first, comma as the decimal separator. `Intl` for pt-PT would render
 * "12,50 €" (symbol trailing) and en-* would use a dot decimal, so the
 * parts are assembled explicitly to keep one consistent, unambiguous
 * price format across all three languages. Currency is always EUR.
 *
 * Latin digits are used in Arabic too (rather than Eastern Arabic
 * numerals), so prices stay instantly readable for the mixed
 * Arabic-speaking audience in Portugal, per "numbers, prices and
 * product images must remain easy to understand".
 */
export function formatPrice(cents: number, _locale?: AppLocale): string {
  const isNegative = cents < 0;
  const absolute = Math.abs(Math.round(cents));
  const euros = Math.floor(absolute / 100);
  const remainder = absolute % 100;

  const eurosWithSeparators = new Intl.NumberFormat("pt-PT", {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(euros);

  const formatted = `€${eurosWithSeparators},${remainder.toString().padStart(2, "0")}`;
  return isNegative ? `-${formatted}` : formatted;
}
