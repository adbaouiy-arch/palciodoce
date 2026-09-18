/**
 * Shared signing key for the site's signed cookies: the admin session
 * and the order-confirmation access token.
 *
 * In production a real `AUTH_SECRET` is mandatory and its absence is a
 * hard failure — falling back to a built-in value would mean anyone who
 * has read this source could mint a valid admin session. In development
 * a fixed placeholder keeps `npm run dev` working with no setup, and
 * warns once so it can't quietly reach a deployment.
 */

const DEV_FALLBACK_SECRET =
  "palaciodoce-development-only-secret-do-not-use-in-production";

let warned = false;

function resolveSecret(): string {
  const configured = process.env.AUTH_SECRET;

  if (configured && configured.length >= 32) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      configured
        ? "AUTH_SECRET must be at least 32 characters long."
        : "AUTH_SECRET is not set. Generate one with: openssl rand -base64 48",
    );
  }

  if (!warned) {
    warned = true;
    console.warn(
      "\n[auth] AUTH_SECRET is not set — using an insecure development key." +
        "\n[auth] Set AUTH_SECRET in .env before deploying." +
        "\n[auth] Generate one with: openssl rand -base64 48\n",
    );
  }

  return DEV_FALLBACK_SECRET;
}

/** HMAC key material for `jose`, which expects bytes rather than a string. */
export function getSigningKey(): Uint8Array {
  return new TextEncoder().encode(resolveSecret());
}
