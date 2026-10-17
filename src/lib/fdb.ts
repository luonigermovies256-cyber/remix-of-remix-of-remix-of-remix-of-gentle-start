/**
 * Firestore data client with a small fluent API so every screen in the app can
 * read and write collections the same way. Collections are small, so filtering
 * and sorting happen in memory — that keeps Firestore composite indexes out of
 * the picture entirely.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "./firebase";
const firestore = () => getDb();

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = any;
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

async function readAll(table: string): Promise<Row[]> {
  const snap = await getDocs(collection(firestore(), table));
  return snap.docs.map((d) => ({ ...(d.data() as Row), id: d.id }));
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

const nowIso = () => new Date().toISOString();

class SelectQuery<T = Row[]> implements PromiseLike<Result<T>> {
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private limitN?: number;
  private single = false;

  constructor(
    private table: string,
    private headOnly = false,
  ) {}

  eq(col: string, value: unknown) {
    this.filters.push({ col, value, op: "eq" });
    return this;
  }
  neq(col: string, value: unknown) {
    this.filters.push({ col, value, op: "neq" });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, ascending: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this as unknown as SelectQuery<Row | null>;
  }
  single_() {
    return this.maybeSingle();
  }

  async run(): Promise<Result<T>> {
    try {
      const rows = apply(await readAll(this.table), this.filters, this.orders, this.limitN);
      if (this.headOnly) return { data: null as T, error: null, count: rows.length };
      if (this.single) return { data: (rows[0] ?? null) as T, error: null, count: rows.length };
      return { data: rows as T, error: null, count: rows.length };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      return { data: (this.single ? null : []) as T, error, count: 0 };
    }
  }

  then<R1 = Result<T>, R2 = never>(
    onfulfilled?: ((v: Result<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((r: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

class WriteQuery implements PromiseLike<Result<null>> {
  private filters: Filter[] = [];

  constructor(
    private table: string,
    private kind: "update" | "delete",
    private payload?: Row,
  ) {}

  eq(col: string, value: unknown) {
    this.filters.push({ col, value, op: "eq" });
    return this;
  }

  async run(): Promise<Result<null>> {
    try {
      const targets = apply(await readAll(this.table), this.filters, []).map((r) =>
        String(r["id"]),
      );


      await Promise.all(
        targets.map((id) =>
          this.kind === "delete"
            ? deleteDoc(doc(firestore(), this.table, id))
            : updateDoc(doc(firestore(), this.table, id), {
                ...(this.payload as Row),
                updated_at: nowIso(),
              }),
        ),
      );
      return { data: null, error: null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  then<R1 = Result<null>, R2 = never>(
    onfulfilled?: ((v: Result<null>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((r: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

class Table {
  constructor(private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    return new SelectQuery(this.table, !!opts?.head);
  }

  insert(payload: Row | Row[]) {
    const table = this.table;
    const rows = Array.isArray(payload) ? payload : [payload];
    const run = async (): Promise<Result<Row[]>> => {
      try {
        const written: Row[] = [];
        for (const raw of rows) {
          const id = (raw["id"] as string | undefined) ?? crypto.randomUUID();
          const row: Row = { created_at: nowIso(), ...raw, id };
          await setDoc(doc(firestore(), table, id), row, { merge: true });
          written.push(row);
        }
        return { data: written, error: null };
      } catch (e) {
        return { data: [], error: e instanceof Error ? e : new Error(String(e)) };
      }
    };
    return {
      then: <R1, R2>(f?: (v: Result<Row[]>) => R1, r?: (e: unknown) => R2) => run().then(f, r),
      select: () => ({ then: <R1, R2>(f?: (v: Result<Row[]>) => R1, r?: (e: unknown) => R2) => run().then(f, r) }),
    };
  }

  upsert(payload: Row | Row[], opts?: { onConflict?: string }) {
    const key = opts?.onConflict;
    const rows = (Array.isArray(payload) ? payload : [payload]).map((r) =>
      key && r[key] != null ? { ...r, id: String(r[key]) } : r,
    );
    return this.insert(rows);
  }

  update(payload: Row) {
    return new WriteQuery(this.table, "update", payload);
  }

  delete() {
    return new WriteQuery(this.table, "delete");
  }
}

export const data = {
  from: (table: string) => new Table(table),
};
