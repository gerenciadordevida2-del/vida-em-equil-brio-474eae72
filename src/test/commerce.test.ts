import { describe, expect, it } from "vitest";
import { emptyBusiness, type BusinessData, type Sale, businessMetrics, monthPeriod } from "@/lib/business";
import {
  changeSaleStatus, customerSummary, deleteSale, saveSale, salesDashboard, upsertCustomer, upsertProduct, whatsappLink,
} from "@/lib/commerce";

const base = (): BusinessData => {
  let b = emptyBusiness();
  b = upsertProduct(b, { id: "p1", name: "Cone", price: 10, cost: 4, quantity: 5, minStock: 1, createdAt: "2026-10-01" });
  b = upsertCustomer(b, { id: "c1", name: "Ana Souza", phone: "(11) 98888-7777", createdAt: "2026-10-01" });
  return b;
};
const sale = (o: Partial<Sale> = {}): Sale => ({
  id: "s1", customer: "Ana Souza", customerId: "c1", product: "Cone", productId: "p1",
  quantity: 2, unitPrice: 10, unitCost: 4, discount: 0, date: "2026-10-20", paymentMethod: "Pix", payments: [], ...o,
});

describe("estoque", () => {
  it("venda baixa estoque", () => expect(saveSale(base(), sale(), "2026-10-20").products![0]!.quantity).toBe(3));
  it("edição ajusta só a diferença", () => {
    const b = saveSale(saveSale(base(), sale(), "d"), sale({ quantity: 4 }), "d");
    expect(b.products![0]!.quantity).toBe(1);
  });
  it("impede estoque negativo", () => expect(() => saveSale(base(), sale({ quantity: 6 }), "d")).toThrow(/insuficiente/));
  it("cancelamento devolve uma única vez", () => {
    const b = changeSaleStatus(saveSale(base(), sale(), "d"), "s1", "cancelada", "d");
    expect(b.products![0]!.quantity).toBe(5);
    expect(() => changeSaleStatus(b, "s1", "devolvida", "d")).toThrow();
  });
  it("excluir venda devolve estoque", () => expect(deleteSale(saveSale(base(), sale(), "d"), "s1", "d").products![0]!.quantity).toBe(5));
  it("cancelada sai dos totais", () => {
    const b = changeSaleStatus(saveSale(base(), sale(), "d"), "s1", "cancelada", "d");
    expect(businessMetrics(b, monthPeriod("2026-10")).totalSales).toBe(0);
  });
});

describe("clientes", () => {
  it("bloqueia telefone duplicado", () =>
    expect(() => upsertCustomer(base(), { id: "c2", name: "Outra", phone: "11988887777", createdAt: "x" })).toThrow(/Já existe/));
  it("histórico com pagamento parcial", () => {
    const b = saveSale(base(), sale({ payments: [{ date: "2026-10-20", amount: 5 }] }), "d");
    const s = customerSummary(b, "c1");
    expect([s.total, s.paid, s.pending]).toEqual([20, 5, 15]);
  });
});

describe("painel", () => {
  it("faturamento, ticket e lucro", () => {
    const b = saveSale(saveSale(base(), sale(), "d"), sale({ id: "s2", quantity: 1, date: "2026-10-21" }), "d");
    const d = salesDashboard(b, "2026-10-21");
    expect([d.todayRevenue, d.monthRevenue, d.monthCount, d.ticket, d.monthProfit, d.toReceive]).toEqual([10, 30, 2, 15, 18, 30]);
  });
  it("link do WhatsApp com DDI", () => expect(whatsappLink("(11) 98888-7777", "oi")).toBe("https://wa.me/5511988887777?text=oi"));
});
