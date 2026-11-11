import { positionKey, type InvestmentOperation } from "./invest-metrics";

/** Validate against the complete dated ledger, including backdated operations. */
export function appendOperation(operations: InvestmentOperation[], op: InvestmentOperation) {
  if (operations.some((x) => x.id === op.id)) return operations;
  if (!Number.isFinite(op.quantity) || op.quantity <= 0 || !Number.isFinite(op.price) || op.price <= 0)
    throw new Error("Quantidade e preço devem ser positivos");
  if (op.currency === "USD" && (!op.fxRate || !Number.isFinite(op.fxRate) || op.fxRate <= 0))
    throw new Error("Informe o câmbio USD/BRL efetivo da operação");
  const next = [...operations, op];
  let balance = 0;
  for (const x of [...next].filter((x) => positionKey(x) === positionKey(op)).sort((a, b) => a.date.localeCompare(b.date))) {
    balance += x.side === "compra" ? x.quantity : -x.quantity;
    if (balance < -1e-9) throw new Error(`Você tem só ${Math.max(0, balance + x.quantity)} de ${op.ticker} na data da venda`);
  }
  return next;
}