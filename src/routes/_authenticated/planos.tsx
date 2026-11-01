import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Crown, Sparkles, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Page, Card } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { annualSavings, allAnnualPlansGiveTwoMonths } from "@/lib/plan-pricing";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/lib/roles";
import {
  plansQuery,
  currentPlanQuery,
  trialUsedQuery,
  effectivePlan,
  formatBRL,
  priceFor,
  trialDaysLeft,
  EFFECTIVE_PLAN_LABELS,
  type BillingInterval,
  type Plan,
} from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/planos")({
  head: () => ({
    meta: [
      { title: "Planos e assinatura — Gerenciador de Vida" },
      { name: "description", content: "Compare os planos Gratuito, Premium e Negócio e experimente por 7 dias grátis." },
      { property: "og:title", content: "Planos — Gerenciador de Vida" },
      { property: "og:description", content: "Compare os planos e experimente por 7 dias grátis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Planos,
});

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function Planos() {
  const queryClient = useQueryClient();
  const { roles, isAdmin } = useMyRoles();
  const plans = useQuery(plansQuery);
  const current = useQuery(currentPlanQuery);
  const trialUsed = useQuery(trialUsedQuery);
  const [interval, setInterval_] = useState<BillingInterval>("monthly");
  const [busy, setBusy] = useState(false);

  const currentPlan = current.data ?? null;
  const effective = effectivePlan(roles, currentPlan);
  const inTrial =
    currentPlan != null &&
    (currentPlan.status === "trialing" || currentPlan.status === "cancelled") &&
    currentPlan.trial_end != null;

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["my-current-plan"] }),
      queryClient.invalidateQueries({ queryKey: ["my-trial-used"] }),
    ]);
  }

  async function startTrial(plan: Plan) {
    const price = priceFor(plan, interval);
    const cycle = interval === "annual" ? "ano" : "mês";
    const ok = confirm(
      `Experimente ${plan.name} por 7 dias grátis.\n\n` +
        `• Começa agora e termina em 7 dias.\n` +
        `• Após o teste: ${formatBRL(price)}/${cycle}.\n` +
        `• Nenhuma cobrança agora: o pagamento pelo Mercado Pago ainda não está configurado. O teste não gera cobrança nem renovação automática.\n` +
        `• Você pode cancelar durante o teste e manter o acesso até o fim do período, sem cobrança futura.\n` +
        `• O teste grátis pode ser usado uma única vez.\n\n` +
        `Iniciar o teste grátis?`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("start_trial", {
        _plan_code: plan.code,
        _interval: interval,
      });
      if (error) {
        if (error.message.includes("trial_already_used"))
          toast.error("Você já usou seu teste grátis anteriormente.");
        else if (error.message.includes("subscription_exists"))
          toast.error("Você já tem uma assinatura ou teste ativo.");
        else throw error;
        return;
      }
      toast.success(`Teste grátis de ${plan.name} iniciado! Aproveite os 7 dias.`);
      await refresh();
    } catch {
      toast.error("Não foi possível iniciar o teste. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelTrial() {
    if (
      !confirm(
        "Cancelar o teste grátis?\n\nVocê mantém o acesso até o fim do período já concedido e nenhuma cobrança será feita.",
      )
    )
      return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("cancel_trial");
      if (error) throw error;
      toast.success("Teste cancelado. Seu acesso continua até o fim do período.");
      await refresh();
    } catch {
      toast.error("Não foi possível cancelar agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="Planos" subtitle="Experimente Premium ou Negócio por 7 dias grátis">
      {/* Plano atual */}
      <Card className="mb-4 space-y-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Crown className="h-4 w-4 text-primary" /> Seu plano atual
        </h2>
        <p className="text-lg font-bold text-primary">{EFFECTIVE_PLAN_LABELS[effective]}</p>
        {isAdmin && (
          <p className="text-xs text-muted-foreground">
            Seu acesso de proprietário é administrativo e não depende de assinatura.
          </p>
        )}
        {inTrial && currentPlan?.trial_start && currentPlan.trial_end && (
          <div className="space-y-1 rounded-xl bg-secondary p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <Clock className="h-4 w-4 text-primary" />
              Teste grátis de {currentPlan.plan_name}
              {currentPlan.status === "cancelled" ? " (cancelado)" : ""}
            </p>
            <p>Início: {fmtDate(currentPlan.trial_start)}</p>
            <p>
              Termina: {fmtDate(currentPlan.trial_end)} ({trialDaysLeft(currentPlan.trial_end)}{" "}
              {trialDaysLeft(currentPlan.trial_end) === 1 ? "dia restante" : "dias restantes"})
            </p>
            <p>
              Após o teste:{" "}
              {formatBRL(
                currentPlan.billing_interval === "annual"
                  ? (currentPlan.price_annual_cents ?? currentPlan.price_cents)
                  : currentPlan.price_cents,
              )}
              /{currentPlan.billing_interval === "annual" ? "ano" : "mês"} — a cobrança só acontece
              se você autorizar a assinatura e cadastrar um meio de pagamento.
            </p>
            {currentPlan.status === "trialing" && (
              <Button variant="outline"
                onClick={cancelTrial}
                disabled={busy}
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl border text-sm font-semibold disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" /> Cancelar teste (sem cobrança)
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Periodicidade */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(["monthly", "annual"] as const).map((i) => (
          <Button
            key={i}
            variant={interval === i ? "default" : "secondary"}
            aria-pressed={interval === i}
            onClick={() => setInterval_(i)}
            className={`h-11 rounded-xl border text-sm font-semibold ${
              interval === i ? "bg-primary text-primary-foreground" : "bg-secondary"
            }`}
          >
            {i === "annual" ? (allAnnualPlansGiveTwoMonths(plans.data ?? []) ? "Anual (2 meses grátis)" : "Anual") : "Mensal"}
          </Button>
        ))}
      </div>

      {/* Comparação de planos */}
      {plans.isLoading && (
        <p className="text-center text-sm text-muted-foreground">Carregando planos…</p>
      )}
      {plans.isError && (
        <p className="text-center text-sm text-muted-foreground">
          Não foi possível carregar os planos. Verifique sua conexão.
        </p>
      )}
      <div className="space-y-4">
        {(plans.data ?? []).map((plan) => {
          const isCurrent =
            (currentPlan?.plan_code === plan.code) || (effective === "free" && plan.code === "free");
          const paid = plan.price_cents > 0;
          const canTrial = paid && trialUsed.isSuccess && current.isSuccess && !trialUsed.data && !currentPlan && !isAdmin;
          const savings = interval === "annual" ? annualSavings(plan.price_cents, plan.price_annual_cents) : null;
          return (
            <Card key={plan.id} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>
                {isCurrent && (
                  <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                    Seu plano
                  </span>
                )}
              </div>
              {savings && (
                <p className="text-sm text-muted-foreground">
                  <s>{formatBRL(savings.referenceCents)}</s> em 12 mensalidades
                </p>
              )}
              <p className="text-2xl font-bold text-primary">
                {formatBRL(priceFor(plan, interval))}
                <span className="text-sm font-normal text-muted-foreground">
                  /{interval === "annual" ? "ano" : "mês"}
                </span>
              </p>
              {savings && (
                <p className="text-sm font-semibold text-primary">
                  {savings.percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% de desconto anual · Economia de {formatBRL(savings.savingsCents)}
                  {savings.twoMonthsFree ? " · 2 meses grátis" : ""}
                </p>
              )}
              {paid && interval === "monthly" && plan.price_annual_cents != null && (
                <p className="text-xs text-muted-foreground">
                  ou {formatBRL(plan.price_annual_cents)}/ano no plano anual
                </p>
              )}
              <ul className="space-y-1.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {paid && canTrial && (
                <Button
                  onClick={() => startTrial(plan)}
                  disabled={busy}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <Sparkles className="h-5 w-5" /> Testar grátis por 7 dias
                </Button>
              )}
              {paid && !canTrial && !isCurrent && trialUsed.data && !currentPlan && (
                <p className="rounded-xl bg-secondary p-2 text-center text-xs text-muted-foreground">
                  Você já utilizou seu teste grátis.
                </p>
              )}
              {paid && !isAdmin && (
                <p className="text-sm text-muted-foreground">
                  Contratação indisponível: Mercado Pago não configurado. Nenhuma cobrança ou renovação automática será feita.
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="mt-4 space-y-2">
        <h3 className="font-semibold">Sobre a contratação</h3>
        <p className="text-sm text-muted-foreground">
          O Mercado Pago ainda não está conectado neste projeto. A contratação paga depende da configuração
          das credenciais, do checkout e da confirmação segura dos pagamentos. Nenhuma cobrança é feita agora:
          o teste grátis de 7 dias não exige pagamento e, ao terminar sem uma assinatura paga, você volta
          ao plano Gratuito com todos os seus dados preservados. A economia anual compara o valor do ano
          com 12 mensalidades do catálogo; não há promoção mensal ou preço original separado configurados.
        </p>
      </Card>
    </Page>
  );
}
