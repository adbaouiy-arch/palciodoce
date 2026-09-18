"use client";

import { useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const STORAGE_KEY = "palaciodoce_consent_v1";

type ConsentState = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

/**
 * Whether this visitor has already made a choice.
 *
 * Read through `useSyncExternalStore` rather than copied into state by an
 * effect: the server snapshot is `true` (decided) so the banner is absent
 * from the SSR markup, and the client snapshot reads the real value. That
 * avoids both a cascading re-render and a flash of the banner on visitors
 * who decided long ago.
 */
function hasStoredDecision(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    // Storage blocked: treat as undecided and ask again rather than
    // assuming consent.
    return false;
  }
}

const consentListeners = new Set<() => void>();

function subscribeToDecision(onStoreChange: () => void): () => void {
  consentListeners.add(onStoreChange);

  // Another tab recording a decision should dismiss the banner here too.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    consentListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * GDPR cookie consent. Nothing beyond strictly necessary cookies (the
 * locale preference and the cart) is set until the visitor makes an
 * explicit choice, and non-essential categories default to OFF — no
 * pre-ticked boxes, no "continuing implies consent".
 */
export function CookieConsentBanner() {
  const t = useTranslations("Cookies");
  const locale = useLocale();

  const hasDecided = useSyncExternalStore(
    subscribeToDecision,
    hasStoredDecision,
    () => true,
  );

  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  function persist(state: ConsentState) {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...state, decidedAt: new Date().toISOString() }),
      );
    } catch {
      // If storage is unavailable we simply re-ask next visit rather
      // than assuming consent.
    }

    /*
      Record the decision server-side as the GDPR accountability trail
      (Art. 7(1)): localStorage alone cannot evidence that consent was
      given. This is fire-and-forget on purpose — localStorage governs
      what the site actually does, so a failed or blocked request must
      never leave the banner stuck on screen or block the visitor.
    */
    void fetch("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, ...state }),
      keepalive: true,
    }).catch(() => {
      // Network failures are non-fatal; the visitor's choice still applies.
    });

    // Notify the store so the banner re-reads localStorage and hides.
    for (const listener of consentListeners) listener();
  }

  if (hasDecided) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-paper/98 backdrop-blur"
    >
      <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
        <h2
          id="cookie-consent-title"
          className="font-heading text-lg font-semibold text-cocoa"
        >
          {t("bannerTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-cocoa-soft">
          {t("bannerBody")}
        </p>

        {showDetails && (
          <fieldset className="mt-4 flex flex-col gap-3 rounded-lg border border-line bg-cream/60 p-4">
            <legend className="px-1 text-sm font-semibold text-cocoa">
              {t("customizeTitle")}
            </legend>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked
                disabled
                className="mt-0.5 h-4 w-4 accent-cocoa"
              />
              <span>
                <span className="font-medium text-cocoa">{t("necessaryTitle")}</span>
                <span className="block text-cocoa-soft">{t("necessaryBody")}</span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(event) => setAnalytics(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-cocoa"
              />
              <span>
                <span className="font-medium text-cocoa">{t("analyticsTitle")}</span>
                <span className="block text-cocoa-soft">{t("analyticsBody")}</span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(event) => setMarketing(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-cocoa"
              />
              <span>
                <span className="font-medium text-cocoa">{t("marketingTitle")}</span>
                <span className="block text-cocoa-soft">{t("marketingBody")}</span>
              </span>
            </label>
          </fieldset>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => persist({ necessary: true, analytics: true, marketing: true })}
            className="rounded-full bg-cocoa px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {t("acceptAll")}
          </button>

          {showDetails ? (
            <button
              type="button"
              onClick={() => persist({ necessary: true, analytics, marketing })}
              className="rounded-full border border-cocoa px-5 py-2.5 text-sm font-semibold text-cocoa transition-colors hover:bg-cream-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {t("savePreferences")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="rounded-full border border-cocoa px-5 py-2.5 text-sm font-semibold text-cocoa transition-colors hover:bg-cream-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {t("customize")}
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              persist({ necessary: true, analytics: false, marketing: false })
            }
            className="rounded-full px-4 py-2.5 text-sm font-medium text-cocoa-soft underline underline-offset-4 transition-colors hover:text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {t("rejectNonEssential")}
          </button>

          <Link
            href="/cookies"
            className="ms-auto text-sm text-cocoa-soft underline underline-offset-4 hover:text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {t("customizeTitle")}
          </Link>
        </div>
      </div>
    </div>
  );
}
