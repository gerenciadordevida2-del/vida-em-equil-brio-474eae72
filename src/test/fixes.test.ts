import { describe, expect, it } from "vitest";
import { findDuplicateCustomer, phoneKey } from "@/lib/commerce";
import { decideStartup, isRevisionConflict } from "@/lib/cloud-sync";
import { reminderStatus, type Customer } from "@/lib/business";
import { emptyData } from "@/lib/store";
import { authorizeChat } from "@/routes/api/chat";

const cust = (id: string, name: string, phone?: string): Customer =>
  ({ id, name, phone, createdAt: "2026-01-01" }) as Customer;

describe("telefones equivalentes", () => {
  it("reconhece o mesmo número com e sem +55", () => {
    expect(phoneKey("+55 (11) 99999-8888")).toBe("11999998888");
    expect(phoneKey("011 99999-8888")).toBe("11999998888");
    expect(findDuplicateCustomer([cust("a", "Ana", "11999998888")], "Ana B", "5511999998888")?.id).toBe("a");
  });
  it("não mescla números diferentes", () => {
    expect(findDuplicateCustomer([cust("a", "Ana", "11999998888")], "Bia", "11999998887")).toBeUndefined();
  });
});

describe("sincronização na inicialização", () => {
  const local = { ...emptyData(), workoutGoal: 5 };
  it("primeiro login com dados locais envia a cópia do aparelho", () => {
    const d = decideStartup({ remote: null, cache: null, meta: null, legacy: local });
    expect(d).toMatchObject({ kind: "push", expected: 0, fromLegacy: true });
  });
  it("outro aparelho sem alterações pendentes usa a nuvem", () => {
    expect(decideStartup({ remote: { data: {}, revision: 4 }, cache: null, meta: null, legacy: local }).kind).toBe("use-remote");
  });
  it("alteração pendente na mesma revisão é reenviada", () => {
    const d = decideStartup({ remote: { data: {}, revision: 4 }, cache: local, meta: { baseRevision: 4, dirty: true }, legacy: null });
    expect(d).toMatchObject({ kind: "push", expected: 4 });
  });
  it("alteração pendente sobre revisão antiga vira conflito, sem sobrescrever", () => {
    const d = decideStartup({ remote: { data: {}, revision: 6 }, cache: local, meta: { baseRevision: 4, dirty: true }, legacy: null });
    expect(d.kind).toBe("conflict");
  });
  it("detecta o erro de revisão do servidor", () => {
    expect(isRevisionConflict("REVISION_CONFLICT: Dados alterados em outro aparelho.")).toBe(true);
    expect(isRevisionConflict("Failed to fetch")).toBe(false);
  });
});

describe("lembretes", () => {
  it("registro antigo conta como conversa aberta, não como enviado", () => {
    expect(reminderStatus({ id: "1", saleId: "s", dueDate: "", sentAt: "2026-01-01", channel: "whatsapp-manual" })).toBe("conversa_aberta");
  });
});

describe("assistente protegido", () => {
  it("recusa visitante sem sessão com 401", async () => {
    process.env["SUPABASE_URL"] = "http://localhost:1";
    process.env["SUPABASE_PUBLISHABLE_KEY"] = "sb_publishable_test";
    const res = await authorizeChat(new Request("http://localhost/api/chat", { method: "POST" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(401);
  });
});
