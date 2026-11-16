/**
 * Catalog data client (movies, episodes, slides, categories, genres) on Lovable Cloud.
 * Same fluent API as fdb.ts so screens can switch by changing one import.
 * Reads are public; writes go through an admin-verified server function.
 */
import { supabase } from "@/integrations/supabase/client";
import { getFirebaseAuth } from "@/lib/firebase";
import { catalogWrite, CATALOG_TABLES } from "@/lib/catalog.functions";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = any;
type Table = (typeof CATALOG_TABLES)[number];
export type Result<T> = { data: T; error: Error | null; count?: number };
type Filter = { col: string; value: unknown; op: "eq" | "neq" };
type Order = { col: string; ascending: boolean };

const cmp = (a: unknown, b: unknown) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
};

async function readAll(table: Table): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select("id,data").range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) out.push({ ...(r.data as Row), id: r.id });
    if (!data || data.length < 1000) return out;
  }
}

function apply(rows: Row[], filters: Filter[], orders: Order[], limitN?: number) {
  let out = rows.filter((r) =>
    filters.every((f) => (f.op === "eq" ? r[f.col] === f.value : r[f.col] !== f.value)),
  );
  for (const o of [...orders].reverse()) {
    out = [...out].sort((a, b) => (o.ascending ? cmp(a[o.col], b[o.col]) : cmp(b[o.col], a[o.col])));
  }
  return typeof limitN === "number" ? out.slice(0, limitN) : out;
}

async function token() {
  const user = getFirebaseAuth()?.currentUser;
  if (!user) throw new Error("Sign in as admin first");
  return user.getIdToken();
}

const toErr = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

class SelectQuery<T = Row[]> implements PromiseLike<Result<T>> {
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private limitN?: number;
  private single = false;
  constructor(private table: Table, private headOnly = false) {}
  eq(col: string, value: unknown) { this.filters.push({ col, value, op: "eq" }); return this; }
  neq(col: string, value: unknown) { this.filters.push({ col, value, op: "neq" }); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orders.push({ col, ascending: opts?.ascending !== false }); return this; }
  limit(n: number) { this.limitN = n; return this; }
  maybeSingle() { this.single = true; return this as unknown as SelectQuery<Row | null>; }
  async run(): Promise<Result<T>> {
    try {
      const rows = apply(await readAll(this.table), this.filters, this.orders, this.limitN);
      if (this.headOnly) return { data: null as T, error: null, count: rows.length };
      if (this.single) return { data: (rows[0] ?? null) as T, error: null, count: rows.length };
      return { data: rows as T, error: null, count: rows.length };
    } catch (e) {
      return { data: (this.single ? null : []) as T, error: toErr(e), count: 0 };
    }
  }
  then<R1 = Result<T>, R2 = never>(f?: ((v: Result<T>) => R1 | PromiseLike<R1>) | null, r?: ((e: unknown) => R2 | PromiseLike<R2>) | null): PromiseLike<R1 | R2> {
    return this.run().then(f, r);
  }
}

class WriteQuery implements PromiseLike<Result<null>> {
  private filters: Filter[] = [];
  constructor(private table: Table, private kind: "update" | "delete", private payload?: Row) {}
  eq(col: string, value: unknown) { this.filters.push({ col, value, op: "eq" }); return this; }
  neq(col: string, value: unknown) { this.filters.push({ col, value, op: "neq" }); return this; }
  async run(): Promise<Result<null>> {
    try {
      const onlyId = this.filters.length === 1 && this.filters[0]!.col === "id" && this.filters[0]!.op === "eq";
      const ids = onlyId
        ? [String(this.filters[0]!.value)]
        : apply(await readAll(this.table), this.filters, []).map((r) => String(r.id));
      await catalogWrite({ data: { idToken: await token(), table: this.table, op: this.kind, ids, payload: this.payload } });
      return { data: null, error: null };
    } catch (e) {
      return { data: null, error: toErr(e) };
    }
  }
  then<R1 = Result<null>, R2 = never>(f?: ((v: Result<null>) => R1 | PromiseLike<R1>) | null, r?: ((e: unknown) => R2 | PromiseLike<R2>) | null): PromiseLike<R1 | R2> {
    return this.run().then(f, r);
  }
}

class CTable {
  constructor(private table: Table) {}
  select(_cols?: string, opts?: { count?: string; head?: boolean }) { return new SelectQuery(this.table, !!opts?.head); }
  insert(payload: Row | Row[]) {
    const table = this.table;
    const rows = (Array.isArray(payload) ? payload : [payload]).map((r: Row) => ({ ...r, id: r.id ?? crypto.randomUUID() }));
    const run = async (): Promise<Result<Row[]>> => {
      try {
        await catalogWrite({ data: { idToken: await token(), table, op: "upsert", rows } });
        return { data: rows, error: null };
      } catch (e) {
        return { data: [], error: toErr(e) };
      }
    };
    return {
      then: <R1, R2>(f?: (v: Result<Row[]>) => R1, r?: (e: unknown) => R2) => run().then(f, r),
      select: () => ({ then: <R1, R2>(f?: (v: Result<Row[]>) => R1, r?: (e: unknown) => R2) => run().then(f, r) }),
    };
  }
  upsert(payload: Row | Row[], opts?: { onConflict?: string }) {
    const key = opts?.onConflict;
    const rows = (Array.isArray(payload) ? payload : [payload]).map((r: Row) => (key && r[key] != null ? { ...r, id: String(r[key]) } : r));
    return this.insert(rows);
  }
  update(payload: Row) { return new WriteQuery(this.table, "update", payload); }
  delete() { return new WriteQuery(this.table, "delete"); }
}

export const data = { from: (table: Table) => new CTable(table) };

/** One-time copy of the Firebase catalog into Cloud. Returns rows copied per table. */
export async function importCatalogFromFirebase() {
  const { collection, getDocs } = await import("firebase/firestore");
  const { getDb } = await import("@/lib/firebase");
  const idToken = await token();
  const counts: Record<string, number> = {};
  for (const table of CATALOG_TABLES) {
    const snap = await getDocs(collection(getDb(), table));
    const rows = snap.docs.map((d) => ({ ...(d.data() as Row), id: d.id }));
    for (let i = 0; i < rows.length; i += 500) {
      await catalogWrite({ data: { idToken, table, op: "upsert", rows: rows.slice(i, i + 500) } });
    }
    counts[table] = rows.length;
  }
  return counts;
}
