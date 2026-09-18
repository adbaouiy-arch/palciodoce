/**
 * End-to-end tests for admin sign-in, against the emulators and a dev server.
 *
 *   npm run emulators        # terminal 1
 *   npm run dev              # terminal 2
 *   npm run test:auth        # terminal 3
 *
 * This exercises the real HTTP path a browser takes: sign in at Firebase, trade
 * the ID token at /api/admin/session, then load /admin with the cookie that
 * comes back. Unit-testing the pieces would miss the parts that actually go
 * wrong — a cookie that is set but not sent, an origin check that rejects the
 * genuine form, a revocation that does not take effect.
 *
 * The negative cases are the point. Most of these assertions are about what
 * must *not* work: a stolen token from a non-administrator, a cross-site POST,
 * a session cookie that outlives the access it was granted under.
 *
 * Creates its own accounts and removes them again, so it leaves no admin
 * credentials behind and can be re-run.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const SITE = process.env.SITE_ORIGIN ?? "http://127.0.0.1:3000";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "demo-key";

const ADMIN_EMAIL = "auth-test-admin@palaciodoce.pt";
const OUTSIDER_EMAIL = "auth-test-outsider@palaciodoce.pt";
const STALE_EMAIL = "auth-test-stale@palaciodoce.pt";
const PASSWORD = "correct-horse-battery-staple";

/*
  A second Admin SDK app, separate from the application's. Used for the fixtures
  that `admin:grant` cannot express — an account with admin rights but no token
  revocation — and for teardown.
*/
const fixtureApp = initializeApp(
  { projectId: process.env.FIREBASE_PROJECT_ID ?? "demo-palaciodoce" },
  "auth-test-fixtures",
);
const fixtureAuth = getAuth(fixtureApp);
const fixtureDb = getFirestore(fixtureApp);

let passed = 0;
const failures = [];

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

function check(label, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ${green("✓")} ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ${red("✗")} ${label}${detail ? dim(` — ${detail}`) : ""}`);
  }
}

function section(title) {
  console.log(`\n${bold(title)}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Runs the admin-access CLI and fails loudly rather than continuing blind.
 *
 * The password goes in over stdin, which is the CLI's automation path — passing
 * it as an argument would put it in this process's command line.
 */
function cli(args, { input } = {}) {
  const result = spawnSync("npx", ["tsx", "scripts/admin-access.ts", ...args], {
    encoding: "utf8",
    input: input ?? "",
  });
  if (result.status !== 0) {
    throw new Error(
      `admin-access.ts ${args.join(" ")} failed:\n${result.stdout}${result.stderr}`,
    );
  }
  return result.stdout;
}

/** Creates or resets the test administrator with a known password. */
function grantTestAdmin() {
  cli(
    [
      "grant",
      "--email",
      ADMIN_EMAIL,
      "--name",
      "Auth Test",
      "--password-stdin",
    ],
    { input: PASSWORD },
  );
}

/**
 * Signs in against the Auth emulator's REST endpoint — the same call the client
 * SDK makes under the hood, minus the browser.
 */
async function signIn(email, password) {
  const response = await request(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      `Auth emulator refused sign-in for ${email}: ${JSON.stringify(body)}`,
    );
  }
  return body.idToken;
}

/** Creates a Firebase account with no admin claim and no allowlist entry. */
async function createOutsider() {
  const response = await request(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: OUTSIDER_EMAIL,
        password: PASSWORD,
        returnSecureToken: true,
      }),
    },
  );
  const body = await response.json();
  // EMAIL_EXISTS on a re-run is fine; fall back to signing in.
  if (!response.ok) return signIn(OUTSIDER_EMAIL, PASSWORD);
  return body.idToken;
}

/**
 * `fetch` with a retry on connection failure.
 *
 * Only *transport* errors are retried — a thrown fetch, not an unwanted status
 * code. Any HTTP response, including a 403 or 500, is returned as-is, so this
 * cannot mask a real failure.
 *
 * The retry is here because the target is a dev server: Turbopack recompiles on
 * demand and drops idle keep-alive connections while it does, which surfaces as
 * an opaque "fetch failed" partway through a run. Retrying the connection is the
 * correct response to that; retrying a bad status would not be.
 */
async function request(url, options = {}) {
  let lastError;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  throw new Error(
    `${options.method ?? "GET"} ${url} could not connect after 3 attempts: ${lastError}`,
  );
}

/**
 * A client IP unique to this run.
 *
 * The session endpoint is rate limited per client, and the limiter keeps its
 * windows in the dev server's memory — so without this the suite would pass
 * once and then return 429 for the next fifteen minutes. `clientKeyFromHeaders`
 * derives the bucket from `x-forwarded-for`, so a fresh address per run gives
 * each run a fresh allowance. The limit itself is asserted separately, on its
 * own address.
 */
const RUN_IP = `198.51.100.${1 + Math.floor(Math.random() * 250)}`;

/** POSTs an ID token to the session endpoint. Headers are overridable so the
 *  cross-site cases can be expressed by leaving `Origin` off or wrong. */
function postSession(
  idToken,
  { origin = SITE, omitOrigin = false, ip = RUN_IP } = {},
) {
  const headers = { "Content-Type": "application/json", "X-Forwarded-For": ip };
  if (!omitOrigin) headers.Origin = origin;

  return request(`${SITE}/api/admin/session`, {
    method: "POST",
    headers,
    body: JSON.stringify({ idToken }),
    redirect: "manual",
  });
}

/** Pulls our session cookie out of a Set-Cookie header. */
function sessionCookieFrom(response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  const match = raw.find((c) => c.startsWith("PALACIODOCE_ADMIN_SESSION="));
  return match ? match.split(";")[0] : null;
}

function getAdmin(cookie) {
  return request(`${SITE}/admin`, {
    headers: cookie ? { Cookie: cookie } : {},
    redirect: "manual",
  });
}

// ---------------------------------------------------------------------------
// The "long-forgotten sign-in" case
// ---------------------------------------------------------------------------

/**
 * A token is refused when the password behind it was entered long ago, even
 * though the token itself has not expired.
 *
 * The scenario is real. Firebase keeps a user signed in indefinitely and will
 * mint a brand-new ID token from a stored refresh token without asking for the
 * password again; `auth_time` still records the original sign-in. So on a shared
 * or stolen computer, a months-old login could otherwise be turned into a fresh
 * eight-hour admin session by visiting the site.
 *
 * Three things stand in the way, and this asserts the *outcome* rather than
 * which of them acted:
 *
 *   - `inMemoryPersistence` in the login form, so our own sign-in never leaves a
 *     refresh token on disk to be reused.
 *   - Firebase's own revocation check, which refuses any token whose `auth_time`
 *     predates the account's validity — set at creation and reset by every
 *     `admin:grant` and `admin:revoke`.
 *   - The `auth_time` window in `createAdminSession`, which is tighter still.
 *
 * Attributing the rejection to the window alone is not possible here: it would
 * need an account created more than five minutes ago with no grant or revoke
 * since, and the emulator is started fresh for each run. The window covers the
 * gap the other two leave — an old account, an old sign-in, nothing revoked in
 * between — which is reasoned rather than reproduced. Whichever fires, a stale
 * sign-in must not yield a session, and that is what is checked.
 *
 * Note on method: the `auth_time` claim is rewritten on a genuine token. That
 * works only because the Admin SDK skips signature verification when pointed at
 * the Auth emulator. It is how the case is reached at all, and is not a
 * suggestion that a token can be tampered with against a real project.
 */
async function testStaleSignIn() {
  section("A sign-in from long ago cannot open a new session");

  const user =
    (await fixtureAuth.getUserByEmail(STALE_EMAIL).catch(() => null)) ??
    (await fixtureAuth.createUser({
      email: STALE_EMAIL,
      password: PASSWORD,
      emailVerified: true,
    }));

  await fixtureAuth.setCustomUserClaims(user.uid, { admin: true });
  await fixtureDb
    .collection("adminUsers")
    .doc(user.uid)
    .set({ email: STALE_EMAIL, name: "Stale Test", role: "admin" });

  // Claims are read at sign-in, so sign in *after* setting them.
  const idToken = await signIn(STALE_EMAIL, PASSWORD);
  const [header, payload, signature] = idToken.split(".");

  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  claims.auth_time = Math.floor(Date.now() / 1000) - 30 * 60;
  const stale = [
    header,
    Buffer.from(JSON.stringify(claims)).toString("base64url"),
    signature,
  ].join(".");

  const response = await postSession(stale);
  check(
    "a token whose password was entered 30 minutes ago is refused",
    // 401 when Firebase's revocation check rejects it, 403 when our own
    // recency window does. Either is correct; being let in is not.
    response.status === 401 || response.status === 403,
    `status ${response.status}`,
  );
  check("no session cookie was issued", !sessionCookieFrom(response));

  // Control: the same re-encoding, with auth_time left alone, is accepted. Without
  // this, the assertion above could be passing merely because the token was
  // re-serialised.
  const untouched = [
    header,
    Buffer.from(
      JSON.stringify(JSON.parse(Buffer.from(payload, "base64url").toString())),
    ).toString("base64url"),
    signature,
  ].join(".");

  const control = await postSession(untouched);
  check(
    "the same token with a current auth_time is accepted",
    control.status === 200,
    `status ${control.status}`,
  );

}

/**
 * Removes every account this suite created, along with its allowlist entry.
 *
 * Non-negotiable: a test that leaves behind a working administrator with a
 * password written in its own source is worse than no test. Runs even when an
 * assertion has failed.
 */
async function teardown() {
  for (const email of [ADMIN_EMAIL, OUTSIDER_EMAIL, STALE_EMAIL]) {
    const user = await fixtureAuth.getUserByEmail(email).catch(() => null);
    if (!user) continue;
    await fixtureDb.collection("adminUsers").doc(user.uid).delete();
    await fixtureAuth.deleteUser(user.uid);
    console.log(`  ${dim("removed")} ${email}`);
  }
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(bold(`\nAdmin auth end-to-end — ${SITE}`));

  // Reachability first. Everything below reports as a failure if the dev server
  // is down, which would be a confusing way to find that out.
  const reachable = await request(SITE, { redirect: "manual" }).catch(() => null);
  if (!reachable) {
    throw new Error(
      `No dev server at ${SITE}. Start it with: npm run dev\n` +
        "The emulators must be running too: npm run emulators",
    );
  }

  section("Setup");
  grantTestAdmin();
  console.log(`  ${dim("granted")} ${ADMIN_EMAIL}`);

  // -------------------------------------------------------------------------
  section("Unauthenticated access");

  const anonymous = await getAdmin(null);
  check(
    "/admin without a cookie redirects to the login page",
    anonymous.status === 307 &&
      (anonymous.headers.get("location") ?? "").includes("/admin/login"),
    `status ${anonymous.status}, location ${anonymous.headers.get("location")}`,
  );

  const forgedCookie = await getAdmin(
    "PALACIODOCE_ADMIN_SESSION=not.a.real.session.cookie",
  );
  check(
    "/admin with a forged cookie redirects to the login page",
    forgedCookie.status === 307,
    `status ${forgedCookie.status}`,
  );

  const loginPage = await request(`${SITE}/admin/login`, { redirect: "manual" });
  const loginHtml = await loginPage.text();
  check(
    "the login page renders a password field",
    loginPage.status === 200 && loginHtml.includes('name="password"'),
    `status ${loginPage.status}`,
  );

  // -------------------------------------------------------------------------
  section("Cross-site protection");

  const adminToken = await signIn(ADMIN_EMAIL, PASSWORD);

  const noOrigin = await postSession(adminToken, { omitOrigin: true });
  check(
    "a POST with no Origin header is refused",
    noOrigin.status === 403,
    `status ${noOrigin.status}`,
  );

  const foreignOrigin = await postSession(adminToken, {
    origin: "https://evil.example",
  });
  check(
    "a POST from another origin is refused",
    foreignOrigin.status === 403,
    `status ${foreignOrigin.status}`,
  );

  check(
    "neither cross-site attempt set a session cookie",
    !sessionCookieFrom(noOrigin) && !sessionCookieFrom(foreignOrigin),
  );

  // -------------------------------------------------------------------------
  section("Token validation");

  const garbage = await postSession("not-a-jwt");
  check(
    "a malformed token is rejected",
    garbage.status === 401,
    `status ${garbage.status}`,
  );

  const emptyBody = await request(`${SITE}/api/admin/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: SITE,
      "X-Forwarded-For": RUN_IP,
    },
    body: "{}",
    redirect: "manual",
  });
  check(
    "a body with no token is a bad request",
    emptyBody.status === 400,
    `status ${emptyBody.status}`,
  );

  // -------------------------------------------------------------------------
  section("Rate limiting");

  /*
    Its own address, so exhausting the allowance does not starve the rest of the
    suite. Deliberately more attempts than the endpoint permits: the assertion is
    that guessing gets cut off, not that some particular request succeeds.
  */
  const floodIp = "203.0.113.7";
  let sawRateLimit = false;
  let retryAfter = null;

  for (let attempt = 0; attempt < 25; attempt++) {
    const response = await postSession("not-a-jwt", { ip: floodIp });
    if (response.status === 429) {
      sawRateLimit = true;
      retryAfter = response.headers.get("retry-after");
      break;
    }
  }

  check("repeated attempts from one client are cut off", sawRateLimit);
  check(
    "the refusal tells the client when to retry",
    Boolean(retryAfter) && Number(retryAfter) > 0,
    `Retry-After: ${retryAfter}`,
  );

  // -------------------------------------------------------------------------
  section("Authorisation is separate from authentication");

  const outsiderToken = await createOutsider();
  const outsider = await postSession(outsiderToken);
  check(
    "a valid Firebase login that is not on the allowlist is refused",
    outsider.status === 403,
    `status ${outsider.status}`,
  );
  check(
    "the outsider got no session cookie",
    !sessionCookieFrom(outsider),
  );

  // -------------------------------------------------------------------------
  section("The genuine sign-in");

  const success = await postSession(adminToken);
  check("the administrator's token is accepted", success.status === 200,
    `status ${success.status}`);

  const cookie = sessionCookieFrom(success);
  check("a session cookie was issued", Boolean(cookie));

  const rawCookie =
    (success.headers.getSetCookie?.() ?? []).find((c) =>
      c.startsWith("PALACIODOCE_ADMIN_SESSION="),
    ) ?? "";
  check(
    "the cookie is httpOnly, so page script cannot read it",
    /httponly/i.test(rawCookie),
    rawCookie.replace(/=[^;]+/, "=<value>"),
  );
  check(
    "the cookie is scoped SameSite=Lax",
    /samesite=lax/i.test(rawCookie),
  );

  const dashboard = await getAdmin(cookie);
  const html = await dashboard.text();
  check("/admin now renders", dashboard.status === 200, `status ${dashboard.status}`);
  check(
    "the dashboard greets the signed-in administrator by name",
    html.includes("Auth Test"),
  );
  check(
    "the dashboard lists real orders from Firestore",
    // An order number, not a translated label: the message catalogue is
    // serialised into every page, so matching UI copy would prove nothing.
    /PD-\d{8}-\d{4}/.test(html),
  );

  const loginWhileSignedIn = await request(`${SITE}/admin/login`, {
    headers: { Cookie: cookie },
    redirect: "manual",
  });
  check(
    "the login page sends an already-signed-in administrator to the dashboard",
    loginWhileSignedIn.status === 307 &&
      (loginWhileSignedIn.headers.get("location") ?? "").endsWith("/admin"),
    `status ${loginWhileSignedIn.status}, location ${loginWhileSignedIn.headers.get("location")}`,
  );

  // -------------------------------------------------------------------------
  await testStaleSignIn();

  // -------------------------------------------------------------------------
  section("Revocation takes effect immediately");

  // Same cookie as above — nothing about the browser changes. Only the
  // allowlist and the claim are removed, server-side.
  cli(["revoke", "--email", ADMIN_EMAIL]);

  const afterRevoke = await getAdmin(cookie);
  check(
    "the still-valid cookie no longer opens /admin",
    afterRevoke.status === 307,
    `status ${afterRevoke.status}`,
  );

  const reuseToken = await postSession(adminToken);
  check(
    "the old ID token cannot mint a new session either",
    reuseToken.status === 401 || reuseToken.status === 403,
    `status ${reuseToken.status}`,
  );

}

function report() {
  console.log(
    `\n${bold("Result")}  ${green(`${passed} passed`)}${
      failures.length ? `, ${red(`${failures.length} failed`)}` : ""
    }`,
  );

  if (failures.length) {
    console.log("");
    for (const failure of failures) console.log(`  ${red("✗")} ${failure}`);
  }
}

try {
  await main();
} catch (error) {
  console.error(`\n${red("✗")} ${error instanceof Error ? error.message : error}`);
  failures.push("suite aborted");
} finally {
  section("Teardown");
  await teardown().catch((error) => {
    // Loud, because the alternative is an admin account quietly left behind.
    console.error(`  ${red("✗")} teardown failed: ${error}`);
    failures.push("teardown failed");
  });
}

report();
process.exit(failures.length ? 1 : 0);
