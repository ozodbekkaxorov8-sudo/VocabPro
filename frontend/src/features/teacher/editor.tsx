"use client";

import { FileText, ImagePlus, Keyboard, ListPlus, Plus, Upload, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Loading, Notice } from "@/components/status";
import { api, errorText, json } from "@/lib/api";
import { labels, type Draft, type Mode, type Word } from "@/lib/types";

type Source = "manual" | "text" | "pdf" | "image";
const emptyWord = (): Word => ({ term: "", translation: "", heading: "" });
const emptyDraft: Draft = { title: "", description: "", class_label: "", duration_minutes: 8, mode: "mixed",
  words: [emptyWord(), emptyWord(), emptyWord()] };

function parseWords(text: string) {
  const words: Word[] = [];
  const skipped: number[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const parts = line.trim().split(/\t+|\s*\|\s*|\s*;\s*|\s+[—–-]\s+| {2,}/).map((part) => part.trim());
    if (parts.length < 2 || parts.length > 3 || !parts[0] || !parts[1] || parts[0].length > 80 ||
      parts[1].length > 80 || (parts[2]?.length ?? 0) > 50) {
      skipped.push(index + 1);
      return;
    }
    words.push({ term: parts[0], translation: parts[1], heading: parts[2] ?? "" });
  });
  return { words, skipped };
}

export function TestEditor({ testId, onClose, onSaved }: { testId?: number; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [source, setSource] = useState<Source>("manual");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File>();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(testId));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!testId) return;
    const controller = new AbortController();
    api<Draft>(`/teacher/tests/${testId}`, { signal: controller.signal })
      .then(({ title, description, class_label, duration_minutes, mode, words }) => {
        setDraft({ title, description, class_label, duration_minutes, mode, words });
        setLoading(false);
      }).catch((failure) => { if (!controller.signal.aborted) setError(errorText(failure)); });
    return () => controller.abort();
  }, [testId]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }

  function editWord(index: number, key: keyof Word, value: string) {
    update("words", draft.words.map((word, position) => position === index ? { ...word, [key]: value } : word));
  }

  function addText() {
    setError("");
    setStatus("");
    const { words, skipped } = parseWords(text);
    if (skipped.length) {
      setError(`Quyidagi qatorlardagi so‘z va tarjimani tekshiring: ${skipped.slice(0, 12).join(", ")}${skipped.length > 12 ? "…" : ""}.`);
      return;
    }
    if (!words.length) { setError("Qo‘shish uchun so‘zlar ro‘yxatini kiriting."); return; }
    const existing = draft.words.filter((word) => word.term || word.translation || word.heading);
    if (existing.length + words.length > 80) { setError("Bitta lug‘atda 80 tagacha so‘z bo‘lishi mumkin."); return; }
    update("words", [...existing, ...words]);
    setStatus(`${words.length} ta so‘z qo‘shildi. Saqlashdan oldin ularni tekshiring.`);
    setSource("manual");
    setText("");
    setFile(undefined);
  }

  async function extract() {
    if (!file) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      if (file.size > 8 * 1024 * 1024) { setError("Fayl hajmi 8 MB dan oshmasligi kerak."); return; }
      const body = new FormData();
      body.set("file", file);
      setText((await api<{ text: string }>("/teacher/import", { method: "POST", body })).text);
      setStatus("Ajratilgan matnni tekshiring. Zarur bo‘lsa, qatorlarni tahrirlang.");
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const words = draft.words.filter((word) => word.term.trim() || word.translation.trim() || word.heading.trim());
      await api(testId ? `/teacher/tests/${testId}` : "/teacher/tests",
        json(testId ? "PUT" : "POST", { ...draft, words }));
      onSaved();
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }

  const showGroups = draft.mode === "mixed" || draft.mode === "headings";

  return <section className="card editor">
    <div className="results-heading"><div><h2>{testId ? "Testni tahrirlash" : "Yangi lug‘at testi"}</h2>
      <p className="muted">Test turini va so‘zlar ro‘yxatini kiriting.</p></div>
      <button type="button" className="button secondary" onClick={onClose}><X size={16} /> Yopish</button>
    </div>
    {error && <Notice>{error}</Notice>}
    {loading ? !error && <Loading /> : <form onSubmit={save}>
      <div className="editor-details">
        <label>Test nomi<input value={draft.title} maxLength={100} required placeholder="Masalan, Mevalar va sabzavotlar"
          onChange={(event) => update("title", event.target.value)} /></label>
        <label>Sinf<input value={draft.class_label} maxLength={24} placeholder="Barcha sinflar"
          onChange={(event) => update("class_label", event.target.value)} /></label>
        <label>Test turi<select value={draft.mode} onChange={(event) => update("mode", event.target.value as Mode)}>
          {Object.entries(labels).map(([mode, label]) => <option key={mode} value={mode}>{label}</option>)}
        </select></label>
        <label>Vaqt (daqiqa)<input type="number" min={1} max={60} required value={draft.duration_minutes || ""}
          onChange={(event) => update("duration_minutes", Number(event.target.value))} /></label>
        <label className="full-width">Tavsif <span className="optional">(ixtiyoriy)</span><input value={draft.description} maxLength={400}
          placeholder="O‘quvchilar ko‘radigan qisqa izoh" onChange={(event) => update("description", event.target.value)} /></label>
      </div>
      <h3>Lug‘at kiritish</h3>
      <div className="source-tabs" aria-label="So‘zlarni kiritish usuli">
        <button type="button" aria-pressed={source === "manual"} onClick={() => setSource("manual")} disabled={busy}><Keyboard size={17} /> Qo‘lda</button>
        <button type="button" aria-pressed={source === "text"} onClick={() => setSource("text")} disabled={busy}><ListPlus size={17} /> Matndan</button>
        <button type="button" aria-pressed={source === "pdf"} onClick={() => { setSource("pdf"); setFile(undefined); }} disabled={busy}><FileText size={17} /> PDF / ODF</button>
        <button type="button" aria-pressed={source === "image"} onClick={() => { setSource("image"); setFile(undefined); }} disabled={busy}><ImagePlus size={17} /> Rasm</button>
      </div>
      {status && <p className="muted" role="status">{status}</p>}
      {source === "manual" ? <>
        <p className="muted">Har bir qatorda bitta so‘z va uning tarjimasini yozing.</p>
        <div className="word-grid">
          <div className="word-row word-labels"><span>So‘z</span><span>Tarjima</span><span /></div>
          {draft.words.map((word, index) => <div key={index} className="word-row">
            <input aria-label={`So‘z ${index + 1}`} placeholder="apple" value={word.term} maxLength={80} onChange={(event) => editWord(index, "term", event.target.value)} />
            <input aria-label={`Tarjima ${index + 1}`} placeholder="olma" value={word.translation} maxLength={80} onChange={(event) => editWord(index, "translation", event.target.value)} />
            <button type="button" className="icon-button" aria-label={`${index + 1}-qatorni o‘chirish`}
              onClick={() => update("words", draft.words.filter((_, position) => position !== index))}><X size={18} /></button>
          </div>)}
        </div>
        <button type="button" className="button secondary" disabled={draft.words.length >= 80}
          onClick={() => update("words", [...draft.words, emptyWord()])}><Plus size={16} /> So‘z qo‘shish</button>
        {showGroups && <details className="word-groups" key={draft.mode} open={draft.mode === "headings"}>
          <summary>{draft.mode === "mixed" ? "So‘zlarni guruhlash (ixtiyoriy)" : "So‘zlarni guruhlash"}</summary>
          <p className="muted">Matching Headings savollari uchun har bir so‘zga guruh kiriting. Kamida ikkita turli guruh kerak.</p>
          <div className="group-grid">
            {draft.words.map((word, index) => word.term.trim() && (
              <label key={index}>
                <span>{word.term.trim()}</span>
                <input aria-label={`${word.term.trim()} guruhi`} placeholder="Masalan, Mevalar" value={word.heading} maxLength={50}
                  onChange={(event) => editWord(index, "heading", event.target.value)} />
              </label>
            ))}
          </div>
        </details>}
      </> : <div className="bulk-panel">
        {source !== "text" && <div className="upload-row">
          <input key={source} type="file" aria-label={source === "pdf" ? "PDF yoki OpenDocument fayli" : "Rasm fayli"}
            accept={source === "pdf" ? ".pdf,.odt,.ods" : "image/png,image/jpeg,image/webp"}
            disabled={busy} onChange={(event) => setFile(event.target.files?.[0])} />
          <button type="button" className="button secondary" disabled={!file || busy} onClick={() => void extract()}><Upload size={17} /> {busy ? "O‘qilmoqda…" : "Faylni o‘qish"}</button>
        </div>}
        <label htmlFor="bulk-words">Har qatorda so‘z | tarjima</label>
        <textarea id="bulk-words" rows={6} maxLength={20000} value={text} spellCheck={false}
          placeholder={"apple | olma\ncarrot | sabzi"} onChange={(event) => setText(event.target.value)} />
        <button type="button" className="button secondary" disabled={busy} onClick={addText}><Plus size={17} /> Ro‘yxatga qo‘shish</button>
      </div>}
      <div className="editor-actions"><button type="submit" className="button primary" disabled={busy || source !== "manual"}>{busy ? "Saqlanmoqda…" : "Testni saqlash"}</button></div>
    </form>}
  </section>;
}
