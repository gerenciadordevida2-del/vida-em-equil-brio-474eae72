import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRef } from "react";
import { Download, Upload, Trash2, Smartphone, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Page, Card } from "@/components/AppShell";
import { exportBackup, importBackup, clearAll } from "@/lib/store";
import { useProfile, useUpdateProfile, displayNameOf, avatarOf } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes e backup — Gerenciador de Vida" },
      { name: "description", content: "Faça backup e restaure seus dados do Gerenciador de Vida." },
      { property: "og:title", content: "Ajustes — Gerenciador de Vida" },
      { property: "og:description", content: "Backup e restauração dos seus dados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Ajustes,
});

function Ajustes() {
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = Route.useRouteContext();
  const { data: profile } = useProfile(user);
  const updateProfile = useUpdateProfile(user.id);
  const currentName = displayNameOf(profile, user);
  const avatar = avatarOf(profile, user);
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  const btn = "flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold";
  return (
    <Page title="Ajustes" subtitle="Seus dados ficam salvos na sua conta">
      <Card className="mb-4 space-y-3">
        <h2 className="font-semibold">Conta</h2>
        <div className="flex items-center gap-3">
          {avatar ? (
            <img src={avatar} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent font-semibold text-primary">
              {(currentName || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <p className="min-w-0 truncate text-sm text-muted-foreground">Conectado como {user.email}</p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = String(new FormData(e.currentTarget).get("name") ?? "");
            updateProfile.mutate(
              { display_name: value },
              {
                onSuccess: () => toast.success("Nome atualizado!"),
                onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível salvar."),
              },
            );
          }}
        >
          <input
            key={currentName}
            name="name"
            defaultValue={currentName}
            maxLength={80}
            aria-label="Nome de exibição"
            className="h-12 min-w-0 flex-1 rounded-xl border bg-background px-3"
          />
          <button disabled={updateProfile.isPending} className="h-12 rounded-xl bg-primary px-4 font-semibold text-primary-foreground">
            Salvar
          </button>
        </form>
        <label className="flex items-center justify-between text-sm">
          Lembretes de vencimento no aparelho
          <input
            type="checkbox"
            checked={profile?.preferences?.["notifications"] !== false}
            onChange={(e) =>
              updateProfile.mutate({ preferences: { ...(profile?.preferences ?? {}), notifications: e.target.checked } })
            }
          />
        </label>
        <button onClick={signOut} className={`${btn} border bg-secondary`}>
          <LogOut className="h-5 w-5" /> Sair
        </button>
      </Card>
      <Card className="mb-4 space-y-3">
        <h2 className="font-semibold">Backup</h2>
        <p className="text-sm text-muted-foreground">
          Salve um arquivo com todos os seus dados. Guarde no Google Drive ou envie para você mesmo.
        </p>
        <button
          onClick={() => {
            exportBackup();
            toast.success("Backup gerado!");
          }}
          className={`${btn} bg-primary text-primary-foreground`}
        >
          <Download className="h-5 w-5" /> Fazer backup
        </button>
        <button onClick={() => fileRef.current?.click()} className={`${btn} border bg-secondary`}>
          <Upload className="h-5 w-5" /> Restaurar backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f || !confirm("Restaurar vai substituir os dados atuais. Continuar?")) return;
            try {
              await importBackup(f);
              toast.success("Dados restaurados!");
            } catch {
              toast.error("Arquivo de backup inválido.");
            }
          }}
        />
      </Card>
      <Card className="mb-4 space-y-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Smartphone className="h-4 w-4 text-primary" /> Instalar no celular
        </h2>
        <p className="text-sm text-muted-foreground">
          No Chrome do Android, abra o menu (⋮) e toque em “Adicionar à tela inicial” ou “Instalar
          app”.
        </p>
      </Card>
      <Card>
        <button
          onClick={() => {
            if (confirm("Apagar TODOS os dados? Isso não pode ser desfeito.")) {
              clearAll();
              toast("Dados apagados.");
            }
          }}
          className={`${btn} text-destructive`}
        >
          <Trash2 className="h-5 w-5" /> Apagar todos os dados
        </button>
      </Card>
    </Page>
  );
}
