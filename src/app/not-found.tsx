import Link from "next/link";
import clsx from "clsx";
import { playfairDisplay, inter } from "@/lib/fonts";
import "./globals.css";

/**
 * Last-resort 404, for requests that never reach either root layout.
 *
 * The i18n proxy rewrites ordinary unmatched paths into the `[locale]`
 * segment (handled by `[locale]/not-found.tsx`) and /admin has its own,
 * but paths the proxy skips — anything containing a dot, e.g.
 * `/missing.txt` — land here with no layout at all. That's why this file
 * renders its own <html>: the project has no root layout, since
 * `[locale]/layout.tsx` and `admin/layout.tsx` are separate roots.
 *
 * Portuguese, the site's primary language, since there is no locale
 * context to read at this point.
 */
export default function RootNotFound() {
  return (
    <html
      lang="pt-PT"
      className={clsx(playfairDisplay.variable, inter.variable, "h-full antialiased")}
    >
      <body className="flex min-h-full items-center justify-center bg-cream text-cocoa">
        <main className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
          <p
            className="font-heading text-6xl font-semibold text-gold"
            aria-hidden="true"
          >
            404
          </p>
          <h1 className="mt-4 font-heading text-3xl font-semibold text-cocoa">
            Página não encontrada
          </h1>
          <p className="mt-4 leading-relaxed text-cocoa-soft">
            A página que procura não existe ou foi movida.
          </p>
          <Link
            href="/"
            className="mt-8 inline-block rounded-full bg-cocoa px-7 py-3.5 text-base font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Voltar ao Início
          </Link>
        </main>
      </body>
    </html>
  );
}
