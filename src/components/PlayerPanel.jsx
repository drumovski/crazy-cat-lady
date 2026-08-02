import { AnimatePresence } from "framer-motion";
import Card from "./Card.jsx";

// Compact "opponent" panel: name, points, turn indicator, and their
// collected cats shown small and face-up. Never shows a hand — hands are
// only ever shown for whichever player's turn/seat is currently revealed,
// in a separate dedicated panel (see GameBoard's "Your Cats" + hand fan).
export default function PlayerPanel({ player, name, isCurrentTurn, onCatClick, catsSelectable }) {
  const points = player.cats.reduce((sum, cat) => sum + cat.points, 0);

  return (
    <div className={`player-panel${isCurrentTurn ? " player-panel-turn" : ""}`}>
      <div className="player-panel-header">
        <div className="player-panel-name">{name || `Player ${player.id + 1}`}</div>
        <div className="player-score">{points} pts</div>
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
