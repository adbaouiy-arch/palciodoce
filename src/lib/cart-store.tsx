"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export type CartLineRef = { productId: string; quantity: number };

const STORAGE_KEY = "palaciodoce_cart_v1";

/**
 * The cart is intentionally locale-independent: it stores only
 * productId + quantity in localStorage. Product names, prices and
 * images are always re-fetched for the *current* locale (see
 * useHydratedCart / /api/cart), which is what guarantees a customer who
 * switches language mid-shopping never sees stale, wrong-language cart
 * contents — the cart itself never needs to change, only its
 * presentation does.
 *
 * localStorage is treated as the actual source of truth and read through
 * `useSyncExternalStore` rather than mirrored into React state by an
 * effect. That keeps rendering free of the cascading re-render an
 * effect-plus-setState pattern causes, and it means two open tabs stay in
 * agreement: a write in one tab fires `storage` in the other, which
 * re-reads and re-renders.
 */

/** Stable empty value, so snapshots keep referential identity. */
const EMPTY: CartLineRef[] = [];

/**
 * Cached parse of localStorage. `getSnapshot` must return the same
 * reference until the data actually changes, otherwise React re-renders
 * forever, so the parsed array is memoised and only invalidated on write
 * or on a `storage` event from another tab.
 */
let cache: CartLineRef[] | null = null;

const listeners = new Set<() => void>();

function parseStoredLines(): CartLineRef[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;

    const lines = parsed.filter(
      (line): line is CartLineRef =>
        typeof line?.productId === "string" &&
        typeof line?.quantity === "number" &&
        Number.isFinite(line.quantity) &&
        line.quantity > 0,
    );

    return lines.length === 0 ? EMPTY : lines;
  } catch {
    // Unavailable or corrupt storage behaves as an empty cart rather
    // than breaking the page.
    return EMPTY;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function invalidate() {
  cache = null;
  emit();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);

  // `storage` only fires in *other* tabs, which is exactly the case we
  // can't detect ourselves.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) invalidate();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): CartLineRef[] {
  cache ??= parseStoredLines();
  return cache;
}

/** During SSR there is no localStorage, so the cart renders as empty. */
function getServerSnapshot(): CartLineRef[] {
  return EMPTY;
}

function writeLines(next: CartLineRef[]) {
  cache = next.length === 0 ? EMPTY : next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Keep the in-memory cart working even if persistence fails
    // (private browsing, quota exceeded).
  }
  emit();
}

/**
 * Hydration flag. Server snapshot is `false` and client snapshot is
 * `true`, so consumers can tell "empty because we haven't read
 * localStorage yet" from "genuinely empty" — without an effect.
 */
const subscribeToHydration = (onStoreChange: () => void) => {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
};
const hydratedSnapshot = () => true;
const hydratedServerSnapshot = () => false;

export function useCart() {
  const lines = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    hydratedSnapshot,
    hydratedServerSnapshot,
  );

  const addItem = useCallback((productId: string, quantity = 1) => {
    const current = getSnapshot();
    const existing = current.find((line) => line.productId === productId);

    writeLines(
      existing
        ? current.map((line) =>
            line.productId === productId
              ? { ...line, quantity: line.quantity + quantity }
              : line,
          )
        : [...current, { productId, quantity }],
    );
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    const current = getSnapshot();

    writeLines(
      quantity <= 0
        ? current.filter((line) => line.productId !== productId)
        : current.map((line) =>
            line.productId === productId ? { ...line, quantity } : line,
          ),
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    writeLines(getSnapshot().filter((line) => line.productId !== productId));
  }, []);

  const clear = useCallback(() => writeLines(EMPTY), []);

  const itemCount = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity, 0),
    [lines],
  );

  return { lines, addItem, updateQuantity, removeItem, clear, itemCount, isHydrated };
}

/**
 * Retained so the root layout's provider tree keeps its shape. The cart
 * no longer needs React context — its state lives in localStorage and is
 * read directly by `useCart` — so this simply renders its children.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
