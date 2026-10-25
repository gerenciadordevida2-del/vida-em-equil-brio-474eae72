// Classificação de contas a pagar e passivo total, derivada das datas — sem duplicar
// registros: uma conta vencida não vira outra linha, apenas muda de status conforme
// a data de hoje, então a reclassificação acontece mesmo se o app não for aberto no
// dia do vencimento. Nenhuma despesa é criada aqui; o lançamento só existe quando a
// conta é marcada como paga (ver aba Contas em financas.tsx).

import type { Bill, Debt } from "@/lib/store";
import { roundMoney } from "@/lib/data-validation";

export type BillStatus = "paga" | "vencida" | "pendente";

export function billStatus(bill: Pick<Bill, "paid" | "dueDate">, today: string): BillStatus {
  if (bill.paid) return "paga";
  return bill.dueDate < today ? "vencida" : "pendente";
}

export type LiabilitySummary = {
  /** Contas não pagas ainda no prazo. */
  pendingBills: number;
  /** Contas não pagas com vencimento ultrapassado (passivo vencido). */
  overdueBills: number;
  /** Saldo restante das dívidas cadastradas. */
  debtsRemaining: number;
  /** Passivo total em aberto: contas pendentes + vencidas + dívidas. */
  total: number;
  overdueList: Bill[];
};

export function liabilitySummary(
  bills: Bill[],
  debts: Debt[],
  today: string,
): LiabilitySummary {
  let pending = 0;
  let overdue = 0;
  const overdueList: Bill[] = [];
  for (const bill of bills) {
    const status = billStatus(bill, today);
    if (status === "paga") continue;
    if (status === "vencida") {
      overdue = roundMoney(overdue + bill.amount);
      overdueList.push(bill);
    } else {
      pending = roundMoney(pending + bill.amount);
    }
  }
  overdueList.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const debtsRemaining = roundMoney(
    debts.reduce((sum, d) => sum + Math.max(0, d.total - d.paid), 0),
  );
  return {
    pendingBills: pending,
    overdueBills: overdue,
    debtsRemaining,
    total: roundMoney(pending + overdue + debtsRemaining),
    overdueList,
  };
}
