/**
 * An authenticated Google API client, built from the same credentials the
 * application uses.
 *
 * `new GoogleAuth()` on its own looks for Application Default Credentials — a
 * `GOOGLE_APPLICATION_CREDENTIALS` path, or gcloud's local login. Neither is how
 * this project stores its service account: `.env.production` carries
 * FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, because that is the shape a
 * hosting dashboard accepts.
 *
 * So the scripts that call the REST APIs directly — publishing rules, editing
 * the authorised sign-in domains — worked only when a
 * GOOGLE_APPLICATION_CREDENTIALS path happened to be exported in the shell, and
 * failed with an unhelpful "Could not load the default credentials" otherwise.
 * One credential source, used everywhere, fixes that.
 *
 * ADC is still honoured as a fallback, which is what makes the initial
 * `setup:production` run work before `.env.production` exists.
 */
import { GoogleAuth, type AuthClient } from "google-auth-library";

const SCOPES = ["https://www.googleapis.com/auth/cloud-platform"];

export async function googleApiClient(): Promise<AuthClient> {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (clientEmail && rawPrivateKey && projectId) {
    /*
      Same normalisation as src/lib/firebase/admin.ts: environment variables
      carry the PEM on one line with its newlines written as the two characters
      \ and n, and some dashboards add surrounding quotes.
    */
    const privateKey = rawPrivateKey
      .replace(/^["']|["']$/g, "")
      .replace(/\\n/g, "\n");

    const auth = new GoogleAuth({
      scopes: SCOPES,
      projectId,
      credentials: { client_email: clientEmail, private_key: privateKey },
    });
    return (await auth.getClient()) as AuthClient;
  }

  // No explicit credentials — fall back to ADC and let it report its own error,
  // which is accurate when that is genuinely what the caller intended.
  try {
    return (await new GoogleAuth({ scopes: SCOPES }).getClient()) as AuthClient;
  } catch (error) {
    throw new Error(
      "No Google credentials available.\n\n" +
        "Expected FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and " +
        "FIREBASE_PRIVATE_KEY,\n" +
        "which is what .env.production holds — so run this through a prod: script:\n" +
        "  npm run prod:domains\n" +
        "  npm run rules:deploy\n\n" +
        "Or point GOOGLE_APPLICATION_CREDENTIALS at a service account key file.\n\n" +
        `Underlying error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
