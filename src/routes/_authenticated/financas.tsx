import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Check, Target, PiggyBank, TrendingUp, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money, roundMoney } from "@/lib/data-validation";
import { recordDebtPayment } from "@/lib/debt-payment";
import type { FinanceGoal } from "@/lib/store";
import { Page, Card } from "@/components/AppShell";
import { BusinessTab } from "@/components/BusinessTab";
import { ChartsTab } from "@/components/ChartsTab";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useData, update, uid, today, brl, fmtDate } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/financas")({
  head: () => ({
    meta: [
      { title: "Finanças — Gerenciador de Vida" },
      {
        name: "description",
        content: "Controle receitas, despesas, contas, dívidas e metas financeiras.",
      },
      { property: "og:title", content: "Finanças — Gerenciador de Vida" },
      { property: "og:description", content: "Controle suas finanças e acompanhe suas metas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Financas,
});

type Tab = "lancamentos" | "contas" | "dividas" | "metas" | "negocio" | "graficos";
const CATS = [
  "Alimentação",
  "Moradia",
  "Transporte",
  "Saúde",
  "Lazer",
  "Educação",
  "Salário",
  "Outros",
];
const field =
  "h-12 w-full rounded-xl border bg-input/40 px-3 text-base outline-none focus:border-primary";

export function Financas({
  initialTab = "lancamentos",
  goalsPage = false,
}: {
  initialTab?: Tab;
  goalsPage?: boolean;
}) {
  const data = useData();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [open, setOpen] = useState(false);
  const month = today().slice(0, 7);
  const [filterMonth, setFilterMonth] = useState(month);

  const tx = data.transactions
    .filter((x) => x.date.startsWith(filterMonth))
    .sort((a, b) => b.date.localeCompare(a.date));
  const inc = tx.filter((x) => x.type === "receita").reduce((s, x) => s + x.amount, 0);
  const exp = tx.filter((x) => x.type === "despesa").reduce((s, x) => s + x.amount, 0);
  const byCat = Object.entries(
    tx
      .filter((x) => x.type === "despesa")
      .reduce<Record<string, number>>(
        (acc, x) => ((acc[x.category] = (acc[x.category] || 0) + x.amount), acc),
        {},
      ),
  ).sort((a, b) => b[1] - a[1]);

  const tabs: [Tab, string][] = [
    ["lancamentos", "Lançamentos"],
    ["contas", "Contas"],
    ["dividas", "Dívidas"],
    ["metas", "Metas"],
    ["negocio", "Negócio"],
    ["graficos", "Gráficos"],
  ];

  return (
    <Page
      title={goalsPage ? "Metas" : "Finanças"}
      subtitle="Seu dinheiro sob controle"
      action={
        tab === "negocio" || tab === "graficos" ? undefined : tab !== "metas" ? (
          <button
            onClick={() => setOpen(true)}
            className="shadow-glow flex h-11 items-center gap-1 rounded-xl bg-primary px-4 font-semibold text-primary-foreground"
          >
            <Plus className="h-5 w-5" /> Novo
          </button>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="shadow-glow flex h-11 items-center gap-1 rounded-xl bg-primary px-4 font-semibold text-primary-foreground"
          >
            <Plus className="h-5 w-5" /> Meta
          </button>
        )
      }
    >
      {!goalsPage && (
        <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1 sm:grid-cols-6">
          {tabs.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-lg py-2 text-sm font-semibold ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {tab === "lancamentos" && (
        <>
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value || month)}
            className={`${field} mb-3`}
          />
          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Receitas</p>
              <p className="text-sm font-semibold text-success">{brl(inc)}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Despesas</p>
              <p className="text-sm font-semibold text-destructive">{brl(exp)}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className="text-sm font-semibold">{brl(inc - exp)}</p>
            </Card>
          </div>
          {byCat.length > 0 && (
            <Card className="mb-4">
              <h2 className="mb-3 font-semibold">Gastos por categoria</h2>
              <div className="space-y-2">
                {byCat.map(([c, v]) => (
                  <div key={c}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{c}</span>
                      <span className="text-muted-foreground">{brl(v)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${exp ? (v / exp) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card>
            {tx.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum lançamento neste mês. Toque em “Novo”.
              </p>
            )}
            <ul className="divide-y">
              {tx.map((x) => (
                <li key={x.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1">
                    <p className="font-medium">{x.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {x.category} · {fmtDate(x.date)}
                    </p>
                  </div>
                  <span
                    className={`font-semibold ${x.type === "receita" ? "text-success" : "text-destructive"}`}
                  >
                    {x.type === "receita" ? "+" : "−"}
                    {brl(x.amount)}
                  </span>
                  <Del
                    onClick={() =>
                      update((d) => ({
                        ...d,
                        transactions: d.transactions.filter((y) => y.id !== x.id),
                      }))
                    }
                  />
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {tab === "contas" && (
        <Card>
          {data.bills.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
          )}
          <ul className="divide-y">
            {[...data.bills]
              .sort((a, b) => Number(a.paid) - Number(b.paid) || a.dueDate.localeCompare(b.dueDate))
              .map((b) => {
                const late = !b.paid && b.dueDate < today();
                return (
                  <li key={b.id} className="flex items-center gap-3 py-3">
                    <button
                      aria-label="Marcar como paga"
                      onClick={() =>
                        update((d) => {
                          const paying = !b.paid;
                          return {
                            ...d,
                            bills: d.bills.map((y) => (y.id === b.id ? { ...y, paid: paying } : y)),
                            transactions: paying
                              ? [
                                  ...d.transactions,
                                  {
                                    id: "bill-" + b.id,
                                    type: "despesa",
                                    description: b.description,
                                    amount: b.amount,
                                    category: "Contas",
                                    date: today(),
                                  },
                                ]
                              : d.transactions.filter((t) => t.id !== "bill-" + b.id),
                          };
                        })
                      }
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${b.paid ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}
                    >
                      {b.paid && <Check className="h-4 w-4" />}
                    </button>
                    <div className="flex-1">
                      <p
                        className={`font-medium ${b.paid ? "text-muted-foreground line-through" : ""}`}
                      >
                        {b.description}
                      </p>
                      <p
                        className={`text-xs ${late ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {late ? "Atrasada · " : "Vence "}
                        {fmtDate(b.dueDate)}
                      </p>
                    </div>
                    <span className="font-semibold">{brl(b.amount)}</span>
                    <Del
                      onClick={() =>
                        update((d) => ({ ...d, bills: d.bills.filter((y) => y.id !== b.id) }))
                      }
                    />
                  </li>
                );
              })}
          </ul>
          {data.bills.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Ao marcar como paga, a despesa é lançada automaticamente.
            </p>
          )}
        </Card>
      )}

      {tab === "dividas" && (
        <div className="space-y-3">
          {data.debts.length === 0 && (
            <Card>
              <p className="text-sm text-muted-foreground">Nenhuma dívida cadastrada. Ótimo! 🎉</p>
            </Card>
          )}
          {data.debts.map((d) => (
            <DebtCard key={d.id} debt={d} />
          ))}
        </div>
      )}

      {tab === "metas" && <FinanceGoals />}
      {tab === "negocio" && <BusinessTab />}
      {tab === "graficos" && <ChartsTab />}

      <NewDialog
        open={open && tab !== "metas" && tab !== "negocio"}
        onOpenChange={setOpen}
        tab={tab === "contas" || tab === "dividas" ? tab : "lancamentos"}
      />
      <FinanceGoalDialog open={open && tab === "metas"} onOpenChange={setOpen} />
    </Page>
  );
}

function FinanceGoals() {
  const data = useData();
  const [editing, setEditing] = useState<FinanceGoal | null>(null);

  if (data.financeGoals.length === 0) {
    return (
      <Card className="py-8 text-center">
        <Target className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h2 className="mb-2 font-semibold">Sua primeira meta começa aqui</h2>
        <p className="text-sm text-muted-foreground">
          Toque em “Meta” para definir quanto deseja guardar.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {editing && (
        <FinanceGoalDialog
          key={editing.id}
          open
          onOpenChange={(value) => {
            if (!value) setEditing(null);
          }}
          goal={editing}
        />
      )}
      {data.financeGoals.map((goal) => {
        const pct =
          goal.targetAmount > 0
            ? Math.min(100, Math.max(0, (goal.currentAmount / goal.targetAmount) * 100))
            : 0;

        return (
          <Card key={goal.id}>
            <div className="mb-3 flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary">
                <PiggyBank className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="break-words font-semibold">{goal.name}</h2>
                {goal.deadline && (
                  <p className="text-xs text-muted-foreground">Prazo: {fmtDate(goal.deadline)}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Editar meta ${goal.name}`}
                onClick={() => setEditing(goal)}
              >
                <Pencil />
              </Button>
              <Del
                onClick={() =>
                  update((d) => ({
                    ...d,
                    financeGoals: d.financeGoals.filter((g) => g.id !== goal.id),
                  }))
                }
              />
            </div>

            <div className="mb-2 flex items-end justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Você já guardou</p>
                <p className="text-lg font-bold">{brl(goal.currentAmount)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Objetivo</p>
                <p className="font-semibold">{brl(goal.targetAmount)}</p>
              </div>
            </div>

            <div className="mb-2 h-3 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>{pct.toFixed(0)}% concluído</span>
              <span>Faltam {brl(Math.max(0, goal.targetAmount - goal.currentAmount))}</span>
            </div>

            {goal.notes && <p className="mb-3 text-sm text-muted-foreground">{goal.notes}</p>}

            <div className="flex gap-2">
              <button
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground"
                onClick={() => {
                  const value = prompt("Quanto você guardou? Digite o valor em reais:");
                  if (value === null) return;
                  const amount = money(value);
                  if (!Number.isFinite(amount) || amount <= 0) {
                    alert("Digite um valor válido maior que zero.");
                    return;
                  }
                  update((d) => ({
                    ...d,
                    financeGoals: d.financeGoals.map((g) =>
                      g.id === goal.id
                        ? { ...g, currentAmount: roundMoney(g.currentAmount + amount) }
                        : g,
                    ),
                  }));
                }}
              >
                <Plus className="h-4 w-4" /> Guardar valor
              </button>
              <button
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border"
                aria-label="Corrigir valor guardado"
                onClick={() => {
                  const value = prompt(
                    "Qual é o valor total que você já guardou?",
                    String(goal.currentAmount).replace(".", ","),
                  );
                  if (value === null) return;
                  const amount = money(value);
                  if (!Number.isFinite(amount) || amount < 0) {
                    alert("Digite um valor válido igual ou maior que zero.");
                    return;
                  }
                  update((d) => ({
                    ...d,
                    financeGoals: d.financeGoals.map((g) =>
                      g.id === goal.id ? { ...g, currentAmount: amount } : g,
                    ),
                  }));
                }}
              >
                <TrendingUp className="h-4 w-4" />
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function FinanceGoalDialog({
  open,
  onOpenChange,
  goal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: FinanceGoal;
}) {
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? String(goal.targetAmount) : "");
  const [current, setCurrent] = useState(goal ? String(goal.currentAmount) : "0");
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [notes, setNotes] = useState(goal?.notes ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const targetAmount = money(target);
    const currentAmount = money(current);

    if (
      !name.trim() ||
      !Number.isFinite(targetAmount) ||
      targetAmount <= 0 ||
      !Number.isFinite(currentAmount) ||
      currentAmount < 0
    ) {
      alert("Preencha o nome e os valores corretamente.");
      return;
    }

    update((d) => ({
      ...d,
      financeGoals: goal
        ? d.financeGoals.map((g) =>
            g.id === goal.id
              ? {
                  ...g,
                  name: name.trim(),
                  targetAmount: roundMoney(targetAmount),
                  currentAmount: roundMoney(currentAmount),
                  deadline: deadline || undefined,
                  notes: notes.trim() || undefined,
                }
              : g,
          )
        : [
            ...d.financeGoals,
            {
              id: uid(),
              name: name.trim(),
              targetAmount,
              currentAmount,
              deadline: deadline || undefined,
              createdAt: today(),
              notes: notes.trim() || undefined,
            },
          ],
    }));

    setName("");
    setTarget("");
    setCurrent("0");
    setDeadline("");
    setNotes("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{goal ? "Editar meta financeira" : "Nova meta financeira"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm">
            Nome da meta
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Juntar R$ 40.000"
              className={`${field} mt-1`}
            />
          </label>
          <label className="block text-sm">
            Quanto deseja juntar? (R$)
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="40000"
              className={`${field} mt-1`}
            />
          </label>
          <label className="block text-sm">
            Quanto já tem guardado? (R$)
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={`${field} mt-1`}
            />
          </label>
          <label className="block text-sm">
            Prazo (opcional)
            <input
              type="date"
              min={today()}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={`${field} mt-1`}
            />
          </label>
          <label className="block text-sm">
            Observações (opcional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Por que essa meta é importante?"
              className={`${field} mt-1 h-20 py-3`}
            />
          </label>
          <button
            type="submit"
            className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground"
          >
            Salvar meta
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Del({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Excluir"
      onClick={() => confirm("Excluir este item?") && onClick()}
      className="text-muted-foreground"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function DebtCard({ debt }: { debt: { id: string; name: string; total: number; paid: number } }) {
  const [v, setV] = useState("");
  const pct = debt.total > 0 ? Math.min(100, (debt.paid / debt.total) * 100) : 0;

  return (
    <Card>
      <div className="mb-2 flex items-start justify-between">
        <div>
          <p className="font-semibold">{debt.name}</p>
          <p className="text-xs text-muted-foreground">
            Pago {brl(debt.paid)} de {brl(debt.total)}
          </p>
        </div>
        <Del
          onClick={() => update((d) => ({ ...d, debts: d.debts.filter((y) => y.id !== debt.id) }))}
        />
      </div>
      <div className="mb-1 h-2 rounded-full bg-secondary">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Restam {brl(Math.max(0, debt.total - debt.paid))} · {pct.toFixed(0)}%
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = parseFloat(v.replace(",", "."));
          if (!Number.isFinite(n) || n <= 0) return;
          if (n > roundMoney(debt.total - debt.paid)) {
            alert("O pagamento não pode superar o saldo restante da dívida.");
            return;
          }
          try {
            update((d) => recordDebtPayment(d, debt.id, n, { id: uid(), date: today() }));
          } catch (error) {
            alert(error instanceof Error ? error.message : "Não foi possível salvar o pagamento.");
            return;
          }
          setV("");
        }}
      >
        <input
          inputMode="decimal"
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="Registrar pagamento (R$)"
          className={`${field} h-11`}
        />
        <button className="h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground">
          Pagar
        </button>
      </form>
    </Card>
  );
}

function NewDialog({
  open,
  onOpenChange,
  tab,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tab: Tab;
}) {
  const [kind, setKind] = useState<"receita" | "despesa" | "conta" | "divida">("despesa");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState<string>("Alimentação");
  const [date, setDate] = useState(today());

  const current = tab === "contas" ? "conta" : tab === "dividas" ? "divida" : kind;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseFloat(amount.replace(",", "."));
    if (!desc.trim() || !Number.isFinite(n) || n <= 0) return;

    update((d) => {
      if (current === "conta")
        return {
          ...d,
          bills: [
            ...d.bills,
            { id: uid(), description: desc.trim(), amount: n, dueDate: date, paid: false },
          ],
        };
      if (current === "divida")
        return { ...d, debts: [...d.debts, { id: uid(), name: desc.trim(), total: n, paid: 0 }] };
      return {
        ...d,
        transactions: [
          ...d.transactions,
          { id: uid(), type: current, description: desc.trim(), amount: n, category: cat, date },
        ],
      };
    });

    setDesc("");
    setAmount("");
    setDate(today());
    onOpenChange(false);
  }

  const titles = {
    receita: "Nova receita",
    despesa: "Nova despesa",
    conta: "Nova conta a pagar",
    divida: "Nova dívida",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titles[current]}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {tab === "lancamentos" && (
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
              {(["despesa", "receita"] as const).map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setKind(k)}
                  className={`rounded-lg py-2 text-sm font-semibold capitalize ${current === k ? (k === "receita" ? "bg-success text-primary-foreground" : "bg-destructive text-destructive-foreground") : "text-muted-foreground"}`}
                >
                  {k}
                </button>
              ))}
            </div>
          )}
          <input
            required
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={current === "divida" ? "Nome (ex.: Cartão, empréstimo)" : "Descrição"}
            className={field}
          />
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={current === "divida" ? "Valor total (R$)" : "Valor (R$)"}
            className={field}
          />
          {(current === "receita" || current === "despesa") && (
            <select value={cat} onChange={(e) => setCat(e.target.value)} className={field}>
              {CATS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
          {current !== "divida" && (
            <label className="block text-sm text-muted-foreground">
              {current === "conta" ? "Vencimento" : "Data"}
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`${field} mt-1`}
              />
            </label>
          )}
          <button
            type="submit"
            className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground"
          >
            Salvar
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
