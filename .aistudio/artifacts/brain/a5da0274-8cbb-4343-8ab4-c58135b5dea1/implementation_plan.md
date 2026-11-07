# Implementation Plan - Fixed Viewport Layout & Internal Scrolling

## Goal

Restructure and refine all primary UI screens and the App Shell (`src/components/game/AppShell.tsx` and route views) so that:

1. There is **no website/window-level scrolling** (`h-screen overflow-hidden` on root container).
2. Every primary UI screen acts as a **single full displaying frame** fitted to the viewport height (`flex flex-col h-screen overflow-hidden`).
3. Necessary scrolling is confined **internally within dedicated scrollable container areas** (`overflow-y-auto flex-1 min-h-0`) inside each screen.

## Proposed Changes

### 1. Update App Shell (`src/components/game/AppShell.tsx`)

- Enforce `h-screen overflow-hidden flex flex-col` on the main application layout wrapper.
- Ensure sidebar / bottom navigation and header remain fixed, while the active route content container uses `flex-1 overflow-hidden flex flex-col`.

### 2. Refine Primary Route Screens

Update primary views (`home.tsx`, `empire.tsx`, `markets.tsx`, `realestate.tsx`, `collectibles.tsx`, `research.tsx`, `casino.tsx`, `corporation.tsx`, `achievements.tsx`, `stats.tsx`, `profile.tsx`, `leaderboard.tsx`) to:

- Use `flex flex-col h-full overflow-hidden`.
- Wrap main content areas in `flex-1 overflow-y-auto p-4` (or equivalent compact spacing) so all scrolling is internal.
- Optimize vertical spacing, card heights, and grid layouts to eliminate overflow.

## Verification Plan

- Run `compile_applet` and `lint_applet` to verify compilation and linting pass with 0 errors.
- Test build output via `npm run build`.
