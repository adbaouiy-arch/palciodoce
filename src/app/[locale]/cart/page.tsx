import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { CartView } from "@/components/cart/cart-view";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Cart" });

  return {
    ...buildPageMetadata({
      locale: locale as AppLocale,
      href: "/cart",
      title: t("title"),
      description: t("summaryTitle"),
    }),
    robots: { index: false, follow: true },
  };
}

export default async function CartPage() {
  const t = await getTranslations("Cart");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-heading text-4xl font-semibold text-cocoa">
        {t("title")}
      </h1>
      <div className="mt-8">
        <CartView />
      </div>
    </div>
  );
}
