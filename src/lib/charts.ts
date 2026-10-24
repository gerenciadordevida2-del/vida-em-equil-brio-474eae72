// Pure calculations for the Gráficos tab. Money is summed in integer cents,
// same convention as src/lib/business.ts. All functions read the existing
// stored records; nothing is duplicated or inferred.

import type { AppData, FinanceGoal, Transaction } from "@/lib/store";
import type { Period } from "@/lib/business";

const c = (v: number) => Math.round(v * 100);
const r = (cents: number) => cents / 100;
const inP = (d: string | undefined, p: Period) => !!d && d >= p.start && d <= p.end;

export type MonthlyBalance = {
  income: number; // receitas efetivamente lançadas no período
  salaryIncome: number; // receitas da categoria "Salário"
  otherIncome: number; // demais receitas
  expenses: number; // despesas contabilizadas no período
  net: number; // income - expenses
  committedPct: number | null; // despesas ÷ entradas × 100; null quando renda = 0
};

export function monthlyBalance(transactions: Transaction[], p: Period): MonthlyBalance {
  const tx = transactions.filter((t) => inP(t.date, p));
  const incomeC = tx.filter((t) => t.type === "receita").reduce((s, t) => s + c(t.amount), 0);
  const salaryC = tx
    .filter((t) => t.type === "receita" && t.category === "Salário")
    .reduce((s, t) => s + c(t.amount), 0);
  const expensesC = tx.filter((t) => t.type === "despesa").reduce((s, t) => s + c(t.amount), 0);
  return {
    income: r(incomeC),
    salaryIncome: r(salaryC),
    otherIncome: r(incomeC - salaryC),
    expenses: r(expensesC),
    net: r(incomeC - expensesC),
    committedPct: incomeC > 0 ? expensesC / incomeC : null,
  };
}

export type GoalProgress = {
  id: string;
  name: string;
  current: number;
  target: number;
  remaining: number; // pode ser negativo quando a meta foi superada
  pct: number | null; // null quando a meta não tem valor-alvo
  barPct: number; // pct limitado a 0–100 só para a barra visual
};

export function goalProgress(goals: FinanceGoal[]): GoalProgress[] {
  return goals.map((g) => {
    const target = Number.isFinite(g.targetAmount) ? g.targetAmount : 0;
    const current = Number.isFinite(g.currentAmount) ? g.currentAmount : 0;
    const pct = target > 0 ? current / target : null;
    return {
      id: g.id,
      name: g.name,
      current,
      target,
      remaining: r(Math.max(0, c(target) - c(current))),
      pct,
      barPct: pct === null ? 0 : Math.min(1, Math.max(0, pct)),
    };
  });
}

export type CategorySlice = { name: string; value: number; percent: number };

/** Distribuição das despesas pessoais por categoria no período. */
export function expenseComposition(transactions: Transaction[], p: Period): CategorySlice[] {
  const map = new Map<string, number>();
  for (const t of transactions.filter((x) => x.type === "despesa" && inP(x.date, p)))
    map.set(t.category, (map.get(t.category) ?? 0) + c(t.amount));
  const total = [...map.values()].reduce((s, x) => s + x, 0);
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, v]) => ({ name, value: r(v), percent: total ? v / total : 0 }));
}

export type AccountSummary = {
  balance: number; // saldo acumulado: todas as receitas − todas as despesas
  debtsOpen: number; // total de dívidas menos o que já foi pago
  periodExpenses: number; // despesas do período selecionado
};

export function accountSummary(data: AppData, p: Period): AccountSummary {
  const balanceC = data.transactions.reduce(
    (s, t) => s + (t.type === "receita" ? c(t.amount) : -c(t.amount)),
    0,
  );
  const debtsC = data.debts.reduce((s, d) => s + Math.max(0, c(d.total) - c(d.paid)), 0);
  const expC = data.transactions
    .filter((t) => t.type === "despesa" && inP(t.date, p))
    .reduce((s, t) => s + c(t.amount), 0);
  return { balance: r(balanceC), debtsOpen: r(debtsC), periodExpenses: r(expC) };
}
