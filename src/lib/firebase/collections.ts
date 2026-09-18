import type { AppLocale } from "@/i18n/routing";

/**
 * Canonical Firestore collection names and document-ID builders.
 *
 * These are constants rather than inline strings for a specific reason: every
 * collection is named explicitly in `firestore.rules`, and the ruleset ends
 * with a catch-all deny. A typo like `contactMessage` would therefore be
 * invisible to clients but perfectly writable by the Admin SDK — silently
 * accumulating orphaned data in an uncovered collection. One definition here
 * keeps the code and the rules in step.
 */
export const COLLECTIONS = {
  products: "products",
  productSlugs: "productSlugs",
  categories: "categories",
  categorySlugs: "categorySlugs",
  pages: "pages",
  orders: "orders",
  contactMessages: "contactMessages",
  consentLogs: "consentLogs",
  adminUsers: "adminUsers",
  counters: "counters",
} as const;

/**
 * Document IDs that act as uniqueness constraints.
 *
 * Firestore has no `UNIQUE` index. The only thing it guarantees to be unique
 * is a document ID, so anything that used to be a SQL unique constraint is
 * expressed as a deterministic ID here:
 *
 *   @@unique([locale, slug])  ->  productSlugs/pt_cheesecake-frutos-vermelhos
 *   @unique orderNumber       ->  orders/PD-20260916-0001
 *   @unique key               ->  pages/privacy
 *
 * A duplicate then fails as a document collision on `create`, rather than
 * quietly producing a second row.
 */
export function slugDocId(locale: AppLocale, slug: string): string {
  // Slugs are already lowercase and hyphenated; the locale prefix keeps the
  // same slug usable in more than one language (en and ar often share one).
  return `${locale}_${slug}`;
}

/** Counter document backing the daily order-number sequence. */
export function orderCounterDocId(date: Date): string {
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ];
  return `orders-${parts.join("")}`;
}
