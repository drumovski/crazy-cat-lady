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
export default function CardBack({ variant, size = "board", selectable, onClick, disabled, title }) {
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

  if (disabled !== undefined) {
    return (
      <button type="button" className={classes} onClick={onClick} disabled={disabled} title={title}>
        {decoration}
      </button>
    );
  }

  return (
    <div className={classes} title={title}>
      {decoration}
    </div>
  );
}
