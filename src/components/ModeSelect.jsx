import { useState } from "react";
import RulesModal from "./RulesModal.jsx";
import SoundToggle from "./SoundToggle.jsx";

export default function ModeSelect({ onChooseLocal, onChooseOnline }) {
  const [showRules, setShowRules] = useState(false);

  return (
    <div className="setup-screen">
      <div className="menu-sound-toggle">
        <SoundToggle />
      </div>

      <h1>🐱 Crazy Cat Lady</h1>
      <p>Wake, steal, and collect cats — become the Crazy Cat Lady by scoring the most points!</p>

      <button type="button" className="primary-button" onClick={onChooseLocal}>
        Play Locally (hotseat)
      </button>
      <button type="button" className="primary-button" onClick={onChooseOnline}>
        Play Online
      </button>
      <button type="button" className="secondary-button" onClick={() => setShowRules(true)}>
        Rules
      </button>

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}
