import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { routing, type AppLocale } from "@/i18n/routing";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * Records a visitor's cookie-consent choice.
 *
 * Under GDPR the controller has to be able to *demonstrate* that consent
 * was given (Art. 7(1)), which a client-side localStorage flag cannot do.
 * This endpoint writes the audit trail: what was chosen, in which
 * language, and when.
 *
 * Deliberately stored: a random visitor id, the three category flags, the
 * locale and a timestamp. Deliberately NOT stored: IP address, user agent
 * or anything else that would make the record identify a person — the log
 * exists to evidence consent, not to profile the visitor.
 */

export const VISITOR_COOKIE = "PALACIODOCE_VISITOR";
const VISITOR_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const bodySchema = z.object({
  locale: z.enum(routing.locales as unknown as [AppLocale, ...AppLocale[]]),
  // Strictly necessary cookies cannot be declined, so the client is only
  // permitted to assert `true` here — accepting `false` would record a
  // consent state the site cannot actually honour.
  necessary: z.literal(true),
  analytics: z.boolean(),
  marketing: z.boolean(),
});

export async function POST(request: Request) {
  const limit = rateLimit({
    key: clientKey(request, "consent"),
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { locale, necessary, analytics, marketing } = parsed.data;

  // Reuse the visitor's existing pseudonymous id so repeated decisions
  // form a history rather than looking like unrelated visitors.
  const cookieStore = await cookies();
  const existingVisitorId = cookieStore.get(VISITOR_COOKIE)?.value;
  const visitorId =
    existingVisitorId && existingVisitorId.length <= 64
      ? existingVisitorId
      : randomUUID();

  await getDb().collection(COLLECTIONS.consentLogs).add({
    visitorId,
    necessary,
    analytics,
    marketing,
    locale,
    createdAt: FieldValue.serverTimestamp(),
  });

  const response = NextResponse.json({ ok: true }, { status: 201 });

  // This id is itself a strictly-necessary cookie: it exists only to keep
  // the consent record consistent. httpOnly because no page script needs
  // to read it.
  response.cookies.set({
    name: VISITOR_COOKIE,
    value: visitorId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VISITOR_MAX_AGE_SECONDS,
  });

  return response;
}
