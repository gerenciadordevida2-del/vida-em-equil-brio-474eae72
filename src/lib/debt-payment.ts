import type { AppData, Transaction } from "@/lib/store";
import { roundMoney } from "@/lib/data-validation";

export function recordDebtPayment(
  data: AppData,
  debtId: string,
  amount: number,
  transaction: Pick<Transaction, "id" | "date">,
): AppData {
  const debt = data.debts.find((item) => item.id === debtId);
  if (!debt) throw new Error("A dívida não existe mais.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Informe um pagamento válido.");
  if (amount > roundMoney(debt.total - debt.paid))
    throw new Error("O pagamento não pode superar o saldo restante da dívida.");
  return {
    ...data,
    debts: data.debts.map((item) =>
      item.id === debtId ? { ...item, paid: roundMoney(item.paid + amount) } : item,
    ),
    transactions: [
      ...data.transactions,
      {
        ...transaction,
        type: "despesa",
        description: `Pagamento: ${debt.name}`,
        amount,
        category: "Dívidas",
      },
    ],
  };
}
