import { describe, expect, it } from "vitest";
import { dailyScore, toggleHabitDate } from "@/lib/home-metrics";

describe("Home daily habits", () => {
  it("marks and unmarks today without removing previous dates", () => {
    const habits = [{ id: "water", name: "Água", doneDates: ["2026-10-18"] }];
    const checked = toggleHabitDate(habits, "water", "2026-10-19");
    expect(checked[0]?.doneDates).toEqual(["2026-10-18", "2026-10-19"]);
    expect(toggleHabitDate(checked, "water", "2026-10-19")[0]?.doneDates).toEqual(["2026-10-18"]);
    expect(habits[0]?.doneDates).toEqual(["2026-10-18"]);
  });
  it("scores only today's tasks and habits", () => {
    const tasks = [
      { id: "1", title: "Hoje", date: "2026-10-19", done: true },
      { id: "2", title: "Amanhã", date: "2026-10-20", done: true },
    ];
    expect(dailyScore(tasks, [{ id: "water", name: "Água", doneDates: [] }], "2026-10-19")).toBe(
      50,
    );
    expect(dailyScore([], [], "2026-10-19")).toBe(0);
  });
});
