/**
 * The JSON encoding shared by `db:export` and `db:restore`.
 *
 * Both halves live here together on purpose: `encode` and `decode` are inverses,
 * and a backup is only worth having if they stay that way. Splitting them across
 * the two scripts is how you end up with an export nothing can read back.
 *
 * Deliberately free of side effects — the scripts that use it run their work on
 * import, so a module they both pull in must not.
 */
import { Timestamp } from "firebase-admin/firestore";

/** Bumped if the file layout changes, so a restore can refuse a shape it does
 *  not understand rather than writing nonsense. */
export const EXPORT_FORMAT = "palaciodoce/firestore/v1";

/**
 * Converts a Firestore value into something `JSON.stringify` keeps faithfully.
 *
 * `Timestamp` is tagged rather than flattened to an ISO string. A bare string
 * would come back as a string, and every date in the application would quietly
 * change type on the first restore.
 *
 * Only `Timestamp` needs handling in this schema. Anything else unexpected — a
 * `GeoPoint`, a `DocumentReference` — would serialise as an empty object, so it
 * throws instead. A backup that silently drops fields is worse than one that
 * fails.
 */
export function encode(value: unknown, path: string): unknown {
  if (value === null || typeof value !== "object") return value;

  if (value instanceof Timestamp) {
    return { __type__: "timestamp", value: value.toDate().toISOString() };
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => encode(item, `${path}[${index}]`));
  }

  if (value.constructor === Object) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        encode(item, `${path}.${key}`),
      ]),
    );
  }

  throw new Error(
    `Cannot export ${path}: unsupported Firestore type ${value.constructor.name}. ` +
      "Add a case to encode() and decode() in scripts/backup-format.ts before storing it.",
  );
}

/** Inverse of `encode`. */
export function decode(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) return value.map(decode);

  const record = value as Record<string, unknown>;
  if (record.__type__ === "timestamp") {
    if (typeof record.value !== "string") {
      throw new Error("Backup contains a timestamp with no value.");
    }
    const date = new Date(record.value);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Backup contains an unparseable timestamp: ${record.value}`);
    }
    return Timestamp.fromDate(date);
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [key, decode(item)]),
  );
}
