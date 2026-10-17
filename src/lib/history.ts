const KEY = "luo:watch-history";
const MAX = 40;

export type HistoryEntry = {
  id: string;
  title: string;
  genre?: string | null;
  section?: string | null;
  at: number;
};

export function readHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordWatch(entry: Omit<HistoryEntry, "at">) {
  if (typeof window === "undefined" || !entry.id) return;
  const next = [{ ...entry, at: Date.now() }, ...readHistory().filter((h) => h.id !== entry.id)];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next.slice(0, MAX)));
  } catch {
    /* storage unavailable */
  }
}
