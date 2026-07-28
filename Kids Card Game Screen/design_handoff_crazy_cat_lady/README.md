# Handoff: Crazy Cat Lady — Game Board Screen

## Overview
A single game-board screen for "Crazy Cat Lady," a browser-based kids card game (rummy-style: collect sets/runs of cat cards). Mobile portrait layout, shown inside an iPhone frame for reference only.

## About the Design Files
The files in this bundle are **design references built in HTML** (a custom component format used by the design tool, not a framework) — prototypes showing intended look, layout, and copy, not production code to copy directly. The task is to **recreate this design in the target codebase's existing environment** (React Native, Flutter, native iOS/Android, web, etc.) using its established patterns and libraries — or, if no environment exists yet, choose the most appropriate framework and implement there.

## Fidelity
**High-fidelity**: final colors, typography, spacing, and one working interaction (tap-to-select a hand card) are all intentional and should be recreated pixel-close. Cat card artwork is a placeholder (flat color + simple line-drawn cat face) — swap in real illustrations when available.

## Screens / Views

### Game Board (single screen, mobile portrait ~390×844)
Vertical stack, top to bottom, background is a green radial-gradient "felt" (`#2e7d46` → `#1c5c31` → `#0f3a1e`) with a soft inset vignette shadow.

1. **Header row** — flex row, space-between.
   - Left: circular icon button, "Help" (question-mark icon).
   - Center: pill chip (cream surface, full rounded), cat-ear icon + room name text "Crazy Cat Lady", Caprasimo-style display font, ~13px.
   - Right: two circular icon buttons, "New Game" (refresh icon) and "Exit" (door/arrow icon). All icon buttons ~28×28px, stroke-width 2.75.

2. **Win-condition banner** — pill, sage/accent-2 tinted background, trophy icon + text "Win condition: 5 Cats or 40 points", ~10.5px bold.

3. **Opponents row** — up to 4 player cards side by side, equal width, each: cream surface card, name (bold, ~11.5px), points pill badge ("N pts"), a small "Turn" badge + colored glow/pulse ring on whichever player is active, and a row of their face-up collected cat cards (mini, ~24px wide).

4. **Game board** — flex row, three groups, vertically centered, this section flex-grows to push the sections below it toward the bottom of the screen:
   - Left: 2×3 grid (2 columns, 3 rows) of face-down cat cards, 6 total, ~42px wide each.
   - Center: draw pile (1 face-down card, ~42px, labeled "Draw") stacked above discard pile (1 face-up card, ~42px, labeled "Discard"). No cards stacked underneath — each pile shows exactly one card.
   - Right: mirror of the left — 2×3 grid, 6 face-down cards.
   - Total board cards: 12, split 6/6 around the center piles.

5. **"Your Cats" panel** — label on top, then a wrapping row of the player's own collected cat cards (face-up), sized to match the hand cards (~62px wide). Shows an italic "No cats yet" placeholder when empty (0 cards); supports up to 7.

6. **Message banner** — cream surface card, rounded rect (not full pill), stacked column of the 3 most recent game messages: newest on top at full opacity/weight-600/~11.5px with an emoji, older two below at reduced opacity (0.7, 0.55) and smaller size (~10px) — a lightweight in-game log.

7. **Player's hand** — bottom row, 5 face-up cat cards (~62px wide), fanned via rotation (−10°/−5°/0°/5°/10°) and slight vertical arc offset, overlapping via negative margins. Tapping a card lifts it (translateY −14px extra) and gives it an accent-colored border to indicate selection — this is the one implemented interaction (selection only; no play/discard logic wired up).

## Interactions & Behavior
- **Tap a hand card**: toggles "selected" state — lifts the card and adds an accent border ring. Only one card selectable at a time. No further action is wired (no actual play/discard).
- **Active player indicator**: whichever opponent is "active" gets a pulsing accent-colored glow ring (`box-shadow` animation, 2.2s ease-in-out loop) and a small "Turn" badge.
- Header buttons (Help / New Game / Exit) are visual only — no handlers wired.
- No animations for draw/discard/deal — those are implementation details left to the developer.

## State Management (for a real implementation)
- Current player's hand (array of cards), collected cats (0–7), points.
- Up to 4 opponents: name, points, collected cats, "is it their turn" flag.
- Draw pile count/order, discard pile (top card visible, rest hidden).
- 12 face-down board cards (6 left / 6 right of the piles) — likely a shared/neutral pool in the real game rules; this mock treats them as pure decoration.
- Message log (list, most recent first, cap at ~3 visible).
- Selected-hand-card index (UI-only selection state before a play/discard action is confirmed).

## Design Tokens
Pulled from the bound "Organic" design system (`_ds/organic-*/styles.css` — the authoritative source, read it for exact values):
- `--color-accent` (terracotta, ~#c67139) and its 100–900 ramp — used for the room chip text, points badge, hand-card selection ring.
- `--color-accent-2` (sage, ~#7a8a5e) and its ramp — used for the win-condition banner and "Their turn" badge.
- `--color-neutral-*` ramp and `--color-surface` (cream) — card surfaces, headers, panels.
- `--font-heading` (Caprasimo) for the room name; `--font-body` (Figtree) for everything else.
- `--radius-md` / `--radius-lg`, `--shadow-sm/md/lg` — used on all UI chrome (headers, panels, buttons). Playing cards themselves use a small custom radius (≈7% of card width) to read like real playing cards rather than the system's usual over-rounded style.
- Felt background color is a custom green gradient, intentionally outside the design system's warm palette (explicit user requirement — "green felt like a poker table").
- 4 cat-card "suit" colors (placeholder, not from a real card asset): Tabby = accent-500, Siamese = accent-2-500, Midnight = neutral-900, Snow = neutral-100 (dark text).

## Assets
No real imagery — all cat cards use an inline SVG placeholder face (two ear triangles, a rounded head outline, two dot eyes, a small nose/mouth path) tinted per suit color. Replace with real cat illustrations per suit/rank when available. Icon buttons (help/refresh/exit) are hand-drawn inline SVGs, not from an icon library.

## Files
- `Kitty Corner - Game Board.dc.html` — the full screen (layout + all game data, hardcoded as sample/mock data in the component's script).
- `CatCard.dc.html` — the reusable playing-card component (face-up/face-down, any suit color, any size) used everywhere a card appears.
- `ios-frame.jsx` — iPhone device bezel used only to preview the mobile ratio; not part of the actual UI.
- `_ds/` — the bound "Organic" design system: `styles.css` (design tokens + component classes) and its bundle. Read `styles.css` for exact color hex values, spacing scale, and font stacks.
