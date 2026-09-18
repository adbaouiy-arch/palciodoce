import { prisma } from "@/lib/prisma";
import type { AppLocale } from "@/i18n/routing";
import {
  FulfillmentMethod,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/generated/prisma/enums";

/**
 * Read and write helpers for the admin area.
 *
 * These are separate from the customer-facing data layer because they
 * intentionally expose data customers never see — full contact details,
 * every order regardless of owner, unhandled enquiries. Keeping them in
 * their own module makes it obvious that anything importing this file
 * must be behind `requireAdmin()`.
 */

export type AdminOrderListItem = {
  id: string;
  orderNumber: string;
  orderLanguage: AppLocale;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillmentMethod: FulfillmentMethod;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  totalCents: number;
  requestedDate: Date | null;
  createdAt: Date;
  itemCount: number;
};

export type AdminDashboardStats = {
  totalOrders: number;
  openOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  awaitingPayment: number;
  revenueCents: number;
  unhandledMessages: number;
  ordersByStatus: { status: OrderStatus; count: number }[];
};

/** Statuses that still need someone to act on them. */
const OPEN_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
];

export async function getDashboardStats(): Promise<AdminDashboardStats> {
  const [
    totalOrders,
    openOrders,
    completedOrders,
    cancelledOrders,
    awaitingPayment,
    revenue,
    unhandledMessages,
    grouped,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: { in: OPEN_STATUSES } } }),
    prisma.order.count({ where: { status: OrderStatus.COMPLETED } }),
    prisma.order.count({ where: { status: OrderStatus.CANCELLED } }),
    prisma.order.count({ where: { paymentStatus: PaymentStatus.PENDING } }),
    // Revenue counts money actually received, so it excludes orders that
    // are merely placed and unpaid, and excludes cancellations.
    prisma.order.aggregate({
      _sum: { totalCents: true },
      where: {
        paymentStatus: PaymentStatus.PAID,
        status: { not: OrderStatus.CANCELLED },
      },
    }),
    prisma.contactMessage.count({ where: { isHandled: false } }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  return {
    totalOrders,
    openOrders,
    completedOrders,
    cancelledOrders,
    awaitingPayment,
    revenueCents: revenue._sum.totalCents ?? 0,
    unhandledMessages,
    ordersByStatus: grouped.map((row) => ({
      status: row.status as OrderStatus,
      count: row._count._all,
    })),
  };
}

export const ORDERS_PER_PAGE = 20;

export async function listOrders({
  status,
  page = 1,
}: {
  status?: OrderStatus;
  page?: number;
} = {}): Promise<{ orders: AdminOrderListItem[]; total: number; pages: number }> {
  const where = status ? { status } : {};
  const safePage = Math.max(1, Math.floor(page));

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * ORDERS_PER_PAGE,
      take: ORDERS_PER_PAGE,
      include: { _count: { select: { items: true } } },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders: rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      orderLanguage: row.orderLanguage as AppLocale,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      customerPhone: row.customerPhone,
      fulfillmentMethod: row.fulfillmentMethod as FulfillmentMethod,
      paymentMethod: row.paymentMethod as PaymentMethod,
      paymentStatus: row.paymentStatus as PaymentStatus,
      status: row.status as OrderStatus,
      totalCents: row.totalCents,
      requestedDate: row.requestedDate,
      createdAt: row.createdAt,
      itemCount: row._count.items,
    })),
    total,
    pages: Math.max(1, Math.ceil(total / ORDERS_PER_PAGE)),
  };
}

export type AdminOrderDetail = AdminOrderListItem & {
  deliveryAddress: string | null;
  deliveryCity: string | null;
  deliveryPostalCode: string | null;
  pickupNotes: string | null;
  notes: string | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  items: {
    id: string;
    quantity: number;
    unitPriceCents: number;
    totalPriceCents: number;
    productNameSnapshot: string;
    productSlugSnapshot: string;
  }[];
};

export async function getAdminOrder(
  orderNumber: string,
): Promise<AdminOrderDetail | null> {
  const row = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true },
  });
  if (!row) return null;

  return {
    id: row.id,
    orderNumber: row.orderNumber,
    orderLanguage: row.orderLanguage as AppLocale,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    customerPhone: row.customerPhone,
    fulfillmentMethod: row.fulfillmentMethod as FulfillmentMethod,
    paymentMethod: row.paymentMethod as PaymentMethod,
    paymentStatus: row.paymentStatus as PaymentStatus,
    status: row.status as OrderStatus,
    totalCents: row.totalCents,
    subtotalCents: row.subtotalCents,
    deliveryFeeCents: row.deliveryFeeCents,
    requestedDate: row.requestedDate,
    createdAt: row.createdAt,
    deliveryAddress: row.deliveryAddress,
    deliveryCity: row.deliveryCity,
    deliveryPostalCode: row.deliveryPostalCode,
    pickupNotes: row.pickupNotes,
    notes: row.notes,
    itemCount: row.items.length,
    items: row.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalPriceCents: item.totalPriceCents,
      productNameSnapshot: item.productNameSnapshot,
      productSlugSnapshot: item.productSlugSnapshot,
    })),
  };
}

/**
 * Cancelling an order returns its reserved stock.
 *
 * Without this, cancelling would quietly consume inventory forever: the
 * checkout decrements `stock` when the order is placed, so the units have
 * to be handed back when the order will never be fulfilled. Only products
 * with finite stock are affected — `null` means made-to-order.
 */
async function restoreStockForOrder(orderId: string): Promise<void> {
  const items = await prisma.orderItem.findMany({
    where: { orderId, productId: { not: null } },
    select: { productId: true, quantity: true },
  });

  for (const item of items) {
    if (!item.productId) continue;
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: { stock: true },
    });
    if (!product || product.stock === null) continue;

    await prisma.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }
}

export async function updateOrderStatus({
  orderNumber,
  status,
}: {
  orderNumber: string;
  status: OrderStatus;
}): Promise<boolean> {
  const existing = await prisma.order.findUnique({
    where: { orderNumber },
    select: { id: true, status: true },
  });
  if (!existing) return false;
  if (existing.status === status) return true;

  const isBecomingCancelled =
    status === OrderStatus.CANCELLED &&
    existing.status !== OrderStatus.CANCELLED;

  await prisma.order.update({ where: { orderNumber }, data: { status } });

  if (isBecomingCancelled) {
    await restoreStockForOrder(existing.id);
  }

  return true;
}

export async function updatePaymentStatus({
  orderNumber,
  paymentStatus,
}: {
  orderNumber: string;
  paymentStatus: PaymentStatus;
}): Promise<boolean> {
  const existing = await prisma.order.findUnique({
    where: { orderNumber },
    select: { id: true },
  });
  if (!existing) return false;

  await prisma.order.update({
    where: { orderNumber },
    data: { paymentStatus },
  });
  return true;
}

// --- Products -------------------------------------------------------------

export type AdminProductRow = {
  id: string;
  sku: string;
  name: string;
  priceCents: number;
  stock: number | null;
  isActive: boolean;
  isFeatured: boolean;
  categoryName: string | null;
  translationLocales: AppLocale[];
};

/**
 * Product overview for the admin area, listed with the Portuguese name
 * (the admin area is Portuguese-only) plus which locales each product has
 * been translated into, so a missing translation is visible at a glance.
 */
export async function listAdminProducts(): Promise<AdminProductRow[]> {
  const products = await prisma.product.findMany({
    orderBy: { position: "asc" },
    include: {
      category: { include: { translations: { where: { locale: "pt" } } } },
      translations: { select: { locale: true, name: true } },
    },
  });

  return products.map((product) => ({
    id: product.id,
    sku: product.sku,
    name:
      product.translations.find((t) => t.locale === "pt")?.name ?? product.sku,
    priceCents: product.priceCents,
    stock: product.stock,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    categoryName: product.category?.translations[0]?.name ?? null,
    translationLocales: product.translations.map((t) => t.locale as AppLocale),
  }));
}

// --- Contact messages -----------------------------------------------------

export type AdminContactMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  locale: AppLocale;
  isHandled: boolean;
  createdAt: Date;
};

export async function listContactMessages(): Promise<AdminContactMessage[]> {
  const rows = await prisma.contactMessage.findMany({
    // Unhandled first, then newest — the queue reads as a to-do list.
    orderBy: [{ isHandled: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    message: row.message,
    locale: row.locale as AppLocale,
    isHandled: row.isHandled,
    createdAt: row.createdAt,
  }));
}

export async function setContactMessageHandled({
  id,
  isHandled,
}: {
  id: string;
  isHandled: boolean;
}): Promise<void> {
  await prisma.contactMessage.update({ where: { id }, data: { isHandled } });
}
