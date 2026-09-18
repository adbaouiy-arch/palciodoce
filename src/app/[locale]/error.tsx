"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

/**
 * Error boundary for the storefront.
 *
 * Shows a localised, on-brand recovery screen instead of Next.js' default
 * error page, and deliberately never renders `error.message` — server
 * error messages can contain internal detail (query fragments, file
 * paths) that shouldn't be shown to visitors. The digest is surfaced
 * because it's the reference needed to find the matching server log.
 */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Common");

  useEffect(() => {
    // Real reporting (Sentry et al.) would hook in here.
    console.error("Storefront error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <h1 className="font-heading text-3xl font-semibold text-cocoa">
        {t("error")}
      </h1>
      <p className="mt-4 leading-relaxed text-cocoa-soft">{t("tryAgain")}</p>

      <button
        type="button"
        onClick={reset}
        className="mt-8 rounded-full bg-cocoa px-7 py-3.5 text-base font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        {t("tryAgain")}
      </button>

      {error.digest && (
        <p className="mt-6 text-xs text-cocoa-soft" dir="ltr">
          {error.digest}
        </p>
      )}
    </div>
  );
}
