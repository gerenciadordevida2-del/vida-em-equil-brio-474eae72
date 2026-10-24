import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCloudSync } from "@/lib/cloud-sync";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const status = useCloudSync(user.id);
  if (status === "loading")
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando seus dados…
      </div>
    );
  return <Outlet />;
}
