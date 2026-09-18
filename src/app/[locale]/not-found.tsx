import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * Localised 404 for anything inside the storefront.
 *
 * Because next-intl rewrites unmatched paths into the `[locale]` segment,
 * this handles both genuinely unknown URLs and explicit `notFound()` calls
 * (an unknown product slug, a missing legal page), and it renders inside
 * the normal shell so the visitor keeps the header, footer and language
 * switcher instead of landing on a dead end.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations("NotFound");

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <p className="font-heading text-6xl font-semibold text-gold" aria-hidden="true">
        404
      </p>
      <h1 className="mt-4 font-heading text-3xl font-semibold text-cocoa">
        {t("title")}
      </h1>
      <p className="mt-4 leading-relaxed text-cocoa-soft">{t("body")}</p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-cocoa px-7 py-3.5 text-base font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          {t("backHome")}
        </Link>
        <Link
          href="/shop"
          className="rounded-full border border-cocoa px-7 py-3.5 text-base font-semibold text-cocoa transition-colors hover:bg-cream-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          {t("goToShop")}
        </Link>
      </div>
    </div>
  );
}
