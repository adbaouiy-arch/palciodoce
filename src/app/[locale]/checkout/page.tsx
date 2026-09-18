import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Checkout" });

  return {
    ...buildPageMetadata({
      locale: locale as AppLocale,
      href: "/checkout",
      title: t("title"),
      description: t("orderSummary"),
    }),
    // Checkout is a transactional step with nothing to index, and keeping
    // it out of search results avoids customers landing mid-flow.
    robots: { index: false, follow: true },
  };
}

export default async function CheckoutPage() {
  const t = await getTranslations("Checkout");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-heading text-4xl font-semibold text-cocoa">
        {t("title")}
      </h1>
      <div className="mt-8">
        <CheckoutForm />
      </div>
    </div>
  );
}
