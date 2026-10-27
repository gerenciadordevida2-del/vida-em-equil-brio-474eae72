import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "vip" | "user";

/** Papéis do usuário logado, lidos do banco (valem em todas as sessões/dispositivos). */
export const rolesQuery = queryOptions({
  queryKey: ["my-roles"],
  queryFn: async (): Promise<AppRole[]> => {
    const { data, error } = await supabase.rpc("my_roles");
    if (error) throw error;
    return (data ?? []) as AppRole[];
  },
  staleTime: 60_000,
});

export function useMyRoles() {
  const query = useQuery(rolesQuery);
  const roles = query.data ?? [];
  return {
    ...query,
    roles,
    isAdmin: roles.includes("admin"),
    isVip: roles.includes("vip"),
  };
}

export type Plan = "owner" | "vip" | "free";

/** Hierarquia de acesso: proprietário > VIP > gratuito. */
export function planOf(roles: AppRole[]): Plan {
  if (roles.includes("admin")) return "owner";
  if (roles.includes("vip")) return "vip";
  return "free";
}

/** Limites de mensagens da IA por plano. O servidor (consume_chat_quota) aplica
 * exatamente estes valores; o proprietário não tem bloqueio de cliente. */
export const PLAN_LIMITS: Record<Plan, { perMinute: number; perDay: number } | null> = {
  free: { perMinute: 10, perDay: 200 },
  vip: { perMinute: 50, perDay: 1000 },
  owner: null,
};

export const PLAN_LABELS: Record<Plan, string> = {
  owner: "Proprietário",
  vip: "Cliente VIP",
  free: "Plano gratuito",
};
