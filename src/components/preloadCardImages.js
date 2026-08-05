// Every distinct illustrated card image path — must stay in sync with
// getCardImageSrc in Card.jsx if the art set ever changes (new Dog variants,
// renamed files, etc).
const NUMBER_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const DOG_VARIANTS = [1, 2, 3, 4, 5, 6, 7, 8];
const SPECIAL_CARD_FILES = [
  "Fish Card.png",
  "Seagull Card.png",
  "Catnip Card.png",
  "Snail Card.png",
  "Laser Pointer Card.png",
  "Guard_Dog.png",
  "Hot_Dog.png"
];
// Matches getCatImageSrc in Card.jsx exactly, "Main Coon.png" typo included
// (that's the real filename on disk).
const CAT_CARD_FILES = [
  "Ginger1.png",
  "Ginger2.png",
  "Main Coon.png",
  "Calico.png",
  "Persian.png",
  "Toyger.png",
  "Ragdoll.png",
  "Bombay.png",
  "Russian Blue.png",
  "Sphynx.png",
  "Siamese.png",
  "Bengal.png"
];

// Warms the browser's image cache for the whole deck as soon as the app
// loads, so by the time a hand actually renders, each <img> can paint
// straight from cache instead of waiting on a fresh network/disk fetch (see
// Card.jsx's card-art alt-text-flash fix in App.css for the other half of
// this — this is what shrinks the window that fix has to cover).
//
// Hand-relevant art (numbers/Dogs/specials) goes first and gets the
// `fetchPriority: "high"` hint; cat art goes second, at normal priority.
// This was the other way around until a live-verified bug report: on a
// connection-limited host (still common, especially plain HTTP/1.1, which
// caps most browsers at ~6 parallel connections per origin), prioritizing
// cats meant every *other* image — including the ones needed to render a
// player's very first hand, at the instant the game starts — got starved
// behind them. That's backwards: cats can never appear in a starting hand
// (they only ever enter play via a wake, which takes at least a full turn
// of lead time), so hand art is what's actually needed at t=0, not cat art.
// Verified with Playwright against a throttled connection (~1.5Mbps/150ms
// latency, roughly "congested 4G"): with cats prioritized, 6 of 12 cat
// images finished inside 10s while almost none of the 25 hand-relevant
// images had even started — exactly the "cards not loading early in the
// game" symptom reported, and (as a knock-on effect) why the hand's
// draw-in fly animation looked like it wasn't playing early on too: the
// position animation runs on schedule regardless of image load state, but
// a still-loading card settles into place as a blank box, so there's
// nothing visibly "flying" — once the image finally loads a moment later,
// the animation has already finished. Reordering fixes both.
// Cats aren't neglected either — they're still requested immediately, just
// without the priority hint, and in practice there's real lead time before
// one's ever needed on screen (a player has to draw a Dog and choose to
// play it first) — see the "Bug, fixed" note in CLAUDE.md for the original
// version of this problem (cat art loading too slowly once woken), which
// this reordering doesn't reintroduce in any normal case, only in a
// contrived immediate-turn-1-wake scenario on an already-very-slow
// connection.
export function preloadCardImages() {
  const handRelevantPaths = [
    ...NUMBER_VALUES.map(n => `/cards/${n}.png`),
    ...DOG_VARIANTS.map(n => `/cards/Dog${n}.png`),
    ...SPECIAL_CARD_FILES.map(name => `/cards/${name}`)
  ];
  const catPaths = CAT_CARD_FILES.map(name => `/cards/${name}`);
  const handRelevantSet = new Set(handRelevantPaths);

  for (const path of [...handRelevantPaths, ...catPaths]) {
    const img = new Image();
    // Unsupported in older browsers (Safari < 17.2, etc.) — setting an
    // unrecognized property on an Image is a silent no-op there, so this is
    // safe to set unconditionally rather than feature-detecting first.
    if (handRelevantSet.has(path)) img.fetchPriority = "high";
    img.src = encodeURI(path);
  }
}
