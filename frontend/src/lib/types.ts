export const labels = { written: "Yozma", matching: "Moslashtirish", headings: "Matching headings", mixed: "Aralash" } as const;
export type Mode = keyof typeof labels;
export type Word = { term: string; translation: string; heading: string };
export type Student = { name: string; class_label: string };
export type Test = {
  id: number; title: string; description: string; class_label: string; duration_minutes: number;
  word_count: number; mode: Mode; active: boolean;
};
export type Draft = Pick<Test, "title" | "description" | "class_label" | "duration_minutes" | "mode"> & { words: Word[] };
export type Question = { id: string; kind: Exclude<Mode, "mixed">; term: string; options: string[] };
export type FinishReason = "submitted" | "fullscreen_exit" | "time_limit" | "disconnected";
export type Attempt = {
  id: string; test_title: string; expires_at: string; finished_at: string | null; reason: FinishReason | null;
  correct_count: number | null; total_count: number; remaining_seconds?: number;
  questions?: Question[]; answers?: Record<string, string>; revision?: number;
};
export const reasonLabels: Record<FinishReason, string> = {
  submitted: "Topshirildi", fullscreen_exit: "To‘liq ekrandan chiqildi", time_limit: "Vaqt tugadi", disconnected: "Aloqa uzildi",
};
