import { beforeEach, describe, expect, it, vi } from "vitest";
import { backupSchema } from "@/lib/data-validation";

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  vi.restoreAllMocks();
});
const base = {
  version: 1,
  transactions: [],
  financeGoals: [
    { id: "old", name: "Reserva", targetAmount: 1000, currentAmount: 250, createdAt: "2026-10-19" },
  ],
};
const file = (data: unknown) => ({ size: 100, text: async () => JSON.stringify(data) }) as File;

describe("Atomic local backups", () => {
  it("restores a legacy goal without doubling its saved value", async () => {
    const { importBackup } = await import("@/lib/store");
    await importBackup(file(base));
    const stored = JSON.parse(localStorage.getItem("gerenciador-de-vida:v1") ?? "{}");
    expect(stored.financeGoals[0].currentAmount).toBe(250);
    expect(stored.tasks).toEqual([]);
  });
  it("rejects invalid nested records without replacing existing data", async () => {
    const { importBackup } = await import("@/lib/store");
    await importBackup(file(base));
    const before = localStorage.getItem("gerenciador-de-vida:v1");
    await expect(importBackup(file({ ...base, tasks: [null] }))).rejects.toThrow(
      "Arquivo inválido",
    );
    expect(localStorage.getItem("gerenciador-de-vida:v1")).toBe(before);
    await expect(importBackup(file({ transactions: [], financeGoals: "bad" }))).rejects.toThrow();
    expect(localStorage.getItem("gerenciador-de-vida:v1")).toBe(before);
  });
  it("does not report a successful save when storage fails", async () => {
    const { importBackup, update } = await import("@/lib/store");
    await importBackup(file(base));
    const before = localStorage.getItem("gerenciador-de-vida:v1");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Quota");
    });
    expect(() =>
      update((d) => ({ ...d, habits: [{ id: "1", name: "Água", doneDates: [] }] })),
    ).toThrow("Alteração não salva");
    expect(localStorage.getItem("gerenciador-de-vida:v1")).toBe(before);
  });
  it("rejects invalid dates and negative goals, but preserves zero and above-target savings", () => {
    expect(
      backupSchema.safeParse({
        ...base,
        financeGoals: [{ ...base.financeGoals[0], currentAmount: -1 }],
      }).success,
    ).toBe(false);
    expect(
      backupSchema.safeParse({
        ...base,
        financeGoals: [{ ...base.financeGoals[0], currentAmount: 0 }],
      }).success,
    ).toBe(true);
    expect(
      backupSchema.safeParse({
        ...base,
        financeGoals: [{ ...base.financeGoals[0], currentAmount: 1500 }],
      }).success,
    ).toBe(true);
    expect(
      backupSchema.safeParse({
        ...base,
        financeGoals: [{ ...base.financeGoals[0], createdAt: "2026-02-30" }],
      }).success,
    ).toBe(false);
  });
});
