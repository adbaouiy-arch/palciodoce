"use client";

import { useId, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import clsx from "clsx";
import { Link, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { useCart } from "@/lib/cart-store";
import { useHydratedCart } from "@/lib/use-hydrated-cart";
import { formatPrice } from "@/lib/format-price";
import { BUSINESS } from "@/lib/business";
import {
  FulfillmentMethod,
  PaymentMethod,
} from "@/generated/prisma/enums";
import {
  PAYMENT_METHODS_BY_FULFILLMENT,
  calculateOrderTotals,
} from "@/lib/order-pricing";

type FieldName =
  | "customerName"
  | "customerEmail"
  | "customerPhone"
  | "deliveryAddress"
  | "deliveryCity"
  | "deliveryPostalCode"
  | "requestedDate";

const POSTAL_CODE = /^\d{4}-\d{3}$/;
const PHONE = /^[+\d][\d\s()-]{6,24}$/;

/** Today as YYYY-MM-DD in local time, for the date input's `min`. */
function todayLocalIso(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

export function CheckoutForm() {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const fieldId = useId();

  const t = useTranslations("Checkout");
  const tCart = useTranslations("Cart");
  const tCommon = useTranslations("Common");
  const tValidation = useTranslations("Validation");
  const tProduct = useTranslations("Product");

  const { clear } = useCart();
  const { lines, isReady, hasError, retry } = useHydratedCart();

  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>(
    FulfillmentMethod.DELIVERY,
  );
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod>(PaymentMethod.MBWAY);
  const [values, setValues] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    deliveryAddress: "",
    deliveryCity: BUSINESS.city,
    deliveryPostalCode: "",
    requestedDate: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDelivery = fulfillmentMethod === FulfillmentMethod.DELIVERY;
  const allowedPaymentMethods = PAYMENT_METHODS_BY_FULFILLMENT[fulfillmentMethod];

  /*
    Switching between delivery and pickup can invalidate the chosen
    payment method — "cash on delivery" is meaningless once the customer
    switches to pickup. The valid method is *derived* rather than reset
    from an effect, so there is never a render in which the form holds a
    payment method that doesn't apply to the current fulfilment choice.
  */
  const paymentMethod = allowedPaymentMethods.includes(selectedPaymentMethod)
    ? selectedPaymentMethod
    : allowedPaymentMethods[0];

  const availableLines = useMemo(
    () => lines.filter((line) => line.isAvailable),
    [lines],
  );

  const totals = useMemo(
    () => calculateOrderTotals({ lines: availableLines, fulfillmentMethod }),
    [availableLines, fulfillmentMethod],
  );

  const paymentLabels: Record<PaymentMethod, { label: string; hint: string }> = {
    [PaymentMethod.MBWAY]: {
      label: t("paymentMbway"),
      hint: t("paymentInstructionsMbway"),
    },
    [PaymentMethod.BANK_TRANSFER]: {
      label: t("paymentBankTransfer"),
      hint: t("paymentInstructionsBankTransfer"),
    },
    [PaymentMethod.CASH_ON_PICKUP]: {
      label: t("paymentCashOnPickup"),
      hint: t("paymentInstructionsCashOnPickup"),
    },
    [PaymentMethod.CASH_ON_DELIVERY]: {
      label: t("paymentCashOnDelivery"),
      hint: t("paymentInstructionsCashOnDelivery"),
    },
  };

  function validate() {
    const next: Partial<Record<FieldName, string>> = {};

    if (values.customerName.trim().length < 2) {
      next.customerName = tValidation("minLength", { min: 2 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.customerEmail.trim())) {
      next.customerEmail = tValidation("invalidEmail");
    }
    if (!PHONE.test(values.customerPhone.trim())) {
      next.customerPhone = tValidation("invalidPhone");
    }

    if (isDelivery) {
      if (values.deliveryAddress.trim().length < 5) {
        next.deliveryAddress = tValidation("addressRequiredForDelivery");
      }
      if (values.deliveryCity.trim().length < 2) {
        next.deliveryCity = tValidation("required");
      }
      if (!POSTAL_CODE.test(values.deliveryPostalCode.trim())) {
        next.deliveryPostalCode = tValidation("invalidPostalCode");
      }
    }

    if (values.requestedDate) {
      // Compare date-only strings: both are YYYY-MM-DD in local time, so
      // this avoids timezone drift entirely.
      if (values.requestedDate < todayLocalIso()) {
        next.requestedDate = tValidation("dateInPast");
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    if (availableLines.length === 0) {
      setSubmitError(tValidation("cartEmpty"));
      return;
    }
    if (!validate()) {
      setSubmitError(tValidation("genericError"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          customerName: values.customerName,
          customerEmail: values.customerEmail,
          customerPhone: values.customerPhone,
          fulfillmentMethod,
          ...(isDelivery
            ? {
                deliveryAddress: values.deliveryAddress,
                deliveryCity: values.deliveryCity,
                deliveryPostalCode: values.deliveryPostalCode,
              }
            : {}),
          ...(values.requestedDate ? { requestedDate: values.requestedDate } : {}),
          ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
          paymentMethod,
          items: availableLines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
          })),
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.orderNumber) {
        setSubmitError(
          payload?.error === "unavailable_items"
            ? tCart("unavailableNotice")
            : tValidation("genericError"),
        );
        setIsSubmitting(false);
        return;
      }

      // The order now owns the items; clearing first prevents a
      // double-submit if the customer navigates back.
      clear();
      router.push({
        pathname: "/order-confirmation/[orderNumber]",
        params: { orderNumber: payload.orderNumber },
      });
    } catch {
      setSubmitError(tValidation("genericError"));
      setIsSubmitting(false);
    }
  }

  if (!isReady) {
    return (
      <p role="status" aria-live="polite" className="text-cocoa-soft">
        {tCommon("loading")}
      </p>
    );
  }

  // Never send someone to an "empty cart" dead end when the real problem
  // is that we couldn't load the cart — they'd lose a basket they still have.
  if (hasError) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-berry/30 bg-berry/5 px-6 py-12 text-center"
      >
        <p className="font-heading text-xl font-semibold text-cocoa">
          {tCommon("error")}
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-6 rounded-full bg-cocoa px-7 py-3.5 text-base font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          {tCommon("tryAgain")}
        </button>
      </div>
    );
  }

  if (availableLines.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-paper px-6 py-14 text-center">
        <p className="font-heading text-xl font-semibold text-cocoa">
          {tCart("empty")}
        </p>
        <p className="mx-auto mt-2 max-w-md text-cocoa-soft">
          {tCart("emptyHint")}
        </p>
        <Link
          href="/shop"
          className="mt-6 inline-block rounded-full bg-cocoa px-7 py-3.5 text-base font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          {tCart("continueShopping")}
        </Link>
      </div>
    );
  }

  const inputClass =
    "mt-2 w-full rounded-lg border bg-paper px-4 py-3 text-base text-cocoa placeholder:text-cocoa-soft/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

  function textField({
    name,
    label,
    type = "text",
    autoComplete,
    inputMode,
    placeholder,
    dir,
  }: {
    name: FieldName;
    label: string;
    type?: string;
    autoComplete?: string;
    inputMode?: "text" | "email" | "tel" | "numeric";
    placeholder?: string;
    dir?: "ltr";
  }) {
    const inputId = `${fieldId}-${name}`;
    const errorId = `${inputId}-error`;
    const error = errors[name];

    return (
      <div>
        <label htmlFor={inputId} className="block text-sm font-medium text-cocoa">
          {label}
        </label>
        <input
          id={inputId}
          name={name}
          type={type}
          dir={dir}
          inputMode={inputMode}
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={values[name]}
          min={name === "requestedDate" ? todayLocalIso() : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, [name]: event.target.value }))
          }
          className={clsx(inputClass, error ? "border-berry" : "border-line")}
        />
        {error && (
          <p id={errorId} className="mt-1.5 text-sm text-berry">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="grid gap-10 lg:grid-cols-[1fr_20rem] lg:items-start"
    >
      <div className="flex flex-col gap-8">
        {/* Step 1 — customer details */}
        <fieldset className="rounded-2xl border border-line bg-paper p-6 sm:p-7">
          <legend className="px-2 font-heading text-xl font-semibold text-cocoa">
            {t("step1Title")}
          </legend>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              {textField({
                name: "customerName",
                label: t("customerNameLabel"),
                autoComplete: "name",
              })}
            </div>
            {textField({
              name: "customerEmail",
              label: t("customerEmailLabel"),
              type: "email",
              inputMode: "email",
              autoComplete: "email",
              dir: "ltr",
            })}
            {textField({
              name: "customerPhone",
              label: t("customerPhoneLabel"),
              type: "tel",
              inputMode: "tel",
              autoComplete: "tel",
              placeholder: BUSINESS.phoneDisplay,
              dir: "ltr",
            })}
          </div>
        </fieldset>

        {/* Step 2 — fulfilment */}
        <fieldset className="rounded-2xl border border-line bg-paper p-6 sm:p-7">
          <legend className="px-2 font-heading text-xl font-semibold text-cocoa">
            {t("step2Title")}
          </legend>

          <div
            role="radiogroup"
            aria-label={t("fulfillmentMethodLabel")}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            {(
              [
                {
                  value: FulfillmentMethod.DELIVERY,
                  label: t("fulfillmentDelivery"),
                  hint: t("fulfillmentDeliveryHint"),
                },
                {
                  value: FulfillmentMethod.PICKUP,
                  label: t("fulfillmentPickup"),
                  hint: t("fulfillmentPickupHint"),
                },
              ] as const
            ).map((option) => (
              <label
                key={option.value}
                className={clsx(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                  fulfillmentMethod === option.value
                    ? "border-cocoa bg-cream-dark"
                    : "border-line hover:bg-cream",
                )}
              >
                <input
                  type="radio"
                  name="fulfillmentMethod"
                  value={option.value}
                  checked={fulfillmentMethod === option.value}
                  onChange={() => setFulfillmentMethod(option.value)}
                  className="mt-1 h-4 w-4 accent-cocoa"
                />
                <span>
                  <span className="block font-semibold text-cocoa">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-sm text-cocoa-soft">
                    {option.hint}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {isDelivery && (
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                {textField({
                  name: "deliveryAddress",
                  label: t("deliveryAddressLabel"),
                  autoComplete: "street-address",
                })}
              </div>
              {textField({
                name: "deliveryCity",
                label: t("deliveryCityLabel"),
                autoComplete: "address-level2",
              })}
              {textField({
                name: "deliveryPostalCode",
                label: t("deliveryPostalCodeLabel"),
                autoComplete: "postal-code",
                placeholder: BUSINESS.postalCode,
                dir: "ltr",
              })}
            </div>
          )}

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {textField({
              name: "requestedDate",
              label: t("requestedDateLabel"),
              type: "date",
              dir: "ltr",
            })}
          </div>

          <div className="mt-5">
            <label
              htmlFor={`${fieldId}-notes`}
              className="block text-sm font-medium text-cocoa"
            >
              {t("notesLabel")}
            </label>
            <textarea
              id={`${fieldId}-notes`}
              name="notes"
              rows={4}
              value={values.notes}
              placeholder={t("notesPlaceholder")}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, notes: event.target.value }))
              }
              className={clsx(inputClass, "resize-y border-line")}
            />
          </div>
        </fieldset>

        {/* Step 3 — payment */}
        <fieldset className="rounded-2xl border border-line bg-paper p-6 sm:p-7">
          <legend className="px-2 font-heading text-xl font-semibold text-cocoa">
            {t("step3Title")}
          </legend>

          <div
            role="radiogroup"
            aria-label={t("paymentMethodLabel")}
            className="mt-4 flex flex-col gap-3"
          >
            {allowedPaymentMethods.map((method) => (
              <label
                key={method}
                className={clsx(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                  paymentMethod === method
                    ? "border-cocoa bg-cream-dark"
                    : "border-line hover:bg-cream",
                )}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method}
                  checked={paymentMethod === method}
                  onChange={() => setSelectedPaymentMethod(method)}
                  className="mt-1 h-4 w-4 accent-cocoa"
                />
                <span>
                  <span className="block font-semibold text-cocoa">
                    {paymentLabels[method].label}
                  </span>
                  <span className="mt-1 block text-sm text-cocoa-soft">
                    {paymentLabels[method].hint}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Order summary */}
      <aside
        aria-labelledby="checkout-summary-title"
        className="rounded-2xl border border-line bg-cream-dark p-6 lg:sticky lg:top-24"
      >
        <h2
          id="checkout-summary-title"
          className="font-heading text-xl font-semibold text-cocoa"
        >
          {t("orderSummary")}
        </h2>

        <ul className="mt-5 flex flex-col gap-3 border-b border-line pb-5 text-sm">
          {availableLines.map((line) => (
            <li key={line.productId} className="flex justify-between gap-3">
              <span className="min-w-0 text-cocoa-soft">
                <span className="font-medium text-cocoa">{line.name}</span>
                <span className="block text-xs" dir="ltr">
                  {line.quantity} × {formatPrice(line.priceCents, locale)}{" "}
                  {tProduct("perUnit")}
                </span>
              </span>
              <span dir="ltr" className="shrink-0 font-semibold text-cocoa">
                {formatPrice(line.priceCents * line.quantity, locale)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-5 flex flex-col gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-cocoa-soft">{tCart("subtotal")}</dt>
            <dd dir="ltr" className="font-semibold text-cocoa">
              {formatPrice(totals.subtotalCents, locale)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-cocoa-soft">{tCart("deliveryFee")}</dt>
            <dd dir="ltr" className="font-semibold text-cocoa">
              {totals.deliveryFeeCents === 0
                ? tCommon("free")
                : formatPrice(totals.deliveryFeeCents, locale)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-line pt-3">
            <dt className="font-semibold text-cocoa">{tCart("total")}</dt>
            <dd dir="ltr" className="text-xl font-semibold text-cocoa">
              {formatPrice(totals.totalCents, locale)}
            </dd>
          </div>
        </dl>

        <p className="mt-5 text-xs leading-relaxed text-cocoa-soft">
          {/*
            Tag syntax (rather than {placeholder}) so each language keeps
            the link text inside its own sentence — word order and which
            words are linked differ across pt/en/ar.
          */}
          {t.rich("termsAgreement", {
            terms: (chunks) => (
              <Link
                href="/terms"
                className="font-medium text-cocoa underline underline-offset-4 hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link
                href="/privacy"
                className="font-medium text-cocoa underline underline-offset-4 hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-6 w-full rounded-full bg-cocoa px-6 py-3.5 text-base font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? t("placingOrder") : t("placeOrder")}
        </button>

        {/* Submission problems are announced, not just coloured red. */}
        <p role="alert" aria-live="assertive" className="mt-3 text-sm text-berry">
          {submitError ?? ""}
        </p>

        <Link
          href="/cart"
          className="mt-4 block text-center text-sm font-medium text-cocoa underline underline-offset-4 hover:text-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          {t("backToCart")}
        </Link>
      </aside>
    </form>
  );
}
