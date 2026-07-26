export default function ModeSelect({ onChooseLocal, onChooseOnline }) {
  return (
    <div className="setup-screen">
      <h1>🐱 Crazy Cat Lady</h1>
      <p>Wake, steal, and collect cats — become the Crazy Cat Lady by scoring the most points!</p>

      <button type="button" className="primary-button" onClick={onChooseLocal}>
        Play Locally (hotseat)
      </button>
      <button type="button" className="primary-button" onClick={onChooseOnline}>
        Play Online
      </button>
    </div>
  );
}
