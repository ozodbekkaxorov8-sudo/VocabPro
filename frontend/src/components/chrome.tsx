"use client";

import { BookOpen, GraduationCap, Presentation } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { InstallControl } from "./install";

function Brand({ small = false }: { small?: boolean }) {
  return (
    <Link href="/" className={`brand ${small ? "brand-small" : ""}`} aria-label="VocabPro bosh sahifa">
      <span className="brand-icon"><BookOpen size={small ? 17 : 22} strokeWidth={2.2} /></span>
      <span>Vocab<span className="brand-accent">Pro</span></span>
    </Link>
  );
}

export function SiteHeader() {
  const teacher = usePathname().startsWith("/teacher");
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Brand />
        <nav className="portal-nav" aria-label="Panellar">
          <Link href="/" className={!teacher ? "current" : ""} aria-current={!teacher ? "page" : undefined}>
            <GraduationCap size={18} /><span>O‘quvchi paneli</span>
          </Link>
          <Link href="/teacher" className={teacher ? "current" : ""} aria-current={teacher ? "page" : undefined}>
            <Presentation size={18} /><span>O‘qituvchi paneli</span>
          </Link>
        </nav>
        <InstallControl />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="container footer">
      <Brand small />
      <p>Maktablar uchun lug‘at platformasi</p>
      <span>© VocabPro</span>
    </footer>
  );
}
