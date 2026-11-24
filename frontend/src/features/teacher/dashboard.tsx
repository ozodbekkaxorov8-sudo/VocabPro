"use client";

import { BarChart3, BookOpen, ClipboardList, ListChecks, LogOut, Percent, Plus, Send, UsersRound } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Empty, Loading, Notice } from "@/components/status";
import { api, ApiError, errorText, json } from "@/lib/api";
import { labels, reasonLabels, type FinishReason, type Test } from "@/lib/types";

const TestEditor = dynamic(() => import("./editor").then((module) => module.TestEditor), { loading: Loading });

type View = "results" | "tests" | "telegram" | "editor";
type ResultRow = {
  id: string; test_title: string; student_name: string; class_label: string; finished_at: string;
  reason: FinishReason; correct_count: number; total_count: number;
};
type ResultsData = { stats: { attempts: number; students: number; average: number }; rows: ResultRow[]; page_size: number };
const dateFormat = new Intl.DateTimeFormat("uz-UZ", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tashkent" });

export function Dashboard({ onLock }: { onLock: () => void }) {
  const [view, setView] = useState<View>("results");
  const [editId, setEditId] = useState<number>();
  const [tests, setTests] = useState<Test[]>();
  const [error, setError] = useState("");
  const [changing, setChanging] = useState<number>();
  const loadTests = useCallback(async (signal?: AbortSignal) => {
    try { setTests(await api<Test[]>("/teacher/tests", { signal })); }
    catch (failure) {
      if (signal?.aborted) return;
      if (failure instanceof ApiError && failure.status === 401) onLock();
      else setError(errorText(failure));
    }
  }, [onLock]);
  useEffect(() => {
    const controller = new AbortController();
    void loadTests(controller.signal);
    return () => controller.abort();
  }, [loadTests]);

  function edit(id?: number) { setEditId(id); setView("editor"); }

  async function changeActive(test: Test) {
    setChanging(test.id);
    setError("");
    try {
      await api(`/teacher/tests/${test.id}/active`, json("PATCH", { active: !test.active }));
      await loadTests();
    } catch (failure) { setError(errorText(failure)); }
    finally { setChanging(undefined); }
  }

  async function signOut() {
    try { await api("/session/teacher", { method: "DELETE" }); onLock(); }
    catch (failure) { setError(errorText(failure)); }
  }

  return <div className="container workspace">
    <div className="page-heading">
      <div><span className="tag purple"><BookOpen size={15} /> Boshqaruv</span><h1>O‘qituvchi paneli</h1><p>Lug‘atlarni boshqaring va o‘quvchilar natijalarini kuzating.</p></div>
      <div className="button-row">
        <button type="button" className="button secondary" onClick={() => void signOut()}><LogOut size={17} /> Chiqish</button>
        {view !== "editor" && <button type="button" className="button primary" onClick={() => edit()}><Plus size={18} /> Yangi test</button>}
      </div>
    </div>
    <nav className="dashboard-nav" aria-label="O‘qituvchi bo‘limlari">
      <button className={view === "results" ? "current" : ""} onClick={() => setView("results")}><BarChart3 size={18} /> Natijalar</button>
      <button className={(view === "tests" || view === "editor") ? "current" : ""} onClick={() => setView("tests")}><ClipboardList size={18} /> Testlar</button>
      <button className={view === "telegram" ? "current" : ""} onClick={() => setView("telegram")}><Send size={17} /> Telegram</button>
    </nav>
    {error && <Notice>{error}</Notice>}
    {view === "results" && <Results tests={tests ?? []} />}
    {view === "tests" && (!tests ? !error && <Loading /> : tests.length ? <div className="catalog">
      {tests.map((test) => <article className="card test-card" key={test.id}>
        <div className="test-card-state"><span className="icon-box purple"><BookOpen size={23} /></span>
          <span className={`tag ${test.active ? "mint" : "neutral"}`}>{test.active ? "Faol" : "Nofaol"}</span></div>
        <h3>{test.title}</h3>{test.description && <p>{test.description}</p>}
        <div className="test-meta"><span>{test.word_count} ta so‘z</span><span>{labels[test.mode]}</span><span>{test.class_label || "Barcha sinflar"}</span></div>
        <div className="button-row"><button className="button secondary" onClick={() => edit(test.id)}>Tahrirlash</button>
          <button className={`button ${test.active ? "secondary" : "primary"}`} disabled={changing === test.id}
            onClick={() => void changeActive(test)}>{test.active ? "Nofaollashtirish" : "Faollashtirish"}</button></div>
      </article>)}
    </div> : <Empty title="Hozircha test yo‘q" text="So‘zlar ro‘yxatini tayyorlab, birinchi testni yarating." />)}
    {view === "editor" && <TestEditor key={editId ?? "new"} testId={editId} onClose={() => setView("tests")}
      onSaved={() => { setView("tests"); void loadTests(); }} />}
    {view === "telegram" && <Telegram />}
  </div>;
}

function Results({ tests }: { tests: Test[] }) {
  const [testId, setTestId] = useState("");
  const [page, setPage] = useState(1);
  const [snapshot, setSnapshot] = useState<ResultsData>();
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setSnapshot(undefined);
    const params = new URLSearchParams({ page: String(page) });
    if (testId) params.set("test_id", testId);
    api<ResultsData>(`/teacher/results?${params}`, { signal: controller.signal }).then(setSnapshot)
      .catch((failure) => { if (!controller.signal.aborted) setError(errorText(failure)); });
    return () => controller.abort();
  }, [testId, page, refresh]);

  return <>
    <div className="stats">
      <article className="card stat"><span className="icon-box purple"><UsersRound size={22} /></span><div><span>O‘quvchilar</span><strong>{snapshot?.stats.students ?? "—"}</strong></div></article>
      <article className="card stat"><span className="icon-box mint"><Percent size={22} /></span><div><span>O‘rtacha natija</span><strong>{snapshot ? `${snapshot.stats.average}%` : "—"}</strong></div></article>
      <article className="card stat"><span className="icon-box amber"><ListChecks size={22} /></span><div><span>Yakunlangan testlar</span><strong>{snapshot?.stats.attempts ?? "—"}</strong></div></article>
    </div>
    <section className="card results">
      <div className="results-heading"><h2>Test natijalari</h2><div className="button-row">
        <select aria-label="Natijalarni test bo‘yicha filtrlash" value={testId} onChange={(event) => { setTestId(event.target.value); setPage(1); }}>
          <option value="">Barcha testlar</option>{tests.map((test) => <option value={test.id} key={test.id}>{test.title}</option>)}
        </select>
        <button className="button secondary" onClick={() => setRefresh(refresh + 1)}>Yangilash</button>
      </div></div>
      {error ? <Notice>{error}</Notice> : !snapshot ? <Loading /> : snapshot.rows.length ? <>
        <div className="table-scroll"><table>
          <thead><tr><th>O‘quvchi</th><th>Test</th><th>Natija</th><th>Holat</th><th>Sana</th></tr></thead>
          <tbody>{snapshot.rows.map((row) => <tr key={row.id}>
            <td><strong>{row.student_name}</strong><small>{row.class_label}</small></td><td>{row.test_title}</td>
            <td><span className="tag purple">{Math.round(100 * row.correct_count / row.total_count)}%</span><small>{row.correct_count} / {row.total_count}</small></td>
            <td>{reasonLabels[row.reason]}</td><td>{dateFormat.format(new Date(row.finished_at))}</td>
          </tr>)}</tbody>
        </table></div>
        {snapshot.stats.attempts > snapshot.page_size && <div className="button-row page-buttons">
          <button className="button secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Oldingi</button>
          <span>{page} / {Math.ceil(snapshot.stats.attempts / snapshot.page_size)}</span>
          <button className="button secondary" disabled={page * snapshot.page_size >= snapshot.stats.attempts} onClick={() => setPage(page + 1)}>Keyingi</button>
        </div>}
      </> : <p className="muted results-empty">Hozircha yakunlangan test yo‘q.</p>}
    </section>
  </>;
}

type TelegramConfig = { configured: boolean; chat_id: number | null };

function Telegram() {
  const [config, setConfig] = useState<TelegramConfig>();
  const [chat, setChat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api<TelegramConfig>("/teacher/telegram", { signal: controller.signal }).then((value) => {
      setConfig(value); setChat(value.chat_id?.toString() ?? "");
    }).catch((failure) => { if (!controller.signal.aborted) setError(errorText(failure)); });
    return () => controller.abort();
  }, []);

  async function save(chatId: number | null) {
    if (!config) return;
    setBusy(true);
    setError("");
    try {
      const value = await api<{ chat_id: number | null }>("/teacher/telegram", json("PUT", { chat_id: chatId }));
      setConfig({ ...config, chat_id: value.chat_id });
      setChat(value.chat_id?.toString() ?? "");
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }

  function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^-?\d+$/.test(chat.trim()) || !Number.isSafeInteger(Number(chat)) || Number(chat) === 0) {
      setError("Chat ID ni raqam bilan kiriting.");
      return;
    }
    void save(Number(chat));
  }

  return <section className="card telegram-panel">
    <span className="icon-box purple"><Send size={23} /></span>
    <h2>Telegram bildirishnomalari</h2>
    <p>O‘quvchi testni yakunlaganda natija ko‘rsatilgan chatga yuboriladi.</p>
    {error && <Notice>{error}</Notice>}
    {!config ? !error && <Loading /> : <>
      <span className={`tag ${config.configured && config.chat_id ? "mint" : "neutral"}`}>{config.configured && config.chat_id ? "Bildirishnomalar yoqilgan" : "Sozlash kerak"}</span>
      {config.configured ? <p>Telegramda botga <strong>/start</strong> yuboring va chat ID ni kiriting.</p> :
        <p>Ulash uchun dastur sozlamalariga <strong>TELEGRAM_BOT_TOKEN</strong> ni kiriting.</p>}
      <form onSubmit={connect} className="telegram-form">
        <label htmlFor="chat-id">Telegram chat ID</label>
        <input id="chat-id" name="chat-id" placeholder="Masalan, 123456789" value={chat} required disabled={!config.configured || busy}
          onChange={(event) => setChat(event.target.value)} />
        <div className="button-row">
          <button className="button primary" disabled={!config.configured || busy}>{config.chat_id ? "Saqlash" : "Ulash"}</button>
          {config.chat_id && <button type="button" className="button secondary" disabled={busy} onClick={() => void save(null)}>Uzish</button>}
        </div>
      </form>
    </>}
  </section>;
}
