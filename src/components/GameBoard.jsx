import { useState } from "react";
import PlayerPanel from "./PlayerPanel.jsx";
import SleepingCatsGrid from "./SleepingCatsGrid.jsx";

// selection.mode drives what a click on a card/opponent/cat/slot means next:
//   'dog'          -> next: click a sleeping slot to wake
//   'fish'         -> next: click an opponent to steal from
//   'catnip-target'-> next: click an opponent
//   'catnip-cat'   -> next: click one of that opponent's cats
const EMPTY_SELECTION = {};

export default function GameBoard({
  game,
  onNewGame,
  onPlayDog,
  onPlayFish,
  onPlayCatnip,
  onPlayLaserPointer,
  onDiscard,
  onDiscardMathSet,
  onRespondToPendingAction,
  onRespondToWakeChoice
}) {
  const [selection, setSelection] = useState(EMPTY_SELECTION);
  const [mathDiscardMode, setMathDiscardMode] = useState(false);
  const [mathIndices, setMathIndices] = useState([]);

  if (game.winner !== undefined) {
    return <WinScreen game={game} onNewGame={onNewGame} />;
  }

  const activePlayerId = game.pendingAction
    ? game.pendingAction.targetId
    : game.pendingWakeChoice
    ? game.pendingWakeChoice.playerId
    : game.currentPlayerIndex;

  const activePlayer = game.players[activePlayerId];

  function resetSelection() {
    setSelection(EMPTY_SELECTION);
    setMathDiscardMode(false);
    setMathIndices([]);
  }

  function toggleMathIndex(cardIndex) {
    setMathIndices(prev =>
      prev.includes(cardIndex) ? prev.filter(i => i !== cardIndex) : [...prev, cardIndex]
    );
  }

  function handleCardClick(cardIndex) {
    const card = activePlayer.hand[cardIndex];

    if (game.pendingAction) {
      const counterType = game.pendingAction.type === "fish" ? "seagull" : "snail";
      if (card.type === counterType) {
        onRespondToPendingAction(activePlayerId, cardIndex);
      }
      return;
    }

    if (mathDiscardMode) {
      if (card.type === "number") {
        toggleMathIndex(cardIndex);
      }
      return;
    }

    switch (card.type) {
      case "dog":
        setSelection({ mode: "dog", cardIndex });
        break;
      case "fish":
        setSelection({ mode: "fish", cardIndex });
        break;
      case "catnip":
        setSelection({ mode: "catnip-target", cardIndex });
        break;
      case "laser":
        onPlayLaserPointer(activePlayerId, cardIndex);
        resetSelection();
        break;
      default: // number, seagull, snail on a normal turn
        onDiscard(activePlayerId, cardIndex);
        resetSelection();
    }
  }

  function handleSlotClick(slotIndex) {
    if (game.pendingWakeChoice) {
      onRespondToWakeChoice(game.pendingWakeChoice.playerId, slotIndex);
      return;
    }

    if (selection.mode === "dog") {
      onPlayDog(activePlayerId, selection.cardIndex, slotIndex);
      resetSelection();
    }
  }

  function handlePlayerPanelClick(targetPlayerId) {
    if (selection.mode === "fish") {
      onPlayFish(activePlayerId, selection.cardIndex, targetPlayerId);
      resetSelection();
    } else if (selection.mode === "catnip-target") {
      setSelection({ ...selection, mode: "catnip-cat", targetPlayerId });
    }
  }

  function handleCatClick(targetPlayerId, catIndex) {
    if (selection.mode === "catnip-cat" && selection.targetPlayerId === targetPlayerId) {
      onPlayCatnip(activePlayerId, selection.cardIndex, targetPlayerId, catIndex);
      resetSelection();
    }
  }

  const isPanelSelectableForFish =
    selection.mode === "fish" &&
    (id => id !== activePlayerId && game.players[id].cats.length > 0);
  const isPanelSelectableForCatnipTarget =
    selection.mode === "catnip-target" &&
    (id => id !== activePlayerId && game.players[id].cats.length > 0);

  const sleepingSelectable = Boolean(game.pendingWakeChoice) || selection.mode === "dog";

  return (
    <div className="game-board">
      <div className="board-header">
        <h2>🐱 Crazy Cat Lady</h2>
        <div className="board-info">
          Deck: {game.deck.length} · Discard: {game.discardPile.length}
        </div>
        <button type="button" className="secondary-button" onClick={onNewGame}>
          New Game
        </button>
      </div>

      {game.pendingAction && (
        <div className="banner">
          Player {game.pendingAction.targetId + 1}: block with a{" "}
          {game.pendingAction.type === "fish" ? "Seagull" : "Snail"}, or let it happen.
          <button
            type="button"
            className="secondary-button"
            onClick={() => onRespondToPendingAction(game.pendingAction.targetId, null)}
          >
            Don't Block
          </button>
        </div>
      )}

      {game.pendingWakeChoice && (
        <div className="banner">
          Player {game.pendingWakeChoice.playerId + 1}: choose a sleeping cat to wake!
        </div>
      )}

      {!game.pendingAction && !game.pendingWakeChoice && selection.mode && (
        <div className="banner">
          {selection.mode === "dog" && "Choose a sleeping cat slot to wake."}
          {selection.mode === "fish" && "Choose an opponent to steal a cat from."}
          {selection.mode === "catnip-target" && "Choose an opponent to send a cat back to sleep."}
          {selection.mode === "catnip-cat" && "Choose which of their cats to put to sleep."}
          <button type="button" className="secondary-button" onClick={resetSelection}>
            Cancel
          </button>
        </div>
      )}

      <div className="players-row">
        {game.players.map(player => {
          const isActive = player.id === activePlayerId;
          const selectedCardIndices = isActive
            ? mathDiscardMode
              ? mathIndices
              : selection.cardIndex !== undefined
              ? [selection.cardIndex]
              : []
            : [];

          return (
            <PlayerPanel
              key={player.id}
              player={player}
              isActive={isActive}
              isCurrentTurn={player.id === game.currentPlayerIndex}
              selectedCardIndices={selectedCardIndices}
              onCardClick={isActive ? handleCardClick : undefined}
              panelSelectable={
                (isPanelSelectableForFish && isPanelSelectableForFish(player.id)) ||
                (isPanelSelectableForCatnipTarget && isPanelSelectableForCatnipTarget(player.id))
              }
              onPanelClick={() => handlePlayerPanelClick(player.id)}
              catsSelectable={selection.mode === "catnip-cat" && selection.targetPlayerId === player.id}
              onCatClick={catIndex => handleCatClick(player.id, catIndex)}
            />
          );
        })}
      </div>

      <div className="sleeping-area">
        <h3>Sleeping Cats</h3>
        <SleepingCatsGrid
          sleepingCats={game.sleepingCats}
          onSlotClick={handleSlotClick}
          selectable={sleepingSelectable}
        />
      </div>

      {!game.pendingAction && !game.pendingWakeChoice && (
        <div className="math-discard-controls">
          <label>
            <input
              type="checkbox"
              checked={mathDiscardMode}
              onChange={e => {
                setMathDiscardMode(e.target.checked);
                setMathIndices([]);
                setSelection(EMPTY_SELECTION);
              }}
            />
            Discard a matching pair or sum (select 2+ Number cards)
          </label>
          {mathDiscardMode && mathIndices.length >= 2 && (
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                onDiscardMathSet(activePlayerId, mathIndices);
                resetSelection();
              }}
            >
              Discard Selected ({mathIndices.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function WinScreen({ game, onNewGame }) {
  const ranked = [...game.players].sort((a, b) => {
    const pointsA = a.cats.reduce((sum, cat) => sum + cat.points, 0);
    const pointsB = b.cats.reduce((sum, cat) => sum + cat.points, 0);
    return pointsB - pointsA;
  });

  return (
    <div className="win-screen">
      <h1>🎉 Player {game.winner + 1} wins!</h1>
      <table className="win-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Cats</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map(player => (
            <tr key={player.id} className={player.id === game.winner ? "win-row-winner" : ""}>
              <td>Player {player.id + 1}</td>
              <td>{player.cats.length}</td>
              <td>{player.cats.reduce((sum, cat) => sum + cat.points, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="primary-button" onClick={onNewGame}>
        New Game
      </button>
    </div>
  );
}
