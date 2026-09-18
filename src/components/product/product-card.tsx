import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { ProductSummary } from "@/lib/data/products";
import { formatPrice } from "@/lib/format-price";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";

export async function ProductCard({ product }: { product: ProductSummary }) {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("Common");

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-line bg-paper transition-shadow hover:shadow-md">
      <Link
        href={{ pathname: "/product/[slug]", params: { slug: product.slug } }}
        className="relative block aspect-square overflow-hidden bg-cream-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        {product.image ? (
          <Image
            src={product.image.url}
            alt={product.image.alt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-cocoa-soft">
            Palácio Doce
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-heading text-lg font-semibold leading-snug text-cocoa">
          <Link
            href={{ pathname: "/product/[slug]", params: { slug: product.slug } }}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {product.name}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm leading-relaxed text-cocoa-soft">
          {product.shortDescription}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <p className="text-lg font-semibold text-cocoa" dir="ltr">
            {formatPrice(product.priceCents, locale)}
          </p>
          {product.stock !== null && product.stock <= 0 ? (
            <span className="text-sm font-medium text-berry">{t("outOfStock")}</span>
          ) : (
            <AddToCartButton productId={product.id} compact />
          )}
        </div>
      </div>
    </article>
  );
}
