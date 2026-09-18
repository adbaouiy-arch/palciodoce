"use client";

import { CartProvider } from "@/lib/cart-store";
import { AlternateLinksProvider } from "@/lib/alternate-links";

/**
 * Client-side providers that need to wrap the whole app. Kept in one
 * client component so the root layout itself stays a Server Component
 * (translations continue to be server-rendered for SEO).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AlternateLinksProvider>
      <CartProvider>{children}</CartProvider>
    </AlternateLinksProvider>
  );
}
