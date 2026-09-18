import { Timestamp } from "firebase-admin/firestore";
import { routing, type AppLocale } from "@/i18n/routing";

/**
 * Helpers for turning Firestore documents into the application's own types.
 *
 * Firestore is schemaless, which means every read is untrusted input in a way a
 * SQL row never was: a document may predate a code change, may have been
 * written by a migration, or may simply be missing a field. These helpers
 * normalise that away so the rest of the codebase keeps working with plain
 * `Date`, `string` and `| null` types.
 */

/**
 * Firestore returns `Timestamp`, but the codebase works in `Date` throughout
 * (`formatDate`, `<time dateTime>`, order sorting). Strings are handled too,
 * because the JSON export/import path serialises dates as ISO.
 */
export function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  // Plain `{seconds, nanoseconds}` — what a Timestamp looks like once it has
  // been through JSON.
  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof (value as { seconds: unknown }).seconds === "number"
  ) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return null;
}

/**
 * For fields the schema treats as always present (`createdAt`). Falls back to
 * the epoch rather than throwing: a missing timestamp should not take down a
 * product page, and an obviously wrong date is easier to spot than a 500.
 */
export function requireDate(value: unknown): Date {
  return toDate(value) ?? new Date(0);
}

export function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function toStringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

export function toNumberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Stock is meaningfully tri-state: a number is a finite count, `null` means
 * made-to-order (unlimited). Those must not be conflated — treating a missing
 * value as `0` would silently mark every made-to-order item out of stock.
 */
export function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function toBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** A per-locale map of translations, as stored on catalogue documents. */
export type TranslationMap<T> = Partial<Record<AppLocale, T>>;

export function readTranslations<T>(value: unknown): TranslationMap<T> {
  if (typeof value !== "object" || value === null) return {};
  const source = value as Record<string, unknown>;
  const out: TranslationMap<T> = {};
  for (const locale of routing.locales) {
    const entry = source[locale];
    if (typeof entry === "object" && entry !== null) {
      out[locale] = entry as T;
    }
  }
  return out;
}

/**
 * Picks a locale's translation, falling back to the default locale and then to
 * any available one.
 *
 * SQL guaranteed a translation existed for every locale via a unique
 * constraint on `[entityId, locale]`. Firestore cannot guarantee that, so a
 * partially-translated document is now representable — and a product missing
 * its Arabic copy should degrade to Portuguese rather than render blank.
 */
export function pickTranslation<T>(
  translations: TranslationMap<T>,
  locale: AppLocale,
): T | null {
  return (
    translations[locale] ??
    translations[routing.defaultLocale] ??
    Object.values(translations)[0] ??
    null
  );
}
