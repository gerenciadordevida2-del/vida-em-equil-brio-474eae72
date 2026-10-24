import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Play,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Target,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { Page, Card } from "@/components/AppShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useData,
  update,
  uid,
  today,
  fmtDate,
  type WorkoutPlan,
  type Exercise,
  type HealthGoal,
} from "@/lib/store";

export const Route = createFileRoute("/_authenticated/treinos")({
  head: () => ({
    meta: [
      { title: "Treinos — Gerenciador de Vida" },
      { name: "description", content: "Planos, calendário de treinos, histórico e metas." },
      { property: "og:title", content: "Treinos — Gerenciador de Vida" },
      {
        property: "og:description",
        content: "Seus planos, histórico de treinos e metas de evolução.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Treinos,
});

const field =
  "h-11 w-full rounded-xl border bg-input/40 px-3 text-base outline-none focus:border-primary";
const num = (s: string) => parseFloat(s.replace(",", ".")) || 0;
const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shiftMonth = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);
const monthLabel = (d: Date) => d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7);

function Treinos() {
  const data = useData();
  const [tab, setTab] = useState<"planos" | "calendario" | "metas" | "historico">("planos");
  const [editPlan, setEditPlan] = useState<WorkoutPlan | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [running, setRunning] = useState<WorkoutPlan | null>(null);
  const [month, setMonth] = useState(() => new Date(`${today()}T12:00:00`));
  const [selectedDay, setSelectedDay] = useState(today());
  const [goalOpen, setGoalOpen] = useState(false);

  const logs = [...data.workoutLogs].sort((a, b) => b.date.localeCompare(a.date));
  const monthCount = logs.filter((l) => sameMonth(l.date, today())).length;
  const selectedLogs = logs.filter((l) => l.date === selectedDay);
  const monthLogs = logs.filter((l) => sameMonth(l.date, dateKey(month)));

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const calendarCells = [
    ...Array.from({ length: offset }, () => null as string | null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      dateKey(new Date(month.getFullYear(), month.getMonth(), i + 1)),
    ),
  ];

  function markFreeWorkout() {
    if (selectedLogs.length) {
      toast.error("Já existe um treino registrado nesse dia.");
      return;
    }
    update((d) => ({
      ...d,
      workoutLogs: [
        ...d.workoutLogs,
        {
          id: uid(),
          planId: "livre",
          planName: "Treino livre",
          date: selectedDay,
          exercises: [],
          notes: "Treino marcado pelo calendário.",
        },
      ],
    }));
    toast.success("Dia de treino marcado! 💪");
  }

  return (
    <Page
      title="Treinos"
      subtitle={`${monthCount} treino${monthCount === 1 ? "" : "s"} este mês`}
      action={
        <button
          onClick={() => {
            setEditPlan(null);
            setPlanOpen(true);
          }}
          className="shadow-glow flex h-11 items-center gap-1 rounded-xl bg-primary px-4 font-semibold text-primary-foreground"
        >
          <Plus className="h-5 w-5" /> Plano
        </button>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1 sm:grid-cols-4">
        {(
          [
            ["planos", "Planos"],
            ["calendario", "Calendário"],
            ["metas", "Metas"],
            ["historico", "Histórico"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg py-2 text-sm font-semibold ${tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "planos" && (
        <div className="space-y-3">
          {data.plans.length === 0 && (
            <Card>
              <p className="text-sm text-muted-foreground">
                Crie seu primeiro plano, como Treino A — Peito e tríceps.
              </p>
            </Card>
          )}
          {data.plans.map((p) => (
            <Card key={p.id}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{p.name}</h2>
                  <p className="text-xs text-muted-foreground">{p.exercises.length} exercício(s)</p>
                </div>
                <div className="flex gap-3 text-muted-foreground">
                  <button
                    aria-label="Editar plano"
                    onClick={() => {
                      setEditPlan(p);
                      setPlanOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    aria-label="Excluir plano"
                    onClick={() =>
                      confirm(`Excluir "${p.name}"? O histórico será mantido.`) &&
                      update((d) => ({ ...d, plans: d.plans.filter((y) => y.id !== p.id) }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <ul className="mb-3 space-y-1 text-sm">
                {p.exercises.map((e) => (
                  <li key={e.id} className="flex justify-between">
                    <span>{e.name}</span>
                    <span className="text-muted-foreground">
                      {e.sets}×{e.reps}
                      {e.weight ? ` · ${e.weight}kg` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setRunning(p)}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-accent-foreground"
              >
                <Play className="h-4 w-4" /> Registrar treino
              </button>
            </Card>
          ))}
        </div>
      )}

      {tab === "calendario" && (
        <div className="space-y-3">
          <Card>
            <div className="mb-4 flex items-center justify-between gap-2">
              <button
                aria-label="Mês anterior"
                className="rounded-lg p-2"
                onClick={() => setMonth((m) => shiftMonth(m, -1))}
              >
                <ChevronLeft />
              </button>
              <h2 className="font-semibold capitalize">{monthLabel(month)}</h2>
              <button
                aria-label="Próximo mês"
                className="rounded-lg p-2"
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
              >
                <ChevronRight />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((day, i) => {
                const trained = day ? logs.some((l) => l.date === day) : false;
                const chosen = day === selectedDay;
                const isToday = day === today();
                return (
                  <button
                    key={day ?? `empty-${i}`}
                    disabled={!day}
                    onClick={() => day && setSelectedDay(day)}
                    className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm ${!day ? "" : chosen ? "bg-primary text-primary-foreground" : "bg-secondary"} ${isToday && !chosen ? "ring-1 ring-primary" : ""}`}
                  >
                    {day ? Number(day.slice(-2)) : ""}
                    {trained && (
                      <span
                        className={`mt-0.5 h-1.5 w-1.5 rounded-full ${chosen ? "bg-primary-foreground" : "bg-primary"}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Os pontos indicam dias com treino registrado.
            </p>
            <div className="mt-3 rounded-xl bg-secondary/60 p-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <p className="font-semibold">{fmtDate(selectedDay)}</p>
              </div>
              {selectedLogs.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {selectedLogs.map((l) => (
                    <p key={l.id} className="text-sm">
                      ✓ {l.planName}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Nenhum treino registrado neste dia.
                </p>
              )}
              <button
                onClick={markFreeWorkout}
                className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border text-sm font-semibold"
                disabled={selectedLogs.length > 0}
              >
                <Check className="h-4 w-4" />{" "}
                {selectedLogs.length ? "Treino já registrado" : "Marcar treino livre"}
              </button>
              {data.plans.length > 0 && (
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {data.plans.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setRunning(p)}
                      className="rounded-xl bg-primary/10 p-2 text-sm font-medium text-primary"
                    >
                      Registrar {p.name} neste dia
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
          <Card>
            <h3 className="mb-2 font-semibold">Resumo do mês</h3>
            <p className="text-2xl font-bold">{monthLogs.length} treino(s)</p>
            <p className="text-sm text-muted-foreground">Registros neste mês</p>
          </Card>
        </div>
      )}

      {tab === "metas" && <Goals goals={data.healthGoals} onAdd={() => setGoalOpen(true)} />}

      {tab === "historico" && (
        <div className="space-y-3">
          {logs.length === 0 && (
            <Card>
              <p className="text-sm text-muted-foreground">Nenhum treino registrado ainda.</p>
            </Card>
          )}
          {logs.map((l) => (
            <Card key={l.id}>
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <h2 className="font-semibold">{l.planName}</h2>
                  <p className="text-xs text-muted-foreground">{fmtDate(l.date)}</p>
                </div>
                <button
                  aria-label="Excluir registro"
                  className="text-muted-foreground"
                  onClick={() =>
                    confirm("Excluir este registro?") &&
                    update((d) => ({
                      ...d,
                      workoutLogs: d.workoutLogs.filter((y) => y.id !== l.id),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {l.exercises.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {l.exercises.map((e) => (
                    <li key={e.id} className="flex justify-between">
                      <span>{e.name}</span>
                      <span className="text-muted-foreground">
                        {e.sets}×{e.reps}
                        {e.weight ? ` · ${e.weight}kg` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {l.notes && <p className="mt-2 text-sm text-muted-foreground">“{l.notes}”</p>}
            </Card>
          ))}
        </div>
      )}

      <PlanDialog
        key={(editPlan?.id ?? "new") + String(planOpen)}
        open={planOpen}
        onOpenChange={setPlanOpen}
        plan={editPlan}
      />
      {running && (
        <LogDialog
          key={`${running.id}-${selectedDay}`}
          plan={running}
          initialDate={selectedDay}
          onClose={() => setRunning(null)}
          onSaved={() => {
            setRunning(null);
            setTab("historico");
          }}
        />
      )}
      <GoalDialog open={goalOpen} onClose={() => setGoalOpen(false)} />
    </Page>
  );
}

function Goals({ goals, onAdd }: { goals: HealthGoal[]; onAdd: () => void }) {
  const data = useData();
  const [values, setValues] = useState<Record<string, string>>({});
  const month = today().slice(0, 7);
  const types = [
    { value: "peso", label: "Peso" },
    { value: "treinos", label: "Frequência de treinos" },
    { value: "habito", label: "Hábito" },
    { value: "outra", label: "Força ou outra meta" },
  ];

  function progress(g: HealthGoal) {
    if (g.category === "treinos" && g.unit.includes("/mês")) {
      const count = data.workoutLogs.filter((l) => l.date.startsWith(month)).length;
      return {
        current: count,
        percent: Math.min(100, Math.round((count / Math.max(1, g.targetValue)) * 100)),
      };
    }
    const start = g.startValue;
    if (g.category === "peso" && start !== undefined && start !== g.targetValue) {
      const total = Math.abs(start - g.targetValue);
      const done = start > g.targetValue ? start - g.currentValue : g.currentValue - start;
      return {
        current: g.currentValue,
        percent: Math.max(0, Math.min(100, Math.round((done / total) * 100))),
      };
    }
    return {
      current: g.currentValue,
      percent: Math.max(
        0,
        Math.min(100, Math.round((g.currentValue / Math.max(1, g.targetValue)) * 100)),
      ),
    };
  }

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-3">
          <Target className="h-8 w-8 text-primary" />
          <div className="flex-1">
            <h2 className="font-semibold">Metas de evolução</h2>
            <p className="text-sm text-muted-foreground">
              Acompanhe seus objetivos e seu progresso.
            </p>
          </div>
          <button
            onClick={onAdd}
            className="rounded-xl bg-primary p-3 text-primary-foreground"
            aria-label="Adicionar meta"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </Card>
      {goals.length === 0 && (
        <Card>
          <p className="text-sm text-muted-foreground">
            Ainda não há metas. Crie uma para acompanhar seu peso, frequência de treino ou evolução
            de carga.
          </p>
        </Card>
      )}
      {goals.map((g) => {
        const p = progress(g);
        const isAuto = g.category === "treinos" && g.unit.includes("/mês");
        return (
          <Card key={g.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{g.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {types.find((t) => t.value === g.category)?.label ?? "Meta"}
                  {g.deadline ? ` · até ${fmtDate(g.deadline)}` : ""}
                </p>
              </div>
              <button
                aria-label="Excluir meta"
                className="text-muted-foreground"
                onClick={() =>
                  confirm(`Excluir a meta "${g.name}"?`) &&
                  update((d) => ({ ...d, healthGoals: d.healthGoals.filter((x) => x.id !== g.id) }))
                }
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-2 text-sm">
              <span>
                {p.current} {g.unit.replace("/mês", "")} de {g.targetValue}{" "}
                {g.unit.replace("/mês", "")}
              </span>
              <span className="font-semibold">{p.percent}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${p.percent}%` }}
              />
            </div>
            {!isAuto && (
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = num(values[g.id] ?? "");
                  update((d) => ({
                    ...d,
                    healthGoals: d.healthGoals.map((x) =>
                      x.id === g.id ? { ...x, currentValue: value } : x,
                    ),
                  }));
                  setValues((v) => ({ ...v, [g.id]: "" }));
                  toast.success("Progresso atualizado!");
                }}
              >
                <input
                  value={values[g.id] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [g.id]: e.target.value }))}
                  inputMode="decimal"
                  className={field}
                  placeholder={`Atualizar ${g.unit}`}
                />
                <button className="rounded-xl bg-primary px-4 font-semibold text-primary-foreground">
                  Salvar
                </button>
              </form>
            )}
            {isAuto && (
              <p className="mt-2 text-xs text-muted-foreground">
                Atualizada automaticamente pelos treinos registrados neste mês.
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function GoalDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<HealthGoal["category"]>("treinos");
  const [current, setCurrent] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("treinos/mês");
  const [deadline, setDeadline] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !unit.trim() || !target) {
      toast.error("Preencha o nome, a meta e a unidade.");
      return;
    }
    const currentValue = num(current);
    const targetValue = num(target);
    if (targetValue <= 0) {
      toast.error("A meta precisa ser maior que zero.");
      return;
    }
    update((d) => ({
      ...d,
      healthGoals: [
        ...d.healthGoals,
        {
          id: uid(),
          name: name.trim(),
          category,
          currentValue,
          targetValue,
          ...(category === "peso" ? { startValue: currentValue } : {}),
          unit: unit.trim(),
          ...(deadline ? { deadline } : {}),
          createdAt: today(),
        },
      ],
    }));
    toast.success("Meta criada!");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[92vw] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova meta de evolução</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: chegar aos 70 kg"
            className={field}
          />
          <label className="block text-sm text-muted-foreground">
            Tipo
            <select
              value={category}
              onChange={(e) => {
                const c = e.target.value as HealthGoal["category"];
                setCategory(c);
                if (c === "peso") setUnit("kg");
                else if (c === "treinos") setUnit("treinos/mês");
                else if (c === "habito") setUnit("dias");
                else setUnit("kg");
              }}
              className={`${field} mt-1`}
            >
              <option value="peso">Peso</option>
              <option value="treinos">Frequência de treinos</option>
              <option value="habito">Hábito</option>
              <option value="outra">Força ou outra meta</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm text-muted-foreground">
              {category === "peso" ? "Peso atual" : "Valor atual"}
              <input
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                inputMode="decimal"
                placeholder="Ex.: 80"
                className={`${field} mt-1`}
              />
            </label>
            <label className="block text-sm text-muted-foreground">
              {category === "peso" ? "Peso desejado" : "Meta"}
              <input
                required
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                inputMode="decimal"
                placeholder="Ex.: 70"
                className={`${field} mt-1`}
              />
            </label>
          </div>
          <label className="block text-sm text-muted-foreground">
            Unidade
            <input
              required
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="kg, treinos/mês, dias..."
              className={`${field} mt-1`}
            />
          </label>
          <label className="block text-sm text-muted-foreground">
            Prazo (opcional)
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={`${field} mt-1`}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Para metas de treino por mês, use a unidade “treinos/mês” para contar automaticamente os
            registros.
          </p>
          <button className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground">
            Salvar meta
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Row = { id: string; name: string; sets: string; reps: string; weight: string };
const toRows = (ex: Exercise[]): Row[] =>
  ex.map((e) => ({
    id: e.id,
    name: e.name,
    sets: String(e.sets),
    reps: String(e.reps),
    weight: e.weight ? String(e.weight) : "",
  }));
const fromRows = (rows: Row[]): Exercise[] =>
  rows
    .filter((r) => r.name.trim())
    .map((r) => ({
      id: r.id,
      name: r.name.trim(),
      sets: Math.max(1, Math.round(num(r.sets))),
      reps: Math.max(1, Math.round(num(r.reps))),
      ...(num(r.weight) ? { weight: num(r.weight) } : {}),
    }));
const blank = (): Row => ({ id: uid(), name: "", sets: "3", reps: "12", weight: "" });

function ExerciseRows({ rows, setRows }: { rows: Row[]; setRows: (r: Row[]) => void }) {
  const set = (i: number, k: keyof Row, v: string) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={r.id} className="rounded-xl border bg-secondary/50 p-2">
          <div className="mb-2 flex gap-2">
            <input
              value={r.name}
              onChange={(e) => set(i, "name", e.target.value)}
              placeholder="Exercício"
              className={field}
            />
            <button
              type="button"
              aria-label="Remover exercício"
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
              className="px-2 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <label>
              Séries
              <input
                inputMode="numeric"
                value={r.sets}
                onChange={(e) => set(i, "sets", e.target.value)}
                className={`${field} mt-1`}
              />
            </label>
            <label>
              Repetições
              <input
                inputMode="numeric"
                value={r.reps}
                onChange={(e) => set(i, "reps", e.target.value)}
                className={`${field} mt-1`}
              />
            </label>
            <label>
              Carga (kg)
              <input
                inputMode="decimal"
                value={r.weight}
                onChange={(e) => set(i, "weight", e.target.value)}
                className={`${field} mt-1`}
              />
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows([...rows, blank()])}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-semibold text-primary"
      >
        <Plus className="h-4 w-4" /> Adicionar exercício
      </button>
    </div>
  );
}

function PlanDialog({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plan: WorkoutPlan | null;
}) {
  const [name, setName] = useState(plan?.name ?? "");
  const [rows, setRows] = useState<Row[]>(plan ? toRows(plan.exercises) : [blank()]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const exercises = fromRows(rows);
    if (!name.trim()) return;
    if (exercises.length === 0) {
      toast.error("Adicione pelo menos um exercício.");
      return;
    }
    update((d) => ({
      ...d,
      plans: plan
        ? d.plans.map((p) => (p.id === plan.id ? { ...p, name: name.trim(), exercises } : p))
        : [...d.plans, { id: uid(), name: name.trim(), exercises }],
    }));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[92vw] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{plan ? "Editar plano" : "Novo plano de treino"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do plano (ex: Treino A)"
            className={field}
          />
          <ExerciseRows rows={rows} setRows={setRows} />
          <button className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground">
            Salvar plano
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LogDialog({
  plan,
  initialDate,
  onClose,
  onSaved,
}: {
  plan: WorkoutPlan;
  initialDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(toRows(plan.exercises));
  const [date, setDate] = useState(initialDate || today());
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const exercises = fromRows(rows);
    if (exercises.length === 0) {
      toast.error("Registre pelo menos um exercício.");
      return;
    }
    update((d) => ({
      ...d,
      workoutLogs: [
        ...d.workoutLogs,
        {
          id: uid(),
          planId: plan.id,
          planName: plan.name,
          date: date || today(),
          exercises,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      ],
    }));
    toast.success("Treino registrado! 💪");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[92vw] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar: {plan.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm text-muted-foreground">
            Data
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${field} mt-1`}
            />
          </label>
          <p className="text-xs text-muted-foreground">Ajuste o que você realmente fez.</p>
          <ExerciseRows rows={rows} setRows={setRows} />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações (opcional)"
            className="min-h-20 w-full rounded-xl border bg-input/40 p-3 text-base outline-none focus:border-primary"
          />
          <button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground">
            <Check className="h-5 w-5" /> Concluir treino
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
