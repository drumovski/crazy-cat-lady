import { AnimatePresence } from "framer-motion";
import Card from "./Card.jsx";

// Compact "opponent" panel: name, points, turn indicator, and their
// collected cats shown small and face-up. Never shows a hand — hands are
// only ever shown for whichever player's turn/seat is currently revealed,
// in a separate dedicated panel (see GameBoard's "Your Cats" + hand fan).
export default function PlayerPanel({
  player,
  name,
  isCurrentTurn,
  onCatClick,
  catsSelectable,
  chosenCatId,
  blockCountdown = null
}) {
  const points = player.cats.reduce((sum, cat) => sum + cat.points, 0);

  return (
    <div className={`player-panel${isCurrentTurn ? " player-panel-turn" : ""}`}>
      <div className="player-panel-header">
        <div className="player-panel-name">{name || `Player ${player.id + 1}`}</div>
        <div className="player-score">{points} pts</div>
        {/* Small stand-in for the big central .block-timer-overlay, shown to
            everyone *except* the actual block target (see GameBoard.jsx's
            bystanderBlockTargetId) — they have nothing to act on, so a
            small badge on the targeted player's own panel reads more
            clearly than a full-screen countdown that isn't theirs to use. */}
        {blockCountdown !== null && <div className="player-block-countdown">{blockCountdown}</div>}
      </div>

      <div className="player-cats">
        <AnimatePresence>
          {player.cats.map((cat, catIndex) => {
            // Guarded cats can't be targeted by Fish/Catnip at all (enforced
            // engine-side too, in playFish/playCatnip) — excluded from
            // selection here rather than just letting the click get rejected.
            const targetable = catsSelectable && !cat.guarded;
            return (
              <div key={cat.id} className="mini-cat">
                <Card
                  card={cat}
                  size="mini"
                  selectable={targetable}
                  chosen={cat.id === chosenCatId}
                  onClick={targetable ? () => onCatClick(catIndex) : undefined}
                />
              </div>
            );
          })}
        </AnimatePresence>
        {player.cats.length === 0 && <span className="player-cats-empty">none</span>}
      </div>
    </div>
  );
}
