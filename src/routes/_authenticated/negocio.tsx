import { createFileRoute } from "@tanstack/react-router";
import { Financas } from "@/routes/_authenticated/financas";

export const Route = createFileRoute("/_authenticated/negocio")({
  head: () => ({
    meta: [
      { title: "Negócio — Gerenciador de Vida" },
      {
        name: "description",
        content: "Vendas, clientes, produtos e estoque do seu negócio.",
      },
      { property: "og:title", content: "Negócio — Gerenciador de Vida" },
      {
        property: "og:description",
        content: "Acompanhe vendas, recebimentos e estoque.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Negocio,
});

function Negocio() {
  return <Financas initialTab="negocio" />;
}
