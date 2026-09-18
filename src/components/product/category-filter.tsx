import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import clsx from "clsx";
import type { CategorySummary } from "@/lib/data/categories";

export async function CategoryFilter({
  categories,
  activeSlug,
}: {
  categories: CategorySummary[];
  activeSlug: string | null;
}) {
  const t = await getTranslations("Shop");

  return (
    <nav aria-label={t("filterByCategory")}>
      <ul className="flex flex-wrap gap-2">
        <li>
          <Link
            href="/shop"
            aria-current={activeSlug === null ? "page" : undefined}
            className={clsx(
              "inline-block rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
              activeSlug === null
                ? "border-cocoa bg-cocoa text-cream"
                : "border-line bg-paper text-cocoa-soft hover:border-cocoa hover:text-cocoa",
            )}
          >
            {t("allCategories")}
          </Link>
        </li>
        {categories.map((category) => {
          const isActive = category.slug === activeSlug;
          return (
            <li key={category.id}>
              <Link
                href={{ pathname: "/category/[slug]", params: { slug: category.slug } }}
                aria-current={isActive ? "page" : undefined}
                className={clsx(
                  "inline-block rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                  isActive
                    ? "border-cocoa bg-cocoa text-cream"
                    : "border-line bg-paper text-cocoa-soft hover:border-cocoa hover:text-cocoa",
                )}
              >
                {category.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
