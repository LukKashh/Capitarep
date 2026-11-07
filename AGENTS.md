<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.

<!-- LOVABLE:END -->

## Project rules

- Game logic lives in pure modules under `src/game/` (config, engine, corp, market, collectibles, achievements); UI never computes authoritative balances. Why: one testable, configurable source of truth.
- All balance numbers live in `src/game/config.ts` (and catalogue builders); do not hard-code game values in UI. Why: spec requires configurable balancing.
- Every state change goes through `gameAction` in `src/lib/game.functions.ts`, which ticks with server time and commits via the `commit_game_action` RPC (optimistic version + idempotency key + ledger, one transaction). Clients only have SELECT on their own rows. Why: server-authoritative economy.
- Player and corporation state are JSONB documents (`player_states`, `corporations`); cross-player effects (kicks, accepted applications, objective XP) are reconciled lazily on the affected player's next load. Why: avoids writing other players' rows.
- Markets and collectible valuations are deterministic functions of time (`src/game/rng.ts`), so prices are global, continue offline and are never influenced by player trades.
- tsconfig has `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `noPropertyAccessFromIndexSignature` disabled to keep the catalogue-heavy engine readable.

- Presentation artwork is mapped through `src/components/game/art.ts` and CDN asset pointers; use shared game controls and semantic theme tokens for all screen skins. Why: keeps the reference-led redesign consistent without coupling art to authoritative game configuration.
- Casino outcomes come from a per-round seed HMAC(server secret, user:round) computed in `game.functions.ts` and never stored; open rounds keep only revealed info in state. Why: players can read their own save row, so hidden cards/mines must not live there.
