"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { AppLocale } from "@/i18n/routing";

/**
 * Lets a specific page (e.g. a product detail page) tell the header's
 * language switcher exactly which route is the equivalent of the current
 * page in each locale — crucial for requirements like "switching
 * language on /produto/cheesecake-frutos-vermelhos should go to the
 * matching English/Arabic product page", where the slug itself differs
 * per locale and can't be derived from the URL alone.
 *
 * Pages that don't need this (most pages, since their pathname is
 * already fully described by next-intl's `pathnames` config) simply
 * don't use it, and the language switcher falls back to translating
 * the current pathname automatically.
 */

/**
 * An *internal* route descriptor — the canonical pathname plus its params,
 * e.g. `{ pathname: "/product/[slug]", params: { slug: "red-berry-cheesecake" } }`.
 *
 * Deliberately NOT a resolved URL. The language switcher hands this to
 * next-intl's router, which adds the locale prefix and updates the locale
 * cookie. Publishing an already-prefixed path such as
 * "/en/product/red-berry-cheesecake" would get prefixed a second time and
 * navigate to "/en/en/product/red-berry-cheesecake".
 */
export type AlternateHref = {
  pathname: string;
  params?: Record<string, string>;
};

type AlternateLinksMap = Partial<Record<AppLocale, AlternateHref>>;

const AlternateLinksContext = createContext<{
  links: AlternateLinksMap;
  setLinks: (links: AlternateLinksMap) => void;
} | null>(null);

export function AlternateLinksProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [links, setLinksState] = useState<AlternateLinksMap>({});

  const setLinks = useCallback((next: AlternateLinksMap) => {
    setLinksState(next);
  }, []);

  return (
    <AlternateLinksContext.Provider value={{ links, setLinks }}>
      {children}
    </AlternateLinksContext.Provider>
  );
}

export function useAlternateLinks() {
  const ctx = useContext(AlternateLinksContext);
  if (!ctx) {
    throw new Error(
      "useAlternateLinks must be used within an AlternateLinksProvider",
    );
  }
  return ctx.links;
}

/**
 * Render this (with no visual output) from any page that has
 * locale-specific pathnames the generic translator can't infer, most
 * notably product detail pages. Example:
 *
 *   <PublishAlternateLinks
 *     links={{
 *       pt: { pathname: "/product/[slug]", params: { slug: "cheesecake-frutos-vermelhos" } },
 *       en: { pathname: "/product/[slug]", params: { slug: "red-berry-cheesecake" } },
 *     }}
 *   />
 */
export function PublishAlternateLinks({
  links,
}: {
  links: AlternateLinksMap;
}) {
  const ctx = useContext(AlternateLinksContext);
  const serialized = JSON.stringify(links);

  useEffect(() => {
    ctx?.setLinks(links);
    // Reset when the page unmounts so the next page doesn't inherit stale links.
    return () => ctx?.setLinks({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);

  return null;
}
