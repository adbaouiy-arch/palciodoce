"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, destroyAdminSession, ADMIN_LOGIN_PATH } from "@/lib/admin-auth";
import {
  setContactMessageHandled,
  updateOrderStatus,
  updatePaymentStatus,
} from "@/lib/data/admin";
import { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";

/**
 * Mutating admin actions.
 *
 * Every one of these calls `requireAdmin()` first. Server actions are
 * reachable as ordinary HTTP endpoints once their id is known, so the
 * check has to live in the action itself — being rendered only on a
 * protected page is not protection.
 */

export async function logoutAction() {
  await destroyAdminSession();
  redirect(ADMIN_LOGIN_PATH);
}

const statusSchema = z.object({
  orderNumber: z.string().min(1),
  status: z.enum([
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
  ]),
});

export async function updateOrderStatusAction(formData: FormData) {
  await requireAdmin();

  const parsed = statusSchema.safeParse({
    orderNumber: formData.get("orderNumber"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  await updateOrderStatus(parsed.data);

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${parsed.data.orderNumber}`);
}

const paymentSchema = z.object({
  orderNumber: z.string().min(1),
  paymentStatus: z.enum([
    PaymentStatus.PENDING,
    PaymentStatus.PAID,
    PaymentStatus.FAILED,
    PaymentStatus.REFUNDED,
  ]),
});

export async function updatePaymentStatusAction(formData: FormData) {
  await requireAdmin();

  const parsed = paymentSchema.safeParse({
    orderNumber: formData.get("orderNumber"),
    paymentStatus: formData.get("paymentStatus"),
  });
  if (!parsed.success) return;

  await updatePaymentStatus(parsed.data);

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${parsed.data.orderNumber}`);
}

const messageSchema = z.object({
  id: z.string().min(1),
  isHandled: z.enum(["true", "false"]),
});

export async function setMessageHandledAction(formData: FormData) {
  await requireAdmin();

  const parsed = messageSchema.safeParse({
    id: formData.get("id"),
    isHandled: formData.get("isHandled"),
  });
  if (!parsed.success) return;

  await setContactMessageHandled({
    id: parsed.data.id,
    isHandled: parsed.data.isHandled === "true",
  });

  revalidatePath("/admin");
  revalidatePath("/admin/messages");
}
