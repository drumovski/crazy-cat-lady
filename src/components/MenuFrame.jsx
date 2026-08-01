import SoundSettings from "./SoundSettings.jsx";

// Shared wrapper for every pre-game screen — mode select, and all of
// OnlineSetup's screens (choose/create/join/waiting) — so this exact
// structure (title + hero image + sound controls + a narrower centered
// content column beneath) isn't duplicated across five separate render
// paths. The hero image itself is textless ("Load Screen no Text.png") —
// the title is real text rendered above it, not baked into the art.
export default function MenuFrame({ children }) {
  return (
    <div className="menu-screen">
      <div className="menu-sound-toggle">
        <SoundSettings />
      </div>

      <h1 className="menu-title">Crazy Cat Lady</h1>

      <div className="menu-hero">
        <img src={encodeURI("/Load Screen no Text.webp")} alt="" />
      </div>

      <div className="menu-content">{children}</div>
    </div>
  );
}
