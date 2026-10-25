import { describe, expect, it } from "vitest";
import { billStatus, liabilitySummary } from "@/lib/bill-status";
import type { Bill, Debt } from "@/lib/store";

const bill = (o: Partial<Bill> = {}): Bill => ({
  id: "b1",
  description: "Internet",
  amount: 100,
  dueDate: "2026-10-20",
  paid: false,
  ...o,
});
const debt = (o: Partial<Debt> = {}): Debt => ({ id: "d1", name: "Cartão", total: 300, paid: 100, ...o });

describe("classificação de contas", () => {
  it("conta paga é sempre 'paga', mesmo vencida", () =>
    expect(billStatus(bill({ paid: true, dueDate: "2020-01-01" }), "2026-10-25")).toBe("paga"));
  it("não paga com vencimento anterior a hoje é 'vencida'", () =>
    expect(billStatus(bill({ dueDate: "2026-10-24" }), "2026-10-25")).toBe("vencida"));
  it("vencimento hoje ou no futuro é 'pendente'", () => {
    expect(billStatus(bill({ dueDate: "2026-10-25" }), "2026-10-25")).toBe("pendente");
    expect(billStatus(bill({ dueDate: "2026-11-01" }), "2026-10-25")).toBe("pendente");
  });
});

describe("passivo total", () => {
  it("soma contas pendentes, vencidas e saldo de dívidas sem duplicar", () => {
    const s = liabilitySummary(
      [bill({ amount: 100, dueDate: "2026-10-24" }), bill({ id: "b2", amount: 50, dueDate: "2026-10-30" }), bill({ id: "b3", amount: 999, paid: true })],
      [debt()],
      "2026-10-25",
    );
    expect(s.overdueBills).toBe(100);
    expect(s.pendingBills).toBe(50);
    expect(s.debtsRemaining).toBe(200);
    expect(s.total).toBe(350);
    expect(s.overdueList.map((b) => b.id)).toEqual(["b1"]);
  });
  it("não cria registros: a mesma conta aparece uma única vez", () => {
    const bills = [bill()];
    const s = liabilitySummary(bills, [], "2026-10-25");
    expect(s.overdueList).toHaveLength(1);
    expect(bills).toHaveLength(1);
  });
  it("dívida quitada não entra no passivo", () =>
    expect(liabilitySummary([], [debt({ paid: 300 })], "2026-10-25").total).toBe(0));
});
