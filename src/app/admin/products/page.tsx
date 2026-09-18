import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { listAdminProducts } from "@/lib/data/admin";
import { formatPrice } from "@/lib/format-price";
import { routing } from "@/i18n/routing";

export default async function AdminProductsPage() {
  const session = await requireAdmin();
  const products = await listAdminProducts();

  const activeCount = products.filter((product) => product.isActive).length;

  return (
    <AdminShell
      session={session}
      activeHref="/admin/products"
      title="Produtos"
      description={`${products.length} produtos · ${activeCount} ativos. O catálogo é gerido na base de dados (npm run db:seed).`}
    >
      {products.length === 0 ? (
        <p className="rounded-xl border border-line bg-paper p-8 text-center text-cocoa-soft">
          Ainda não há produtos.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-paper">
          <table className="w-full min-w-[48rem] border-collapse text-sm">
            <caption className="sr-only-focusable">
              Produtos do catálogo, com preço, stock e traduções disponíveis.
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  Produto
                </th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  Categoria
                </th>
                <th scope="col" className="px-4 py-3 text-end font-semibold">
                  Preço
                </th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  Stock
                </th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  Traduções
                </th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const missingLocales = routing.locales.filter(
                  (locale) => !product.translationLocales.includes(locale),
                );

                return (
                  <tr key={product.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <span className="font-medium text-cocoa">{product.name}</span>
                      <span className="mt-0.5 block text-xs text-cocoa-soft" dir="ltr">
                        {product.sku}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-cocoa-soft">
                      {product.categoryName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-end font-semibold text-cocoa" dir="ltr">
                      {formatPrice(product.priceCents, "pt")}
                    </td>
                    <td className="px-4 py-3 text-cocoa-soft">
                      {product.stock === null ? (
                        "Por encomenda"
                      ) : (
                        <span dir="ltr">{product.stock}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {missingLocales.length === 0 ? (
                        <span className="text-cocoa-soft">Completas (PT/EN/AR)</span>
                      ) : (
                        <span className="font-medium text-berry">
                          Falta: {missingLocales.join(", ").toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-1 text-xs font-medium ${
                          product.isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                            : "border-berry/30 bg-berry/10 text-berry"
                        }`}
                      >
                        {product.isActive ? "Ativo" : "Inativo"}
                      </span>
                      {product.isFeatured && (
                        <span className="ms-2 inline-block rounded-full border border-gold/50 bg-gold/15 px-2.5 py-1 text-xs font-medium text-cocoa">
                          Destaque
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
