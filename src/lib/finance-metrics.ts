import type { Transaction } from "@/lib/store";

/** The existing Finanças rule: dated personal entries only, with no carried balance. */
export function monthlyFinance(transactions: Transaction[], month: string) {
  const entries = transactions.filter((entry) => entry.date.startsWith(month));
  const income = entries.filter((entry) => entry.type === "receita").reduce((sum, entry) => sum + entry.amount, 0);
  const expenses = entries.filter((entry) => entry.type === "despesa").reduce((sum, entry) => sum + entry.amount, 0);
  return { income, expenses, balance: income - expenses, count: entries.length };
}