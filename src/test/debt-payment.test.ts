import { describe, expect, it } from "vitest";
import { recordDebtPayment } from "@/lib/debt-payment";
import type { AppData } from "@/lib/store";

const data: AppData = {
  version: 1,
  transactions: [],
  bills: [],
  debts: [{ id: "debt", name: "Dívida", total: 300, paid: 0 }],
  tasks: [],
  habits: [],
  plans: [],
  workoutLogs: [],
  workoutGoal: 3,
  financeGoals: [],
  healthGoals: [],
  business: { sales: [], expenses: [], scheduled: [] },
};
const transaction = { id: "payment", date: "2026-10-19" };

describe("Debt payments against current data", () => {
  it("records one expense and the same debt payment", () => {
    const next = recordDebtPayment(data, "debt", 100, transaction);
    expect(next.debts[0]?.paid).toBe(100);
    expect(next.transactions).toHaveLength(1);
    expect(next.transactions[0]?.amount).toBe(100);
    expect(data.debts[0]?.paid).toBe(0);
  });
  it("rejects a payment exceeding the updated remaining balance without changing data", () => {
    const current = recordDebtPayment(data, "debt", 250, transaction);
    const before = JSON.stringify(current);
    expect(() => recordDebtPayment(current, "debt", 100, transaction)).toThrow("saldo restante");
    expect(JSON.stringify(current)).toBe(before);
    expect(current.transactions).toHaveLength(1);
  });
  it("does not create an expense for a missing debt", () => {
    expect(() => recordDebtPayment(data, "missing", 100, transaction)).toThrow("não existe");
    expect(data.transactions).toHaveLength(0);
  });
  it("rejects nonpositive and nonfinite payments", () => {
    for (const amount of [0, -1, NaN, Infinity]) {
      expect(() => recordDebtPayment(data, "debt", amount, transaction)).toThrow("válido");
    }
  });
});
