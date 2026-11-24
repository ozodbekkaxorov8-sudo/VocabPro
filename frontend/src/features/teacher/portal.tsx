"use client";

import { KeyRound, ShieldCheck } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Entry } from "@/components/entry";
import { Loading, Notice } from "@/components/status";
import { api, ApiError, errorText, json } from "@/lib/api";

const Dashboard = dynamic(() => import("./dashboard").then((module) => module.Dashboard), { loading: Loading });

export function TeacherPortal() {
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useCallback(() => setAuthorized(false), []);
  useEffect(() => {
    const controller = new AbortController();
    api<void>("/session/teacher", { signal: controller.signal }).then(() => setAuthorized(true)).catch((failure) => {
      if (!controller.signal.aborted && (!(failure instanceof ApiError) || failure.status !== 401)) setError(errorText(failure));
    });
    return () => controller.abort();
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/session/teacher", json("POST", { code: data.get("teacher-code") }));
      setAuthorized(true);
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }

  if (authorized) return <Dashboard onLock={lock} />;

  return <Entry teacher>
    <div className="card login-card">
      <span className="icon-box purple login-icon"><ShieldCheck size={27} /></span>
      <h2>O‘qituvchi paneli</h2>
      <p className="login-subtitle">Davom etish uchun o‘qituvchi kirish kodini kiriting.</p>
      <form className="login-form" onSubmit={signIn}>
        <label htmlFor="teacher-code">Kirish kodi</label>
        <div className="input-icon"><KeyRound size={18} /><input id="teacher-code" name="teacher-code" type="password"
          placeholder="Kodni kiriting" required maxLength={128} autoComplete="off" /></div>
        {error && <Notice>{error}</Notice>}
        <button className="button primary login-submit" disabled={busy}>{busy ? "Kirilmoqda…" : "Panelga kirish"}</button>
      </form>
    </div>
  </Entry>;
}
