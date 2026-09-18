import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

// Next.js 16 renamed `middleware.ts` to `proxy.ts`. next-intl's
// `createMiddleware` factory returns a standard proxy-compatible handler.
export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for:
  // - /api routes
  // - /admin (the admin dashboard is Portuguese-only and unrouted by locale)
  // - /_next (Next.js internals)
  // - files with an extension (e.g. favicon.ico, images, sitemap.xml, robots.txt)
  matcher: "/((?!api|admin|_next|.*\\..*).*)",
};
