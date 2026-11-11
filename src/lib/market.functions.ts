import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { economicIndicators, quotes } from "@/lib/market.server";
import { cryptoQuotes, exchangeRate, usQuotes } from "./global-market.server";

export const getIndicators = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(() => economicIndicators());

export const getQuotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tickers: z.array(z.string()).max(10) }).parse(d))
  .handler(({ data }) => quotes(data.tickers, "1mo"));

export const getGlobalMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ us: z.array(z.string()).max(10), crypto: z.array(z.string()).max(10) }).parse(d))
  .handler(async ({ data }) => {
    const [fx, us, crypto] = await Promise.all([exchangeRate(), usQuotes(data.us), cryptoQuotes(data.crypto)]);
    return { fx, us, crypto };
  });
