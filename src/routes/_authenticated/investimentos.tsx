import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Page, Card } from "@/components/AppShell";
import { brl, today, useData } from "@/lib/store";
import {
  allocation,
  classLabel,
  incomesLast12m,
  portfolioRisks,
  positions,
  simulate,
  valuePositions,
} from "@/lib/invest-metrics";
import { getIndicators, getQuotes } from "@/lib/market.functions";

export const Route = createFileRoute("/_authenticated/investimentos")({
  head: () => ({
    meta: [
      { title: "Investimentos — Gerenciador de Vida" },
      { name: "description", content: "Carteira, indicadores econômicos, proventos e simulações de aportes." },
      { property: "og:title", content: "Investimentos — Gerenciador de Vida" },
      { property: "og:description", content: "Acompanhe sua carteira e o mercado com dados reais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Investimentos,
});

function Investimentos() {
  const data = useData();
  const inv = data.investments;
  const pos = useMemo(() => positions(inv?.operations ?? []), [inv?.operations]);
  const tickers = pos.filter((p) => p.quantity > 0).map((p) => p.ticker).slice(0, 10);
  const indicatorsFn = useServerFn(getIndicators);
  const quotesFn = useServerFn(getQuotes);
  const ind = useQuery({ queryKey: ["indicators"], queryFn: () => indicatorsFn(), staleTime: 3600_000 });
  const q = useQuery({
    queryKey: ["quotes", tickers.join(",")],
    queryFn: () => quotesFn({ data: { tickers } }),
    enabled: tickers.length > 0,
    staleTime: 5 * 60_000,
  });
  const prices: Record<string, number | undefined> = {};
  if (q.data?.ok)
    for (const x of q.data.quotes) if ("price" in x && typeof x.price === "number") prices[x.symbol] = x.price;
  const valued = valuePositions(pos, prices);
  const alloc = allocation(valued);
  const invested = valued.reduce((s, p) => s + p.invested, 0);
  const risks = portfolioRisks(alloc, inv?.targets ?? {});
  const income12 = incomesLast12m(inv?.incomes ?? [], today());

  const [sim, setSim] = useState({ initial: "1000", monthly: "300", rate: "10", years: "10" });
  const simResult = simulate(+sim.initial, +sim.monthly, +sim.rate, +sim.years);

  return (
    <Page title="Investimentos" subtitle="Carteira e mercado com dados reais">
      <div className="space-y-4">
        <Card>
          <p className="text-xs text-muted-foreground">Patrimônio investido</p>
          <p className="text-2xl font-semibold">{brl(alloc.total)}</p>
          <p className={`text-sm ${alloc.total - invested >= 0 ? "text-primary" : "text-destructive"}`}>
            {alloc.total - invested >= 0 ? "+" : ""}
            {brl(alloc.total - invested)} sobre {brl(invested)} aplicados
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Proventos em 12 meses: {brl(income12)}</p>
          {valued.some((p) => !p.priced) && (
            <p className="mt-1 text-xs text-muted-foreground">Ativos sem cotação aparecem pelo valor aplicado.</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold">Indicadores (Banco Central)</h2>
          {ind.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {ind.data && !ind.data.ok && <p className="text-sm text-destructive">Indisponível agora.</p>}
          {ind.data?.ok && (
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {ind.data.indicators.map((i) => (
                <li key={i.key}>
                  <span className="block text-xs text-muted-foreground">{i.label}</span>
                  {i.value ?? "—"} <span className="text-xs text-muted-foreground">{i.date}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold">Carteira</h2>
          {valued.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma operação ainda. Peça ao{" "}
              <Link to="/assistente" className="text-primary underline">
                assistente
              </Link>
              : “registre a compra de 10 PETR4 a R$ 38”.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {valued.map((p) => (
                <li key={p.ticker} className="flex justify-between py-2">
                  <span>
                    <b>{p.ticker}</b> · {classLabel(p.assetClass)}
                    <span className="block text-xs text-muted-foreground">
                      {p.quantity} × PM {brl(p.avgPrice)}
                      {p.price != null && ` · atual ${brl(p.price)}`}
                    </span>
                  </span>
                  <span className="text-right">
                    {brl(p.value)}
                    <span className={`block text-xs ${p.pnl >= 0 ? "text-primary" : "text-destructive"}`}>
                      {brl(p.pnl)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {alloc.byClass.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {alloc.byClass.map((c) => `${classLabel(c.assetClass)} ${c.percent}%`).join(" · ")}
            </p>
          )}
          {risks.map((r) => (
            <p key={r} className="mt-1 text-xs text-warning">
              ⚠ {r}
            </p>
          ))}
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold">Simulador de aportes</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {(
              [
                ["initial", "Inicial (R$)"],
                ["monthly", "Mensal (R$)"],
                ["rate", "Taxa (% a.a.)"],
                ["years", "Anos"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="text-xs text-muted-foreground">
                {label}
                <input
                  inputMode="decimal"
                  value={sim[k]}
                  onChange={(e) => setSim({ ...sim, [k]: e.target.value.replace(",", ".") })}
                  className="mt-1 w-full rounded-xl border bg-transparent px-3 py-2 text-sm text-foreground"
                />
              </label>
            ))}
          </div>
          {simResult ? (
            <p className="mt-3 text-sm">
              Saldo final <b>{brl(simResult.finalBalance)}</b> · aportado {brl(simResult.totalInvested)} · juros{" "}
              {brl(simResult.earnings)}
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Preencha valores válidos.</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Análise educativa, não é recomendação de investimento.</p>
        </Card>
      </div>
    </Page>
  );
}
