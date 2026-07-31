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
  "Laser Pointer Card.png"
];

// Warms the browser's image cache for the whole deck as soon as the app
// loads, so by the time a hand actually renders, each <img> can paint
// straight from cache instead of waiting on a fresh network/disk fetch (see
// Card.jsx's card-art alt-text-flash fix in App.css for the other half of
// this — this is what shrinks the window that fix has to cover).
export function preloadCardImages() {
  const paths = [
    ...NUMBER_VALUES.map(n => `/cards/${n}.png`),
    ...DOG_VARIANTS.map(n => `/cards/Dog${n}.png`),
    ...SPECIAL_CARD_FILES.map(name => `/cards/${name}`)
  ];

  for (const path of paths) {
    const img = new Image();
    img.src = encodeURI(path);
  }
}
