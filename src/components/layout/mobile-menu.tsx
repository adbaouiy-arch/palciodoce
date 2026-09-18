"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { SearchForm } from "@/components/layout/search-form";
import type { CategorySummary } from "@/lib/data/categories";

export function MobileMenu({ categories }: { categories: CategorySummary[] }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  /*
    The menu records the route it was opened on, and is considered open
    only while that still matches the current route. Navigating therefore
    closes it automatically, without an effect that sets state on every
    pathname change (which would cost an extra render on every
    navigation, menu open or not).
  */
  const [openedOnPathname, setOpenedOnPathname] = useState<string | null>(null);
  const isOpen = openedOnPathname === pathname;

  const openMenu = () => setOpenedOnPathname(pathname);
  const closeMenu = () => setOpenedOnPathname(null);

  // Prevent background scroll while the menu is open.
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenedOnPathname(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={openMenu}
        aria-label={t("openMenu")}
        aria-expanded={isOpen}
        aria-controls="mobile-menu-panel"
        className="flex items-center justify-center rounded-full border border-line p-2 text-cocoa transition-colors hover:bg-cream-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-5 w-5"
        >
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-paper">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-heading text-xl font-semibold text-cocoa">
              Palácio Doce
            </span>
            <button
              type="button"
              onClick={closeMenu}
              aria-label={t("closeMenu")}
              className="rounded-full border border-line p-2 text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
              >
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div
            id="mobile-menu-panel"
            className="flex-1 overflow-y-auto px-4 py-6"
          >
            <div className="mb-6">
              <SearchForm />
            </div>

            <nav aria-label={t("shop")}>
              <ul className="flex flex-col gap-1 text-lg">
                <li>
                  <Link
                    href="/"
                    className="block rounded-md px-3 py-2.5 font-medium text-cocoa hover:bg-cream-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  >
                    {t("home")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/shop"
                    className="block rounded-md px-3 py-2.5 font-medium text-cocoa hover:bg-cream-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  >
                    {t("shop")}
                  </Link>
                </li>
                {categories.map((category) => (
                  <li key={category.id}>
                    <Link
                      href={{
                        pathname: "/category/[slug]",
                        params: { slug: category.slug },
                      }}
                      className="block rounded-md px-3 py-2.5 text-cocoa-soft hover:bg-cream-dark hover:text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                    >
                      {category.name}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/about"
                    className="block rounded-md px-3 py-2.5 font-medium text-cocoa hover:bg-cream-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  >
                    {t("about")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="block rounded-md px-3 py-2.5 font-medium text-cocoa hover:bg-cream-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  >
                    {t("contact")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/track-order"
                    className="block rounded-md px-3 py-2.5 text-cocoa-soft hover:bg-cream-dark hover:text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  >
                    {t("account")}
                  </Link>
                </li>
              </ul>
            </nav>

            <div className="mt-8 border-t border-line pt-6">
              <LanguageSwitcher variant="mobile" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
