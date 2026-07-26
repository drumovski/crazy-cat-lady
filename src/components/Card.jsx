const CARD_INFO = {
  dog: { label: "Dog", emoji: "🐶" },
  fish: { label: "Fish", emoji: "🐟" },
  seagull: { label: "Seagull", emoji: "🕊️" },
  catnip: { label: "Catnip", emoji: "🌿" },
  snail: { label: "Snail", emoji: "🐌" },
  laser: { label: "Laser Pointer", emoji: "🔴" }
};

export default function Card({ card, onClick, selected }) {
  const info = card.type === "number"
    ? { label: String(card.value), emoji: "🔢" }
    : CARD_INFO[card.type];

  return (
    <button
      type="button"
      className={`card card-${card.type}${selected ? " card-selected" : ""}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className="card-emoji">{info.emoji}</span>
      <span className="card-label">{info.label}</span>
    </button>
  );
}
