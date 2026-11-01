import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "drizzle/migrations/0005_restrict_trial_function_execution.sql"),
  "utf8",
);

describe("permissões do teste grátis", () => {
  it.each(["start_trial(text, text)", "cancel_trial()", "my_current_plan()"])(
    "%s exige conta autenticada e preserva o acesso do servidor",
    (signature) => {
      expect(sql).toContain(`REVOKE EXECUTE ON FUNCTION public.${signature} FROM PUBLIC, anon;`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated, service_role;`);
    },
  );

  it("expiração global fica exclusiva do servidor, não de visitantes ou clientes", () => {
    expect(sql).toContain(
      "REVOKE EXECUTE ON FUNCTION public.expire_trials() FROM PUBLIC, anon, authenticated;",
    );
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.expire_trials() TO service_role;");
  });
});