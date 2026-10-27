import { describe, expect, it } from "vitest";
import { planOf, PLAN_LIMITS, PLAN_LABELS } from "@/lib/roles";

describe("hierarquia de acesso (dono > VIP > gratuito)", () => {
  it("admin é sempre proprietário, mesmo com outros papéis", () => {
    expect(planOf(["admin"])).toBe("owner");
    expect(planOf(["admin", "vip"])).toBe("owner");
  });

  it("vip sem admin é cliente VIP", () => {
    expect(planOf(["vip"])).toBe("vip");
  });

  it("sem papéis (ou só 'user') é plano gratuito", () => {
    expect(planOf([])).toBe("free");
    expect(planOf(["user"])).toBe("free");
  });

  it("proprietário não tem limite de cliente", () => {
    expect(PLAN_LIMITS.owner).toBeNull();
  });

  it("gratuito mantém os limites atuais (10/min, 200/dia)", () => {
    expect(PLAN_LIMITS.free).toEqual({ perMinute: 10, perDay: 200 });
  });

  it("VIP tem exatamente 5x o limite do gratuito, sem contador duplicado", () => {
    const free = PLAN_LIMITS.free!;
    const vip = PLAN_LIMITS.vip!;
    expect(vip.perMinute).toBe(free.perMinute * 5);
    expect(vip.perDay).toBe(free.perDay * 5);
  });

  it("cada plano tem um rótulo em português", () => {
    expect(PLAN_LABELS.owner).toBe("Proprietário");
    expect(PLAN_LABELS.vip).toBe("Cliente VIP");
    expect(PLAN_LABELS.free).toBe("Plano gratuito");
  });
});
