"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import clsx from "clsx";
import {
  trackOrderAction,
  type TrackOrderState,
} from "@/app/[locale]/track-order/actions";

const INITIAL: TrackOrderState = { status: "idle" };

export function TrackOrderForm() {
  const t = useTranslations("TrackOrder");
  const tValidation = useTranslations("Validation");
  const tCommon = useTranslations("Common");

  const [state, formAction, isPending] = useActionState(
    trackOrderAction,
    INITIAL,
  );

  const invalidFields =
    state.status === "invalid" ? new Set(state.fields) : new Set<string>();

  const message =
    state.status === "not_found"
      ? `${t("notFound")} ${t("notFoundHint")}`
      : state.status === "rate_limited"
        ? tCommon("tryAgain")
        : state.status === "invalid"
          ? tValidation("genericError")
          : null;

  const inputClass =
    "mt-2 w-full rounded-lg border bg-paper px-4 py-3 text-base text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div>
        <label
          htmlFor="track-order-number"
          className="block text-sm font-medium text-cocoa"
        >
          {t("orderNumberLabel")}
        </label>
        <input
          id="track-order-number"
          name="orderNumber"
          type="text"
          required
          dir="ltr"
          placeholder="PD-20260916-0001"
          autoComplete="off"
          aria-invalid={invalidFields.has("orderNumber") || undefined}
          className={clsx(
            inputClass,
            invalidFields.has("orderNumber") ? "border-berry" : "border-line",
          )}
        />
      </div>

      <div>
        <label
          htmlFor="track-order-email"
          className="block text-sm font-medium text-cocoa"
        >
          {t("emailLabel")}
        </label>
        <input
          id="track-order-email"
          name="email"
          type="email"
          required
          dir="ltr"
          autoComplete="email"
          aria-invalid={invalidFields.has("email") || undefined}
          className={clsx(
            inputClass,
            invalidFields.has("email") ? "border-berry" : "border-line",
          )}
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-cocoa px-7 py-3.5 text-base font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? tCommon("loading") : t("submit")}
        </button>
      </div>

      {/* Lookup failures are announced, not only shown in red. */}
      <p role="status" aria-live="polite" className="text-sm text-berry">
        {message ?? ""}
      </p>
    </form>
  );
}
