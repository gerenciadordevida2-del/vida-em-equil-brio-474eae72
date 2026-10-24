import { describe, expect, it } from "vitest";
import { accountSummary, expenseComposition, goalProgress, monthlyBalance } from "@/lib/charts";
import type { AppData } from "@/lib/store";

const p = { start: "2026-10-01", end: "2026-10-31" };

describe("monthlyBalance", () => {
  it("computes income, salary split, expenses, net and committed pct in cents", () => {
    const b = monthlyBalance(
      [
        { id: "1", type: "receita", description: "Salário", amount: 3000.1, category: "Salário", date: "2026-10-05" },
        { id: "2", type: "receita", description: "Freela", amount: 500, category: "Outros", date: "2026-10-10" },
        { id: "3", type: "despesa", description: "Mercado", amount: 700.25, category: "Alimentação", date: "2026-10-12" },
        { id: "4", type: "despesa", description: "Fora do período", amount: 999, category: "Lazer", date: "2026-09-30" },
      ],
      p,
    );
    expect(b.income).toBe(3500.1);
    expect(b.salaryIncome).toBe(3000.1);
    expect(b.otherIncome).toBe(500);
    expect(b.expenses).toBe(700.25);
    expect(b.net).toBe(2799.85);
    expect(b.committedPct).toBeCloseTo(700.25 / 3500.1);
  });
  it("returns null committedPct when income is zero (no division by zero)", () => {
    const b = monthlyBalance(
      [{ id: "1", type: "despesa", description: "x", amount: 10, category: "Outros", date: "2026-10-01" }],
      p,
    );
    expect(b.committedPct).toBeNull();
    expect(b.net).toBe(-10);
  });
});

describe("goalProgress", () => {
  it("computes pct, remaining and clamps the bar at 100% without hiding surplus", () => {
    const [g] = goalProgress([
      { id: "a", name: "Reserva", targetAmount: 1000, currentAmount: 1250, createdAt: "2026-01-01" },
    ]);
    expect(g!.pct).toBe(1.25);
    expect(g!.barPct).toBe(1);
    expect(g!.remaining).toBe(0);
  });
  it("returns null pct for goals without a target", () => {
    const [g] = goalProgress([
      { id: "b", name: "Sem alvo", targetAmount: 0, currentAmount: 100, createdAt: "2026-01-01" },
    ]);
    expect(g!.pct).toBeNull();
    expect(g!.barPct).toBe(0);
  });
});

describe("expenseComposition", () => {
  it("sums by category with percentages and ignores income", () => {
    const slices = expenseComposition(
      [
        { id: "1", type: "despesa", description: "a", amount: 30, category: "Moradia", date: "2026-10-01" },
        { id: "2", type: "despesa", description: "b", amount: 70, category: "Moradia", date: "2026-10-02" },
        { id: "3", type: "despesa", description: "c", amount: 100, category: "Saúde", date: "2026-10-03" },
        { id: "4", type: "receita", description: "d", amount: 500, category: "Salário", date: "2026-10-03" },
      ],
      p,
    );
    expect(slices).toHaveLength(2);
    expect(slices[0]).toMatchObject({ name: "Moradia", value: 100, percent: 0.5 });
    expect(slices[1]).toMatchObject({ name: "Saúde", value: 100, percent: 0.5 });
  });
});

describe("accountSummary", () => {
  const data = {
    transactions: [
      { id: "1", type: "receita", description: "s", amount: 1000, category: "Salário", date: "2026-10-01" },
      { id: "2", type: "despesa", description: "x", amount: 200, category: "Outros", date: "2026-10-02" },
      { id: "3", type: "despesa", description: "old", amount: 50, category: "Outros", date: "2026-08-01" },
    ],
    debts: [{ id: "d1", name: "Cartão", total: 500, paid: 120 }],
  } as unknown as AppData;
  it("computes all-time balance, open debts and period expenses separately", () => {
    const s = accountSummary(data, p);
    expect(s.balance).toBe(750);
    expect(s.debtsOpen).toBe(380);
    expect(s.periodExpenses).toBe(200);
  });
});
