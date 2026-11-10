import { describe, expect, it } from "vitest";
import { positions, simulate, pl } from "@/lib/invest-metrics";
import { prepareAction } from "@/lib/ai-actions";
import { normalizeImport } from "./invest-helpers";

describe("investimentos", () => {
  it("preço médio e venda", () => {
    const p = positions([
      { id: "1", date: "2026-01-01", ticker: "PETR4", assetClass: "acao", side: "compra", quantity: 10, price: 30 },
      { id: "2", date: "2026-02-01", ticker: "PETR4", assetClass: "acao", side: "compra", quantity: 10, price: 40 },
      { id: "3", date: "2026-03-01", ticker: "PETR4", assetClass: "acao", side: "venda", quantity: 5, price: 50 },
    ]);
    expect(p[0]).toMatchObject({ quantity: 15, avgPrice: 35, realized: 75 });
  });
  it("não inventa indicadores", () => {
    expect(pl(10, 0)).toBeNull();
    expect(simulate(0, 100, 0, 1)?.finalBalance).toBe(1200);
  });
  it("bloqueia venda acima da posição", () => {
    const data = normalizeImport();
    expect(() =>
      prepareAction("add_investment_operation", { ticker: "PETR4", assetClass: "acao", side: "venda", quantity: 1, price: 10 }, data),
    ).toThrow(/só 0/);
  });
});
