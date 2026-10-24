import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Check,
  Plus,
  Trash2,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  CalendarClock,
  Target,
  PiggyBank,
  ListChecks as ListIcon,
  Bell,
  Settings,
  Sparkles,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  Circle,
  Wallet,
  Activity,
} from "lucide-react";
import { Card } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { dailyScore, toggleHabitDate } from "@/lib/home-metrics";
import { salesDashboard } from "@/lib/commerce";
import { useData, update, uid, today, brl, fmtDate } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Início — Gerenciador de Vida" },
      {
        name: "description",
        content: "Resumo do seu dia: tarefas, hábitos e finanças em um só lugar.",
      },
      { property: "og:title", content: "Início — Gerenciador de Vida" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Finanças, rotina, tarefas, hábitos e metas em um só lugar.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const data = useData();
  const { user } = Route.useRouteContext();
  const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
  const fullName = meta?.full_name || meta?.name || user.email?.split("@")[0] || "";
  const firstName = fullName.split(" ")[0] || "você";
  const sd = salesDashboard(data.business, today());
  const t = today();
  const month = t.slice(0, 7);

  const [showNotifications, setShowNotifications] = useState(false);
  const [task, setTask] = useState("");
  const [habit, setHabit] = useState("");
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalSaved, setGoalSaved] = useState("0");
  const [goalDeadline, setGoalDeadline] = useState("");

  const monthTx = data.transactions.filter((x) => x.date.startsWith(month));
  const inc = monthTx.filter((x) => x.type === "receita").reduce((s, x) => s + x.amount, 0);
  const exp = monthTx.filter((x) => x.type === "despesa").reduce((s, x) => s + x.amount, 0);
  const balance = inc - exp;
  const score = dailyScore(data.tasks, data.habits, t);
  const dailyAmounts = Array.from({ length: 7 }, (_, i) =>
    monthTx
      .filter((x) => Math.min(6, Math.floor((Number(x.date.slice(8)) - 1) / 5)) === i)
      .reduce((sum, x) => sum + x.amount, 0),
  );
  const maxAmount = Math.max(1, ...dailyAmounts);
  const upcoming = data.bills
    .filter((b) => !b.paid)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4);

  const tasks = data.tasks.filter((x) => x.date === t || !x.done);
  const doneCount = tasks.filter((x) => x.done).length;
  const habitsDone = data.habits.filter((h) => h.doneDates.includes(t)).length;

  const goals = data.financeGoals ?? [];

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const dateLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  function saveGoal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const target = Number(goalTarget);
    const saved = Number(goalSaved);

    if (
      !goalName.trim() ||
      !Number.isFinite(target) ||
      target <= 0 ||
      !Number.isFinite(saved) ||
      saved < 0 ||
      saved > target
    ) {
      return;
    }

    update((d) => ({
      ...d,
      financeGoals: [
        ...(d.financeGoals ?? []),
        {
          id: uid(),
          name: goalName.trim(),
          targetAmount: target,
          currentAmount: saved,
          deadline: goalDeadline || undefined,
          createdAt: today(),
        },
      ],
    }));

    setGoalName("");
    setGoalTarget("");
    setGoalSaved("0");
    setGoalDeadline("");
    setShowGoalForm(false);
  }

  return (
    <main className="home-enter mx-auto min-h-screen max-w-md px-5 pb-32 pt-7">
      <header className="mb-7 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            asChild
            variant="ghost"
            className="h-12 w-12 shrink-0 rounded-full border border-primary/25 bg-accent p-0 font-display text-lg text-primary"
          >
            <Link to="/ajustes" aria-label="Perfil e ajustes">
              {firstName.charAt(0).toUpperCase()}
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{greet}, {firstName}</p>
            <h1 className="mt-1 text-xl font-semibold">Seu dia, em equilíbrio.</h1>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notificações"
            aria-expanded={showNotifications}
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-full border border-glass-border"
          >
            <Bell />
            {upcoming.length > 0 && (
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-warning" />
            )}
          </Button>
          <Button asChild variant="ghost" size="icon" className="rounded-full">
            <Link to="/ajustes" aria-label="Ajustes">
              <Settings />
            </Link>
          </Button>
        </div>
      </header>
      <p className="mb-3 text-[11px] capitalize text-muted-foreground">{dateLabel}</p>
      {showNotifications && (
        <section className="premium-card mb-4 p-4" aria-label="Avisos">
          <h2 className="mb-2 text-sm font-semibold">Seus avisos</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta pendente.</p>
          ) : (
            upcoming.map((b) => (
              <p key={b.id} className="py-1 text-sm">
                {b.description} · {fmtDate(b.dueDate)}
              </p>
            ))
          )}
        </section>
      )}
      <section
        className="premium-card budget-card relative mb-4 overflow-hidden p-5"
        aria-label="Resumo de vendas"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Faturamento de hoje</p>
          <span className="rounded-full border border-glass-border px-2.5 py-1 text-[10px] text-accent-foreground">
            {sd.todayCount} venda(s)
          </span>
        </div>
        <p className="mt-2 break-words font-display text-3xl font-semibold">{brl(sd.todayRevenue)}</p>
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-glass-border pt-4">
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ArrowUpRight className="h-4 w-4 text-success" />
              Faturamento do mês
            </p>
            <p className="break-words text-base font-semibold">{brl(sd.monthRevenue)}</p>
            <p className="text-[11px] text-muted-foreground">{sd.monthCount} venda(s){sd.ticket !== null ? ` · ticket ${brl(sd.ticket)}` : ""}</p>
          </div>
          <div className="border-l border-glass-border pl-4">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ArrowDownRight className="h-4 w-4 text-warning" />
              A receber
            </p>
            <p className="break-words text-base font-semibold">{brl(sd.toReceive)}</p>
            {sd.overdue > 0 && <p className="text-[11px] text-destructive">{brl(sd.overdue)} em atraso</p>}
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          {sd.monthProfit === null
            ? "Lucro estimado: informe o custo dos produtos para calcular."
            : `Lucro estimado no mês: ${brl(sd.monthProfit)}${sd.profitPartial ? " (parcial: há vendas sem custo)" : ""}`}
        </p>
        <Button asChild variant="link" className="mt-3 h-auto p-0 text-[11px]">
          <Link to="/financas">
            Ver painel do negócio <ArrowRight />
          </Link>
        </Button>
      </section>
      <section className="premium-card assistant-card mb-5 p-4" aria-label="Assistente Groq">
        <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-neon text-neon-foreground">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Um passo à frente.</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Seu assistente pessoal · Groq
            </p>
          </div>
          <Button asChild variant="ghost" size="icon" className="rounded-full">
            <Link to="/assistente" aria-label="Conversar com Groq">
              <ArrowUpRight />
            </Link>
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            asChild
            variant="outline"
            className="h-9 rounded-full border-primary/20 bg-background/20 px-2 text-[10px]"
          >
            <Link to="/assistente">
              <Wallet />
              Minhas finanças
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-9 rounded-full border-primary/20 bg-background/20 px-2 text-[10px]"
          >
            <Link to="/assistente">
              <ListIcon />
              Organizar meu dia
            </Link>
          </Button>
        </div>
      </section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Seu ritmo de hoje</h2>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Activity className="h-3 w-3 text-primary" />
          Em movimento
        </span>
      </div>
      <section className="premium-card mb-4 p-4" aria-label="Produtividade do dia">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Score de produtividade</p>
            <p className="mt-1 text-sm">
              {score === 100 ? "Dia completo. Boa!" : "Cada pequeno passo conta."}
            </p>
          </div>
          <p className="font-display text-3xl font-semibold text-primary">
            <span data-testid="daily-score">{score}</span>
            <span className="text-xs text-muted-foreground"> /100</span>
          </p>
        </div>
        <progress
          className="home-progress mt-4 h-1.5 w-full"
          value={score}
          max={100}
          aria-label="Produtividade"
        />
        <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] text-muted-foreground">
          <span>
            {doneCount}/{tasks.length} tarefas concluídas
          </span>
          <span className="text-right">
            {habitsDone}/{data.habits.length} hábitos de hoje
          </span>
        </div>
      </section>
      <Card className="premium-card mb-4">
        <h2 className="mb-3 font-semibold">Tarefas de hoje</h2>

        <form
          className="mb-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!task.trim()) return;

            update((d) => ({
              ...d,
              tasks: [
                ...d.tasks,
                {
                  id: uid(),
                  title: task.trim(),
                  done: false,
                  date: t,
                },
              ],
            }));

            setTask("");
          }}
        >
          <input
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Nova tarefa..."
            className="h-11 min-w-0 flex-1 rounded-xl border bg-input/40 px-3 text-base outline-none focus:border-primary"
          />
          <Button
            type="submit"
            aria-label="Adicionar tarefa"
            className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </form>

        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa por enquanto.</p>
        )}

        <ul className="space-y-1">
          {tasks.map((x) => (
            <li key={x.id} className="flex items-center gap-3 py-1.5">
              <Button
                type="button"
                aria-label={`${x.done ? "Reabrir" : "Concluir"} tarefa ${x.title}`}
                onClick={() =>
                  update((d) => ({
                    ...d,
                    tasks: d.tasks.map((y) => (y.id === x.id ? { ...y, done: !y.done } : y)),
                  }))
                }
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${
                  x.done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground"
                }`}
              >
                {x.done && <Check className="h-4 w-4" />}
              </Button>

              <span
                className={`min-w-0 flex-1 break-words ${
                  x.done ? "text-muted-foreground line-through" : ""
                }`}
              >
                {x.title}
              </span>

              <Button
                type="button"
                aria-label={`Excluir tarefa ${x.title}`}
                onClick={() =>
                  update((d) => ({
                    ...d,
                    tasks: d.tasks.filter((y) => y.id !== x.id),
                  }))
                }
                className="text-muted-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="premium-card">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Flame className="h-4 w-4 text-warning" />
          Hábitos de hoje
        </h2>

        <form
          className="mb-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!habit.trim()) return;

            update((d) => ({
              ...d,
              habits: [...d.habits, { id: uid(), name: habit.trim(), doneDates: [] }],
            }));

            setHabit("");
          }}
        >
          <input
            value={habit}
            onChange={(e) => setHabit(e.target.value)}
            placeholder="Novo hábito (ex.: beber água)"
            className="h-11 min-w-0 flex-1 rounded-xl border bg-input/40 px-3 text-base outline-none focus:border-primary"
          />

          <Button
            type="submit"
            aria-label="Adicionar hábito"
            className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </form>

        {data.habits.length === 0 && (
          <p className="text-sm text-muted-foreground">Crie seu primeiro hábito.</p>
        )}

        <div className="space-y-2">
          {data.habits.map((h) => {
            const done = h.doneDates.includes(t);

            return (
              <Button
                type="button"
                key={h.id}
                aria-label={`Hábito ${h.name}`}
                aria-pressed={done}
                variant="ghost"
                onClick={() =>
                  update((d) => ({ ...d, habits: toggleHabitDate(d.habits, h.id, t) }))
                }
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (confirm(`Excluir o hábito "${h.name}"?`)) {
                    update((d) => ({
                      ...d,
                      habits: d.habits.filter((y) => y.id !== h.id),
                    }));
                  }
                }}
                className={`habit-check h-auto min-h-12 w-full justify-start gap-3 whitespace-normal rounded-xl border px-3 py-3 text-left text-sm ${
                  done
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-glass-border bg-background/20"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="check-mark text-primary" />
                ) : (
                  <Circle className="text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 break-words">{h.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {done ? "Feito" : "Hoje"}
                </span>
              </Button>
            );
          })}
        </div>
      </Card>
      <section id="metas" className="mt-5 scroll-mt-6">
        <Card className="premium-card">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Target className="h-5 w-5 text-primary" />
            Minhas metas financeiras
          </h2>

          {goals.length === 0 && !showGoalForm && (
            <p className="mb-3 text-sm text-muted-foreground">
              Transforme seus planos em metas e acompanhe quanto falta para alcançá-las.
            </p>
          )}

          {goals.map((goal) => {
            const percent =
              goal.targetAmount > 0
                ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
                : 0;

            const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

            return (
              <div key={goal.id} className="mb-3 rounded-xl border p-3">
                <div className="flex items-start gap-2">
                  <PiggyBank className="mt-1 h-5 w-5 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{goal.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Guardado: {brl(goal.currentAmount)} de {brl(goal.targetAmount)}
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {percent.toFixed(1)}% concluído · Faltam {brl(remaining)}
                    </p>
                    {goal.deadline && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Prazo: {fmtDate(goal.deadline)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {!showGoalForm ? (
            <button
              type="button"
              onClick={() => setShowGoalForm(true)}
              className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
            >
              <Plus className="mr-1 inline h-4 w-4" />
              Criar minha meta
            </button>
          ) : (
            <form className="space-y-3" onSubmit={saveGoal}>
              <input
                required
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                placeholder="Nome da meta (ex.: comprar um carro)"
                className="h-11 w-full rounded-xl border bg-input/40 px-3"
              />

              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                placeholder="Quanto quer juntar? (R$)"
                className="h-11 w-full rounded-xl border bg-input/40 px-3"
              />

              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={goalSaved}
                onChange={(e) => setGoalSaved(e.target.value)}
                placeholder="Quanto já guardou? (R$)"
                className="h-11 w-full rounded-xl border bg-input/40 px-3"
              />

              <label className="block text-sm text-muted-foreground">
                Prazo para alcançar a meta
              </label>

              <input
                type="date"
                value={goalDeadline}
                onChange={(e) => setGoalDeadline(e.target.value)}
                className="h-11 w-full rounded-xl border bg-input/40 px-3"
              />

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-primary px-3 py-3 font-semibold text-primary-foreground"
                >
                  Salvar meta
                </button>

                <button
                  type="button"
                  onClick={() => setShowGoalForm(false)}
                  className="rounded-xl border px-3 py-3"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </Card>
      </section>

      <section className="mt-5" aria-label="Próximos vencimentos">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Próximos vencimentos</h2>
          <Button asChild variant="link" className="h-auto p-0 text-[11px]">
            <Link to="/financas">
              Ver todos
              <ChevronRight />
            </Link>
          </Button>
        </div>
        {upcoming.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">Tudo em dia. Nenhuma conta pendente.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {upcoming.map((b) => (
              <Link
                key={b.id}
                to="/financas"
                className="premium-card min-w-0 p-4 transition-transform duration-200 hover:-translate-y-0.5"
              >
                <CalendarClock
                  className={`mb-3 h-5 w-5 ${b.dueDate <= t ? "text-destructive" : "text-warning"}`}
                />
                <p className="break-words text-xs text-muted-foreground">{b.description}</p>
                <p className="mt-1 break-words text-base font-semibold">{brl(b.amount)}</p>
                <p
                  className={`mt-3 text-[10px] ${b.dueDate <= t ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {b.dueDate < t
                    ? "Atrasada"
                    : b.dueDate === t
                      ? "Vence hoje"
                      : "Vence " + fmtDate(b.dueDate)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
