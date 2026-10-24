import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppData } from "@/lib/store";

const empty: AppData = {
  version: 1,
  transactions: [],
  bills: [],
  debts: [],
  tasks: [],
  habits: [],
  plans: [],
  workoutLogs: [],
  workoutGoal: 3,
  financeGoals: [],
  healthGoals: [],
  business: { sales: [], expenses: [], scheduled: [] },
};
beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

describe("AI actions require browser confirmation", () => {
  it("does not persist a proposal until apply is called", async () => {
    const { prepareAction } = await import("@/lib/ai-actions");
    const action = prepareAction(
      "add_transaction",
      {
        type: "despesa",
        description: "Mercado",
        amount: 45,
        date: "2026-10-19",
        category: "Alimentação",
      },
      empty,
    );
    expect(localStorage.getItem("gerenciador-de-vida:v1")).toBeNull();
    action.apply();
    const stored = JSON.parse(localStorage.getItem("gerenciador-de-vida:v1") ?? "{}");
    expect(stored.transactions[0].amount).toBe(45);
    expect(stored.transactions[0].type).toBe("despesa");
  });
  it("registers a business sale as pending and pays it partially without exceeding the balance", async () => {
    const { prepareAction } = await import("@/lib/ai-actions");
    const sale = prepareAction(
      "add_business_sale",
      {
        customer: "Ana",
        product: "Bolo",
        quantity: 3,
        unitPrice: 19.9,
        discount: 0.7,
        unitCost: 8,
        date: "2026-10-21",
        paymentMethod: "Pix",
        expectedDate: "2026-10-25",
        notes: null,
      },
      empty,
    );
    expect(localStorage.getItem("gerenciador-de-vida:v1")).toBeNull();
    sale.apply();
    let stored = JSON.parse(localStorage.getItem("gerenciador-de-vida:v1") ?? "{}");
    expect(stored.business.sales).toHaveLength(1);
    const saved = stored.business.sales[0];
    expect(saved.customer).toBe("Ana");
    expect(saved.payments).toEqual([]);

    const data = { ...empty, business: stored.business };
    const pay = prepareAction(
      "register_sale_payment",
      { saleId: saved.id, amount: 20, date: "2026-10-21" },
      data,
    );
    pay.apply();
    stored = JSON.parse(localStorage.getItem("gerenciador-de-vida:v1") ?? "{}");
    expect(stored.business.sales[0].payments).toEqual([{ date: "2026-10-21", amount: 20 }]);
    // 59.00 total − 20 received = 39 open; overpaying must be refused.
    expect(() =>
      prepareAction(
        "register_sale_payment",
        { saleId: saved.id, amount: 39.01, date: "2026-10-21" },
        { ...empty, business: stored.business },
      ),
    ).toThrow("saldo restante");
    expect(() =>
      prepareAction("register_sale_payment", { saleId: "nope", amount: 1, date: null }, empty),
    ).toThrow("Venda não encontrada");
  });
  it("schedules a business payment without touching cash and rejects bad kinds", async () => {
    const { prepareAction } = await import("@/lib/ai-actions");
    const sched = prepareAction(
      "add_scheduled_payment",
      { kind: "pagar", party: "Fornecedor", item: "Embalagens", amount: 120, dueDate: "2026-10-28", notes: null },
      empty,
    );
    sched.apply();
    const stored = JSON.parse(localStorage.getItem("gerenciador-de-vida:v1") ?? "{}");
    expect(stored.business.scheduled[0]).toMatchObject({ kind: "pagar", amount: 120, payments: [] });
    expect(() =>
      prepareAction(
        "add_scheduled_payment",
        { kind: "talvez", party: "x", item: "y", amount: 1, dueDate: "2026-10-28", notes: null },
        empty,
      ),
    ).toThrow("Tipo inválido");
  });
  it("keeps business expenses separate from personal transactions", async () => {
    const { prepareAction } = await import("@/lib/ai-actions");
    prepareAction(
      "add_business_expense",
      { description: "Frete", category: "Transporte e entregas", amount: 35, date: "2026-10-21", paid: true, dueDate: null, notes: null },
      empty,
    ).apply();
    const stored = JSON.parse(localStorage.getItem("gerenciador-de-vida:v1") ?? "{}");
    expect(stored.business.expenses).toHaveLength(1);
    expect(stored.transactions).toHaveLength(0);
  });
  it("rejects impossible dates and invalid times", async () => {
    const { prepareAction } = await import("@/lib/ai-actions");
    expect(() =>
      prepareAction("add_task", { title: "Teste", date: "2026-02-30", time: null }, empty),
    ).toThrow("Data inválida");
    expect(() =>
      prepareAction("add_task", { title: "Teste", date: "2026-10-19", time: "29:90" }, empty),
    ).toThrow("Horário inválido");
  });
});
