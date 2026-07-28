import { useEffect, useRef, useState } from "react";
import PlayerPanel from "./PlayerPanel.jsx";
import Card from "./Card.jsx";
import CardBack from "./CardBack.jsx";
import SleepingCatsGrid from "./SleepingCatsGrid.jsx";
import { isValidMathDiscard, getWinThresholds } from "../game/engine.js";
import { DEFAULT_BLOCK_TIMER_SECONDS } from "../game/blockTimer.js";
import { playSfxBatch, startClockTick, stopClockTick } from "../sound/sfx.js";

// selection.mode drives what a click on a card/cat/slot means next:
//   'dog'          -> next: click a sleeping slot to wake
//   'fish-target'  -> next: click any opponent's cat directly to steal it
//   'catnip-target'-> next: click any opponent's cat directly to put it to sleep
// Re-clicking the originally-selected hand card cancels out of any mode.
const EMPTY_SELECTION = {};

const CARD_TYPE_LABELS = {
  dog: "Dog",
  fish: "Fish",
  seagull: "Seagull",
  catnip: "Catnip",
  snail: "Snail",
  laser: "Laser Pointer"
};

// game.lastMessage is data ({ kind, ...fields }), not pre-formatted text, so
// it can be rendered using display names instead of a hardcoded "Player N" —
// and, critically, so the pronoun can flip based on who's actually looking.
// In online mode this only ever renders for the one client it's about, so
// "your"/"you" is always correct there. In local hotseat mode there's no
// single "you" — the banner is visible to the whole shared screen regardless
// of whose turn it is now — so isSelf is always false there and every
// message names the affected player instead of assuming it's the viewer.
function formatLastMessage(message, getName, isSelf, blockTimerSeconds) {
  const who = isSelf ? "You" : getName(message.playerId);
  const subjectPossessive = isSelf ? "your" : `${getName(message.playerId)}'s`;
  const ownPossessive = isSelf ? "your" : "their";

  switch (message.kind) {
    case "fishStolen":
      return `${getName(message.attackerId)} stole ${subjectPossessive} ${message.catName} with a Fish!`;
    case "catnipped":
      return `${getName(message.attackerId)} put ${subjectPossessive} ${message.catName} back to sleep with Catnip!`;
    case "blocked": {
      const counterLabel = message.counterType.charAt(0).toUpperCase() + message.counterType.slice(1);
      const cardLabel = message.cardType === "fish" ? "Fish" : "Catnip";
      return `${getName(message.blockerId)} blocked ${subjectPossessive} ${cardLabel} with a ${counterLabel}!`;
    }
    case "fishStolenConfirm":
      return `${who} stole ${getName(message.targetId)}'s ${message.catName} with ${ownPossessive} Fish!`;
    case "catnippedConfirm":
      return `${who} put ${getName(message.targetId)}'s ${message.catName} back to sleep with ${ownPossessive} Catnip!`;
    case "laserNoCards":
      return isSelf ? "No cards left to reveal." : `${who} had no cards left to reveal.`;
    case "laserNoSlots":
      return isSelf
        ? "Revealed a number card, but no sleeping cats are left to wake."
        : `${who} revealed a number card, but no sleeping cats were left to wake.`;
    case "laserReveal":
      return isSelf
        ? `Laser Pointer revealed a ${CARD_TYPE_LABELS[message.cardType]} — added to your hand.`
        : `${who}'s Laser Pointer revealed a ${CARD_TYPE_LABELS[message.cardType]} — added to ${ownPossessive} hand.`;
    case "laserWakeChoice":
      return `${who} played Laser Pointer — the count landed on ${getName(message.targetId)}, who may wake a sleeping cat!`;
    case "wokeCat":
      return `${who} woke a ${message.catName} Cat!`;
    case "wokeBonusCat":
      return `${who} woke the ${message.catName} Cat so ${isSelf ? "you" : "they"} can wake another Cat!`;
    case "wokeCatConflict":
      return `${who} tried to wake ${message.catName}, but already had a matching cat — it went back to sleep.`;
    case "discarded":
      return `${who} discarded ${message.count} card${message.count === 1 ? "" : "s"}.`;
    case "pendingActionAnnounce": {
      const cardLabel = message.cardType === "fish" ? "Fish" : "Catnip";
      const counterLabel = message.cardType === "fish" ? "Seagull" : "Snail";
      const verb = message.cardType === "fish" ? "steal" : "put to sleep";
      const hasVerb = isSelf ? "have" : "has";
      const timerPhrase =
        blockTimerSeconds === null
          ? `${who} can block with a ${counterLabel} at any time!`
          : `${who} ${hasVerb} ${blockTimerSeconds} seconds to block with a ${counterLabel}!`;
      return `${getName(message.attackerId)} played ${cardLabel} to ${verb} ${subjectPossessive} ${message.catName}! ${timerPhrase}`;
    }
    default:
      return "";
  }
}

// Fanned hand geometry — spreads N cards around a center card, matching the
// design's 5-card arc (rotation ±10°, ±5°, 0°, arc lift 8/2/0px) generalized
// to any hand size instead of hardcoding exactly 5 positions.
function getFanStyle(index, total) {
  const mid = (total - 1) / 2;
  const distance = index - mid;
  const rotate = total > 1 ? Math.max(-25, Math.min(25, distance * 5)) : 0;
  const arcLift = 2 * distance * distance;
  const marginLeft = index === 0 ? 0 : -16;
  return { transform: `rotate(${rotate}deg) translateY(${arcLift}px)`, marginLeft };
}

function HelpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.7-2.5 2-2.5 4" />
      <circle cx="12" cy="17.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15.5-6.3M21 12a9 9 0 0 1-15.5 6.3" />
      <path d="M18 3v4h-4M6 21v-4h4" />
    </svg>
  );
}

function CatEarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8 L7 3 L9 8" />
      <path d="M20 8 L17 3 L15 8" />
      <path d="M4 8 C4 15 8 19 12 19 C16 19 20 15 20 8 C20 8 16 10 12 10 C8 10 4 8 4 8 Z" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-2)" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M7 4h10v3a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4a1 1 0 0 0-1 1c0 2.5 1.5 4 4 4.3M17 5h3a1 1 0 0 1 1 1c0 2.5-1.5 4-4 4.3" />
    </svg>
  );
}

export default function GameBoard({
  game,
  aiPlayerIds = [],
  playerNames = [],
  myPlayerId, // undefined in local hotseat mode; a specific seat in online mode
  blockTimerSeconds = DEFAULT_BLOCK_TIMER_SECONDS, // null means no timer (block whenever)
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
  const [showHelp, setShowHelp] = useState(false);
  // Rolling log of the last 3 events (most recent first). The engine only
  // ever exposes the single most recent `lastMessage` (and clears it on the
  // next ordinary turn), so the history has to be accumulated client-side.
  const [messageHistory, setMessageHistory] = useState([]);

  // Seconds left to block, or null when no pending action is awaiting a
  // response. Keyed off the pending action's *content* rather than object
  // identity — in online mode every broadcast re-serializes the game state
  // into fresh object references, so identity alone would restart the
  // countdown on unrelated updates.
  const [blockTimeLeft, setBlockTimeLeft] = useState(null);

  // Guards against React StrictMode's dev-only double-invoke of effects
  // (mount -> cleanup -> mount), which would otherwise play every sound
  // batch twice in `npm run dev` — a ref (unlike the effect itself) survives
  // that cycle, so the second invocation for the same batch is a no-op.
  const playedSfxRef = useRef(null);

  const getName = id => playerNames[id] || `Player ${id + 1}`;

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
  const revealedPlayer = game.players[revealSeat];

  useEffect(() => {
    if (!game.lastMessage) return;
    const isSelf = myPlayerId === game.lastMessage.playerId;
    const text = formatLastMessage(game.lastMessage, getName, isSelf, blockTimerSeconds);
    setMessageHistory(prev => (prev[0] === text ? prev : [text, ...prev].slice(0, 3)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.lastMessage]);

  // game.sfxEvents is a fresh array set by whichever engine function last
  // ran (see engine.js) — a new reference every real action, so this fires
  // once per action without needing its own dedupe key.
  useEffect(() => {
    if (game.sfxEvents && game.sfxEvents.length > 0 && playedSfxRef.current !== game.sfxEvents) {
      playedSfxRef.current = game.sfxEvents;
      playSfxBatch(game.sfxEvents);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.sfxEvents]);

  // Keyed off the pending action's *content* rather than object identity —
  // in online mode every broadcast re-serializes the game state into fresh
  // object references, so identity alone would restart the countdown on
  // unrelated updates.
  const pendingActionKey = game.pendingAction
    ? `${game.pendingAction.type}-${game.pendingAction.attackerId}-${game.pendingAction.targetId}-${game.pendingAction.catIndex}`
    : null;

  useEffect(() => {
    if (!pendingActionKey || blockTimerSeconds === null) {
      setBlockTimeLeft(null);
      return undefined;
    }
    setBlockTimeLeft(blockTimerSeconds);
    // The ticking clock loops for as long as the countdown runs (repeating
    // if the clip is shorter than the count) and is cut off immediately —
    // even mid-clip — the moment this effect cleans up, whether that's a
    // real timeout or the target responding early.
    startClockTick();
    const interval = setInterval(() => {
      setBlockTimeLeft(prev => (prev === null ? null : Math.max(0, prev - 1)));
    }, 1000);
    return () => {
      clearInterval(interval);
      stopClockTick();
    };
  }, [pendingActionKey, blockTimerSeconds]);

  // Everyone watching (local hotseat's shared screen, or any online client)
  // sees the countdown, but only the actual target's own client drives the
  // timeout into a real "no block" response, so it's submitted exactly once.
  useEffect(() => {
    if (blockTimeLeft === 0 && canInteract && game.pendingAction) {
      onRespondToPendingAction(game.pendingAction.targetId, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockTimeLeft, canInteract]);

  if (game.winner !== undefined) {
    return <WinScreen game={game} playerNames={playerNames} onNewGame={onNewGame} />;
  }

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

    // Mid-flow choosing a slot/cat for Dog/Fish/Catnip — re-clicking the same
    // card cancels the selection; clicking any other hand card is ignored.
    if (selection.mode) {
      if (selection.cardIndex === cardIndex) {
        resetSelection();
      }
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

  // Both Fish and Catnip skip straight to clicking the cat itself — that one
  // click identifies both the target player and which cat, no separate
  // player-selection step needed.
  function handleCatClick(targetPlayerId, catIndex) {
    if (selection.mode === "fish-target") {
      onPlayFish(activePlayerId, selection.cardIndex, targetPlayerId, catIndex);
      resetSelection();
    } else if (selection.mode === "catnip-target") {
      onPlayCatnip(activePlayerId, selection.cardIndex, targetPlayerId, catIndex);
      resetSelection();
    }
  }

  function discardSelectedCardInstead() {
    onDiscard(activePlayerId, selection.cardIndex);
    resetSelection();
  }

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

  const thresholds = getWinThresholds(game.players.length);
  const topDiscard = game.discardPile[game.discardPile.length - 1];
  const opponents = game.players.filter(p => p.id !== revealSeat);

  // The discard pile doubles as the "confirm discard" target: with a
  // Fish/Catnip card selected, clicking it discards that card instead of
  // playing it; otherwise, with Number/Seagull/Snail cards selected, it
  // discards that selection (single card, or a valid matching pair/sum).
  // Dog cards are excluded — they must be played, never discarded.
  const canDiscardViaPile =
    canInteract &&
    !game.pendingAction &&
    !game.pendingWakeChoice &&
    (selection.mode ? selection.mode !== "dog" : discardSelection.length > 0 && canConfirmDiscard);

  function handleDiscardPileClick() {
    if (selection.mode) {
      discardSelectedCardInstead();
    } else {
      confirmDiscard();
    }
  }

  // While a Fish/Catnip is pending against the viewer, their matching
  // counter card (Seagull/Snail) is highlighted as clickable-to-block.
  const blockCounterType =
    game.pendingAction && canInteract ? (game.pendingAction.type === "fish" ? "seagull" : "snail") : null;

  return (
    <div className="game-board">
      <div className="board-header">
        <button type="button" className="icon-button" onClick={() => setShowHelp(v => !v)} title="Help">
          <HelpIcon />
        </button>
        <div className="room-pill">
          <CatEarIcon />
          <span>Crazy Cat Lady</span>
        </div>
        <button type="button" className="icon-button" onClick={onNewGame} title="New Game">
          <RefreshIcon />
        </button>
      </div>

      {showHelp && (
        <div className="help-popover">
          <p>
            Play a <strong>Dog</strong> to wake a sleeping cat, a <strong>Fish</strong> to steal one, or{" "}
            <strong>Catnip</strong> to put one back to sleep. <strong>Laser Pointer</strong> reveals the top
            card. Otherwise discard a Number/Seagull/Snail card — or a matching pair/sum of Number cards for
            extra draws.
          </p>
          <button type="button" className="secondary-button" onClick={() => setShowHelp(false)}>
            Got it
          </button>
        </div>
      )}

      <div className="win-pill">
        <TrophyIcon />
        <span>
          Win condition: {thresholds.cats} Cats or {thresholds.points} points
        </span>
      </div>

      <div className="opponents-row">
        {opponents.map(player => (
          <PlayerPanel
            key={player.id}
            player={player}
            name={getName(player.id)}
            isAi={aiPlayerIds.includes(player.id)}
            isCurrentTurn={player.id === game.currentPlayerIndex}
            catsSelectable={
              canInteract && (selection.mode === "fish-target" || selection.mode === "catnip-target")
            }
            onCatClick={catIndex => handleCatClick(player.id, catIndex)}
          />
        ))}
      </div>

      <div className="center-board">
        {game.pendingAction && blockTimeLeft !== null && (
          <div className="block-timer-overlay">
            <span className="block-timer-number">{blockTimeLeft}</span>
          </div>
        )}

        <SleepingCatsGrid
          sleepingCats={game.sleepingCats}
          startIndex={0}
          count={6}
          onSlotClick={handleSlotClick}
          selectable={canInteract && sleepingSelectable}
        />

        <div className="pile-column">
          <div className="pile-group">
            <CardBack variant="deck" size="board" title="Draw pile" />
            <span className="pile-label">Draw · {game.deck.length}</span>
          </div>
          <div
            className={`pile-group${canDiscardViaPile ? " pile-group-clickable" : ""}`}
            onClick={canDiscardViaPile ? handleDiscardPileClick : undefined}
            role={canDiscardViaPile ? "button" : undefined}
            tabIndex={canDiscardViaPile ? 0 : undefined}
          >
            {topDiscard ? (
              // A disabled Card (no onClick) silently swallows clicks instead
              // of letting them bubble to the pile-group's handler above, so
              // it needs its own (no-op) onClick to stay non-disabled and
              // let clicking the card itself trigger the discard too.
              <Card card={topDiscard} size="board" onClick={canDiscardViaPile ? () => {} : undefined} />
            ) : (
              <div className="card card-size-board sleeping-slot-empty" />
            )}
            <span className="pile-label">Discard · {game.discardPile.length}</span>
          </div>
        </div>

        <SleepingCatsGrid
          sleepingCats={game.sleepingCats}
          startIndex={6}
          count={6}
          onSlotClick={handleSlotClick}
          selectable={canInteract && sleepingSelectable}
        />
      </div>

      <div className="your-cats-panel">
        <span className="your-cats-label">
          {isOnline ? "Your Cats" : `${getName(revealSeat)}'s Cats`}
        </span>
        <div className="your-cats-row">
          {revealedPlayer.cats.map(cat => (
            <Card key={cat.id} card={cat} size="hand" />
          ))}
          {revealedPlayer.cats.length === 0 && <span className="your-cats-empty">No cats yet</span>}
        </div>
      </div>

      <div className="message-log">
        {messageHistory.length === 0 ? (
          <span className="message-log-empty">No moves yet.</span>
        ) : (
          messageHistory.map((text, i) => (
            <div className="message-log-row" key={i}>
              <span className="message-log-emoji">🐱</span>
              <span className="message-log-text">{text}</span>
            </div>
          ))
        )}
      </div>

      <div className="hand-fan">
        {revealedPlayer.hand.map((card, cardIndex) => {
          const isInteractive = canInteract;
          const style = getFanStyle(cardIndex, revealedPlayer.hand.length);
          return (
            <div key={cardIndex} className="hand-fan-slot" style={{ marginLeft: style.marginLeft }}>
              <div style={{ transform: style.transform }}>
                <Card
                  card={card}
                  size="hand"
                  selected={discardSelection.includes(cardIndex) || selection.cardIndex === cardIndex}
                  eligible={blockCounterType !== null && card.type === blockCounterType}
                  onClick={isInteractive ? () => handleCardClick(cardIndex) : undefined}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WinScreen({ game, playerNames = [], onNewGame }) {
  const getName = id => playerNames[id] || `Player ${id + 1}`;
  const ranked = [...game.players].sort((a, b) => {
    const pointsA = a.cats.reduce((sum, cat) => sum + cat.points, 0);
    const pointsB = b.cats.reduce((sum, cat) => sum + cat.points, 0);
    return pointsB - pointsA;
  });

  return (
    <div className="win-screen">
      <h1>🎉 {getName(game.winner)} wins!</h1>
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
              <td>{getName(player.id)}</td>
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
