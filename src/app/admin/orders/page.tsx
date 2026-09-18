import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { listOrders } from "@/lib/data/admin";
import { OrderStatus } from "@/generated/prisma/enums";
import { formatPrice } from "@/lib/format-price";
import { formatDateTime } from "@/lib/format-date";
import {
  FULFILLMENT_PT,
  LOCALE_PT,
  ORDER_STATUS_PT,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_PT,
  PAYMENT_STATUS_TONE,
} from "@/lib/admin-labels";

const ALL_STATUSES = Object.values(OrderStatus);

/** Narrows an untrusted query value to a real status, or undefined. */
function parseStatus(value: string | undefined): OrderStatus | undefined {
  return ALL_STATUSES.includes(value as OrderStatus)
    ? (value as OrderStatus)
    : undefined;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const session = await requireAdmin();
  const { status: rawStatus, page: rawPage } = await searchParams;

  const status = parseStatus(rawStatus);
  const page = Number.parseInt(rawPage ?? "1", 10);
  const { orders, total, pages } = await listOrders({
    status,
    page: Number.isNaN(page) ? 1 : page,
  });

  const currentPage = Math.min(Math.max(1, Number.isNaN(page) ? 1 : page), pages);

  function filterHref(next: OrderStatus | undefined) {
    return next ? `/admin/orders?status=${next}` : "/admin/orders";
  }

  function pageHref(next: number) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("page", String(next));
    return `/admin/orders?${params.toString()}`;
  }

  return (
    <AdminShell
      session={session}
      activeHref="/admin/orders"
      title="Encomendas"
      description={`${total} ${total === 1 ? "encomenda" : "encomendas"}${
        status ? ` com o estado “${ORDER_STATUS_PT[status]}”` : ""
      }.`}
    >
      <nav aria-label="Filtrar por estado">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link
              href={filterHref(undefined)}
              aria-current={!status ? "page" : undefined}
              className={`inline-block rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                !status
                  ? "border-cocoa bg-cocoa text-cream"
                  : "border-line bg-paper text-cocoa hover:bg-cream-dark"
              }`}
            >
              Todas
            </Link>
          </li>
          {ALL_STATUSES.map((candidate) => (
            <li key={candidate}>
              <Link
                href={filterHref(candidate)}
                aria-current={status === candidate ? "page" : undefined}
                className={`inline-block rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                  status === candidate
                    ? "border-cocoa bg-cocoa text-cream"
                    : "border-line bg-paper text-cocoa hover:bg-cream-dark"
                }`}
              >
                {ORDER_STATUS_PT[candidate]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {orders.length === 0 ? (
        <p className="mt-8 rounded-xl border border-line bg-paper p-8 text-center text-cocoa-soft">
          Não há encomendas para este filtro.
        </p>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-paper">
            <table className="w-full min-w-[56rem] border-collapse text-sm">
              <caption className="sr-only-focusable">
                Encomendas, da mais recente para a mais antiga.
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="px-4 py-3 text-start font-semibold">
                    Nº
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-semibold">
                    Cliente
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-semibold">
                    Contacto
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-semibold">
                    Idioma
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-semibold">
                    Data
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-semibold">
                    Entrega
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-semibold">
                    Estado
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-semibold">
                    Pagamento
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.orderNumber}`}
                        dir="ltr"
                        className="font-medium text-cocoa underline underline-offset-4 hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                      >
                        {order.orderNumber}
                      </Link>
                      <span className="mt-0.5 block text-xs text-cocoa-soft">
                        {order.itemCount}{" "}
                        {order.itemCount === 1 ? "artigo" : "artigos"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-cocoa">{order.customerName}</td>
                    <td className="px-4 py-3">
                      <a
                        href={`mailto:${order.customerEmail}`}
                        dir="ltr"
                        className="block text-cocoa-soft underline underline-offset-4 hover:text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                      >
                        {order.customerEmail}
                      </a>
                      <a
                        href={`tel:${order.customerPhone.replace(/\s/g, "")}`}
                        dir="ltr"
                        className="mt-0.5 block text-xs text-cocoa-soft underline underline-offset-4 hover:text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                      >
                        {order.customerPhone}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-cocoa-soft">
                      {LOCALE_PT[order.orderLanguage]}
                    </td>
                    <td className="px-4 py-3 text-cocoa-soft" dir="ltr">
                      {formatDateTime(order.createdAt, "pt")}
                    </td>
                    <td className="px-4 py-3 text-cocoa-soft">
                      {FULFILLMENT_PT[order.fulfillmentMethod]}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-1 text-xs font-medium ${ORDER_STATUS_TONE[order.status]}`}
                      >
                        {ORDER_STATUS_PT[order.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-1 text-xs font-medium ${PAYMENT_STATUS_TONE[order.paymentStatus]}`}
                      >
                        {PAYMENT_STATUS_PT[order.paymentStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end font-semibold" dir="ltr">
                      {formatPrice(order.totalCents, "pt")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <nav aria-label="Paginação" className="mt-6 flex items-center gap-3">
              {currentPage > 1 && (
                <Link
                  href={pageHref(currentPage - 1)}
                  className="rounded-full border border-line bg-paper px-4 py-2 text-sm font-medium text-cocoa transition-colors hover:bg-cream-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  Anterior
                </Link>
              )}
              <span className="text-sm text-cocoa-soft">
                Página {currentPage} de {pages}
              </span>
              {currentPage < pages && (
                <Link
                  href={pageHref(currentPage + 1)}
                  className="rounded-full border border-line bg-paper px-4 py-2 text-sm font-medium text-cocoa transition-colors hover:bg-cream-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  Seguinte
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </AdminShell>
  );
}
