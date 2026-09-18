/**
 * Grants, revokes and lists access to the admin area.
 *
 *   npm run admin:grant                           create/update, prompt for password
 *   npm run admin:grant -- --generate             generate a password, show it once
 *   npm run admin:grant -- --email ana@palaciodoce.pt --name "Ana Silva"
 *   npm run admin:revoke -- --email ana@palaciodoce.pt
 *   npm run admin:list
 *
 * For automation, pipe the password instead of typing it:
 *
 *   echo "$PASSWORD" | npm run admin:grant -- --password-stdin
 *
 * Access is two things, and this script always changes both together:
 *
 *   1. A Firebase Auth account with the `admin: true` custom claim. The claim
 *      travels inside the session cookie, so checking it costs nothing.
 *   2. A document at `adminUsers/{uid}`, read on every request.
 *
 * Both are required to get in (see src/lib/admin-auth.ts). The pair exists
 * because a custom claim is baked into the token and keeps working until it
 * refreshes — up to an hour. Deleting the document ends the session now.
 *
 * Passwords are never taken as a command-line argument: anything typed as an
 * argument lands in shell history and is visible to every other process in the
 * process list. They are prompted for with the echo suppressed, or generated
 * here and printed once.
 */
import "dotenv/config";
import { createInterface } from "node:readline";
import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { UserRecord } from "firebase-admin/auth";
import { getAdminAuth, getDb } from "../src/lib/firebase/admin";
import { reportTarget } from "./target";
import { COLLECTIONS } from "../src/lib/firebase/collections";

const MIN_PASSWORD_LENGTH = 12;
const DEFAULT_NAME = "Administração Palácio Doce";

// ---------------------------------------------------------------------------
// Argument handling
// ---------------------------------------------------------------------------

type Command = "grant" | "revoke" | "list";

function readCommand(): Command {
  const raw = process.argv[2];
  if (raw === "grant" || raw === "revoke" || raw === "list") return raw;
  throw new Error(
    `Unknown command ${raw ? `"${raw}"` : "(none given)"}. ` +
      "Use: npm run admin:grant | admin:revoke | admin:list",
  );
}

function flagValue(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  // Guard against `--email --generate` swallowing the next flag as a value.
  return value && !value.startsWith("--") ? value : undefined;
}

function requireEmail(): string {
  const email = (flagValue("email") ?? process.env.ADMIN_EMAIL ?? "").trim();
  if (!email) {
    throw new Error(
      "No email given. Pass --email someone@palaciodoce.pt, or set ADMIN_EMAIL in .env.",
    );
  }
  // Firebase stores the address as given but matches case-insensitively;
  // lowercasing keeps our own records consistent with the allowlist lookups.
  return email.toLocaleLowerCase();
}

// ---------------------------------------------------------------------------
// Password input
// ---------------------------------------------------------------------------

/** Reads a line from the terminal without echoing what is typed. */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    const output = rl as unknown as { output?: { write: (s: string) => void } };
    const original = output.output?.write.bind(output.output);
    let muted = false;

    if (original && output.output) {
      output.output.write = (chunk: string) => {
        if (!muted) original(chunk);
      };
    }

    rl.question(question, (answer) => {
      muted = false;
      if (original && output.output) output.output.write = original;
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });

    muted = true;
  });
}

/**
 * A strong password that can still be read aloud or copied by hand: base64url
 * entropy with the visually ambiguous characters stripped out.
 */
function generatePassword(): string {
  return randomBytes(24)
    .toString("base64url")
    .replace(/[-_0OlI1]/g, "")
    .slice(0, 20);
}

/** Reads the whole of stdin, for the `--password-stdin` path. */
function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      buffer += chunk;
    });
    process.stdin.on("end", () => resolve(buffer));
    process.stdin.on("error", reject);
  });
}

async function resolvePassword(): Promise<{
  password: string;
  wasGenerated: boolean;
}> {
  if (process.argv.includes("--generate")) {
    // Generated passwords are well over the minimum by construction.
    return { password: generatePassword(), wasGenerated: true };
  }

  /*
    `--password-stdin` exists for automation — CI, a provisioning script, the
    auth test suite. Piping keeps the password out of argv and therefore out of
    shell history and the process list, which is the same reason there is no
    `--password` flag.
  */
  if (process.argv.includes("--password-stdin")) {
    const password = (await readStdin()).trim();
    if (!password) {
      throw new Error("--password-stdin was given but nothing arrived on stdin.");
    }
    return { password: assertStrongEnough(password), wasGenerated: false };
  }

  const password = (await promptHidden("Password: ")).trim();
  const confirmation = (await promptHidden("Confirm password: ")).trim();

  if (password !== confirmation) {
    throw new Error("Passwords do not match.");
  }

  return { password: assertStrongEnough(password), wasGenerated: false };
}

/**
 * Firebase itself only requires six characters. That is far too short for an
 * account that can read every customer's address, so the floor is raised here.
 */
function assertStrongEnough(password: string): string {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters (got ${password.length}).`,
    );
  }
  return password;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * Finds a Firebase account by email, or null.
 *
 * "Not found" is an expected outcome here, not an error, so it is translated
 * into null. Every other failure — bad credentials, no network, wrong project —
 * is rethrown, because silently treating those as "no such user" would lead to
 * creating a duplicate account somewhere unexpected.
 */
async function findUser(email: string): Promise<UserRecord | null> {
  try {
    return await getAdminAuth().getUserByEmail(email);
  } catch (error: unknown) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code: unknown }).code
        : null;
    if (code === "auth/user-not-found") return null;
    throw error;
  }
}

async function grant() {
  const email = requireEmail();
  const name = flagValue("name") ?? DEFAULT_NAME;
  const auth = getAdminAuth();

  // Look the account up first, so we know whether we are creating or updating
  // and can tell the operator which happened.
  let user = await findUser(email);
  const isNewAccount = user === null;

  const { password, wasGenerated } = await resolvePassword();

  if (user) {
    await auth.updateUser(user.uid, { password, displayName: name });
  } else {
    user = await auth.createUser({
      email,
      password,
      displayName: name,
      /*
        Marked verified because this address was not confirmed by an email
        round trip — it was typed by whoever holds the service account. Leaving
        it false would only misrepresent the account as awaiting a
        verification it will never receive.
      */
      emailVerified: true,
    });
  }

  /*
    Merge rather than replace. `setCustomUserClaims` overwrites the whole claims
    object, so writing `{ admin: true }` blind would silently drop any other
    claim the account carries.
  */
  await auth.setCustomUserClaims(user.uid, {
    ...(user.customClaims ?? {}),
    admin: true,
  });

  await getDb()
    .collection(COLLECTIONS.adminUsers)
    .doc(user.uid)
    .set(
      {
        email,
        name,
        role: "admin",
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      // Merge so re-running on an existing administrator keeps the original
      // createdAt rather than resetting the audit trail.
      { merge: true },
    );

  /*
    Invalidate anything already issued. If this run was a password reset — the
    likely reason being a suspected compromise — leaving the old sessions alive
    would defeat the point.
  */
  await auth.revokeRefreshTokens(user.uid);

  report(isNewAccount ? "Administrator created" : "Administrator updated");
  console.log(`  email: ${email}`);
  console.log(`  uid:   ${user.uid}`);

  if (wasGenerated) {
    console.log(`  password: ${password}`);
    console.log(
      "\n  Put it in a password manager now. It is stored only as a hash and cannot be shown again.",
    );
  }

  console.log("\n  Sign in at /admin/login");
}

async function revoke() {
  const email = requireEmail();
  const auth = getAdminAuth();

  const user = await findUser(email);

  if (!user) {
    throw new Error(`No Firebase account exists for ${email}.`);
  }

  // Order matters. Delete the allowlist document first: it is the check that
  // takes effect immediately, so access is gone before anything else runs.
  await getDb().collection(COLLECTIONS.adminUsers).doc(user.uid).delete();

  const remaining = { ...(user.customClaims ?? {}) };
  delete remaining.admin;
  await auth.setCustomUserClaims(
    user.uid,
    Object.keys(remaining).length > 0 ? remaining : null,
  );

  // Kills the current session cookie too — `getAdminSession` verifies against
  // revocation on every request.
  await auth.revokeRefreshTokens(user.uid);

  report("Admin access revoked");
  console.log(`  email: ${email}`);
  console.log(`  uid:   ${user.uid}`);
  console.log(
    "\n  The Firebase account still exists and can be granted access again.\n" +
      "  To remove it entirely, delete the user in Firebase Console → Authentication.",
  );
}

async function list() {
  const auth = getAdminAuth();
  const snapshot = await getDb().collection(COLLECTIONS.adminUsers).get();

  report(
    snapshot.empty
      ? "No administrators"
      : `${snapshot.size} administrator${snapshot.size === 1 ? "" : "s"}`,
  );

  if (snapshot.empty) {
    console.log(
      "\n  Nobody can sign in to /admin. Create the first administrator with:\n" +
        "    npm run admin:grant -- --email you@palaciodoce.pt --generate",
    );
    return;
  }

  for (const doc of snapshot.docs) {
    const data = doc.data();

    /*
      Report the claim alongside the document rather than trusting either on
      its own. The two can drift — a claim set by hand in the console, or a
      document deleted directly in Firestore — and a mismatch is worth seeing,
      because the sign-in path requires both.
    */
    const user = await auth.getUser(doc.id).catch(() => null);
    const hasClaim = user?.customClaims?.admin === true;

    const state = !user
      ? "✗ no Firebase account (stale document)"
      : hasClaim
        ? "✓ claim set"
        : "✗ claim missing — cannot sign in, re-run admin:grant";

    console.log(`\n  ${data.email ?? user?.email ?? "(unknown email)"}`);
    console.log(`    uid:   ${doc.id}`);
    console.log(`    name:  ${data.name ?? "—"}`);
    console.log(`    state: ${state}`);
  }
}

// ---------------------------------------------------------------------------

/**
 * Names the target before reporting anything, because "administrator created"
 * means very different things against a throwaway emulator and against the
 * live shop.
 */
function report(headline: string) {
  reportTarget(headline);
}

async function main() {
  const command = readCommand();

  if (command === "grant") await grant();
  else if (command === "revoke") await revoke();
  else await list();
}

main().catch((error: unknown) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
