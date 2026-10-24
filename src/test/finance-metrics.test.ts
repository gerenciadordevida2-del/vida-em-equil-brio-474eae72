import { describe, expect, it } from "vitest";
import { monthlyFinance } from "@/lib/finance-metrics";
import { salesDashboard } from "@/lib/commerce";
import { emptyBusiness, type Sale } from "@/lib/business";
import type { Transaction } from "@/lib/store";

const entry = (type: Transaction["type"], amount: number, date = "2026-10-24"): Transaction => ({ id: `${type}-${date}`, type, amount, date, description: "Pessoal", category: "Outros" });
const sale = (extra: Partial<Sale> = {}): Sale => ({ id: "s1", customer: "Cliente", product: "Produto", quantity: 2, unitPrice: 50, unitCost: 20, discount: 0, date: "2026-10-24", paymentMethod: "Pix", payments: [{ date: "2026-10-24", amount: 30 }], ...extra });

describe("Panorama mensal da Home e Finanças", () => {
  it("soma receitas e despesas apenas do mês selecionado sem saldo anterior", () => {
    expect(monthlyFinance([entry("receita", 1000, "2026-10-01"), entry("despesa", 250, "2026-10-31"), entry("receita", 9000, "2026-09-30"), entry("despesa", 500, "2026-11-01")], "2026-10")).toEqual({ income: 1000, expenses: 250, balance: 750, count: 2 });
  });
  it("representa mês vazio sem inventar saldo inicial", () => {
    expect(monthlyFinance([], "2026-10")).toEqual({ income: 0, expenses: 0, balance: 0, count: 0 });
  });
  it("mantém saldo negativo quando despesas ultrapassam receitas", () => {
    expect(monthlyFinance([entry("receita", 100), entry("despesa", 150)], "2026-10").balance).toBe(-50);
  });
  it("não mistura vendas, gastos comerciais ou valores pendentes com finanças pessoais", () => {
    const personal = [entry("receita", 200), entry("despesa", 50)];
    const business = { ...emptyBusiness(), sales: [sale()] };
    expect(monthlyFinance(personal, "2026-10").balance).toBe(150);
    const dashboard = salesDashboard(business, "2026-10-24");
    expect([dashboard.todayRevenue, dashboard.monthRevenue, dashboard.todayCount, dashboard.monthCount, dashboard.monthReceived, dashboard.toReceive]).toEqual([100, 100, 1, 1, 30, 70]);
    expect(personal).toHaveLength(2);
  });
  it("identifica custos completos, ausentes e parciais para exibição de lucro", () => {
    const dashboard = (sales: Sale[]) => salesDashboard({ ...emptyBusiness(), sales }, "2026-10-24");
    expect(dashboard([sale()])).toMatchObject({ monthProfit: 60, profitPartial: false });
    expect(dashboard([sale({ unitCost: undefined })])).toMatchObject({ monthProfit: null, profitPartial: false });
    expect(dashboard([sale(), sale({ id: "s2", unitCost: undefined })])).toMatchObject({ monthProfit: 60, profitPartial: true });
  });
});