import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Crown, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Page, Card } from "@/components/AppShell";
import { useMyRoles, planOf, PLAN_LABELS, type AppRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Área do proprietário — Gerenciador de Vida" },
      { name: "description", content: "Gestão de usuários e acesso VIP do Gerenciador de Vida." },
      { property: "og:title", content: "Área do proprietário — Gerenciador de Vida" },
      { property: "og:description", content: "Gestão de usuários e acesso VIP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

type AdminUser = {
  user_id: string;
  email: string;
  display_name: string;
  created_at: string;
  roles: AppRole[];
};

function AdminPage() {
  const { isAdmin, isLoading: rolesLoading } = useMyRoles();
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: async (): Promise<AdminUser[]> => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return (data ?? []) as AdminUser[];
    },
  });

  const setVip = useMutation({
    mutationFn: async ({ target, grant }: { target: string; grant: boolean }) => {
      const { error } = await supabase.rpc("admin_set_vip", { _target: target, _grant: grant });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.grant ? "Acesso VIP ativado." : "Acesso VIP revogado.");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => toast.error("Não foi possível alterar o acesso. Tente novamente."),
  });

  if (rolesLoading)
    return (
      <Page title="Área do proprietário">
        <p className="text-sm text-muted-foreground">Verificando permissões…</p>
      </Page>
    );

  if (!isAdmin)
    return (
      <Page title="Área do proprietário" subtitle="Acesso restrito">
        <Card className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Esta área é exclusiva do proprietário do aplicativo. As permissões são verificadas no
            servidor, então não é possível acessá-la sem autorização.
          </p>
          <Link to="/" className="text-sm font-semibold text-primary underline">
            Voltar ao início
          </Link>
        </Card>
      </Page>
    );

  const users = usersQuery.data ?? [];

  return (
    <Page title="Área do proprietário" subtitle="Usuários e acesso VIP">
      <Card className="mb-4 flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">
          Você é o proprietário. O uso da IA não tem os limites aplicados aos clientes, e somente
          você pode conceder ou revogar o acesso VIP.
        </p>
      </Card>

      {usersQuery.isLoading && (
        <p className="text-sm text-muted-foreground">Carregando usuários…</p>
      )}
      {usersQuery.isError && (
        <Card>
          <p className="text-sm text-destructive">
            Não foi possível carregar a lista de usuários. Verifique sua conexão.
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {users.map((u) => {
          const plan = planOf(u.roles ?? []);
          const isOwner = plan === "owner";
          const isVip = plan === "vip";
          return (
            <Card key={u.user_id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {u.display_name || u.email?.split("@")[0] || "Usuário"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Desde {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span
                  className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isOwner
                      ? "bg-primary text-primary-foreground"
                      : isVip
                        ? "bg-accent text-primary"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {isOwner && <Crown className="h-3 w-3" />}
                  {PLAN_LABELS[plan]}
                </span>
              </div>
              {!isOwner && (
                <button
                  disabled={setVip.isPending}
                  onClick={() => {
                    const action = isVip ? "revogar o VIP" : "ativar o VIP";
                    if (confirm(`Deseja ${action} de ${u.email}?`))
                      setVip.mutate({ target: u.user_id, grant: !isVip });
                  }}
                  className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-50 ${
                    isVip
                      ? "border text-destructive"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {isVip ? (
                    <>
                      <UserMinus className="h-4 w-4" /> Revogar VIP
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" /> Ativar VIP
                    </>
                  )}
                </button>
              )}
            </Card>
          );
        })}
      </div>
    </Page>
  );
}
