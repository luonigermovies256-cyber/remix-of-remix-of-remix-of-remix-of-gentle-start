/**
 * Real PWA install support: captures the browser's install prompt and lets any
 * button trigger the native "install app" flow directly (no instructions shown).
 */
import { useCallback, useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const sync = () => {
      setCanInstall(Boolean(deferred));
      setInstalled(isStandalone());
    };
    sync();
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  /** Triggers the real browser install. Returns false when it isn't available. */
  const install = useCallback(async (): Promise<boolean> => {
    if (!deferred) return false;
    const evt = deferred;
    await evt.prompt();
    const choice = await evt.userChoice;
    if (choice.outcome === "accepted") {
      deferred = null;
      notify();
      return true;
    }
    return false;
  }, []);

  return { canInstall, installed, install };
}
