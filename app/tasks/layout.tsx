import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tarefas",
  description: "A tua lista de tarefas AKIRA, guardada no teu navegador e associada à tua conta.",
  alternates: { canonical: "/tasks" },
};

export default function TasksLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
