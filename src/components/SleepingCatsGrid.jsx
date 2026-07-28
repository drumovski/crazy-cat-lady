import CardBack from "./CardBack.jsx";

// Renders a subset of the 12 sleeping-cat slots (a `count`-slot window
// starting at `startIndex`) as a 2-column grid — used to show two 2x3 groups
// flanking the draw/discard piles, matching the design's board layout. Click
// handlers still report the true absolute slot index.
export default function SleepingCatsGrid({ sleepingCats, startIndex = 0, count = sleepingCats.length, onSlotClick, selectable }) {
  const slots = sleepingCats.slice(startIndex, startIndex + count);

  return (
    <div className="sleeping-grid">
      {slots.map((cat, i) => {
        const slot = startIndex + i;
        const isEmpty = cat === null;

        if (isEmpty) {
          return (
            <button
              key={slot}
              type="button"
              className="card card-size-board sleeping-slot-empty"
              disabled
              title="Empty"
            />
          );
        }

        return (
          <CardBack
            key={slot}
            variant="cat"
            size="board"
            selectable={selectable}
            onClick={selectable ? () => onSlotClick(slot) : undefined}
            disabled={!selectable}
            title="A sleeping cat"
          />
        );
      })}
    </div>
  );
}
