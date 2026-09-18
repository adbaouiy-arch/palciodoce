import type { Metadata } from "next";
import clsx from "clsx";
import { playfairDisplay, inter } from "@/lib/fonts";
import "../globals.css";

/**
 * Root layout for the admin area.
 *
 * The admin dashboard lives outside the `[locale]` segment — it is
 * excluded from the i18n proxy matcher (see src/proxy.ts) and is
 * Portuguese-only, for the shop's own team. That means it needs its own
 * <html> element and only loads the Latin font pair.
 *
 * Note this layout deliberately does *not* perform the auth check: the
 * login page renders inside it too. Each protected page and every
 * mutating action calls `requireAdmin()` itself, so authorisation sits
 * next to the data access rather than in a shared wrapper that is easy to
 * accidentally bypass.
 */
export const metadata: Metadata = {
  title: "Gestão | Palácio Doce",
  // The admin area must never appear in search results.
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-PT"
      dir="ltr"
      className={clsx(
        playfairDisplay.variable,
        inter.variable,
        "h-full antialiased",
      )}
    >
      <body className="min-h-full bg-cream text-cocoa">{children}</body>
    </html>
  );
}
