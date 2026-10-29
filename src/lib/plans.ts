import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/roles";

export type BillingInterval = "monthly" | "annual";

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string;
  price_cents: number;
  price_annual_cents: number | null;
  features: string[];
  limits: { aiPerMinute?: number; aiPerDay?: number };
}

export interface CurrentPlan {
  plan_code: string;
  plan_name: string;
  status: string;
  billing_interval: BillingInterval;
  trial_start: string | null;
  trial_end: string | null;
  price_cents: number;
  price_annual_cents: number | null;
}

/** Catálogo de planos publicados (leitura permitida a qualquer usuário autenticado). */
export const plansQuery = queryOptions({
  queryKey: ["plans"],
  queryFn: async (): Promise<Plan[]> => {
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .eq("active", true)
      .order("price_cents");
    if (error) throw error;
    return (data ?? []) as unknown as Plan[];
  },
  staleTime: 300_000,
});

/** Plano comercial vigente do usuário (assinatura ativa ou teste dentro do prazo); null = gratuito. */
export const currentPlanQuery = queryOptions({
  queryKey: ["my-current-plan"],
  queryFn: async (): Promise<CurrentPlan | null> => {
    const { data, error } = await supabase.rpc("my_current_plan");
    if (error) throw error;
    return ((data?.[0] ?? null) as CurrentPlan | null);
  },
  staleTime: 30_000,
});

/** Se o usuário já usou o teste grátis alguma vez (histórico, mesmo expirado/cancelado). */
export const trialUsedQuery = queryOptions({
  queryKey: ["my-trial-used"],
  queryFn: async (): Promise<boolean> => {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id")
      .not("trial_start", "is", null)
      .limit(1);
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  },
  staleTime: 30_000,
});

export const formatBRL = (cents: number): string =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Dias restantes do teste (arredonda para cima; nunca negativo). */
export function trialDaysLeft(trialEnd: string, now: Date = new Date()): number {
  const ms = new Date(trialEnd).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function priceFor(plan: Plan, interval: BillingInterval): number {
  return interval === "annual" ? (plan.price_annual_cents ?? plan.price_cents) : plan.price_cents;
}

export type EffectivePlan = "owner" | "negocio" | "premium" | "vip" | "free";

/** Hierarquia de acesso: proprietário > assinatura (ativa ou teste vigente) > VIP > gratuito.
 * Papéis administrativos (admin/vip) nunca são removidos por mudanças de assinatura. */
export function effectivePlan(roles: AppRole[], current: CurrentPlan | null): EffectivePlan {
  if (roles.includes("admin")) return "owner";
  if (current) return current.plan_code === "negocio" ? "negocio" : "premium";
  if (roles.includes("vip")) return "vip";
  return "free";
}

export const EFFECTIVE_PLAN_LABELS: Record<EffectivePlan, string> = {
  owner: "Proprietário",
  negocio: "Negócio",
  premium: "Premium",
  vip: "Cliente VIP",
  free: "Gratuito",
};
