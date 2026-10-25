import { createFileRoute } from "@tanstack/react-router";
import { verifySession } from "./chat";
import { GROQ_BASE_URL, GROQ_MODEL } from "@/lib/ai.server";

/** Status e teste real da chave Groq. A chave vive apenas em secrets do servidor
 * (GERENCIADOR_DE_VIDA_API_KEY, alternativa GROQ_API_KEY): esta rota nunca devolve
 * o valor, apenas se ela existe e se a Groq a aceita. */
function groqKey(): string | undefined {
  return process.env["GERENCIADOR_DE_VIDA_API_KEY"]?.trim() || process.env["GROQ_API_KEY"]?.trim();
}

export const Route = createFileRoute("/api/groq-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await verifySession(request);
        if (!session.ok) return session.response;
        return Response.json({ configured: Boolean(groqKey()), model: GROQ_MODEL });
      },
      POST: async ({ request }) => {
        const session = await verifySession(request);
        if (!session.ok) return session.response;
        const apiKey = groqKey();
        if (!apiKey)
          return Response.json(
            {
              configured: false,
              ok: false,
              error:
                "Chave da Groq ainda não configurada. Cadastre GERENCIADOR_DE_VIDA_API_KEY nos secrets do projeto.",
            },
            { status: 409 },
          );
        try {
          const res = await fetch(`${GROQ_BASE_URL}/models`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(15_000),
          });
          if (res.ok) return Response.json({ configured: true, ok: true, model: GROQ_MODEL });
          const message =
            res.status === 401 || res.status === 403
              ? "A Groq recusou a chave. Confira se ela está correta e ativa."
              : `A Groq respondeu com erro ${res.status}. Tente novamente em instantes.`;
          return Response.json({ configured: true, ok: false, error: message }, { status: 502 });
        } catch {
          return Response.json(
            { configured: true, ok: false, error: "Não foi possível alcançar a Groq. Verifique a conexão do servidor." },
            { status: 502 },
          );
        }
      },
    },
  },
});
