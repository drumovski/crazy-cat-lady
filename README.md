# Crazy Cat Lady

A reimagining of the card game Sleeping Queens — wake, steal, and collect cats to become the Crazy Cat Lady.

## Development

```bash
npm install
npm run dev      # start the local dev server
npm run build    # production build
```

## Project layout

- `src/game/engine.js` — pure game logic (deck, turns, win conditions). No UI or networking.
- `src/game/engine.test.js` — a console.log-assertion test suite; run with `node src/game/engine.test.js`.
- `src/components/` — the React UI (local hotseat play).

## Status

Local hotseat play is implemented. Online multiplayer is not yet built.
