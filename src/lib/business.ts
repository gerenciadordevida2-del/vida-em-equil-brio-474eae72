// Pure business (Negócio) types and calculations. Money is summed in integer cents
// to avoid floating-point drift; stored values are rounded to 2 decimals.

export type Movement = { date: string; amount: number };

/** One product line of a sale. unitPrice/unitCost are snapshots taken when the sale was
 * registered, so later product price edits never change past sales. */
export type SaleItem = {
  productId?: string | undefined;
  product: string;
  quantity: number;
  unitPrice: number;
  unitCost?: number | undefined;
};

export type Sale = {
  id: string;
  /** Multi-product sales. When absent (legacy sales), the top-level product fields are the single line. */
  items?: SaleItem[] | undefined;
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

/** Delivery state of a reminder. Opening WhatsApp only means "conversa_aberta": the app cannot
 * know whether the user actually sent it. "enviado"/"falhou" are reserved for provider-confirmed
 * results (official WhatsApp Business API), which this app does not use yet.
 * Old records without `status` were created by opening WhatsApp, so they read as "conversa_aberta". */
export type ReminderStatus = "mensagem_preparada" | "conversa_aberta" | "enviado" | "falhou" | "cancelado";
export type ReminderLog = {
  id: string;
  saleId: string;
  dueDate: string;
  sentAt: string; // date the action happened (kept for compatibility with older records)
  channel: "whatsapp-manual";
  status?: ReminderStatus | undefined;
  amount?: number | undefined; // open balance included in the message
  error?: string | undefined;
};
export const reminderStatus = (r: ReminderLog): ReminderStatus => r.status ?? "conversa_aberta";

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

type SaleLike = Pick<Sale, "quantity" | "unitPrice" | "discount"> &
  Partial<Pick<Sale, "items" | "product" | "productId" | "unitCost">>;

/** Product lines of a sale; legacy single-product sales become one line. */
export function saleLines(s: SaleLike): SaleItem[] {
  if (s.items && s.items.length) return s.items;
  return [{ productId: s.productId, product: s.product ?? "", quantity: s.quantity, unitPrice: s.unitPrice, unitCost: s.unitCost }];
}

export const lineSubtotal = (l: Pick<SaleItem, "quantity" | "unitPrice">) => r(c(l.quantity * l.unitPrice));

export const saleTotal = (s: SaleLike) =>
  r(Math.max(0, saleLines(s).reduce((a, l) => a + c(l.quantity * l.unitPrice), 0) - c(s.discount || 0)));

/** Validates lines and fills the legacy summary fields (product label, total quantity,
 * first line price/product) so older screens and backups keep reading the sale. */
export function withItems<T extends Omit<Sale, "product" | "quantity" | "unitPrice" | "unitCost" | "productId">>(
  base: T,
  items: SaleItem[],
): Sale {
  if (!items.length) throw new Error("Adicione pelo menos um produto.");
  const clean = items.map((l) => {
    const product = l.product.trim();
    if (!product) throw new Error("Informe o nome de cada produto.");
    if (!(Number.isFinite(l.quantity) && l.quantity > 0)) throw new Error(`Quantidade inválida em “${product}”.`);
    if (!(Number.isFinite(l.unitPrice) && l.unitPrice >= 0)) throw new Error(`Preço inválido em “${product}”.`);
    if (l.unitCost !== undefined && !(Number.isFinite(l.unitCost) && l.unitCost >= 0))
      throw new Error(`Custo inválido em “${product}”.`);
    return {
      product,
      quantity: l.quantity,
      unitPrice: r(c(l.unitPrice)),
      ...(l.productId ? { productId: l.productId } : {}),
      ...(l.unitCost !== undefined ? { unitCost: r(c(l.unitCost)) } : {}),
    } as SaleItem;
  });
  const first = clean[0]!;
  const label = clean.length === 1 ? first.product : clean.map((l) => `${l.quantity}x ${l.product}`).join(" + ");
  const { productId: _p, unitCost: _c, ...rest } = base as T & { productId?: string; unitCost?: number };
  const sale: Sale = {
    ...(rest as T),
    product: label,
    quantity: clean.reduce((a, l) => a + l.quantity, 0),
    unitPrice: first.unitPrice,
    items: clean,
  } as Sale;
  if (clean.length === 1) {
    if (first.productId) sale.productId = first.productId;
    if (first.unitCost !== undefined) sale.unitCost = first.unitCost;
  }
  return sale;
}

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
  const lines = saleLines(s);
  if (lines.some((l) => l.unitCost === undefined || l.unitCost === null || Number.isNaN(l.unitCost))) return null;
  const total = saleTotal(s);
  const profit = r(c(total) - lines.reduce((a, l) => a + c(l.quantity * l.unitCost!), 0));
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
  return b.sales.filter((s) => isActiveSale(s) && s.date === day).reduce((sum, s) => sum + saleLines(s).reduce((a, l) => a + l.quantity, 0), 0);
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

/** Open (unpaid) balance of a customer: sum of what is still due on each active sale. */
export function customerOpenBalance(b: BusinessData, customerId: string): number {
  return r(b.sales.filter((s) => isActiveSale(s) && s.customerId === customerId)
    .reduce((a, s) => a + c(remaining(saleTotal(s), s)), 0));
}

/** Registers one customer payment against the consolidated balance. The amount is split
 * across that customer's open sales, oldest first, so each sale keeps a traceable payment
 * (same paymentId) and already-paid sales are never reopened. Refuses overpayment. */
export function payCustomer(b: BusinessData, customerId: string, amount: number, date: string, paymentId: string): BusinessData {
  let left = c(amount);
  if (!(left > 0)) throw new Error("Informe um valor maior que zero.");
  if (b.sales.some((s) => s.payments.some((p) => (p as Movement & { paymentId?: string }).paymentId === paymentId)))
    return b; // same payment submitted twice: ignore
  const open = c(customerOpenBalance(b, customerId));
  if (left > open) throw new Error("O valor é maior que o saldo devedor do cliente.");
  const order = b.sales
    .filter((s) => isActiveSale(s) && s.customerId === customerId && remaining(saleTotal(s), s) > 0)
    .sort((x, y) => x.date.localeCompare(y.date) || x.id.localeCompare(y.id))
    .map((s) => s.id);
  const sales = b.sales.map((s) => s);
  for (const id of order) {
    if (left <= 0) break;
    const i = sales.findIndex((s) => s.id === id);
    const s = sales[i]!;
    const take = Math.min(left, c(remaining(saleTotal(s), s)));
    sales[i] = { ...s, payments: [...s.payments, { date, amount: r(take), paymentId } as Movement] };
    left -= take;
  }
  return { ...b, sales };
}

/** Breakdown shown before confirming a sale: balance already owed (excluding the sale being
 * edited, so it is never counted twice), the new purchase, what is paid now and the result. */
export function saleBalancePreview(
  b: BusinessData,
  customerId: string | undefined,
  excludeSaleId: string | undefined,
  newTotal: number,
  paidNow: number,
) {
  const previous = customerId
    ? b.sales
        .filter((s) => isActiveSale(s) && s.customerId === customerId && s.id !== excludeSaleId)
        .reduce((a, s) => a + c(remaining(saleTotal(s), s)), 0)
    : 0;
  const nt = Math.max(0, c(newTotal));
  const pn = Math.min(nt, Math.max(0, c(paidNow)));
  return { previous: r(previous), newPurchase: r(nt), paidNow: r(pn), newBalance: r(previous + nt - pn) };
}
