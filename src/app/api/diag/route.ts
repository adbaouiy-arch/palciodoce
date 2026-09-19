import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * TEMPORARY diagnostic endpoint. Delete once the deployment is healthy.
 *
 * Exists because a serverless platform swallows the actual error. Every dynamic
 * route returns a bare 500 and the useful message — the one naming what is
 * actually wrong — is only in the platform's log stream. This surfaces it over
 * HTTP so it can be read without the dashboard.
 *
 * Access requires a token derived from AUTH_SECRET, so it is not a standing
 * information leak: anyone who can compute it already holds the secret. Without
 * the gate this would happily describe the server's configuration to the
 * internet.
 *
 * Everything reported is a boolean, a length, or an error message with anything
 * resembling key material stripped out.
 */

// Bumped by hand, so a response proves which commit is actually serving.
const BUILD_MARKER = "diag-1";

function expectedToken(): string | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return createHash("sha256").update(secret).digest("hex").slice(0, 16);
}

/** Removes anything that could be part of a private key from an error string. */
function redact(message: string): string {
  return message
    .replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g, "[PEM REDACTED]")
    .replace(/[A-Za-z0-9+/]{40,}={0,2}/g, "[LONG-BASE64 REDACTED]");
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redact(error.message).split("\n").slice(0, 6),
      code: (error as { code?: unknown }).code ?? null,
      // The top frames say which module failed to load, which is the whole
      // point when the cause is a missing dependency rather than bad config.
      stack: (error.stack ?? "")
        .split("\n")
        .slice(1, 6)
        .map((line) => redact(line.trim())),
    };
  }
  return { name: "unknown", message: [redact(String(error))], code: null, stack: [] };
}

export async function GET(request: Request) {
  const expected = expectedToken();
  const provided = new URL(request.url).searchParams.get("k");

  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const rawKey = process.env.FIREBASE_PRIVATE_KEY ?? "";

  const report: Record<string, unknown> = {
    build: BUILD_MARKER,
    node: process.version,
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
    vercelEnv: process.env.VERCEL_ENV ?? null,

    env: {
      AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ?? null,
      FIREBASE_CLIENT_EMAIL: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
      FIREBASE_PRIVATE_KEY: Boolean(rawKey),
      NEXT_PUBLIC_FIREBASE_PROJECT_ID:
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? null,
      // Their presence against a real project is itself a fault.
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST || null,
      FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST || null,
    },

    privateKeyShape: {
      length: rawKey.length,
      hasBeginMarker: rawKey.includes("-----BEGIN PRIVATE KEY-----"),
      hasEndMarker: rawKey.includes("-----END PRIVATE KEY-----"),
      hasEscapedNewlines: rawKey.includes("\\n"),
      hasRealNewlines: rawKey.includes("\n"),
      startsWithWhitespace: /^\s/.test(rawKey),
      wrappedInQuotes: /^["']|["']$/.test(rawKey),
    },
  };

  // Each step separately, so the first thing to break is unambiguous.
  try {
    const { getDb } = await import("@/lib/firebase/admin");
    report.step1_moduleImport = "ok";

    const db = getDb();
    report.step2_initialiseSdk = "ok";

    const snapshot = await db.collection("products").limit(1).get();
    report.step3_firestoreRead = `ok — ${snapshot.size} document(s)`;

    const { getAdminAuth } = await import("@/lib/firebase/admin");
    const users = await getAdminAuth().listUsers(1);
    report.step4_adminAuth = `ok — ${users.users.length} account(s)`;

    const { getProductBySlug } = await import("@/lib/data/products");
    const product = await getProductBySlug("pt", "cheesecake-frutos-vermelhos");
    report.step5_dataLayer = product ? `ok — ${product.name}` : "returned null";
  } catch (error) {
    report.failure = describeError(error);
  }

  return NextResponse.json(report, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
