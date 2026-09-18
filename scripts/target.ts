/**
 * Describes which database a script is about to touch.
 *
 * Every script that reads or writes prints this before doing anything, and it
 * always names the project — not just whether an emulator is involved.
 *
 * The reason is a mistake that is easy to make and hard to see. `dotenv` does
 * not override variables already present in the environment, so an exported
 * `FIREBASE_PROJECT_ID` left over from an earlier command silently wins over
 * `.env`. A script can then report "local emulator" perfectly truthfully while
 * reading an entirely different, empty datastore inside it — which looks exactly
 * like data loss. Worse in the other direction: a stale project id plus no
 * emulator host is a local-looking command writing to live customer data.
 *
 * Printing the resolved project turns both into something you notice on the
 * first line of output.
 */

export type Target = {
  projectId: string;
  emulated: boolean;
  /** One line, safe to print, naming both the project and where it lives. */
  label: string;
  /** True when the project id looks like a real one rather than a demo. */
  looksProduction: boolean;
};

export function describeTarget(): Target {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? "(unset)";
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  const emulated = Boolean(emulatorHost);

  /*
    The `demo-` prefix is Firebase's own convention for a project that cannot
    exist for real — the tooling refuses to contact Google for one. So anything
    without it is assumed to be a live project, which is the safe assumption to
    make by default.
  */
  const looksProduction = !emulated && !projectId.startsWith("demo-");

  const label = emulated
    ? `emulator at ${emulatorHost}, project ${projectId}`
    : `LIVE PROJECT ${projectId}`;

  return { projectId, emulated, label, looksProduction };
}

/** Prints the target as a headline, e.g. `✓ Administrator created — <target>`. */
export function reportTarget(headline: string): Target {
  const target = describeTarget();
  console.log(`\n✓ ${headline} — ${target.label}`);
  return target;
}
