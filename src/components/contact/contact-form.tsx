"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import clsx from "clsx";

type FieldName = "name" | "email" | "message";
type Status = "idle" | "submitting" | "success" | "error";

/**
 * Contact form. Validation runs client-side for immediate feedback and
 * again on the server (see /api/contact), which is the only check that
 * actually protects the database.
 *
 * Errors are tied to their inputs with aria-describedby + aria-invalid,
 * and the outcome is announced in a live region, so the form is usable
 * without sighted access to the layout.
 */
export function ContactForm() {
  const locale = useLocale();
  const t = useTranslations("Contact");
  const tValidation = useTranslations("Validation");
  const tCommon = useTranslations("Common");

  const fieldId = useId();
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [values, setValues] = useState({ name: "", email: "", message: "" });

  function validate() {
    const next: Partial<Record<FieldName, string>> = {};

    if (values.name.trim().length < 2) {
      next.name = tValidation("minLength", { min: 2 });
    }
    // Deliberately permissive: matches the shape of an address without
    // trying to out-guess the server, which does the authoritative check.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      next.email = tValidation("invalidEmail");
    }
    if (values.message.trim().length < 10) {
      next.message = tValidation("minLength", { min: 10 });
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) {
      setStatus("error");
      return;
    }

    setStatus("submitting");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, ...values }),
      });

      if (!response.ok) {
        setStatus("error");
        return;
      }

      setValues({ name: "", email: "", message: "" });
      setErrors({});
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className="rounded-xl border border-gold/40 bg-gold/10 px-6 py-8 text-center"
      >
        <p className="font-heading text-lg font-semibold text-cocoa">
          {t("formSuccess")}
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-4 text-sm font-medium text-cocoa underline underline-offset-4 transition-colors hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          {t("formTitle")}
        </button>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border bg-paper px-4 py-3 text-base text-cocoa placeholder:text-cocoa-soft/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

  const fields: {
    name: FieldName;
    label: string;
    type: "text" | "email";
    autoComplete: string;
  }[] = [
    { name: "name", label: t("formNameLabel"), type: "text", autoComplete: "name" },
    { name: "email", label: t("formEmailLabel"), type: "email", autoComplete: "email" },
  ];

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {fields.map((field) => {
        const inputId = `${fieldId}-${field.name}`;
        const errorId = `${inputId}-error`;
        const error = errors[field.name];

        return (
          <div key={field.name}>
            <label
              htmlFor={inputId}
              className="block text-sm font-medium text-cocoa"
            >
              {field.label}
            </label>
            <input
              id={inputId}
              name={field.name}
              type={field.type}
              value={values[field.name]}
              autoComplete={field.autoComplete}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, [field.name]: event.target.value }))
              }
              className={clsx(
                inputClass,
                "mt-2",
                error ? "border-berry" : "border-line",
              )}
            />
            {error && (
              <p id={errorId} className="mt-1.5 text-sm text-berry">
                {error}
              </p>
            )}
          </div>
        );
      })}

      <div>
        <label
          htmlFor={`${fieldId}-message`}
          className="block text-sm font-medium text-cocoa"
        >
          {t("formMessageLabel")}
        </label>
        <textarea
          id={`${fieldId}-message`}
          name="message"
          rows={6}
          value={values.message}
          required
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? `${fieldId}-message-error` : undefined}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, message: event.target.value }))
          }
          className={clsx(
            inputClass,
            "mt-2 resize-y",
            errors.message ? "border-berry" : "border-line",
          )}
        />
        {errors.message && (
          <p id={`${fieldId}-message-error`} className="mt-1.5 text-sm text-berry">
            {errors.message}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={status === "submitting"}
          className="rounded-full bg-cocoa px-7 py-3.5 text-base font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "submitting" ? tCommon("loading") : t("formSubmit")}
        </button>

        {/* Announces the submission outcome to assistive technology. */}
        <p role="status" aria-live="polite" className="text-sm text-berry">
          {status === "error" && Object.keys(errors).length === 0
            ? tValidation("genericError")
            : ""}
        </p>
      </div>
    </form>
  );
}
