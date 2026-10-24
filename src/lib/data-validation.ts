import { z } from "zod";

export const validDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });
const text = z.string().trim().min(1);
const nonneg = z.number().finite().nonnegative();
const positive = z.number().finite().positive();
const id = text;
const exercise = z
  .object({ id, name: text, sets: positive.int(), reps: positive.int(), weight: nonneg.optional() })
  .passthrough();
const financeGoal = z
  .object({
    id,
    name: text,
    targetAmount: positive,
    currentAmount: nonneg,
    deadline: validDate.optional(),
    createdAt: validDate,
    notes: z.string().optional(),
  })
  .passthrough();
const optText = z.string().optional();
const movement = z.object({ date: validDate, amount: positive }).passthrough();
const business = z
  .object({
    sales: z
      .array(
        z
          .object({
            id,
            customer: text,
            product: text,
            quantity: positive,
            unitPrice: nonneg,
            unitCost: nonneg.optional(),
            discount: nonneg,
            date: validDate,
            paymentMethod: z.string(),
            payments: z.array(movement),
            expectedDate: validDate.optional(),
            notes: optText,
          })
          .passthrough(),
      )
      .optional(),
    expenses: z
      .array(
        z
          .object({
            id,
            description: text,
            category: text,
            amount: positive,
            date: validDate,
            paymentMethod: optText,
            paid: z.boolean(),
            paidDate: validDate.optional(),
            dueDate: validDate.optional(),
            notes: optText,
          })
          .passthrough(),
      )
      .optional(),
    scheduled: z
      .array(
        z
          .object({
            id,
            kind: z.enum(["receber", "pagar"]),
            party: text,
            item: text,
            amount: positive,
            dueDate: validDate,
            payments: z.array(movement),
            notes: optText,
          })
          .passthrough(),
      )
      .optional(),
    stock: z.object({ date: validDate, initial: nonneg.int() }).passthrough().optional(),
  })
  .passthrough();
export const backupSchema = z
  .object({
    version: z.literal(1).optional(),
    transactions: z.array(
      z
        .object({
          id,
          type: z.enum(["receita", "despesa"]),
          description: text,
          amount: positive,
          category: text,
          date: validDate,
        })
        .passthrough(),
    ),
    bills: z
      .array(
        z
          .object({
            id,
            description: text,
            amount: positive,
            dueDate: validDate,
            paid: z.boolean(),
          })
          .passthrough(),
      )
      .optional(),
    debts: z
      .array(z.object({ id, name: text, total: positive, paid: nonneg }).passthrough())
      .optional(),
    tasks: z
      .array(
        z
          .object({
            id,
            title: text,
            done: z.boolean(),
            date: validDate,
            time: z
              .string()
              .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
              .optional(),
            priority: z.enum(["alta", "media", "baixa"]).optional(),
          })
          .passthrough(),
      )
      .optional(),
    habits: z
      .array(z.object({ id, name: text, doneDates: z.array(validDate) }).passthrough())
      .optional(),
    plans: z
      .array(z.object({ id, name: text, exercises: z.array(exercise) }).passthrough())
      .optional(),
    workoutLogs: z
      .array(
        z
          .object({
            id,
            planId: text,
            planName: text,
            date: validDate,
            exercises: z.array(exercise),
            notes: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    workoutGoal: nonneg.optional(),
    financeGoals: z.array(financeGoal).optional(),
    healthGoals: z
      .array(
        z
          .object({
            id,
            name: text,
            category: z.enum(["peso", "treinos", "habito", "outra"]),
            currentValue: nonneg,
            targetValue: nonneg,
            startValue: nonneg.optional(),
            unit: z.string(),
            deadline: validDate.optional(),
            createdAt: validDate,
            notes: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    business: business.optional(),
  })
  .passthrough();

export const money = (value: string): number =>
  value.trim() ? Number(value.replace(",", ".")) : NaN;
export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;
