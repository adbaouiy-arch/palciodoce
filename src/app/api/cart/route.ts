import { NextResponse } from "next/server";
import { z } from "zod";
import { getProductsForCart } from "@/lib/data/products";
import { routing, type AppLocale } from "@/i18n/routing";

const bodySchema = z.object({
  locale: z.enum(routing.locales as unknown as [AppLocale, ...AppLocale[]]),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(50),
      }),
    )
    .max(100),
});

/**
 * Hydrates cart line items (stored client-side as bare productId +
 * quantity, so they're locale-independent) with the current name, slug,
 * price, image and availability for the requested locale. This is what
 * lets a customer switch language mid-cart/checkout and immediately see
 * correctly translated product names instead of stale, wrong-locale
 * text — and it always reflects the live price rather than a
 * potentially outdated client-side copy.
 */
export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { locale, items } = parsed.data;
  if (items.length === 0) {
    return NextResponse.json({ lines: [] });
  }

  const productsById = await getProductsForCart(
    locale,
    items.map((item) => item.productId),
  );

  const lines = items
    .map((item) => {
      const product = productsById.get(item.productId);
      if (!product) return null;

      const isAvailable =
        product.isActive &&
        (product.stock === null || product.stock >= item.quantity);

      return {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        priceCents: product.priceCents,
        quantity: item.quantity,
        image: product.image,
        isActive: product.isActive,
        stock: product.stock,
        isAvailable,
      };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  return NextResponse.json({ lines });
}
