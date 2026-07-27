import Card from "./Card.jsx";

// Compact "opponent" panel: name, points, turn indicator, and their
// collected cats shown small and face-up. Never shows a hand — hands are
// only ever shown for whichever player's turn/seat is currently revealed,
// in a separate dedicated panel (see GameBoard's "Your Cats" + hand fan).
export default function PlayerPanel({ player, name, isAi, isCurrentTurn, onCatClick, catsSelectable }) {
  const points = player.cats.reduce((sum, cat) => sum + cat.points, 0);

  return (
    <div className={`player-panel${isCurrentTurn ? " player-panel-turn" : ""}`}>
      <div className="player-panel-name">
        {name || `Player ${player.id + 1}`}
        {isAi ? " 🤖" : ""}
      </div>
      <div className="player-score">{points} pts</div>

      <div className="player-cats">
        {player.cats.map((cat, catIndex) => (
          <Card
            key={cat.id}
            card={cat}
            size="mini"
            selectable={catsSelectable}
            onClick={catsSelectable ? () => onCatClick(catIndex) : undefined}
          />
        ))}
        {player.cats.length === 0 && <span className="player-cats-empty">none</span>}
      </div>
    </div>
  );
}
