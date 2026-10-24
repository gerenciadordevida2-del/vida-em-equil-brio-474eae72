import { createFileRoute } from "@tanstack/react-router";
import { Financas } from "@/routes/_authenticated/financas";

export const Route = createFileRoute("/_authenticated/metas")({
  head: () => ({
    meta: [
      { title: "Metas — Gerenciador de Vida" },
      {
        name: "description",
        content: "Crie metas financeiras, registre valores guardados e acompanhe seu progresso.",
      },
      { property: "og:title", content: "Metas — Gerenciador de Vida" },
      {
        property: "og:description",
        content: "Seus objetivos financeiros e valores guardados em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Metas,
});

function Metas() {
  return <Financas initialTab="metas" goalsPage />;
}
