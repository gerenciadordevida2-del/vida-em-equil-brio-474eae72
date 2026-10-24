<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- App data lives in localStorage via src/lib/store.ts (single JSON blob, versioned) — user wants on-device storage with JSON backup/restore, no backend.
- AI assistant: server route /api/chat (src/lib/ai.server.ts) streams external Groq Chat Completions using the installed createOpenAI adapter's explicit .chat method, reading its API key from a project secret inside handleChat; tools have no server execute and the browser confirms each action before applying it via src/lib/ai-actions.ts — keeps the existing UI stream protocol, credentials server-only, data on-device, and every change user-approved.
- Home-only derived metrics and immutable habit toggling live in src/lib/home-metrics.ts; persist through the existing update function to keep backup data compatible.
- The /metas route reuses the finance goal view and storage; keep workouts available and settings accessible from the Home header to avoid duplicate modules.
- Validate backups atomically before replacing local data; currentAmount is the canonical accumulated goal balance, with no inferred contribution history or schema migration.
- Debt payments use the pure src/lib/debt-payment.ts operation inside update to validate against the same current state that receives the expense, preventing stale-balance inconsistencies.
- Server routes use createFileRoute with server.handlers (the installed TanStack Start has no @tanstack/react-start/api / createAPIFileRoute); the old API breaks the build.
- Business (Negócio) data lives in the optional `business` field of the same v1 store; pure calculations in src/lib/business.ts use integer cents and record cash only via dated payments — keeps old backups valid, personal finances separate, and avoids double counting.
- Daily cone stock stores only the day's initial quantity in `business.stock`; sold/remaining are derived from that day's sales (`soldOn`/`stockStatus`), never stored counters — edits and deletes of sales automatically correct the stock.
