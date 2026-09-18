"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/lib/cart-store";

export function CartIndicator() {
  const t = useTranslations("Nav");
  const { itemCount } = useCart();

  return (
    <Link
      href="/cart"
      className="relative flex items-center gap-2 rounded-full border border-line px-3 py-2 text-sm font-medium text-cocoa transition-colors hover:bg-cream-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      {/* Bag icon — symmetrical, so it carries no directional meaning
          that would need mirroring in RTL. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="h-5 w-5"
      >
        <path d="M6 8h12l-1 12H7L6 8Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" strokeLinecap="round" />
      </svg>
      <span className="hidden sm:inline">{t("cart")}</span>
      {itemCount > 0 && (
        <span
          className="absolute -top-1.5 -end-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-berry px-1 text-xs font-semibold text-white"
          aria-hidden="true"
        >
          {itemCount}
        </span>
      )}
      <span className="sr-only-focusable">{itemCount}</span>
    </Link>
  );
}
