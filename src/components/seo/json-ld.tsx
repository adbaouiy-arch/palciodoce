import { getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { BUSINESS, SOCIAL_PROFILE_URLS } from "@/lib/business";
import { absoluteUrl } from "@/lib/seo";
import type { ProductDetail } from "@/lib/data/products";

function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // Structured data is generated server-side from our own database,
      // never from user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * LocalBusiness / Bakery schema. Rendered in the language of the current
 * page (name, description) while the factual data — address, phone,
 * geo, currency — stays identical across locales.
 */
export async function LocalBusinessJsonLd({ locale }: { locale: AppLocale }) {
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Bakery",
        "@id": `${BUSINESS.siteUrl}/#business`,
        name: BUSINESS.name,
        description: t("defaultDescription"),
        url: absoluteUrl(getPathname({ locale, href: "/" })),
        telephone: BUSINESS.phoneE164,
        currenciesAccepted: BUSINESS.currency,
        priceRange: "€€",
        address: {
          "@type": "PostalAddress",
          streetAddress: BUSINESS.street,
          postalCode: BUSINESS.postalCode,
          addressLocality: BUSINESS.city,
          addressRegion: BUSINESS.region,
          addressCountry: BUSINESS.country,
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: BUSINESS.latitude,
          longitude: BUSINESS.longitude,
        },
        // Links every social profile to this business entity, which is how
        // search engines confirm the accounts and the shop are the same thing.
        sameAs: SOCIAL_PROFILE_URLS,
        areaServed: {
          "@type": "City",
          name: BUSINESS.city,
        },
      }}
    />
  );
}

/**
 * Product schema for a product detail page.
 *
 * Localized fields (name, description) follow the current language,
 * while the underlying product facts — SKU, price, currency,
 * availability, images — are identical in every locale, as required.
 */
export function ProductJsonLd({
  locale,
  product,
}: {
  locale: AppLocale;
  product: ProductDetail;
}) {
  const url = absoluteUrl(
    getPathname({
      locale,
      href: { pathname: "/product/[slug]", params: { slug: product.slug } },
    }),
  );

  const availability =
    product.stock === null || product.stock > 0
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock";

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.shortDescription,
        sku: product.sku,
        image: product.images.map((image) => absoluteUrl(image.url)),
        brand: {
          "@type": "Brand",
          name: BUSINESS.name,
        },
        ...(product.weightGrams
          ? {
              weight: {
                "@type": "QuantitativeValue",
                value: product.weightGrams,
                unitCode: "GRM",
              },
            }
          : {}),
        offers: {
          "@type": "Offer",
          url,
          priceCurrency: BUSINESS.currency,
          price: (product.priceCents / 100).toFixed(2),
          availability,
          itemCondition: "https://schema.org/NewCondition",
          seller: {
            "@type": "Organization",
            name: BUSINESS.name,
            "@id": `${BUSINESS.siteUrl}/#business`,
          },
        },
      }}
    />
  );
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      }}
    />
  );
}
