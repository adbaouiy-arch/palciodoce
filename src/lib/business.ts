/**
 * Single source of truth for Palácio Doce's business details, used in
 * the footer, contact page, structured data (LocalBusiness / Product),
 * and order confirmations.
 */
export const BUSINESS = {
  name: "Palácio Doce",
  legalName: "Palácio Doce",
  domain: "palaciodoce.pt",
  siteUrl: "https://palaciodoce.pt",

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

  instagramHandle: "@palaciodoce",
  instagramUrl: "https://www.instagram.com/palaciodoce/",

  currency: "EUR",
  currencySymbol: "€",

  /** Flat delivery fee within the Braga area, in cents. */
  deliveryFeeCents: 350,
  /** Order subtotal (cents) above which delivery is free. */
  freeDeliveryThresholdCents: 3500,
} as const;

export const BUSINESS_ADDRESS_ONE_LINE = `${BUSINESS.street}, ${BUSINESS.postalCode} ${BUSINESS.city}, ${BUSINESS.countryName}`;
