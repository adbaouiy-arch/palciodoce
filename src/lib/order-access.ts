import { SignJWT, jwtVerify } from "jose";
import { getSigningKey } from "@/lib/auth-secret";

/**
 * Authorises a browser to see the full details of an order it has just
 * placed.
 *
 * Order references are sequential (PD-20260916-0001), so they are trivial
 * to enumerate. Without a check, anyone could walk the confirmation route
 * and harvest customer names, phone numbers and delivery addresses. The
 * order API therefore issues a signed, short-lived token naming the order
 * that was just created, and the confirmation page renders customer data
 * only when the token matches the order in the URL.
 *
 * The token is signed rather than merely httpOnly: httpOnly stops page
 * scripts reading a cookie, but nothing stops someone sending a
 * hand-crafted `Cookie` header, so the value has to be unforgeable.
 *
 * For access later on — a bookmarked link, a different device — the
 * customer uses the tracking page, which requires the email address the
 * order was placed with.
 */

export const ORDER_ACCESS_COOKIE = "PALACIODOCE_ORDER_ACCESS";

/** Long enough to reload or share the tab, short enough to limit exposure. */
export const ORDER_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 2;

const AUDIENCE = "order-confirmation";

export async function createOrderAccessToken(
  orderNumber: string,
): Promise<string> {
  return new SignJWT({ orderNumber })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ORDER_ACCESS_MAX_AGE_SECONDS}s`)
    .sign(getSigningKey());
}

/**
 * Returns the order number a token authorises, or null if the token is
 * missing, malformed, expired or not signed by us. Any verification
 * failure is treated as "not authorised" — there is no partial trust.
 */
export async function readOrderAccess(
  token: string | undefined,
): Promise<string | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      audience: AUDIENCE,
    });
    return typeof payload.orderNumber === "string" ? payload.orderNumber : null;
  } catch {
    return null;
  }
}

/**
 * True when `token` is a valid, unexpired token for exactly `orderNumber`.
 */
export async function hasOrderAccess({
  token,
  orderNumber,
}: {
  token: string | undefined;
  orderNumber: string;
}): Promise<boolean> {
  return (await readOrderAccess(token)) === orderNumber;
}
