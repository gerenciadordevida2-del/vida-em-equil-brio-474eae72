import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Page, Card } from "@/components/AppShell";
import { brl } from "@/lib/store";
import { simulate } from "@/lib/invest-metrics";
import { getIndicators } from "@/lib/market.functions";
import { PortfolioReport } from "@/components/PortfolioReport";

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
  const indicatorsFn = useServerFn(getIndicators);
  const ind = useQuery({ queryKey: ["indicators"], queryFn: () => indicatorsFn(), staleTime: 3600_000 });

  const [sim, setSim] = useState({ initial: "1000", monthly: "300", rate: "10", years: "10" });
  const simResult = simulate(+sim.initial, +sim.monthly, +sim.rate, +sim.years);

  return (
    <Page title="Investimentos" subtitle="Carteira e mercado com dados reais">
      <div className="space-y-4">
        <PortfolioReport />

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
