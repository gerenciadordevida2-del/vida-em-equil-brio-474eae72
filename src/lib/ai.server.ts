import { createOpenAI } from "@ai-sdk/openai";
import {
  APICallError,
  RetryError,
  convertToModelMessages,
  streamText,
  tool,
  validateUIMessages,
  type UIMessage,
} from "ai";
import { z } from "zod";

const date = z.string().nullable().describe("Data no formato AAAA-MM-DD, ou null para hoje");
const exercise = z.object({
  name: z.string(),
  sets: z.number(),
  reps: z.number(),
  weight: z.number().nullable().describe("Carga em kg ou null"),
});

const out = z.object({ ok: z.boolean(), message: z.string() });

// Ferramentas sem `execute`: o celular mostra uma confirmação e só então altera os dados locais.
export const tools = {
  add_transaction: tool({
    description: "Registrar uma receita ou despesa",
    inputSchema: z.object({
      type: z.enum(["receita", "despesa"]),
      description: z.string(),
      amount: z.number().describe("Valor positivo em reais"),
      category: z.string(),
      date,
    }),
    outputSchema: out,
  }),
  add_bill: tool({
    description: "Cadastrar uma conta a pagar",
    inputSchema: z.object({
      description: z.string(),
      amount: z.number(),
      dueDate: z.string().describe("AAAA-MM-DD"),
    }),
    outputSchema: out,
  }),
  add_task: tool({
    description: "Criar uma tarefa na rotina",
    inputSchema: z.object({
      title: z.string(),
      date,
      time: z.string().nullable().describe("HH:MM ou null"),
      priority: z.enum(["alta", "media", "baixa"]).nullable(),
    }),
    outputSchema: out,
  }),
  complete_task: tool({
    description:
      "Marcar uma tarefa existente como concluída (precisa do id dos dados compartilhados)",
    inputSchema: z.object({ taskId: z.string() }),
    outputSchema: out,
  }),
  delete_task: tool({
    description: "Excluir uma tarefa existente (precisa do id dos dados compartilhados)",
    inputSchema: z.object({ taskId: z.string() }),
    outputSchema: out,
  }),
  add_habit: tool({
    description: "Criar um novo hábito",
    inputSchema: z.object({ name: z.string() }),
    outputSchema: out,
  }),
  add_finance_goal: tool({
    description: "Criar uma meta financeira",
    inputSchema: z.object({
      name: z.string(),
      targetAmount: z.number(),
      currentAmount: z.number().nullable(),
      deadline: z.string().nullable().describe("AAAA-MM-DD ou null"),
    }),
    outputSchema: out,
  }),
  add_health_goal: tool({
    description: "Criar uma meta de saúde (peso, treinos, hábito ou outra)",
    inputSchema: z.object({
      name: z.string(),
      category: z.enum(["peso", "treinos", "habito", "outra"]),
      currentValue: z.number(),
      targetValue: z.number(),
      unit: z.string(),
      deadline: z.string().nullable(),
    }),
    outputSchema: out,
  }),
  create_workout_plan: tool({
    description: "Criar um plano de treino com exercícios",
    inputSchema: z.object({ name: z.string(), exercises: z.array(exercise) }),
    outputSchema: out,
  }),
  add_exercise_to_plan: tool({
    description: "Adicionar exercício a um plano existente (precisa do id do plano)",
    inputSchema: z.object({ planId: z.string(), exercise }),
    outputSchema: out,
  }),
  log_workout: tool({
    description: "Registrar um treino concluído de um plano existente",
    inputSchema: z.object({ planId: z.string(), date, notes: z.string().nullable() }),
    outputSchema: out,
  }),
  add_business_sale: tool({
    description:
      "Registrar uma venda do negócio. O total é calculado como quantidade × valor unitário − desconto. Pagamentos/recebimentos são lançados depois com register_sale_payment.",
    inputSchema: z.object({
      customer: z.string().describe("Nome do comprador"),
      product: z.string().describe("Produto ou serviço"),
      quantity: z.number().describe("Quantidade, maior que zero"),
      unitPrice: z.number().describe("Valor unitário em reais"),
      unitCost: z.number().nullable().describe("Custo unitário em reais ou null se desconhecido"),
      discount: z.number().nullable().describe("Desconto total em reais ou null"),
      date,
      paymentMethod: z.string().nullable().describe("Pix, Dinheiro, Cartão etc., ou null"),
      expectedDate: z.string().nullable().describe("Data prevista de recebimento AAAA-MM-DD ou null"),
      notes: z.string().nullable(),
    }),
    outputSchema: out,
  }),
  add_business_expense: tool({
    description: "Registrar um gasto do negócio (nunca usar para despesas pessoais)",
    inputSchema: z.object({
      description: z.string(),
      category: z
        .enum(["Mercadorias e produtos", "Transporte e entregas", "Marketing", "Taxas e tarifas", "Outros gastos"]),
      amount: z.number().describe("Valor positivo em reais"),
      date,
      paid: z.boolean().describe("true se já foi pago"),
      dueDate: z.string().nullable().describe("Vencimento AAAA-MM-DD ou null"),
      notes: z.string().nullable(),
    }),
    outputSchema: out,
  }),
  add_scheduled_payment: tool({
    description: "Agendar um valor a receber ou a pagar do negócio",
    inputSchema: z.object({
      kind: z.enum(["receber", "pagar"]),
      party: z.string().describe("Pessoa, cliente ou empresa"),
      item: z.string().describe("O que foi comprado, vendido ou contratado"),
      amount: z.number().describe("Valor positivo em reais"),
      dueDate: z.string().describe("Data prevista AAAA-MM-DD"),
      notes: z.string().nullable(),
    }),
    outputSchema: out,
  }),
  register_sale_payment: tool({
    description:
      "Registrar um recebimento (total ou parcial) de uma venda existente do negócio (precisa do id da venda dos dados compartilhados)",
    inputSchema: z.object({
      saleId: z.string(),
      amount: z.number().describe("Valor recebido em reais, sem exceder o saldo restante"),
      date,
    }),
    outputSchema: out,
  }),
  register_scheduled_payment: tool({
    description:
      "Registrar um pagamento/recebimento (total ou parcial) de um item agendado existente (precisa do id dos dados compartilhados)",
    inputSchema: z.object({
      scheduledId: z.string(),
      amount: z.number().describe("Valor em reais, sem exceder o saldo restante"),
      date,
    }),
    outputSchema: out,
  }),
};

export function errorText(error: unknown): string {
  // Com novas tentativas, o SDK embrulha o erro real em RetryError.lastError.
  if (RetryError.isInstance(error)) error = error.lastError;
  const status = APICallError.isInstance(error) ? error.statusCode : undefined;
  const name = (error as { name?: unknown } | null)?.name;
  if (name === "TimeoutError" || name === "AbortError")
    return "A IA demorou demais para responder. Tente de novo em instantes.";
  if (status === 429)
    return "Limite de uso atingido no momento. Aguarde alguns instantes e tente de novo.";
  if (status === 503 || (status !== undefined && status >= 500))
    return "A Groq está sobrecarregada ou indisponível agora. Tente de novo em instantes.";
  if (status === 401 || status === 403)
    return "A Groq recusou o acesso. Verifique a chave e as permissões no servidor.";
  if (status === 400)
    return "A Groq não aceitou a solicitação. Verifique a configuração no servidor.";
  if (status === 404)
    return `A Groq informou que o modelo ${GROQ_MODEL} não existe ou que sua chave não tem acesso a ele. Verifique o acesso ao modelo no console da Groq.`;
  return "Não foi possível falar com a IA agora. Verifique a conexão e tente de novo.";
}

export const GROQ_MODEL = "openai/gpt-oss-120b";
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

export async function handleChat(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: "Origem da solicitação não permitida." }, { status: 403 });
  const maxBytes = 128 * 1024;
  if (Number(request.headers.get("content-length")) > maxBytes)
    return Response.json({ error: "Solicitação muito grande." }, { status: 413 });
  let raw = "";
  if (request.body) {
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        return Response.json({ error: "Solicitação muito grande." }, { status: 413 });
      }
      raw += decoder.decode(chunk.value, { stream: true });
    }
    raw += decoder.decode();
  }
  let body: { messages: UIMessage[]; snapshot?: unknown; today?: string | undefined };
  try {
    const parsed = z
      .object({
        messages: z.array(z.unknown()).min(1).max(40),
        snapshot: z.unknown().optional(),
        today: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .parse(JSON.parse(raw));
    const messages = await validateUIMessages({ messages: parsed.messages, tools });
    const last = messages.at(-1);
    if (!last || last.role === "system" || messages.some((message) => message.role === "system"))
      throw new Error("Invalid role");
    if (
      last.role === "user" &&
      !last.parts.some((part) => part.type === "text" && part.text.trim().length > 0)
    )
      throw new Error("Empty message");
    if (
      messages.some((message) =>
        message.parts.some((part) => part.type === "text" && part.text.length > 8000),
      )
    )
      throw new Error("Long message");
    body = { ...parsed, messages };
  } catch {
    return Response.json(
      { error: "Requisição inválida: verifique a mensagem e o tamanho da conversa." },
      { status: 400 },
    );
  }
  const apiKey =
    process.env["GERENCIADOR_DE_VIDA_API_KEY"]?.trim() || process.env["GROQ_API_KEY"]?.trim();
  if (!apiKey)
    return Response.json(
      {
        code: "AI_NOT_CONFIGURED",
        error:
          "A Groq ainda não está configurada neste ambiente. Configure GERENCIADOR_DE_VIDA_API_KEY no servidor e tente novamente.",
      },
      { status: 409 },
    );
  const groq = createOpenAI({ apiKey, baseURL: GROQ_BASE_URL, name: "groq" });

  const messages = body.messages;

  const today =
    typeof body.today === "string"
      ? body.today.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  const snapshot = body.snapshot ? JSON.stringify(body.snapshot).slice(0, 20000) : null;

  const instructions = [
    "Você é o assistente do app Gerenciador de Vida. Responda sempre em português do Brasil, de forma curta e prática.",
    "Ajude com rotina, tarefas, finanças pessoais (valores em BRL), negócio (vendas, gastos e pagamentos agendados), hábitos, metas e treinos.",
    "Para o negócio: consulte negocioVendas, negocioAgendados e negocioGastos dos dados compartilhados. Novas vendas nascem com recebimento pendente; registre recebimentos/pagamentos com register_sale_payment ou register_scheduled_payment, sem exceder o saldo restante. Não confunda gastos do negócio com despesas pessoais.",
    "Quando o usuário pedir para criar/registrar/alterar algo, use as ferramentas. Cada ação é confirmada pelo usuário no aparelho antes de ser salva; não diga que salvou antes de receber o resultado.",
    "Se faltar uma informação essencial (ex.: valor de uma despesa), pergunte antes de chamar a ferramenta.",
    `Hoje é ${today}. Use datas no formato AAAA-MM-DD.`,
    snapshot
      ? `Dados atuais do usuário: ${snapshot}`
      : "Dados atuais do usuário disponíveis para consulta no app.",
  ].join("\n");

  try {
    const result = streamText({
      model: groq.chat(GROQ_MODEL),
      instructions,
      messages: await convertToModelMessages(messages),
      tools,
      // Cancela se o usuário parar/fechar ou se a Groq passar de 90s.
      abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(90_000)]),
      maxRetries: 1,
    });

    return result.toUIMessageStreamResponse({ originalMessages: messages, onError: errorText });
  } catch (error) {
    return Response.json({ error: errorText(error) }, { status: 502 });
  }
}
