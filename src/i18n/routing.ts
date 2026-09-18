import { defineRouting } from "next-intl/routing";

/**
 * Central i18n routing configuration for Palácio Doce.
 *
 * - Portuguese (pt) is the default locale and has NO url prefix
 *   (e.g. /loja, /produto/cheesecake-frutos-vermelhos).
 * - English and Arabic are prefixed (/en/..., /ar/...).
 * - `pathnames` lets every locale use its own, natural url segment
 *   for a given route while all three share the same route file
 *   internally (e.g. app/[locale]/(shop)/shop/page.tsx).
 * - Adding a future locale (fr, es, ...) only means adding it to
 *   `locales` and, if desired, adding entries to `pathnames` — no
 *   restructuring required.
 */
export const routing = defineRouting({
  locales: ["pt", "en", "ar"],
  defaultLocale: "pt",

  localePrefix: {
    mode: "as-needed",
  },

  localeCookie: {
    name: "PALACIODOCE_LOCALE",
    maxAge: 60 * 60 * 24 * 365, // 1 year — "remember the customer's selected language"
    sameSite: "lax",
    path: "/",
  },

  pathnames: {
    "/": "/",

    "/shop": {
      pt: "/loja",
    },
    "/category/[slug]": {
      pt: "/categoria/[slug]",
    },
    "/product/[slug]": {
      pt: "/produto/[slug]",
    },
    "/search": {
      pt: "/pesquisa",
    },

    "/cart": {
      pt: "/carrinho",
    },
    "/checkout": {
      pt: "/finalizar-compra",
    },
    "/order-confirmation/[orderNumber]": {
      pt: "/confirmacao/[orderNumber]",
    },
    "/track-order": {
      pt: "/rastrear-pedido",
    },

    "/about": {
      pt: "/sobre-nos",
    },
    "/contact": {
      pt: "/contactos",
    },
    "/delivery-pickup": {
      pt: "/entrega-e-recolha",
    },
    "/privacy": {
      pt: "/privacidade",
    },
    "/terms": {
      pt: "/termos",
    },
    "/cookies": {
      pt: "/politica-de-cookies",
    },
  },
});

export type AppLocale = (typeof routing.locales)[number];
