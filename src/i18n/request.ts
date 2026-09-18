import * as rootParams from "next/root-params";
import { notFound } from "next/navigation";
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";

/**
 * Resolves the active locale and loads its messages.
 *
 * The locale is validated on *every* path through this function, not just
 * when next-intl leaves it undefined. That matters because the i18n proxy
 * deliberately skips requests containing a dot (see the matcher in
 * src/proxy.ts, which excludes static files), yet such a URL can still
 * match the `[locale]` segment — `/missing.txt` arrives here with
 * `locale = "missing.txt"`. Without this check that value reached the
 * dynamic import below and threw MODULE_NOT_FOUND, surfacing as a 500
 * where the correct answer is a 404.
 *
 * Validating here rather than in the layout covers `generateMetadata` too,
 * which runs independently of the layout component and so is not
 * protected by the `hasLocale` guard there.
 */
export default getRequestConfig(async ({ locale }) => {
  let resolved = locale;

  if (!resolved) {
    resolved = await rootParams.locale();
  }

  if (!hasLocale(routing.locales, resolved)) {
    notFound();
  }

  return {
    locale: resolved,
    messages: (await import(`../../messages/${resolved}.json`)).default,
  };
});
