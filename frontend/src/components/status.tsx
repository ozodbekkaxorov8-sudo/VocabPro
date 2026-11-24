import { BookOpen, CircleAlert, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

export function Notice({ children }: { children: ReactNode }) {
  return <p className="notice" role="alert"><CircleAlert size={18} /> <span>{children}</span></p>;
}

export function Loading() {
  return <p className="loading" role="status"><LoaderCircle className="spinner" size={19} /> Yuklanmoqda…</p>;
}

export function Empty({ title, text }: { title: string; text: string }) {
  return <div className="empty card"><span className="icon-box purple"><BookOpen size={22} /></span><h3>{title}</h3><p>{text}</p></div>;
}
