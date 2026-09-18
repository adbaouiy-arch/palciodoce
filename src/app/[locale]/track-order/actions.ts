"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { getPathname } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { findOrderForTracking } from "@/lib/data/orders";
import {
  ORDER_ACCESS_COOKIE,
  ORDER_ACCESS_MAX_AGE_SECONDS,
  createOrderAccessToken,
} from "@/lib/order-access";
import { clientKeyFromHeaders, rateLimit } from "@/lib/rate-limit";

export type TrackOrderState =
  | { status: "idle" }
  | { status: "not_found" }
  | { status: "invalid"; fields: string[] }
  | { status: "rate_limited" };

const schema = z.object({
  orderNumber: z.string().trim().min(4).max(40),
  email: z.string().trim().email().max(200),
});

/**
 * Looks up an order for the public tracking page.
 *
 * On success the visitor has proved ownership (they supplied the email the
 * order was placed with), so we issue the same signed access token the
 * checkout issues and redirect. The order is then rendered server-side
 * from that token, which keeps the email out of the URL — a query string
 * would end up in browser history, server logs and referrer headers.
 *
 * A wrong email and a non-existent order both return `not_found`.
 * Distinguishing them would confirm which references exist and turn this
 * form into an order-enumeration oracle, which matters because order
 * numbers are sequential.
 */
export async function trackOrderAction(
  _previous: TrackOrderState,
  formData: FormData,
): Promise<TrackOrderState> {
  const requestHeaders = await headers();

  const limit = rateLimit({
    key: clientKeyFromHeaders(requestHeaders, "track-order"),
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.ok) {
    return { status: "rate_limited" };
  }

  const parsed = schema.safeParse({
    orderNumber: formData.get("orderNumber"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      status: "invalid",
      fields: parsed.error.issues.map((issue) => String(issue.path[0])),
    };
  }

  const order = await findOrderForTracking(parsed.data);
  if (!order) {
    return { status: "not_found" };
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: ORDER_ACCESS_COOKIE,
    value: await createOrderAccessToken(order.orderNumber),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ORDER_ACCESS_MAX_AGE_SECONDS,
  });

  // Redirect back to the tracking page, which now renders the order from
  // the token above. `getPathname` keeps the locale's own URL segment
  // (/rastrear-pedido vs /en/track-order).
  const locale = (await getLocale()) as AppLocale;
  redirect(getPathname({ locale, href: "/track-order" }));
}

/** Clears the access token so the visitor can look up a different order. */
export async function clearTrackedOrderAction() {
  const cookieStore = await cookies();
  cookieStore.delete(ORDER_ACCESS_COOKIE);

  const locale = (await getLocale()) as AppLocale;
  redirect(getPathname({ locale, href: "/track-order" }));
}
