import { motion } from "framer-motion";
import CardBack from "./CardBack.jsx";
import { CARD_FLY_DURATION_S } from "../game/timings.js";

const FLY_TRANSITION = { duration: CARD_FLY_DURATION_S, ease: "easeOut" };

// Renders a subset of the 12 sleeping-cat slots (a `count`-slot window
// starting at `startIndex`) as a 2-column grid — used to show two 2x3 groups
// flanking the draw/discard piles, matching the design's board layout. Click
// handlers still report the true absolute slot index.
//
// Deliberately NOT wrapped in <AnimatePresence>: this is a CSS `display:
// grid` with a fixed 2-column auto-placement, and AnimatePresence keeping an
// exiting slot mounted alongside its already-mounted replacement briefly
// creates a 7th child, which the grid's auto-placement reflows around —
// visually, the *entire* grid cascades/shifts for a moment, not just the one
// slot changing. It isn't needed anyway: CardBack's shared `layoutId` (see
// below) makes the *destination* element (the woken cat's face-up Card,
// elsewhere on the board) animate in from this slot's last known position —
// the flying effect comes from the arriving element, not from keeping this
// one alive after it's gone.
export default function SleepingCatsGrid({ sleepingCats, startIndex = 0, count = sleepingCats.length, onSlotClick, selectable }) {
  const slots = sleepingCats.slice(startIndex, startIndex + count);

  return (
    <div className="sleeping-grid">
      {slots.map((cat, i) => {
        const slot = startIndex + i;
        const isEmpty = cat === null;

        if (isEmpty) {
          return (
            <motion.button
              key={`${slot}-empty`}
              type="button"
              className="card card-size-board sleeping-slot-empty"
              disabled
              title="Empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={FLY_TRANSITION}
            />
          );
        }

        return (
          <CardBack
            key={`${slot}-cat`}
            variant="cat"
            size="board"
            selectable={selectable}
            onClick={selectable ? () => onSlotClick(slot) : undefined}
            disabled={!selectable}
            title="A sleeping cat"
            // Shared with the eventual face-up Card (see CardBack.jsx) so
            // waking this cat flies+flips it there, instead of it just
            // vanishing here and the cat popping up elsewhere.
            layoutId={`card-${cat.id}`}
          />
        );
      })}
    </div>
  );
}
