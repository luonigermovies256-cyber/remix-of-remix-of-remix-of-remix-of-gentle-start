import { useEffect } from "react";
import { hasActiveUploads, isNewRelease } from "@/lib/app-update-policy";

declare const __APP_BUILD_ID__: string;

/** Poll the release marker; defer refresh while important work is in progress. */
export function useAutomaticUpdates() {
  useEffect(() => {
    if (import.meta.env.DEV) return;
    let stopped = false;
    let checking = false;
    let pending = false;
    const controller = new AbortController();

    const refreshIfSafe = () => {
      if (!pending || stopped || document.visibilityState !== "visible" || hasActiveUploads()) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      if (document.activeElement?.matches("input, textarea, select, [contenteditable=true]")) return;
      if (Array.from(document.querySelectorAll("video, audio")).some((el) => {
        const media = el as HTMLMediaElement;
        return !media.paused && !media.ended;
      })) return;
      // Clear only stale settings, not the user's login or pending payment reference.
      try { window.localStorage.removeItem("app_settings_cache"); } catch { /* storage unavailable */ }
      stopped = true;
      window.location.reload();
    };

    const check = async () => {
      if (stopped || checking || !navigator.onLine || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store", signal: controller.signal,
        });
        if (response.ok && response.headers.get("content-type")?.includes("application/json")) {
          const release = await response.json() as { version?: unknown };
          if (isNewRelease(__APP_BUILD_ID__, release.version)) pending = true;
        }
        refreshIfSafe();
      } catch { /* Offline and deployments in progress are retried on the next check. */ }
      finally { checking = false; }
    };

    const timer = window.setInterval(() => void check(), 60_000);
    const retry = window.setInterval(refreshIfSafe, 5_000);
    const onReturn = () => void check();
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("online", onReturn);
    void check();
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(timer);
      window.clearInterval(retry);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("online", onReturn);
    };
  }, []);
}