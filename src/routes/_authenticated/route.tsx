import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCloudSync } from "@/lib/cloud-sync";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function count(d: { transactions: unknown[]; business: { sales: unknown[] } }) {
  return `${d.transactions.length} lançamentos, ${d.business.sales.length} vendas`;
}

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const sync = useCloudSync(user.id);
  const [busy, setBusy] = useState(false);

  if (sync.status === "loading")
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando seus dados…
      </div>
    );

  async function choose(choice: "remote" | "local") {
    setBusy(true);
    try {
      await sync.resolve(choice);
      toast.success(choice === "remote" ? "Usando os dados da nuvem." : "Dados deste aparelho enviados para a nuvem.");
    } catch {
      toast.error("Sem conexão. Tente novamente quando estiver online.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {sync.conflict && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 sm:items-center">
          <div className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-5 shadow-lg">
            <h2 className="text-lg font-semibold">Seus dados mudaram em outro aparelho</h2>
            <p className="text-sm text-muted-foreground">
              Este aparelho tem alterações que ainda não foram enviadas, e a nuvem recebeu outra versão
              enquanto isso. Escolha qual manter. A outra versão pode ser baixada antes como backup.
            </p>
            <div className="space-y-1 rounded-xl bg-secondary p-3 text-sm">
              <p><strong>Neste aparelho:</strong> {count(sync.conflict.local)}</p>
              <p><strong>Na nuvem:</strong> {count(sync.conflict.remote)}</p>
            </div>
            <div className="flex gap-2 text-xs">
              <button className="underline" onClick={() => sync.downloadCopy(sync.conflict!.local, "aparelho")}>
                Baixar cópia do aparelho
              </button>
              <button className="underline" onClick={() => sync.downloadCopy(sync.conflict!.remote, "nuvem")}>
                Baixar cópia da nuvem
              </button>
            </div>
            <div className="grid gap-2">
              <Button disabled={busy} onClick={() => choose("remote")}>Usar dados da nuvem</Button>
              <Button disabled={busy} variant="outline" onClick={() => choose("local")}>
                Usar dados deste aparelho
              </Button>
            </div>
          </div>
        </div>
      )}
      {sync.offline && (
        <div className="bg-secondary px-4 py-1 text-center text-xs text-muted-foreground">
          Sem conexão com a nuvem — alterações salvas neste aparelho
        </div>
      )}
      <Outlet />
    </>
  );
}
