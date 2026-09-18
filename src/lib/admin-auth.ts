import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAuth, getDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { toStringOr } from "@/lib/firebase/mappers";

/**
 * Admin authentication and authorisation.
 *
 * The two are deliberately separate, and conflating them would be the single
 * easiest way to expose every customer's data:
 *
 *  - **Firebase Auth answers "who is this?"** It verifies the password, issues
 *    the token, and handles password reset and MFA.
 *
 *  - **This module answers "may they in?"** Firebase will happily authenticate
 *    *any* account in the project. If the project ever has a second user — a
 *    test account, an enabled sign-up form, a Google sign-in — being
 *    authenticated would otherwise mean being an administrator. So every
 *    request is additionally checked against the `adminUsers` allowlist.
 *
 * Authorisation is checked twice over, on purpose:
 *
 *  1. The `admin` custom claim, which travels inside the session cookie and
 *     costs nothing to read.
 *  2. The existence of `adminUsers/{uid}`, read on every request.
 *
 * The second is what makes revocation immediate. A custom claim is baked into
 * the token and survives until it refreshes (up to an hour), so removing only
 * the claim would leave a dismissed employee with a working session. Deleting
 * the allowlist document locks them out on their next request — the same
 * property the previous implementation had by re-reading the user row.
 */

export const ADMIN_SESSION_COOKIE = "PALACIODOCE_ADMIN_SESSION";
export const ADMIN_LOGIN_PATH = "/admin/login";

/** One working day — short enough that a forgotten open session expires. */
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

/**
 * How recently the password must have been entered for a token to be
 * exchangeable for a session. Five minutes is generous for a sign-in round
 * trip and far too short to reuse a stale browser session.
 */
const RECENT_LOGIN_WINDOW_SECONDS = 5 * 60;

export type AdminSession = {
  uid: string;
  email: string;
  name: string;
};

/**
 * Exchanges a freshly-minted Firebase ID token for a session cookie, and sets
 * it.
 *
 * A session cookie rather than the raw ID token because an ID token lasts only
 * an hour and cannot be revoked server-side, whereas a session cookie is
 * checked against revocation on every request.
 *
 * Returns null when the account is authenticated but not on the allowlist, so a
 * valid Firebase login by a non-administrator produces no session at all.
 *
 * Throws when the token itself is bad — the caller cannot usefully distinguish
 * a forged token from an expired one, and both mean "sign in again".
 */
export async function createAdminSession(
  idToken: string,
): Promise<AdminSession | null> {
  const auth = getAdminAuth();

  // `checkRevoked: true` — a token issued before a forced sign-out must not be
  // exchangeable for a fresh 8-hour session.
  const decoded = await auth.verifyIdToken(idToken, true);

  const allowed = await readAllowlistEntry(decoded.uid);
  if (!allowed) return null;

  /*
    Require the password to have been entered *just now*, not merely at some
    point in this browser's history.

    Firebase keeps a user signed in indefinitely and will hand out a fresh ID
    token from a stored refresh token without asking for the password again —
    `auth_time` still records the original sign-in. Without this check, a
    months-old login left on a shared machine could be turned into a new
    8-hour admin session by simply opening the site.

    `verifyIdToken` above already rejects a token older than the account's
    validity, which is reset by every grant and revoke, so this overlaps with
    it heavily. What it adds is the case that check cannot see: an established
    account, an old sign-in, and nothing revoked in between.
  */
  const authAgeSeconds = Date.now() / 1000 - decoded.auth_time;
  if (authAgeSeconds > RECENT_LOGIN_WINDOW_SECONDS) return null;

  const cookie = await auth.createSessionCookie(idToken, {
    expiresIn: ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
  });

  const cookieStore = await cookies();
  cookieStore.set({
    name: ADMIN_SESSION_COOKIE,
    value: cookie,
    httpOnly: true, // No admin script reads this; keeps it out of reach of XSS.
    sameSite: "lax", // "strict" would break the redirect back from sign-in.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });

  return allowed;
}

/** Reads the allowlist entry for a uid, or null if the account is not listed. */
async function readAllowlistEntry(uid: string): Promise<AdminSession | null> {
  const doc = await getDb().collection(COLLECTIONS.adminUsers).doc(uid).get();
  if (!doc.exists) return null;

  const data = doc.data() ?? {};
  return {
    uid,
    email: toStringOr(data.email, ""),
    name: toStringOr(data.name, "Administração"),
  };
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  /*
    Revoke the refresh tokens as well as dropping the cookie. Without this,
    "sign out" would only clear this browser — anyone holding a copy of the
    cookie would still be inside. Revoking invalidates it everywhere, which is
    what matters if the reason for signing out is a suspected compromise.
  */
  if (cookie) {
    try {
      const decoded = await getAdminAuth().verifySessionCookie(cookie, false);
      await getAdminAuth().revokeRefreshTokens(decoded.uid);
    } catch {
      // Already invalid or expired; clearing the cookie is enough.
    }
  }

  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

/**
 * Returns the signed-in administrator, or null.
 *
 * Every failure mode — no cookie, bad signature, expired, revoked, missing
 * claim, removed from the allowlist — collapses to null. There is no partial
 * trust and no distinction reported to the caller, because the only useful
 * response to any of them is "sign in again".
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    // `true` checks revocation, which costs a call to Firebase but is what
    // makes a forced sign-out take effect immediately.
    const decoded = await getAdminAuth().verifySessionCookie(cookie, true);

    // Fast path: the claim rides along in the cookie.
    if (decoded.admin !== true) return null;

    // Authoritative path: still on the allowlist right now?
    return await readAllowlistEntry(decoded.uid);
  } catch {
    return null;
  }
}

/**
 * Guard for protected admin pages and actions. Redirects to the login page
 * when there is no valid session, so callers may treat the result as present.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect(ADMIN_LOGIN_PATH);
  }
  return session;
}
