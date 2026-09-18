import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { routing, type AppLocale } from "@/i18n/routing";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  locale: z.enum(routing.locales as unknown as [AppLocale, ...AppLocale[]]),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(10).max(4000),
});

/**
 * Receives contact-page enquiries.
 *
 * Messages are persisted so nothing depends on outbound mail succeeding;
 * the team works through them from the admin area. The endpoint is
 * rate limited because it is unauthenticated and writes to the database.
 */
export async function POST(request: Request) {
  const limit = rateLimit({
    key: clientKey(request, "contact"),
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    // Field-level codes let the client map errors onto inputs without
    // the server leaking its internal schema shape.
    return NextResponse.json(
      {
        error: "invalid_request",
        fields: parsed.error.issues.map((issue) => String(issue.path[0])),
      },
      { status: 400 },
    );
  }

  const { locale, name, email, message } = parsed.data;

  await prisma.contactMessage.create({
    data: { locale, name, email, message },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
