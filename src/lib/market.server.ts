/**
 * Fontes de mercado (somente servidor).
 * - Banco Central (SGS): oficial, gratuito, sem chave.
 * - brapi.dev: cotações, histórico, proventos e fundamentos (B3/BDR). Chave em BRAPI_TOKEN.
 * Cache em memória por instância do servidor; erros nunca viram números inventados.
 */
import { periodReturn, volatility } from "@/lib/invest-metrics";

type Cached = { at: number; value: unknown };
const cache = new Map<string, Cached>();
async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await load();
  if (cache.size > 300) cache.clear();
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000), headers: { accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  return res.json();
}

export type Fail = { ok: false; source: string; error: string };
const fail = (source: string, e: unknown): Fail => ({
  ok: false,
  source,
  error: e instanceof Error ? e.message : "Falha desconhecida",
});

// ---------- Banco Central ----------
const SGS = {
  selicMeta: { code: 432, label: "Selic meta (% a.a.)" },
  cdiAnual: { code: 4389, label: "CDI anualizado base 252 (% a.a.)" },
  ipca12m: { code: 13522, label: "IPCA acumulado 12 meses (%)" },
  ipcaMensal: { code: 433, label: "IPCA mensal (%)" },
} as const;

export async function economicIndicators() {
  try {
    const entries = await cached("bcb", 6 * 3600_000, async () =>
      Promise.all(
        Object.entries(SGS).map(async ([key, s]) => {
          const raw = (await getJson(
            `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${s.code}/dados/ultimos/1?formato=json`,
          )) as { data: string; valor: string }[];
          const last = raw.at(-1);
          return { key, label: s.label, value: last ? Number(last.valor) : null, date: last?.data ?? null, serie: s.code };
        }),
      ),
    );
    return { ok: true as const, source: "Banco Central do Brasil (SGS)", indicators: entries };
  } catch (e) {
    return fail("Banco Central do Brasil (SGS)", e);
  }
}

// ---------- brapi ----------
const TICKER = /^[A-Z0-9.^-]{1,15}$/;
export const cleanTickers = (list: string[]) =>
  [...new Set(list.map((t) => t.trim().toUpperCase()))].filter((t) => TICKER.test(t)).slice(0, 10);

function brapiUrl(path: string, params: Record<string, string>) {
  const url = new URL(`https://brapi.dev/api/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const token = process.env["BRAPI_TOKEN"]?.trim();
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

export const brapiConfigured = () => Boolean(process.env["BRAPI_TOKEN"]?.trim());

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

type BrapiQuote = Record<string, unknown> & {
  symbol: string;
  historicalDataPrice?: { date: number; close: number }[];
  dividendsData?: { cashDividends?: { paymentDate?: string; rate?: number; label?: string }[] };
};

export async function quotes(tickers: string[], range: "1mo" | "3mo" | "6mo" | "1y" | "5y" = "1y") {
  const list = cleanTickers(tickers);
  if (!list.length) return fail("brapi.dev", new Error("Nenhum ticker válido"));
  try {
    const data = await cached(`q:${list.join(",")}:${range}`, 5 * 60_000, async () => {
      // Plano gratuito aceita 1 ativo por requisição: busca em paralelo.
      const results = await Promise.all(
        list.map(async (t) => {
          try {
            const json = (await getJson(
              brapiUrl(`quote/${encodeURIComponent(t)}`, { range, interval: "1d", dividends: "true" }),
            )) as { results?: BrapiQuote[] };
            const q = json.results?.[0];
            if (!q) return { symbol: t, error: "Ativo não encontrado" };
            const closes = (q.historicalDataPrice ?? []).map((h) => h.close).filter((c) => typeof c === "number");
            const divs = (q.dividendsData?.cashDividends ?? []).slice(0, 12).map((d) => ({
              date: d.paymentDate?.slice(0, 10) ?? null,
              valuePerShare: num(d.rate),
              kind: d.label ?? null,
            }));
            return {
              symbol: q.symbol,
              name: (q["longName"] ?? q["shortName"] ?? null) as string | null,
              currency: (q["currency"] ?? null) as string | null,
              price: num(q["regularMarketPrice"]),
              changePercent: num(q["regularMarketChangePercent"]),
              marketCap: num(q["marketCap"]),
              priceEarnings: num(q["priceEarnings"]),
              earningsPerShare: num(q["earningsPerShare"]),
              fiftyTwoWeekLow: num(q["fiftyTwoWeekLow"]),
              fiftyTwoWeekHigh: num(q["fiftyTwoWeekHigh"]),
              updatedAt: (q["regularMarketTime"] ?? null) as string | null,
              range,
              returnPercent: periodReturn(closes),
              volatilityPercent: volatility(closes),
              recentDividends: divs,
            };
          } catch (e) {
            return { symbol: t, error: e instanceof Error ? e.message : "Falha" };
          }
        }),
      );
      return results;
    });
    return { ok: true as const, source: "brapi.dev", tokenConfigured: brapiConfigured(), quotes: data };
  } catch (e) {
    return fail("brapi.dev", e);
  }
}

export async function fundamentals(ticker: string) {
  const [t] = cleanTickers([ticker]);
  if (!t) return fail("brapi.dev", new Error("Ticker inválido"));
  try {
    const q = await cached(`f:${t}`, 6 * 3600_000, async () => {
      const json = (await getJson(
        brapiUrl(`quote/${encodeURIComponent(t)}`, {
          fundamental: "true",
          modules: "summaryProfile,financialData,defaultKeyStatistics",
        }),
      )) as { results?: BrapiQuote[] };
      const r = json.results?.[0];
      if (!r) throw new Error("Ativo não encontrado");
      return r;
    });
    const fd = (q["financialData"] ?? {}) as Record<string, unknown>;
    const ks = (q["defaultKeyStatistics"] ?? {}) as Record<string, unknown>;
    const sp = (q["summaryProfile"] ?? {}) as Record<string, unknown>;
    const pct = (v: unknown) => (num(v) == null ? null : Math.round(num(v)! * 10000) / 100);
    return {
      ok: true as const,
      source: "brapi.dev",
      tokenConfigured: brapiConfigured(),
      ticker: t,
      name: (q["longName"] ?? null) as string | null,
      sector: (sp["sector"] ?? null) as string | null,
      price: num(q["regularMarketPrice"]),
      priceEarnings: num(q["priceEarnings"]),
      priceToBook: num(ks["priceToBook"]),
      earningsPerShare: num(q["earningsPerShare"]) ?? num(ks["trailingEps"]),
      bookValuePerShare: num(ks["bookValue"]),
      dividendYieldPercent: pct(ks["dividendYield"]) ?? pct(ks["yield"]),
      roePercent: pct(fd["returnOnEquity"]),
      roaPercent: pct(fd["returnOnAssets"]),
      grossMarginPercent: pct(fd["grossMargins"]),
      ebitdaMarginPercent: pct(fd["ebitdaMargins"]),
      netMarginPercent: pct(fd["profitMargins"]),
      revenueGrowthPercent: pct(fd["revenueGrowth"]),
      earningsGrowthPercent: pct(fd["earningsGrowth"]),
      debtToEquity: num(fd["debtToEquity"]),
      currentRatio: num(fd["currentRatio"]),
      totalDebt: num(fd["totalDebt"]),
      totalCash: num(fd["totalCash"]),
      ebitda: num(fd["ebitda"]),
      freeCashflow: num(fd["freeCashflow"]),
      operatingCashflow: num(fd["operatingCashflow"]),
      note: "Campos null não foram informados pela fonte (alguns exigem plano pago da brapi).",
    };
  } catch (e) {
    return fail("brapi.dev", e);
  }
}

export async function searchAssets(query: string, type?: "stock" | "fund" | "bdr" | null) {
  const q = query.trim().slice(0, 40);
  if (!q) return fail("brapi.dev", new Error("Busca vazia"));
  try {
    const json = await cached(`s:${q}:${type ?? ""}`, 3600_000, () =>
      getJson(brapiUrl("quote/list", { search: q, limit: "10", ...(type ? { type } : {}) })),
    );
    const stocks = ((json as { stocks?: Record<string, unknown>[] }).stocks ?? []).map((s) => ({
      ticker: s["stock"],
      name: s["name"],
      price: num(s["close"]),
      changePercent: num(s["change"]),
      type: s["type"] ?? null,
      sector: s["sector"] ?? null,
    }));
    return { ok: true as const, source: "brapi.dev", results: stocks };
  } catch (e) {
    return fail("brapi.dev", e);
  }
}
