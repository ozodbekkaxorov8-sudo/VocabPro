"use client";

import { BookOpen, ClipboardList, Clock3, GraduationCap, Layers3, LogOut, UserRound, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState, type FormEvent } from "react";
import { Entry } from "@/components/entry";
import { Empty, Loading, Notice } from "@/components/status";
import { api, ApiError, errorText, json } from "@/lib/api";
import { labels, type Student, type Test, type Word } from "@/lib/types";

const Quiz = dynamic(() => import("./quiz").then((module) => module.Quiz), { loading: Loading });

export function StudentPortal() {
  const [student, setStudent] = useState<Student>();
  const [tests, setTests] = useState<Test[]>([]);
  const [selected, setSelected] = useState<{ test: Test; activity: "study" | "quiz" }>();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    api<Student>("/session/student", { signal: controller.signal }).then(setStudent).catch((failure: unknown) => {
      if (!controller.signal.aborted && (!(failure instanceof ApiError) || failure.status !== 401)) setError(errorText(failure));
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!student || selected) return;
    const controller = new AbortController();
    let inFlight = false;
    async function refresh() {
      if (document.hidden || inFlight) return;
      inFlight = true;
      try {
        const list = await api<Test[]>("/student/tests", { signal: controller.signal });
        if (!controller.signal.aborted) {
          setTests(list);
          setError("");
        }
      } catch (failure) {
        if (controller.signal.aborted) return;
        if (failure instanceof ApiError && failure.status === 401) {
          setTests([]);
          setStudent(undefined);
        } else setError(errorText(failure));
      } finally {
        inFlight = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    setLoading(true);
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [student, selected]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      setStudent(await api<Student>("/session/student", json("POST", {
        name: data.get("student-name"), class_label: data.get("class-label"),
      })));
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }

  async function signOut() {
    try {
      await api("/session/student", { method: "DELETE" });
      setTests([]);
      setStudent(undefined);
      setError("");
    } catch (failure) { setError(errorText(failure)); }
  }

  if (!student) return (
    <Entry>
      <div className="card login-card">
        <span className="icon-box purple login-icon"><GraduationCap size={28} /></span>
        <h2>O‘quvchi paneli</h2>
        <p className="login-subtitle">Davom etish uchun ismingiz va sinfingizni kiriting.</p>
        <form onSubmit={signIn} autoComplete="off" className="login-form">
          <label htmlFor="student-name">Ismingiz</label>
          <div className="input-icon"><UserRound size={18} /><input id="student-name" name="student-name" placeholder="Masalan, Azizbek" required maxLength={80} autoComplete="off" /></div>
          <label htmlFor="class-label">Sinfingiz</label>
          <div className="input-icon"><Layers3 size={18} /><input id="class-label" name="class-label" placeholder="Masalan, 7-A" required maxLength={24} autoComplete="off" autoCapitalize="characters" spellCheck={false} /></div>
          {error && <Notice>{error}</Notice>}
          <button className="button primary login-submit" disabled={busy}>{busy ? "Kirilmoqda…" : "Panelga kirish"}</button>
        </form>
      </div>
    </Entry>
  );

  if (selected?.activity === "quiz") return <Quiz test={selected.test} onClose={() => setSelected(undefined)} />;
  if (selected?.activity === "study") return <Study test={selected.test} onClose={() => setSelected(undefined)}
    onQuiz={() => setSelected({ test: selected.test, activity: "quiz" })} />;

  return (
    <div className="container workspace">
      <div className="page-heading">
        <div><span className="tag purple"><GraduationCap size={15} /> {student.class_label} sinf</span><h1>Salom, {student.name}!</h1><p>Yodlash yoki test ishlash uchun lug‘at tanlang.</p></div>
        <button className="button secondary" type="button" onClick={() => void signOut()}><LogOut size={17} /> Chiqish</button>
      </div>
      <h2 className="section-title">Faol lug‘atlar</h2>
      {error && <Notice>{error}</Notice>}
      {loading ? <Loading /> : tests.length ? <div className="catalog">
        {tests.map((test) => <article className="card test-card" key={test.id}>
          <span className="icon-box purple"><BookOpen size={24} /></span><h3>{test.title}</h3>{test.description && <p>{test.description}</p>}
          <div className="test-meta"><span><Layers3 size={15} /> {test.word_count} ta so‘z</span><span><Clock3 size={15} /> {test.duration_minutes} daq.</span><span>{labels[test.mode]}</span></div>
          <div className="button-row">
            <button type="button" className="button secondary" onClick={() => setSelected({ test, activity: "study" })}><BookOpen size={17} /> Yodlash</button>
            <button type="button" className="button primary" onClick={() => setSelected({ test, activity: "quiz" })}><ClipboardList size={17} /> Testni boshlash</button>
          </div>
        </article>)}
      </div> : !error && <Empty title="Hozircha faol lug‘at yo‘q" text="O‘qituvchingiz sinfingiz uchun test ochganda, u shu yerda ko‘rinadi." />}
    </div>
  );
}

function Study({ test, onClose, onQuiz }: { test: Test; onClose: () => void; onQuiz: () => void }) {
  const [words, setWords] = useState<Word[]>();
  const [index, setIndex] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api<Word[]>(`/student/tests/${test.id}/study`, { signal: controller.signal }).then(setWords)
      .catch((failure) => { if (!controller.signal.aborted) setError(errorText(failure)); });
    return () => controller.abort();
  }, [test.id]);
  const word = words?.[index];
  function move(offset: number) { setReveal(false); setIndex(index + offset); }

  return (
    <div className="container workspace">
      <div className="page-heading"><div><span className="tag purple"><BookOpen size={15} /> Yodlash</span><h1>{test.title}</h1></div>
        <button className="button secondary" onClick={onClose}><X size={16} /> Yopish</button>
      </div>
      {error ? <Notice>{error}</Notice> : !word ? <Loading /> : <div className="study-panel">
        <p className="muted">{index + 1} / {words!.length} so‘z</p>
        <button type="button" className="flash-card card" aria-pressed={reveal} onClick={() => setReveal(!reveal)}>
          <span>{reveal ? "Tarjimasi" : "So‘z"}</span>
          <strong>{reveal ? word.translation : word.term}</strong>
          {reveal && word.heading && <span className="tag purple">{word.heading}</span>}
          <small>{reveal ? "So‘zni yana ko‘rish" : "Tarjimasini ko‘rish uchun bosing"}</small>
        </button>
        <div className="button-row study-buttons">
          <button className="button secondary" disabled={index === 0} onClick={() => move(-1)}>Oldingi</button>
          <button className="button secondary" disabled={index === words!.length - 1} onClick={() => move(1)}>Keyingi</button>
          <button className="button primary" onClick={onQuiz}>Testni boshlash</button>
        </div>
      </div>}
    </div>
  );
}
