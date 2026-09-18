import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCategories } from "@/lib/data/categories";
import type { AppLocale } from "@/i18n/routing";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { CartIndicator } from "@/components/cart/cart-indicator";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { SearchForm } from "@/components/layout/search-form";

export async function SiteHeader() {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("Nav");
  const categories = await getCategories(locale);

  const primaryLinks = [
    { href: "/" as const, label: t("home") },
    { href: "/shop" as const, label: t("shop") },
    ...categories.map((category) => ({
      href: { pathname: "/category/[slug]" as const, params: { slug: category.slug } },
      label: category.name,
    })),
    { href: "/about" as const, label: t("about") },
    { href: "/contact" as const, label: t("contact") },
  ];

  return (
    <header className="border-b border-line bg-paper/95 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="font-heading text-xl font-semibold tracking-tight text-cocoa sm:text-2xl">
            Palácio Doce
          </span>
        </Link>

        <nav
          aria-label={t("shop")}
          className="hidden items-center gap-6 text-sm font-medium text-cocoa-soft lg:flex"
        >
          {primaryLinks.map((link) => (
            <Link
              key={typeof link.href === "string" ? link.href : link.href.params.slug}
              href={link.href}
              className="transition-colors hover:text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden sm:block">
            <SearchForm compact />
          </div>
          <div className="hidden lg:block">
            <LanguageSwitcher />
          </div>
          <CartIndicator />
          <MobileMenu categories={categories} />
        </div>
      </div>
    </header>
  );
}
