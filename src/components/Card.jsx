// Action/number cards have full illustrated artwork (public/cards/) — the
// card's own name/number is already drawn into the image, so no separate
// rank/label overlay is needed for these. `card.type`/`card.value`/
// `card.variant` are stable for a given card's whole lifetime (see
// createDeck in engine.js for `variant`), so the same physical card always
// shows the same image.
function getCardImageSrc(card) {
  switch (card.type) {
    case "number":
      return `/cards/${card.value}.png`;
    case "dog":
      return `/cards/Dog${card.variant}.png`;
    case "fish":
      return "/cards/Fish Card.png";
    case "seagull":
      return "/cards/Seagull Card.png";
    case "catnip":
      return "/cards/Catnip Card.png";
    case "snail":
      return "/cards/Snail Card.png";
    case "laser":
      return "/cards/Laser Pointer Card.png";
    default:
      return null;
  }
}

// size: 'mini' (opponents' collected cats) | 'board' (sleeping cats / draw /
// discard) | 'hand' (your own collected cats + hand) — matches the design's
// three card scales (24px / 42px / 62px wide).
export default function Card({ card, onClick, selected, selectable, eligible, size = "hand" }) {
  // Cats aren't part of the illustrated set yet (only the draw-deck cards
  // are) — they keep the emoji + rank + label shell for now.
  const imageSrc = card.type === "cat" ? null : getCardImageSrc(card);

  return (
    <button
      type="button"
      className={`card card-size-${size} card-${card.type}${imageSrc ? " card-has-art" : ""}${
        selected ? " card-selected" : ""
      }${selectable ? " card-selectable" : ""}${eligible ? " card-eligible" : ""}`}
      onClick={onClick}
      disabled={!onClick}
    >
      {imageSrc ? (
        <img className="card-art" src={encodeURI(imageSrc)} alt={card.type} />
      ) : (
        <>
          <span className="card-rank">{card.points}</span>
          <span className="card-emoji">🐱</span>
          {size !== "mini" && <span className="card-label">{card.name}</span>}
        </>
      )}
    </button>
  );
}
