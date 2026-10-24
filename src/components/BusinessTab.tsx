import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Check, Pencil, Plus, Trash2, HandCoins, Package } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { money, roundMoney } from "@/lib/data-validation";
import { ensureReminderFor } from "@/lib/notifications";
import { brl, fmtDate, today, uid, update, useData } from "@/lib/store";
import { changeSaleStatus, deleteSale, saveSale } from "@/lib/commerce";
import { CustomerPicker, CustomersSection, ProductSelect, ProductsSection, SalesCharts, WhatsAppButton } from "@/components/CommerceSections";
import {
  BIZ_CATEGORIES,
  PAYMENT_METHODS,
  addPayment,
  agendaItems,
  type AgendaItem,
  assertStockAvailable,
  businessMetrics,
  dueGroup,
  expensesByCategory,
  stockStatus,
  monthPeriod,
  paidOf,
  remaining,
  saleProfit,
  saleTotal,
  statusOf,
  type BizExpense,
  type BusinessData,
  type DueGroup,
  type Period,
  type Sale,
  type ScheduledPayment,
} from "@/lib/business";

const field =
  "h-12 w-full rounded-xl border bg-input/40 px-3 text-base outline-none focus:border-primary";
const area = "w-full rounded-xl border bg-input/40 p-3 text-base outline-none focus:border-primary";
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

type Section = "painel" | "vendas" | "clientes" | "produtos" | "agenda" | "gastos";

function setBiz(fn: (b: BusinessData) => BusinessData) {
  try {
    update((d) => ({ ...d, business: fn(d.business) }));
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    return false;
  }
}

async function remind(date: string | undefined) {
  if (!date || date < today()) return;
  const granted = await ensureReminderFor(date, today());
  if (granted) toast.message(`Lembrete ativado para ${fmtDate(date)}: você será avisado ao abrir o app nesse dia.`);
  else toast.message("Ative as notificações (sino no topo) para receber o lembrete.");
}

function prevMonth(ym: string) {
  const [y = 0, m = 1] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const cur = today().slice(0, 7);
  const opts: [string, Period][] = [
    ["Mês atual", monthPeriod(cur)],
    ["Mês anterior", monthPeriod(prevMonth(cur))],
  ];
  const isCustom = !opts.some(([, p]) => p.start === value.start && p.end === value.end);
  const [custom, setCustom] = useState(isCustom);
  return (
    <div className="mb-3 space-y-2">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
        {opts.map(([l, p]) => {
          const on = !custom && p.start === value.start && p.end === value.end;
          return (
            <button
              key={l}
              type="button"
              onClick={() => (setCustom(false), onChange(p))}
              className={`rounded-lg py-2 text-xs font-semibold ${on ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {l}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCustom(true)}
          className={`rounded-lg py-2 text-xs font-semibold ${custom ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          Personalizado
        </button>
      </div>
      {custom && (
        <div className="grid grid-cols-2 gap-2">
          <input aria-label="Início" type="date" className={field} value={value.start}
            onChange={(e) => e.target.value && onChange({ ...value, start: e.target.value })} />
          <input aria-label="Fim" type="date" className={field} value={value.end}
            onChange={(e) => e.target.value && onChange({ ...value, end: e.target.value })} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: number; tone?: string; hint?: string | undefined }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${tone ?? ""}`}>{brl(value)}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function Del({ onConfirm, label = "Excluir este registro?" }: { onConfirm: () => void; label?: string }) {
  return (
    <button type="button" aria-label="Excluir" className="text-muted-foreground"
      onClick={() => confirm(label) && onConfirm()}>
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

/* ---------------- Estoque diário de cones ---------------- */

function StockCard() {
  const b = useData().business;
  const day = today();
  const st = stockStatus(b, day);
  const [qty, setQty] = useState(st ? String(st.initial) : "");
  const esgotado = !!st && st.remaining <= 0;

  function save(): void {
    const n = Math.floor(Number(qty.replace(",", ".")));
    if (!(n >= 0) || Number.isNaN(n)) return void toast.error("Informe uma quantidade válida.");
    if (setBiz((bb) => ({ ...bb, stock: { date: day, initial: n } })))
      toast.success("Estoque do dia salvo.");
  }

  const items: [string, number | null, string?][] = [
    ["Estoque inicial", st ? st.initial : null],
    ["Vendidos", st ? st.sold : null],
    ["Restantes em estoque", st ? st.remaining : null, esgotado ? "text-destructive" : "text-success"],
  ];
  return (
    <Card className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Package className="h-4 w-4 text-primary" /> Estoque Hoje
        </h2>
        {esgotado && (
          <span className="rounded-full bg-destructive/15 px-2 py-1 text-xs font-semibold text-destructive">
            Esgotado por hoje
          </span>
        )}
      </div>
      <div className="mb-3 flex gap-2">
        <input
          inputMode="numeric"
          aria-label="Quantidade inicial do dia"
          placeholder="Quantidade inicial do dia (ex: 50)"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className={field}
        />
        <Button type="button" onClick={save} className="h-12 shrink-0 rounded-xl px-5">Salvar</Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {items.map(([label, value, tone]) => (
          <div key={label} className="rounded-xl bg-secondary p-3 text-center">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className={`text-lg font-bold ${tone ?? ""}`}>{value === null ? "—" : value}</p>
          </div>
        ))}
      </div>
      {!st && (
        <p className="mt-2 text-xs text-muted-foreground">
          Defina a quantidade inicial para acompanhar as vendas de hoje.
        </p>
      )}
    </Card>
  );
}

export function BusinessTab() {
  const data = useData();
  const b = data.business;
  const [section, setSection] = useState<Section>("painel");
  const [period, setPeriod] = useState<Period>(monthPeriod(today().slice(0, 7)));
  const m = useMemo(() => businessMetrics(b, period), [b, period]);
  const pie = useMemo(() => expensesByCategory(b, period), [b, period]);

  const sections: [Section, string][] = [
    ["painel", "Painel"],
    ["vendas", "Vendas"],
    ["clientes", "Clientes"],
    ["produtos", "Produtos"],
    ["agenda", "Agendados"],
    ["gastos", "Gastos"],
  ];

  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl border p-1">
        {sections.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setSection(k)}
            className={`rounded-lg py-2 text-xs font-semibold ${section === k ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>
            {l}
          </button>
        ))}
      </div>

      {section === "painel" && (
        <>
          <StockCard />
          <PeriodPicker value={period} onChange={setPeriod} />
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Faturamento</h3>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Stat label={`Total de vendas (${m.salesCount})`} value={m.totalSales} />
            <Stat label="Recebido das vendas" value={m.receivedOfSales} tone="text-success" />
            <Stat label="Vendas pendentes" value={m.pendingOfSales} tone="text-warning" />
            <Stat label="Gastos e custos" value={m.expenses} tone="text-destructive" />
          </div>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Lucro estimado</h3>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Stat label="Lucro bruto" value={m.grossProfit}
              hint={m.salesWithoutCost ? `${m.salesWithoutCost} venda(s) sem custo informado não entram` : undefined} />
            <Stat label="Lucro líquido" value={m.netProfit} tone={m.netProfit < 0 ? "text-destructive" : "text-success"}
              hint="Lucro bruto − gastos − contas agendadas a pagar" />
          </div>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Caixa e pendências</h3>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <Stat label="A receber (total aberto)" value={m.toReceive} tone="text-warning" />
            <Stat label="A pagar (total aberto)" value={m.toPay} tone="text-destructive" />
            <Stat label="Entradas efetivas" value={m.cashIn} tone="text-success" />
            <Stat label="Saídas efetivas" value={m.cashOut} tone="text-destructive" />
          </div>
          <Card className="mb-4">
            <p className="text-xs text-muted-foreground">Saldo comercial no período</p>
            <p className={`text-2xl font-bold ${m.balance < 0 ? "text-destructive" : ""}`}>{brl(m.balance)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Só conta dinheiro efetivamente recebido ou pago. Vendas pendentes não entram.
            </p>
          </Card>
          <SalesCharts b={b} />
          <Card>
            <h2 className="mb-2 font-semibold">Gastos por categoria</h2>
            {pie.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum gasto do negócio neste período. Registre em “Gastos” para ver o gráfico.
              </p>
            ) : (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pie} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="80%" paddingAngle={2}>
                        {pie.map((p, i) => (
                          <Cell key={p.name} fill={COLORS[i % COLORS.length]} stroke="var(--background)" />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number, n: string) => [brl(v), n]}
                        contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--popover-foreground)" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {pie.map((p, i) => (
                    <li key={p.name} className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="flex-1">{p.name}</span>
                      <span className="text-muted-foreground">{(p.percent * 100).toFixed(1)}%</span>
                      <span className="w-24 text-right font-medium">{brl(p.value)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </>
      )}

      {section === "vendas" && <SalesSection sales={b.sales} />}
      {section === "clientes" && <CustomersSection />}
      {section === "produtos" && <ProductsSection />}
      {section === "agenda" && <ScheduleSection items={agendaItems(b)} />}
      {section === "gastos" && <ExpensesSection expenses={b.expenses} />}
    </div>
  );
}

const STATUS_LABEL = { pendente: "Pendente", parcial: "Parcial", pago: "Pago" } as const;
const statusTone = (s: string) =>
  s === "pago" ? "text-success" : s === "parcial" ? "text-warning" : "text-muted-foreground";

function PayDialog({ title, open, max, onClose, onPay }: {
  title: string; open: boolean; max: number; onClose: () => void; onPay: (amount: number, date: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[92vw] rounded-2xl sm:max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e): void => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const amount = roundMoney(money(String(f.get("amount"))));
          if (!(amount > 0)) return void toast.error("Informe um valor válido.");
          onPay(amount, String(f.get("date")) || today());
        }}>
          <p className="text-sm text-muted-foreground">Saldo restante: {brl(max)}</p>
          <input name="amount" inputMode="decimal" defaultValue={String(max).replace(".", ",")} className={field} aria-label="Valor" />
          <input name="date" type="date" defaultValue={today()} className={field} aria-label="Data" />
          <Button type="submit" className="h-12 w-full rounded-xl">Confirmar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Vendas ---------------- */

function SalesSection({ sales }: { sales: Sale[] }) {
  const [editing, setEditing] = useState<Sale | null | "new">(null);
  const [paying, setPaying] = useState<Sale | null>(null);
  const list = [...sales].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <Button onClick={() => setEditing("new")} className="mb-3 h-12 w-full rounded-xl">
        <Plus className="h-5 w-5" /> Registrar venda
      </Button>
      <Card>
        {list.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma venda registrada.</p>}
        <ul className="divide-y">
          {list.map((s) => {
            const total = saleTotal(s);
            const st = statusOf(total, s);
            const pr = saleProfit(s);
            if (s.status)
              return (
                <li key={s.id} className="py-3 opacity-60">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium line-through">{s.product} · {s.quantity}x</p>
                      <p className="text-xs text-muted-foreground">{s.customer} · {fmtDate(s.date)} · {s.status === "cancelada" ? "Cancelada" : "Devolvida"}</p>
                    </div>
                    <span className="font-semibold line-through">{brl(total)}</span>
                  </div>
                </li>
              );
            return (
              <li key={s.id} className="py-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.product} · {s.quantity}x</p>
                    <p className="text-xs text-muted-foreground">{s.customer} · {fmtDate(s.date)} · {s.paymentMethod}</p>
                    <p className={`text-xs ${statusTone(st)}`}>
                      {STATUS_LABEL[st]}{st !== "pago" && ` · falta ${brl(remaining(total, s))}`}
                      {st !== "pago" && s.expectedDate && ` · previsto ${fmtDate(s.expectedDate)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pr ? `Lucro ${brl(pr.profit)} · margem ${(pr.margin * 100).toFixed(1)}%` : "Lucro não calculado (sem custo)"}
                    </p>
                  </div>
                  <span className="font-semibold">{brl(total)}</span>
                </div>
                <div className="mt-2 flex items-center justify-end gap-4">
                  <WhatsAppButton sale={s} />
                  <select aria-label="Cancelar ou devolver" value="" className="bg-transparent text-xs text-muted-foreground"
                    onChange={(e) => {
                      const v = e.target.value as "cancelada" | "devolvida";
                      if (v && confirm(v === "cancelada" ? "Cancelar esta venda? O estoque será devolvido." : "Registrar devolução? O estoque será devolvido."))
                        if (setBiz((b) => changeSaleStatus(b, s.id, v, today()))) toast.success(v === "cancelada" ? "Venda cancelada." : "Devolução registrada.");
                    }}>
                    <option value="">Mais…</option>
                    <option value="cancelada">Cancelar</option>
                    <option value="devolvida">Devolução</option>
                  </select>
                  {st !== "pago" && (
                    <button type="button" className="flex items-center gap-1 text-xs font-semibold text-primary" onClick={() => setPaying(s)}>
                      <HandCoins className="h-4 w-4" /> Receber
                    </button>
                  )}
                  <button type="button" aria-label="Editar" className="text-muted-foreground" onClick={() => setEditing(s)}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <Del label="Excluir esta venda?" onConfirm={() => setBiz((b) => deleteSale(b, s.id, today()))} />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      {editing && <SaleDialog sale={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {paying && (
        <PayDialog title="Registrar recebimento" open max={remaining(saleTotal(paying), paying)}
          onClose={() => setPaying(null)}
          onPay={(amount, date) => {
            const ok = setBiz((b) => ({
              ...b,
              sales: b.sales.map((x) => (x.id === paying.id ? addPayment(x, saleTotal(x), amount, date) : x)),
            }));
            if (ok) setPaying(null);
          }} />
      )}
    </>
  );
}

function SaleDialog({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  const initialStatus = sale ? statusOf(saleTotal(sale), sale) : "pendente";
  const [qty, setQty] = useState(sale ? String(sale.quantity) : "1");
  const [price, setPrice] = useState(sale ? String(sale.unitPrice).replace(".", ",") : "");
  const [cost, setCost] = useState(sale?.unitCost !== undefined ? String(sale.unitCost).replace(".", ",") : "");
  const [disc, setDisc] = useState(sale?.discount ? String(sale.discount).replace(".", ",") : "");
  const [status, setStatus] = useState(initialStatus);
  const [partial, setPartial] = useState(sale && initialStatus === "parcial" ? String(paidOf(sale)).replace(".", ",") : "");
  const [customerId, setCustomerId] = useState<string | undefined>(sale?.customerId);
  const [customerName, setCustomerName] = useState(sale?.customer ?? "");
  const [productId, setProductId] = useState<string | undefined>(sale?.productId);
  const [productName, setProductName] = useState(sale?.product ?? "");

  const q = Number(qty.replace(",", "."));
  const preview = {
    quantity: q > 0 ? q : 0,
    unitPrice: money(price) || 0,
    discount: disc.trim() ? money(disc) || 0 : 0,
  };
  const total = saleTotal(preview);
  const costN = cost.trim() ? money(cost) : undefined;
  const profit = costN !== undefined && !Number.isNaN(costN) ? roundMoney(total - preview.quantity * costN) : null;

  function submit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const customer = customerName.trim();
    const product = productName.trim();
    const date = String(f.get("date"));
    const unitPrice = roundMoney(money(price));
    const discount = disc.trim() ? roundMoney(money(disc)) : 0;
    const unitCost = cost.trim() ? roundMoney(money(cost)) : undefined;
    if (!customer || !product || !date) return void toast.error("Preencha cliente, produto e data.");
    if (!(q > 0) || !(unitPrice >= 0) || !(discount >= 0) || (unitCost !== undefined && !(unitCost >= 0)))
      return void toast.error("Confira quantidade, valores e desconto.");
    const t = saleTotal({ quantity: q, unitPrice, discount });
    if (!(t > 0)) return void toast.error("O total da venda precisa ser maior que zero.");
    let payments = sale?.payments ?? [];
    const want = status === "pago" ? t : status === "pendente" ? 0 : roundMoney(money(partial));
    if (status === "parcial" && !(want > 0 && want < t)) return void toast.error("Valor recebido parcial deve ser maior que zero e menor que o total.");
    if (roundMoney(paidOf({ payments })) !== want)
      payments = want > 0 ? [{ date: payments[0]?.date ?? date, amount: want }] : [];
    const next: Sale = {
      id: sale?.id ?? uid(),
      customer, product, quantity: q, unitPrice, discount, date,
      ...(customerId ? { customerId } : {}),
      ...(productId ? { productId } : {}),
      paymentMethod: String(f.get("method")),
      payments,
      ...(unitCost !== undefined ? { unitCost } : {}),
      ...(f.get("expected") ? { expectedDate: String(f.get("expected")) } : {}),
      ...(String(f.get("notes")).trim() ? { notes: String(f.get("notes")).trim() } : {}),
    };
    const ok = setBiz((b) => {
      if (!sale && date === today() && !productId) assertStockAvailable(b, date, q);
      return saveSale(b, next, today());
    });
    if (ok) {
      const linked = status !== "pago" && next.expectedDate;
      toast.success(
        (sale ? "Venda atualizada." : "Venda registrada.") + (linked ? " Também aparece em Agendados." : ""),
      );
      if (linked) void remind(next.expectedDate);
      onClose();
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[92vw] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader><DialogTitle>{sale ? "Editar venda" : "Registrar venda"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <CustomerPicker value={customerId} onChange={(c) => { setCustomerId(c.id); setCustomerName(c.name); }} />
          {!customerId && (
            <input placeholder="Ou digite só o nome (sem cadastro)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={field} aria-label="Nome do cliente sem cadastro" />
          )}
          <ProductSelect value={productId} onChange={(p) => {
            setProductId(p?.id);
            if (p) {
              setProductName(p.name);
              setPrice(String(p.price).replace(".", ","));
              setCost(p.cost !== undefined ? String(p.cost).replace(".", ",") : "");
            }
          }} />
          <input placeholder="Produto ou serviço" value={productName} onChange={(e) => setProductName(e.target.value)} readOnly={!!productId} className={field} aria-label="Produto" />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">Quantidade
              <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className={field} /></label>
            <label className="text-xs text-muted-foreground">Valor unitário (R$)
              <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={field} /></label>
            <label className="text-xs text-muted-foreground">Custo unitário (opcional)
              <input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} className={field} /></label>
            <label className="text-xs text-muted-foreground">Desconto (R$)
              <input inputMode="decimal" value={disc} onChange={(e) => setDisc(e.target.value)} className={field} /></label>
          </div>
          <div className="rounded-xl bg-secondary p-3 text-sm">
            <p>Total: <strong>{brl(total)}</strong></p>
            <p className="text-muted-foreground">
              {profit === null ? "Informe o custo para calcular o lucro." :
                `Lucro estimado: ${brl(profit)}${total > 0 ? ` · margem ${((profit / total) * 100).toFixed(1)}%` : ""}`}
            </p>
          </div>
          <label className="block text-xs text-muted-foreground">Data da venda
            <input name="date" type="date" defaultValue={sale?.date ?? today()} className={field} /></label>
          <select name="method" defaultValue={sale?.paymentMethod ?? "Pix"} className={field} aria-label="Forma de pagamento">
            {PAYMENT_METHODS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={field} aria-label="Status">
            <option value="pendente">Pendente</option>
            <option value="parcial">Parcialmente recebido</option>
            <option value="pago">Pago</option>
          </select>
          {status === "parcial" && (
            <input inputMode="decimal" placeholder="Valor já recebido (R$)" value={partial} onChange={(e) => setPartial(e.target.value)} className={field} />
          )}
          <label className="block text-xs text-muted-foreground">Previsão de recebimento (opcional)
            <input name="expected" type="date" defaultValue={sale?.expectedDate} className={field} /></label>
          <textarea name="notes" placeholder="Observações (opcional)" defaultValue={sale?.notes} className={area} rows={2} />
          <Button type="submit" className="h-12 w-full rounded-xl">Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Pagamentos agendados ---------------- */

const GROUPS: [DueGroup, string][] = [
  ["atraso", "Em atraso"],
  ["hoje", "Vencendo hoje"],
  ["proximos", "Próximos vencimentos"],
  ["quitados", "Pagos ou recebidos"],
];

function ScheduleSection({ items }: { items: AgendaItem[] }) {
  const [editing, setEditing] = useState<ScheduledPayment | null | "new">(null);
  const [paying, setPaying] = useState<AgendaItem | null>(null);
  const t = today();
  const sorted = [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return (
    <>
      <Button onClick={() => setEditing("new")} className="mb-2 h-12 w-full rounded-xl">
        <Plus className="h-5 w-5" /> Agendar pagamento ou recebimento
      </Button>
      <p className="mb-3 text-xs text-muted-foreground">
        A data prevista não movimenta o caixa. O valor só entra no saldo quando você confirmar o pagamento ou recebimento.
        Não registre a mesma conta aqui e também em “Gastos”.
      </p>
      {items.length === 0 && <Card><p className="text-sm text-muted-foreground">Nada agendado.</p></Card>}
      {GROUPS.map(([g, label]) => {
        const list = sorted.filter((s) => dueGroup(s, t) === g);
        if (!list.length) return null;
        return (
          <Card key={g} className={`mb-3 ${g === "atraso" ? "border-destructive" : ""}`}>
            <h3 className={`mb-1 text-sm font-semibold ${g === "atraso" ? "text-destructive" : ""}`}>{label}</h3>
            <ul className="divide-y">
              {list.map((s) => {
                const st = statusOf(s.amount, s);
                const done = s.kind === "receber" ? "Recebido" : "Pago";
                return (
                  <li key={s.id} className="py-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          <span className={s.kind === "receber" ? "text-success" : "text-destructive"}>
                            {s.kind === "receber" ? "A receber" : "A pagar"}
                          </span>{" "}· {s.party}
                        </p>
                        <p className="text-xs text-muted-foreground">{s.item} · {fmtDate(s.dueDate)}</p>
                        <p className={`text-xs ${statusTone(st)}`}>
                          {st === "pago" ? done : st === "parcial" ? `Parcial · falta ${brl(remaining(s.amount, s))}` : "Pendente"}
                        </p>
                      </div>
                      <span className="font-semibold">{brl(s.amount)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-4">
                      {st !== "pago" && (
                        <button type="button" className="flex items-center gap-1 text-xs font-semibold text-primary" onClick={() => setPaying(s)}>
                          <Check className="h-4 w-4" /> Marcar {done.toLowerCase()}
                        </button>
                      )}
                      {s.saleId ? (
                        <span className="text-[11px] text-muted-foreground">Da venda · edite em Vendas</span>
                      ) : (
                        <>
                          <button type="button" aria-label="Editar" className="text-muted-foreground" onClick={() => setEditing(s)}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <Del onConfirm={() => setBiz((b) => ({ ...b, scheduled: b.scheduled.filter((x) => x.id !== s.id) }))} />
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
      {editing && <ScheduleDialog item={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {paying && (
        <PayDialog title={paying.kind === "receber" ? "Confirmar recebimento" : "Confirmar pagamento"} open
          max={remaining(paying.amount, paying)} onClose={() => setPaying(null)}
          onPay={(amount, date) => {
            const ok = setBiz((b) =>
              paying.saleId
                ? { ...b, sales: b.sales.map((x) => (x.id === paying.saleId ? addPayment(x, saleTotal(x), amount, date) : x)) }
                : { ...b, scheduled: b.scheduled.map((x) => (x.id === paying.id ? addPayment(x, x.amount, amount, date) : x)) },
            );
            if (ok) setPaying(null);
          }} />
      )}
    </>
  );
}

function ScheduleDialog({ item, onClose }: { item: ScheduledPayment | null; onClose: () => void }) {
  const [kind, setKind] = useState<ScheduledPayment["kind"]>(item?.kind ?? "receber");
  const initial = item ? statusOf(item.amount, item) : "pendente";
  const [status, setStatus] = useState(initial);
  function submit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const party = String(f.get("party")).trim();
    const what = String(f.get("item")).trim();
    const amount = roundMoney(money(String(f.get("amount"))));
    const dueDate = String(f.get("due"));
    if (!party || !what || !dueDate || !(amount > 0)) return void toast.error("Preencha todos os campos obrigatórios.");
    let payments = item?.payments ?? [];
    const paid = roundMoney(paidOf({ payments }));
    if (paid > amount) return void toast.error("O valor não pode ser menor do que o já quitado.");
    if (status === "pago" && paid < amount)
      payments = [...payments, { date: today(), amount: roundMoney(amount - paid) }];
    if (status === "pendente") payments = [];
    const notes = String(f.get("notes")).trim();
    const next: ScheduledPayment = {
      id: item?.id ?? uid(), kind, party, item: what, amount, dueDate, payments,
      ...(notes ? { notes } : {}),
    };
    const ok = setBiz((b) => ({
      ...b,
      scheduled: item ? b.scheduled.map((x) => (x.id === item.id ? next : x)) : [...b.scheduled, next],
    }));
    if (ok) {
      if (status !== "pago") void remind(dueDate);
      onClose();
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[92vw] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader><DialogTitle>{item ? "Editar agendamento" : "Novo agendamento"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
            {(["receber", "pagar"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)}
                className={`rounded-lg py-2 text-sm font-semibold ${kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {k === "receber" ? "A receber" : "A pagar"}
              </button>
            ))}
          </div>
          <input name="party" placeholder="Pessoa, cliente ou empresa" defaultValue={item?.party} className={field} />
          <input name="item" placeholder="O que foi comprado, vendido ou contratado" defaultValue={item?.item} className={field} />
          <input name="amount" inputMode="decimal" placeholder="Valor (R$)" defaultValue={item ? String(item.amount).replace(".", ",") : ""} className={field} />
          <label className="block text-xs text-muted-foreground">Data prevista
            <input name="due" type="date" defaultValue={item?.dueDate ?? today()} className={field} /></label>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={field} aria-label="Status">
            <option value="pendente">Pendente</option>
            {initial === "parcial" && <option value="parcial">Parcial (manter valores já quitados)</option>}
            <option value="pago">{kind === "receber" ? "Recebido" : "Pago"}</option>
          </select>
          <textarea name="notes" placeholder="Observações (opcional)" defaultValue={item?.notes} className={area} rows={2} />
          <Button type="submit" className="h-12 w-full rounded-xl">Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Gastos ---------------- */

function ExpensesSection({ expenses }: { expenses: BizExpense[] }) {
  const [editing, setEditing] = useState<BizExpense | null | "new">(null);
  const [cat, setCat] = useState("todas");
  const [st, setSt] = useState("todos");
  const list = [...expenses]
    .filter((e) => (cat === "todas" || e.category === cat) && (st === "todos" || (st === "pago") === e.paid))
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <Button onClick={() => setEditing("new")} className="mb-3 h-12 w-full rounded-xl">
        <Plus className="h-5 w-5" /> Registrar gasto do negócio
      </Button>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <select value={cat} onChange={(e) => setCat(e.target.value)} className={field} aria-label="Filtrar categoria">
          <option value="todas">Todas categorias</option>
          {BIZ_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={st} onChange={(e) => setSt(e.target.value)} className={field} aria-label="Filtrar status">
          <option value="todos">Todos</option>
          <option value="pago">Pagos</option>
          <option value="pendente">Pendentes</option>
        </select>
      </div>
      <Card>
        {list.length === 0 && <p className="text-sm text-muted-foreground">Nenhum gasto encontrado.</p>}
        <ul className="divide-y">
          {list.map((e) => {
            const late = !e.paid && e.dueDate && e.dueDate < today();
            return (
              <li key={e.id} className="flex items-center gap-2 py-3">
                <button type="button" aria-label={e.paid ? "Marcar como pendente" : "Marcar como pago"}
                  onClick={() => setBiz((b) => ({
                    ...b,
                    expenses: b.expenses.map((x) => x.id === e.id
                      ? (x.paid ? (({ paidDate: _p, ...rest }) => ({ ...rest, paid: false }))(x) : { ...x, paid: true, paidDate: today() })
                      : x),
                  }))}
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${e.paid ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}>
                  {e.paid && <Check className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.description}</p>
                  <p className={`text-xs ${late ? "text-destructive" : "text-muted-foreground"}`}>
                    {e.category} · {fmtDate(e.date)}
                    {!e.paid && (e.dueDate ? ` · ${late ? "atrasado" : "vence"} ${fmtDate(e.dueDate)}` : " · pendente")}
                  </p>
                </div>
                <span className="font-semibold text-destructive">{brl(e.amount)}</span>
                <button type="button" aria-label="Editar" className="text-muted-foreground" onClick={() => setEditing(e)}>
                  <Pencil className="h-4 w-4" />
                </button>
                <Del onConfirm={() => setBiz((b) => ({ ...b, expenses: b.expenses.filter((x) => x.id !== e.id) }))} />
              </li>
            );
          })}
        </ul>
      </Card>
      <p className="mt-2 text-xs text-muted-foreground">Gastos do negócio ficam separados das suas finanças pessoais.</p>
      {editing && <ExpenseDialog expense={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function ExpenseDialog({ expense, onClose }: { expense: BizExpense | null; onClose: () => void }) {
  const [paid, setPaid] = useState(expense?.paid ?? true);
  function submit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const description = String(f.get("description")).trim();
    const amount = roundMoney(money(String(f.get("amount"))));
    const date = String(f.get("date"));
    if (!description || !date || !(amount > 0)) return void toast.error("Preencha descrição, valor e data.");
    const due = String(f.get("due") ?? "");
    const notes = String(f.get("notes")).trim();
    const method = String(f.get("method"));
    const next: BizExpense = {
      id: expense?.id ?? uid(), description, amount, date,
      category: String(f.get("category")), paid,
      ...(paid ? { paidDate: expense?.paid ? (expense.paidDate ?? date) : date } : {}),
      ...(method ? { paymentMethod: method } : {}),
      ...(!paid && due ? { dueDate: due } : {}),
      ...(notes ? { notes } : {}),
    };
    const ok = setBiz((b) => ({
      ...b,
      expenses: expense ? b.expenses.map((x) => (x.id === expense.id ? next : x)) : [...b.expenses, next],
    }));
    if (ok) onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[92vw] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader><DialogTitle>{expense ? "Editar gasto" : "Novo gasto do negócio"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <input name="description" placeholder="Descrição" defaultValue={expense?.description} className={field} />
          <select name="category" defaultValue={expense?.category ?? BIZ_CATEGORIES[0]} className={field} aria-label="Categoria">
            {BIZ_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input name="amount" inputMode="decimal" placeholder="Valor (R$)" defaultValue={expense ? String(expense.amount).replace(".", ",") : ""} className={field} />
          <label className="block text-xs text-muted-foreground">Data
            <input name="date" type="date" defaultValue={expense?.date ?? today()} className={field} /></label>
          <select name="method" defaultValue={expense?.paymentMethod ?? ""} className={field} aria-label="Forma de pagamento">
            <option value="">Forma de pagamento (opcional)</option>
            {PAYMENT_METHODS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
            {[true, false].map((v) => (
              <button key={String(v)} type="button" onClick={() => setPaid(v)}
                className={`rounded-lg py-2 text-sm font-semibold ${paid === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {v ? "Pago" : "Pendente"}
              </button>
            ))}
          </div>
          {!paid && (
            <label className="block text-xs text-muted-foreground">Vencimento (opcional)
              <input name="due" type="date" defaultValue={expense?.dueDate} className={field} /></label>
          )}
          <textarea name="notes" placeholder="Observações (opcional)" defaultValue={expense?.notes} className={area} rows={2} />
          <Button type="submit" className="h-12 w-full rounded-xl">Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
