export default function SleepingCatsGrid({ sleepingCats, onSlotClick, selectable }) {
  return (
    <div className="sleeping-grid">
      {sleepingCats.map((cat, slot) => (
        <button
          key={slot}
          type="button"
          className={`sleeping-slot${cat === null ? " sleeping-slot-empty" : ""}`}
          onClick={cat !== null && selectable ? () => onSlotClick(slot) : undefined}
          disabled={cat === null || !selectable}
          title={cat === null ? "Empty" : "A sleeping cat"}
        >
          {cat === null ? "" : "🐾"}
        </button>
      ))}
    </div>
  );
}
