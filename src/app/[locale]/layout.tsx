import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import clsx from "clsx";
import { routing } from "@/i18n/routing";
import {
  playfairDisplay,
  inter,
  elMessiri,
  notoSansArabic,
} from "@/lib/fonts";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { AnimatedBackground } from "@/components/layout/animated-background";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { Providers } from "@/components/providers";
import { BUSINESS } from "@/lib/business";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: {
      default: t("defaultTitle"),
      template: `%s | ${t("siteName")}`,
    },
    description: t("defaultDescription"),
    metadataBase: new URL(BUSINESS.siteUrl),
  };
}

const RTL_LOCALES = new Set(["ar"]);

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";
  const tNav = await getTranslations({ locale, namespace: "Nav" });

  return (
    <html
      lang={locale === "pt" ? "pt-PT" : locale}
      dir={dir}
      // Opts out of smooth scrolling for route transitions while keeping it
      // for in-page anchors (Next.js reads this attribute).
      data-scroll-behavior="smooth"
      className={clsx(
        playfairDisplay.variable,
        inter.variable,
        elMessiri.variable,
        notoSansArabic.variable,
        "h-full antialiased",
      )}
    >
      {/* `bg-transparent`, not `bg-cream`: the fixed background layer below
          sits at a negative z-index and an opaque body would hide it. */}
      <body className="min-h-full flex flex-col bg-transparent text-cocoa">
        <AnimatedBackground />
        <NextIntlClientProvider>
          <Providers>
            <a
              href="#main-content"
              className="sr-only-focusable fixed top-2 start-2 z-50 rounded-md bg-cocoa px-4 py-2 text-sm font-medium text-cream focus:outline-2 focus:outline-offset-2 focus:outline-gold"
            >
              {tNav("skipToContent")}
            </a>
            <SiteHeader />
            <main id="main-content" className="flex-1">
              {children}
            </main>
            <SiteFooter />
            <CookieConsentBanner />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
