import type { Habit, Task } from "@/lib/store";

export function toggleHabitDate(habits: Habit[], id: string, date: string): Habit[] {
  return habits.map((habit) =>
    habit.id !== id
      ? habit
      : {
          ...habit,
          doneDates: habit.doneDates.includes(date)
            ? habit.doneDates.filter((day) => day !== date)
            : [...habit.doneDates, date],
        },
  );
}

export function dailyScore(tasks: Task[], habits: Habit[], date: string): number {
  const dailyTasks = tasks.filter((task) => task.date === date);
  const total = dailyTasks.length + habits.length;
  const done =
    dailyTasks.filter((task) => task.done).length +
    habits.filter((habit) => habit.doneDates.includes(date)).length;
  return total === 0 ? 0 : Math.round((done / total) * 100);
}
