import { prisma } from "@/lib/prisma";
import type { AppLocale } from "@/i18n/routing";

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

function toSummary(
  product: {
    id: string;
    sku: string;
    priceCents: number;
    isFeatured: boolean;
    stock: number | null;
    category: { key: string } | null;
    images: { url: string; alt: string | null }[];
    translations: { name: string; slug: string; shortDescription: string }[];
  },
): ProductSummary {
  const translation = product.translations[0];
  const image = product.images[0];

  return {
    id: product.id,
    sku: product.sku,
    slug: translation?.slug ?? product.id,
    name: translation?.name ?? product.sku,
    shortDescription: translation?.shortDescription ?? "",
    priceCents: product.priceCents,
    image: image ? { url: image.url, alt: image.alt ?? translation?.name ?? "" } : null,
    categoryKey: product.category?.key ?? null,
    isFeatured: product.isFeatured,
    stock: product.stock,
  };
}

export async function getFeaturedProducts(locale: AppLocale, take = 4): Promise<ProductSummary[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true, isFeatured: true },
    orderBy: { position: "asc" },
    take,
    include: {
      category: { select: { key: true } },
      images: { orderBy: { position: "asc" }, take: 1 },
      translations: { where: { locale } },
    },
  });

  return products.map(toSummary);
}

export async function getProducts(
  locale: AppLocale,
  options: { categoryKey?: string } = {},
): Promise<ProductSummary[]> {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(options.categoryKey ? { category: { key: options.categoryKey } } : {}),
    },
    orderBy: { position: "asc" },
    include: {
      category: { select: { key: true } },
      images: { orderBy: { position: "asc" }, take: 1 },
      translations: { where: { locale } },
    },
  });

  return products.map(toSummary);
}

export async function getProductBySlug(
  locale: AppLocale,
  slug: string,
): Promise<ProductDetail | null> {
  const translation = await prisma.productTranslation.findUnique({
    where: { locale_slug: { locale, slug } },
    include: {
      product: {
        include: {
          category: { include: { translations: { where: { locale } } } },
          images: { orderBy: { position: "asc" } },
          translations: true,
        },
      },
    },
  });

  if (!translation) return null;

  const { product } = translation;
  const category = product.category;
  const categoryTranslation = category?.translations[0];

  return {
    id: product.id,
    sku: product.sku,
    slug: translation.slug,
    name: translation.name,
    shortDescription: translation.shortDescription,
    description: translation.description,
    ingredients: translation.ingredients,
    allergens: translation.allergens,
    storageInformation: translation.storageInformation,
    seoTitle: translation.seoTitle,
    seoDescription: translation.seoDescription,
    priceCents: product.priceCents,
    image: product.images[0]
      ? { url: product.images[0].url, alt: product.images[0].alt ?? translation.name }
      : null,
    images: product.images.map((image) => ({
      url: image.url,
      alt: image.alt ?? translation.name,
    })),
    categoryKey: category?.key ?? null,
    categorySlug: categoryTranslation?.slug ?? null,
    categoryName: categoryTranslation?.name ?? null,
    isFeatured: product.isFeatured,
    stock: product.stock,
    weightGrams: product.weightGrams,
    translations: product.translations.map((t) => ({
      locale: t.locale as AppLocale,
      slug: t.slug,
    })),
  };
}

/**
 * Naive but effective multilingual search: matches the query against
 * the product name / short description in every locale's translation
 * rows, then returns results localized to the requesting locale. This
 * means an Arabic query returns products even if the visitor is
 * browsing the English or Portuguese storefront's search — and vice
 * versa — satisfying "search must understand products in all three
 * languages" without needing a dedicated search engine for a catalog of
 * this size.
 */
export async function searchProducts(
  locale: AppLocale,
  query: string,
): Promise<ProductSummary[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // SQLite's `contains` filter is case-sensitive, which would miss
  // matches like "Cheesecake" vs. a lowercase query. The catalog is
  // small, so matching case-insensitively in JS across every locale's
  // translations is simple and reliable — this is also what lets a
  // search in one locale surface a product whose match only occurs in
  // another locale's name/description (Arabic search finding a product
  // via its Portuguese or English name, and vice versa).
  const needle = trimmed.toLocaleLowerCase();
  const allTranslations = await prisma.productTranslation.findMany({
    select: { productId: true, name: true, shortDescription: true },
  });

  const ids = Array.from(
    new Set(
      allTranslations
        .filter(
          (t) =>
            t.name.toLocaleLowerCase().includes(needle) ||
            t.shortDescription.toLocaleLowerCase().includes(needle),
        )
        .map((t) => t.productId),
    ),
  );
  if (ids.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: ids }, isActive: true },
    include: {
      category: { select: { key: true } },
      images: { orderBy: { position: "asc" }, take: 1 },
      translations: { where: { locale } },
    },
  });

  return products.map(toSummary);
}

/**
 * Every active product with its slug in each locale, for the sitemap.
 *
 * Returning the per-locale slugs (rather than one canonical slug) is what
 * lets the sitemap declare correct hreflang alternates: the same product
 * lives at /produto/cheesecake-frutos-vermelhos in Portuguese and
 * /en/product/red-berry-cheesecake in English.
 */
export async function getProductSitemapEntries(): Promise<
  { slugByLocale: Partial<Record<AppLocale, string>>; updatedAt: Date }[]
> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { position: "asc" },
    select: {
      updatedAt: true,
      translations: { select: { locale: true, slug: true } },
    },
  });

  return products.map((product) => {
    const slugByLocale: Partial<Record<AppLocale, string>> = {};
    for (const translation of product.translations) {
      slugByLocale[translation.locale as AppLocale] = translation.slug;
    }
    return { slugByLocale, updatedAt: product.updatedAt };
  });
}
