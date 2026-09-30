import type { Snapshot } from "./types.ts";
const cache = new Map<string, { value: Snapshot; expires: number }>();
const pending = new Map<string, Promise<Snapshot>>();
const keyFor = (id: string, at?: number) => `${id}/${at ?? "live"}`;
// The last live snapshot of each replay survives a page refresh (session storage only),
// so the presenter repaints instantly and the server read refreshes it underneath.
// Bump when the snapshot shape changes, so a stored copy from an older build is never painted.
const SHAPE = 4;
const stored = (id: string) => `bt:snapshot:v${SHAPE}:${id}`;
function remember(id: string, value: Snapshot) {
  try {
    sessionStorage.setItem(stored(id), JSON.stringify(value));
  } catch {}
}
function recall(id: string): Snapshot | null {
  try {
    const raw = sessionStorage.getItem(stored(id));
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}
export function cachedSnapshot(id: string, at?: number): Snapshot | null {
  return cache.get(keyFor(id, at))?.value ?? (at === undefined ? recall(id) : null);
}
export function invalidateSnapshot(id: string) {
  try {
    sessionStorage.removeItem(stored(id));
  } catch {}
  for (const key of pending.keys())
    if (key.startsWith(`${id}/`)) pending.delete(key);
  for (const [key, entry] of cache)
    if (key.startsWith(`${id}/`)) entry.expires = 0;
}
export async function readSnapshot(
  id: string,
  at?: number,
  fresh = false,
): Promise<Snapshot> {
  const key = keyFor(id, at),
    saved = cache.get(key);
  if (!fresh && saved && saved.expires > Date.now() && !saved.value.pendingJobs)
    return saved.value;
  if (pending.has(key)) return pending.get(key)!;
  let request!: Promise<Snapshot>;
  request = (async () => {
    const response = await fetch(
      `/api/snapshot?session=${encodeURIComponent(id)}${at === undefined ? "" : `&at=${at}`}`,
      { cache: "no-store", signal: AbortSignal.timeout(45000) },
    );
    const value = await response.json();
    if (!response.ok)
      throw Object.assign(
        new Error(value.error || `Request failed (${response.status})`),
        { status: response.status },
      );
    if (cache.size >= 24) cache.delete(cache.keys().next().value!);
    // A recorded moment never changes, so it can stay cached; the live view refreshes often.
    const entry = { value: value as Snapshot, expires: Date.now() + ((value as Snapshot).historical ? 600000 : 30000) };
    if (pending.get(key) === request) {
      cache.set(key, entry);
      cache.set(keyFor(id, value.cutoff), entry);
      if (at === undefined && typeof sessionStorage !== "undefined") remember(id, entry.value);
    }
    return entry.value;
  })();
  pending.set(key, request);
  try {
    return await request;
  } finally {
    if (pending.get(key) === request) pending.delete(key);
  }
}
