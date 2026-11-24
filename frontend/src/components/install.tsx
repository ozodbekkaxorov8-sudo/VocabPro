"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallControl() {
  const [prompt, setPrompt] = useState<InstallPrompt>();
  const [show, setShow] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [apple, setApple] = useState(false);

  useEffect(() => {
    const isApple = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone = matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => { setInstalled(true); setShow(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const welcome = window.setTimeout(() => {
      setApple(isApple);
      setInstalled(standalone);
      if (!standalone && !sessionStorage.getItem("vp-install-dismissed")) setShow(true);
    }, 1100);
    return () => {
      window.clearTimeout(welcome);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    sessionStorage.setItem("vp-install-dismissed", "1");
    setShow(false);
  }

  async function install() {
    if (!prompt) { setShow(true); return; }
    try {
      await prompt.prompt();
      if ((await prompt.userChoice).outcome === "accepted") setInstalled(true);
    } finally {
      setPrompt(undefined);
      dismiss();
    }
  }

  if (installed) return null;
  return (
    <div className="install-wrap">
      <button className="button install-button" type="button" aria-label="Ilovani o‘rnatish" onClick={() => setShow(!show)} aria-expanded={show}>
        <Download size={17} /> <span>Ilovani o‘rnatish</span>
      </button>
      {show && (
        <aside className="install-card" aria-label="VocabPro ilovasini o‘rnatish">
          <span className="icon-box purple"><Download size={21} /></span>
          <div><strong>VocabPro’ni o‘rnating</strong>
            <p>{prompt ? "Lug‘atlarga bosh ekrandan tez kiring." :
              apple ? <>Safari’da <Share size={14} /> Ulashish menyusidan “Bosh ekranga qo‘shish”ni tanlang.</> :
              "Brauzer menyusidan “Ilovani o‘rnatish” bandini tanlang."}</p>
            {prompt && <button className="text-button" type="button" onClick={() => void install()}>O‘rnatish</button>}
          </div>
          <button className="icon-button install-close" type="button" onClick={dismiss} aria-label="O‘rnatish taklifini yopish"><X size={16} /></button>
        </aside>
      )}
    </div>
  );
}
