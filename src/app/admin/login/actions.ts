"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createAdminSession,
  verifyAdminCredentials,
} from "@/lib/admin-auth";
import { clientKeyFromHeaders, rateLimit } from "@/lib/rate-limit";

export type LoginState = { status: "idle" | "invalid" | "rate_limited" };

const schema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
});

/**
 * Signs an administrator in.
 *
 * Bad credentials and a malformed submission both return the same
 * `invalid` result: telling the visitor *which* part was wrong would
 * confirm whether an email address has an account. Attempts are rate
 * limited per client to blunt password guessing, and the credential check
 * itself takes constant time whether or not the account exists (see
 * `verifyAdminCredentials`).
 */
export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const requestHeaders = await headers();

  const limit = rateLimit({
    key: clientKeyFromHeaders(requestHeaders, "admin-login"),
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.ok) {
    return { status: "rate_limited" };
  }

  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "invalid" };
  }

  const session = await verifyAdminCredentials(parsed.data);
  if (!session) {
    return { status: "invalid" };
  }

  await createAdminSession(session);
  redirect("/admin");
}
