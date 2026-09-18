"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useCart } from "@/lib/cart-store";

export type HydratedCartLine = {
  productId: string;
  slug: string;
  name: string;
  priceCents: number;
  quantity: number;
  image: { url: string; alt: string } | null;
  isActive: boolean;
  stock: number | null;
  isAvailable: boolean;
};

/** Stable empty value so consumers don't see a new array each render. */
const EMPTY: HydratedCartLine[] = [];

/**
 * Fetches current, locale-correct product details for whatever is in
 * the (locale-independent) cart. Re-runs whenever the cart contents or
 * the active locale change, so switching language always refreshes the
 * displayed names/prices instead of leaving stale text on screen.
 */
export function useHydratedCart() {
  const { lines, isHydrated } = useCart();
  const locale = useLocale();

  const [fetched, setFetched] = useState<HydratedCartLine[]>(EMPTY);
  const [hasError, setHasError] = useState(false);

  // Bumped by `retry()` to re-run the effect after a failed request.
  const [attempt, setAttempt] = useState(0);

  // The (contents + locale) pair the `fetched` array above actually
  // describes. Tracking this rather than a plain boolean flag is what
  // makes `isReady` exact: there is no render in which we claim to be
  // ready while still holding results for a different cart or language.
  const requestKey = `${locale}:${JSON.stringify(lines)}`;
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);

  const isEmpty = lines.length === 0;

  useEffect(() => {
    // An empty cart needs no request — and needs no state update either,
    // since the empty result is derived below rather than stored.
    if (isEmpty) return;

    /*
      Stale responses are ignored via this flag rather than cancelled with
      an AbortController.

      Aborting looks tidier but rejects the in-flight fetch, and because
      Next.js instruments `fetch` that rejection escapes as an unhandled
      "signal is aborted without reason" error — which React's Strict Mode
      triggers on virtually every mount in development, since it
      deliberately runs each effect twice. The request here is a small
      JSON round-trip, so letting a superseded one finish and discarding
      its result costs nothing and keeps the failure path honest.
    */
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale, items: lines }),
        });

        const data = response.ok ? await response.json() : null;
        if (!active) return;

        if (!data) {
          setHasError(true);
          setResolvedKey(requestKey);
          return;
        }

        setFetched(data.lines ?? EMPTY);
        setHasError(false);
        setResolvedKey(requestKey);
      } catch {
        if (!active) return;
        // The cart genuinely holds items we couldn't describe. Flag it so
        // the UI can offer a retry instead of claiming the cart is empty.
        setHasError(true);
        setResolvedKey(requestKey);
      }
    }

    void load();

    return () => {
      active = false;
    };
    // `requestKey` already encodes both `locale` and `lines`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, isEmpty, attempt]);

  const retry = useCallback(() => {
    setHasError(false);
    setResolvedKey(null);
    setAttempt((value) => value + 1);
  }, []);

  // Derived rather than stored: an empty cart always has empty contents,
  // so there's no need to write that into state from an effect.
  const hydratedLines = isEmpty ? EMPTY : fetched;

  const subtotalCents = hydratedLines.reduce(
    (sum, line) => sum + line.priceCents * line.quantity,
    0,
  );

  /**
   * True once we know what the cart really contains: localStorage has
   * been read, and the server round-trip that resolves those ids into
   * locale-correct products has come back for the *current* cart. Until
   * then callers show a loading state rather than "your cart is empty",
   * which would otherwise flash on every page load.
   */
  const isReady = isHydrated && (isEmpty || resolvedKey === requestKey);

  return {
    lines: hydratedLines,
    isLoading: !isReady,
    isReady,
    /** The cart holds items, but their details could not be loaded. */
    hasError: hasError && !isEmpty,
    retry,
    subtotalCents,
  };
}
