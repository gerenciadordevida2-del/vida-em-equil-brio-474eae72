import type { AppData } from "@/lib/store";
export const normalizeImport = () =>
  ({ version: 1, transactions: [], bills: [], debts: [], tasks: [], habits: [], plans: [], workoutLogs: [], workoutGoal: 3, financeGoals: [], healthGoals: [], business: { sales: [], expenses: [], scheduled: [] } }) as unknown as AppData;
