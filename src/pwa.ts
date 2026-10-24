import { useEffect, useState } from "react";

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function usePwa() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [status, setStatus] = useState("Preparing offline access…");
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => {
    const mode = window.matchMedia("(display-mode: standalone)");
    const syncMode = () => setInstalled(mode.matches ||
      !!(navigator as Navigator & { standalone?: boolean }).standalone);
    syncMode();
    const available = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const didInstall = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", didInstall);
    mode.addEventListener("change", syncMode);
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    const check = () => {
      if (!document.hidden) void registration?.update().catch(() => {});
    };
    const report = () => {
      if (disposed) return;
      setUpdateReady(!!registration?.waiting);
      if (registration?.active) setStatus("Ready for offline use on this device.");
    };
    const installing = () => {
      const worker = registration?.installing;
      worker?.addEventListener("statechange", () => {
        report();
        if (!disposed && worker.state === "redundant")
          setStatus("Offline setup could not finish. Reopen while connected to retry.");
      });
      report();
    };
    if (!window.isSecureContext) {
      setStatus("Open the HTTPS address to enable installation and offline access.");
    } else if (!("serviceWorker" in navigator)) {
      setStatus("Offline access is not supported in this browser.");
    } else if (!import.meta.env.PROD) {
      setStatus("Offline access is enabled in the production build.");
    } else {
      void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
        .then((value) => {
          if (disposed) return;
          registration = value;
          registration.addEventListener("updatefound", installing);
          installing();
          void navigator.serviceWorker.ready.then(() => { if (!disposed) report(); });
        })
        .catch(() => {
          if (!disposed) setStatus("Offline setup failed. Reopen while connected to retry.");
        });
      document.addEventListener("visibilitychange", check);
      window.addEventListener("online", check);
    }
    return () => {
      disposed = true;
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", didInstall);
      mode.removeEventListener("change", syncMode);
      registration?.removeEventListener("updatefound", installing);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    setPrompt(null);
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      setStatus("Use your browser’s menu to install this app.");
    }
  }
  return { installed, canInstall: !!prompt, install, status, updateReady };
}
