import Link from "next/link";

/**
 * 404 within the admin area. Portuguese-only and outside the i18n
 * routing, matching the rest of /admin. It renders inside the admin root
 * layout, so it inherits that <html> shell.
 */
export default function AdminNotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <p className="font-heading text-6xl font-semibold text-gold" aria-hidden="true">
        404
      </p>
      <h1 className="mt-4 font-heading text-3xl font-semibold text-cocoa">
        Página não encontrada
      </h1>
      <p className="mt-4 leading-relaxed text-cocoa-soft">
        Esta página da área de gestão não existe.
      </p>
      <Link
        href="/admin"
        className="mt-8 rounded-full bg-cocoa px-7 py-3.5 text-base font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        Voltar ao Resumo
      </Link>
    </main>
  );
}
