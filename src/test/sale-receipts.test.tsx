import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessTab } from "@/components/BusinessTab";
import { attachCloud, detachCloud, emptyData, readLocalCopy, update, type AppData } from "@/lib/store";
import { businessMetrics, emptyBusiness, filterSales, monthPeriod, receiveSale, remaining, saleProfit, saleTotal, statusOf, type Sale } from "@/lib/business";
import { decideStartup } from "@/lib/cloud-sync";

const sale: Sale = {
  id: "receipt-test", customer: "Cliente teste", product: "Produto teste", quantity: 2,
  unitPrice: 30, unitCost: 12, discount: 0, date: "2026-11-12", paymentMethod: "Pix",
  payments: [], expectedDate: "2026-11-13",
};
const business = () => ({ ...emptyBusiness(), sales: [sale] });

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});

afterEach(() => { cleanup(); detachCloud(); });

describe("Recebimentos e filtros de vendas", () => {
  it("quitação sai de pendentes e entra em pagas sem excluir a venda", () => {
    const paid = receiveSale(business(), sale.id, 60, "2026-11-13", "confirmation-1");
    expect(statusOf(60, paid.sales[0] ?? sale)).toBe("pago");
    expect(filterSales(paid.sales, "pendentes")).toEqual([]);
    expect(filterSales(paid.sales, "pagas").map((s) => s.id)).toEqual([sale.id]);
    expect(filterSales(paid.sales, "todas")).toHaveLength(1);
  });
  it("preserva cliente, produtos, preço, custo, datas e lucro", () => {
    const paid = receiveSale(business(), sale.id, 60, "2026-11-13", "confirmation-1");
    const { payments, ...original } = sale;
    const { payments: received, ...retained } = paid.sales[0] ?? sale;
    expect(retained).toEqual(original);
    expect(received).toEqual([{ amount: 60, date: "2026-11-13", paymentId: "confirmation-1" }]);
    expect(saleProfit(paid.sales[0] ?? sale)?.profit).toBe(36);
    expect(payments).toEqual([]);
  });
  it("parcial permanece pendente com restante correto", () => {
    const partial = receiveSale(business(), sale.id, 20, "2026-11-13", "partial");
    expect(filterSales(partial.sales, "pendentes")).toHaveLength(1);
    expect(filterSales(partial.sales, "pagas")).toHaveLength(0);
    expect(remaining(saleTotal(sale), partial.sales[0] ?? sale)).toBe(40);
    expect(statusOf(60, partial.sales[0] ?? sale)).toBe("parcial");
  });
  it("mesma confirmação parcial não duplica o recebimento", () => {
    const partial = receiveSale(business(), sale.id, 20, "2026-11-13", "partial");
    const repeated = receiveSale(partial, sale.id, 20, "2026-11-13", "partial");
    expect(repeated).toBe(partial);
    expect(repeated.sales[0]?.payments).toHaveLength(1);
    expect(remaining(60, repeated.sales[0] ?? sale)).toBe(40);
  });
  it("revalida saldo atual e não recebe venda cancelada", () => {
    const partial = receiveSale(business(), sale.id, 20, "2026-11-13", "partial");
    expect(() => receiveSale(partial, sale.id, 60, "2026-11-13", "stale")).toThrow(/saldo restante/);
    expect(() => receiveSale({ ...business(), sales: [{ ...sale, status: "cancelada" }] }, sale.id, 60, "2026-11-13", "cancelled")).toThrow();
  });
  it("atualiza recebidos, pendentes e caixa sem mudar faturamento ou lucro", () => {
    const paid = receiveSale(business(), sale.id, 60, "2026-11-13", "confirmation-1");
    expect(businessMetrics(paid, monthPeriod("2026-11"))).toMatchObject({
      totalSales: 60, receivedOfSales: 60, pendingOfSales: 0, toReceive: 0,
      cashIn: 60, balance: 60, grossProfit: 36, salesCount: 1,
    });
  });
  it("canceladas e devolvidas ficam apenas em Todas", () => {
    const sales = [{ ...sale, status: "cancelada" as const }, { ...sale, id: "return", status: "devolvida" as const }];
    expect(filterSales(sales, "todas")).toHaveLength(2);
    expect(filterSales(sales, "pendentes")).toHaveLength(0);
    expect(filterSales(sales, "pagas")).toHaveLength(0);
  });
});

describe("Recebimentos na interface e persistência da conta", () => {
  beforeEach(() => localStorage.clear());
  it("confirma pagamento, remove da tela imediatamente e relê a versão sincronizada após reconectar", async () => {
    let cloud: AppData = { ...emptyData(), business: business() };
    const save = vi.fn((data: AppData) => { cloud = JSON.parse(JSON.stringify(data)); });
    attachCloud("receipt-user", cloud, save);
    render(<BusinessTab />);
    fireEvent.click(screen.getByRole("button", { name: "Vendas" }));
    fireEvent.click(screen.getByRole("button", { name: "Receber" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    expect(screen.queryByText("Produto teste · 2x")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Receber" })).not.toBeInTheDocument();
    expect(save).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /^Pagas/ }));
    expect(screen.getByText("Produto teste · 2x")).toBeInTheDocument();
    expect(readLocalCopy("receipt-user")?.business.sales[0]?.payments).toHaveLength(1);
    act(() => { detachCloud(); attachCloud("receipt-user", cloud, save); });
    fireEvent.click(screen.getByRole("button", { name: /^Pendentes/ }));
    expect(screen.queryByText("Produto teste · 2x")).not.toBeInTheDocument();
    expect(cloud.business.sales).toHaveLength(1);
  });
  it("parcial atualiza a lista na hora e mostra o valor restante", () => {
    attachCloud("receipt-user", { ...emptyData(), business: business() }, vi.fn());
    render(<BusinessTab />);
    fireEvent.click(screen.getByRole("button", { name: "Vendas" }));
    fireEvent.click(screen.getByRole("button", { name: "Receber" }));
    fireEvent.change(within(screen.getByRole("dialog")).getByLabelText("Valor"), { target: { value: "20" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmar" }));
    expect(screen.getByText(/Parcial · falta/).textContent).toContain("40,00");
    expect(screen.getByRole("button", { name: "Receber" })).toBeInTheDocument();
  });
  it("recebimento offline é mantido na reconciliação sem sobrescrever outra versão", () => {
    attachCloud("receipt-user", { ...emptyData(), business: business() }, vi.fn());
    update((d) => ({ ...d, business: receiveSale(d.business, sale.id, 60, "2026-11-13", "offline") }));
    const cache = readLocalCopy("receipt-user");
    const same = decideStartup({ remote: { data: business(), revision: 4 }, cache, meta: { baseRevision: 4, dirty: true }, legacy: null });
    expect(same.kind).toBe("push");
    if (same.kind !== "push") throw new Error("Expected pending payment to be resent");
    expect(filterSales(same.data.business.sales, "pagas")).toHaveLength(1);
    expect(decideStartup({ remote: { data: business(), revision: 5 }, cache, meta: { baseRevision: 4, dirty: true }, legacy: null }).kind).toBe("conflict");
  });
});