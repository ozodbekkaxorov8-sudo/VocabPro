import type { Metadata } from "next";
import { TeacherPortal } from "@/features/teacher/portal";

export const metadata: Metadata = { title: "O‘qituvchi paneli" };

export default function Page() {
  return <TeacherPortal />;
}
