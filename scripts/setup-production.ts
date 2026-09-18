/**
 * Provisions the real Firebase project, end to end.
 *
 *   npm run setup:production
 *   npm run setup:production -- --key ~/.config/palaciodoce/service-account.json
 *
 * Runs through everything that can be done from a service account:
 *
 *   1. Check Firestore exists and is reachable.
 *   2. Check its region is in the EU — the privacy policy says so in writing.
 *   3. Find or create the web app, and read its SDK config.
 *   4. Write `.env.production`, generating a fresh AUTH_SECRET.
 *   5. Turn on Email/Password sign-in, if permitted.
 *   6. Publish firestore.rules and the composite indexes.
 *   7. Seed the catalogue and legal pages, and import the existing orders.
 *   8. Create the first administrator, if there isn't one.
 *
 * Idempotent throughout: safe to re-run after fixing whatever it complained
 * about. It never overwrites an existing AUTH_SECRET and never resets the
 * password of an administrator who already exists.
 *
 * Each step reports and then stops at the first thing it cannot do, with the
 * exact console URL for it, rather than carrying on and failing later somewhere
 * less obvious.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { GoogleAuth, type AuthClient } from "google-auth-library";

const ENV_FILE = ".env.production";
const DEFAULT_KEY = `${homedir()}/.config/palaciodoce/service-account.json`;

/** Firestore regions inside the EU. Multi-region `eur3` counts. */
const EU_LOCATIONS = new Set([
  "eur3",
  "europe-west1",
  "europe-west2",
  "europe-west3",
  "europe-west4",
  "europe-west6",
  "europe-west8",
  "europe-west9",
  "europe-west10",
  "europe-west12",
  "europe-central2",
  "europe-north1",
  "europe-southwest1",
]);

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

function step(n: number, title: string) {
  console.log(`\n${bold(`${n}. ${title}`)}`);
}
const ok = (msg: string) => console.log(`   ${green("✓")} ${msg}`);
const note = (msg: string) => console.log(`   ${dim(msg)}`);
const warn = (msg: string) => console.log(`   ${yellow("!")} ${msg}`);

/**
 * A failure the operator has to resolve in the console, carrying the URL.
 * Distinguished from an unexpected crash so the output stays actionable.
 */
class NeedsYou extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly instructions: string[],
  ) {
    super(message);
  }
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const value = process.argv[i + 1];
  return i === -1 || !value || value.startsWith("--") ? undefined : value;
}

// ---------------------------------------------------------------------------
// Service account
// ---------------------------------------------------------------------------

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function readServiceAccount(): { path: string; account: ServiceAccount } {
  const path =
    flag("key") ?? process.env.GOOGLE_APPLICATION_CREDENTIALS ?? DEFAULT_KEY;

  if (!existsSync(path)) {
    throw new Error(
      `No service account key at ${path}.\n` +
        "Download one from Firebase Console → Project settings → Service accounts →\n" +
        "Generate new private key, save it outside this repository, then pass it:\n" +
        "  npm run setup:production -- --key /path/to/key.json",
    );
  }

  const account = JSON.parse(readFileSync(path, "utf8")) as ServiceAccount;
  for (const field of ["project_id", "client_email", "private_key"] as const) {
    if (!account[field]) {
      throw new Error(`${path} is missing "${field}" — is it a service account key?`);
    }
  }

  // Everything downstream reads these, including the data modules.
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path;
  process.env.FIREBASE_PROJECT_ID = account.project_id;
  process.env.FIREBASE_CLIENT_EMAIL = account.client_email;
  process.env.FIREBASE_PRIVATE_KEY = account.private_key;

  /*
    Belt and braces. `.env` sets these to point at the emulator, and if anything
    in the import chain has already loaded it, the Admin SDK would quietly talk
    to localhost while this script reports success against production.
  */
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

  return { path, account };
}

// ---------------------------------------------------------------------------

let authClient: AuthClient;

async function api<T>(
  url: string,
  init: { method?: string; data?: unknown } = {},
): Promise<T> {
  const response = await authClient.request<T>({
    url,
    method: init.method ?? "GET",
    ...(init.data === undefined ? {} : { data: init.data }),
  });
  return response.data;
}

function apiError(error: unknown): { code: number; message: string } {
  const response = (error as { response?: { data?: { error?: { message?: string } }; status?: number } })
    .response;
  return {
    code: response?.status ?? 0,
    message:
      response?.data?.error?.message ??
      (error instanceof Error ? error.message : String(error)),
  };
}

// ---------------------------------------------------------------------------
// 1 + 2. Firestore exists, and lives in the EU
// ---------------------------------------------------------------------------

async function checkFirestore(project: string) {
  step(1, "Firestore database");

  let database: { locationId?: string; name?: string; type?: string };
  try {
    database = await api(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)`,
    );
  } catch (error) {
    const { code, message } = apiError(error);

    if (code === 403 && message.includes("has not been used in project")) {
      throw new NeedsYou(
        "The Firestore API is not enabled, so no database exists yet.",
        `https://console.firebase.google.com/project/${project}/firestore`,
        [
          'Click "Create database".',
          'Choose "Start in production mode" — this project\'s rules are deployed from',
          "  firestore.rules in step 6, and test mode would leave it open to the internet",
          "  for 30 days in the meantime.",
          "",
          `Set the location to ${bold("europe-west1")} (Belgium).`,
          "This cannot be changed later, and the privacy policy states that customer",
          "data is held in the EU.",
        ],
      );
    }

    if (code === 404) {
      throw new NeedsYou(
        "The Firestore API is on, but no default database has been created.",
        `https://console.firebase.google.com/project/${project}/firestore`,
        [
          'Click "Create database", production mode,',
          `location ${bold("europe-west1")}.`,
        ],
      );
    }

    throw error;
  }

  const location = database.locationId ?? "unknown";
  ok(`exists — ${database.type ?? "FIRESTORE_NATIVE"} in ${location}`);

  step(2, "Data residency");
  if (!EU_LOCATIONS.has(location)) {
    /*
      Hard stop, not a warning. The privacy policy tells customers their data is
      held in the EU, and a Firestore location is fixed at creation — so the only
      ways out are a new project or an amended policy. Neither is something to
      discover after taking orders.
    */
    throw new Error(
      `The database is in ${red(location)}, which is outside the EU.\n\n` +
        "data/catalogue.json commits, in three languages, to holding customer data\n" +
        "in a European Union region. A Firestore location cannot be changed after\n" +
        "creation, so this needs one of:\n\n" +
        "  - a new Firebase project with the location set to europe-west1, or\n" +
        "  - the privacy policy amended to state the real region.\n\n" +
        "Setup stopped rather than quietly making the policy untrue.",
    );
  }
  ok(`${location} is in the EU, which matches the privacy policy`);
}

// ---------------------------------------------------------------------------
// 3. Web app + SDK config
// ---------------------------------------------------------------------------

type WebConfig = {
  appId: string;
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
};

async function resolveWebApp(project: string): Promise<WebConfig> {
  step(3, "Web app");

  const list = await api<{ apps?: Array<{ appId: string; displayName?: string }> }>(
    `https://firebase.googleapis.com/v1beta1/projects/${project}/webApps`,
  );

  let appId = list.apps?.[0]?.appId;

  if (appId) {
    ok(`using existing web app ${appId}`);
  } else {
    note("no web app yet — creating one");
    // Returns a long-running operation; the app id arrives in its response.
    const operation = await api<{ name: string; done?: boolean; response?: { appId: string } }>(
      `https://firebase.googleapis.com/v1beta1/projects/${project}/webApps`,
      { method: "POST", data: { displayName: "Palácio Doce" } },
    );

    appId = operation.response?.appId;

    // Poll if it did not finish inline.
    for (let attempt = 0; !appId && attempt < 20; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const polled = await api<{ done?: boolean; response?: { appId: string } }>(
        `https://firebase.googleapis.com/v1beta1/${operation.name}`,
      );
      if (polled.done) appId = polled.response?.appId;
    }

    if (!appId) throw new Error("Timed out waiting for the web app to be created.");
    ok(`created web app ${appId}`);
  }

  const config = await api<WebConfig>(
    `https://firebase.googleapis.com/v1beta1/projects/${project}/webApps/${appId}/config`,
  );
  ok(`read its SDK config (apiKey ${config.apiKey.slice(0, 8)}…)`);

  return config;
}

// ---------------------------------------------------------------------------
// 4. .env.production
// ---------------------------------------------------------------------------

function writeEnv(account: ServiceAccount, config: WebConfig) {
  step(4, ENV_FILE);

  /*
    Never regenerate an AUTH_SECRET that already exists. It signs the
    order-confirmation access tokens, so replacing it would invalidate the link
    in every confirmation email already sent.
  */
  let authSecret: string | null = null;
  if (existsSync(ENV_FILE)) {
    const existing = readFileSync(ENV_FILE, "utf8");
    const match = existing.match(/^AUTH_SECRET="?([^"\n]+)"?$/m);
    if (match?.[1] && match[1].length >= 32) {
      authSecret = match[1];
      note("keeping the existing AUTH_SECRET");
    }
  }
  if (!authSecret) {
    authSecret = randomBytes(48).toString("base64");
    ok("generated a new AUTH_SECRET");
  }

  // Newlines in the PEM become the two characters \n, which is what every
  // hosting dashboard expects and what src/lib/firebase/admin.ts converts back.
  const privateKey = account.private_key.replace(/\n/g, "\\n");

  const contents = `# Production configuration for ${account.project_id}.
# Written by: npm run setup:production
#
# SECRET. Gitignored, and it must stay that way. When deploying, copy these
# into the host's environment-variable settings rather than uploading the file.

# --- Emulator, explicitly off ----------------------------------------------
# These are blanked rather than omitted, and it matters.
#
# Next.js layers .env.production ON TOP of .env — it does not replace it. .env
# points at the local emulator, so a variable only set there survives into a
# production build. Leaving these out means building the real project with
# FIRESTORE_EMULATOR_HOST still set, which reads an empty database: prerendered
# pages keep working while everything dynamic returns 404.
#
# Empty counts as off (src/lib/firebase/admin.ts tests for a truthy value), and
# that file refuses to start on a real project id with an emulator host set.
FIRESTORE_EMULATOR_HOST=""
FIREBASE_AUTH_EMULATOR_HOST=""
NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=""

AUTH_SECRET="${authSecret}"

# Default address for prod:grant / prod:revoke.
ADMIN_EMAIL="admin@palaciodoce.pt"

# --- Server (Admin SDK) ----------------------------------------------------
FIREBASE_PROJECT_ID="${account.project_id}"
FIREBASE_CLIENT_EMAIL="${account.client_email}"
FIREBASE_PRIVATE_KEY="${privateKey}"

# --- Browser ---------------------------------------------------------------
# These ship in the client bundle, which is expected: a web API key identifies
# the project, it does not grant access. Authorisation is Firebase Auth plus
# firestore.rules.
NEXT_PUBLIC_FIREBASE_API_KEY="${config.apiKey}"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${config.authDomain}"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="${config.projectId}"
NEXT_PUBLIC_FIREBASE_APP_ID="${config.appId}"
${config.storageBucket ? `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="${config.storageBucket}"\n` : ""}${config.messagingSenderId ? `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${config.messagingSenderId}"\n` : ""}`;

  writeFileSync(ENV_FILE, contents, { encoding: "utf8", mode: 0o600 });
  ok(`wrote ${ENV_FILE} (mode 600)`);
}

// ---------------------------------------------------------------------------
// 5. Email/Password sign-in
// ---------------------------------------------------------------------------

async function enableEmailPassword(project: string) {
  step(5, "Email/Password sign-in");

  const configUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;

  let current: { signIn?: { email?: { enabled?: boolean; passwordRequired?: boolean } } };
  try {
    current = await api(configUrl);
  } catch (error) {
    const { code, message } = apiError(error);
    if (code === 403 || code === 404) {
      throw new NeedsYou(
        "Firebase Authentication has not been initialised on this project.",
        `https://console.firebase.google.com/project/${project}/authentication`,
        [
          'Click "Get started".',
          'Under Sign-in method, enable ' + bold("Email/Password") + ".",
          "Leave every other provider off, and do not enable email link sign-in.",
          "",
          dim(`(${message.split("\n")[0]})`),
        ],
      );
    }
    throw error;
  }

  if (current.signIn?.email?.enabled) {
    ok("already enabled");
    return;
  }

  try {
    await api(`${configUrl}?updateMask=signIn.email.enabled,signIn.email.passwordRequired`, {
      method: "PATCH",
      // `passwordRequired: true` keeps it to passwords only. Without it, the
      // provider also accepts email-link sign-in, which is a second way in that
      // nothing here needs.
      data: { signIn: { email: { enabled: true, passwordRequired: true } } },
    });
    ok("enabled, password-only (no email-link sign-in)");
  } catch (error) {
    const { message } = apiError(error);
    throw new NeedsYou(
      `Could not enable it from here: ${message.split("\n")[0]}`,
      `https://console.firebase.google.com/project/${project}/authentication/providers`,
      ["Enable " + bold("Email/Password") + ". Leave email link sign-in off."],
    );
  }
}

// ---------------------------------------------------------------------------
// 6-8. Shell out to the existing commands
// ---------------------------------------------------------------------------

/** Things that still need a human, collected and reported at the end. */
const pending: string[] = [];

/**
 * Runs a sibling script with production env, showing the tail of its output.
 *
 * `tolerate` lists exit codes that mean "partly done, and it explained why"
 * rather than "broken". Those are surfaced in the closing summary instead of
 * aborting the run, so one missing permission does not block the other steps.
 */
function run(
  label: string,
  command: string,
  args: string[],
  { tolerate = [] as number[], lines = 6 } = {},
): number {
  note(`$ ${command} ${args.join(" ")}`);
  try {
    const output = execFileSync(command, args, {
      encoding: "utf8",
      env: { ...process.env, DOTENV_CONFIG_PATH: ENV_FILE },
      stdio: ["inherit", "pipe", "pipe"],
    });
    for (const line of output.trimEnd().split("\n").slice(-lines)) {
      if (line.trim()) console.log(`     ${dim(line.trim())}`);
    }
    ok(label);
    return 0;
  } catch (error) {
    const shown = error as { stdout?: string; stderr?: string; status?: number };
    const detail = `${shown.stdout ?? ""}${shown.stderr ?? ""}`.trimEnd();
    const code = shown.status ?? 1;

    if (tolerate.includes(code)) {
      // The script has already printed its own explanation; show all of it.
      for (const line of detail.split("\n")) console.log(`   ${line}`);
      return code;
    }

    throw new Error(`${label} failed:\n${detail}`);
  }
}

async function main() {
  const { path, account } = readServiceAccount();
  const project = account.project_id;

  console.log(bold(`\nSetting up Firebase project ${project}`));
  note(`key: ${path}`);
  note(`identity: ${account.client_email}`);

  authClient = (await new GoogleAuth({
    keyFilename: path,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  }).getClient()) as AuthClient;

  await checkFirestore(project);
  const config = await resolveWebApp(project);
  writeEnv(account, config);
  await enableEmailPassword(project);

  step(6, "Security rules and indexes");
  // Exit 3 from deploy-rules means the rules published but index creation needs
  // a permission grant. Worth continuing: the security rules are the part that
  // must not be left undone.
  const rulesCode = run(
    "published firestore.rules and the composite indexes",
    "tsx",
    ["scripts/deploy-rules.ts"],
    { tolerate: [3], lines: 4 },
  );
  if (rulesCode === 3) {
    warn("rules are live, but the composite indexes still need creating");
    pending.push(
      "Grant the service account the Cloud Datastore Index Admin role, then\n" +
        "    npm run rules:deploy\n" +
        "    (see the instructions printed in step 6 above)",
    );
  }

  step(7, "Catalogue and orders");
  run("seeded catalogue and legal pages", "tsx", ["scripts/seed-catalogue.ts"]);

  const backup = flag("orders");
  if (backup) {
    /*
      `--orders-only` matters here. The relational export also contains the
      catalogue and the informational pages as they were before the migration,
      so importing all of it straight after seeding would undo every edit since
      — which is exactly how the privacy policy reverted to a version that did
      not name Google as a processor.
    */
    run(`imported orders from ${backup}`, "tsx", [
      "scripts/import-data.ts",
      "--file",
      backup,
      "--orders-only",
    ]);
  } else {
    note("no --orders <file> given, so no historical orders were imported");
    note("to bring them across: --orders backups/export-<timestamp>.json");
  }

  step(8, "Administrator");
  const { getAdminAuth, getDb } = await import("../src/lib/firebase/admin");
  const existing = await getDb().collection("adminUsers").limit(1).get();

  if (!existing.empty) {
    ok("an administrator already exists — not touching their password");
    note("to add another: npm run prod:grant -- --email someone@palaciodoce.pt --generate");
  } else {
    run("created the first administrator", "tsx", [
      "scripts/admin-access.ts",
      "grant",
      "--generate",
    ]);
    warn("the password above is shown once — save it in a password manager now");
  }

  // Prove the whole chain works rather than assuming it does.
  step(9, "Verification");
  const products = await getDb().collection("products").where("isActive", "==", true).get();
  ok(`${products.size} active products readable from the live database`);
  const users = await getAdminAuth().listUsers(5);
  ok(`${users.users.length} Firebase Auth account(s)`);

  if (pending.length > 0) {
    console.log(`\n${yellow("─".repeat(70))}`);
    console.log(yellow(bold(`  ${pending.length} thing(s) still to do`)));
    console.log(yellow("─".repeat(70)));
    for (const item of pending) console.log(`\n  - ${item}`);
    console.log("");
  }

  console.log(
    `\n${green(bold(pending.length ? "Mostly done." : "Done."))} ${project} is provisioned.\n`,
  );
  console.log("  Next:");
  console.log("    npm run prod:list          who can sign in");
  console.log("    npm run prod:export        back up live data");
  console.log(`\n  When deploying, copy the values from ${ENV_FILE} into the host's`);
  console.log("  environment settings. Do not upload the file itself.\n");
}

main().catch((error: unknown) => {
  if (error instanceof NeedsYou) {
    console.log(`\n${yellow("─".repeat(70))}`);
    console.log(yellow(bold("  This step needs you")));
    console.log(yellow("─".repeat(70)));
    console.log(`\n  ${error.message}\n`);
    console.log(`  ${bold("Open:")} ${error.url}\n`);
    for (const line of error.instructions) {
      console.log(line ? `    ${line}` : "");
    }
    console.log(`\n  Then re-run: ${bold("npm run setup:production")}`);
    console.log("  It picks up where it left off.\n");
    process.exit(2);
  }

  console.error(`\n${red("✗")} ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
