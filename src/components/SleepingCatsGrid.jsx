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
        const isSelectable = !isEmpty && selectable;
        return (
          <button
            key={slot}
            type="button"
            className={`card card-size-board card-back${isEmpty ? " sleeping-slot-empty" : ""}${
              isSelectable ? " card-selectable" : ""
            }`}
            onClick={isSelectable ? () => onSlotClick(slot) : undefined}
            disabled={isEmpty || !selectable}
            title={isEmpty ? "Empty" : "A sleeping cat"}
          />
        );
      })}
    </div>
  );
}
