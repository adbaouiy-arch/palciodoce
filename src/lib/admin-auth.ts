import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSigningKey } from "@/lib/auth-secret";

/**
 * Session handling for the admin area.
 *
 * The session is a signed JWT in an httpOnly cookie. Authorisation is
 * checked inside every protected page and every mutating action via
 * `requireAdmin()` rather than in middleware alone: middleware is a
 * routing concern and has historically been bypassable, whereas a check
 * next to the data access cannot be skipped by crafting a request.
 */

export const ADMIN_SESSION_COOKIE = "PALACIODOCE_ADMIN_SESSION";

/** One working day. Short enough that a forgotten open session expires. */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

const AUDIENCE = "admin-session";

export const ADMIN_LOGIN_PATH = "/admin/login";

export type AdminSession = {
  id: string;
  email: string;
  name: string;
};

/**
 * A real bcrypt hash of a random value, used when no account matches the
 * submitted email. Comparing against it means a request for an unknown
 * address costs the same time as one for a known address, so response
 * timing doesn't reveal which emails have accounts.
 */
const DUMMY_HASH =
  "$2b$12$aQYXIHWcsJ6t0uiCO1EJrO4WSogRQa58K3aaqXaxW8soWCReTVqQC";

export async function verifyAdminCredentials({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<AdminSession | null> {
  const user = await prisma.adminUser.findUnique({
    where: { email: email.trim().toLocaleLowerCase() },
  });

  const matches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !matches) return null;

  return { id: user.id, email: user.email, name: user.name };
}

export async function createAdminSession(session: AdminSession): Promise<void> {
  const token = await new SignJWT({
    email: session.email,
    name: session.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.id)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSigningKey());

  const cookieStore = await cookies();
  cookieStore.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

/**
 * Returns the signed-in admin, or null. The account is re-read from the
 * database on every call so that deleting an admin user revokes their
 * access immediately, instead of leaving a valid token working until it
 * expires.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      audience: AUDIENCE,
    });
    if (!payload.sub) return null;

    const user = await prisma.adminUser.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true },
    });
    return user ?? null;
  } catch {
    return null;
  }
}

/**
 * Guard for protected admin pages and actions. Redirects to the login
 * page when there is no valid session, so a caller can treat the returned
 * value as always present.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect(ADMIN_LOGIN_PATH);
  }
  return session;
}
