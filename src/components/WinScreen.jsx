import { motion } from "framer-motion";

// How long to hold off showing this popup after a winner is decided — lets
// the win sound (queued via game.sfxEvents, unaffected by this delay) and
// the final board state land first, rather than the popup snapping in over
// top of them immediately. Purely a display delay: GameBoard.jsx's own
// canInteract already blocks further input the instant game.winner is set,
// regardless of when this component actually mounts (GameBoard's own
// showWinScreen state/effect is what defers that mount, using this constant).
export const WIN_SCREEN_DELAY_MS = 3000;
const WIN_SCREEN_FADE_DURATION_S = 1;

export default function WinScreen({ game, playerNames = [], onNewGame, onPlayAgain, playAgainPending }) {
  const getName = id => playerNames[id] || `Player ${id + 1}`;
  const ranked = [...game.players].sort((a, b) => {
    const pointsA = a.cats.reduce((sum, cat) => sum + cat.points, 0);
    const pointsB = b.cats.reduce((sum, cat) => sum + cat.points, 0);
    return pointsB - pointsA;
  });

  // Deliberately no backdrop-click-to-dismiss here (unlike RulesModal) — the
  // game has genuinely ended and "New Game" is the only real next step,
  // there's no separate toggle that could reopen this popup if a stray
  // click on the dimmed board behind it closed it.
  //
  // Fades in (rather than snapping in instantly) — this component only ever
  // mounts once already-delayed by WIN_SCREEN_DELAY_MS (see GameBoard's
  // showWinScreen effect), so `initial` here is genuinely the first paint,
  // not fighting a re-render.
  return (
    <motion.div
      className="win-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: WIN_SCREEN_FADE_DURATION_S }}
    >
      <div className="win-screen">
        <h1>🎉 {getName(game.winner)} wins!</h1>
        <table className="win-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Cats</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map(player => (
              <tr key={player.id} className={player.id === game.winner ? "win-row-winner" : ""}>
                <td>{getName(player.id)}</td>
                <td>{player.cats.length}</td>
                <td>{player.cats.reduce((sum, cat) => sum + cat.points, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* onPlayAgain is only ever passed in online mode (see App.jsx) —
            local hotseat has no "room" to recreate, "New Game" (back to the
            menu) already covers it there. When both are shown, Play Again is
            the primary action (the common case: same group, go again) and
            New Game demotes to secondary (change players/settings instead). */}
        {onPlayAgain && (
          <button type="button" className="primary-button" onClick={onPlayAgain} disabled={playAgainPending}>
            {playAgainPending ? "Starting…" : "Play Again"}
          </button>
        )}
        <button type="button" className={onPlayAgain ? "secondary-button" : "primary-button"} onClick={onNewGame}>
          New Game
        </button>
      </div>
    </motion.div>
  );
}
