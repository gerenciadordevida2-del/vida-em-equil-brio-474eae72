import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Archive, ArchiveRestore, MessageCircle, Pencil, Plus, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { money, roundMoney } from "@/lib/data-validation";
import { brl, fmtDate, today, uid, update, useData } from "@/lib/store";
import { remaining, saleTotal, type BusinessData, type Customer, type Product, type Sale } from "@/lib/business";
import {
  customerSummary, lowStock, normName, reminderMessage, revenueSeries, topProducts,
  upsertCustomer, upsertProduct, whatsappLink,
} from "@/lib/commerce";

export const field =
  "h-12 w-full rounded-xl border bg-input/40 px-3 text-base outline-none focus:border-primary";
const tip = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--popover-foreground)" };

export function setBiz(fn: (b: BusinessData) => BusinessData) {
  try {
    update((d) => ({ ...d, business: fn(d.business) }));
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    return false;
  }
}

/* ---------- WhatsApp ---------- */

export function WhatsAppButton({ sale }: { sale: Sale }) {
  const data = useData();
  const cust = (data.business.customers ?? []).find((c) => c.id === sale.customerId);
  const open = remaining(saleTotal(sale), sale);
  if (sale.status || open <= 0) return null;
  const sentToday = (data.business.reminders ?? []).some((r) => r.saleId === sale.id && r.sentAt === today());
  const link = whatsappLink(
    cust?.phone,
    reminderMessage(sale.customer, sale.product, brl(open), sale.expectedDate ? fmtDate(sale.expectedDate) : undefined),
  );
  return (
    <button
      type="button"
      className="flex items-center gap-1 text-xs font-semibold text-success disabled:opacity-50"
      onClick={() => {
        if (!link) return void toast.error("Cadastre o telefone do cliente para lembrar pelo WhatsApp.");
        if (sentToday && !confirm("Você já abriu um lembrete desta venda hoje. Abrir de novo?")) return;
        window.open(link, "_blank", "noopener");
        if (!sentToday)
          setBiz((b) => ({
            ...b,
            reminders: [...(b.reminders ?? []), { id: uid(), saleId: sale.id, dueDate: sale.expectedDate ?? "", sentAt: today(), channel: "whatsapp-manual" }],
          }));
      }}
    >
      <MessageCircle className="h-4 w-4" /> {sentToday ? "Lembrado hoje" : "WhatsApp"}
    </button>
  );
}

/* ---------- Seletores usados na venda ---------- */

export function CustomerPicker({ value, onChange }: { value: string | undefined; onChange: (c: Customer) => void }) {
  const data = useData();
  const all = (data.business.customers ?? []).filter((c) => !c.archived);
  const selected = all.find((c) => c.id === value);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [phone, setPhone] = useState("");
  const matches = q.trim()
    ? all.filter((c) => normName(c.name).includes(normName(q)) || (c.phone ?? "").includes(q.trim())).slice(0, 6)
    : [];

  if (selected && !creating && !q)
    return (
      <div className="flex items-center justify-between rounded-xl border bg-secondary p-3 text-sm">
        <span><strong>{selected.name}</strong>{selected.phone ? ` · ${selected.phone}` : ""}</span>
        <button type="button" className="text-xs font-semibold text-primary" onClick={() => setQ(" ")}>Trocar</button>
      </div>
    );

  if (creating)
    return (
      <div className="space-y-2 rounded-xl border p-3">
        <p className="text-xs font-semibold">Novo cliente</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome" className={field} aria-label="Nome do novo cliente" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="WhatsApp com DDD (opcional)" inputMode="tel" className={field} aria-label="Telefone do novo cliente" />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => setCreating(false)}>Voltar</Button>
          <Button type="button" className="flex-1" onClick={() => {
            const c: Customer = { id: uid(), name: q.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}), createdAt: today() };
            if (setBiz((b) => upsertCustomer(b, c))) {
              onChange(c);
              setCreating(false);
              setQ("");
              setPhone("");
              toast.success("Cliente cadastrado.");
            }
          }}>Cadastrar</Button>
        </div>
      </div>
    );

  return (
    <div className="space-y-1">
      <div className="relative">
        <Search className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
        <input value={q.trimStart()} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente por nome ou telefone" className={`${field} pl-10`} aria-label="Cliente" />
      </div>
      {matches.map((c) => (
        <button key={c.id} type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary"
          onClick={() => { onChange(c); setQ(""); }}>
          {c.name} <span className="text-muted-foreground">{c.phone}</span>
        </button>
      ))}
      <button type="button" className="flex items-center gap-1 px-1 py-1 text-xs font-semibold text-primary" onClick={() => setCreating(true)}>
        <UserPlus className="h-4 w-4" /> Cadastrar novo cliente{q.trim() ? ` “${q.trim()}”` : ""}
      </button>
    </div>
  );
}

export function ProductSelect({ value, onChange }: { value: string | undefined; onChange: (p: Product | null) => void }) {
  const data = useData();
  const all = (data.business.products ?? []).filter((p) => !p.archived || p.id === value);
  return (
    <select value={value ?? ""} className={field} aria-label="Produto cadastrado"
      onChange={(e) => onChange(all.find((p) => p.id === e.target.value) ?? null)}>
      <option value="">Produto avulso (sem estoque)</option>
      {all.map((p) => <option key={p.id} value={p.id}>{p.name} · {brl(p.price)} · estoque {p.quantity}</option>)}
    </select>
  );
}

/* ---------- Clientes ---------- */

export function CustomersSection() {
  const data = useData();
  const b = data.business;
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);
  const list = (b.customers ?? [])
    .filter((c) => !!c.archived === showArchived)
    .filter((c) => !q.trim() || normName(c.name).includes(normName(q)) || (c.phone ?? "").includes(q.trim()))
    .sort((x, y) => x.name.localeCompare(y.name));
  return (
    <>
      <Button onClick={() => setEditing("new")} className="mb-3 h-12 w-full rounded-xl"><Plus className="h-5 w-5" /> Novo cliente</Button>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar clientes" className={`${field} mb-2`} aria-label="Pesquisar clientes" />
      <label className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Mostrar arquivados
      </label>
      <Card>
        {list.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>}
        <ul className="divide-y">
          {list.map((c) => {
            const s = customerSummary(b, c.id);
            return (
              <li key={c.id} className="flex items-center gap-2 py-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setViewing(c)}>
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.phone || "sem telefone"} · {s.sales.length} compra(s)</p>
                  {s.pending > 0 && <p className="text-xs text-warning">Deve {brl(s.pending)}</p>}
                </button>
                <button type="button" aria-label="Editar" className="text-muted-foreground" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></button>
                <button type="button" aria-label={c.archived ? "Reativar" : "Arquivar"} className="text-muted-foreground"
                  onClick={() => setBiz((bb) => ({ ...bb, customers: (bb.customers ?? []).map((x) => (x.id === c.id ? { ...x, archived: !c.archived } : x)) }))}>
                  {c.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
      {editing && <CustomerDialog customer={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {viewing && <CustomerHistory customer={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function CustomerDialog({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[92vw] rounded-2xl sm:max-w-md">
        <DialogHeader><DialogTitle>{customer ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const phone = String(f.get("phone")).trim();
          const notes = String(f.get("notes")).trim();
          const next: Customer = {
            id: customer?.id ?? uid(), createdAt: customer?.createdAt ?? today(), name: String(f.get("name")).trim(),
            ...(phone ? { phone } : {}), ...(notes ? { notes } : {}), ...(customer?.archived ? { archived: true } : {}),
          };
          if (setBiz((b) => upsertCustomer(b, next))) { toast.success("Cliente salvo."); onClose(); }
        }}>
          <input name="name" placeholder="Nome" defaultValue={customer?.name} className={field} />
          <input name="phone" placeholder="WhatsApp com DDD" inputMode="tel" defaultValue={customer?.phone} className={field} />
          <input name="notes" placeholder="Observações" defaultValue={customer?.notes} className={field} />
          <Button type="submit" className="h-12 w-full rounded-xl">Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CustomerHistory({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const data = useData();
  const s = customerSummary(data.business, customer.id);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[92vw] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader><DialogTitle>{customer.name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-secondary p-2">Comprado<br /><strong className="text-sm">{brl(s.total)}</strong></div>
          <div className="rounded-xl bg-secondary p-2">Pago<br /><strong className="text-sm text-success">{brl(s.paid)}</strong></div>
          <div className="rounded-xl bg-secondary p-2">Em aberto<br /><strong className="text-sm text-warning">{brl(s.pending)}</strong></div>
        </div>
        {s.nextDue && <p className="text-xs text-muted-foreground">Próximo vencimento: {fmtDate(s.nextDue)}</p>}
        <h3 className="mt-2 text-xs font-semibold uppercase text-muted-foreground">Compras</h3>
        <ul className="divide-y text-sm">
          {s.sales.length === 0 && <li className="py-2 text-muted-foreground">Nenhuma compra vinculada.</li>}
          {s.sales.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                {x.product} · {x.quantity}x · {fmtDate(x.date)}
                {x.status ? <span className="text-destructive"> · {x.status}</span> :
                  remaining(saleTotal(x), x) > 0 && <span className="text-warning"> · falta {brl(remaining(saleTotal(x), x))}</span>}
              </span>
              <span className="flex items-center gap-2"><strong>{brl(saleTotal(x))}</strong><WhatsAppButton sale={x} /></span>
            </li>
          ))}
        </ul>
        <h3 className="mt-2 text-xs font-semibold uppercase text-muted-foreground">Pagamentos</h3>
        <ul className="divide-y text-sm">
          {s.payments.length === 0 && <li className="py-2 text-muted-foreground">Nenhum pagamento.</li>}
          {s.payments.map((p, i) => (
            <li key={`${p.saleId}-${i}`} className="flex justify-between py-2"><span>{fmtDate(p.date)} · {p.product}</span><span>{brl(p.amount)}</span></li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Produtos ---------- */

export function ProductsSection() {
  const data = useData();
  const b = data.business;
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const low = lowStock(b);
  const list = (b.products ?? [])
    .filter((p) => !!p.archived === showArchived && (!q.trim() || normName(p.name).includes(normName(q))))
    .sort((x, y) => x.name.localeCompare(y.name));
  return (
    <>
      <Button onClick={() => setEditing("new")} className="mb-3 h-12 w-full rounded-xl"><Plus className="h-5 w-5" /> Novo produto</Button>
      {low.length > 0 && (
        <p className="mb-2 rounded-xl border border-warning/40 p-3 text-xs text-warning">
          Estoque baixo: {low.map((p) => `${p.name} (${p.quantity})`).join(", ")}
        </p>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar produtos" className={`${field} mb-2`} aria-label="Pesquisar produtos" />
      <label className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Mostrar arquivados
      </label>
      <Card>
        {list.length === 0 && <p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>}
        <ul className="divide-y">
          {list.map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {brl(p.price)}{p.cost !== undefined ? ` · custo ${brl(p.cost)}` : ""} · mín. {p.minStock}
                </p>
              </div>
              <span className={`text-sm font-semibold ${p.quantity <= p.minStock ? "text-warning" : ""}`}>{p.quantity} un.</span>
              <button type="button" aria-label="Editar" className="text-muted-foreground" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></button>
              <button type="button" aria-label={p.archived ? "Reativar" : "Arquivar"} className="text-muted-foreground"
                onClick={() => setBiz((bb) => ({ ...bb, products: (bb.products ?? []).map((x) => (x.id === p.id ? { ...x, archived: !p.archived } : x)) }))}>
                {p.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {editing && <ProductDialog product={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function ProductDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const fmt = (n: number | undefined) => (n === undefined ? "" : String(n).replace(".", ","));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[92vw] rounded-2xl sm:max-w-md">
        <DialogHeader><DialogTitle>{product ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const costS = String(f.get("cost")).trim();
          const quantity = Number(String(f.get("quantity")).replace(",", "."));
          const minStock = Number(String(f.get("min")).replace(",", ".") || "0");
          const price = roundMoney(money(String(f.get("price"))));
          if (!Number.isFinite(quantity) || !Number.isFinite(price)) return void toast.error("Confira preço e quantidade.");
          const next: Product = {
            id: product?.id ?? uid(), createdAt: product?.createdAt ?? today(), name: String(f.get("name")).trim(),
            price, quantity, minStock, ...(costS ? { cost: roundMoney(money(costS)) } : {}),
            ...(product?.archived ? { archived: true } : {}),
          };
          if (setBiz((b) => upsertProduct(b, next))) { toast.success("Produto salvo."); onClose(); }
        }}>
          <input name="name" placeholder="Nome do produto" defaultValue={product?.name} className={field} />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">Preço (R$)<input name="price" inputMode="decimal" defaultValue={fmt(product?.price)} className={field} /></label>
            <label className="text-xs text-muted-foreground">Custo (R$, opcional)<input name="cost" inputMode="decimal" defaultValue={fmt(product?.cost)} className={field} /></label>
            <label className="text-xs text-muted-foreground">Quantidade em estoque<input name="quantity" inputMode="numeric" defaultValue={product?.quantity ?? 0} className={field} /></label>
            <label className="text-xs text-muted-foreground">Estoque mínimo<input name="min" inputMode="numeric" defaultValue={product?.minStock ?? 0} className={field} /></label>
          </div>
          <Button type="submit" className="h-12 w-full rounded-xl">Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Gráficos de vendas ---------- */

export function SalesCharts({ b }: { b: BusinessData }) {
  const t = today();
  const series = useMemo(() => revenueSeries(b, t, 14), [b, t]);
  const top = useMemo(() => topProducts(b, t.slice(0, 7)), [b, t]);
  const hasData = series.some((p) => p.faturamento > 0 || p.recebido > 0);
  return (
    <>
      <Card className="mb-4">
        <h2 className="mb-2 font-semibold">Faturamento x recebido (14 dias)</h2>
        {!hasData ? <p className="text-sm text-muted-foreground">Sem vendas nos últimos 14 dias.</p> : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ left: -18, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval={1} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <Tooltip formatter={(v: number, n: string) => [brl(v), n]} contentStyle={tip} />
                <Bar dataKey="faturamento" name="Faturamento" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="recebido" name="Recebido" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                <Line dataKey="lucro" name="Lucro estimado" stroke="var(--chart-4)" dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
      <Card className="mb-4">
        <h2 className="mb-2 font-semibold">Mais vendidos no mês</h2>
        {top.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma venda neste mês.</p> : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top} layout="vertical" margin={{ left: 8, right: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip formatter={(v: number) => [`${v} un.`, "Quantidade"]} contentStyle={tip} />
                <Bar dataKey="quantity" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </>
  );
}
