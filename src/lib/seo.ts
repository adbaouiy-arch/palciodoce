import type { Metadata } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { BUSINESS } from "@/lib/business";

/**
 * hreflang codes advertised to search engines. Portuguese is regionally
 * qualified (pt-PT — European Portuguese, not pt-BR) since that's the
 * actual market; English and Arabic stay generic because the audience
 * isn't tied to one country.
 */
export const HREFLANG: Record<AppLocale, string> = {
  pt: "pt-PT",
  en: "en",
  ar: "ar",
};

/** OpenGraph locale codes. */
export const OG_LOCALE: Record<AppLocale, string> = {
  pt: "pt_PT",
  en: "en_GB",
  ar: "ar_AR",
};

type HrefArg = Parameters<typeof getPathname>[0]["href"];

export function absoluteUrl(pathname: string): string {
  return `${BUSINESS.siteUrl}${pathname === "/" ? "" : pathname}`;
}

/**
 * Builds canonical + hreflang alternates for a route.
 *
 * Every translated page gets its OWN canonical pointing at itself — the
 * English and Arabic pages are never canonicalized back to Portuguese,
 * so all three are independently indexable. `x-default` points at the
 * Portuguese version, which is the site's primary language.
 *
 * `perLocaleHref` lets callers override the href per locale, which is
 * required for product pages where the slug itself is translated
 * (e.g. pt: /produto/cheesecake-frutos-vermelhos vs
 * en: /en/product/red-berry-cheesecake).
 */
export function buildAlternates({
  locale,
  href,
  perLocaleHref,
}: {
  locale: AppLocale;
  href: HrefArg;
  perLocaleHref?: Partial<Record<AppLocale, HrefArg>>;
}): NonNullable<Metadata["alternates"]> {
  function pathnameFor(target: AppLocale): string {
    const targetHref = perLocaleHref?.[target] ?? href;
    return getPathname({ locale: target, href: targetHref });
  }

  const languages: Record<string, string> = {};
  for (const target of routing.locales) {
    languages[HREFLANG[target]] = absoluteUrl(pathnameFor(target));
  }
  languages["x-default"] = absoluteUrl(pathnameFor(routing.defaultLocale));

  return {
    canonical: absoluteUrl(pathnameFor(locale)),
    languages,
  };
}

/**
 * Convenience wrapper producing the full metadata block most pages
 * need: title, description, canonical + hreflang, and OpenGraph.
 */
export function buildPageMetadata({
  locale,
  href,
  perLocaleHref,
  title,
  description,
  images,
  type = "website",
}: {
  locale: AppLocale;
  href: HrefArg;
  perLocaleHref?: Partial<Record<AppLocale, HrefArg>>;
  title: string;
  description: string;
  images?: string[];
  type?: "website" | "article";
}): Metadata {
  const alternates = buildAlternates({ locale, href, perLocaleHref });
  const canonical = alternates.canonical as string;

  return {
    title,
    description,
    alternates,
    openGraph: {
      type,
      siteName: BUSINESS.name,
      title,
      description,
      url: canonical,
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales
        .filter((l) => l !== locale)
        .map((l) => OG_LOCALE[l]),
      images: images?.map((url) => ({
        url: url.startsWith("http") ? url : absoluteUrl(url),
      })),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images?.map((url) => (url.startsWith("http") ? url : absoluteUrl(url))),
    },
  };
}
