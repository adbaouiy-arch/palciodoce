import { NextResponse } from "next/server";
import { z } from "zod";
import { routing, type AppLocale } from "@/i18n/routing";
import { createOrder } from "@/lib/data/orders";
import {
  FulfillmentMethod,
  PaymentMethod,
} from "@/generated/prisma/enums";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import {
  ORDER_ACCESS_COOKIE,
  ORDER_ACCESS_MAX_AGE_SECONDS,
  createOrderAccessToken,
} from "@/lib/order-access";

/** Portuguese postal code, e.g. 4710-311. */
const POSTAL_CODE = /^\d{4}-\d{3}$/;

/**
 * Phone numbers are accepted loosely (digits, spaces, +, -, parentheses)
 * because customers legitimately write Portuguese, other EU and
 * non-EU numbers in many shapes. Over-strict validation here rejects real
 * customers, which costs more than a slightly messy stored value.
 */
const PHONE = /^[+\d][\d\s()-]{6,24}$/;

const bodySchema = z
  .object({
    locale: z.enum(routing.locales as unknown as [AppLocale, ...AppLocale[]]),

    customerName: z.string().trim().min(2).max(120),
    customerEmail: z.string().trim().email().max(200),
    customerPhone: z.string().trim().regex(PHONE),

    fulfillmentMethod: z.enum([
      FulfillmentMethod.DELIVERY,
      FulfillmentMethod.PICKUP,
    ]),
    deliveryAddress: z.string().trim().max(300).optional(),
    deliveryCity: z.string().trim().max(120).optional(),
    deliveryPostalCode: z.string().trim().max(20).optional(),
    pickupNotes: z.string().trim().max(500).optional(),

    // Date-only string from <input type="date">.
    requestedDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    notes: z.string().trim().max(1000).optional(),

    paymentMethod: z.enum([
      PaymentMethod.MBWAY,
      PaymentMethod.BANK_TRANSFER,
      PaymentMethod.CASH_ON_PICKUP,
      PaymentMethod.CASH_ON_DELIVERY,
    ]),

    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          quantity: z.number().int().min(1).max(50),
        }),
      )
      .min(1)
      .max(100),
  })
  // Delivery orders need somewhere to deliver to. Enforced server-side so
  // it holds regardless of what the form did.
  .superRefine((value, ctx) => {
    if (value.fulfillmentMethod !== FulfillmentMethod.DELIVERY) return;

    if (!value.deliveryAddress || value.deliveryAddress.length < 5) {
      ctx.addIssue({
        code: "custom",
        path: ["deliveryAddress"],
        message: "required_for_delivery",
      });
    }
    if (!value.deliveryCity || value.deliveryCity.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["deliveryCity"],
        message: "required_for_delivery",
      });
    }
    if (!value.deliveryPostalCode || !POSTAL_CODE.test(value.deliveryPostalCode)) {
      ctx.addIssue({
        code: "custom",
        path: ["deliveryPostalCode"],
        message: "invalid_postal_code",
      });
    }
  });

/**
 * Parses the requested fulfilment date as local midnight and rejects past
 * dates. Using `new Date("YYYY-MM-DD")` directly would parse as UTC and
 * could land on the previous day for users behind UTC.
 */
function parseRequestedDate(value: string | undefined): Date | null | "invalid" {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);

  const isRealDate =
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day;
  if (!isRealDate) return "invalid";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsed < today) return "invalid";

  return parsed;
}

export async function POST(request: Request) {
  const limit = rateLimit({
    key: clientKey(request, "orders"),
    limit: 10,
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
    return NextResponse.json(
      {
        error: "invalid_request",
        fields: parsed.error.issues.map((issue) => String(issue.path[0])),
      },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const requestedDate = parseRequestedDate(data.requestedDate);
  if (requestedDate === "invalid") {
    return NextResponse.json(
      { error: "invalid_request", fields: ["requestedDate"] },
      { status: 400 },
    );
  }

  const result = await createOrder({
    locale: data.locale,
    customer: {
      name: data.customerName,
      email: data.customerEmail,
      phone: data.customerPhone,
    },
    fulfillment: {
      method: data.fulfillmentMethod,
      deliveryAddress: data.deliveryAddress ?? null,
      deliveryCity: data.deliveryCity ?? null,
      deliveryPostalCode: data.deliveryPostalCode ?? null,
      pickupNotes: data.pickupNotes ?? null,
      requestedDate,
      notes: data.notes ?? null,
    },
    paymentMethod: data.paymentMethod,
    items: data.items,
  });

  if (!result.ok) {
    // 409 for "your cart no longer matches reality" so the client can
    // tell it apart from a validation mistake and re-sync the cart.
    const status = result.error === "unavailable_items" ? 409 : 400;
    return NextResponse.json(
      {
        error: result.error,
        ...(result.unavailableProductIds
          ? { unavailableProductIds: result.unavailableProductIds }
          : {}),
      },
      { status },
    );
  }

  const { order } = result;

  const response = NextResponse.json(
    { ok: true, orderNumber: order.orderNumber },
    { status: 201 },
  );

  // Authorises this browser to view the confirmation page for this order.
  response.cookies.set({
    name: ORDER_ACCESS_COOKIE,
    value: await createOrderAccessToken(order.orderNumber),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ORDER_ACCESS_MAX_AGE_SECONDS,
  });

  return response;
}
