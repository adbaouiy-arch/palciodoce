"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState, type FormEvent } from "react";
import clsx from "clsx";

export function SearchForm({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("Search");
  const router = useRouter();
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = value.trim();
    if (!query) return;
    router.push({ pathname: "/search", query: { q: query } });
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={clsx("flex items-center", compact ? "w-56" : "w-full max-w-xl")}
    >
      <label htmlFor="site-search" className="sr-only-focusable">
        {t("placeholder")}
      </label>
      <input
        id="site-search"
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t("placeholder")}
        className="w-full rounded-full border border-line bg-cream-dark/60 px-4 py-2 text-sm text-cocoa placeholder:text-cocoa-soft/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      />
      <button type="submit" className="sr-only-focusable">
        {t("submit")}
      </button>
    </form>
  );
}
