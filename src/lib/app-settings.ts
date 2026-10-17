import { data as db } from "@/lib/fdb";

/** Settings rows the admin edits in Admin → Settings. */
export type UploadSettings = { backend_url?: string; token?: string };
export type MobileAppSettings = {
  version?: string;
  notes?: string;
  file_path?: string | undefined;
  link?: string;
};

const LS_KEY = "app_settings_cache";

let cache: Record<string, unknown> = {};
let hydrated = false;
let inflight: Promise<Record<string, unknown>> | null = null;

function hydrateFromStorage() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) cache = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
}

/** Synchronous read of the last known value (localStorage backed). */
export function getSetting<T>(key: string): T | undefined {
  hydrateFromStorage();
  return cache[key] as T | undefined;
}

/** Fetch every settings row once and cache it. */
export async function loadAppSettings(force = false): Promise<Record<string, unknown>> {
  hydrateFromStorage();
  if (!force && Object.keys(cache).length) return cache;
  if (inflight && !force) return inflight;

  inflight = (async () => {
    const { data } = await db.from("app_settings").select("*");
    const map: Record<string, unknown> = {};
    (data ?? []).forEach((r) => (map[r.key] = r.value));
    cache = map;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(LS_KEY, JSON.stringify(map));
      } catch {
        /* ignore */
      }
    }
    return map;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** Update one key locally after the admin saves it. */
export function primeSetting(key: string, value: unknown) {
  hydrateFromStorage();
  cache = { ...cache, [key]: value };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(cache));
    } catch {
      /* ignore */
    }
  }
}
