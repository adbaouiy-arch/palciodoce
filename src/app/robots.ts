import type { MetadataRoute } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { absoluteUrl } from "@/lib/seo";

/**
 * robots.txt.
 *
 * Routes are disallowed in *every* locale, because the URL segments are
 * translated: blocking only `/checkout` would leave `/finalizar-compra`
 * crawlable. The paths are generated from the routing config rather than
 * hard-coded, so adding a locale or renaming a segment keeps robots.txt
 * correct automatically.
 *
 * These pages also send `noindex` headers. robots.txt stops the crawl;
 * `noindex` stops indexing if a URL is reached some other way. Both are
 * needed — a `Disallow`ed page can still be indexed from external links.
 */

const PRIVATE_ROUTES = [
  "/cart",
  "/checkout",
  "/track-order",
] as const;

export default function robots(): MetadataRoute.Robots {
  const localisedPrivatePaths = routing.locales.flatMap((locale) =>
    PRIVATE_ROUTES.map((href) => getPathname({ locale, href })),
  );

  // Order confirmation URLs carry an order number, so they're blocked by
  // prefix in each locale rather than enumerated.
  const confirmationPrefixes = routing.locales.map((locale) => {
    const sample = getPathname({
      locale,
      href: {
        pathname: "/order-confirmation/[orderNumber]",
        params: { orderNumber: "x" },
      },
    });
    // Drop the placeholder segment, keep the trailing slash as a prefix.
    return `${sample.slice(0, sample.lastIndexOf("/") + 1)}`;
  });

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api/",
          ...localisedPrivatePaths,
          ...confirmationPrefixes,
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
