import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { fileUrl, formatBytes, uploadFile } from "@/lib/storage";

export function UploadField({
  label,
  folder,
  value,
  onChange,
  accept,
  preview = "image",
}: {
  label: string;
  folder: string;
  value: string | null;
  onChange: (path: string | null) => void;
  accept?: string;
  preview?: "image" | "none";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [info, setInfo] = useState<{ name: string; size: number } | null>(null);
  const isLink = !!value && /^https?:\/\//i.test(value);
  const [mode, setMode] = useState<"file" | "url">(isLink ? "url" : "file");
  const [url, setUrl] = useState(isLink ? value : "");

  // Keep the URL box in sync when a different item is opened for editing.
  useEffect(() => {
    if (value && /^https?:\/\//i.test(value)) {
      setUrl(value);
      setMode("url");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setInfo({ name: file.name, size: file.size });
    setPercent(0);
    try {
      const path = await uploadFile(folder, file, (p) => setPercent(p.percent));
      onChange(path);
      setPercent(100);
      toast.success(`${label} uploaded`);
    } catch (err) {
      setPercent(null);
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const busy = percent !== null && percent < 100;
  const done = !!value;
  const pct = percent ?? 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <div className="flex rounded-lg border border-border p-0.5 text-[11px]">
          {(["file", "url"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "file" ? "Upload file" : "Use URL"}
            </button>
          ))}
        </div>
      </div>

      {mode === "url" ? (
        <div className="space-y-2 rounded-2xl border border-border p-4">
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => {
                const v = e.target.value;
                setUrl(v);
                // Commit straight away so the link is saved even if the
                // admin never presses "Use link".
                const t = v.trim();
                onChange(/^https?:\/\//i.test(t) ? t : null);
              }}
              placeholder="https://example.com/file.mp4"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => {
                const v = url.trim();
                if (!/^https?:\/\//i.test(v)) {
                  toast.error("Enter a valid http(s) URL");
                  return;
                }
                onChange(v);
                setInfo(null);
                setPercent(null);
                toast.success(`${label} link saved`);
              }}
              className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
            >
              Use link
            </button>
          </div>
          {done && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {preview === "image" && (
                <img
                  src={fileUrl(value) ?? ""}
                  alt=""
                  className="h-12 w-20 rounded-md object-cover ring-1 ring-border"
                />
              )}
              <span className="truncate">{value}</span>
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setUrl("");
                }}
                className="ml-auto rounded-lg p-1 hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
      <div
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void pick(e.dataTransfer.files?.[0]);
        }}
        className={`group relative w-full cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed p-4 transition-colors ${
          done
            ? "border-primary/50 bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-accent/30"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          hidden
          onChange={(e) => void pick(e.target.files?.[0])}
        />

        <div className="flex flex-col items-stretch gap-3 xs:flex-row xs:items-center xs:gap-4">
          {/* Left: landscape preview / icon */}
          <div className="aspect-video w-full max-w-[300px] shrink-0 xs:w-[46%]">
            {preview === "image" && done && !busy ? (
              <img
                src={fileUrl(value) ?? ""}
                alt=""
                className="size-full rounded-xl object-cover ring-1 ring-border"
              />
            ) : (
              <div
                className={`flex size-full items-center justify-center rounded-xl ${
                  done ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground"
                }`}
              >
                {busy ? (
                  <Loader2 className="size-8 animate-spin" />
                ) : done ? (
                  <CheckCircle2 className="size-8" />
                ) : (
                  <FileUp className="size-8" />
                )}
              </div>
            )}
          </div>


          {/* Right: status + progress */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold">
                  {busy
                    ? `${pct}% complete`
                    : (info?.name ??
                      (done ? "File attached" : `Drop or click to upload ${label.toLowerCase()}`))}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {busy
                    ? info?.name
                    : done
                      ? "Ready to save"
                      : (accept ?? "Any file") + " · drag & drop supported"}
                </div>
              </div>
              {done && !busy && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(null);
                    setInfo(null);
                    setPercent(null);
                  }}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {percent !== null && (
              <>
                <div className="relative mt-4 h-3.5 overflow-hidden rounded-full bg-muted/70 ring-1 ring-border">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                  {busy && (
                    <div className="absolute inset-y-0 left-0 w-full animate-pulse rounded-full bg-primary/10" />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
                  <span>
                    {info
                      ? `${formatBytes((info.size * pct) / 100)} / ${formatBytes(info.size)}`
                      : `${pct}%`}
                  </span>
                  <span>{busy ? "Uploading…" : "Upload complete"}</span>
                  <span className="ml-auto text-sm font-bold text-foreground">{pct}%</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}