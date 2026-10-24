import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addPayment,
  assertStockAvailable,
  businessMetrics,
  dueGroup,
  emptyBusiness,
  expensesByCategory,
  monthPeriod,
  saleProfit,
  saleTotal,
  soldOn,
  statusOf,
  stockStatus,
  type BusinessData,
  type Sale,
  type ScheduledPayment,
} from "@/lib/business";
import { backupSchema } from "@/lib/data-validation";

const P = monthPeriod("2026-10");
const sale = (o: Partial<Sale> = {}): Sale => ({
  id: "s1", customer: "Ana", product: "Bolo", quantity: 3, unitPrice: 19.9, discount: 0.7,
  date: "2026-10-10", paymentMethod: "Pix", payments: [], ...o,
});
const sched = (o: Partial<ScheduledPayment> = {}): ScheduledPayment => ({
  id: "a1", kind: "receber", party: "Loja X", item: "Encomenda", amount: 200,
  dueDate: "2026-10-20", payments: [], ...o,
});

describe("Negócio — vendas", () => {
  it("total = quantidade × valor unitário − desconto, sem erro de arredondamento", () => {
    expect(saleTotal(sale())).toBe(59);
  });
  it("calcula lucro e margem só quando o custo é informado", () => {
    expect(saleProfit(sale())).toBeNull();
    const p = saleProfit(sale({ unitCost: 8 }))!;
    expect(p.profit).toBe(35);
    expect(p.margin).toBeCloseTo(35 / 59);
  });
  it("venda pendente não conta como recebida nem entra no saldo", () => {
    const m = businessMetrics({ ...emptyBusiness(), sales: [sale()] }, P);
    expect(m.totalSales).toBe(59);
    expect(m.receivedOfSales).toBe(0);
    expect(m.pendingOfSales).toBe(59);
    expect(m.balance).toBe(0);
    expect(m.toReceive).toBe(59);
  });
});

describe("Negócio — agendados", () => {
  it("recebimento agendado não entra no caixa antes da confirmação", () => {
    const m = businessMetrics({ ...emptyBusiness(), scheduled: [sched()] }, P);
    expect(m.balance).toBe(0);
    expect(m.toReceive).toBe(200);
  });
  it("confirmar recebimento atualiza o saldo uma única vez e bloqueia excesso", () => {
    const paid = addPayment(sched(), 200, 200, "2026-10-20");
    const b: BusinessData = { ...emptyBusiness(), scheduled: [paid] };
    expect(businessMetrics(b, P).balance).toBe(200);
    expect(statusOf(200, paid)).toBe("pago");
    expect(() => addPayment(paid, 200, 1, "2026-10-21")).toThrow();
  });
  it("conta a pagar parcial mantém saldo restante e não fica quitada", () => {
    const bill = addPayment(sched({ kind: "pagar", amount: 300 }), 300, 120.5, "2026-10-15");
    expect(statusOf(300, bill)).toBe("parcial");
    const m = businessMetrics({ ...emptyBusiness(), scheduled: [bill] }, P);
    expect(m.toPay).toBe(179.5);
    expect(m.balance).toBe(-120.5);
    expect(dueGroup(bill, "2026-10-21")).toBe("atraso");
    expect(dueGroup(bill, "2026-10-20")).toBe("hoje");
    expect(dueGroup(bill, "2026-10-01")).toBe("proximos");
  });
});

describe("Negócio — gastos e lucro", () => {
  const b: BusinessData = {
    sales: [sale({ unitCost: 8, payments: [{ date: "2026-10-10", amount: 59 }] })],
    expenses: [
      { id: "e1", description: "Embalagem", category: "Mercadorias e produtos", amount: 10, date: "2026-10-02", paid: true, paidDate: "2026-10-02" },
      { id: "e2", description: "Anúncio", category: "Marketing", amount: 30, date: "2026-10-05", paid: false },
    ],
    scheduled: [],
  };
  it("lucro líquido = lucro bruto − gastos; saldo só com pagos", () => {
    const m = businessMetrics(b, P);
    expect(m.grossProfit).toBe(35);
    expect(m.netProfit).toBe(-5);
    expect(m.balance).toBe(49);
    expect(m.toPay).toBe(30);
  });
  it("gráfico mostra categorias reais com percentuais e fica vazio sem gastos", () => {
    const pie = expensesByCategory(b, P);
    expect(pie).toEqual([
      { name: "Marketing", value: 30, percent: 0.75 },
      { name: "Mercadorias e produtos", value: 10, percent: 0.25 },
    ]);
    expect(expensesByCategory(b, monthPeriod("2026-09"))).toEqual([]);
  });
});

describe("Negócio — armazenamento", () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });
  it("backups antigos sem negócio continuam válidos e ganham listas vazias", async () => {
    expect(backupSchema.safeParse({ version: 1, transactions: [] }).success).toBe(true);
    const { importBackup } = await import("@/lib/store");
    await importBackup({ size: 10, text: async () => JSON.stringify({ version: 1, transactions: [] }) } as File);
    const saved = JSON.parse(localStorage.getItem("gerenciador-de-vida:v1")!);
    expect(saved.business).toMatchObject({ sales: [], expenses: [], scheduled: [] });
    expect(saved.version).toBe(1);
  });
  it("venda salva permanece após recarregar e não duplica ao editar", async () => {
    const { update } = await import("@/lib/store");
    update((d) => ({ ...d, business: { ...d.business, sales: [sale()] } }));
    update((d) => ({ ...d, business: { ...d.business, sales: d.business.sales.map((s) => ({ ...s, quantity: 4 })) } }));
    vi.resetModules();
    const raw = JSON.parse(localStorage.getItem("gerenciador-de-vida:v1")!);
    expect(backupSchema.safeParse(raw).success).toBe(true);
    expect(raw.business.sales).toHaveLength(1);
    expect(raw.business.sales[0].quantity).toBe(4);
  });
  it("rejeita backup com venda inválida", () => {
    expect(backupSchema.safeParse({ transactions: [], business: { sales: [{ id: "x" }] } }).success).toBe(false);
  });
});

import { agendaItems, businessDueOn } from "@/lib/business";
describe("Negócio — venda pendente nos Agendados", () => {
  const b: BusinessData = { ...emptyBusiness(), sales: [sale({ expectedDate: "2026-10-22" })] };
  it("venda pendente com data aparece em Agendados sem duplicar totais", () => {
    const items = agendaItems(b);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ saleId: "s1", kind: "receber", dueDate: "2026-10-22", amount: 59 });
    expect(businessMetrics(b, P).toReceive).toBe(59);
  });
  it("venda paga ou sem data não aparece; lembrete só no dia previsto", () => {
    expect(agendaItems({ ...b, sales: [sale()] })).toHaveLength(0);
    expect(agendaItems({ ...b, sales: [sale({ expectedDate: "2026-10-22", payments: [{ date: "2026-10-22", amount: 59 }] })] })).toHaveLength(0);
    expect(businessDueOn(b, "2026-10-22")).toHaveLength(1);
    expect(businessDueOn(b, "2026-10-21")).toHaveLength(0);
  });
});

describe("Negócio — estoque diário de cones", () => {
  it("vendidos soma só as quantidades das vendas do dia", () => {
    const b: BusinessData = {
      ...emptyBusiness(),
      stock: { date: "2026-10-23", initial: 50 },
      sales: [sale({ id: "a", date: "2026-10-23", quantity: 3 }), sale({ id: "b", date: "2026-10-23", quantity: 2 }), sale({ id: "c", date: "2026-10-22", quantity: 9 })],
    };
    expect(soldOn(b, "2026-10-23")).toBe(5);
    const st = stockStatus(b, "2026-10-23")!;
    expect(st.initial).toBe(50);
    expect(st.sold).toBe(5);
    expect(st.remaining).toBe(45);
  });
  it("sem estoque definido para o dia, não há indicadores nem bloqueio", () => {
    const b: BusinessData = { ...emptyBusiness(), stock: { date: "2026-10-22", initial: 50 } };
    expect(stockStatus(b, "2026-10-23")).toBeNull();
    expect(() => assertStockAvailable(b, "2026-10-23", 100)).not.toThrow();
  });
  it("restante nunca fica negativo e estoque zerado bloqueia novas vendas", () => {
    const b: BusinessData = {
      ...emptyBusiness(),
      stock: { date: "2026-10-23", initial: 2 },
      sales: [sale({ date: "2026-10-23", quantity: 5 })],
    };
    expect(stockStatus(b, "2026-10-23")!.remaining).toBe(0);
    expect(() => assertStockAvailable(b, "2026-10-23", 1)).toThrow(/esgotado/i);
  });
  it("bloqueia venda com quantidade maior que o restante", () => {
    const b: BusinessData = {
      ...emptyBusiness(),
      stock: { date: "2026-10-23", initial: 3 },
      sales: [sale({ date: "2026-10-23", quantity: 1 })],
    };
    expect(() => assertStockAvailable(b, "2026-10-23", 2)).not.toThrow();
    expect(() => assertStockAvailable(b, "2026-10-23", 3)).toThrow(/insuficiente/i);
  });
  it("backup sem estoque continua válido e com estoque preserva o campo", () => {
    const base = { transactions: [], business: emptyBusiness() };
    expect(backupSchema.safeParse(base).success).toBe(true);
    const withStock = { ...base, business: { ...emptyBusiness(), stock: { date: "2026-10-23", initial: 50 } } };
    const parsed = backupSchema.parse(withStock);
    expect(parsed.business?.stock?.initial).toBe(50);
  });
});
