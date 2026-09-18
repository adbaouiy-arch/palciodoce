"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCart } from "@/lib/cart-store";
import { Link } from "@/i18n/navigation";

export function ProductPurchasePanel({
  productId,
  isOutOfStock,
}: {
  productId: string;
  isOutOfStock: boolean;
}) {
  const t = useTranslations("Product");
  const tCommon = useTranslations("Common");
  const tCart = useTranslations("Cart");
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  function handleAdd() {
    addItem(productId, quantity);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 3000);
  }

  if (isOutOfStock) {
    return (
      <p className="rounded-xl border border-berry/30 bg-berry/5 px-5 py-4 text-berry">
        {t("availabilityOutOfStock")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="quantity" className="text-sm font-medium text-cocoa">
          {t("quantityLabel")}
        </label>
        {/* Stepper: laid out with logical flex order so it mirrors
            correctly under dir="rtl" without extra rules. */}
        <div className="flex items-center rounded-full border border-line bg-paper">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label={tCart("updateQuantity")}
            className="px-4 py-2 text-lg text-cocoa transition-colors hover:bg-cream-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            −
          </button>
          <input
            id="quantity"
            type="number"
            min={1}
            max={50}
            value={quantity}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              setQuantity(Number.isNaN(next) ? 1 : Math.min(50, Math.max(1, next)));
            }}
            dir="ltr"
            className="w-14 border-0 bg-transparent text-center text-base font-semibold text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(50, q + 1))}
            aria-label={tCart("updateQuantity")}
            className="px-4 py-2 text-lg text-cocoa transition-colors hover:bg-cream-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-full bg-cocoa px-7 py-3.5 text-base font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          {tCommon("addToCart")}
        </button>
        <Link
          href="/cart"
          className="rounded-full border border-cocoa px-7 py-3.5 text-base font-semibold text-cocoa transition-colors hover:bg-cream-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          {tCart("checkoutCta")}
        </Link>
      </div>

      <p role="status" aria-live="polite" className="min-h-5 text-sm font-medium text-gold">
        {justAdded ? t("addedToCart") : ""}
      </p>
    </div>
  );
}
