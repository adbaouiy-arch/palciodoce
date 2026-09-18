/**
 * Enables the Google Cloud APIs this project needs, using the service account.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=... node scripts/enable-apis.mjs
 *
 * A brand-new Firebase project has most APIs switched off. Clicking through the
 * console turns them on as a side effect, which is why this is usually
 * invisible — but it means a project provisioned from a script fails with an
 * opaque 403 until they are enabled explicitly.
 *
 * Needs `serviceusage.services.enable`, which the default Firebase Admin SDK
 * service account may not have. If it reports a permission error, the same
 * thing happens by opening the matching section of the Firebase Console once.
 */
import { GoogleAuth } from "google-auth-library";

const PROJECT = process.env.FIREBASE_PROJECT_ID ?? "palaciodoce";

const SERVICES = {
  "firestore.googleapis.com": "Firestore — the database itself",
  "identitytoolkit.googleapis.com": "Firebase Authentication",
  "firebaserules.googleapis.com": "publishing firestore.rules",
  "firebase.googleapis.com": "Firebase project management (apps, config)",
};

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});
const client = await auth.getClient();

async function isEnabled(service) {
  try {
    const response = await client.request({
      url: `https://serviceusage.googleapis.com/v1/projects/${PROJECT}/services/${service}`,
    });
    return response.data.state === "ENABLED";
  } catch {
    return null; // Cannot tell — most likely no permission to read either.
  }
}

let failures = 0;

for (const [service, why] of Object.entries(SERVICES)) {
  const already = await isEnabled(service);

  if (already === true) {
    console.log(`  already on   ${service}  (${why})`);
    continue;
  }

  try {
    await client.request({
      url: `https://serviceusage.googleapis.com/v1/projects/${PROJECT}/services/${service}:enable`,
      method: "POST",
      data: {},
    });
    console.log(`  enabled      ${service}  (${why})`);
  } catch (error) {
    const message =
      error?.response?.data?.error?.message ?? error?.message ?? String(error);
    console.log(`  FAILED       ${service}  (${why})`);
    console.log(`               ${message.split("\n")[0]}`);
    failures++;
  }
}

if (failures > 0) {
  console.log(
    `\n${failures} service(s) could not be enabled from here — most likely the\n` +
      "service account lacks serviceusage.services.enable. Enabling them by hand\n" +
      "is one visit each to the Firebase Console.",
  );
}

process.exit(failures > 0 ? 1 : 0);
