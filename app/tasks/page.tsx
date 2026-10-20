"use client";

import { ArrowLeft, Check, ListTodo, LoaderCircle, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Task, addTask, clearDoneTasks, loadTasks, removeTask, setTaskDone } from "@/lib/tasks";

type AuthSnapshot = { historyScope: string };

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [scope, setScope] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const snapshot = await response.json();
        if (!active) return;
        if (
          !response.ok ||
          !snapshot ||
          typeof snapshot !== "object" ||
          typeof (snapshot as AuthSnapshot).historyScope !== "string" ||
          !(snapshot as AuthSnapshot).historyScope
        ) {
          throw new Error("Não foi possível confirmar a conta. Recarrega a página.");
        }
        setScope((snapshot as AuthSnapshot).historyScope);
        const list = await loadTasks((snapshot as AuthSnapshot).historyScope);
        if (!active) return;
        setTasks(list);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Não foi possível abrir as tarefas.");
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const task = await addTask(scope, title);
      setTasks((current) => [task, ...current]);
      setTitle("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível guardar a tarefa.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(task: Task) {
    setError("");
    try {
      await setTaskDone(scope, task.id, !task.done);
      setTasks((current) =>
        current
          .map((entry) => (entry.id === task.id ? { ...entry, done: !entry.done } : entry))
          .sort((a, b) => (a.done === b.done ? b.createdAt.localeCompare(a.createdAt) : a.done ? 1 : -1)),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar a tarefa.");
    }
  }

  async function remove(task: Task) {
    setError("");
    try {
      await removeTask(scope, task.id);
      setTasks((current) => current.filter((entry) => entry.id !== task.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível apagar a tarefa.");
    }
  }

  async function clearDone() {
    setError("");
    try {
      await clearDoneTasks(scope);
      setTasks((current) => current.filter((entry) => !entry.done));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível limpar as concluídas.");
    }
  }

  const pending = tasks.filter((task) => !task.done).length;
  const done = tasks.length - pending;

  return (
    <main className="plans-page">
      <header className="plans-header">
        <Link href="/" className="plans-back">
          <ArrowLeft size={16} /> Voltar ao chat
        </Link>
        <span>
          <Sparkles size={15} /> AKIRA
        </span>
      </header>
      <section className="plans-intro">
        <span className="plans-eyebrow">TAREFAS AKIRA</span>
        <h1>A tua lista de tarefas.</h1>
        <p>Anota o que tens a fazer, marca quando fica pronto e acompanha o teu dia. Fica guardado no teu navegador.</p>
      </section>
      <section className="tasks-panel" aria-label="Lista de tarefas">
        {error && (
          <div className="plans-notice" role="status">
            <p>{error}</p>
          </div>
        )}
        <form className="tasks-form" onSubmit={submit}>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder="Nova tarefa, por exemplo: Renovar o domínio"
            aria-label="Nova tarefa"
            disabled={!ready || busy}
          />
          <button type="submit" className="tasks-add" disabled={!ready || busy || !title.trim()} aria-label="Adicionar tarefa">
            {busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={17} />}
          </button>
        </form>
        <div className="tasks-meta">
          <ListTodo size={13} />
          <span>
            {pending} {pending === 1 ? "pendente" : "pendentes"} · {done} {done === 1 ? "concluída" : "concluídas"}
          </span>
          {done > 0 && (
            <button onClick={() => void clearDone()}>limpar concluídas</button>
          )}
        </div>
        <ul className="tasks-list">
          {!ready && <li className="tasks-empty">A carregar tarefas…</li>}
          {ready && tasks.length === 0 && !error && (
            <li className="tasks-empty">Sem tarefas por agora. Adiciona a primeira acima.</li>
          )}
          {tasks.map((task) => (
            <li className={`tasks-entry ${task.done ? "done" : ""}`} key={task.id}>
              <button
                className="tasks-check"
                onClick={() => void toggle(task)}
                disabled={!ready}
                aria-pressed={task.done}
                aria-label={task.done ? `Reabrir "${task.title}"` : `Confirmar "${task.title}" como feita`}
              >
                {task.done && <Check size={13} />}
              </button>
              <span className="tasks-title">{task.title}</span>
              <button
                className="icon-button tasks-remove"
                onClick={() => void remove(task)}
                aria-label={`Apagar "${task.title}"`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      </section>
      <p className="plans-footnote">As tarefas ficam guardadas neste navegador, associadas à tua conta AKIRA.</p>
    </main>
  );
}
