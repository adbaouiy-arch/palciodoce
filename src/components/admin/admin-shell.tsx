import Link from "next/link";
import type { AdminSession } from "@/lib/admin-auth";
import { logoutAction } from "@/app/admin/actions";

/**
 * Chrome for the signed-in admin area: brand, navigation, current user
 * and sign-out.
 *
 * Uses `next/link` rather than the locale-aware wrapper because /admin is
 * outside the i18n routing entirely — there is no locale prefix to add.
 */

const NAV = [
  { href: "/admin", label: "Resumo" },
  { href: "/admin/orders", label: "Encomendas" },
  { href: "/admin/products", label: "Produtos" },
  { href: "/admin/messages", label: "Mensagens" },
] as const;

export function AdminShell({
  session,
  activeHref,
  title,
  description,
  actions,
  children,
}: {
  session: AdminSession;
  activeHref: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/admin"
            className="font-heading text-lg font-semibold text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Palácio Doce
            <span className="ms-2 text-xs font-medium uppercase tracking-wide text-cocoa-soft">
              Gestão
            </span>
          </Link>

          <div className="ms-auto flex items-center gap-4">
            <span className="hidden text-sm text-cocoa-soft sm:inline">
              {session.name}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-full border border-line px-4 py-2 text-sm font-medium text-cocoa transition-colors hover:bg-cream-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                Sair
              </button>
            </form>
          </div>
        </div>

        <nav aria-label="Navegação da gestão" className="mx-auto max-w-6xl px-4 sm:px-6">
          <ul className="-mb-px flex flex-wrap gap-1">
            {NAV.map((item) => {
              const isActive = item.href === activeHref;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`inline-block border-b-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                      isActive
                        ? "border-cocoa text-cocoa"
                        : "border-transparent text-cocoa-soft hover:text-cocoa"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-semibold text-cocoa">
              {title}
            </h1>
            {description && (
              <p className="mt-2 text-cocoa-soft">{description}</p>
            )}
          </div>
          {actions}
        </div>

        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
