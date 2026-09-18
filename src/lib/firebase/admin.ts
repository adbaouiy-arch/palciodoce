import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Server-side Firebase, via the Admin SDK.
 *
 * Two modes:
 *
 *  - **Emulator.** When `FIRESTORE_EMULATOR_HOST` is set, the SDK talks to the
 *    local emulator and needs no credentials at all — only a project ID. This
 *    is what lets the whole application run and be tested locally without
 *    touching a real Firebase project, or possessing a service account.
 *
 *  - **Real project.** Requires a service account. Missing credentials are a
 *    hard failure in production rather than a silent fallback, because the
 *    fallback (application-default credentials) can pick up an unrelated
 *    identity and write to the wrong project.
 */

const APP_NAME = "palaciodoce-admin";

/*
  This module handles a service-account private key, so it must never execute
  in a browser.

  A `import "server-only"` guard would be the idiomatic Next.js way, but that
  specifier is resolved by Next's compiler and does not exist under plain
  `tsx` — and the migration and admin scripts import this file directly,
  outside Next. A runtime check is portable across both and still fails loudly
  rather than silently shipping a key.
*/
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/firebase/admin.ts was imported in the browser. It holds service " +
      "account credentials and is server-only — use src/lib/firebase/client.ts " +
      "for anything that runs in a browser.",
  );
}

/**
 * Next.js re-evaluates modules on hot reload, and `initializeApp` throws if
 * the named app already exists. Caching on `globalThis` keeps one instance
 * across reloads in development.
 */
const globalForFirebase = globalThis as unknown as {
  __palacioDoceFirebase?: { app: App; db: Firestore; auth: Auth };
};

function usingEmulator(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

/**
 * Refuses the one configuration that is always a mistake, and announces which
 * database the process is about to use.
 *
 * The mistake: a real project id together with an emulator host. Firebase's own
 * convention is that a project id starting with `demo-` cannot exist for real,
 * so `demo-palaciodoce` plus an emulator is deliberate local work, while
 * `palaciodoce` plus an emulator is a leftover environment variable.
 *
 * It is worth a hard failure because of how quietly it goes wrong. The emulator
 * happily serves an empty datastore under any project id — no error, no warning.
 * Prerendered pages keep serving their build-time content, so the site looks
 * fine while every page rendered on demand returns "not found". Diagnosing that
 * from the outside takes a long time; failing here takes a second.
 *
 * Note `dotenv` never overrides a variable already in the environment, which is
 * how the leftover survives in the first place.
 */
function assertSaneTarget(projectId: string) {
  if (usingEmulator() && !projectId.startsWith("demo-")) {
    throw new Error(
      `Refusing to start: FIREBASE_PROJECT_ID is "${projectId}" but ` +
        `FIRESTORE_EMULATOR_HOST is set to "${process.env.FIRESTORE_EMULATOR_HOST}".\n\n` +
        "That combination points a real project id at the local emulator, which\n" +
        "serves an empty database without complaining — prerendered pages keep\n" +
        "working while everything dynamic returns 404.\n\n" +
        "Either:\n" +
        "  - use the emulator, and set FIREBASE_PROJECT_ID=demo-palaciodoce, or\n" +
        "  - use the real project, and unset FIRESTORE_EMULATOR_HOST and\n" +
        "    FIREBASE_AUTH_EMULATOR_HOST.\n\n" +
        "A stale exported variable is the usual cause: `dotenv` does not override\n" +
        "what is already in the environment, so .env loses to your shell.",
    );
  }

  // One line, at startup, naming the target. In a hosting provider's logs this
  // is the difference between "which database is this talking to?" being a
  // question and being a fact.
  console.log(
    usingEmulator()
      ? `[firebase] emulator at ${process.env.FIRESTORE_EMULATOR_HOST}, project ${projectId}`
      : `[firebase] live project ${projectId}`,
  );
}

function readServiceAccount() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawPrivateKey) {
    const missing = [
      !projectId && "FIREBASE_PROJECT_ID",
      !clientEmail && "FIREBASE_CLIENT_EMAIL",
      !rawPrivateKey && "FIREBASE_PRIVATE_KEY",
    ].filter(Boolean);

    throw new Error(
      `Firebase Admin credentials are incomplete. Missing: ${missing.join(", ")}.\n` +
        "Download a service account key from Firebase Console → Project settings →\n" +
        "Service accounts, then set those three values in .env.\n" +
        "For local development instead, run `npm run emulators` and set\n" +
        "FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 — no credentials needed.",
    );
  }

  /*
    Private keys are multi-line PEM. Environment variables (and every hosting
    dashboard) carry them as a single line with the newlines escaped as the two
    characters \ and n, so they have to be turned back into real newlines or
    the SDK rejects the key. Surrounding quotes are stripped too, since some
    dashboards add them.
  */
  const privateKey = rawPrivateKey
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");

  return { projectId, clientEmail, privateKey };
}

function createFirebase() {
  const existing = getApps().find((app) => app.name === APP_NAME);

  let app: App;
  if (existing) {
    app = getApp(APP_NAME);
  } else if (usingEmulator()) {
    // The emulator authenticates nothing; a project ID is all it needs, and it
    // must match the one the emulator was started with.
    const projectId = process.env.FIREBASE_PROJECT_ID ?? "demo-palaciodoce";
    assertSaneTarget(projectId);
    app = initializeApp({ projectId }, APP_NAME);
  } else {
    const serviceAccount = readServiceAccount();
    assertSaneTarget(serviceAccount.projectId);
    app = initializeApp(
      {
        credential: cert(serviceAccount),
        projectId: serviceAccount.projectId,
      },
      APP_NAME,
    );
  }

  const db = getFirestore(app);

  // Firestore throws on an `undefined` field value. The data layer normalises
  // optional fields to `null` on the way in and out, but this is a cheap
  // backstop against one slipping through and taking down a write path.
  //
  // `settings` may only be called once per instance, hence the guard.
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Already configured on a reused instance.
  }

  return { app, db, auth: getAuth(app) };
}

function firebase() {
  globalForFirebase.__palacioDoceFirebase ??= createFirebase();
  return globalForFirebase.__palacioDoceFirebase;
}

/** Firestore, via the Admin SDK. Bypasses security rules by design. */
export function getDb(): Firestore {
  return firebase().db;
}

/** Firebase Auth, via the Admin SDK — token verification, session cookies, claims. */
export function getAdminAuth(): Auth {
  return firebase().auth;
}

/** True when pointed at the local emulator rather than a real project. */
export function isEmulated(): boolean {
  return usingEmulator();
}
