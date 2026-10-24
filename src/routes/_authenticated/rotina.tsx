import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Check, Pencil, Clock } from "lucide-react";
import { Page, Card } from "@/components/AppShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useData, update, uid, today, type Task, type Priority } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/rotina")({
  head: () => ({
    meta: [
      { title: "Rotina — Gerenciador de Vida" },
      {
        name: "description",
        content: "Organize suas tarefas do dia e da semana com horário e prioridade.",
      },
      { property: "og:title", content: "Rotina — Gerenciador de Vida" },
      {
        property: "og:description",
        content: "Tarefas do dia e da semana, com horário e prioridade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Rotina,
});

const field =
  "h-12 w-full rounded-xl border bg-input/40 px-3 text-base outline-none focus:border-primary";
const PRI: Record<Priority, { label: string; cls: string; order: number }> = {
  alta: { label: "Alta", cls: "bg-destructive/20 text-destructive", order: 0 },
  media: { label: "Média", cls: "bg-warning/20 text-warning", order: 1 },
  baixa: { label: "Baixa", cls: "bg-accent text-accent-foreground", order: 2 },
};

function addDays(base: string, n: number) {
  const [y = 2000, m = 1, d = 1] = base.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
function dayLabel(s: string, t: string) {
  if (s === t) return "Hoje";
  if (s === addDays(t, 1)) return "Amanhã";
  const [y = 2000, m = 1, d = 1] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}
const sortTasks = (a: Task, b: Task) =>
  Number(a.done) - Number(b.done) ||
  (a.time || "99").localeCompare(b.time || "99") ||
  PRI[a.priority || "media"].order - PRI[b.priority || "media"].order;

function Rotina() {
  const data = useData();
  const t = today();
  const [tab, setTab] = useState<"hoje" | "semana">("hoje");
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);

  const late = data.tasks.filter((x) => !x.done && x.date < t).sort(sortTasks);
  const todays = data.tasks.filter((x) => x.date === t).sort(sortTasks);
  const week = Array.from({ length: 7 }, (_, i) => addDays(t, i)).map((d) => ({
    d,
    items: data.tasks.filter((x) => x.date === d).sort(sortTasks),
  }));

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (x: Task) => {
    setEditing(x);
    setOpen(true);
  };

  return (
    <Page
      title="Rotina"
      subtitle="Suas tarefas organizadas"
      action={
        <button
          onClick={openNew}
          className="shadow-glow flex h-11 items-center gap-1 rounded-xl bg-primary px-4 font-semibold text-primary-foreground"
        >
          <Plus className="h-5 w-5" /> Nova
        </button>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
        {(["hoje", "semana"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-lg py-2 text-sm font-semibold ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {k === "hoje" ? "Hoje" : "Semana"}
          </button>
        ))}
      </div>

      {late.length > 0 && (
        <Card className="mb-4 border-destructive/40">
          <h2 className="mb-2 font-semibold text-destructive">Atrasadas</h2>
          <TaskList items={late} onEdit={openEdit} showDate />
        </Card>
      )}

      {tab === "hoje" ? (
        <Card>
          <h2 className="mb-2 font-semibold">
            Hoje · {todays.filter((x) => x.done).length}/{todays.length} concluídas
          </h2>
          {todays.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma tarefa para hoje. Toque em “Nova”.
            </p>
          ) : (
            <TaskList items={todays} onEdit={openEdit} />
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {week.map(({ d, items }) => (
            <Card key={d}>
              <h2 className="mb-2 font-semibold capitalize">{dayLabel(d, t)}</h2>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Livre</p>
              ) : (
                <TaskList items={items} onEdit={openEdit} />
              )}
            </Card>
          ))}
        </div>
      )}

      <TaskDialog
        key={editing?.id ?? "new" + String(open)}
        open={open}
        onOpenChange={setOpen}
        task={editing}
      />
    </Page>
  );
}

function TaskList({
  items,
  onEdit,
  showDate,
}: {
  items: Task[];
  onEdit: (t: Task) => void;
  showDate?: boolean;
}) {
  return (
    <ul className="divide-y">
      {items.map((x) => {
        const p = PRI[x.priority || "media"];
        return (
          <li key={x.id} className="flex items-center gap-3 py-2.5">
            <button
              aria-label={x.done ? "Desmarcar tarefa" : "Concluir tarefa"}
              onClick={() =>
                update((d) => ({
                  ...d,
                  tasks: d.tasks.map((y) => (y.id === x.id ? { ...y, done: !y.done } : y)),
                }))
              }
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border-2 ${x.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}
            >
              {x.done && <Check className="h-4 w-4" />}
            </button>
            <button onClick={() => onEdit(x)} className="min-w-0 flex-1 text-left">
              <p
                className={`truncate font-medium ${x.done ? "text-muted-foreground line-through" : ""}`}
              >
                {x.title}
              </p>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                {x.time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {x.time}
                  </span>
                )}
                {showDate && <span>{x.date.split("-").reverse().join("/")}</span>}
                <span className={`rounded-full px-2 py-0.5 ${p.cls}`}>{p.label}</span>
              </p>
            </button>
            <button
              aria-label="Editar tarefa"
              onClick={() => onEdit(x)}
              className="text-muted-foreground"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              aria-label="Excluir tarefa"
              onClick={() =>
                confirm("Excluir esta tarefa?") &&
                update((d) => ({ ...d, tasks: d.tasks.filter((y) => y.id !== x.id) }))
              }
              className="text-muted-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function TaskDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: Task | null;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [date, setDate] = useState(task?.date ?? today());
  const [time, setTime] = useState(task?.time ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "media");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const fields: Pick<Task, "title" | "date" | "priority"> & { time?: string } = {
      title: title.trim(),
      date: date || today(),
      priority,
      ...(time ? { time } : {}),
    };
    update((d) => ({
      ...d,
      tasks: task
        ? d.tasks.map((y) =>
            y.id === task.id ? (({ time: _t, ...rest }) => ({ ...rest, ...fields }))(y) : y,
          )
        : [...d.tasks, { id: uid(), done: false, ...fields }],
    }));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <input
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da tarefa"
            className={field}
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm text-muted-foreground">
              Data
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`${field} mt-1`}
              />
            </label>
            <label className="text-sm text-muted-foreground">
              Horário
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={`${field} mt-1`}
              />
            </label>
          </div>
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Prioridade</p>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
              {(Object.keys(PRI) as Priority[]).map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setPriority(k)}
                  className={`rounded-lg py-2 text-sm font-semibold ${priority === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {PRI[k].label}
                </button>
              ))}
            </div>
          </div>
          <button className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground">
            Salvar
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
