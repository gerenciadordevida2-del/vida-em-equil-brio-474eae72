import { describe, expect, it } from "vitest";
import {
  effectivePlan,
  formatBRL,
  priceFor,
  trialDaysLeft,
  type CurrentPlan,
  type Plan,
} from "@/lib/plans";

const plan: Plan = {
  id: "p",
  code: "premium",
  name: "Premium",
  description: "",
  price_cents: 1490,
  price_annual_cents: 11990,
  features: [],
  limits: {},
};

const sub = (code: string, status = "trialing"): CurrentPlan => ({
  plan_code: code,
  plan_name: code,
  status,
  billing_interval: "monthly",
  trial_start: "2026-10-01T00:00:00Z",
  trial_end: "2026-10-08T00:00:00Z",
  price_cents: 1490,
  price_annual_cents: 11990,
});

describe("preços dos planos", () => {
  it("formata centavos em reais: 1490 = R$ 14,90 e 29990 = R$ 299,90", () => {
    expect(formatBRL(1490)).toBe("R$ 14,90");
    expect(formatBRL(29990)).toBe("R$ 299,90");
    expect(formatBRL(0)).toBe("R$ 0,00");
  });

  it("usa o preço anual no ciclo anual e cai no mensal se não houver anual", () => {
    expect(priceFor(plan, "monthly")).toBe(1490);
    expect(priceFor(plan, "annual")).toBe(11990);
    expect(priceFor({ ...plan, price_annual_cents: null }, "annual")).toBe(1490);
  });
});

describe("teste grátis de 7 dias", () => {
  it("conta dias restantes arredondando para cima e nunca negativo", () => {
    const now = new Date("2026-10-05T12:00:00Z");
    expect(trialDaysLeft("2026-10-08T00:00:00Z", now)).toBe(3);
    expect(trialDaysLeft("2026-10-05T13:00:00Z", now)).toBe(1);
    expect(trialDaysLeft("2026-10-01T00:00:00Z", now)).toBe(0);
  });
});

describe("hierarquia de acesso", () => {
  it("proprietário vence assinatura, VIP e gratuito", () => {
    expect(effectivePlan(["admin"], sub("negocio"))).toBe("owner");
    expect(effectivePlan(["admin", "vip"], null)).toBe("owner");
  });

  it("assinatura vigente vence VIP; negócio e premium vêm do plano assinado", () => {
    expect(effectivePlan(["vip"], sub("negocio"))).toBe("negocio");
    expect(effectivePlan([], sub("premium"))).toBe("premium");
  });

  it("sem assinatura: VIP vence gratuito; sem nada, gratuito", () => {
    expect(effectivePlan(["vip"], null)).toBe("vip");
    expect(effectivePlan([], null)).toBe("free");
  });

  it("fim de teste nunca remove papéis: admin/VIP continuam quando a assinatura some", () => {
    expect(effectivePlan(["admin"], null)).toBe("owner");
    expect(effectivePlan(["vip"], null)).toBe("vip");
  });
});
