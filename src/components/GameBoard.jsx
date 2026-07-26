import { useState } from "react";
import PlayerPanel from "./PlayerPanel.jsx";
import SleepingCatsGrid from "./SleepingCatsGrid.jsx";
import { isValidMathDiscard } from "../game/engine.js";

// selection.mode drives what a click on a card/opponent/cat/slot means next:
//   'dog'          -> next: click a sleeping slot to wake
//   'fish-target'  -> next: click an opponent
//   'fish-cat'     -> next: click one of that opponent's cats to steal
//   'catnip-target'-> next: click an opponent
//   'catnip-cat'   -> next: click one of that opponent's cats to put to sleep
const EMPTY_SELECTION = {};

export default function GameBoard({
  game,
  aiPlayerIds = [],
  myPlayerId, // undefined in local hotseat mode; a specific seat in online mode
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
  const [discardSelection, setDiscardSelection] = useState([]);

  if (game.winner !== undefined) {
    return <WinScreen game={game} onNewGame={onNewGame} />;
  }

  const activePlayerId = game.pendingAction
    ? game.pendingAction.targetId
    : game.pendingWakeChoice
    ? game.pendingWakeChoice.playerId
    : game.currentPlayerIndex;

  const activePlayer = game.players[activePlayerId];
  const isAiDecision = aiPlayerIds.includes(activePlayerId);
  const isOnline = myPlayerId !== undefined;

  // Local hotseat: the shared screen reveals whoever needs to act next, and
  // anyone (the physical human at the keyboard) can act for them unless it's
  // an AI's turn. Online: a client only ever sees its own seat's hand, and
  // can only act when it's genuinely that seat's turn/decision.
  const revealSeat = isOnline ? myPlayerId : activePlayerId;
  const canInteract = isOnline ? activePlayerId === myPlayerId : !isAiDecision;

  function resetSelection() {
    setSelection(EMPTY_SELECTION);
    setDiscardSelection([]);
  }

  function toggleDiscardIndex(cardIndex) {
    setDiscardSelection(prev =>
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

    // Mid-flow choosing a target/slot/cat for Dog/Fish/Catnip — further hand
    // clicks are ignored; use Cancel or "Discard This Card Instead" below.
    if (selection.mode) {
      return;
    }

    switch (card.type) {
      case "dog":
        setSelection({ mode: "dog", cardIndex });
        break;
      case "fish":
        setSelection({ mode: "fish-target", cardIndex });
        break;
      case "catnip":
        setSelection({ mode: "catnip-target", cardIndex });
        break;
      case "laser":
        onPlayLaserPointer(activePlayerId, cardIndex);
        break;
      default: // number, seagull, snail — toggle into the discard selection
        toggleDiscardIndex(cardIndex);
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
    if (selection.mode === "fish-target") {
      setSelection({ ...selection, mode: "fish-cat", targetPlayerId });
    } else if (selection.mode === "catnip-target") {
      setSelection({ ...selection, mode: "catnip-cat", targetPlayerId });
    }
  }

  function handleCatClick(targetPlayerId, catIndex) {
    if (selection.mode === "fish-cat" && selection.targetPlayerId === targetPlayerId) {
      onPlayFish(activePlayerId, selection.cardIndex, targetPlayerId, catIndex);
      resetSelection();
    } else if (selection.mode === "catnip-cat" && selection.targetPlayerId === targetPlayerId) {
      onPlayCatnip(activePlayerId, selection.cardIndex, targetPlayerId, catIndex);
      resetSelection();
    }
  }

  function discardSelectedCardInstead() {
    onDiscard(activePlayerId, selection.cardIndex);
    resetSelection();
  }

  const isPanelSelectableForFish =
    selection.mode === "fish-target" &&
    (id => id !== activePlayerId && game.players[id].cats.length > 0);
  const isPanelSelectableForCatnipTarget =
    selection.mode === "catnip-target" &&
    (id => id !== activePlayerId && game.players[id].cats.length > 0);

  const sleepingSelectable = Boolean(game.pendingWakeChoice) || selection.mode === "dog";

  const discardCards = discardSelection.map(i => activePlayer.hand[i]);
  const discardIsMathSet = discardSelection.length >= 2;
  const canConfirmDiscard =
    discardSelection.length === 1 || (discardIsMathSet && isValidMathDiscard(discardCards));

  function confirmDiscard() {
    if (discardSelection.length === 1) {
      onDiscard(activePlayerId, discardSelection[0]);
    } else {
      onDiscardMathSet(activePlayerId, discardSelection);
    }
    resetSelection();
  }

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

      {!canInteract && (
        <div className="banner">
          {isAiDecision
            ? `🤖 Player ${activePlayerId + 1} (AI) is thinking…`
            : `Waiting for Player ${activePlayerId + 1}…`}
        </div>
      )}

      {canInteract && game.pendingAction && (
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

      {canInteract && game.pendingWakeChoice && (
        <div className="banner">
          Player {game.pendingWakeChoice.playerId + 1}: choose a sleeping cat to wake!
        </div>
      )}

      {canInteract && !game.pendingAction && !game.pendingWakeChoice && selection.mode && (
        <div className="banner">
          {selection.mode === "dog" && "Choose a sleeping cat slot to wake."}
          {selection.mode === "fish-target" && "Choose an opponent to steal a cat from."}
          {selection.mode === "fish-cat" && "Choose which of their cats to steal."}
          {selection.mode === "catnip-target" && "Choose an opponent to send a cat back to sleep."}
          {selection.mode === "catnip-cat" && "Choose which of their cats to put to sleep."}
          <button type="button" className="secondary-button" onClick={discardSelectedCardInstead}>
            Discard This Card Instead
          </button>
          <button type="button" className="secondary-button" onClick={resetSelection}>
            Cancel
          </button>
        </div>
      )}

      {canInteract && !game.pendingAction && !game.pendingWakeChoice && !selection.mode && game.lastMessage && (
        <div className="banner">{game.lastMessage}</div>
      )}

      <div className="players-row">
        {game.players.map(player => {
          const isRevealed = player.id === revealSeat;
          const isInteractive = isRevealed && canInteract;
          const selectedCardIndices = isInteractive
            ? selection.cardIndex !== undefined
              ? [selection.cardIndex]
              : discardSelection
            : [];

          return (
            <PlayerPanel
              key={player.id}
              player={player}
              isAi={aiPlayerIds.includes(player.id)}
              isActive={isRevealed}
              isCurrentTurn={player.id === game.currentPlayerIndex}
              selectedCardIndices={selectedCardIndices}
              onCardClick={isInteractive ? handleCardClick : undefined}
              panelSelectable={
                canInteract &&
                ((isPanelSelectableForFish && isPanelSelectableForFish(player.id)) ||
                  (isPanelSelectableForCatnipTarget && isPanelSelectableForCatnipTarget(player.id)))
              }
              onPanelClick={() => handlePlayerPanelClick(player.id)}
              catsSelectable={
                canInteract &&
                (selection.mode === "fish-cat" || selection.mode === "catnip-cat") &&
                selection.targetPlayerId === player.id
              }
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
          selectable={canInteract && sleepingSelectable}
        />
      </div>

      {canInteract && !game.pendingAction && !game.pendingWakeChoice && !selection.mode && discardSelection.length > 0 && (
        <div className="discard-controls">
          <button
            type="button"
            className="primary-button"
            onClick={confirmDiscard}
            disabled={!canConfirmDiscard}
          >
            Discard Selected ({discardSelection.length})
          </button>
          <button type="button" className="secondary-button" onClick={resetSelection}>
            Clear
          </button>
          {discardIsMathSet && !canConfirmDiscard && (
            <span className="discard-hint">Not a matching pair or a valid sum.</span>
          )}
        </div>
      )}

      {canInteract && !game.pendingAction && !game.pendingWakeChoice && !selection.mode && discardSelection.length === 0 && (
        <p className="discard-hint">
          Click a Number/Seagull/Snail card to select it for discard — select 2+ Number cards for a
          matching pair or sum.
        </p>
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
