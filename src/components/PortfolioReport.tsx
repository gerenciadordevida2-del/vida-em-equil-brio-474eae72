import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { useData, brl, today } from "@/lib/store";
import { allocation, classLabel, incomesLast12m, portfolioRisks, positions, valuePositions } from "@/lib/invest-metrics";
import { getGlobalMarket, getQuotes } from "@/lib/market.functions";

const usd = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(v);
export function PortfolioReport() {
  const data = useData();
  const pos = positions(data.investments?.operations ?? []);
  const held = pos.filter((p) => p.quantity > 0);
  const national = useServerFn(getQuotes);
  const global = useServerFn(getGlobalMarket);
  const query = useQuery({
    queryKey: ["portfolio-report", held.map((p) => p.key).join(",")], staleTime: 5 * 60_000,
    queryFn: async () => {
      const br = held.filter((p) => p.market === "br").map((p) => p.ticker);
      const us = [...new Set(["^IXIC", "^NYA", "^GSPC", "^DJI", ...held.filter((p) => p.market === "us").map((p) => p.ticker)])];
      const crypto = [...new Set(["BTC", "ETH", "SOL", ...held.filter((p) => p.market === "crypto").map((p) => p.ticker)])];
      const groups = [];
      for (let i = 0; i < Math.max(us.length, crypto.length, 1); i += 10) groups.push(global({ data: { us: us.slice(i, i + 10), crypto: crypto.slice(i, i + 10) } }));
      const domestic = [];
      for (let i = 0; i < br.length; i += 10) domestic.push(national({ data: { tickers: br.slice(i, i + 10) } }));
      const [world, brazil] = await Promise.all([Promise.all(groups), Promise.all(domestic)]);
      return { world, brazil };
    },
  });
  const fx = query.data?.world[0]?.fx;
  const rate = fx?.ok ? fx.usdBrl : undefined;
  const prices: Record<string, number | undefined> = {};
  for (const group of query.data?.brazil ?? []) if (group.ok) for (const x of group.quotes) {
    if ("price" in x && x.currency === "BRL" && typeof x.price === "number") prices[`br:${x.symbol}:BRL`] = x.price;
  }
  const marketRows = (query.data?.world ?? []).flatMap((g) => [
    ...g.us.quotes.map((q) => ({ ...q, market: "us" })),
    ...(g.crypto.ok ? g.crypto.quotes.map((q) => ({ ...q, market: "crypto" })) : []),
  ]);
  for (const x of marketRows) if ("price" in x && "currency" in x && typeof x.price === "number") {
    prices[`${x.market}:${x.symbol}:${x.currency}`] = x.price;
    if (x.market === "crypto" && x.currency === "USD" && rate) prices[`crypto:${x.symbol}:BRL`] = x.price * rate;
  }
  const valued = valuePositions(pos, prices, rate);
  const alloc = allocation(valued);
  const invested = valued.reduce((s, p) => s + p.invested, 0);
  const realized = pos.reduce((s, p) => s + p.realized, 0);
  const allPriced = valued.every((p) => p.priced);
  const risks = portfolioRisks(alloc, data.investments?.targets ?? {});
  return <div className="space-y-5">
    <section className="border-b border-border pb-4">
      <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Patrimônio consolidado</h2><Button variant="ghost" size="icon" aria-label="Atualizar mercado" title="Atualizar mercado" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className={query.isFetching ? "animate-spin" : ""} /></Button></div>
      <p className="text-2xl font-semibold">{brl(alloc.total)}</p>
      <p className="text-xs text-muted-foreground">{allPriced ? "Valor de mercado indicativo" : "Inclui custo de ativos sem cotação"} · aplicado {brl(invested)}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-xs text-muted-foreground">Não realizado{!allPriced && " (parcial)"}</p>{brl(alloc.total - invested)}</div>
        <div><p className="text-xs text-muted-foreground">Realizado em vendas</p>{brl(realized)}</div>
        <div><p className="text-xs text-muted-foreground">Proventos · 12 meses</p>{brl(incomesLast12m(data.investments?.incomes ?? [], today()))}</div>
        <div><p className="text-xs text-muted-foreground">Equivalente em USD</p>{rate ? usd(alloc.total / rate) : "Indisponível"}</div>
      </div>
      {fx?.ok && <p className="mt-2 text-xs text-muted-foreground">USD/BRL {fx.usdBrl} · {fx.date} · Frankfurter · referência sem spread</p>}
      {query.isError && <p className="mt-2 text-xs text-destructive">Mercado indisponível. Seus registros permanecem intactos.</p>}
      {query.isPending && <p className="mt-2 text-xs text-muted-foreground">Consultando fontes…</p>}
    </section>
    <section><h2 className="mb-2 font-semibold">Ativos e distribuição</h2>
      {!valued.length && <p className="text-sm text-muted-foreground">Nenhuma posição registrada.</p>}
      <ul className="divide-y divide-border">{valued.map((p) => <li key={p.key} className="py-3 text-sm">
        <div className="flex justify-between gap-2"><b className="break-all">{p.ticker} · {p.currency}</b><span className="shrink-0">{brl(p.value)}</span></div>
        <p className="text-xs text-muted-foreground">{classLabel(p.assetClass)} · {p.quantity} unidades · PM {p.currency === "USD" ? usd(p.avgPrice) : brl(p.avgPrice)}</p>
        <p className="text-xs">{p.priced ? `Atual ${p.currency === "USD" ? usd(p.price ?? 0) : brl(p.price ?? 0)} · resultado ${brl(p.pnl)} (${p.invested > 0 ? (p.pnl / p.invested * 100).toFixed(2) : "0"}%)${p.currency === "USD" ? ` / ${usd(p.nativePnl)} (${p.investedNative > 0 ? (p.nativePnl / p.investedNative * 100).toFixed(2) : "0"}%)` : ""}` : "Sem cotação compatível · exibido pelo custo"}</p>
      </li>)}</ul>
      <p className="mt-2 text-xs text-muted-foreground">{alloc.byClass.map((c) => `${classLabel(c.assetClass)} ${c.percent}%`).join(" · ")}</p>
      {risks.map((r) => <p className="mt-2 text-xs text-warning" key={r}>{r}</p>)}
    </section>
    <section><h2 className="mb-2 font-semibold">Mercados globais</h2><ul className="grid grid-cols-2 gap-3 text-sm">{marketRows.filter((r) => ["^IXIC", "^NYA", "^GSPC", "^DJI", "BTC", "ETH", "SOL"].includes(r.symbol)).map((r) => <li key={`${r.market}:${r.symbol}`}>
      <b>{({ "^IXIC": "NASDAQ", "^NYA": "NYSE", "^GSPC": "S&P 500", "^DJI": "Dow Jones" } as Record<string, string>)[r.symbol] ?? r.symbol}</b>
      <span className="block">{"price" in r && r.price != null ? (r.symbol.startsWith("^") ? `${r.price.toLocaleString("pt-BR")} pts` : usd(r.price)) : "Indisponível"}</span>
      {"updatedAt" in r && <span className="block break-words text-xs text-muted-foreground">{new Date(r.updatedAt).toLocaleString("pt-BR")}</span>}
    </li>)}</ul>
    <p className="mt-3 text-xs text-muted-foreground">Yahoo Finance / CoinGecko · consultas ao abrir ou atualizar, cache de 5 min no aparelho; podem ter atraso ou limites. Balanços anuais SEC e manchetes disponíveis no assistente; auditorias de projetos não verificadas.</p></section>
    <Button asChild variant="outline" className="w-full"><Link to="/assistente">Analisar carteira com o assistente</Link></Button>
  </div>;
}