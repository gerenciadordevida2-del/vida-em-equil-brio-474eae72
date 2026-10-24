// Pure commerce rules: customers, products, stock and sales dashboards.
// Money in integer cents (same convention as business.ts). Product stock is a stored
// quantity changed only through applySaleStock/changeSaleStatus/adjustStock, each of
// which appends an auditable StockMove — so history is preserved and never double-applied.

import {
  isActiveSale,
  paidOf,
  remaining,
  saleProfit,
  saleTotal,
  type BusinessData,
  type Customer,
  type Product,
  type Sale,
  type StockMove,
} from "@/lib/business";

const c = (v: number) => Math.round(v * 100);
const r = (cents: number) => cents / 100;
const newId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const normName = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
export const normPhone = (s: string | undefined) => (s ?? "").replace(/\D/g, "");

/** Finds an existing (non-archived) customer with the same phone, or same name when no phone. */
export function findDuplicateCustomer(
  customers: Customer[],
  name: string,
  phone: string | undefined,
  ignoreId?: string,
): Customer | undefined {
  const p = normPhone(phone);
  const n = normName(name);
  return customers.find(
    (x) =>
      x.id !== ignoreId &&
      !x.archived &&
      ((p.length >= 8 && normPhone(x.phone) === p) || (!p && normName(x.name) === n)),
  );
}

export function upsertCustomer(b: BusinessData, cust: Customer): BusinessData {
  const list = b.customers ?? [];
  if (!cust.name.trim()) throw new Error("Informe o nome do cliente.");
  const dup = findDuplicateCustomer(list, cust.name, cust.phone, cust.id);
  if (dup) throw new Error(`Já existe o cliente “${dup.name}” com esses dados.`);
  const exists = list.some((x) => x.id === cust.id);
  const customers = exists ? list.map((x) => (x.id === cust.id ? cust : x)) : [...list, cust];
  // Keep the denormalized display name on linked sales in sync.
  const sales = b.sales.map((s) => (s.customerId === cust.id ? { ...s, customer: cust.name } : s));
  return { ...b, customers, sales };
}

export function upsertProduct(b: BusinessData, prod: Product): BusinessData {
  if (!prod.name.trim()) throw new Error("Informe o nome do produto.");
  if (!(prod.price >= 0) || !(prod.minStock >= 0) || !(prod.quantity >= 0))
    throw new Error("Preço, quantidade e estoque mínimo não podem ser negativos.");
  const list = b.products ?? [];
  const dup = list.find((x) => x.id !== prod.id && !x.archived && normName(x.name) === normName(prod.name));
  if (dup) throw new Error(`Já existe o produto “${dup.name}”.`);
  const prev = list.find((x) => x.id === prod.id);
  const moves: StockMove[] = [...(b.stockMoves ?? [])];
  const delta = prod.quantity - (prev?.quantity ?? 0);
  if (delta !== 0)
    moves.push({ id: newId(), productId: prod.id, date: prod.createdAt, delta, reason: "ajuste" });
  const products = prev ? list.map((x) => (x.id === prod.id ? prod : x)) : [...list, prod];
  return { ...b, products, stockMoves: moves };
}

/** Units of a product consumed by a sale (0 when not linked or not active). */
const consumption = (s: Sale | null | undefined, productId: string) =>
  s && isActiveSale(s) && s.productId === productId ? s.quantity : 0;

/** Applies the stock effect of creating/editing/deleting a sale (prev → next).
 * Refuses to leave any product below zero unless allowNegative. */
export function applySaleStock(
  b: BusinessData,
  prev: Sale | null,
  next: Sale | null,
  date: string,
  allowNegative = false,
  reasonOverride?: StockMove["reason"],
): BusinessData {
  const ids = new Set([prev?.productId, next?.productId].filter(Boolean) as string[]);
  if (ids.size === 0) return b;
  let products = b.products ?? [];
  const moves = [...(b.stockMoves ?? [])];
  for (const pid of ids) {
    const delta = consumption(prev, pid) - consumption(next, pid);
    if (delta === 0) continue;
    const prod = products.find((p) => p.id === pid);
    if (!prod) throw new Error("Produto da venda não encontrado.");
    const qty = prod.quantity + delta;
    if (qty < 0 && !allowNegative)
      throw new Error(`Estoque insuficiente de “${prod.name}”: restam ${prod.quantity}.`);
    products = products.map((p) => (p.id === pid ? { ...p, quantity: qty } : p));
    const reason: StockMove["reason"] = reasonOverride ?? (!next ? "exclusao" : !prev ? "venda" : "edicao");
    moves.push({ id: newId(), productId: pid, date, delta, reason, saleId: (next ?? prev)!.id });
  }
  return { ...b, products, stockMoves: moves };
}

/** Saves a sale (new or edited) together with its stock effect, atomically. */
export function saveSale(b: BusinessData, next: Sale, date: string): BusinessData {
  const prev = b.sales.find((s) => s.id === next.id) ?? null;
  const withStock = applySaleStock(b, prev, next, date);
  const sales = prev ? b.sales.map((s) => (s.id === next.id ? next : s)) : [...b.sales, next];
  return { ...withStock, sales };
}

export function deleteSale(b: BusinessData, id: string, date: string): BusinessData {
  const prev = b.sales.find((s) => s.id === id);
  if (!prev) return b;
  const withStock = applySaleStock(b, prev, null, date);
  return { ...withStock, sales: b.sales.filter((s) => s.id !== id) };
}

/** Cancels or returns a sale: keeps it in history, returns units to stock once. */
export function changeSaleStatus(
  b: BusinessData,
  id: string,
  status: "cancelada" | "devolvida",
  date: string,
): BusinessData {
  const prev = b.sales.find((s) => s.id === id);
  if (!prev) throw new Error("Venda não encontrada.");
  if (prev.status) throw new Error("Esta venda já foi cancelada ou devolvida.");
  const next: Sale = { ...prev, status };
  const withStock = applySaleStock(b, prev, next, date, false, status === "cancelada" ? "cancelamento" : "devolucao");
  return { ...withStock, sales: b.sales.map((s) => (s.id === id ? next : s)) };
}

export const lowStock = (b: BusinessData) =>
  (b.products ?? []).filter((p) => !p.archived && p.quantity <= p.minStock);

export type CustomerSummary = {
  sales: Sale[];
  total: number;
  paid: number;
  pending: number;
  payments: { date: string; amount: number; saleId: string; product: string }[];
  nextDue?: string | undefined;
};

export function customerSummary(b: BusinessData, customerId: string): CustomerSummary {
  const sales = b.sales
    .filter((s) => s.customerId === customerId)
    .sort((x, y) => y.date.localeCompare(x.date));
  const active = sales.filter(isActiveSale);
  const totalC = active.reduce((s, x) => s + c(saleTotal(x)), 0);
  const paidC = active.reduce((s, x) => s + c(paidOf(x)), 0);
  const payments = active
    .flatMap((s) => s.payments.map((p) => ({ ...p, saleId: s.id, product: s.product })))
    .sort((x, y) => y.date.localeCompare(x.date));
  const dues = active
    .filter((s) => s.expectedDate && remaining(saleTotal(s), s) > 0)
    .map((s) => s.expectedDate!)
    .sort();
  return { sales, total: r(totalC), paid: r(paidC), pending: r(totalC - paidC), payments, nextDue: dues[0] };
}

export type SalesDashboard = {
  todayRevenue: number;
  todayCount: number;
  monthRevenue: number;
  monthCount: number;
  ticket: number | null;
  toReceive: number;
  overdue: number;
  monthProfit: number | null;
  profitPartial: boolean;
  monthReceived: number;
};

export function salesDashboard(b: BusinessData, day: string): SalesDashboard {
  const month = day.slice(0, 7);
  const active = b.sales.filter(isActiveSale);
  const todayS = active.filter((s) => s.date === day);
  const monthS = active.filter((s) => s.date.startsWith(month));
  const sum = (xs: Sale[]) => xs.reduce((s, x) => s + c(saleTotal(x)), 0);
  const monthC = sum(monthS);
  const withCost = monthS.filter((s) => saleProfit(s) !== null);
  const open = active.filter((s) => remaining(saleTotal(s), s) > 0);
  return {
    todayRevenue: r(sum(todayS)),
    todayCount: todayS.length,
    monthRevenue: r(monthC),
    monthCount: monthS.length,
    ticket: monthS.length ? r(Math.round(monthC / monthS.length)) : null,
    toReceive: r(open.reduce((s, x) => s + c(remaining(saleTotal(x), x)), 0)),
    overdue: r(
      open
        .filter((s) => s.expectedDate && s.expectedDate < day)
        .reduce((s, x) => s + c(remaining(saleTotal(x), x)), 0),
    ),
    monthProfit: withCost.length ? r(withCost.reduce((s, x) => s + c(saleProfit(x)!.profit), 0)) : null,
    profitPartial: withCost.length > 0 && withCost.length < monthS.length,
    monthReceived: r(
      active.reduce(
        (s, x) => s + x.payments.filter((p) => p.date.startsWith(month)).reduce((a, p) => a + c(p.amount), 0),
        0,
      ),
    ),
  };
}

export type DayPoint = { label: string; faturamento: number; recebido: number; lucro: number | null };

/** Daily revenue / receipts / profit for the last `days` days ending at `day`. */
export function revenueSeries(b: BusinessData, day: string, days = 14): DayPoint[] {
  const active = b.sales.filter(isActiveSale);
  const end = new Date(`${day}T12:00:00`);
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const ss = active.filter((s) => s.date === key);
    const costed = ss.filter((s) => saleProfit(s) !== null);
    out.push({
      label: `${key.slice(8)}/${key.slice(5, 7)}`,
      faturamento: r(ss.reduce((s, x) => s + c(saleTotal(x)), 0)),
      recebido: r(
        active.reduce((s, x) => s + x.payments.filter((p) => p.date === key).reduce((a, p) => a + c(p.amount), 0), 0),
      ),
      lucro: costed.length ? r(costed.reduce((s, x) => s + c(saleProfit(x)!.profit), 0)) : null,
    });
  }
  return out;
}

export function topProducts(b: BusinessData, monthPrefix: string, limit = 5) {
  const map = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const s of b.sales.filter((x) => isActiveSale(x) && x.date.startsWith(monthPrefix))) {
    const key = s.productId ?? `n:${normName(s.product)}`;
    const cur = map.get(key) ?? { name: s.product, quantity: 0, revenue: 0 };
    cur.quantity += s.quantity;
    cur.revenue = r(c(cur.revenue) + c(saleTotal(s)));
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, limit);
}

/** wa.me link for a Brazilian number (adds 55 when missing). Returns null for invalid numbers. */
export function whatsappLink(phone: string | undefined, message: string): string | null {
  let p = normPhone(phone);
  if (p.length < 10) return null;
  if (!p.startsWith("55") || p.length <= 11) p = `55${p}`;
  return `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
}

export function reminderMessage(name: string, product: string, amount: string, due?: string) {
  const first = name.split(" ")[0] || name;
  return `Olá, ${first}! Passando para lembrar do pagamento de ${amount} referente a ${product}${
    due ? ` com vencimento em ${due}` : ""
  }. Qualquer dúvida estou à disposição. Obrigado!`;
}
