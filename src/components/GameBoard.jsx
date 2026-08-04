import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PlayerPanel from "./PlayerPanel.jsx";
import Card from "./Card.jsx";
import CardBack from "./CardBack.jsx";
import SleepingCatsGrid from "./SleepingCatsGrid.jsx";
import RulesModal from "./RulesModal.jsx";
import SoundSettings from "./SoundSettings.jsx";
import { isValidMathDiscard } from "../game/engine.js";
import { DEFAULT_BLOCK_TIMER_SECONDS } from "../game/blockTimer.js";
import { CARD_FLY_DURATION_S } from "../game/timings.js";
import { playSfxBatch, startClockTick, stopClockTick } from "../sound/sfx.js";

// selection.mode drives what a click on a card/cat/slot means next:
//   'dog'          -> next: click a sleeping slot to wake
//   'fish-target'  -> next: click any opponent's cat directly to steal it
//   'catnip-target'-> next: click any opponent's cat directly to put it to sleep
// Re-clicking the originally-selected hand card cancels out of any mode.
const EMPTY_SELECTION = {};

// Fallback offset for a hand card's fall-in/fall-out, used only until the
// real draw-pile-to-hand distance has been measured (see dealFromOffset in
// GameBoard) — a small guess in the right general direction rather than no
// offset at all, in case a card mounts before the very first measurement
// effect has run.
const FALLBACK_DEAL_OFFSET = { x: 0, y: -60 };

// Local hotseat only: how long to keep revealing a human player's own hand
// after their turn-ending action, before switching to the next player — see
// the delayedLocalRevealSeat effect below. Derived from CARD_FLY_DURATION_S
// (with a little buffer) rather than a separate hand-tuned number, so it
// always covers the deal animation's real duration.
const REVEAL_SWITCH_DELAY_MS = CARD_FLY_DURATION_S * 1000 + 150;

// How long to hold off showing the win popup after a winner is decided —
// lets the win sound (already queued via game.sfxEvents, unaffected by this
// delay) and the final board state land first, rather than the popup
// snapping in over top of them immediately. Purely a display delay: the game
// is already over and canInteract already blocks further input the instant
// game.winner is set, regardless of when the popup itself becomes visible.
const WIN_SCREEN_DELAY_MS = 3000;
const WIN_SCREEN_FADE_DURATION_S = 1;

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
    case "laserRevealing":
      return isSelf ? "You played Laser Pointer — revealing the top card..." : `${who} played Laser Pointer — revealing the top card...`;
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
    case "wokeGuardedCat":
      return message.bonus
        ? `${who} woke a guarded ${message.catName} Cat — it can't be stolen or put to sleep — and gets to wake another Cat!`
        : `${who} woke a guarded ${message.catName} Cat — it can't be stolen or put to sleep!`;
    case "hotDogWoke":
      return message.bonus
        ? `${who} played Hot Dog, waking a ${message.catName} Cat — and gets to wake another Cat!`
        : `${who} played Hot Dog, waking a ${message.catName} Cat!`;
    case "wokeCatConflict":
      return `${who} tried to wake ${message.catName}, but already had a matching cat — it went back to sleep.`;
    case "discarded":
      return `${who} discarded ${message.count} card${message.count === 1 ? "" : "s"}.`;
    case "discardedTriplet":
      return `${who} discarded a matching triplet and may wake a sleeping cat!`;
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

export default function GameBoard({
  game,
  aiPlayerIds = [],
  playerNames = [],
  myPlayerId, // undefined in local hotseat mode; a specific seat in online mode
  blockTimerSeconds = DEFAULT_BLOCK_TIMER_SECONDS, // null means no timer (block whenever)
  onNewGame,
  onPlayAgain, // online only — undefined in local hotseat, so WinScreen omits the button there
  playAgainPending = false,
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
  const [showRules, setShowRules] = useState(false);
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

  // A dealt/drawn hand card has no destination-side layoutId partner to fly
  // *from* (the draw pile is deliberately anonymous — see CardBack usage
  // below), so unlike a wake/steal/discard's true shared-position flight, it
  // can only use a plain initial/animate offset. Measuring the real on-screen
  // distance from the draw pile to the hand (instead of a small fixed guess)
  // is what makes that offset actually read as "coming from the deck" rather
  // than a generic nearby pop-in.
  const drawPileRef = useRef(null);
  const handFanRef = useRef(null);
  const [dealFromOffset, setDealFromOffset] = useState(FALLBACK_DEAL_OFFSET);
  const [handCardWidth, setHandCardWidth] = useState(90); // matches --card-w-hand's max
  // Forces every currently-mounted hand card to remount (see the key below)
  // the moment the very first real measurement lands — see the comment on
  // that key for why this is necessary. Only ever flips false -> true once;
  // later remeasurements (e.g. window resize) reuse the same key.
  const [hasMeasuredOnce, setHasMeasuredOnce] = useState(false);

  useLayoutEffect(() => {
    function measure() {
      if (!drawPileRef.current || !handFanRef.current) return;
      const pileRect = drawPileRef.current.getBoundingClientRect();
      const handRect = handFanRef.current.getBoundingClientRect();
      setDealFromOffset({
        x: pileRect.left + pileRect.width / 2 - (handRect.left + handRect.width / 2),
        y: pileRect.top + pileRect.height / 2 - (handRect.top + handRect.height / 2)
      });
      const widthPx = parseFloat(getComputedStyle(handFanRef.current).getPropertyValue("--card-w-hand"));
      if (!Number.isNaN(widthPx)) setHandCardWidth(widthPx);
      setHasMeasuredOnce(true);
    }
    measure();
    // The fluid clamp()-based layout (see App.css) keeps resizing the draw
    // pile and hand fan relative to each other continuously, not just at a
    // fixed breakpoint, so this needs to stay live across the whole session
    // rather than measuring once on mount.
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Every hand card shares dealFromOffset's Y (they're all in the same row,
  // and the small per-card vertical "arc" getFanStyle already applies is
  // negligible next to the several-hundred-px distance to the pile), but
  // each needs its *own* X — dealFromOffset.x alone only lands a card that
  // sits exactly at the fan's horizontal center, since it's measured
  // relative to the hand-fan container as a whole. `.hand-fan`'s cards
  // overlap by a fixed 16px (see getFanStyle's marginLeft), fanned out
  // *centered* within the container (`.hand-fan { justify-content: center }`
  // in App.css) — replicating that same geometry here (rather than
  // measuring this specific card's own DOM position) sidesteps a mount-
  // timing race: a brand-new card can't reliably self-measure its own
  // final position before it's rendered once already.
  function getDealVariants(cardIndex, totalCards) {
    const spacing = handCardWidth - 16;
    const fanWidth = handCardWidth + (totalCards - 1) * spacing;
    const cardOffsetFromFanCenter = cardIndex * spacing + handCardWidth / 2 - fanWidth / 2;
    const desiredX = dealFromOffset.x - cardOffsetFromFanCenter;
    const desiredY = dealFromOffset.y;

    // getFanStyle also rotates each card's wrapping div by up to ±25deg for
    // the fan spread — and since that wrapper is a CSS-transform *parent* of
    // this Card's own motion.button, Framer Motion's x/y here compose
    // *inside* that already-rotated frame (nested transforms), not in flat
    // screen space. Passing (desiredX, desiredY) straight through would
    // itself end up visually rotated by the fan angle, landing well off the
    // pile for any card that isn't dead-center in the fan. Counter-rotating
    // by the same angle first cancels that out, so the actual on-screen
    // motion matches the flat vector computed above.
    const mid = (totalCards - 1) / 2;
    const rotateDeg = totalCards > 1 ? Math.max(-25, Math.min(25, (cardIndex - mid) * 5)) : 0;
    const rad = (rotateDeg * Math.PI) / 180;
    const x = desiredX * Math.cos(rad) + desiredY * Math.sin(rad);
    const y = desiredY * Math.cos(rad) - desiredX * Math.sin(rad);

    return {
      initial: { opacity: 0, x, y, scale: 0.5 },
      animate: { opacity: 1, x: 0, y: 0, scale: 1 },
      exit: { opacity: 0, x, y, scale: 0.5 }
    };
  }

  // Online only: an opponent's card landing on the discard pile has no true
  // shared-layoutId flight to fly *from* (see Card.jsx's shareLayout) since
  // this client never rendered their hand anywhere — so it needs the same
  // kind of explicit measured-offset treatment as a dealt card, this time
  // measured from that opponent's own panel instead of the draw pile. One
  // ref per currently-rendered opponent (there are at most 4, so a Map keyed
  // by player id — rather than one ref per card — is plenty).
  const opponentPanelRefs = useRef(new Map());
  const discardPileSlotRef = useRef(null);
  // Keyed by card id and computed once per discard, not recomputed on every
  // re-render — see the comment on its lone call site below for why a fresh
  // object reference on each render breaks Framer Motion's animation here.
  const discardFromOpponentVariantsRef = useRef(new Map());

  function getDiscardFromOpponentVariants(cardId, opponentId) {
    if (discardFromOpponentVariantsRef.current.has(cardId)) {
      return discardFromOpponentVariantsRef.current.get(cardId);
    }
    const panelEl = opponentPanelRefs.current.get(opponentId);
    if (!panelEl || !discardPileSlotRef.current) return null;
    const panelRect = panelEl.getBoundingClientRect();
    const slotRect = discardPileSlotRef.current.getBoundingClientRect();
    const x = panelRect.left + panelRect.width / 2 - (slotRect.left + slotRect.width / 2);
    const y = panelRect.top + panelRect.height / 2 - (slotRect.top + slotRect.height / 2);
    const variants = {
      initial: { opacity: 0, x, y, scale: 0.6 },
      animate: { opacity: 1, x: 0, y: 0, scale: 1 },
      exit: { opacity: 0, x, y, scale: 0.6 }
    };
    // Cap growth: only the current top-of-pile card's entry can ever be
    // queried again (an older one's card.id will never recur as topDiscard),
    // so drop everything but this one before adding it.
    discardFromOpponentVariantsRef.current.clear();
    discardFromOpponentVariantsRef.current.set(cardId, variants);
    return variants;
  }

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
  const instantRevealSeat = isOnline ? myPlayerId : activePlayerId;

  // Local hotseat only: a turn-ending action's state update (card drawn,
  // turn advanced) lands in one React commit, so switching revealSeat the
  // instant activePlayerId changes meant a human's own newly-drawn card's
  // fly-in (see dealVariants above) never got a frame on screen — the
  // acting player's hand was already gone, replaced by the next player's
  // entirely different one, before the animation could be seen. Delaying
  // the switch by REVEAL_SWITCH_DELAY_MS gives it that frame. Skipped
  // (switches immediately) when: online (revealSeat never actually changes
  // there); the *incoming* state is a pendingAction/pendingWakeChoice
  // (those need the affected player's prompt attention right away, not a
  // delayed reveal — the block-response countdown in particular is already
  // time-sensitive); or the seat being *left* is AI-controlled (nothing
  // waiting to see its own hand, and delaying would just make AI-vs-AI
  // turns feel sluggish, plus risk this display falling further and further
  // behind if AI keeps acting faster than the delay window).
  const [delayedLocalRevealSeat, setDelayedLocalRevealSeat] = useState(instantRevealSeat);

  useEffect(() => {
    if (isOnline) return undefined;
    if (game.pendingAction || game.pendingWakeChoice) {
      setDelayedLocalRevealSeat(instantRevealSeat);
      return undefined;
    }
    if (delayedLocalRevealSeat === instantRevealSeat) return undefined;
    if (aiPlayerIds.includes(delayedLocalRevealSeat)) {
      setDelayedLocalRevealSeat(instantRevealSeat);
      return undefined;
    }
    const timer = setTimeout(() => setDelayedLocalRevealSeat(instantRevealSeat), REVEAL_SWITCH_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instantRevealSeat, isOnline, game.pendingAction, game.pendingWakeChoice]);

  const revealSeat = isOnline ? myPlayerId : delayedLocalRevealSeat;

  // Single gate for "don't accept input right now" — currently just the
  // Laser Pointer reveal (not a decision, just a shared beat everyone
  // watches before it resolves itself), but this is the one place to widen
  // once card-fly animations land (e.g. OR in a "some card is still mid-
  // flight" flag) rather than threading a second condition through
  // canInteract by hand. Local hotseat also requires revealSeat to have
  // caught up to activePlayerId — during the delay above, revealSeat still
  // shows the *previous* player's (already-stale) hand, and without this a
  // fast click during that window could act on cards that aren't actually
  // the current player's.
  const isBoardBusy = Boolean(game.pendingLaserReveal);
  const hasWinner = game.winner !== undefined;
  const canInteract =
    !hasWinner &&
    !isBoardBusy &&
    (isOnline ? activePlayerId === myPlayerId : !isAiDecision && revealSeat === activePlayerId);
  const revealedPlayer = game.players[revealSeat];

  // Delays the win popup's own appearance (see WIN_SCREEN_DELAY_MS above) —
  // separate from hasWinner itself, which still blocks input immediately.
  const [showWinScreen, setShowWinScreen] = useState(false);
  useEffect(() => {
    if (!hasWinner) {
      setShowWinScreen(false);
      return undefined;
    }
    const timer = setTimeout(() => setShowWinScreen(true), WIN_SCREEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hasWinner]);

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
  // Drives both the sleeping-cat slots' pulsing border (SleepingCatsGrid's
  // `selectable` prop, via .card-selectable) and this overlay — same signal,
  // same moment, so they read as one coordinated cue rather than two. Gated
  // on canInteract, not just sleepingSelectable, so this only appears for
  // the player who can actually act right now (the revealed player, in
  // local hotseat) rather than every viewer of the shared screen.
  const showWakeChoiceHint = canInteract && sleepingSelectable;
  // While a Fish/Catnip is pending against the viewer, their matching
  // counter card (Seagull/Snail) is highlighted as clickable-to-block, and
  // (below) prompted with the same pulsing-text treatment.
  const blockCounterType =
    game.pendingAction && canInteract ? (game.pendingAction.type === "fish" ? "seagull" : "snail") : null;
  const showBlockPrompt = canInteract && !showWakeChoiceHint && Boolean(blockCounterType);
  // The same pulsing-text treatment, for the general "it's your move" case —
  // excludes the wake-choice moment and a pending block-response (both get
  // their own more specific prompt above).
  const showYourTurnHint = canInteract && !showWakeChoiceHint && !showBlockPrompt;

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

  const topDiscard = game.discardPile[game.discardPile.length - 1];
  const opponents = game.players.filter(p => p.id !== revealSeat);

  // Whether the card currently on top of the discard pile got there via an
  // opponent's action rather than this client's own — see Card.jsx's
  // shareLayout and getDiscardFromOpponentVariants above. game.lastMessage
  // is the same structured "who just did what" signal the message log
  // already relies on, so this is consistent with what's shown there.
  const topDiscardFromOpponent =
    isOnline &&
    topDiscard &&
    game.lastMessage &&
    game.lastMessage.playerId !== undefined &&
    game.lastMessage.playerId !== myPlayerId;

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

  return (
    <div className="game-board">
      <div className="board-header">
        <div className="board-header-left">
          <button type="button" className="icon-button" onClick={() => setShowHelp(v => !v)} title="Help">
            <HelpIcon />
          </button>
          <SoundSettings />
        </div>
        <h1 className="board-title">Crazy Cat Lady</h1>
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
          <div className="help-popover-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setShowHelp(false);
                setShowRules(true);
              }}
            >
              Full Rules
            </button>
            <button type="button" className="secondary-button" onClick={() => setShowHelp(false)}>
              Got it
            </button>
          </div>
        </div>
      )}

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {showWinScreen && (
        <WinScreen
          game={game}
          playerNames={playerNames}
          onNewGame={onNewGame}
          onPlayAgain={onPlayAgain}
          playAgainPending={playAgainPending}
        />
      )}

      <div className="opponents-row">
        {opponents.map(player => (
          // Wrapper only exists to hold a ref to this opponent's on-screen
          // position, for getDiscardFromOpponentVariants above — a plain
          // block div here is invisible to the grid layout (it just becomes
          // the grid cell PlayerPanel already filled anyway).
          <div
            key={player.id}
            ref={el => {
              if (el) opponentPanelRefs.current.set(player.id, el);
              else opponentPanelRefs.current.delete(player.id);
            }}
          >
            <PlayerPanel
              player={player}
              name={getName(player.id)}
              isCurrentTurn={player.id === game.currentPlayerIndex}
              catsSelectable={
                canInteract && (selection.mode === "fish-target" || selection.mode === "catnip-target")
              }
              onCatClick={catIndex => handleCatClick(player.id, catIndex)}
            />
          </div>
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
          <div className="pile-group" ref={drawPileRef}>
            {game.pendingLaserReveal && game.pendingLaserReveal.revealedCard ? (
              // Laser Pointer flips the top card face-up in place, on top of
              // the deck, so every player can see it before it resolves.
              <div className="laser-reveal-card">
                <Card card={game.pendingLaserReveal.revealedCard} size="board" />
              </div>
            ) : (
              <CardBack variant="deck" size="board" title="Draw pile" />
            )}
          </div>
          <div
            className={`pile-group${canDiscardViaPile ? " pile-group-clickable" : ""}`}
            onClick={canDiscardViaPile ? handleDiscardPileClick : undefined}
            role={canDiscardViaPile ? "button" : undefined}
            tabIndex={canDiscardViaPile ? 0 : undefined}
          >
            {/* AnimatePresence here so the *previous* top-of-pile card gets
                to play its exit animation when a new one replaces it
                (buried card fading out), instead of being swapped for the
                new one instantly — without it, only a card that's newly
                mounted (there was nothing before it) would ever animate.
                The wrapping .discard-pile-slot (fixed size, position:
                relative) plus `position: absolute` on every child (see
                App.css) makes the exiting and entering card overlap in
                place instead of stacking in normal flow — mode="popLayout"
                (the hand fan's fix for the same class of problem) doesn't
                reliably apply here, since this exiting card is also mid
                cross-tree layoutId flight (from wherever it was played
                from), which fights its exit-repositioning logic and leaves
                it position:relative, so the pile-group briefly holds two
                stacked card-heights and grows .center-board, shoving
                everything below it (Your Cats, message log, hand) down and
                back. A fixed-size slot with absolutely-positioned children
                sidesteps that entirely, regardless of how many cards
                AnimatePresence has mounted at once. */}
            <div className="discard-pile-slot" ref={discardPileSlotRef}>
              <AnimatePresence mode="wait">
                {topDiscard ? (
                  // A disabled Card (no onClick) silently swallows clicks
                  // instead of letting them bubble to the pile-group's
                  // handler above, so it needs its own (no-op) onClick to
                  // stay non-disabled and let clicking the card itself
                  // trigger the discard too. Keyed by the card's own id
                  // (not just always "the top of the pile") so a new card
                  // landing here re-mounts and replays its pop-in
                  // animation, instead of Framer Motion treating it as the
                  // same element with only its props updated.
                  <Card
                    key={topDiscard.id}
                    card={topDiscard}
                    size="board"
                    onClick={canDiscardViaPile ? () => {} : undefined}
                    shareLayout={!topDiscardFromOpponent}
                    variants={
                      topDiscardFromOpponent
                        ? getDiscardFromOpponentVariants(topDiscard.id, game.lastMessage.playerId) ?? undefined
                        : undefined
                    }
                  />
                ) : (
                  <div className="card card-size-board sleeping-slot-empty discard-pile-empty-label">Discard</div>
                )}
              </AnimatePresence>
            </div>
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
        {showWakeChoiceHint && (
          <div className="player-prompt-overlay">
            <span className="player-prompt-overlay-text">Choose a sleeping cat</span>
          </div>
        )}
        {showBlockPrompt && (
          <div className="player-prompt-overlay">
            <span className="player-prompt-overlay-text">
              Block with {blockCounterType === "seagull" ? "Seagull" : "Snail"}?
            </span>
          </div>
        )}
        {showYourTurnHint && (
          <div className="player-prompt-overlay">
            <span className="player-prompt-overlay-text">Your turn</span>
          </div>
        )}
        <span className="your-cats-label">
          {isOnline ? "Your Cats" : `${getName(revealSeat)}'s Cats`}
        </span>
        <div className="your-cats-row">
          <AnimatePresence>
            {revealedPlayer.cats.map(cat => (
              <Card key={cat.id} card={cat} size="hand" />
            ))}
          </AnimatePresence>
          {revealedPlayer.cats.length === 0 && <span className="your-cats-empty">No cats yet</span>}
        </div>
      </div>

      <div className="message-log">
        {/* Always renders all 3 row slots (rather than only as many as
            messageHistory currently has) so the log's height is reserved
            up front — otherwise it visibly grows for the first 3 actions
            of a game, pushing the hand fan below it down each time. Slots
            with no message yet render a hidden (but height-reserving)
            placeholder, except slot 0, which shows "No moves yet." until
            the first real message arrives. */}
        {[0, 1, 2].map(i => {
          const text = messageHistory[i];
          if (text) {
            return (
              <div className="message-log-row" key={i}>
                <span className="message-log-text">{text}</span>
              </div>
            );
          }
          if (i === 0) {
            return (
              <div className="message-log-row" key={i}>
                <span className="message-log-empty">No moves yet.</span>
              </div>
            );
          }
          return (
            <div className="message-log-row message-log-row-hidden" key={i}>
              <span className="message-log-text">&nbsp;</span>
            </div>
          );
        })}
      </div>

      <div className="hand-fan" ref={handFanRef}>
        {/* popLayout: an exiting (played/discarded) card is pulled out of
            layout flow immediately, so its siblings re-fan smoothly while
            it's still finishing its own exit animation, rather than holding
            the fan's width/spacing until the exit completes. */}
        <AnimatePresence mode="popLayout">
          {/* Gated on hasMeasuredOnce rather than always rendering: Framer
              Motion locks in whatever `initial` a card's *first-ever* mount
              saw and ignores later prop updates on that same still-mounted
              instance — so on a brand new game, every starting hand card
              (which would otherwise mount in the very same commit the
              draw-pile/hand-fan refs above first measure) would be stuck
              using FALLBACK_DEAL_OFFSET forever, not the real measured
              value that lands a moment later. Not rendering them at all
              until that first measurement is in hand sidesteps this
              cleanly — genuinely mounting once, already correct, rather
              than mounting-wrong-then-forcing-a-remount (tried that: since
              AnimatePresence treats any key change as a real removal, the
              wrongly-initialized instances got a full visible exit
              animation instead of silently disappearing). This all
              resolves inside useLayoutEffect, before the first paint, so
              there's no visible gap where the hand is empty. */}
          {hasMeasuredOnce &&
            revealedPlayer.hand.map((card, cardIndex) => {
              const isInteractive = canInteract;
              const style = getFanStyle(cardIndex, revealedPlayer.hand.length);
              // Keyed by the card's own stable id, not its current index — a
              // played/discarded card splices out and shifts every later
              // card's index down, which would otherwise make React (and
              // Framer Motion's layout animation) think the card at each
              // shifted index changed identity instead of just moving.
              return (
                <div key={card.id} className="hand-fan-slot" style={{ marginLeft: style.marginLeft }}>
                  <div style={{ transform: style.transform }}>
                    <Card
                      card={card}
                      size="hand"
                      selected={discardSelection.includes(cardIndex) || selection.cardIndex === cardIndex}
                      eligible={blockCounterType !== null && card.type === blockCounterType}
                      onClick={isInteractive ? () => handleCardClick(cardIndex) : undefined}
                      variants={getDealVariants(cardIndex, revealedPlayer.hand.length)}
                    />
                  </div>
                </div>
              );
            })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function WinScreen({ game, playerNames = [], onNewGame, onPlayAgain, playAgainPending }) {
  const getName = id => playerNames[id] || `Player ${id + 1}`;
  const ranked = [...game.players].sort((a, b) => {
    const pointsA = a.cats.reduce((sum, cat) => sum + cat.points, 0);
    const pointsB = b.cats.reduce((sum, cat) => sum + cat.points, 0);
    return pointsB - pointsA;
  });

  // Deliberately no backdrop-click-to-dismiss here (unlike RulesModal) — the
  // game has genuinely ended and "New Game" is the only real next step,
  // there's no separate toggle that could reopen this popup if a stray
  // click on the dimmed board behind it closed it.
  //
  // Fades in (rather than snapping in instantly) — this component only ever
  // mounts once already-delayed by WIN_SCREEN_DELAY_MS (see GameBoard's
  // showWinScreen effect), so `initial` here is genuinely the first paint,
  // not fighting a re-render.
  return (
    <motion.div
      className="win-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: WIN_SCREEN_FADE_DURATION_S }}
    >
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
        {/* onPlayAgain is only ever passed in online mode (see App.jsx) —
            local hotseat has no "room" to recreate, "New Game" (back to the
            menu) already covers it there. When both are shown, Play Again is
            the primary action (the common case: same group, go again) and
            New Game demotes to secondary (change players/settings instead). */}
        {onPlayAgain && (
          <button type="button" className="primary-button" onClick={onPlayAgain} disabled={playAgainPending}>
            {playAgainPending ? "Starting…" : "Play Again"}
          </button>
        )}
        <button type="button" className={onPlayAgain ? "secondary-button" : "primary-button"} onClick={onNewGame}>
          New Game
        </button>
      </div>
    </motion.div>
  );
}
