import { describe, expect, it } from "vitest";
import { annualSavings, allAnnualPlansGiveTwoMonths } from "@/lib/plan-pricing";

describe("descontos comprovados pelo catálogo", () => {
  it("Premium anual economiza 5890 centavos em relação a 12 mensalidades", () => {
    const result = annualSavings(1490, 11990);
    expect(result?.referenceCents).toBe(17880);
    expect(result?.savingsCents).toBe(5890);
    expect(result?.percent).toBeCloseTo(32.9418, 4);
    expect(result?.twoMonthsFree).toBe(false);
  });
  it("Negócio anual economiza 5890 centavos, mas não equivale a dois meses grátis", () => {
    const result = annualSavings(2990, 29990);
    expect(result?.referenceCents).toBe(35880);
    expect(result?.savingsCents).toBe(5890);
    expect(result?.percent).toBeCloseTo(16.4158, 4);
    expect(result?.twoMonthsFree).toBe(false);
  });
  it("dois meses grátis exige exatamente dez mensalidades", () => {
    expect(annualSavings(1490, 14900)?.twoMonthsFree).toBe(true);
    expect(annualSavings(1490, 14901)?.twoMonthsFree).toBe(false);
    expect(allAnnualPlansGiveTwoMonths([
      { price_cents: 1490, price_annual_cents: 11990 },
      { price_cents: 2990, price_annual_cents: 29990 },
    ])).toBe(false);
    expect(allAnnualPlansGiveTwoMonths([])).toBe(false);
  });
  it("não inventa desconto em plano gratuito, anual ausente ou sem economia", () => {
    expect(annualSavings(0, 0)).toBeNull();
    expect(annualSavings(1490, null)).toBeNull();
    expect(annualSavings(1490, 17880)).toBeNull();
    expect(annualSavings(1490, 20000)).toBeNull();
  });
});