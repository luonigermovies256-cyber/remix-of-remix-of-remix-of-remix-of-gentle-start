import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireFirebaseAdmin, verifyFirebaseToken } from "@/lib/firebase-token.server";

export const CATALOG_TABLES = ["media", "episodes", "hero_slides", "categories", "genres"] as const;
const tableSchema = z.enum(CATALOG_TABLES);

const writeSchema = z.object({
  idToken: z.string().min(10),
  table: tableSchema,
  op: z.enum(["upsert", "update", "delete"]),
  rows: z.array(z.record(z.string(), z.unknown())).max(2000).optional(),
  ids: z.array(z.string()).max(5000).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const catalogWrite = createServerFn({ method: "POST" })
  .inputValidator((d) => writeSchema.parse(d))
  .handler(async ({ data }) => {
    await requireFirebaseAdmin(data.idToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const t = supabaseAdmin.from(data.table);
    if (data.op === "upsert") {
      const rows = (data.rows ?? []).map((r) => {
        const id = String(r["id"] ?? crypto.randomUUID());
        const created = typeof r["created_at"] === "string" ? (r["created_at"] as string) : now;
        return { id, data: { ...r, id, created_at: created }, created_at: created, updated_at: now };
      });
      if (rows.length) {
        const { error } = await t.upsert(rows as never);
        if (error) throw new Error(error.message);
      }
      return { ids: rows.map((r) => r.id) };
    }
    const ids = data.ids ?? [];
    if (!ids.length) return { ids };
    if (data.op === "delete") {
      const { error } = await t.delete().in("id", ids);
      if (error) throw new Error(error.message);
      return { ids };
    }
    const { data: existing, error } = await t.select("id,data").in("id", ids);
    if (error) throw new Error(error.message);
    for (const row of (existing ?? []) as { id: string; data: Record<string, unknown> }[]) {
      const merged = { ...row.data, ...data.payload, id: row.id, updated_at: now };
      const { error: e } = await t.update({ data: merged, updated_at: now } as never).eq("id", row.id);
      if (e) throw new Error(e.message);
    }
    return { ids };
  });

export const recordView = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ mediaId: z.string().min(1).max(100), idToken: z.string().optional() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: exists } = await supabaseAdmin.from("media").select("id").eq("id", data.mediaId).maybeSingle();
    if (!exists) return { ok: false };
    let viewer: string | null = null;
    if (data.idToken) viewer = (await verifyFirebaseToken(data.idToken).catch(() => null))?.uid ?? null;
    await supabaseAdmin.from("media_views").insert({ media_id: data.mediaId, viewer_id: viewer });
    return { ok: true };
  });

export type ViewStats = {
  daily: { day: string; views: number }[];
  today: number;
  week: number;
  month: number;
  top: { media_id: string; views: number; title: string }[];
};

export const getViewStats = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ idToken: z.string(), days: z.number().int().min(1).max(365) }).parse(d))
  .handler(async ({ data }): Promise<ViewStats> => {
    await requireFirebaseAdmin(data.idToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s, error } = await supabaseAdmin.rpc("view_stats", { _days: data.days });
    if (error) throw new Error(error.message);
    const stats = s as unknown as Omit<ViewStats, "top"> & { top: { media_id: string; views: number }[] };
    const ids = stats.top.map((t) => t.media_id);
    const { data: rows } = ids.length
      ? await supabaseAdmin.from("media").select("id,data").in("id", ids)
      : { data: [] };
    const titles = new Map(((rows ?? []) as { id: string; data: { title?: string } }[]).map((r) => [r.id, r.data.title ?? "Untitled"]));
    return { ...stats, top: stats.top.map((t) => ({ ...t, title: titles.get(t.media_id) ?? "Deleted title" })) };
  });
