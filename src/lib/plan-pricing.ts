/** Compare an annual catalog price with twelve monthly payments, not a fabricated list price. */
export function annualSavings(monthlyCents: number, annualCents: number | null) {
  if (!Number.isSafeInteger(monthlyCents) || monthlyCents <= 0 ||
      annualCents === null || !Number.isSafeInteger(annualCents) || annualCents <= 0) return null;
  const referenceCents = monthlyCents * 12;
  const savingsCents = referenceCents - annualCents;
  if (savingsCents <= 0) return null;
  return {
    referenceCents,
    savingsCents,
    percent: savingsCents / referenceCents * 100,
    twoMonthsFree: annualCents === monthlyCents * 10,
  };
}

export function allAnnualPlansGiveTwoMonths(plans: { price_cents: number; price_annual_cents: number | null }[]) {
  const paid = plans.filter(p => p.price_cents > 0);
  return paid.length > 0 && paid.every(p => annualSavings(p.price_cents, p.price_annual_cents)?.twoMonthsFree === true);
}