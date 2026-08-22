"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const InstallPwaModal: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isHttpIp, setIsHttpIp] = useState(false);

  useEffect(() => {
    // Check if dismissed in this session before
    const isDismissed = sessionStorage.getItem("dizzywave_pwa_dismissed");
    if (isDismissed) return;

    // Check if user already installed or running standalone
    const isInstalled = typeof window !== "undefined" && localStorage.getItem("dizzywave_pwa_installed") === "true";
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone;
    if (isInstalled || isStandalone) return;

    // Only show on mobile and tablet devices (hide on PC / Desktop)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isMobileOrTablet =
      /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(
        userAgent
      ) ||
      (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);

    if (!isMobileOrTablet) return;

    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isLocalNetworkHttp =
      window.location.protocol === "http:" && window.location.hostname !== "localhost";

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      fetch("/api/pwa-install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "browser_appinstalled" }),
      }).catch(() => {});
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Wait exactly 30 seconds of site use before showing install modal
    const showTimer = setTimeout(() => {
      if (isIosDevice) {
        setIsIos(true);
      } else if (isLocalNetworkHttp) {
        setIsHttpIp(true);
      }
      setShowModal(true);
    }, 30000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      clearTimeout(showTimer);
    };
  }, []);

  async function handleInstallClick() {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === "accepted") {
          localStorage.setItem("dizzywave_pwa_installed", "true");
          fetch("/api/pwa-install", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source: "modal_install_button" }),
          }).catch(() => {});
          setShowModal(false);
        }
      } catch {
        /* no-op */
      } finally {
        setDeferredPrompt(null);
      }
    } else {
      handleDismiss();
    }
  }

  function handleDismiss() {
    setShowModal(false);
    sessionStorage.setItem("dizzywave_pwa_dismissed", "true");
  }

  if (!showModal) return null;

  return (
    <div className="fixed md:top-14 top-12 md:right-3 right-2 z-50 lg:hidden w-auto max-w-[270px] sm:max-w-xs animate-in fade-in slide-in-from-top duration-300">
      <div className="bg-[var(--bg-app)] border border-[var(--stage-border)] p-1 rounded-2xl backdrop-blur-xl flex flex-col ">
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-1">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-none overflow-hidden">
              <Image src="/logo.ico" alt="dizzywave" width={24} height={24} className="object-contain rounded-sm" />
            </div>
            <div>
              <h3 className="text-[10px] sm:text-xs font-mono font-bold tracking-wide text-[var(--text-app)]">
                Install dizzywave
              </h3>
              <p className="text-[9px] sm:text-[11px] font-mono text-[var(--subtext)] leading-tight mt-0.5">
                Add to your home screen.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-[var(--subtext)] hover:text-[var(--text-app)] text-xs sm:text-sm font-mono mt-0.5 p-1 cursor-pointer"
            title="Dismiss"
          >
            ✕
          </button>
        </div>

        {isIos ? (
          <div className="text-[9px] sm:text-[11px] font-mono text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-1.5 rounded-lg">
            Tap share <span className="font-bold">⎋</span> and choose <span className="font-bold">&quot;Add to Home Screen +&quot;</span>
          </div>
        ) : isHttpIp && !deferredPrompt ? (
          <div className="text-[9px] sm:text-[11px] font-mono text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-1.5 rounded-lg leading-relaxed">
            Tap Chrome menu <span className="font-bold">⋮</span> → choose <span className="font-bold">&quot;Add to Home screen&quot;</span> (HTTPS required for 1-click install).
          </div>
        ) : (
          <div className="flex items-center gap-1 px-2 mt-1">
            <button
              onClick={handleInstallClick}
              className="flex-1 py-1 px-1.5 text-[9px] sm:text-[11px] font-mono font-bold uppercase tracking-wider rounded-lg bg-[#f6ab3e] text-black hover:scale-[1.02] transition-transform  cursor-pointer"
            >
              Install App
            </button>
            <button
              onClick={handleDismiss}
              className="py-1 px-2 text-[9px] sm:text-[11px] font-mono text-[var(--subtext)] hover:text-[var(--text-app)] cursor-pointer"
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
