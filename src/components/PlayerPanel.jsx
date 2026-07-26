import Card from "./Card.jsx";

export default function PlayerPanel({
  player,
  name,
  isAi,
  isActive,
  isCurrentTurn,
  onCardClick,
  selectedCardIndices = [],
  onPanelClick,
  panelSelectable,
  onCatClick,
  catsSelectable
}) {
  const points = player.cats.reduce((sum, cat) => sum + cat.points, 0);

  return (
    <div
      className={`player-panel${isCurrentTurn ? " player-panel-turn" : ""}${panelSelectable ? " player-panel-selectable" : ""}`}
      onClick={panelSelectable ? onPanelClick : undefined}
      role={panelSelectable ? "button" : undefined}
      tabIndex={panelSelectable ? 0 : undefined}
    >
      <h3>
        {name || `Player ${player.id + 1}`}
        {isAi ? " 🤖" : ""}
        {isCurrentTurn ? " (current turn)" : ""}
      </h3>
      <div className="player-score">{player.cats.length} cats · {points} pts</div>

      <div className="player-cats">
        {player.cats.map((cat, catIndex) => (
          <button
            key={cat.id}
            type="button"
            className="cat-chip"
            onClick={catsSelectable ? () => onCatClick(catIndex) : undefined}
            disabled={!catsSelectable}
          >
            <span className="cat-chip-emoji">🐱</span>
            <span className="cat-chip-name">{cat.name}</span>
            <span className="cat-chip-points">{cat.points} pts</span>
          </button>
        ))}
      </div>

      <div className="player-hand">
        {isActive
          ? player.hand.map((card, cardIndex) => (
              <Card
                key={cardIndex}
                card={card}
                selected={selectedCardIndices.includes(cardIndex)}
                onClick={onCardClick ? () => onCardClick(cardIndex) : undefined}
              />
            ))
          : player.hand.map((_, cardIndex) => (
              <div key={cardIndex} className="card card-back" />
            ))}
      </div>
    </div>
  );
}
