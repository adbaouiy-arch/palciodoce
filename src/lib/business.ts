/**
 * Single source of truth for Palácio Doce's business details, used in
 * the footer, contact page, structured data (LocalBusiness / Product),
 * and order confirmations.
 */
/**
 * The origin this deployment is served from.
 *
 * Overridable because canonical URLs, hreflang alternates, the sitemap and the
 * structured data all derive from it. On a preview deployment or before the real
 * domain is attached, a hardcoded value would tell search engines that content
 * served from somewhere else is the canonical copy of palaciodoce.pt.
 *
 * `NEXT_PUBLIC_` because `business.ts` is also imported by client components.
 * `siteUrl` is only read on the server today, but a bare `process.env` lookup in
 * a shared module reads as `undefined` in the browser bundle, which would fail
 * silently the first time someone used it in a client component.
 *
 * Trailing slash stripped: every caller concatenates a path onto this.
 */
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://palaciodoce.pt"
).replace(/\/+$/, "");

export const BUSINESS = {
  name: "Palácio Doce",
  legalName: "Palácio Doce",
  domain: "palaciodoce.pt",
  siteUrl: SITE_URL,

  street: "R. de Santa Margarida 13",
  postalCode: "4710-311",
  city: "Braga",
  region: "Braga",
  country: "PT",
  countryName: "Portugal",

  // Braga city centre — used for LocalBusiness geo coordinates.
  latitude: 41.5503,
  longitude: -8.4201,

  phoneDisplay: "+351 929 311 701",
  phoneE164: "+351929311701",

  instagramHandle: "@palaciodoce.pt",
  instagramUrl: "https://www.instagram.com/palaciodoce.pt/",
  tiktokHandle: "@palaciodoce.pt",
  tiktokUrl: "https://www.tiktok.com/@palaciodoce.pt",

  currency: "EUR",
  currencySymbol: "€",

  /** Flat delivery fee within the Braga area, in cents. */
  deliveryFeeCents: 350,
  /** Order subtotal (cents) above which delivery is free. */
  freeDeliveryThresholdCents: 3500,
} as const;

export const BUSINESS_ADDRESS_ONE_LINE = `${BUSINESS.street}, ${BUSINESS.postalCode} ${BUSINESS.city}, ${BUSINESS.countryName}`;

/**
 * The shop's social profiles, in one list.
 *
 * Handles are facts, not copy, so they live here rather than in the
 * translation catalogues — they were previously duplicated across
 * `business.ts` and all three `messages/*.json`, which is precisely how the
 * Instagram handle came to be wrong in some places and right in others.
 *
 * Platform names are intentionally not translated: "Instagram" and
 * "TikTok" are proper nouns and stay as-is in every language.
 *
 * Consumed by the footer, the contact page, the landing page and the
 * `sameAs` array in the LocalBusiness structured data — so adding a
 * network is a single entry here.
 */
export const SOCIAL_PROFILES = [
  {
    name: "Instagram",
    handle: BUSINESS.instagramHandle,
    url: BUSINESS.instagramUrl,
  },
  {
    name: "TikTok",
    handle: BUSINESS.tiktokHandle,
    url: BUSINESS.tiktokUrl,
  },
] as const;

/** Profile URLs for structured data (`sameAs`). */
export const SOCIAL_PROFILE_URLS = SOCIAL_PROFILES.map(
  (profile) => profile.url,
);
