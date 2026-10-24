import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { handleChat } from "@/lib/ai.server";
import type { Database } from "@/integrations/supabase/types";

/** Verifies the caller's Lovable Cloud session and consumes the per-user chat quota before
 * the request reaches the AI. The AI never receives database access: actions are tool calls
 * that the signed-in user confirms on their own device. */
export async function authorizeChat(
  request: Request,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const deny = (status: number, error: string) => ({
    ok: false as const,
    response: Response.json({ error }, { status }),
  });
  if (!url || !key) return deny(503, "Servidor sem configuração de autenticação.");
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token.split(".").length !== 3) return deny(401, "Entre na sua conta para usar o assistente.");

  const supabase = createClient<Database>(url, key, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return deny(401, "Sessão expirada. Entre novamente.");

  const quota = await supabase.rpc("consume_chat_quota", { max_per_minute: 10, max_per_day: 200 });
  if (quota.error) return deny(503, "Não foi possível verificar seu limite de uso. Tente novamente.");
  if (quota.data !== true)
    return deny(429, "Limite de mensagens atingido. Aguarde um minuto e tente novamente.");
  return { ok: true };
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authorizeChat(request);
        if (!auth.ok) return auth.response;
        return handleChat(request);
      },
    },
  },
});
