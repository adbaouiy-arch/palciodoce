"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  type Auth,
} from "firebase/auth";

/**
 * Client-side Firebase, used for exactly one thing: signing an administrator
 * in on `/admin/login`.
 *
 * Nothing else in the storefront touches Firebase from the browser. Pages are
 * server-rendered and read Firestore through the Admin SDK, which is why the
 * security rules can forbid client writes outright.
 *
 * The values below are `NEXT_PUBLIC_*` and ship in the bundle. That is normal
 * and safe: a Firebase web API key is an identifier, not a secret — it says
 * *which* project to talk to, not what you may do there. Authorisation comes
 * from Firebase Auth plus the security rules. The key is worth no more to an
 * attacker than the project ID already visible in any network request.
 */

const APP_NAME = "palaciodoce-client";

function readConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!apiKey || !authDomain || !projectId) {
    throw new Error(
      "Firebase web config is incomplete. Set NEXT_PUBLIC_FIREBASE_API_KEY, " +
        "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN and NEXT_PUBLIC_FIREBASE_PROJECT_ID " +
        "in .env (Firebase Console → Project settings → Your apps → Web app).",
    );
  }

  return {
    apiKey,
    authDomain,
    projectId,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  };
}

let cachedAuth: Auth | null = null;

export function getClientAuth(): Auth {
  if (cachedAuth) return cachedAuth;

  const app: FirebaseApp = getApps().some((a) => a.name === APP_NAME)
    ? getApp(APP_NAME)
    : initializeApp(readConfig(), APP_NAME);

  const auth = getAuth(app);

  /*
    Point at the Auth emulator during local development, so signing in never
    creates or locks out a real account. Guarded by an explicit flag rather
    than inferred from NODE_ENV: connecting to a non-existent emulator fails
    confusingly, and it must never happen in a deployed build.
  */
  const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (emulatorHost) {
    connectAuthEmulator(auth, `http://${emulatorHost}`, {
      disableWarnings: true,
    });
  }

  cachedAuth = auth;
  return auth;
}
