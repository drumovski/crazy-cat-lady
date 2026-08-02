// Every distinct illustrated card image path — must stay in sync with
// getCardImageSrc in Card.jsx if the art set ever changes (new Dog variants,
// renamed files, etc).
const NUMBER_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const DOG_VARIANTS = [1, 2, 3, 4, 5, 6, 7];
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
// Cat art specifically goes first, and gets an explicit `fetchPriority`
// hint — the browser fires off all of these `new Image()` requests at once,
// but a limited-connections host (still common, especially plain HTTP/1.1)
// only actually downloads a handful in parallel and queues the rest, roughly
// in request order. Cat PNGs are also the biggest files here (~108KB
// average vs. ~78KB for every other card type combined), so under the old
// ordering — cats requested *last*, behind 24 smaller number/Dog/special
// images — they were both the slowest individual downloads and the last to
// even start, which is exactly why a cat woken in a game's first few turns
// (the only time cat art actually needs to be on screen — see
// Card.jsx/getCatImageSrc) could still be mid-fetch: its overlaid
// point-value badge (a separate DOM element, not part of the image) renders
// immediately regardless, so a still-loading cat reads as "just a number in
// the corner, no picture" until the image catches up.
export function preloadCardImages() {
  const paths = [
    ...CAT_CARD_FILES.map(name => `/cards/${name}`),
    ...NUMBER_VALUES.map(n => `/cards/${n}.png`),
    ...DOG_VARIANTS.map(n => `/cards/Dog${n}.png`),
    ...SPECIAL_CARD_FILES.map(name => `/cards/${name}`)
  ];
  const catPaths = new Set(CAT_CARD_FILES.map(name => `/cards/${name}`));

  for (const path of paths) {
    const img = new Image();
    // Unsupported in older browsers (Safari < 17.2, etc.) — setting an
    // unrecognized property on an Image is a silent no-op there, so this is
    // safe to set unconditionally rather than feature-detecting first.
    if (catPaths.has(path)) img.fetchPriority = "high";
    img.src = encodeURI(path);
  }
}
