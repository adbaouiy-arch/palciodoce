/**
 * Lists and edits the domains allowed to run Firebase sign-in.
 *
 *   npm run prod:domains                              show the current list
 *   npm run prod:domains -- --add palaciodoce.pt
 *   npm run prod:domains -- --add palaciodoce.vercel.app --add www.palaciodoce.pt
 *   npm run prod:domains -- --remove old.example.com
 *
 * Firebase refuses a browser sign-in from any origin not on this list, with
 * `auth/unauthorized-domain`. A new project authorises only `localhost` and its
 * two Firebase-hosted domains, so deploying anywhere else breaks the admin login
 * — and it breaks only in the browser, which means the build passes, the server
 * is healthy, and the failure shows up as a login form that refuses to work.
 *
 * Adds are merged into the existing list rather than replacing it, because the
 * API's PATCH overwrites the whole array and dropping `localhost` would break
 * local development.
 */
import "dotenv/config";
import { describeTarget } from "./target";
import { googleApiClient } from "./google-auth";

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

/** Collects every occurrence of a repeatable flag. */
function flagValues(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((arg, i) => {
    if (arg !== `--${name}`) return;
    const value = process.argv[i + 1];
    if (value && !value.startsWith("--")) out.push(value);
  });
  return out;
}

/**
 * Firebase wants a bare host — no scheme, no path, no port. Pasting a URL
 * straight from the browser is the obvious mistake, so it is corrected rather
 * than rejected.
 */
function normalise(input: string): string {
  let host = input.trim().replace(/^https?:\/\//i, "");
  host = host.split("/")[0];
  host = host.split(":")[0];
  return host.toLowerCase();
}

async function main() {
  const target = describeTarget();

  if (target.emulated) {
    throw new Error(
      `Target is ${target.label}.\n\n` +
        "The Auth emulator authorises every origin, so there is nothing to\n" +
        "configure locally. For the real project:\n" +
        "  npm run prod:domains",
    );
  }

  const project = target.projectId;
  const client = await googleApiClient();

  const configUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;

  const current = await client.request<{ authorizedDomains?: string[] }>({
    url: configUrl,
  });
  const existing = current.data.authorizedDomains ?? [];

  const toAdd = flagValues("add").map(normalise);
  const toRemove = flagValues("remove").map(normalise);

  if (toAdd.length === 0 && toRemove.length === 0) {
    console.log(bold(`\nDomains allowed to run sign-in on ${target.label}\n`));
    for (const domain of existing) console.log(`  ${domain}`);
    console.log(
      `\n  ${dim("Add the domain you deploy to, or the admin login will fail there")}\n` +
        `  ${dim("with auth/unauthorized-domain:")}\n` +
        `  ${dim("    npm run prod:domains -- --add your-app.vercel.app")}\n`,
    );
    return;
  }

  console.log(bold(`\nUpdating sign-in domains on ${target.label}\n`));

  // Merge, so localhost and the Firebase-hosted domains survive.
  const next = new Set(existing);
  for (const domain of toAdd) {
    if (next.has(domain)) {
      console.log(`  ${dim("·")} ${dim(`already there  ${domain}`)}`);
    } else {
      next.add(domain);
      console.log(`  ${green("+")} added          ${domain}`);
    }
  }
  for (const domain of toRemove) {
    if (next.delete(domain)) {
      console.log(`  ${red("−")} removed        ${domain}`);
    } else {
      console.log(`  ${dim("·")} ${dim(`not present    ${domain}`)}`);
    }
  }

  if (!next.has("localhost")) {
    // Removing it is almost certainly a slip, and it breaks `npm run dev`
    // against the real project.
    throw new Error(
      "Refusing to save a list without `localhost` — local development signs in " +
        "from there.",
    );
  }

  await client.request({
    url: `${configUrl}?updateMask=authorizedDomains`,
    method: "PATCH",
    data: { authorizedDomains: [...next] },
  });

  console.log(`\n  ${green("✓")} saved. Now authorised:\n`);
  for (const domain of [...next]) console.log(`      ${domain}`);
  console.log("");
}

main().catch((error: unknown) => {
  const response = (
    error as { response?: { data?: { error?: { message?: string } } } }
  ).response;
  const message =
    response?.data?.error?.message ??
    (error instanceof Error ? error.message : String(error));
  console.error(`\n${red("✗")} ${message}\n`);
  process.exit(1);
});
