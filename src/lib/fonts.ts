import { Playfair_Display, Inter, El_Messiri, Noto_Sans_Arabic } from "next/font/google";

/**
 * Font system for Palácio Doce.
 *
 * Latin (pt / en): Playfair Display for headings (an elegant, editorial
 * serif that suits a pastry brand) paired with Inter for body copy
 * (excellent legibility at small sizes, wide language coverage).
 *
 * Arabic (ar): El Messiri for headings — a warm, intentionally-designed
 * Arabic display face with real character, not a fallback — paired with
 * Noto Sans Arabic for body copy, chosen for its readability across
 * sizes and devices.
 *
 * Only the fonts needed for the *current* request are ever loaded: the
 * root layout picks the right font pair for the active locale and sets
 * CSS variables accordingly, so Arabic visitors never pay the cost of
 * downloading Playfair Display / Inter and vice versa. All fonts use
 * `display: swap` and are self-hosted by Next.js at build time (no
 * runtime request to Google Fonts), protecting Core Web Vitals (CLS/LCP).
 */

// `preload: false` on every font: the root layout only applies the CSS
// variable classNames for the *active* locale's font pair to <html>, and
// browsers only fetch a @font-face file once it's actually needed to
// paint matching text. This guarantees pt/en visitors never fetch Arabic
// fonts and vice versa, without needing conditional module loading.

export const playfairDisplay = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-heading-latin",
  display: "swap",
  preload: false,
});

export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body-latin",
  display: "swap",
  preload: false,
});

export const elMessiri = El_Messiri({
  subsets: ["arabic"],
  weight: ["500", "600", "700"],
  variable: "--font-heading-arabic",
  display: "swap",
  preload: false,
});

export const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body-arabic",
  display: "swap",
  preload: false,
});
