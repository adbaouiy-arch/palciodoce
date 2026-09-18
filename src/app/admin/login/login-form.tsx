"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const INITIAL: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, INITIAL);

  const message =
    state.status === "invalid"
      ? "Credenciais inválidas."
      : state.status === "rate_limited"
        ? "Demasiadas tentativas. Aguarde alguns minutos e tente novamente."
        : null;

  const inputClass =
    "mt-2 w-full rounded-lg border border-line bg-paper px-4 py-3 text-base text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-cocoa">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-cocoa"
        >
          Palavra-passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 rounded-full bg-cocoa px-6 py-3.5 text-base font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "A entrar…" : "Entrar"}
      </button>

      {/* Announced so a failure isn't only a colour change. */}
      <p role="alert" aria-live="assertive" className="min-h-5 text-sm text-berry">
        {message ?? ""}
      </p>
    </form>
  );
}
