import Image from "next/image";
import { BookOpen, ClipboardCheck, LogIn, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export function Entry({ children, teacher = false }: { children: ReactNode; teacher?: boolean }) {
  return (
    <div className="container landing">
      <section className="entry-grid" aria-label={teacher ? "O‘qituvchi paneli" : "O‘quvchi paneli"}>
        <div className="hero">
          <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
          <div className="hero-copy">
            <span className="hero-label"><Sparkles size={16} /> MAKTAB UCHUN LUG‘AT PLATFORMASI</span>
            <h1>{teacher ? <>Lug‘at darsini<br />oson boshqaring.</> : <>So‘zlarni o‘rganing.<br />Bilimingizni <em>sinang.</em></>}</h1>
            <p>{teacher ? "Lug‘atlarni kiriting, sinflarga test oching va natijalarni bir joyda kuzating." :
              "Ustozingiz tayyorlagan lug‘atlarni yodlang va qanchasini eslab qolganingizni tekshiring."}</p>
          </div>
          <Image className="hero-art" src="/open-book.webp" alt="" width={920} height={613} loading="eager" unoptimized />
          <span className="hero-spark" aria-hidden="true">✦</span>
        </div>
        {children}
      </section>
      {!teacher && <section className="steps" aria-labelledby="how-it-works">
        <h2 id="how-it-works">Qanday ishlaydi?</h2>
        <div className="steps-grid">
          <Step title="Panelga kiring" text="Ismingiz va sinfingizni kiriting." icon={<LogIn size={22} />} color="purple" />
          <Step title="Lug‘atlarni yodlang" text="So‘z va tarjimalarni kartochkalarda ko‘ring." icon={<BookOpen size={22} />} color="mint" />
          <Step title="Testni bajaring" text="Javob bering va natijangizni ko‘ring." icon={<ClipboardCheck size={22} />} color="amber" />
        </div>
      </section>}
    </div>
  );
}

function Step({ title, text, icon, color }: { title: string; text: string; icon: ReactNode; color: string }) {
  return <article className="step card"><span className={`icon-box ${color}`}>{icon}</span><div><h3>{title}</h3><p>{text}</p></div></article>;
}
