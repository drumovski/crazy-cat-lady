# Crazy Cat Lady

A reimagining of the card game Sleeping Queens — wake, steal, and collect cats to become the Crazy Cat Lady.

## Development

```bash
npm install
npm run dev      # start the Vite dev server (the UI)
npm run server   # start the multiplayer server (needed for online play)
npm run build    # production build
```

Local hotseat play only needs `npm run dev`. Online multiplayer needs both `npm run dev` and `npm run server` running at the same time (in separate terminals).

## Project layout

- `src/game/engine.js` — pure game logic (deck, turns, win conditions). No UI or networking.
- `src/game/engine.test.js` — a console.log-assertion test suite; run with `node src/game/engine.test.js`.
- `src/game/ai.js` / `ai.test.js` — the AI opponent decision policy.
- `src/components/` — the React UI (local hotseat and online play).
- `server/` — the Socket.IO server: authoritative game state, room codes, server-run AI turns.
- `src/multiplayer/socketClient.js` — the browser-side Socket.IO client used by online mode.

## Status

Local hotseat play, AI opponents, and online multiplayer (room codes, up to 5 players, mix of human/AI seats) are all implemented.
