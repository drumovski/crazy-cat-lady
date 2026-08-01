import { motion } from "framer-motion";
import { CARD_FLY_DURATION_S } from "../game/timings.js";

const FLY_TRANSITION = { duration: CARD_FLY_DURATION_S, ease: "easeOut" };

// Paw print — used on the "cat" variant (sleeping cats).
function PawIcon() {
  return (
    <svg className="card-back-icon" viewBox="0 0 100 100">
      <ellipse cx="50" cy="62" rx="26" ry="20" fill="#e8c775" />
      <ellipse cx="20" cy="30" rx="11" ry="14" fill="#e8c775" />
      <ellipse cx="42" cy="16" rx="11" ry="14" fill="#e8c775" />
      <ellipse cx="66" cy="16" rx="11" ry="14" fill="#e8c775" />
      <ellipse cx="86" cy="30" rx="11" ry="14" fill="#e8c775" />
    </svg>
  );
}

// Ball-with-seams — used on the "deck" variant (the main action-card pile).
function BallIcon() {
  return (
    <svg className="card-back-icon" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="30" fill="#e8c775" />
      <path d="M 22 40 Q 50 20 78 40" fill="none" stroke="#5b2a86" strokeWidth="3" strokeLinecap="round" />
      <path d="M 20 52 Q 50 68 80 52" fill="none" stroke="#5b2a86" strokeWidth="3" strokeLinecap="round" />
      <path d="M 26 66 Q 50 84 74 66" fill="none" stroke="#5b2a86" strokeWidth="3" strokeLinecap="round" />
      <path d="M 32 24 Q 50 50 32 76" fill="none" stroke="#5b2a86" strokeWidth="3" strokeLinecap="round" />
      <path d="M 68 24 Q 50 50 68 76" fill="none" stroke="#5b2a86" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// Card back for face-down cards — 'cat' (teal, paw) for the sleeping-cats
// grid, 'deck' (purple, ball) for the main draw pile, matching the two
// hand-designed card backs. Renders as a button whenever `disabled` is
// passed at all (even disabled ones — e.g. a currently-unselectable
// sleeping cat — so the shared `.card:disabled` dimming still applies),
// otherwise a plain non-interactive div (the draw pile, which is never
// clickable at all).
//
// `layoutId`, when passed (sleeping-cat slots only — see SleepingCatsGrid;
// the draw pile never passes one, since it's face-down/anonymous with no
// specific-card identity to share), lets a cat's face-down back visually
// morph and fly into its face-up Card the moment it's woken (Card.jsx uses
// the exact same `card-${cat.id}` id), and the reverse when Catnip puts it
// back to sleep — same shared-layout-animation mechanism as cards flying
// between hand/discard/collections, just crossing the CardBack/Card
// component boundary too.
export default function CardBack({ variant, size = "board", selectable, onClick, disabled, title, layoutId }) {
  const classes = `card card-size-${size} card-back card-back-${variant}${selectable ? " card-selectable" : ""}`;
  const decoration = (
    <>
      <span className="card-back-corner card-back-corner-tl" />
      <span className="card-back-corner card-back-corner-tr" />
      <span className="card-back-corner card-back-corner-bl" />
      <span className="card-back-corner card-back-corner-br" />
      <span className="card-back-badge">{variant === "cat" ? <PawIcon /> : <BallIcon />}</span>
    </>
  );
  const motionProps = {
    layoutId,
    initial: { opacity: 0, scale: 0.5 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.5 },
    transition: FLY_TRANSITION
  };

  if (disabled !== undefined) {
    return (
      <motion.button
        {...motionProps}
        type="button"
        className={classes}
        onClick={onClick}
        disabled={disabled}
        title={title}
      >
        {decoration}
      </motion.button>
    );
  }

  return (
    <motion.div {...motionProps} className={classes} title={title}>
      {decoration}
    </motion.div>
  );
}
