import { useSyncExternalStore } from "react";
import { backupSchema } from "@/lib/data-validation";
import { toast } from "sonner";
import { emptyBusiness, type BusinessData } from "@/lib/business";

export type Transaction = {
  id: string;
  type: "receita" | "despesa";
  description: string;
  amount: number;
  category: string;
  date: string;
};

export type Bill = {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  paid: boolean;
};

export type Debt = {
  id: string;
  name: string;
  total: number;
  paid: number;
};

export type Priority = "alta" | "media" | "baixa";

export type Task = {
  id: string;
  title: string;
  done: boolean;
  date: string;
  time?: string;
  priority?: Priority;
  goalId?: string;
  goalArea?: "financas" | "saude";
};

export type Exercise = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
};

export type WorkoutPlan = {
  id: string;
  name: string;
  exercises: Exercise[];
};

export type WorkoutLog = {
  id: string;
  planId: string;
  planName: string;
  date: string;
  exercises: Exercise[];
  notes?: string;
};

export type Habit = {
  id: string;
  name: string;
  doneDates: string[];
};

export type FinanceGoal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string | undefined;
  createdAt: string;
  notes?: string | undefined;
};

export type HealthGoal = {
  id: string;
  name: string;
  category: "peso" | "treinos" | "habito" | "outra";
  currentValue: number;
  targetValue: number;
  startValue?: number;
  unit: string;
  deadline?: string;
  createdAt: string;
  notes?: string;
};

export type AppData = {
  version: 1;
  transactions: Transaction[];
  bills: Bill[];
  debts: Debt[];
  tasks: Task[];
  habits: Habit[];
  plans: WorkoutPlan[];
  workoutLogs: WorkoutLog[];
  workoutGoal: number;
  financeGoals: FinanceGoal[];
  healthGoals: HealthGoal[];
  business: BusinessData;
};

const KEY = "gerenciador-de-vida:v1";
let cacheKey = KEY;

const empty: AppData = {
  version: 1,
  transactions: [],
  bills: [],
  debts: [],
  tasks: [],
  habits: [],
  plans: [],
  workoutLogs: [],
  workoutGoal: 3,
  financeGoals: [],
  healthGoals: [],
  business: emptyBusiness(),
};

function normalizeData(saved: Partial<AppData> | null | undefined): AppData {
  return {
    ...empty,
    ...(saved || {}),
    version: 1,
    transactions: Array.isArray(saved?.transactions) ? saved.transactions : [],
    bills: Array.isArray(saved?.bills) ? saved.bills : [],
    debts: Array.isArray(saved?.debts) ? saved.debts : [],
    tasks: Array.isArray(saved?.tasks) ? saved.tasks : [],
    habits: Array.isArray(saved?.habits) ? saved.habits : [],
    plans: Array.isArray(saved?.plans) ? saved.plans : [],
    workoutLogs: Array.isArray(saved?.workoutLogs) ? saved.workoutLogs : [],
    workoutGoal: typeof saved?.workoutGoal === "number" ? saved.workoutGoal : 3,
    financeGoals: Array.isArray(saved?.financeGoals) ? saved.financeGoals : [],
    healthGoals: Array.isArray(saved?.healthGoals) ? saved.healthGoals : [],
    business: {
      sales: Array.isArray(saved?.business?.sales) ? saved.business.sales : [],
      expenses: Array.isArray(saved?.business?.expenses) ? saved.business.expenses : [],
      scheduled: Array.isArray(saved?.business?.scheduled) ? saved.business.scheduled : [],
      customers: Array.isArray(saved?.business?.customers) ? saved.business.customers : [],
      products: Array.isArray(saved?.business?.products) ? saved.business.products : [],
      stockMoves: Array.isArray(saved?.business?.stockMoves) ? saved.business.stockMoves : [],
      reminders: Array.isArray(saved?.business?.reminders) ? saved.business.reminders : [],
      ...(saved?.business?.stock &&
        typeof saved.business.stock.date === "string" &&
        typeof saved.business.stock.initial === "number"
        ? { stock: saved.business.stock }
        : {}),
    },
  };
}

let state: AppData = empty;
let loaded = false;
let loadFailed = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;

  loaded = true;

  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (!backupSchema.safeParse(parsed).success) throw new Error("Dados locais inválidos");
      state = normalizeData(parsed as Partial<AppData>);
    }
  } catch {
    loadFailed = true;
    state = empty;
    toast.error(
      "Não foi possível ler os dados locais. Eles não foram apagados. Restaure um backup válido antes de salvar alterações.",
    );
  }
}

function setState(next: AppData) {
  const normalized = normalizeData(next);

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(normalized));
    } catch {
      toast.error(
        "Não foi possível salvar neste aparelho. Libere espaço ou permita o armazenamento e tente novamente.",
      );
      throw new Error("Alteração não salva: armazenamento indisponível.");
    }
  }
  state = normalized;
  loadFailed = false;
  sink?.(normalized);

  listeners.forEach((listener) => listener());
}

let sink: ((data: AppData) => void) | null = null;

/** Cloud sync: replaces in-memory/local state with the account's data and routes future saves to `onSave`. */
export function attachCloud(userId: string, data: unknown, onSave: (data: AppData) => void) {
  cacheKey = `${KEY}:user:${userId}`;
  loaded = true;
  loadFailed = false;
  state = normalizeData(data as Partial<AppData>);
  try {
    localStorage.setItem(cacheKey, JSON.stringify(state));
  } catch {
    /* cache only */
  }
  sink = onSave;
  listeners.forEach((listener) => listener());
}

export function detachCloud() {
  sink = null;
  cacheKey = KEY;
  state = empty;
  loaded = true;
  listeners.forEach((listener) => listener());
}

/** Reads the device's legacy (pre-login) data, or null when absent/invalid. Never deletes it. */
export function readLegacyLocal(): AppData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!backupSchema.safeParse(parsed).success) return null;
    return normalizeData(parsed as Partial<AppData>);
  } catch {
    return null;
  }
}

export const LEGACY_KEY = KEY;
export const emptyData = (): AppData => normalizeData(null);

export function update(fn: (data: AppData) => AppData) {
  load();
  if (loadFailed) throw new Error("Restaure um backup válido antes de salvar alterações.");
  setState(fn(state));
}

export function useData(): AppData {
  return useSyncExternalStore(
    (callback) => {
      load();
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => {
      load();
      return state;
    },
    () => empty,
  );
}

export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
};

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export const fmtDate = (value: string) => {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

export function exportBackup() {
  load();
  if (loadFailed)
    throw new Error("Não é possível exportar: os dados locais não puderam ser lidos.");

  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `backup-gerenciador-de-vida-${today()}.json`;
  link.click();

  URL.revokeObjectURL(url);
}

export async function importBackup(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error("Backup muito grande (máximo 10 MB).");
  const parsed: unknown = JSON.parse(await file.text());

  if (!backupSchema.safeParse(parsed).success) {
    throw new Error("Arquivo inválido");
  }

  setState(normalizeData(parsed as Partial<AppData>));
}

export function clearAll() {
  setState(empty);
}
