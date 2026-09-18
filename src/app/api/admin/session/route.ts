import { NextResponse } from "next/server";
import { createAdminSession } from "@/lib/admin-auth";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * Turns a Firebase sign-in into an admin session.
 *
 * Only sign-in lives here. Signing out is the `logoutAction` server action,
 * because it is triggered by a form the server already renders — adding a
 * second route for it would be one more unauthenticated endpoint to no
 * benefit.
 *
 * Why this endpoint exists at all: the password is checked by Firebase in the
 * browser, which hands back an ID token. An ID token is a poor session — it
 * lives for an hour, has to be re-sent on every request, and is readable by any
 * script on the page. So the browser trades it in here, exactly once, for an
 * httpOnly session cookie that the server can revoke.
 *
 * The token never becomes a session on its own: `createAdminSession` verifies
 * the signature, checks it has not been revoked, requires the password to have
 * been entered in the last few minutes, and requires the account to be on the
 * `adminUsers` allowlist.
 */

/**
 * Rejects cross-site requests.
 *
 * Without this, any page on the internet could POST an ID token here and
 * silently place a visitor into *its* chosen admin session (login CSRF). The
 * `Origin` header is set by the browser and cannot be spoofed by page script,
 * which is what makes it usable as the check.
 *
 * A missing `Origin` is a rejection rather than a pass: every browser sends it
 * on a POST, so its absence means the caller is not the sign-in form.
 */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  // `x-forwarded-host` first: behind a proxy, `host` is the internal address.
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  /*
    Firebase already throttles password guessing on its own sign-in endpoint,
    so this limit is not the primary defence. It is here to cap the cost of
    someone replaying tokens at us — each attempt costs a signature
    verification and a Firestore read.
  */
  const limit = rateLimit({
    key: clientKey(request, "admin-session"),
    limit: 20,
    windowMs: 15 * 60 * 1000,
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

  const body = await request.json().catch(() => null);
  const idToken =
    body && typeof body === "object" && "idToken" in body
      ? (body as { idToken: unknown }).idToken
      : null;

  // An ID token is a JWT, comfortably under 8 KB. The bound stops a huge body
  // reaching the verifier.
  if (typeof idToken !== "string" || idToken.length < 1 || idToken.length > 8192) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let session: Awaited<ReturnType<typeof createAdminSession>>;
  try {
    session = await createAdminSession(idToken);
  } catch {
    // Forged, expired, revoked, wrong project — all indistinguishable to the
    // caller, and all mean the same thing.
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  if (!session) {
    // Authenticated with Firebase, but not an administrator here. Saying so
    // plainly leaks nothing: whoever got this far already holds the password.
    return NextResponse.json({ error: "not_authorised" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
