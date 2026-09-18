import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminOrder } from "@/lib/data/admin";
import {
  FulfillmentMethod,
  OrderStatus,
  PaymentStatus,
} from "@/generated/prisma/enums";
import { formatPrice } from "@/lib/format-price";
import { formatDate, formatDateTime } from "@/lib/format-date";
import {
  FULFILLMENT_PT,
  LOCALE_PT,
  ORDER_STATUS_PT,
  ORDER_STATUS_TONE,
  PAYMENT_METHOD_PT,
  PAYMENT_STATUS_PT,
  PAYMENT_STATUS_TONE,
} from "@/lib/admin-labels";
import {
  updateOrderStatusAction,
  updatePaymentStatusAction,
} from "@/app/admin/actions";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const session = await requireAdmin();
  const { orderNumber } = await params;

  const order = await getAdminOrder(orderNumber);
  if (!order) {
    notFound();
  }

  const isDelivery = order.fulfillmentMethod === FulfillmentMethod.DELIVERY;

  const customerRows: { label: string; value: React.ReactNode }[] = [
    { label: "Nome", value: order.customerName },
    {
      label: "Email",
      value: (
        <a
          href={`mailto:${order.customerEmail}`}
          dir="ltr"
          className="underline underline-offset-4 hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          {order.customerEmail}
        </a>
      ),
    },
    {
      label: "Telefone",
      value: (
        <a
          href={`tel:${order.customerPhone.replace(/\s/g, "")}`}
          dir="ltr"
          className="underline underline-offset-4 hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          {order.customerPhone}
        </a>
      ),
    },
    { label: "Idioma da encomenda", value: LOCALE_PT[order.orderLanguage] },
  ];

  const fulfillmentRows: { label: string; value: React.ReactNode }[] = [
    { label: "Método", value: FULFILLMENT_PT[order.fulfillmentMethod] },
    ...(isDelivery
      ? [
          { label: "Endereço", value: order.deliveryAddress ?? "—" },
          {
            label: "Código postal / Localidade",
            value: [order.deliveryPostalCode, order.deliveryCity]
              .filter(Boolean)
              .join(" ") || "—",
          },
        ]
      : [{ label: "Notas de recolha", value: order.pickupNotes ?? "—" }]),
    {
      label: "Data pretendida",
      value: order.requestedDate ? formatDate(order.requestedDate, "pt") : "—",
    },
    {
      label: "Criada em",
      value: formatDateTime(order.createdAt, "pt"),
    },
  ];

  return (
    <AdminShell
      session={session}
      activeHref="/admin/orders"
      title={order.orderNumber}
      description={`${order.itemCount} ${order.itemCount === 1 ? "artigo" : "artigos"} · ${formatPrice(order.totalCents, "pt")}`}
      actions={
        <Link
          href="/admin/orders"
          className="rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-medium text-cocoa transition-colors hover:bg-cream-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          Voltar às encomendas
        </Link>
      }
    >
      <div className="flex flex-wrap gap-3">
        <span
          className={`inline-block rounded-full border px-3 py-1.5 text-sm font-medium ${ORDER_STATUS_TONE[order.status]}`}
        >
          {ORDER_STATUS_PT[order.status]}
        </span>
        <span
          className={`inline-block rounded-full border px-3 py-1.5 text-sm font-medium ${PAYMENT_STATUS_TONE[order.paymentStatus]}`}
        >
          Pagamento: {PAYMENT_STATUS_PT[order.paymentStatus]}
        </span>
        <span className="inline-block rounded-full border border-line bg-paper px-3 py-1.5 text-sm text-cocoa-soft">
          {PAYMENT_METHOD_PT[order.paymentMethod]}
        </span>
      </div>

      {/* Status controls */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-paper p-6">
          <h2 className="font-heading text-xl font-semibold text-cocoa">
            Atualizar estado
          </h2>
          <p className="mt-2 text-sm text-cocoa-soft">
            Cancelar uma encomenda devolve automaticamente o stock reservado.
          </p>
          <form action={updateOrderStatusAction} className="mt-4 flex flex-wrap gap-3">
            <input type="hidden" name="orderNumber" value={order.orderNumber} />
            <label htmlFor="status" className="sr-only-focusable">
              Estado
            </label>
            <select
              id="status"
              name="status"
              defaultValue={order.status}
              className="rounded-lg border border-line bg-cream px-4 py-2.5 text-sm text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {Object.values(OrderStatus).map((candidate) => (
                <option key={candidate} value={candidate}>
                  {ORDER_STATUS_PT[candidate]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-full bg-cocoa px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              Guardar
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-line bg-paper p-6">
          <h2 className="font-heading text-xl font-semibold text-cocoa">
            Estado do pagamento
          </h2>
          <p className="mt-2 text-sm text-cocoa-soft">
            Marque como pago depois de confirmar a receção do valor.
          </p>
          <form
            action={updatePaymentStatusAction}
            className="mt-4 flex flex-wrap gap-3"
          >
            <input type="hidden" name="orderNumber" value={order.orderNumber} />
            <label htmlFor="paymentStatus" className="sr-only-focusable">
              Estado do pagamento
            </label>
            <select
              id="paymentStatus"
              name="paymentStatus"
              defaultValue={order.paymentStatus}
              className="rounded-lg border border-line bg-cream px-4 py-2.5 text-sm text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {Object.values(PaymentStatus).map((candidate) => (
                <option key={candidate} value={candidate}>
                  {PAYMENT_STATUS_PT[candidate]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-full bg-cocoa px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              Guardar
            </button>
          </form>
        </section>
      </div>

      {/* Customer + fulfilment */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-paper p-6">
          <h2 className="font-heading text-xl font-semibold text-cocoa">
            Cliente
          </h2>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            {customerRows.map((row) => (
              <div key={row.label} className="flex flex-wrap justify-between gap-2">
                <dt className="text-cocoa-soft">{row.label}</dt>
                <dd className="text-cocoa">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-xl border border-line bg-paper p-6">
          <h2 className="font-heading text-xl font-semibold text-cocoa">
            Entrega / Recolha
          </h2>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            {fulfillmentRows.map((row) => (
              <div key={row.label} className="flex flex-wrap justify-between gap-2">
                <dt className="text-cocoa-soft">{row.label}</dt>
                <dd className="text-end text-cocoa">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {order.notes && (
        <section className="mt-6 rounded-xl border border-gold/40 bg-gold/10 p-6">
          <h2 className="font-heading text-xl font-semibold text-cocoa">
            Notas do cliente
          </h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-cocoa-soft">
            {order.notes}
          </p>
        </section>
      )}

      {/* Line items */}
      <section className="mt-6 rounded-xl border border-line bg-paper p-6">
        <h2 className="font-heading text-xl font-semibold text-cocoa">Artigos</h2>
        <p className="mt-2 text-sm text-cocoa-soft">
          Nomes e preços registados no momento da compra, no idioma da encomenda.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="px-2 py-2.5 text-start font-semibold">
                  Produto
                </th>
                <th scope="col" className="px-2 py-2.5 text-end font-semibold">
                  Qtd.
                </th>
                <th scope="col" className="px-2 py-2.5 text-end font-semibold">
                  Unitário
                </th>
                <th scope="col" className="px-2 py-2.5 text-end font-semibold">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-line last:border-0">
                  <td className="px-2 py-3 text-cocoa">
                    {item.productNameSnapshot}
                    <span className="mt-0.5 block text-xs text-cocoa-soft" dir="ltr">
                      {item.productSlugSnapshot}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-end text-cocoa-soft" dir="ltr">
                    {item.quantity}
                  </td>
                  <td className="px-2 py-3 text-end text-cocoa-soft" dir="ltr">
                    {formatPrice(item.unitPriceCents, "pt")}
                  </td>
                  <td className="px-2 py-3 text-end font-semibold text-cocoa" dir="ltr">
                    {formatPrice(item.totalPriceCents, "pt")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="mt-5 ms-auto flex max-w-xs flex-col gap-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-cocoa-soft">Subtotal</dt>
            <dd dir="ltr" className="font-medium text-cocoa">
              {formatPrice(order.subtotalCents, "pt")}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-cocoa-soft">Taxa de entrega</dt>
            <dd dir="ltr" className="font-medium text-cocoa">
              {order.deliveryFeeCents === 0
                ? "Grátis"
                : formatPrice(order.deliveryFeeCents, "pt")}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-line pt-2">
            <dt className="font-semibold text-cocoa">Total</dt>
            <dd dir="ltr" className="text-lg font-semibold text-cocoa">
              {formatPrice(order.totalCents, "pt")}
            </dd>
          </div>
        </dl>
      </section>
    </AdminShell>
  );
}
