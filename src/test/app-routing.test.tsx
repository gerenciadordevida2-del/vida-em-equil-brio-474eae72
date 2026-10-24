import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    for (const path of [
      "/",
      "/metas",
      "/financas",
      "/rotina",
      "/treinos",
      "/assistente",
      "/ajustes",
      "/api/chat",
      "/auth",
    ]) {
      const matches = router.matchRoutes(path);
      expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
      expect([path, `/_authenticated${path}`]).toContain(matches.at(-1)?.routeId);
    }
  });
});
