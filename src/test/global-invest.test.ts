import { describe, it, expect, vi, afterEach } from "vitest";
import { positions, valuePositions, incomesLast12m } from "@/lib/invest-metrics";
import type { InvestmentOperation } from "@/lib/invest-metrics";
import { appendOperation } from "@/lib/investment-ledger";
import { prepareAction, buildSnapshot } from "@/lib/ai-actions";
import { normalizeImport } from "./invest-helpers";
import { backupSchema } from "@/lib/data-validation";
import { cryptoQuotes, exchangeRate, usQuotes } from "@/lib/global-market.server";

const buy: InvestmentOperation = { id: "buy", date: "2026-01-01", ticker: "AAPL", assetClass: "acao", side: "compra", quantity: 0.5, price: 100, fees: 1, currency: "USD", market: "us", fxRate: 5 };
afterEach(() => vi.unstubAllGlobals());
describe("carteira internacional", () => {
  it("mantém frações, taxas, custo histórico BRL e resultados em duas moedas", () => {
    const p = positions([buy, { ...buy, id: "sell", date: "2026-02-01", side: "venda", quantity: 0.1, price: 120, fees: 0.2, fxRate: 6 }]);
    expect(p[0]).toMatchObject({ quantity: 0.4, avgPrice: 102, invested: 204, realized: 19.8 });
    expect(p[0]?.realizedNative).toBeCloseTo(1.6, 8);
    const v = valuePositions(p, { "us:AAPL:USD": 130 }, 6)[0];
    expect(v).toMatchObject({ value: 312, pnl: 108, nativeValue: 52, nativePnl: 11.2, priced: true });
  });
  it("sem câmbio não apresenta dólares como reais nem lucro de mercado", () => {
    expect(valuePositions(positions([buy]), { "us:AAPL:USD": 130 })[0]).toMatchObject({ value: 255, pnl: 0, priced: false });
  });
  it("não mistura ativos homônimos de mercados diferentes", () => {
    expect(positions([buy, { ...buy, id: "br", currency: "BRL", market: "br", price: 20 }])).toHaveLength(2);
  });
  it("não usa compra futura para cobrir uma venda retroativa", () => {
    expect(() => appendOperation([buy], { ...buy, id: "sell", date: "2025-12-31", side: "venda" })).toThrow(/só 0/);
  });
  it("revalida saldo e impede duplicação do mesmo registro", () => {
    const sell = { ...buy, id: "sell", date: "2026-02-01", side: "venda" as const };
    const ledger = appendOperation([buy], sell);
    expect(appendOperation(ledger, sell)).toHaveLength(2);
    expect(() => appendOperation(ledger, { ...sell, id: "another" })).toThrow(/só 0/);
  });
  it("exige câmbio efetivo antes de preparar registro USD", () => {
    expect(() => prepareAction("add_investment_operation", { ...buy, fxRate: null }, normalizeImport())).toThrow(/Câmbio/);
  });
  it("snapshot informa moeda e custo em reais para a IA", () => {
    const data = { ...normalizeImport(), investments: { operations: [buy], incomes: [], suggested: [], alerts: [], targets: {} } };
    expect(buildSnapshot(data).investimentos.posicoes[0]).toMatchObject({ moeda: "USD", mercado: "us", investidoBRL: 255 });
    expect(backupSchema.safeParse(data).success).toBe(true);
    expect(backupSchema.safeParse({ ...data, investments: { ...data.investments, operations: [{ ...buy, fxRate: undefined }] } }).success).toBe(false);
  });
  it("converte proventos USD pelo câmbio efetivo, não atual", () => {
    expect(incomesLast12m([{ id: "1", date: "2026-06-01", ticker: "AAPL", kind: "dividendo", amount: 10, currency: "USD", fxRate: 5.1 }], "2026-11-11")).toBe(51);
  });
});
describe("fontes globais", () => {
  it("preserva fonte, moeda e data das cotações americanas", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ chart: { result: [{ meta: { currency: "USD", regularMarketPrice: 120, regularMarketTime: 1767225600, exchangeName: "NMS" }, indicators: { quote: [{ close: [100, 110, 120] }] } }] } })));
    expect((await usQuotes(["AAPL"])).quotes[0]).toMatchObject({ symbol: "AAPL", currency: "USD", price: 120, returnPercent: 20, source: "Yahoo Finance" });
  });
  it("falha de fonte não vira cotação fictícia", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    expect((await usQuotes(["NVDA"])).quotes[0]).toMatchObject({ ok: false, symbol: "NVDA" });
    expect(await cryptoQuotes(["BTC"])).toMatchObject({ ok: false });
    expect(await exchangeRate()).toMatchObject({ ok: false });
  });
  it("retorna capitalização e volume cripto sem afirmar auditoria", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([{ id: "bitcoin", name: "Bitcoin", current_price: 100, market_cap: 200, total_volume: 30, last_updated: "2026-11-11T00:00:00Z" }])));
    const result = await cryptoQuotes(["BTC", "UNKNOWN"]);
    expect(result.ok && result.quotes[0]).toMatchObject({ price: 100, currency: "USD", marketCap: 200, volume24h: 30 });
    expect(result.ok && result.quotes[1]).toMatchObject({ error: "Projeto não disponível nesta fonte" });
  });
});