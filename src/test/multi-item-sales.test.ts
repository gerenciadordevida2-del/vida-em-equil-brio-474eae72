import { describe, expect, it } from "vitest";
import {
  businessMetrics,
  customerOpenBalance,
  emptyBusiness,
  payCustomer,
  saleTotal,
  withItems,
  type BusinessData,
  type Sale,
} from "@/lib/business";
import { customerSummary, saveSale, topProducts, upsertProduct } from "@/lib/commerce";

const base = (id: string, date: string, extra: Partial<Sale> = {}) => ({
  id, customer: "João", customerId: "c1", discount: 0, date, paymentMethod: "Pix", payments: [], ...extra,
});

function withCustomer(): BusinessData {
  return { ...emptyBusiness(), customers: [{ id: "c1", name: "João", createdAt: "2026-10-01" }] };
}

describe("venda com vários produtos", () => {
  it("soma subtotais: 1 cone R$8 + 2 alfajores R$5 = R$18", () => {
    const s = withItems(base("s1", "2026-10-01"), [
      { product: "Cone Prestígio", quantity: 1, unitPrice: 8 },
      { product: "Alfajor Brigadeiro", quantity: 2, unitPrice: 5 },
    ]);
    expect(saleTotal(s)).toBe(18);
    expect(s.items).toHaveLength(2);
    expect(s.quantity).toBe(3);
  });

  it("recusa quantidade inválida", () => {
    expect(() => withItems(base("s1", "2026-10-01"), [{ product: "Cone", quantity: 0, unitPrice: 8 }])).toThrow();
    expect(() => withItems(base("s1", "2026-10-01"), [{ product: "Cone", quantity: 1, unitPrice: -1 }])).toThrow();
  });

  it("editar o preço do produto não muda vendas antigas", () => {
    let b = upsertProduct(withCustomer(), { id: "p1", name: "Cone", price: 8, quantity: 10, minStock: 0, createdAt: "2026-10-01" });
    b = saveSale(b, withItems(base("s1", "2026-10-01"), [{ productId: "p1", product: "Cone", quantity: 2, unitPrice: 8 }]), "2026-10-01");
    b = upsertProduct(b, { ...b.products![0]!, price: 12 });
    expect(saleTotal(b.sales[0]!)).toBe(16);
    expect(b.products![0]!.quantity).toBe(8); // estoque baixado uma vez
  });

  it("baixa estoque de cada produto da venda", () => {
    let b = upsertProduct(withCustomer(), { id: "p1", name: "Cone", price: 8, quantity: 10, minStock: 0, createdAt: "2026-10-01" });
    b = upsertProduct(b, { id: "p2", name: "Alfajor", price: 5, quantity: 10, minStock: 0, createdAt: "2026-10-01" });
    const s = withItems(base("s1", "2026-10-01"), [
      { productId: "p1", product: "Cone", quantity: 1, unitPrice: 8 },
      { productId: "p2", product: "Alfajor", quantity: 2, unitPrice: 5 },
    ]);
    b = saveSale(b, s, "2026-10-01");
    b = saveSale(b, s, "2026-10-01"); // reenvio da mesma venda não duplica
    expect(b.sales).toHaveLength(1);
    expect(b.products!.map((p) => p.quantity)).toEqual([9, 8]);
    expect(topProducts(b, "2026-10").reduce((a, p) => a + p.revenue, 0)).toBe(18);
  });
});

describe("saldo consolidado do cliente", () => {
  it("acumula, abate parcial, quita e reabre só com compra nova (18+12−10+5 = 25)", () => {
    let b = withCustomer();
    b = saveSale(b, withItems(base("s1", "2026-10-01"), [{ product: "A", quantity: 1, unitPrice: 18 }]), "2026-10-01");
    b = saveSale(b, withItems(base("s2", "2026-10-02"), [{ product: "B", quantity: 1, unitPrice: 12 }]), "2026-10-02");
    expect(customerOpenBalance(b, "c1")).toBe(30);
    b = payCustomer(b, "c1", 10, "2026-10-03", "pay1");
    expect(customerOpenBalance(b, "c1")).toBe(20);
    b = payCustomer(b, "c1", 10, "2026-10-03", "pay1"); // mesmo pagamento repetido é ignorado
    expect(customerOpenBalance(b, "c1")).toBe(20);
    b = saveSale(b, withItems(base("s3", "2026-10-04"), [{ product: "C", quantity: 1, unitPrice: 5 }]), "2026-10-04");
    expect(customerOpenBalance(b, "c1")).toBe(25);
    expect(b.customers).toHaveLength(1);
    expect(customerSummary(b, "c1").sales).toHaveLength(3);
  });

  it("quitação total zera o saldo e nova compra começa novo saldo", () => {
    let b = withCustomer();
    b = saveSale(b, withItems(base("s1", "2026-10-01"), [{ product: "A", quantity: 1, unitPrice: 18 }]), "2026-10-01");
    b = payCustomer(b, "c1", 18, "2026-10-02", "pay1");
    expect(customerOpenBalance(b, "c1")).toBe(0);
    b = saveSale(b, withItems(base("s2", "2026-10-05"), [{ product: "B", quantity: 1, unitPrice: 7 }]), "2026-10-05");
    expect(customerOpenBalance(b, "c1")).toBe(7);
    expect(b.sales[0]!.payments.reduce((a, p) => a + p.amount, 0)).toBe(18);
  });

  it("recusa pagamento acima do saldo", () => {
    let b = withCustomer();
    b = saveSale(b, withItems(base("s1", "2026-10-01"), [{ product: "A", quantity: 1, unitPrice: 18 }]), "2026-10-01");
    expect(() => payCustomer(b, "c1", 19, "2026-10-02", "x")).toThrow();
  });

  it("indicadores não contam a mesma venda duas vezes", () => {
    let b = withCustomer();
    b = saveSale(b, withItems(base("s1", "2026-10-01"), [{ product: "A", quantity: 1, unitPrice: 18 }]), "2026-10-01");
    b = saveSale(b, withItems(base("s2", "2026-10-02"), [{ product: "B", quantity: 1, unitPrice: 12 }]), "2026-10-02");
    b = payCustomer(b, "c1", 25, "2026-10-03", "p");
    const m = businessMetrics(b, { start: "2026-10-01", end: "2026-10-31" });
    expect(m.totalSales).toBe(30);
    expect(m.receivedOfSales).toBe(25);
    expect(m.pendingOfSales).toBe(5);
    expect(m.toReceive).toBe(5);
    expect(m.cashIn).toBe(25);
  });
});

import { saleBalancePreview } from "@/lib/business";
describe("resumo antes de confirmar", () => {
  it("Gabi: 16 + 6 pendentes, nova compra 10, pago 0 => 32; compra paga não conta", () => {
    let b = withCustomer();
    b = saveSale(b, withItems(base("s1", "2026-10-01"), [{ product: "Cone", quantity: 1, unitPrice: 10 }, { product: "Alfajor", quantity: 1, unitPrice: 6 }]), "d");
    b = saveSale(b, withItems(base("s2", "2026-10-02"), [{ product: "Alfajor", quantity: 1, unitPrice: 6 }]), "d");
    b = saveSale(b, withItems(base("s0", "2026-09-01", { payments: [{ date: "2026-09-01", amount: 9 }] }), [{ product: "X", quantity: 1, unitPrice: 9 }]), "d");
    expect(saleBalancePreview(b, "c1", undefined, 10, 0)).toEqual({ previous: 22, newPurchase: 10, paidNow: 0, newBalance: 32 });
    expect(saleBalancePreview(b, "c1", undefined, 10, 4).newBalance).toBe(28);
    // editando s2: não soma a própria venda no saldo anterior
    expect(saleBalancePreview(b, "c1", "s2", 6, 0)).toEqual({ previous: 16, newPurchase: 6, paidNow: 0, newBalance: 22 });
  });
});
