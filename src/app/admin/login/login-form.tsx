"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  inMemoryPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/client";

/**
 * Admin sign-in.
 *
 * The password is checked by Firebase, in the browser, so it never reaches this
 * application's servers or logs. What comes back is an ID token, which is then
 * traded at `/api/admin/session` for an httpOnly session cookie — see that
 * route for why the token itself is not used as the session.
 *
 * Firebase is told to keep nothing: `inMemoryPersistence` means the refresh
 * token is never written to IndexedDB or localStorage, and the client is signed
 * out as soon as the exchange is done. After a successful login the only
 * credential in the browser is the httpOnly cookie, which page script cannot
 * read. On a shared computer, closing the tab leaves nothing behind.
 */

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

const MESSAGES = {
  /*
    One message for wrong password, unknown email and malformed email alike.
    Distinguishing them would turn this form into an oracle for which addresses
    have accounts.
  */
  invalid: "Credenciais inválidas.",
  rateLimited:
    "Demasiadas tentativas. Aguarde alguns minutos e tente novamente.",
  disabled: "Esta conta está desativada. Contacte o administrador.",
  notAuthorised: "Esta conta não tem acesso à área de gestão.",
  network: "Não foi possível ligar ao servidor. Verifique a sua ligação.",
  unexpected: "Não foi possível entrar. Tente novamente.",
} as const;

/** Firebase surfaces its failure reason as `error.code`. */
function firebaseErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

function messageForSignInError(error: unknown): string {
  switch (firebaseErrorCode(error)) {
    case "auth/invalid-credential":
    case "auth/invalid-email":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/missing-password":
      return MESSAGES.invalid;
    case "auth/too-many-requests":
      return MESSAGES.rateLimited;
    case "auth/user-disabled":
      return MESSAGES.disabled;
    case "auth/network-request-failed":
      return MESSAGES.network;
    default:
      return MESSAGES.unexpected;
  }
}

function messageForExchangeStatus(status: number): string {
  if (status === 429) return MESSAGES.rateLimited;
  if (status === 403) return MESSAGES.notAuthorised;
  if (status === 401) return MESSAGES.invalid;
  return MESSAGES.unexpected;
}

export function LoginForm() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const isSubmitting = status.kind === "submitting";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    setStatus({ kind: "submitting" });

    let auth;
    try {
      auth = getClientAuth();
      await setPersistence(auth, inMemoryPersistence);
    } catch (error) {
      // Missing or malformed NEXT_PUBLIC_FIREBASE_* config. The detail goes to
      // the console for whoever is deploying, not onto a public page.
      console.error("Firebase client is not configured", error);
      setStatus({ kind: "error", message: MESSAGES.unexpected });
      return;
    }

    let idToken: string;
    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      idToken = await credential.user.getIdToken();
    } catch (error) {
      setStatus({ kind: "error", message: messageForSignInError(error) });
      return;
    }

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        setStatus({
          kind: "error",
          message: messageForExchangeStatus(response.status),
        });
        return;
      }
    } catch {
      setStatus({ kind: "error", message: MESSAGES.network });
      return;
    } finally {
      // Whether or not the exchange worked, the browser has no further use for
      // the Firebase session.
      await signOut(auth).catch(() => {});
    }

    /*
      `refresh` before navigating, to drop anything the router cached while
      this browser was still signed out — /admin would have redirected back
      here. `replace` rather than `push` so the Back button does not return to
      a login form for a session that now exists.
    */
    router.refresh();
    router.replace("/admin");
  }

  const message = status.kind === "error" ? status.message : null;

  const inputClass =
    "mt-2 w-full rounded-lg border border-line bg-paper px-4 py-3 text-base text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
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
          disabled={isSubmitting}
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
          disabled={isSubmitting}
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 rounded-full bg-cocoa px-6 py-3.5 text-base font-semibold text-cream transition-colors hover:bg-cocoa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "A entrar…" : "Entrar"}
      </button>

      {/* Announced so a failure isn't only a colour change. */}
      <p role="alert" aria-live="assertive" className="min-h-5 text-sm text-berry">
        {message ?? ""}
      </p>
    </form>
  );
}
