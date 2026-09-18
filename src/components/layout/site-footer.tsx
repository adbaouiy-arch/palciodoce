import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCategories } from "@/lib/data/categories";
import type { AppLocale } from "@/i18n/routing";
import { BUSINESS } from "@/lib/business";

export async function SiteFooter() {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("Footer");
  const tNav = await getTranslations("Nav");
  const tContact = await getTranslations("Contact");
  const tDelivery = await getTranslations("DeliveryPickup");
  const categories = await getCategories(locale);
  const year = new Date().getFullYear();

  return (
    // Translucent so the animated background carries through to the bottom
    // of the page rather than stopping at an opaque slab.
    <footer className="mt-16 border-t border-line bg-paper/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-heading text-xl font-semibold text-cocoa">
            Palácio Doce
          </p>
          <p className="mt-3 text-sm leading-relaxed text-cocoa-soft">
            {t("tagline")}
          </p>
          <p className="mt-4 text-xs text-cocoa-soft">{t("madeIn")}</p>
        </div>

        <nav aria-labelledby="footer-quick-links">
          <h2
            id="footer-quick-links"
            className="text-sm font-semibold uppercase tracking-wide text-cocoa"
          >
            {t("quickLinksTitle")}
          </h2>
          <ul className="mt-4 flex flex-col gap-2 text-sm text-cocoa-soft">
            <li>
              <Link href="/shop" className="hover:text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
                {tNav("shop")}
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
                {tNav("about")}
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
                {tNav("contact")}
              </Link>
            </li>
            <li>
              <Link href="/delivery-pickup" className="hover:text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
                {tDelivery("title")}
              </Link>
            </li>
            <li>
              <Link href="/track-order" className="hover:text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
                {tNav("account")}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-labelledby="footer-categories">
          <h2
            id="footer-categories"
            className="text-sm font-semibold uppercase tracking-wide text-cocoa"
          >
            {t("categoriesTitle")}
          </h2>
          <ul className="mt-4 flex flex-col gap-2 text-sm text-cocoa-soft">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={{ pathname: "/category/[slug]", params: { slug: category.slug } }}
                  className="hover:text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-cocoa">
            {t("contactTitle")}
          </h2>
          <address className="mt-4 flex flex-col gap-2 text-sm not-italic text-cocoa-soft">
            <span>{tContact("address")}</span>
            <a
              href={`tel:${BUSINESS.phoneE164}`}
              dir="ltr"
              className="hover:text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {BUSINESS.phoneDisplay}
            </a>
            <a
              href={BUSINESS.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
              className="hover:text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {BUSINESS.instagramHandle}
            </a>
          </address>

          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-cocoa">
            {t("legalTitle")}
          </h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-cocoa-soft">
            <li>
              <Link href="/privacy" className="hover:text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
                {t("privacyPolicy")}
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
                {t("termsConditions")}
              </Link>
            </li>
            <li>
              <Link href="/cookies" className="hover:text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
                {t("cookiePolicy")}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line px-4 py-6 text-center text-xs text-cocoa-soft sm:px-6">
        © {year} Palácio Doce. {t("rightsReserved")}
      </div>
    </footer>
  );
}
