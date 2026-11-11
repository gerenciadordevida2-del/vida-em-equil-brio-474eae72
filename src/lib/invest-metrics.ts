/**
 * Motor financeiro puro (sem rede). Toda função devolve `null` quando os dados de
 * entrada não permitem o cálculo — nunca inventa um indicador.
 */

export type AssetClass = "acao" | "fii" | "etf" | "bdr" | "renda_fixa" | "cripto" | "outro";
export const ASSET_CLASSES: { value: AssetClass; label: string }[] = [
  { value: "acao", label: "Ações" },
  { value: "fii", label: "Fundos imobiliários" },
  { value: "etf", label: "ETFs" },
  { value: "bdr", label: "BDRs" },
  { value: "renda_fixa", label: "Renda fixa" },
  { value: "cripto", label: "Cripto" },
  { value: "outro", label: "Outros" },
];
export const classLabel = (c: AssetClass) => ASSET_CLASSES.find((x) => x.value === c)?.label ?? c;

export type InvestmentOperation = {
  id: string;
  date: string;
  ticker: string;
  assetClass: AssetClass;
  side: "compra" | "venda";
  quantity: number;
  price: number;
  fees?: number;
  notes?: string;
  currency?: "BRL" | "USD";
  market?: "br" | "us" | "crypto";
  fxRate?: number;
};

export type InvestmentIncome = {
  id: string;
  date: string;
  ticker: string;
  kind: "dividendo" | "jcp" | "rendimento" | "juros";
  amount: number;
  currency?: "BRL" | "USD";
  fxRate?: number;
};

export type SuggestedItem = {
  ticker: string;
  name: string;
  assetClass: AssetClass;
  refPrice: number;
  quantity: number;
  percent: number;
  rationale: string;
  risks: string;
};

export type SuggestedPortfolio = {
  id: string;
  createdAt: string;
  profile: "conservador" | "moderado" | "arrojado";
  capital: number;
  monthly: number;
  horizonYears: number;
  goal?: string;
  items: SuggestedItem[];
};

export type PriceAlert = { id: string; ticker: string; above?: number; below?: number };

export type InvestmentsData = {
  operations: InvestmentOperation[];
  incomes: InvestmentIncome[];
  suggested: SuggestedPortfolio[];
  alerts: PriceAlert[];
  targets: Partial<Record<AssetClass, number>>;
};

export const emptyInvestments = (): InvestmentsData => ({
  operations: [],
  incomes: [],
  suggested: [],
  alerts: [],
  targets: {},
});

const finite = (...v: unknown[]) => v.every((x) => typeof x === "number" && Number.isFinite(x));
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

// ---------- Indicadores fundamentalistas ----------
export const pl = (price: number, eps: number) => (finite(price, eps) && eps !== 0 ? r2(price / eps) : null);
export const pvp = (price: number, bvps: number) => (finite(price, bvps) && bvps > 0 ? r2(price / bvps) : null);
/** Percentual. */
export const roe = (netIncome: number, equity: number) =>
  finite(netIncome, equity) && equity > 0 ? r2((netIncome / equity) * 100) : null;
/** ROIC = EBIT × (1 − alíquota) / capital investido, em %. */
export const roic = (ebit: number, taxRate: number, investedCapital: number) =>
  finite(ebit, taxRate, investedCapital) && investedCapital > 0 && taxRate >= 0 && taxRate < 1
    ? r2(((ebit * (1 - taxRate)) / investedCapital) * 100)
    : null;
/** Dividend Yield em %, com proventos dos últimos 12 meses por ação. */
export const dividendYield = (dividends12m: number, price: number) =>
  finite(dividends12m, price) && price > 0 && dividends12m >= 0 ? r2((dividends12m / price) * 100) : null;
export const margin = (value: number, revenue: number) =>
  finite(value, revenue) && revenue > 0 ? r2((value / revenue) * 100) : null;
export const growth = (current: number, previous: number) =>
  finite(current, previous) && previous !== 0 ? r2(((current - previous) / Math.abs(previous)) * 100) : null;
export const netDebtToEbitda = (grossDebt: number, cash: number, ebitda: number) =>
  finite(grossDebt, cash, ebitda) && ebitda > 0 ? r2((grossDebt - cash) / ebitda) : null;
export const debtToEquity = (debt: number, equity: number) =>
  finite(debt, equity) && equity > 0 ? r2(debt / equity) : null;
export const currentRatio = (currentAssets: number, currentLiabilities: number) =>
  finite(currentAssets, currentLiabilities) && currentLiabilities > 0 ? r2(currentAssets / currentLiabilities) : null;
export const freeCashFlow = (operatingCashFlow: number, capex: number) =>
  finite(operatingCashFlow, capex) ? r2(operatingCashFlow - Math.abs(capex)) : null;

// ---------- Séries de preços ----------
/** Volatilidade anualizada (%) a partir de fechamentos diários. */
export function volatility(closes: number[], periodsPerYear = 252): number | null {
  const p = closes.filter((x) => finite(x) && x > 0);
  if (p.length < 3) return null;
  const rets = p.slice(1).flatMap((v, i) => { const previous = p[i]; return previous ? [Math.log(v / previous)] : []; });
  const mean = rets.reduce((s, x) => s + x, 0) / rets.length;
  const variance = rets.reduce((s, x) => s + (x - mean) ** 2, 0) / (rets.length - 1);
  return r2(Math.sqrt(variance) * Math.sqrt(periodsPerYear) * 100);
}
/** Rentabilidade do período (%). */
export function periodReturn(closes: number[]): number | null {
  const p = closes.filter((x) => finite(x) && x > 0);
  if (p.length < 2) return null;
  const first = p[0], last = p.at(-1);
  return first && last ? r2((last / first - 1) * 100) : null;
}
export function cagr(start: number, end: number, years: number): number | null {
  if (!finite(start, end, years) || start <= 0 || end <= 0 || years <= 0) return null;
  return r2(((end / start) ** (1 / years) - 1) * 100);
}

// ---------- Simulação de aportes ----------
export type SimPoint = { month: number; invested: number; balance: number };
export function simulate(initial: number, monthly: number, annualRatePercent: number, years: number) {
  if (!finite(initial, monthly, annualRatePercent, years) || initial < 0 || monthly < 0 || years <= 0 || years > 60)
    return null;
  const i = (1 + annualRatePercent / 100) ** (1 / 12) - 1;
  const months = Math.round(years * 12);
  let balance = initial;
  let invested = initial;
  const series: SimPoint[] = [{ month: 0, invested: r2(invested), balance: r2(balance) }];
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + i) + monthly;
    invested += monthly;
    if (m % 12 === 0 || m === months) series.push({ month: m, invested: r2(invested), balance: r2(balance) });
  }
  return {
    finalBalance: r2(balance),
    totalInvested: r2(invested),
    earnings: r2(balance - invested),
    monthlyRatePercent: r4(i * 100),
    series,
  };
}

// ---------- Carteira real ----------
export type Position = {
  ticker: string;
  assetClass: AssetClass;
  quantity: number;
  avgPrice: number;
  invested: number;
  realized: number;
  currency: "BRL" | "USD";
  market: "br" | "us" | "crypto";
  key: string;
  investedNative: number;
  realizedNative: number;
};

export const positionKey = (op: Pick<InvestmentOperation, "ticker" | "market" | "currency">) =>
  `${op.market ?? "br"}:${op.ticker.toUpperCase()}:${op.currency ?? "BRL"}`;

/** Posições derivadas das operações (custo médio). Vendas acima da quantidade são ignoradas. */
export function positions(ops: InvestmentOperation[]): Position[] {
  const map = new Map<string, Position>();
  for (const op of [...ops].sort((a, b) => a.date.localeCompare(b.date))) {
    const t = op.ticker.toUpperCase();
    const key = positionKey(op);
    const currency = op.currency ?? "BRL";
    const fx = currency === "USD" ? op.fxRate : 1;
    if (typeof fx !== "number" || !Number.isFinite(fx) || fx <= 0) continue;
    const p = map.get(key) ?? { ticker: t, key, currency, market: op.market ?? "br", assetClass: op.assetClass, quantity: 0, avgPrice: 0, invested: 0, realized: 0, investedNative: 0, realizedNative: 0 };
    const fees = op.fees ?? 0;
    if (op.side === "compra") {
      const cost = op.quantity * op.price + fees;
      p.invested += cost * fx;
      p.investedNative += cost;
      p.quantity += op.quantity;
      p.avgPrice = p.quantity > 0 ? p.investedNative / p.quantity : 0;
    } else {
      const q = Math.min(op.quantity, p.quantity);
      if (q <= 0) continue;
      const removedBRL = q * (p.invested / p.quantity);
      p.realized += (q * op.price - fees) * fx - removedBRL;
      p.realizedNative += q * op.price - fees - q * p.avgPrice;
      p.quantity -= q;
      p.invested -= removedBRL;
      p.investedNative = p.quantity * p.avgPrice;
      if (p.quantity <= 1e-9) {
        p.quantity = 0;
        p.invested = 0;
      }
    }
    map.set(key, p);
  }
  return [...map.values()]
    .filter((p) => p.quantity > 0 || p.realized !== 0)
    .map((p) => ({ ...p, avgPrice: r4(p.avgPrice), invested: r2(p.invested), realized: r2(p.realized) }));
}

/** Valor de mercado por posição; sem cotação usa o custo e marca `priced: false`. */
export function valuePositions(list: Position[], prices: Record<string, number | undefined>, usdBrl?: number) {
  return list
    .filter((p) => p.quantity > 0)
    .map((p) => {
      const price = prices[p.key] ?? (p.currency === "BRL" ? prices[p.ticker] : undefined);
      const fx = p.currency === "USD" ? usdBrl : 1;
      const priced = typeof price === "number" && Number.isFinite(price) && price > 0 && typeof fx === "number" && Number.isFinite(fx) && fx > 0;
      const value = r2(priced ? p.quantity * (price ?? 0) * (fx ?? 1) : p.invested);
      const nativeValue = priced ? p.quantity * (price ?? 0) : p.investedNative;
      return { ...p, price: priced ? price : null, priced, value, pnl: r2(value - p.invested), nativeValue: r2(nativeValue), nativePnl: r2(nativeValue - p.investedNative) };
    });
}

export function allocation(values: { ticker: string; assetClass: AssetClass; value: number }[]) {
  const total = values.reduce((s, v) => s + v.value, 0);
  if (total <= 0) return { total: 0, byClass: [], byAsset: [], maxAssetPercent: 0, hhi: 0 };
  const byClassMap = new Map<AssetClass, number>();
  values.forEach((v) => byClassMap.set(v.assetClass, (byClassMap.get(v.assetClass) ?? 0) + v.value));
  const byClass = [...byClassMap].map(([assetClass, value]) => ({ assetClass, value: r2(value), percent: r2((value / total) * 100) }));
  const byAsset = values
    .map((v) => ({ ticker: v.ticker, value: v.value, percent: r2((v.value / total) * 100) }))
    .sort((a, b) => b.percent - a.percent);
  const hhi = Math.round(byAsset.reduce((s, a) => s + a.percent ** 2, 0));
  return { total: r2(total), byClass, byAsset, maxAssetPercent: byAsset[0]?.percent ?? 0, hhi };
}

/** Quanto aportar em cada classe para se aproximar das metas, sem vender nada. */
export function rebalance(
  current: Partial<Record<AssetClass, number>>,
  targets: Partial<Record<AssetClass, number>>,
  contribution: number,
) {
  const sumTargets = Object.values(targets).reduce((s, x) => s + (x ?? 0), 0);
  if (sumTargets <= 0 || !finite(contribution) || contribution < 0) return null;
  const total = Object.values(current).reduce((s, x) => s + (x ?? 0), 0) + contribution;
  const gaps = (Object.keys(targets) as AssetClass[]).map((c) => {
    const target = ((targets[c] ?? 0) / sumTargets) * total;
    return { assetClass: c, gap: Math.max(0, target - (current[c] ?? 0)) };
  });
  const sumGaps = gaps.reduce((s, g) => s + g.gap, 0);
  return gaps.map((g) => ({
    assetClass: g.assetClass,
    currentPercent: total - contribution > 0 ? r2(((current[g.assetClass] ?? 0) / (total - contribution)) * 100) : 0,
    targetPercent: r2(((targets[g.assetClass] ?? 0) / sumTargets) * 100),
    buy: sumGaps > 0 ? r2((g.gap / sumGaps) * contribution) : 0,
  }));
}

/** Alertas de risco/concentração da carteira (limiares fixos e explícitos). */
export function portfolioRisks(alloc: ReturnType<typeof allocation>, targets: Partial<Record<AssetClass, number>>) {
  const out: string[] = [];
  for (const a of alloc.byAsset) if (a.percent > 25) out.push(`${a.ticker} concentra ${a.percent}% da carteira (acima de 25%).`);
  if (alloc.byClass.length === 1 && alloc.total > 0) out.push("Toda a carteira está em uma única classe de ativos.");
  const sum = Object.values(targets).reduce((s, x) => s + (x ?? 0), 0);
  if (sum > 0)
    for (const c of Object.keys(targets) as AssetClass[]) {
      const target = ((targets[c] ?? 0) / sum) * 100;
      const cur = alloc.byClass.find((x) => x.assetClass === c)?.percent ?? 0;
      if (Math.abs(cur - target) > 5) out.push(`${classLabel(c)}: ${cur}% atual vs. ${r2(target)}% da meta.`);
    }
  return out;
}

export function incomesLast12m(incomes: InvestmentIncome[], todayStr: string) {
  const d = new Date(`${todayStr}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  const from = d.toISOString().slice(0, 10);
  return r2(incomes.filter((i) => i.date > from && i.date <= todayStr).reduce((s, i) => s + i.amount * (i.currency === "USD" ? i.fxRate ?? 0 : 1), 0));
}

export function triggeredAlerts(alerts: PriceAlert[], prices: Record<string, number | undefined>) {
  return alerts.flatMap((a) => {
    const p = prices[a.ticker];
    if (typeof p !== "number") return [];
    if (a.above != null && p >= a.above) return [`${a.ticker} atingiu ${p} (alerta acima de ${a.above})`];
    if (a.below != null && p <= a.below) return [`${a.ticker} caiu para ${p} (alerta abaixo de ${a.below})`];
    return [];
  });
}

/** Quantidade inteira estimada para um percentual do capital a um preço de referência. */
export const estimatedQuantity = (capital: number, percent: number, price: number) =>
  finite(capital, percent, price) && price > 0 && capital > 0 ? Math.floor((capital * percent) / 100 / price) : 0;
