const CARD_INFO = {
  dog: { label: "Dog", emoji: "🐶" },
  fish: { label: "Fish", emoji: "🐟" },
  seagull: { label: "Seagull", emoji: "🕊️" },
  catnip: { label: "Catnip", emoji: "🌿" },
  snail: { label: "Snail", emoji: "🐌" },
  laser: { label: "Laser Pointer", emoji: "🔴" }
};

// size: 'mini' (opponents' collected cats) | 'board' (sleeping cats / draw /
// discard) | 'hand' (your own collected cats + hand) — matches the design's
// three card scales (24px / 42px / 62px wide).
export default function Card({ card, onClick, selected, selectable, eligible, size = "hand" }) {
  // Collected cats (from a player's `cats` array) are a different data shape
  // than action/number cards — same visual card shell, but the "rank" is
  // their point value and the label is their name rather than a card type.
  const isCat = card.type === "cat";
  const rank = isCat ? card.points : card.type === "number" ? card.value : null;
  const info = isCat ? { label: card.name, emoji: "🐱" } : card.type === "number" ? { emoji: "🔢" } : CARD_INFO[card.type];

  return (
    <button
      type="button"
      className={`card card-size-${size} card-${card.type}${selected ? " card-selected" : ""}${
        selectable ? " card-selectable" : ""
      }${eligible ? " card-eligible" : ""}`}
      onClick={onClick}
      disabled={!onClick}
    >
      {rank !== null && <span className="card-rank">{rank}</span>}
      <span className="card-emoji">{info.emoji}</span>
      {size !== "mini" && <span className="card-label">{isCat ? card.name : info.label}</span>}
    </button>
  );
}
