import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { getDashboardStats, listOrders } from "@/lib/data/admin";
import { formatPrice } from "@/lib/format-price";
import { formatDateTime } from "@/lib/format-date";
import {
  FULFILLMENT_PT,
  ORDER_STATUS_PT,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_PT,
  PAYMENT_STATUS_TONE,
} from "@/lib/admin-labels";

export default async function AdminDashboardPage() {
  const session = await requireAdmin();

  const [stats, recent] = await Promise.all([
    getDashboardStats(),
    listOrders({ page: 1 }),
  ]);

  const cards = [
    { label: "Encomendas em aberto", value: String(stats.openOrders) },
    { label: "Aguardam pagamento", value: String(stats.awaitingPayment) },
    { label: "Receita recebida", value: formatPrice(stats.revenueCents, "pt") },
    { label: "Mensagens por tratar", value: String(stats.unhandledMessages) },
  ];

  return (
    <AdminShell
      session={session}
      activeHref="/admin"
      title="Resumo"
      description={`${stats.totalOrders} encomendas no total · ${stats.completedOrders} concluídas · ${stats.cancelledOrders} canceladas.`}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-line bg-paper p-5"
          >
            <p className="text-sm text-cocoa-soft">{card.label}</p>
            <p
              dir="ltr"
              className="mt-2 font-heading text-3xl font-semibold text-cocoa"
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-heading text-2xl font-semibold text-cocoa">
            Encomendas recentes
          </h2>
          <Link
            href="/admin/orders"
            className="text-sm font-medium text-cocoa underline underline-offset-4 transition-colors hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Ver todas
          </Link>
        </div>

        {recent.orders.length === 0 ? (
          <p className="mt-5 rounded-xl border border-line bg-paper p-8 text-center text-cocoa-soft">
            Ainda não há encomendas.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-xl border border-line bg-paper">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <caption className="sr-only-focusable">
                As encomendas mais recentes, da mais recente para a mais antiga.
              </caption>
              <thead>
                <tr className="border-b border-line text-start">
                  <th scope="col" className="px-4 py-3 text-start font-semibold">
                    Nº
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-semibold">
                    Cliente
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
                {recent.orders.slice(0, 8).map((order) => (
                  <tr key={order.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.orderNumber}`}
                        dir="ltr"
                        className="font-medium text-cocoa underline underline-offset-4 hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-cocoa-soft">
                      {order.customerName}
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
        )}
      </section>
    </AdminShell>
  );
}
