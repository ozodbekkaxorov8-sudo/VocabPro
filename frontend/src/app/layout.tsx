import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/manrope";
import "./styles.css";
import { SiteFooter, SiteHeader } from "@/components/chrome";

export const metadata: Metadata = {
  title: { default: "VocabPro — Lug‘at mashqlari", template: "%s · VocabPro" },
  description: "Maktab o‘quvchilari va o‘qituvchilari uchun lug‘at mashqlari va testlar.",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "VocabPro" },
};

export const viewport: Viewport = { themeColor: "#f8f7fd" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz">
      <body>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
