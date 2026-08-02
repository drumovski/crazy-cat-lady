import { motion } from "framer-motion";
import { CARD_FLY_DURATION_S } from "../game/timings.js";

// Shared by every Card everywhere. Governs both the layout/layoutId
// animation and the default enter/exit pop below.
const FLY_TRANSITION = { duration: CARD_FLY_DURATION_S, ease: "easeOut" };

// Generic "pop" presence animation, used unless a caller passes its own
// `variants` — e.g. the hand fan's cards fall in/out from the draw pile's
// direction instead of just popping in place. Requires the caller's list to
// be wrapped in <AnimatePresence> for the exit half to actually play (React
// would otherwise unmount the card instantly, with no time to animate).
const DEFAULT_VARIANTS = {
  initial: { opacity: 0, scale: 0.5 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.5 }
};

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
      if (card.dogEffect === "guard") return "/cards/Guard_Dog.png";
      if (card.dogEffect === "hotdog") return "/cards/Hot_Dog.png";
      return `/cards/Dog${card.variant}.png`;
    case "cat":
      return getCatImageSrc(card);
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

// Cat art (unlike the other card types above) doesn't have its point value
// baked in — Card itself overlays that separately, see `.card-rank` below.
// Mostly a plain name-to-filename lookup; Ginger Tom is the one exception
// (two same-named cats need `variant` to tell their two illustrations
// apart, same idea as Dog's `variant`), and "Maine Coon" intentionally maps
// to "Main Coon.png" — that's a typo in the actual filename on disk, not
// here; fix it in one place (this function) if the file's ever renamed.
function getCatImageSrc(card) {
  if (card.name === "Ginger Tom") return `/cards/Ginger${card.variant}.png`;
  if (card.name === "Maine Coon") return "/cards/Main Coon.png";
  return `/cards/${card.name}.png`;
}

// size: 'mini' (opponents' collected cats) | 'board' (sleeping cats / draw /
// discard) | 'hand' (your own collected cats + hand) — matches the design's
// three card scales (24px / 42px / 62px wide).
export default function Card({
  card,
  onClick,
  selected,
  selectable,
  eligible,
  size = "hand",
  variants = DEFAULT_VARIANTS,
  shareLayout = true
}) {
  const isCat = card.type === "cat";
  const imageSrc = getCardImageSrc(card);
  // The "lift" for a selected/eligible card used to be a plain CSS
  // transform on .card-selected/.card-eligible — now expressed as a `y`
  // offset here instead, since Framer Motion's own inline transform updates
  // would otherwise just override a same-property CSS rule every frame.
  const liftY = selected ? -14 : eligible ? -8 : 0;

  return (
    <motion.button
      // layoutId (not just `layout`) is what makes a card actually *fly*
      // between two different places in the tree — e.g. a hand card and its
      // eventual spot on the discard pile are two entirely separate React
      // elements in two separate .map() calls, not the same component
      // moving. Framer Motion matches them purely by this id (same card, so
      // same layoutId everywhere it's ever rendered) and animates the FLIP
      // between their positions/sizes automatically — no manual coordinate
      // tracking needed. Plain `layout` alone only reflows siblings within
      // one list; it can't connect two unrelated mount points.
      //
      // shareLayout: false opts a specific render out of this — used only
      // for an opponent's card landing on the discard pile in online mode
      // (see GameBoard.jsx). That card has never had any other on-screen
      // representation in this client (opponent hands are hidden), but
      // Framer Motion's layout projection would still occasionally compute
      // a phantom flight for it from a stale/unrelated position sharing the
      // same id — visible as the card appearing to fly in from empty space
      // below the pile. Dropping layoutId there breaks that false match, in
      // favor of the explicit fly-from-the-opponent's-panel `variants`
      // GameBoard.jsx supplies for that case instead.
      layoutId={shareLayout ? `card-${card.id}` : undefined}
      initial={variants.initial}
      animate={{ ...variants.animate, y: liftY }}
      exit={variants.exit}
      transition={FLY_TRANSITION}
      type="button"
      className={`card card-size-${size} card-${card.type}${imageSrc ? " card-has-art" : ""}${
        selected ? " card-selected" : ""
      }${selectable ? " card-selectable" : ""}${eligible ? " card-eligible" : ""}`}
      onClick={onClick}
      disabled={!onClick}
    >
      {imageSrc ? (
        <>
          <img className="card-art" src={encodeURI(imageSrc)} alt={isCat ? card.name : card.type} />
          {/* Cat art doesn't have its point value baked in like the other
              card art does — overlaid here in the corner, same spot the
              non-illustrated fallback below uses. */}
          {isCat && <span className="card-rank card-rank-cat">{card.points}</span>}
        </>
      ) : (
        <>
          <span className="card-rank">{card.points}</span>
          <span className="card-emoji">🐱</span>
          {size !== "mini" && <span className="card-label">{card.name}</span>}
        </>
      )}
      {isCat && card.guarded && (
        <div className="card-guard-bars" title="Guarded by a Guard Dog — can't be stolen or put to sleep">
          <span />
          <span />
          <span />
          <span />
        </div>
      )}
    </motion.button>
  );
}
