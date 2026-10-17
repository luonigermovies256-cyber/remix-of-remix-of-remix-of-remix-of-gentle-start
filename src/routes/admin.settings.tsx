import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { UploadField } from "@/components/admin/UploadField";
import { GenresManager } from "@/components/admin/GenresManager";
import { CategoriesManager } from "@/components/admin/CategoriesManager";
import { data as db } from "@/lib/fdb";
import { CURRENCY_CODE, formatMoney } from "@/lib/currency";
import {
  loadAppSettings,
  primeSetting,
  type MobileAppSettings,
  
  type UploadSettings,
} from "@/lib/app-settings";
import type { Plan } from "@/components/auth/SubscribeModal";
import {
  DEFAULT_UPLOAD_API,
  isBuiltInUploadApi,
  resolveUploadBackend,
  resolveUploadToken,
  UPLOAD_PROXY_PREFIX,
} from "@/lib/upload-backend";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [
    { title: "Settings — VJ EMMA.SITE" },
    { name: "description", content: "Manage VJ EMMA.SITE uploads, subscription plans and app settings." },
    { property: "og:title", content: "Settings — VJ EMMA.SITE" },
    { property: "og:description", content: "Manage VJ EMMA.SITE uploads, subscription plans and app settings." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: SettingsPage,
});

type AppSettings = MobileAppSettings;

function SettingsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Plan> | null>(null);
  
  const [upload, setUpload] = useState<UploadSettings>({});
  const [uploadTest, setUploadTest] = useState<string | null>(null);
  const [app, setApp] = useState<AppSettings>({});

  const plans = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data, error } = await db.from("plans").select("*").order("sort_order");
      if (error) throw error;
      return data as unknown as Plan[];
    },
  });

  const settings = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => loadAppSettings(true),
  });

  useEffect(() => {
    if (settings.data) {
      
      const savedUpload = (settings.data["upload"] as UploadSettings) ?? {};
      const backend_url = resolveUploadBackend(savedUpload.backend_url);
      setUpload({ ...savedUpload, backend_url, token: resolveUploadToken(backend_url, savedUpload.token) });
      setApp((settings.data["mobile_app"] as AppSettings) ?? {});
    }
  }, [settings.data]);

  const savePlan = useMutation({
    mutationFn: async (row: Partial<Plan>) => {
      const payload = {
        name: row.name ?? "",
        price: Number(row.price ?? 0),
        currency: row.currency ?? CURRENCY_CODE,
        duration_days: Number(row.duration_days ?? 30),
        description: row.description ?? null,
        features: row.features ?? [],
        is_active: row.is_active ?? true,
      };
      const { error } = row.id
        ? await db.from("plans").update(payload).eq("id", row.id)
        : await db.from("plans").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plan saved");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["admin-plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plan deleted");
      void qc.invalidateQueries({ queryKey: ["admin-plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const { error } = await db
        .from("app_settings")
        .upsert({ key, value: value as never }, { onConflict: "key" });
      if (error) throw error;
      primeSetting(key, value);
    },
    onSuccess: () => {
      toast.success("Settings saved");
      void qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testUpload = useMutation({
    mutationFn: async () => {
      const base = resolveUploadBackend(upload.backend_url);
      if (!base) throw new Error("Enter the upload backend link first");
      const viaProxy = isBuiltInUploadApi(base);
      let res: Response;
      try {
        // Signing a probe URL verifies browser CORS and auth without uploading an object.
        // The built-in service omits CORS headers, so it is reached via the app's relay.
        res = await fetch(
          viaProxy ? `${window.location.origin}${UPLOAD_PROXY_PREFIX}/uploads/single` : `${base}/uploads/single`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(viaProxy ? {} : { Authorization: `Bearer ${resolveUploadToken(base, upload.token)}` }),
            },
            body: JSON.stringify({ folder: "media/connection-test", filename: "connection-test.txt", contentType: "text/plain" }),
          },
        );
      } catch {
        throw new Error("Upload connection blocked. Check your connection and allow this website on every upload Worker response, not only OPTIONS.");
      }
      const text = await res.text();
      if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 120)}`);
      const signed = JSON.parse(text) as { url?: string; publicUrl?: string };
      if (!signed.url || !signed.publicUrl) throw new Error("Upload service did not return a signed upload URL");
      return "Upload signing and browser connection verified";
    },
    onSuccess: (t) => {
      setUploadTest(`OK — ${t}`);
      toast.success("Upload backend reachable");
    },
    onError: (e: Error) => {
      setUploadTest(`Failed — ${e.message}`);
      toast.error(e.message);
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Genres, plans, upload backend, Pesapal payments and the mobile app link.
        </p>
      </header>

      <section className="space-y-3 card-soft p-4">
        <div>
          <h2 className="text-sm font-semibold">Upload backend (Cloudflare R2)</h2>
          <p className="text-[11px] text-muted-foreground">
            Where large video uploads are signed. Leave empty to fall back to built-in storage.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Upload backend link</label>
            <Input
              value={upload.backend_url ?? ""}
              onChange={(e) => setUpload({ ...upload, backend_url: e.target.value })}
              placeholder="https://r2upload.nexusplatformafrica.workers.dev"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Upload token</label>
            <Input
              value={resolveUploadBackend(upload.backend_url) === DEFAULT_UPLOAD_API ? resolveUploadToken(DEFAULT_UPLOAD_API) : (upload.token ?? "")}
              readOnly={resolveUploadBackend(upload.backend_url) === DEFAULT_UPLOAD_API}
              onChange={(e) => setUpload({ ...upload, token: e.target.value })}
              placeholder="UPLOAD_TOKEN"
              className="h-9"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={saveSetting.isPending}
            onClick={() => saveSetting.mutate({ key: "upload", value: upload })}
          >
            {saveSetting.isPending && <Loader2 className="mr-1 size-4 animate-spin" />} Save upload
            backend
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={testUpload.isPending}
            onClick={() => testUpload.mutate()}
          >
            {testUpload.isPending && <Loader2 className="mr-1 size-4 animate-spin" />} Test
            connection
          </Button>
          {uploadTest && (
            <span className="text-[11px] text-muted-foreground">{uploadTest}</span>
          )}
        </div>
      </section>

      <CategoriesManager />

      <GenresManager />


      <section className="card-soft">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Subscription plans</h2>
          <Button
            size="sm"
            onClick={() =>
              setEditing({ name: "", price: 0, currency: CURRENCY_CODE, duration_days: 30, features: [], is_active: true })
            }
          >
            <Plus className="mr-1 size-4" /> Add plan
          </Button>
        </div>
        <ul className="divide-y divide-border">
          {(plans.data ?? []).map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {p.name}{" "}
                  {!p.is_active && (
                    <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">Off</span>
                  )}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {formatMoney(p.price)} · {p.duration_days} days ·{" "}
                  {p.features?.join(", ")}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => deletePlan.mutate(p.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
          {!plans.data?.length && (
            <li className="px-4 py-6 text-center text-xs text-muted-foreground">No plans yet.</li>
          )}
        </ul>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 card-soft p-4">
          <h2 className="text-sm font-semibold">Payments</h2>
          <p className="text-xs text-muted-foreground">
            Subscriptions are collected through Pesapal. Credentials and callbacks are configured in
            code, so there is nothing to set up here.
          </p>
          <ul className="space-y-1 text-xs">
            <li className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
              <span className="text-muted-foreground">Provider</span>
              <b>Pesapal</b>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
              <span className="text-muted-foreground">Checkout</span>
              <b>In-app modal</b>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
              <span className="text-muted-foreground">Status</span>
              <b>IPN + live polling</b>
            </li>
          </ul>
        </div>

        <div className="space-y-3 card-soft p-4">
          <h2 className="text-sm font-semibold">Mobile app</h2>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Version</label>
            <Input
              value={app.version ?? ""}
              onChange={(e) => setApp({ ...app, version: e.target.value })}
              placeholder="1.0.4"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">App download link</label>
            <Input
              value={app.link ?? ""}
              onChange={(e) => setApp({ ...app, link: e.target.value })}
              placeholder="https://play.google.com/store/apps/details?id=..."
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Release notes</label>
            <Textarea
              rows={3}
              value={app.notes ?? ""}
              onChange={(e) => setApp({ ...app, notes: e.target.value })}
            />
          </div>
          <UploadField
            label="App file (.apk / .ipa)"
            folder="app"
            preview="none"
            value={app.file_path ?? null}
            onChange={(p) => setApp({ ...app, file_path: p ?? undefined })}
          />
          <Button
            size="sm"
            disabled={saveSetting.isPending}
            onClick={() => saveSetting.mutate({ key: "mobile_app", value: app })}
          >
            Save app release
          </Button>
        </div>
      </section>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <h2 className="text-base font-semibold">{editing?.id ? "Edit" : "New"} plan</h2>
          <div className="space-y-3">
            <Input
              placeholder="Plan name"
              value={editing?.name ?? ""}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="h-9"
            />
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="Price"
                inputMode="decimal"
                value={editing?.price ?? 0}
                onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                className="h-9"
              />
              <Input
                placeholder="Days"
                type="number"
                value={editing?.duration_days ?? 30}
                onChange={(e) => setEditing({ ...editing, duration_days: Number(e.target.value) })}
                className="h-9"
              />
            </div>
            <Textarea
              rows={2}
              placeholder="Description"
              value={editing?.description ?? ""}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            />
            <Input
              placeholder="Features (comma separated)"
              value={(editing?.features ?? []).join(", ")}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  features: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className="h-9"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing?.is_active ?? true}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
              />
              Active
            </label>
            <Button
              className="w-full"
              disabled={savePlan.isPending || !editing?.name}
              onClick={() => editing && savePlan.mutate(editing)}
            >
              {savePlan.isPending && <Loader2 className="mr-1 size-4 animate-spin" />} Save plan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}