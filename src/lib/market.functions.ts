import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { economicIndicators, quotes } from "@/lib/market.server";

export const getIndicators = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(() => economicIndicators());

export const getQuotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tickers: z.array(z.string()).max(10) }).parse(d))
  .handler(({ data }) => quotes(data.tickers, "1mo"));
