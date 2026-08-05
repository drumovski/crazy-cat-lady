import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite's dev/preview static file server (sirv, under the hood) defaults
// every response under public/ to `Cache-Control: no-cache` — mandatory
// revalidation before every reuse, not "don't cache". Card art in
// particular gets a fresh <img> mount very often mid-game (Framer Motion's
// layoutId flights create a brand-new DOM node per card appearance), so
// that's a conditional-GET round-trip almost every time a card is shown —
// and Firefox was observed (via an automated Playwright reproduction) to
// occasionally hang on that revalidation request for 1s+, even though the
// exact same URL had already loaded successfully earlier in the same
// session. That's the "cards/animations sometimes don't load, throughout
// the game, not just early on" bug reported in Firefox — it reproduced
// identically against both `npm run dev` (5173) and a production preview
// build (`vite preview`, 4173), since both send the same header; it did not
// reproduce at all in Chromium.
//
// None of these files (public/cards, public/sounds, public/music,
// public/fonts) ever change without a filename change (see CLAUDE.md), so
// there's no reason to revalidate them at all once fetched — long-lived
// immutable caching sidesteps the hanging-revalidation path entirely rather
// than trying to make revalidation itself more reliable. Trade-off: if one
// of these files is ever replaced in place (same filename, new content), a
// browser that already cached it won't see the update for up to a year
// without a hard refresh — acceptable here since it's the same trade-off
// `public/` assets already make by not being content-hashed like the JS/CSS
// build output, just made explicit instead of accidental.
//
// `server.headers`/`preview.headers` (Vite's built-in config options) can't
// be used for this — they apply to *every* response including index.html
// and dev JS modules, which genuinely do need to keep revalidating during
// development. This plugin only overrides Cache-Control for the specific
// static-asset extensions these folders use, by patching res.setHeader so
// our value wins even though sirv's own static-serve middleware sets its
// header later in the chain (a plain middleware running afterward can't
// override a header already written to the response).
function longLivedStaticAssetCache() {
  const STATIC_ASSET_RE = /\.(png|webp|mp3|ttf)$/i
  const middleware = (req, res, next) => {
    if (STATIC_ASSET_RE.test(req.url.split('?')[0])) {
      const originalSetHeader = res.setHeader.bind(res)
      res.setHeader = (name, value) => {
        if (String(name).toLowerCase() === 'cache-control') {
          return originalSetHeader('Cache-Control', 'public, max-age=31536000, immutable')
        }
        return originalSetHeader(name, value)
      }
    }
    next()
  }
  return {
    name: 'long-lived-static-asset-cache',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), longLivedStaticAssetCache()],
})
