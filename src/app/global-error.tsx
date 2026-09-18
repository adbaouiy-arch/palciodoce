"use client";

import { useEffect } from "react";
import clsx from "clsx";
import { playfairDisplay, inter } from "@/lib/fonts";
import "./globals.css";

/**
 * Last-resort error boundary, used when a root layout itself fails to
 * render. At that point no layout is available, so this component has to
 * supply its own <html> and <body>.
 *
 * Portuguese, because a failure this deep means there is no reliable
 * locale context to read.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Fatal error:", error);
  }, [error]);

  return (
    <html
      lang="pt-PT"
      className={clsx(playfairDisplay.variable, inter.variable, "h-full antialiased")}
    >
      <body className="flex min-h-full items-center justify-center bg-cream text-cocoa">
        <main className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
          <h1 className="font-heading text-3xl font-semibold text-cocoa">
            Ocorreu um erro
          </h1>
          <p className="mt-4 leading-relaxed text-cocoa-soft">
            Não foi possível carregar a página. Tente novamente.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-8 rounded-full bg-cocoa px-7 py-3.5 text-base font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Tentar novamente
          </button>
          {error.digest && (
            <p className="mt-6 text-xs text-cocoa-soft" dir="ltr">
              {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
