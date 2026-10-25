import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Gerenciador de Vida" },
      {
        name: "description",
        content: "Entre com sua conta Google para acessar seus dados.",
      },
      { property: "og:title", content: "Entrar — Gerenciador de Vida" },
      {
        property: "og:description",
        content: "Entre com sua conta Google para acessar seus dados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    const params = new URLSearchParams(
      `${window.location.search}&${window.location.hash.replace(/^#/, "")}`
    );

    const providerError =
      params.get("error_description") ?? params.get("error");

    if (providerError) {
      setError(`Não foi possível entrar: ${providerError}`);
    }

    supabase.auth.getUser().then(({ data, error: userError }) => {
      if (!active || userError || !data.user) return;

      navigate({ to: "/", replace: true });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && event === "SIGNED_IN" && session) {
        navigate({ to: "/", replace: true });
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  async function signIn() {
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      const { error: authError } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth`,
            queryParams: {
              prompt: "select_account",
            },
          },
        });

      if (authError) {
        setError(
          `Não foi possível entrar com o Google: ${authError.message}`
        );
        setBusy(false);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? `Não foi possível entrar: ${e.message}`
          : "Falha de conexão. Tente novamente."
      );
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <img
          src="/icon-192.png"
          alt=""
          className="mx-auto h-16 w-16 rounded-2xl"
        />

        <div>
          <h1 className="text-2xl font-semibold">
            Gerenciador de Vida
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Entre para acessar suas finanças, negócio, rotina e treinos
            em qualquer aparelho.
          </p>
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={signIn}
          disabled={busy}
        >
          {busy ? "Abrindo Google…" : "Entrar com Google"}
        </Button>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
