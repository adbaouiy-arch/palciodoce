import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { MarkdownContent } from "@/components/markdown-content";
import { formatDate } from "@/lib/format-date";
import type { PageContent } from "@/lib/data/pages";

/**
 * Shared shell for the database-backed informational pages (privacy,
 * terms, cookies). Keeps their layout, breadcrumbs and typography
 * identical so legal copy reads consistently in all three languages.
 */
export async function ContentPage({
  page,
  locale,
}: {
  page: PageContent;
  locale: AppLocale;
}) {
  const tProduct = await getTranslations("Product");
  const tCommon = await getTranslations("Common");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Breadcrumbs
        label={page.title}
        items={[
          { label: tProduct("breadcrumbHome"), href: "/" },
          { label: page.title },
        ]}
      />

      <header className="mt-6">
        <h1 className="font-heading text-4xl font-semibold leading-tight text-cocoa">
          {page.title}
        </h1>
        <p className="mt-3 text-sm text-cocoa-soft">
          {tCommon("lastUpdated")}{" "}
          <time dateTime={page.updatedAt.toISOString()}>
            {formatDate(page.updatedAt, locale)}
          </time>
        </p>
      </header>

      <article className="mt-10">
        <MarkdownContent content={page.content} />
      </article>
    </div>
  );
}
