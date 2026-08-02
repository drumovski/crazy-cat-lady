import { useState } from "react";
import RulesModal from "./RulesModal.jsx";
import MenuFrame from "./MenuFrame.jsx";

export default function ModeSelect({ onChooseLocal, onChooseOnline }) {
  const [showRules, setShowRules] = useState(false);

  return (
    <MenuFrame>
      <p>Wake, steal, and collect cats — become the Crazy Cat Lady!</p>

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
    </MenuFrame>
  );
}
