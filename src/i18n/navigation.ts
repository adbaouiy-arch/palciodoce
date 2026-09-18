import { createNavigation } from "next-intl/navigation";
import { routing } from "@/i18n/routing";

// Locale-aware wrappers around Next.js' navigation APIs. Always import
// these instead of `next/link` / `next/navigation` so that locale prefixes
// and localized pathnames (see routing.ts `pathnames`) are handled
// automatically.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
