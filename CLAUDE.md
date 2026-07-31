# Crazy Cat Lady

A reskin of the kids' card game Sleeping Queens, renamed to avoid copyright issues. Card mapping:

| Sleeping Queens | Crazy Cat Lady | Effect |
|---|---|---|
| Queens | Cats | Collected; the win condition |
| Kings | Dogs | Wake a sleeping cat |
| Knights | Fish | Steal an awake cat from another player |
| Dragons | Seagulls | Block/counter a Fish steal ("they eat the fish") |
| Sleeping Potion | Catnip | Put an opponent's awake cat back to sleep |
| Wands | Snails | Counter Catnip ("eat the catnip") |
| Jesters | Laser Pointer | Reveal the top card; Number cards count around the table |

Theme: become "a crazy cat lady" by collecting the most cats/points.

**Goals**: must support real **online multiplayer** (not just local hotseat), with the end goal of deploying to the user's own server as a public demo of "vibe coding" (AI-assisted development).

Origin: the user started this in a claude.ai web chat, then moved to Claude Code/VSCode. That earlier chat history isn't importable — the code in this repo (github.com/drumovski/crazy-cat-lady) is the sole source of truth.

## Development

```bash
npm install
npm run dev      # Vite dev server (the UI)
npm run server   # multiplayer server (needed for online play)
npm run build    # production build
npm run lint     # oxlint
node src/game/engine.test.js   # engine test suite (console.log assertions, not a runner)
node src/game/ai.test.js       # AI policy test suite
```

Local hotseat only needs `npm run dev`. Online multiplayer needs `npm run dev` + `npm run server` together (separate terminals).

## Repo layout

- `src/game/engine.js` — pure game logic (deck, turns, win conditions, sfx event tracking). No UI or networking. Mutates its `game` argument in place and returns it, rather than returning a new object.
- `src/game/engine.test.js` — console.log-assertion test suite (no framework); run with `node`.
- `src/game/ai.js` / `ai.test.js` — AI opponent decision policy, deliberately kept separate from `engine.js` ("who is AI" is a UI-layer concept the engine doesn't know about).
- `src/game/blockTimer.js` — shared constants/validator for the configurable block-response countdown.
- `src/game/timings.js` — the *fixed* (non-player-configurable) timing constants, `AI_THINK_DELAY_MS` and `LASER_REVEAL_DELAY_MS`, imported by both `App.jsx` (local hotseat) and `server/rooms.js` (online) so there's one number to change instead of two hand-kept-in-sync copies. Intended home for any future animation-duration constants too (e.g. a card-fly duration once Framer Motion lands).
- `src/sound/sfx.js` — sound-effect playback (see "Sound effects" below).
- `src/components/` — the React UI, shared between local hotseat and online play via `GameBoard`'s `myPlayerId` prop (see below).
- `server/` — Socket.IO server: authoritative game state, named rooms, server-run AI turns.
- `src/multiplayer/socketClient.js` — browser-side Socket.IO client.
- `public/sounds/` — sound effect files (mp3), served statically.
- `public/cards/` — illustrated card artwork (png), served statically (see "UI / design" below).
- `Rules.md` — the plain-English rules, single source of truth for player-facing rules text. Rendered in-app by `src/components/RulesModal.jsx`, which imports it as raw text via Vite's `?raw` import suffix and runs it through a small format-specific markdown-lite parser (not a general parser — it only handles this file's actual patterns: whole-line `**bold**` as headings, numbered/bulleted lists, `>` blockquotes, inline `**bold**`). Deliberately dependency-free rather than pulling in a markdown library for one static file. Opened from `ModeSelect.jsx`'s "Rules" button and from `GameBoard.jsx`'s help popover ("Full Rules" link, next to the existing quick-reference blurb). If you edit `Rules.md`, keep it to the block patterns the parser understands (see `RulesModal.jsx`'s comments) or the new content will render as an unstyled paragraph.

## Game engine details

**Cat roster**: `createCats()` returns 12 specifically-named cats (not generic): 2× Ginger Tom (15pts each), Maine Coon (20), Calico (15), Persian (15), Toyger (10), Ragdoll (10), Bombay (10), Russian Blue (10), Sphynx (5), Siamese (5), Bengal (5). Total 135 points, matching the original Sleeping Queens deck.

- **Sleeping cats are fixed slots, not a queue.** `createSleepingCats()` shuffles the 12 cats once into 12 fixed positions; waking targets a specific slot (`wakeCatAtSlot`), and a cat put back to sleep (`putCatBackToSleep`) always returns to its own home slot. This is deliberate — players should be able to remember and re-target slots, like the physical face-down grid in the original game. Never replace with random/FIFO drawing for player-facing choices.
- **Ginger Tom conflict**: the two Ginger Toms can't both be in one player's collection. If a player would gain the second one (Dog wake, Fish steal, Laser Pointer), it goes back to sleep in its own slot instead (`giveCatToPlayer`).
- **Sphynx bonus wake**: waking the Sphynx lets that player immediately wake one more sleeping cat. Modeled as `game.pendingWakeChoice = { playerId, bonus: true, actorId }`, resolved via `respondToWakeChoice`/`respondToWakeChoiceAsAi`. Chains again if the bonus cat is itself `wakesBonus` (future-proofing; only the Sphynx has this trait today).
- **Win condition**: 5 cats OR 50 points (2-3 players), 4 cats OR 40 points (4-5 players) — `checkWinner`/`getWinThresholds`. With 3+ players it's possible for all 12 cats to be distributed with no one crossing the threshold; when `sleepingCats` are all null, `checkWinner` falls back to the points leader (ties: cat count, then lowest player id).
- **Blocking is a real reaction**: playing a Fish/Catnip against a target holding a Seagull/Snail sets `game.pendingAction`, resolved via `respondToPendingAction(game, targetPlayerId, blockCardIndex)` (or `null` to decline). AI always blocks when able (`respondAsAi`, no bluffing). Humans get a configurable response window (see "Block timer" below); if they don't respond in time the UI calls `respondToPendingAction(..., null)`.
- **Laser Pointer reveal is a two-step, timer-driven flip.** `playLaserPointer` only flips the top deck card face-up in place (`game.pendingLaserReveal = { playerId, revealedCard }`) — it does not yet add the card to a hand or start the wake-choice count. `resolveLaserReveal(game)` applies that effect and is called ~2s later so every player gets a beat to see the card before it resolves. This isn't a decision anyone (human or AI) makes, so `validateTurn` blocks all other actions while it's pending, same as `pendingAction`/`pendingWakeChoice`. Local hotseat drives the 2s timer client-side in `App.jsx`; online drives it server-side in `server/rooms.js`'s `scheduleNextStep` (renamed from `scheduleAiIfNeeded` — it now also owns this non-AI automatic step, chaining into AI scheduling afterward). Both timers come from `src/game/timings.js`'s `LASER_REVEAL_DELAY_MS`/`AI_THINK_DELAY_MS` (see "Repo layout") rather than two hand-synced copies.
- **Every card has a stable `id`, separate from its position in any array.** `createDeck()` assigns each draw-deck card an incrementing `id` at creation (`createCats()` already did this for the 12 cats); it never changes as the card moves between deck/hand/discard/reshuffle. This matters because a card's *index* in `player.hand` is not stable — playing/discarding one splices it out and shifts every later card down an index — so any UI code that needs to track "this specific card" across renders (React `key`s, and eventually Framer Motion's `layoutId` for fly animations) must key off `card.id`, never the array index. `GameBoard.jsx`'s hand fan already does this (`key={card.id}`). Engine functions themselves stay index-based (`cardIndex` params) since those are only ever resolved synchronously at the moment of a click, before any array mutation — no need to thread ids through the engine's public API.
- **Dog cards can't be discarded** — `discardCard` rejects `type === "dog"` outright (must be played, not discarded). Enforced engine-side (authoritative for online) and the UI's discard-pile target excludes Dog selections too.
- **Discarding**: single non-Dog card (`discardCard`) or a math set — matching pair or an addition set of Number cards (`isValidMathDiscard`, `discardMathSet`) — both draw replacements.
- **`game.lastMessage`** is structured data (`{ playerId, kind, ...fields }`), not pre-formatted text, specifically so the UI can render current player names and pick correct pronouns at render time rather than baking in stale text. `GameBoard.jsx`'s `formatLastMessage` builds the final string, with an `isSelf` parameter — **always false in local hotseat** (no single "you" when the whole screen is shared and turns keep advancing) and `myPlayerId === message.playerId` in online mode. Any new message kind must default to third-person-safe phrasing; don't hardcode "you/your" unless the render is provably gated to the one player it's about — this exact bug class has recurred twice.

### Block timer (configurable)

`src/game/blockTimer.js` defines `BLOCK_TIMER_MIN`/`MAX` (4-20), `DEFAULT_BLOCK_TIMER_SECONDS` (10), and `isValidBlockTimerSeconds` (accepts an int in range, or `null` = no timer/"Never"). Chosen once by the game creator:
- Local: `SetupScreen.jsx` dropdown → threaded through `App.jsx` state → `GameBoard` prop.
- Online: `OnlineSetup.jsx`'s "Create Room" screen only (joiners inherit it) → `server/rooms.js` sanitizes/clamps it server-side (never trust the client value) → stored on the room → broadcast via `roomState`.
- `GameBoard.jsx`: `null` skips starting the countdown entirely (no overlay, no auto-resolve-unblocked timeout, banner reads "can block at any time").

### Sound effects

`src/game/engine.js` tags a fresh `game.sfxEvents` array (e.g. `["fish", "dealCard"]`, `["shuffle", "dealCard", "dealCard", ...]`) on every real state-changing action; `GameBoard.jsx` consumes it and calls `playSfxBatch` (`src/sound/sfx.js`), which staggers playback ~150ms apart so bursts (a math discard drawing 3 cards) read as distinct sounds rather than one blob.

- **Reset timing matters**: `game.sfxEvents = []` is set *after* each function's validation checks pass, not unconditionally at the top. This is deliberate — React StrictMode (dev only) double-invokes the same state-updater call, and the second (rejected-by-validation) invocation must not wipe out the sfxEvents the first, real call already recorded. If you add a new mutating action, follow this same placement.
- `createGame` seeds `sfxEvents` with `["shuffle", ...N × "dealCard"]` (initial deal doesn't go through `drawCard`, so it's queued explicitly) — this is what plays on a brand new game.
- `drawCard` pushes `"dealCard"` per card actually drawn; `reshuffleDiscardIntoDeck` pushes `"shuffle"` when it actually reshuffles. Both use `game.sfxEvents?.push(...)` (optional chaining) since not every caller context initializes the array.
- The block-timer countdown has its own looping "clock tick" sound (`startClockTick`/`stopClockTick` in `sfx.js`, a single persistent `Audio` with `loop = true`, distinct from the one-shot event sounds) — started/stopped by the same `useEffect` that runs the countdown in `GameBoard.jsx`, so it's cut off immediately (even mid-clip) whenever the countdown ends, whether by timeout or an early response.
- `GameBoard.jsx` also guards the sfxEvents-consuming effect with a `useRef` (`playedSfxRef`) storing the last-played array *reference* — needed because StrictMode's dev-only double-invoke of *effects* (separate from the double-invoke of state updaters above) would otherwise play every sound batch twice under `npm run dev`. Verified: production build plays each sound exactly once; without the ref guard, dev build played everything twice.
- Sound files live in `public/sounds/` as `.mp3` (converted from the original `.wav` exports to cut deploy size ~10x — e.g. `Laser Pointer2` went from 824KB to 58KB). No `ffmpeg` is installed as a project dependency; conversions so far used a temporarily-installed `@ffmpeg-installer/ffmpeg` (`npm install --no-save`, removed after).
- **Mute setting**: `src/sound/soundSettings.js` holds a single persisted (`localStorage`) `muted` boolean with a plain pub-sub (`getMuted`/`setMuted`/`subscribeMuted`) — module-level state, not React context, so non-React code (`sfx.js`) can read it synchronously before playing anything, same pattern as `sfx.js`'s own module-level `audioCache`/`clockAudio`. `playSfx`/`startClockTick` both check `getMuted()` before playing; the looping clock tick additionally subscribes to stop itself immediately if muted mid-countdown (one-shot sounds already in flight aren't retroactively cut off — not worth tracking every live `Audio` instance for a sub-second ding). `src/components/SoundToggle.jsx` is the UI (a speaker icon button, mirroring `GameBoard.jsx`'s existing hand-drawn SVG icon style), rendered independently on `ModeSelect.jsx` (top-left, absolutely positioned within `.setup-screen`) and in `GameBoard.jsx`'s `board-header` (grouped with the Help icon in a `.board-header-left` wrapper) — only one is ever mounted at a time, but both read/write the same setting so it carries over between screens. If/when music is added, it should read the same `getMuted()`/`subscribeMuted` rather than inventing a parallel setting.

## AI opponents

`src/game/ai.js` — pure, engine-agnostic policy. Priority: Dog (free cat, random available slot) > Fish (steal richest opponent's highest-value cat) > Catnip (same targeting) > Laser Pointer > discard (a same-value Number pair via `findMathDiscardPair`; addition-sets are NOT modeled for AI, deliberately). `chooseAiTurn`/`takeAiTurn` apply a decision by calling straight through to the matching engine function. AI names come from a fixed list (`AI_NAMES`: HAL 9000, R2-D2, C-3PO, WALL-E, Skynet, Agent Smith, Ultron, Baymax, Ava, Bishop, Roy Batty, TARS, CASE, T-800), picked without repeats per game via `pickRandomAiName`.

Local mode: `App.jsx` runs a `useEffect` that, whenever the current decision-maker (turn owner, or a pending action/wake-choice target) is AI-controlled, waits `AI_THINK_DELAY_MS` (700ms) then auto-applies the right response. Online mode: the equivalent lives server-side in `server/rooms.js`'s `scheduleNextStep`, chaining automatically through consecutive AI decision-makers (and through the non-AI Laser Pointer reveal delay — see above).

## Online multiplayer

Node.js + Socket.IO (`server/`). Named rooms (creator picks a name, not a random code), not accounts/matchmaking. Server is fully authoritative — it runs `engine.js` itself, and a client can only ever act as the seat its socket is bound to (`server/rooms.js`'s `socketToSeat` map; `playerId` is never taken from client-sent data).

- `server/rooms.js` — in-memory room store (`Map`, keyed by lowercased room name for case-insensitive lookup; `room.roomName` keeps the creator's original casing for display). Creator always gets seat 0; `numAiOpponents` claims the *last* N seats as AI. `createGame` only runs once every human seat is filled (`room.status` starts `"waiting"`, becomes `"playing"`).
- `server/index.js` — Socket.IO wiring: `createRoom`/`joinRoom` (ack callbacks, which now also carry the full current room state — see below) and `gameAction` (fire-and-forget, `{roomName, type, args}`, `type` maps to one engine function via the `ACTIONS` table in `rooms.js`). Broadcasts full `roomState` after every change.
- `src/multiplayer/socketClient.js` — thin client wrapper. Server URL via `VITE_SERVER_URL` (a Vite env var, read at *build* time, not runtime), defaults to `localhost:3001`. Connects with `transports: ["websocket", "polling"]` — deliberately not WebSocket-only, so a hosting proxy that doesn't pass WebSocket upgrades through cleanly (a real risk on shared-hosting Node.js apps) degrades to long-polling instead of failing to connect outright.
- `GameBoard.jsx` is shared between local and online via an optional `myPlayerId` prop: `undefined` → local hotseat (reveal whoever's turn it is, matching shared-screen pass-and-play); a specific seat id → online (always reveal that seat's own hand regardless of whose turn it is, and gate interactivity on `activePlayerId === myPlayerId`).
- **Known race, fixed**: a client joining/creating and immediately filling the last seat could miss the one-time `"playing"` broadcast if it only started listening for `roomState` *after* processing the join/create ack. Fixed by having the ack itself carry the full room state (`roomState(room)` spread into the ack payload in `server/index.js`), so the client can act on it directly instead of waiting for a broadcast that may have already fired. General lesson: don't have a component re-subscribe and wait for the same one-time event its caller already received — forward the payload instead.
- **Known bug class, fixed**: anywhere a value is normalized for lookup (e.g. room name lowercased for the `rooms` Map), every *other* place using the same raw input (like the Socket.IO room/channel to `.join()`) must use the normalized/canonical version too, or it silently diverges. Caught once already in the room-name join handler.
- No room cleanup/expiry exists — room names are never freed. Not addressed since it wasn't asked for; flag if the user hits "name already in use" friction.

## Deployment

Target: the user's own SiteGround hosting (GrowBig/GoGeek plan — has SiteGround's Site Tools "Node.js App" feature) plus the purchased domain `crazycatladygame.com`. Not yet deployed as of this writing — this documents the intended path.

- **Split across two hosts under one domain**: the static frontend serves from `crazycatladygame.com` (plain static hosting, `public_html`); the Socket.IO server runs as a separate SiteGround Node.js App on a `server.crazycatladygame.com` subdomain. Avoids routing both concerns through one domain/path.
- **Backend**: SiteGround Site Tools → Devs → Node.js App, startup file `server/index.js`. Upload keeping the repo's relative layout intact (`server/` imports from `../src/game/*.js`, so that folder must exist alongside it) — install dependencies via Site Tools' own NPM Install rather than uploading `node_modules`. Needs env var `CLIENT_ORIGIN=https://crazycatladygame.com` (read by `server/index.js`'s CORS config) and SSL enabled on the subdomain (required for `wss://` once the frontend is served over `https`).
- **Frontend**: `VITE_SERVER_URL` must be set at *build* time (Vite bakes it into the bundle, it's not a runtime value) — e.g. `VITE_SERVER_URL=https://server.crazycatladygame.com npm run build` — then upload `dist/`'s contents to `public_html`.
- **Known risk, mitigated**: shared-hosting Node.js apps run behind a proxy layer whose WebSocket-upgrade support isn't guaranteed. `socketClient.js` already allows a long-polling fallback (see above) so this degrades gracefully instead of failing to connect — after deploying, check the browser Network tab to see whether it actually negotiated `websocket` or fell back to `polling`.

## UI / design

A visual redesign (originally based on a reference mockup, since removed from the repo once superseded) has landed for card backs and draw-deck card art; cats are the one piece still pending (see below).

- `src/components/CardBack.jsx` — face-down card rendering, two hand-drawn SVG variants: `"cat"` (teal, paw icon; sleeping-cats grid) and `"deck"` (purple, ball icon; draw pile).
- `src/components/Card.jsx` — face-up cards. Draw-deck action/number cards now use illustrated PNG art from `public/cards/` (`getCardImageSrc`, keyed by `card.type`/`card.value`/`card.variant`) with `.card-has-art`/`.card-art` in `App.css` dropping the CSS-drawn frame so the image's own border shows through. Cats aren't illustrated yet — they still render the emoji + rank + label shell (`🐱`), same as the pre-redesign version.
- **Illustrated-card alt-text flash, fixed**: before an `<img>` finishes loading, the browser renders its `alt` text (the card type) in plain inherited-color text — a real ~1s glitch on a cold load given each card PNG is ~60-100KB. Fixed two ways: `.card-art { color: transparent; font-size: 0; }` in `App.css` hides that fallback outright (a loading card is a blank box, not a stray text readout), and `src/components/preloadCardImages.js`'s `preloadCardImages()` (called once at module scope in `App.jsx`, so it fires as soon as the app loads) warms the browser's image cache for the whole deck ahead of the first hand ever rendering. Its file-path list must stay in sync with `getCardImageSrc` if the art set changes.
- **`GameBoard.jsx`'s `isBoardBusy` is the single gate for "don't accept input right now"** — currently just `Boolean(game.pendingLaserReveal)`, feeding into `canInteract` alongside the existing turn/seat checks. This is deliberately factored out as its own named variable (rather than inlined into `canInteract`) so a future "a card is still mid-flight" condition (once Framer Motion animations land) has one obvious place to OR itself in, instead of a second ad hoc condition threaded through `canInteract` by hand.
- `App.css` has a `@media (min-width: 768px)` desktop scale-up block layered on top of the (mobile-first) base styles from the mockup.
- Known CSS gotcha (fixed once, watch for recurrence): don't dim a card via the generic `.card:disabled { opacity }` rule if that same component is *also* used somewhere it should stay fully bright/opaque (e.g. the "Your Cats" display panel, which is always `disabled` since it's never clickable) — scope the override to the specific container instead (`.your-cats-row .card:disabled { opacity: 1; }`). Same idea for overlapping/fanned cards (`.hand-fan`): darken via `filter: brightness()` rather than `opacity`, since `opacity` on overlapping elements lets the one underneath show through the gap.

## Standing lessons (apply to future work)

1. **Structured data out of the engine, formatting in the UI.** `game.lastMessage`'s `kind` + fields pattern exists so the UI can render current player names / correct pronouns at render time. Don't have the engine emit pre-formatted "Player N ..." strings.
2. **"You/your" phrasing bug class.** Any player-facing text derived from tagged message state must only use second-person phrasing when the render is provably gated to the one player it's about (true in online mode, generally *not* true in local hotseat's shared screen). Default to third-person-safe phrasing otherwise.
3. **Mutate-in-place engine + React StrictMode.** Engine functions mutate their `game` argument and return it; `App.jsx`'s `applyAction` relies on this. StrictMode (dev only) double-invokes the state-updater, so every action currently runs twice per click in `npm run dev` — harmless so far because validation guards (`validateTurn`, `pendingAction`/`pendingWakeChoice` checks) reject the redundant second call, since the first call already mutated the field being checked. This is incidental protection, not designed-in — a new action without an equivalent guard could silently double-apply on a StrictMode double-invoke. Root-cause fix if it ever bites: `structuredClone(prevGame)` before passing into an engine function inside `applyAction`.
4. **Normalize once, use everywhere.** If a value is normalized for lookup purposes (case, whitespace), every other consumer of the same raw input must use the canonical version too.
5. **Server-side validation is authoritative; never trust client-sent values for anything that matters** (playerId, block timer seconds, etc.) — sanitize/clamp server-side even if the UI already prevents bad input.
