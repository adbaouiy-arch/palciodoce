import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { AppLocale } from "@/i18n/routing";
import { ContentPage } from "@/components/content-page";
import { getPage } from "@/lib/data/pages";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as AppLocale;
  const page = await getPage(locale, "privacy");
  if (!page) return {};

  return buildPageMetadata({
    locale,
    href: "/privacy",
    title: page.seoTitle,
    description: page.seoDescription,
  });
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as AppLocale;

  const page = await getPage(locale, "privacy");
  if (!page) {
    notFound();
  }

  return <ContentPage page={page} locale={locale} />;
}
