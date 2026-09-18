"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { useAlternateLinks } from "@/lib/alternate-links";
import { useParams } from "next/navigation";
import clsx from "clsx";

const LOCALE_LABEL_KEY: Record<AppLocale, "pt" | "en" | "ar"> = {
  pt: "pt",
  en: "en",
  ar: "ar",
};

const LOCALE_FULL_LABEL_KEY: Record<AppLocale, "ptFull" | "enFull" | "arFull"> = {
  pt: "ptFull",
  en: "enFull",
  ar: "arFull",
};

/**
 * PT | EN | العربية — visible in the header and mobile menu.
 *
 * Deliberately text-based (no flags: Portuguese/English/Arabic aren't
 * tied to a single country, and flags are a poor, sometimes incorrect,
 * proxy for "language").
 *
 * When a page has published locale-specific alternate links (see
 * lib/alternate-links.tsx — used on product pages, where the slug
 * differs per language), those are used so switching language keeps the
 * visitor on the equivalent product/page instead of sending them home.
 * Otherwise, next-intl's `usePathname`/`useRouter` automatically
 * translate the current route's static segments (e.g. /loja -> /en/shop).
 */
export function LanguageSwitcher({ variant = "header" }: { variant?: "header" | "mobile" }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("LanguageSwitcher");
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const alternateLinks = useAlternateLinks();

  function switchTo(targetLocale: AppLocale) {
    // A page-published equivalent route for the target language (product
    // pages, whose slug is translated). This is an *internal* descriptor
    // — { pathname, params } — so next-intl applies the locale prefix and
    // updates the locale cookie exactly once.
    const explicit = alternateLinks[targetLocale];
    if (explicit) {
      router.push(
        { pathname: explicit.pathname, params: explicit.params } as never,
        { locale: targetLocale },
      );
      return;
    }

    // Fall back to translating the current pathname. `pathname` from
    // next-intl's usePathname() already returns the internal/canonical
    // route (e.g. "/product/[slug]"), so we re-supply the raw params for
    // the target locale's equivalent pathname to be resolved.
    const { locale: _locale, ...restParams } = params as Record<string, string>;
    router.push(
      { pathname, params: restParams } as never,
      { locale: targetLocale },
    );
  }

  return (
    <nav
      aria-label={t("label")}
      className={clsx(
        "flex items-center gap-1 text-sm font-medium",
        variant === "mobile" && "flex-wrap gap-2",
      )}
    >
      {routing.locales.map((loc, index) => {
        const isActive = loc === locale;
        return (
          <span key={loc} className="flex items-center">
            {index > 0 && (
              <span className="mx-1.5 text-line select-none" aria-hidden="true">
                |
              </span>
            )}
            <button
              type="button"
              onClick={() => switchTo(loc)}
              aria-current={isActive ? "true" : undefined}
              aria-label={t(LOCALE_FULL_LABEL_KEY[loc])}
              lang={loc === "pt" ? "pt-PT" : loc}
              className={clsx(
                "rounded-sm px-1.5 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                isActive
                  ? "text-cocoa font-semibold underline underline-offset-4"
                  : "text-cocoa-soft hover:text-cocoa",
              )}
            >
              {t(LOCALE_LABEL_KEY[loc])}
            </button>
          </span>
        );
      })}
      <span className="sr-only-focusable">
        {t("srCurrentLanguage", { language: t(LOCALE_FULL_LABEL_KEY[locale]) })}
      </span>
    </nav>
  );
}
