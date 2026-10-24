// Pure business (Negócio) types and calculations. Money is summed in integer cents
// to avoid floating-point drift; stored values are rounded to 2 decimals.

export type Movement = { date: string; amount: number };

export type Sale = {
  id: string;
  customer: string;
  product: string;
  quantity: number;
  unitPrice: number;
  unitCost?: number | undefined;
  discount: number;
  date: string;
  paymentMethod: string;
  payments: Movement[];
  expectedDate?: string | undefined;
  notes?: string | undefined;
  /** Links to commerce records (optional so legacy sales stay valid). */
  customerId?: string | undefined;
  productId?: string | undefined;
  /** Cancelled/returned sales stay in history but leave every total and the stock. */
  status?: "cancelada" | "devolvida" | undefined;
};

export type Customer = {
  id: string;
  name: string;
  phone?: string | undefined;
  notes?: string | undefined;
  archived?: boolean | undefined;
  createdAt: string;
};

export type Product = {
  id: string;
  name: string;
  price: number;
  cost?: number | undefined;
  quantity: number;
  minStock: number;
  archived?: boolean | undefined;
  createdAt: string;
};

export type StockMove = {
  id: string;
  productId: string;
  date: string;
  delta: number;
  reason: "venda" | "edicao" | "cancelamento" | "devolucao" | "ajuste" | "exclusao";
  saleId?: string | undefined;
};

export type ReminderLog = { id: string; saleId: string; dueDate: string; sentAt: string; channel: "whatsapp-manual" };

export type BizExpense = {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod?: string | undefined;
  paid: boolean;
  paidDate?: string | undefined;
  dueDate?: string | undefined;
  notes?: string | undefined;
};

export type ScheduledPayment = {
  id: string;
  kind: "receber" | "pagar";
  party: string;
  item: string;
  amount: number;
  dueDate: string;
  payments: Movement[];
  notes?: string | undefined;
};

/** Daily cone stock: the initial quantity set for one specific day. */
export type DailyStock = { date: string; initial: number };

export type BusinessData = {
  sales: Sale[];
  expenses: BizExpense[];
  scheduled: ScheduledPayment[];
  stock?: DailyStock | undefined;
  customers?: Customer[] | undefined;
  products?: Product[] | undefined;
  stockMoves?: StockMove[] | undefined;
  reminders?: ReminderLog[] | undefined;
};

export const isActiveSale = (s: Sale) => !s.status;

export const emptyBusiness = (): BusinessData => ({ sales: [], expenses: [], scheduled: [] });

export const BIZ_CATEGORIES = [
  "Mercadorias e produtos",
  "Transporte e entregas",
  "Marketing",
  "Taxas e tarifas",
  "Outros gastos",
] as const;

export const PAYMENT_METHODS = ["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito", "Boleto", "Transferência", "Outro"];

const c = (v: number) => Math.round(v * 100);
const r = (cents: number) => cents / 100;
const sumC = (xs: number[]) => xs.reduce((s, x) => s + c(x), 0);

export const saleTotal = (s: Pick<Sale, "quantity" | "unitPrice" | "discount">) =>
  r(Math.max(0, c(s.quantity * s.unitPrice) - c(s.discount || 0)));

export const paidOf = (m: { payments: Movement[] }) => r(sumC(m.payments.map((p) => p.amount)));

export const remaining = (total: number, m: { payments: Movement[] }) =>
  r(Math.max(0, c(total) - c(paidOf(m))));

export type PayStatus = "pendente" | "parcial" | "pago";
export function statusOf(total: number, m: { payments: Movement[] }): PayStatus {
  const paid = c(paidOf(m));
  if (paid <= 0) return "pendente";
  return paid >= c(total) ? "pago" : "parcial";
}

/** Returns sale profit or null when the unit cost is unknown (never assumes profit). */
export function saleProfit(s: Sale): { profit: number; margin: number } | null {
  if (s.unitCost === undefined || s.unitCost === null || Number.isNaN(s.unitCost)) return null;
  const total = saleTotal(s);
  const profit = r(c(total) - c(s.quantity * s.unitCost));
  return { profit, margin: total > 0 ? profit / total : 0 };
}

/** Adds a payment/receipt, refusing to exceed the open balance. */
export function addPayment<T extends { payments: Movement[] }>(
  item: T,
  total: number,
  amount: number,
  date: string,
): T {
  const open = c(remaining(total, item));
  const a = c(amount);
  if (!(a > 0)) throw new Error("Informe um valor maior que zero.");
  if (a > open) throw new Error("O valor é maior que o saldo restante.");
  return { ...item, payments: [...item.payments, { date, amount: r(a) }] };
}

export type Period = { start: string; end: string };
const inP = (d: string | undefined, p: Period) => !!d && d >= p.start && d <= p.end;

export function monthPeriod(ym: string): Period {
  const [y = 0, m = 1] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${ym}-01`, end: `${ym}-${String(last).padStart(2, "0")}` };
}

export function businessMetrics(b: BusinessData, p: Period) {
  const sales = b.sales.filter((s) => isActiveSale(s) && inP(s.date, p));
  const expenses = b.expenses.filter((e) => inP(e.date, p));
  const totalSalesC = sumC(sales.map(saleTotal));
  const receivedOfSalesC = sumC(sales.map(paidOf));
  const withCost = sales.filter((s) => saleProfit(s) !== null);
  const grossC = sumC(withCost.map((s) => saleProfit(s)!.profit));
  const expensesC = sumC(expenses.map((e) => e.amount));
  const payablesInP = b.scheduled.filter((s) => s.kind === "pagar" && inP(s.dueDate, p));
  const payablesC = sumC(payablesInP.map((s) => s.amount));

  const toReceiveC =
    sumC(b.sales.filter(isActiveSale).map((s) => remaining(saleTotal(s), s))) +
    sumC(b.scheduled.filter((s) => s.kind === "receber").map((s) => remaining(s.amount, s)));
  const toPayC =
    sumC(b.expenses.filter((e) => !e.paid).map((e) => e.amount)) +
    sumC(b.scheduled.filter((s) => s.kind === "pagar").map((s) => remaining(s.amount, s)));

  // Cash: only effective movements dated inside the period.
  const movIn = (ms: Movement[]) => sumC(ms.filter((m) => inP(m.date, p)).map((m) => m.amount));
  const cashInC =
    b.sales.filter(isActiveSale).reduce((s, x) => s + movIn(x.payments), 0) +
    b.scheduled.filter((s) => s.kind === "receber").reduce((s, x) => s + movIn(x.payments), 0);
  const cashOutC =
    sumC(b.expenses.filter((e) => e.paid && inP(e.paidDate ?? e.date, p)).map((e) => e.amount)) +
    b.scheduled.filter((s) => s.kind === "pagar").reduce((s, x) => s + movIn(x.payments), 0);

  return {
    totalSales: r(totalSalesC),
    receivedOfSales: r(receivedOfSalesC),
    pendingOfSales: r(totalSalesC - receivedOfSalesC),
    expenses: r(expensesC),
    grossProfit: r(grossC),
    salesWithoutCost: sales.length - withCost.length,
    netProfit: r(grossC - expensesC - payablesC),
    salesCount: sales.length,
    toReceive: r(toReceiveC),
    toPay: r(toPayC),
    cashIn: r(cashInC),
    cashOut: r(cashOutC),
    balance: r(cashInC - cashOutC),
  };
}

export function expensesByCategory(b: BusinessData, p: Period) {
  const map = new Map<string, number>();
  for (const e of b.expenses.filter((x) => inP(x.date, p)))
    map.set(e.category, (map.get(e.category) ?? 0) + c(e.amount));
  const total = [...map.values()].reduce((s, x) => s + x, 0);
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, v]) => ({ name, value: r(v), percent: total ? v / total : 0 }));
}

export type DueGroup = "hoje" | "proximos" | "atraso" | "quitados";
export function dueGroup(s: ScheduledPayment, todayStr: string): DueGroup {
  if (statusOf(s.amount, s) === "pago") return "quitados";
  if (s.dueDate < todayStr) return "atraso";
  if (s.dueDate === todayStr) return "hoje";
  return "proximos";
}

export type AgendaItem = ScheduledPayment & { saleId?: string };

/** Pending sales with an expected date appear in the agenda as linked (virtual)
 * receivables. They are not stored twice, so totals are never double counted. */
export function agendaItems(b: BusinessData): AgendaItem[] {
  const fromSales: AgendaItem[] = b.sales
    .filter((s) => isActiveSale(s) && s.expectedDate && remaining(saleTotal(s), s) > 0)
    .map((s) => ({
      id: `sale-${s.id}`,
      saleId: s.id,
      kind: "receber",
      party: s.customer,
      item: s.product,
      amount: saleTotal(s),
      dueDate: s.expectedDate!,
      payments: s.payments,
    }));
  return [...b.scheduled, ...fromSales];
}

/** Business items whose payment date is the given day and still have balance open. */
export function businessDueOn(b: BusinessData, day: string): AgendaItem[] {
  return agendaItems(b).filter((i) => i.dueDate === day && statusOf(i.amount, i) !== "pago");
}

/** Units sold on a given day: sum of the quantities of that day's sales.
 * Computed from the sales themselves, so edits and deletes are never double counted. */
export function soldOn(b: BusinessData, day: string): number {
  return b.sales.filter((s) => isActiveSale(s) && s.date === day).reduce((sum, s) => sum + s.quantity, 0);
}

/** Daily stock state for the given day, or null when no initial quantity was set for it. */
export function stockStatus(b: BusinessData, day: string): { initial: number; sold: number; remaining: number } | null {
  if (!b.stock || b.stock.date !== day) return null;
  const sold = soldOn(b, day);
  return { initial: b.stock.initial, sold, remaining: Math.max(0, b.stock.initial - sold) };
}

/** Refuses a new sale of `quantity` units on `day` when the day's stock cannot cover it. */
export function assertStockAvailable(b: BusinessData, day: string, quantity: number): void {
  const s = stockStatus(b, day);
  if (!s) return;
  if (s.remaining <= 0) throw new Error("Estoque esgotado por hoje. Redefina a quantidade inicial para vender mais.");
  if (quantity > s.remaining)
    throw new Error(`Estoque insuficiente: restam ${s.remaining} unidade(s) hoje.`);
}
