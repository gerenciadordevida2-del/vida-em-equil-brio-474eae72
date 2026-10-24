import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/AppShell";
import { brl, useData } from "@/lib/store";
import { businessMetrics, monthPeriod, type Period } from "@/lib/business";
import {
  accountSummary,
  expenseComposition,
  goalProgress,
  monthlyBalance,
} from "@/lib/charts";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function prevMonth(ym: string) {
  const [y = 0, m = 1] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function MonthPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const cur = new Date().toISOString().slice(0, 7);
  const opts: [string, Period][] = [
    ["Mês atual", monthPeriod(cur)],
    ["Mês anterior", monthPeriod(prevMonth(cur))],
  ];
  return (
    <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
      {opts.map(([l, p]) => {
        const on = p.start === value.start && p.end === value.end;
        return (
          <button
            key={l}
            type="button"
            onClick={() => onChange(p)}
            className={`rounded-lg py-2 text-xs font-semibold ${on ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: string; hint?: string | undefined }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${tone ?? ""}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <Card className="p-4 text-center text-sm text-muted-foreground">{children}</Card>
  );
}

export function ChartsTab() {
  const data = useData();
  const [period, setPeriod] = useState<Period>(() => monthPeriod(new Date().toISOString().slice(0, 7)));

  const balance = useMemo(() => monthlyBalance(data.transactions, period), [data.transactions, period]);
  const goals = useMemo(() => goalProgress(data.financeGoals), [data.financeGoals]);
  const biz = useMemo(() => businessMetrics(data.business, period), [data.business, period]);
  const composition = useMemo(() => expenseComposition(data.transactions, period), [data.transactions, period]);
  const summary = useMemo(() => accountSummary(data, period), [data, period]);

  const balanceBars = [
    { name: "Entradas", valor: balance.income },
    { name: "Despesas", valor: balance.expenses },
  ];
  const bizBars = [
    { name: "Faturamento", valor: biz.totalSales },
    { name: "Recebido", valor: biz.receivedOfSales },
    { name: "Pendente", valor: biz.pendingOfSales },
    { name: "Despesas", valor: biz.expenses },
    { name: "Lucro líquido", valor: biz.salesWithoutCost === 0 && biz.salesCount > 0 ? biz.netProfit : 0 },
  ];
  const periodLabel = `${period.start.split("-").reverse().slice(1).join("/")}`;

  return (
    <div className="space-y-6">
      <MonthPicker value={period} onChange={setPeriod} />

      {/* A. Balanço mensal */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Balanço mensal</h2>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Entradas recebidas" value={brl(balance.income)} tone="text-emerald-500" />
          <Stat label="Despesas" value={brl(balance.expenses)} tone="text-red-400" />
          <Stat label="Salário" value={brl(balance.salaryIncome)} />
          <Stat label="Outras receitas" value={brl(balance.otherIncome)} />
          <Stat
            label="Saldo líquido do mês"
            value={brl(balance.net)}
            tone={balance.net >= 0 ? "text-emerald-500" : "text-red-400"}
          />
          <Stat
            label="Renda comprometida"
            value={balance.committedPct === null ? "—" : `${Math.round(balance.committedPct * 100)}%`}
            hint={balance.committedPct === null ? "Sem receitas no período" : undefined}
          />
        </div>
        {balance.income === 0 && balance.expenses === 0 ? (
          <Empty>Nenhum lançamento neste período. Registre receitas e despesas na aba Lançamentos.</Empty>
        ) : (
          <Card className="p-3">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={balanceBars}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.6} />
                <YAxis hide />
                <Tooltip formatter={(v) => brl(Number(v))} />
                <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                  <Cell fill="var(--chart-2)" />
                  <Cell fill="var(--chart-5)" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </section>

      {/* B. Progresso das metas financeiras */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Metas financeiras</h2>
        {goals.length === 0 ? (
          <Empty>Nenhuma meta financeira cadastrada. Crie uma na aba Metas.</Empty>
        ) : (
          goals.map((g) => (
            <Card key={g.id} className="space-y-1 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">{g.name}</p>
                <p className="text-xs text-muted-foreground">
                  {g.pct === null ? "sem valor-alvo" : `${Math.round(g.pct * 100)}%`}
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary" style={{ width: `${g.barPct * 100}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                Guardado {brl(g.current)} de {brl(g.target)}
                {g.pct !== null && g.pct > 1
                  ? ` · meta superada em ${brl(g.current - g.target)}`
                  : ` · faltam ${brl(g.remaining)}`}
              </p>
            </Card>
          ))
        )}
      </section>

      {/* C. Desempenho de negócios */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Desempenho do negócio</h2>
        {biz.salesCount === 0 && biz.expenses === 0 ? (
          <Empty>Nenhuma venda ou gasto do negócio neste período. Registre na aba Negócio.</Empty>
        ) : (
          <>
            <Card className="p-3">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={bizBars}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.6} interval={0} />
                  <YAxis hide />
                  <Tooltip formatter={(v) => brl(Number(v))} />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                    {bizBars.map((b, i) => (
                      <Cell key={b.name} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            {biz.salesWithoutCost > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Lucro não exibido: {biz.salesWithoutCost} venda(s) sem custo informado — informe o custo na aba Negócio para calcular.
              </p>
            )}
          </>
        )}
      </section>

      {/* D. Composição financeira */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Composição financeira</h2>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Saldo acumulado" value={brl(summary.balance)} tone={summary.balance >= 0 ? "text-emerald-500" : "text-red-400"} />
          <Stat label="Dívidas pendentes" value={brl(summary.debtsOpen)} />
          <Stat label={`Despesas de ${periodLabel}`} value={brl(summary.periodExpenses)} />
        </div>
        {composition.length === 0 ? (
          <Empty>Nenhuma despesa categorizada neste período.</Empty>
        ) : (
          <Card className="p-3">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={composition} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {composition.map((s, i) => (
                    <Cell key={s.name} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => brl(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="mt-2 space-y-1">
              {composition.map((s, i) => (
                <li key={s.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="flex-1">{s.name}</span>
                  <span className="font-semibold">{brl(s.value)}</span>
                  <span className="text-muted-foreground">{Math.round(s.percent * 100)}%</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
