import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  isToolUIPart,
  getToolName,
  type UIMessage,
} from "ai";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Send, Square, Check, X, Loader2, RotateCcw } from "lucide-react";
import { Page, Card } from "@/components/AppShell";
import { useData, today } from "@/lib/store";
import { prepareAction, buildSnapshot } from "@/lib/ai-actions";

export const Route = createFileRoute("/_authenticated/assistente")({
  head: () => ({
    meta: [
      { title: "Assistente de IA — Gerenciador de Vida" },
      {
        name: "description",
        content: "Converse em português e organize finanças, rotina, treinos e metas.",
      },
      { property: "og:title", content: "Assistente de IA — Gerenciador de Vida" },
      {
        property: "og:description",
        content: "Converse e execute ações nos seus módulos com confirmação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Assistente,
});

function Assistente() {
  const data = useData();
  const dataRef = useRef(data);
  dataRef.current = data;
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: async (url, options) => {
          try {
            const response = await fetch(url, options);
            
            // Trata erros HTTP como 429 (Too Many Requests), 503 ou mensagens de alta demanda
            if (!response.ok) {
              const body: unknown = await response.json().catch(() => null);
              
              if (response.status === 429 || response.status === 503) {
                throw new Error("O assistente está com alta demanda no momento. Aguarde alguns segundos e tente novamente.");
              }

              const message =
                body && typeof body === "object" && "error" in body && typeof body.error === "string"
                  ? body.error
                  : "Não foi possível falar com a IA agora. Tente novamente.";
              throw new Error(message);
            }
            return response;
          } catch (err: unknown) {
            // Trata falhas de rede ou retry excedido do AI SDK
            if (err instanceof Error) {
              if (err.message.includes("high demand") || err.message.includes("Failed after")) {
                throw new Error("Alta demanda nos servidores da IA. Aguarde um momento e tente novamente.");
              }
              throw err;
            }
            throw new Error("Erro de conexão ao comunicar com o assistente.");
          }
        },
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages,
            today: today(),
            snapshot: buildSnapshot(dataRef.current),
          },
        }),
      }),
  );

  const { messages, sendMessage, status, stop, addToolOutput, setMessages } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: (e) => {
      const msg = e?.message || "";
      if (msg.includes("high demand") || msg.includes("429") || msg.includes("Failed after")) {
        setError("O assistente está com alta demanda nos servidores. Tente novamente em alguns segundos.");
      } else {
        setError(msg || "Erro de conexão com a IA.");
      }
    },
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    if (!busy) inputRef.current?.focus();
  }, [messages, busy]);

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    setInput("");
    void sendMessage({ text });
  };

  const resolve = (toolCallId: string, tool: string, output: unknown) => {
    void addToolOutput({ tool: tool as never, toolCallId, output: output as never });
  };

  return (
    <Page
      title="Assistente"
      subtitle="Groq · em português"
      action={
        messages.length > 0 ? (
          <button
            onClick={() => {
              stop();
              setMessages([]);
              setError(null);
            }}
            className="flex items-center gap-1 rounded-xl border px-3 py-2 text-sm text-muted-foreground"
          >
            <RotateCcw className="h-4 w-4" /> Nova
          </button>
        ) : undefined
      }
    >
      {messages.length === 0 && (
        <Card className="mb-4 space-y-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <Bot className="h-4 w-4 text-primary" /> Experimente pedir:
          </p>
          {[
            "Registre uma despesa de R$ 45 no mercado hoje",
            "Crie um treino de peito com supino 4x10 e crucifixo 3x12",
            "Crie uma tarefa para pagar o aluguel amanhã às 9h, prioridade alta",
            "Analise minhas despesas do mês",
          ].map((s) => (
            <button
              key={s}
              onClick={() => setInput(s)}
              className="block w-full rounded-xl border bg-secondary px-3 py-2 text-left"
            >
              {s}
            </button>
          ))}
          <p className="pt-1 text-xs">
            Toda alteração nos seus dados pede confirmação antes de ser salva.
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {messages.map((m) => (
          <MessageView key={m.id} message={m} onResolve={resolve} data={data} />
        ))}
        {status === "submitted" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Pensando…
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/50 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="chat-composer fixed inset-x-0 z-30 border-t bg-background/95 px-4 py-2 backdrop-blur"
      >
        <div className="mx-auto flex max-w-md items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Escreva sua mensagem…"
            aria-label="Mensagem"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => stop()}
              aria-label="Parar"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              aria-label="Enviar"
              disabled={!input.trim()}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
      <div className="h-16" />
    </Page>
  );
}

function MessageView({
  message,
  onResolve,
  data,
}: {
  message: UIMessage;
  onResolve: (id: string, tool: string, out: unknown) => void;
  data: ReturnType<typeof useData>;
}) {
  if (message.role === "user") {
    const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return (
      <div className="ml-10 rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
        {text}
      </div>
    );
  }
  return (
    <div className="space-y-2 text-sm">
      {message.parts.map((p, i) => {
        if (p.type === "text")
          return (
            <div
              key={i}
              className="prose prose-sm prose-invert max-w-none leading-relaxed [&_p]:my-1 [&_ul]:my-1"
            >
              <ReactMarkdown>{p.text}</ReactMarkdown>
            </div>
          );
        if (isToolUIPart(p))
          return <ActionCard key={p.toolCallId} part={p} onResolve={onResolve} data={data} />;
        return null;
      })}
    </div>
  );
}

function ActionCard({
  part,
  onResolve,
  data,
}: {
  part: Parameters<typeof getToolName>[0];
  onResolve: (id: string, tool: string, out: unknown) => void;
  data: ReturnType<typeof useData>;
}) {
  const name = getToolName(part);
  if (part.state === "input-streaming")
    return (
      <Card className="text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Preparando ação…
      </Card>
    );
  if (part.state === "output-available") {
    const out = part.output as { ok?: boolean; message?: string };
    return (
      <p className={`text-xs ${out?.ok ? "text-primary" : "text-muted-foreground"}`}>
        {out?.ok ? "✓ " : "✕ "}
        {out?.message}
      </p>
    );
  }
  if (part.state === "output-error")
    return <p className="text-xs text-destructive">✕ {part.errorText}</p>;
  if (part.state !== "input-available") return null;

  let prepared: ReturnType<typeof prepareAction> | null = null;
  let invalid: string | null = null;
  try {
    prepared = prepareAction(name, (part.input ?? {}) as Record<string, unknown>, data);
  } catch (e) {
    invalid = e instanceof Error ? e.message : "Entrada inválida";
  }

  if (!prepared) {
    return (
      <Card className="space-y-2 border-destructive/50">
        <p className="text-destructive">Ação inválida: {invalid}</p>
        <button
          onClick={() =>
            onResolve(part.toolCallId, name, { ok: false, message: `Não executado: ${invalid}` })
          }
          className="rounded-xl border px-3 py-2"
        >
          Avisar a IA
        </button>
      </Card>
    );
  }
  return (
    <Card className="space-y-3 border-primary/50">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Confirmar ação</p>
      <p>{prepared.summary}</p>
      <div className="flex gap-2">
        <button
          onClick={() => {
            try {
              onResolve(part.toolCallId, name, { ok: true, message: prepared.apply() });
            } catch (e) {
              onResolve(part.toolCallId, name, {
                ok: false,
                message: e instanceof Error ? e.message : "Falhou",
              });
            }
          }}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary py-2 font-semibold text-primary-foreground"
        >
          <Check className="h-4 w-4" /> Confirmar
        </button>
        <button
          onClick={() =>
            onResolve(part.toolCallId, name, { ok: false, message: "Cancelado pelo usuário" })
          }
          className="flex flex-1 items-center justify-center gap-1 rounded-xl border py-2"
        >
          <X className="h-4 w-4" /> Cancelar
        </button>
      </div>
    </Card>
  );
}
