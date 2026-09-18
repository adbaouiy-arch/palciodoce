import type { DocumentData, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import { COLLECTIONS, slugDocId } from "@/lib/firebase/collections";
import {
  pickTranslation,
  readTranslations,
  requireDate,
  toBoolean,
  toNullableNumber,
  toNumberOr,
  toStringOr,
} from "@/lib/firebase/mappers";
import { routing, type AppLocale } from "@/i18n/routing";

/**
 * Product reads, backed by Firestore.
 *
 * The relational shape (Product + ProductTranslation + ProductImage across
 * three tables) is collapsed into one document per product: translations as a
 * map keyed by locale, images as an array. Firestore cannot join, so a product
 * page that used to be a three-table read is now a single `get()`.
 *
 * `categoryKey` is denormalised onto each product for the same reason —
 * filtering the shop by category would otherwise need a lookup per product.
 *
 * Sorting is done in memory; see the note in `categories.ts` for why.
 */

export type ProductSummary = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  shortDescription: string;
  priceCents: number;
  image: { url: string; alt: string } | null;
  categoryKey: string | null;
  isFeatured: boolean;
  stock: number | null;
};

export type ProductDetail = ProductSummary & {
  description: string;
  ingredients: string;
  allergens: string;
  storageInformation: string;
  seoTitle: string;
  seoDescription: string;
  images: { url: string; alt: string }[];
  weightGrams: number | null;
  categorySlug: string | null;
  categoryName: string | null;
  translations: { locale: AppLocale; slug: string }[];
};

type ProductTranslation = {
  name?: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  ingredients?: string;
  allergens?: string;
  storageInformation?: string;
  seoTitle?: string;
  seoDescription?: string;
};

type StoredImage = { url?: string; alt?: string; position?: number };

function readImages(
  value: unknown,
  fallbackAlt: string,
): { url: string; alt: string }[] {
  if (!Array.isArray(value)) return [];

  return (value as StoredImage[])
    .filter((image) => typeof image?.url === "string")
    .slice()
    .sort((a, b) => toNumberOr(a.position, 0) - toNumberOr(b.position, 0))
    .map((image) => ({
      url: image.url as string,
      alt: toStringOr(image.alt, fallbackAlt),
    }));
}

function toSummary(
  doc: QueryDocumentSnapshot<DocumentData> | { id: string; data: () => DocumentData | undefined },
  locale: AppLocale,
): { position: number; summary: ProductSummary } {
  const data = doc.data() ?? {};
  const translations = readTranslations<ProductTranslation>(data.translations);
  const translation = pickTranslation(translations, locale);
  const sku = toStringOr(data.sku, doc.id);
  const name = toStringOr(translation?.name, sku);
  const images = readImages(data.images, name);

  return {
    position: toNumberOr(data.position, 0),
    summary: {
      id: doc.id,
      sku,
      slug: toStringOr(translation?.slug, doc.id),
      name,
      shortDescription: toStringOr(translation?.shortDescription, ""),
      priceCents: toNumberOr(data.priceCents, 0),
      image: images[0] ?? null,
      categoryKey: typeof data.categoryKey === "string" ? data.categoryKey : null,
      isFeatured: toBoolean(data.isFeatured),
      stock: toNullableNumber(data.stock),
    },
  };
}

function sortedSummaries(
  docs: QueryDocumentSnapshot<DocumentData>[],
  locale: AppLocale,
): ProductSummary[] {
  return docs
    .map((doc) => toSummary(doc, locale))
    .sort((a, b) => a.position - b.position)
    .map((row) => row.summary);
}

export async function getFeaturedProducts(
  locale: AppLocale,
  take = 4,
): Promise<ProductSummary[]> {
  const snapshot = await getDb()
    .collection(COLLECTIONS.products)
    .where("isActive", "==", true)
    .where("isFeatured", "==", true)
    .get();

  return sortedSummaries(snapshot.docs, locale).slice(0, take);
}

export async function getProducts(
  locale: AppLocale,
  options: { categoryKey?: string } = {},
): Promise<ProductSummary[]> {
  let query = getDb()
    .collection(COLLECTIONS.products)
    .where("isActive", "==", true);

  if (options.categoryKey) {
    query = query.where("categoryKey", "==", options.categoryKey);
  }

  const snapshot = await query.get();
  return sortedSummaries(snapshot.docs, locale);
}

export async function getProductBySlug(
  locale: AppLocale,
  slug: string,
): Promise<ProductDetail | null> {
  const db = getDb();

  // Single keyed read via the slug index, rather than a query.
  const slugDoc = await db
    .collection(COLLECTIONS.productSlugs)
    .doc(slugDocId(locale, slug))
    .get();
  if (!slugDoc.exists) return null;

  const productId = slugDoc.get("productId");
  if (typeof productId !== "string") return null;

  const doc = await db.collection(COLLECTIONS.products).doc(productId).get();
  if (!doc.exists) return null;

  const data = doc.data() ?? {};
  if (!toBoolean(data.isActive)) return null;

  const translations = readTranslations<ProductTranslation>(data.translations);
  const translation = pickTranslation(translations, locale);
  const { summary } = toSummary(doc, locale);
  const images = readImages(data.images, summary.name);

  // The category name and slug are needed for breadcrumbs. One extra read,
  // only on the detail page.
  let categoryName: string | null = null;
  let categorySlug: string | null = null;
  if (typeof data.categoryId === "string") {
    const categoryDoc = await db
      .collection(COLLECTIONS.categories)
      .doc(data.categoryId)
      .get();

    if (categoryDoc.exists) {
      const categoryTranslations = readTranslations<{
        name?: string;
        slug?: string;
      }>(categoryDoc.get("translations"));
      const categoryTranslation = pickTranslation(categoryTranslations, locale);
      categoryName = categoryTranslation?.name ?? null;
      categorySlug = categoryTranslation?.slug ?? null;
    }
  }

  return {
    ...summary,
    slug: toStringOr(translation?.slug, slug),
    description: toStringOr(translation?.description, ""),
    ingredients: toStringOr(translation?.ingredients, ""),
    allergens: toStringOr(translation?.allergens, ""),
    storageInformation: toStringOr(translation?.storageInformation, ""),
    seoTitle: toStringOr(translation?.seoTitle, summary.name),
    seoDescription: toStringOr(
      translation?.seoDescription,
      summary.shortDescription,
    ),
    images,
    weightGrams: toNullableNumber(data.weightGrams),
    categoryName,
    categorySlug,
    translations: routing.locales.flatMap((target) => {
      const targetSlug = translations[target]?.slug;
      return targetSlug ? [{ locale: target, slug: targetSlug }] : [];
    }),
  };
}

/**
 * Multilingual search.
 *
 * Firestore has no full-text search and no case-insensitive matching, so this
 * reads the active catalogue and matches in memory across *every* locale's
 * translation — which is what lets an Arabic query surface a product by its
 * Portuguese name, and vice versa.
 *
 * That was also true of the SQL version (SQLite's `contains` is
 * case-sensitive, so it scanned translations in JS too), so this is no more
 * expensive than before. It stays appropriate while the catalogue is small; a
 * few hundred products would warrant Algolia or Typesense.
 */
export async function searchProducts(
  locale: AppLocale,
  query: string,
): Promise<ProductSummary[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const needle = trimmed.toLocaleLowerCase();

  const snapshot = await getDb()
    .collection(COLLECTIONS.products)
    .where("isActive", "==", true)
    .get();

  const matching = snapshot.docs.filter((doc) => {
    const translations = readTranslations<ProductTranslation>(
      doc.get("translations"),
    );

    return Object.values(translations).some((translation) => {
      const name = translation?.name?.toLocaleLowerCase() ?? "";
      const short = translation?.shortDescription?.toLocaleLowerCase() ?? "";
      return name.includes(needle) || short.includes(needle);
    });
  });

  return sortedSummaries(matching, locale);
}

/**
 * Every active product with its slug in each locale, for the sitemap.
 */
export async function getProductSitemapEntries(): Promise<
  { slugByLocale: Partial<Record<AppLocale, string>>; updatedAt: Date }[]
> {
  const snapshot = await getDb()
    .collection(COLLECTIONS.products)
    .where("isActive", "==", true)
    .get();

  return snapshot.docs
    .map((doc) => {
      const translations = readTranslations<ProductTranslation>(
        doc.get("translations"),
      );

      const slugByLocale: Partial<Record<AppLocale, string>> = {};
      for (const locale of routing.locales) {
        const slug = translations[locale]?.slug;
        if (slug) slugByLocale[locale] = slug;
      }

      return {
        position: toNumberOr(doc.get("position"), 0),
        entry: { slugByLocale, updatedAt: requireDate(doc.get("updatedAt")) },
      };
    })
    .sort((a, b) => a.position - b.position)
    .map((row) => row.entry);
}

/** Shared by the cart hydration endpoint and the order pipeline. */
export type ProductForCart = {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  image: { url: string; alt: string } | null;
  isActive: boolean;
  stock: number | null;
};

/**
 * Resolves a set of product IDs for one locale.
 *
 * Firestore's `in` filter is capped (30 values), and the cart is capped at 100
 * lines, so IDs are fetched with `getAll` instead — a direct multi-document
 * read with no query planning and no index requirement.
 */
export async function getProductsForCart(
  locale: AppLocale,
  productIds: string[],
): Promise<Map<string, ProductForCart>> {
  const unique = [...new Set(productIds)];
  if (unique.length === 0) return new Map();

  const db = getDb();
  const refs = unique.map((id) => db.collection(COLLECTIONS.products).doc(id));
  const docs = await db.getAll(...refs);

  const out = new Map<string, ProductForCart>();
  for (const doc of docs) {
    if (!doc.exists) continue;

    const data = doc.data() ?? {};
    const translations = readTranslations<ProductTranslation>(data.translations);
    const translation = pickTranslation(translations, locale);
    const sku = toStringOr(data.sku, doc.id);
    const name = toStringOr(translation?.name, sku);

    out.set(doc.id, {
      id: doc.id,
      slug: toStringOr(translation?.slug, doc.id),
      name,
      priceCents: toNumberOr(data.priceCents, 0),
      image: readImages(data.images, name)[0] ?? null,
      isActive: toBoolean(data.isActive),
      stock: toNullableNumber(data.stock),
    });
  }

  return out;
}
