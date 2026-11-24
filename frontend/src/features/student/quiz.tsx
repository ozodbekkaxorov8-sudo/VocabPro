"use client";

import { CheckCircle2, Clock3, Maximize, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Notice } from "@/components/status";
import { api, errorText, json } from "@/lib/api";
import { labels, reasonLabels, type Attempt, type FinishReason, type Test } from "@/lib/types";

type Answers = Record<string, string>;
type ClientReason = Exclude<FinishReason, "disconnected">;

export function Quiz({ test, onClose }: { test: Test; onClose: () => void }) {
  const viewport = useRef<HTMLElement>(null);
  const current = useRef<Attempt>(null);
  const progress = useRef({ answers: {} as Answers, revision: 0 });
  const endAt = useRef(0);
  const startId = useRef<string>(null);
  const starting = useRef(false);
  const finishing = useRef(false);
  const pending = useRef<ClientReason>(null);
  const [attempt, setAttempt] = useState<Attempt>();
  const [visibleAnswers, setVisibleAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const acceptResult = useCallback((result: Attempt) => {
    current.current = result;
    setAttempt(result);
    setError("");
    if (document.fullscreenElement === viewport.current) void document.exitFullscreen().catch(() => undefined);
  }, []);

  const finish = useCallback(async (reason: ClientReason) => {
    if (current.current?.finished_at) return;
    pending.current ??= reason;
    const id = current.current?.id;
    if (!id || finishing.current) return;
    finishing.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api<Attempt>(`/student/attempts/${id}/finish`, {
        ...json("POST", { ...progress.current, reason: pending.current }), keepalive: true,
      });
      if (result.finished_at) acceptResult(result);
      else {
        endAt.current = performance.now() + (result.remaining_seconds ?? 0) * 1000;
        setSeconds(Math.ceil(result.remaining_seconds ?? 0));
      }
    } catch (failure) { if (!current.current?.finished_at) setError(errorText(failure)); }
    finally { finishing.current = false; setBusy(false); }
  }, [acceptResult]);

  useEffect(() => {
    function exit() {
      if ((starting.current || current.current) && !current.current?.finished_at) void finish("fullscreen_exit");
    }
    const onFullscreen = () => { if (document.fullscreenElement !== viewport.current) exit(); };
    const onVisibility = () => { if (document.hidden) exit(); };
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", exit);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", exit);
      exit();
      if (viewport.current && document.fullscreenElement === viewport.current) void document.exitFullscreen().catch(() => undefined);
    };
  }, [finish]);

  const running = Boolean(attempt && !attempt.finished_at);

  useEffect(() => {
    if (!running) return;
    const clock = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt.current - performance.now()) / 1000));
      setSeconds(left);
      if (left === 0 && (!pending.current || pending.current === "time_limit")) void finish("time_limit");
    }, 300);
    return () => window.clearInterval(clock);
  }, [running, finish]);

  useEffect(() => {
    if (!running) return;
    async function save() {
      const id = current.current?.id;
      if (!id || pending.current || current.current?.finished_at) return;
      try {
        const result = await api<Attempt>(`/student/attempts/${id}/progress`, json("PUT", progress.current));
        if (result.finished_at) acceptResult(result);
      } catch { /* The next save sends the full answer set again. */ }
    }
    const interval = window.setInterval(() => void save(), 12000);
    const update = window.setTimeout(() => void save(), 400);
    return () => { window.clearInterval(interval); window.clearTimeout(update); };
  }, [running, visibleAnswers, acceptResult]);

  async function begin() {
    if (starting.current || !viewport.current) return;
    if (!viewport.current.requestFullscreen || !document.fullscreenEnabled) {
        setError("Bu brauzer to‘liq ekranni qo‘llamaydi. Testni Chrome yoki Edge brauzerida oching.");
      return;
    }
    starting.current = true;
    pending.current = null;
    setBusy(true);
    setError("");
    try {
      try { await viewport.current.requestFullscreen(); }
      catch {
        setError("To‘liq ekran ochilmadi. Sahifani alohida Chrome yoki Edge oynasida ochib, qayta urinib ko‘ring.");
        return;
      }
      startId.current ??= crypto.randomUUID();
      const result = await api<Attempt>(`/student/tests/${test.id}/attempts`, json("POST", { id: startId.current }));
      if (result.finished_at) { acceptResult(result); return; }
      endAt.current = performance.now() + (result.remaining_seconds ?? 0) * 1000;
      progress.current = { answers: result.answers ?? {}, revision: result.revision ?? 0 };
      current.current = result;
      setAttempt(result);
      setSeconds(Math.ceil(result.remaining_seconds ?? 0));
      setVisibleAnswers(progress.current.answers);
      if (pending.current || !document.fullscreenElement) await finish(pending.current ?? "fullscreen_exit");
    } catch (failure) {
      setError(errorText(failure));
      if (document.fullscreenElement === viewport.current) void document.exitFullscreen().catch(() => undefined);
    } finally { starting.current = false; setBusy(false); }
  }

  function answer(id: string, value: string) {
    const answers = { ...progress.current.answers, [id]: value };
    progress.current = { answers, revision: progress.current.revision + 1 };
    setVisibleAnswers(answers);
  }

  const question = attempt?.questions?.[step];
  const answered = Object.values(visibleAnswers).filter((text) => text.trim()).length;
  const score = attempt?.finished_at ? Math.round(100 * (attempt.correct_count ?? 0) / attempt.total_count) : 0;

  return (
    <section className="quiz-viewport" ref={viewport} aria-label="Lug‘at testi">
      <div className="container workspace quiz-workspace">
        {!attempt ? <div className="card quiz-intro">
          <button className="icon-button quiz-close" disabled={busy} onClick={onClose} aria-label="Test oynasini yopish"><X size={21} /></button>
          <span className="icon-box purple"><Maximize size={26} /></span>
          <h1>{test.title}</h1>
          <div className="test-meta center"><span>{test.word_count} ta savol</span><span><Clock3 size={16} /> {test.duration_minutes} daqiqa</span><span>{labels[test.mode]}</span></div>
          <p className="quiz-rule"><ShieldCheck size={22} /> Test to‘liq ekranda ishlaydi. Chiqsangiz, test avtomatik yakunlanadi.</p>
          {error && <Notice>{error}</Notice>}
          <button className="button primary" onClick={() => void begin()} disabled={busy}><Maximize size={17} /> {busy ? "Ochilmoqda…" : "To‘liq ekranda boshlash"}</button>
        </div> : attempt.finished_at ? <div className="card quiz-intro">
          <span className="icon-box mint"><CheckCircle2 size={27} /></span>
          <h1>Test yakunlandi</h1>
          <p>{attempt.test_title} · {attempt.reason && reasonLabels[attempt.reason]}</p>
          <div className="score">{score}%</div>
          <p>{attempt.correct_count} / {attempt.total_count} ta to‘g‘ri javob</p>
          <button className="button primary" onClick={onClose}>Lug‘atlarga qaytish</button>
        </div> : pending.current ? <div className="card quiz-intro">
          <h1>Test yakunlanmoqda</h1>
          {error ? <Notice>{error}</Notice> : <p>Javoblar saqlanmoqda…</p>}
          {error && <button className="button primary" disabled={busy} onClick={() => void finish(pending.current!)}>Qayta urinish</button>}
        </div> : question && <div className="quiz-card card">
          <div className="quiz-meta"><span>{step + 1} / {attempt.total_count} savol</span><span><Clock3 size={17} /> {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span></div>
          <progress max={attempt.total_count} value={answered} aria-label="Javob berilgan savollar" />
          <span className="tag purple">{labels[question.kind]}</span>
          <h1>{question.term}</h1>
          <p>{question.kind === "headings" ? "So‘zga mos guruhni tanlang." : "So‘zning tarjimasini toping."}</p>
          {question.kind === "written" ? <input key={question.id} className="answer-input" aria-label="Tarjima" placeholder="Tarjimasini yozing"
            maxLength={80} autoComplete="off" spellCheck={false} autoCorrect="off" autoCapitalize="none" inputMode="text"
            onPaste={(event) => event.preventDefault()} onDrop={(event) => event.preventDefault()}
            value={visibleAnswers[question.id] ?? ""} onChange={(event) => answer(question.id, event.target.value)} />
            : <div className="options">{question.options.map((option) => <button key={option} type="button" className="option"
              aria-pressed={visibleAnswers[question.id] === option} onClick={() => answer(question.id, option)}>{option}</button>)}</div>}
          <div className="button-row quiz-buttons">
            <button className="button secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Oldingi</button>
            <button className="button secondary" disabled={step + 1 === attempt.total_count} onClick={() => setStep(step + 1)}>Keyingi</button>
            <button className={`button ${step + 1 === attempt.total_count ? "primary" : "secondary"}`} onClick={() => void finish("submitted")}>Testni topshirish</button>
          </div>
        </div>}
      </div>
    </section>
  );
}
