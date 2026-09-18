/**
 * Minimal fixed-window rate limiter for public write endpoints (contact
 * form, order placement, consent logging).
 *
 * State is per-process and in-memory, which is the right trade-off for a
 * single-instance deployment: it costs nothing, needs no extra service,
 * and stops the obvious abuse — someone hammering the contact form or
 * flooding the orders table. Behind multiple instances each process
 * keeps its own window, so the effective limit is per instance; move
 * this to a shared store (Redis, or the database) if the site is ever
 * scaled horizontally.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/** Stop the map growing without bound on a long-running server. */
function evictExpired(now: number) {
  if (windows.size < 5_000) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  /** Seconds until the window resets — suitable for a Retry-After header. */
  retryAfterSeconds: number;
};

export function rateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  evictExpired(now);

  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((existing.resetAt - now) / 1000),
  );

  return { ok: existing.count <= limit, retryAfterSeconds };
}

/**
 * Best-effort client identifier for rate limiting.
 *
 * `x-forwarded-for` is only trustworthy behind a proxy that sets it, so
 * this is a spam-throttling aid, not an authentication signal — it is
 * never used to make access-control decisions.
 */
export function clientKeyFromHeaders(headers: Headers, scope: string): string {
  const forwarded = headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}

/** Convenience wrapper for route handlers, which receive a `Request`. */
export function clientKey(request: Request, scope: string): string {
  return clientKeyFromHeaders(request.headers, scope);
}
