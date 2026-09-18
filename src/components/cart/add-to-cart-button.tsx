"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import clsx from "clsx";
import { useCart } from "@/lib/cart-store";

export function AddToCartButton({
  productId,
  quantity = 1,
  compact = false,
  disabled = false,
}: {
  productId: string;
  quantity?: number;
  compact?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("Common");
  const tProduct = useTranslations("Product");
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  function handleClick() {
    addItem(productId, quantity);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 2000);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={clsx(
          "rounded-full font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-50",
          compact
            ? "bg-cream-dark px-3.5 py-2 text-sm text-cocoa hover:bg-line"
            : "bg-cocoa px-6 py-3 text-base text-cream hover:bg-cocoa-soft",
        )}
      >
        {compact ? "+" : t("addToCart")}
        {compact && <span className="sr-only-focusable"> {t("addToCart")}</span>}
      </button>
      {/* Announced to screen readers when an item is added. */}
      <span role="status" aria-live="polite" className="sr-only-focusable">
        {justAdded ? tProduct("addedToCart") : ""}
      </span>
    </>
  );
}
