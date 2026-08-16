import { useEffect, useRef, useState } from "react";
import {
  createGame,
  playDog,
  playFish,
  playCatnip,
  playLaserPointer,
  resolveLaserChaos,
  discardCard,
  discardMathSet,
  respondToPendingAction,
  respondToWakeChoice,
  respondAsAi,
  respondToWakeChoiceAsAi
} from "./game/engine.js";
import { takeAiTurn } from "./game/ai.js";
import { DEFAULT_BLOCK_TIMER_SECONDS } from "./game/blockTimer.js";
import { AI_THINK_DELAY_MS, LASER_CHAOS_DELAY_MS } from "./game/timings.js";
import { onRoomState, onReconnect, sendGameAction, createRoom as createRoomClient, joinRoom as joinRoomClient } from "./multiplayer/socketClient.js";
import ModeSelect from "./components/ModeSelect.jsx";
import SetupScreen from "./components/SetupScreen.jsx";
import OnlineSetup from "./components/OnlineSetup.jsx";
import GameBoard from "./components/GameBoard.jsx";
import { preloadCardImages } from "./components/preloadCardImages.js";
import { startMusic } from "./sound/music.js";
import { preloadSfx } from "./sound/sfx.js";
import "./App.css";

// All three fire once, as soon as this module loads (menu screen, before any
// game exists) — preloadCardImages/preloadSfx warm the browser's cache for
// the card art and sound effects respectively, so the first hand a player
// sees and the very first "shuffle" of the session are already cached
// instead of fetching fresh (a cold fetch of a sound effect noticeably lags
// behind the action that triggered it — see sfx.js). startMusic begins the
// background music playlist; it's a standalone module-level player (see
// music.js), not tied to any screen, so it keeps playing across menu ->
// setup -> game -> New Game without restarting.
preloadCardImages();
preloadSfx();
startMusic();

export default function App() {
  const [screen, setScreen] = useState("menu"); // 'menu' | 'local' | 'online'

  // Local hotseat state
  const [game, setGame] = useState(null);
  const [aiPlayerIds, setAiPlayerIds] = useState([]);
  const [playerNames, setPlayerNames] = useState([]);
  const [blockTimerSeconds, setBlockTimerSeconds] = useState(DEFAULT_BLOCK_TIMER_SECONDS);
  // The raw per-seat name inputs from SetupScreen (not the resolved
  // game-ready names above — no "Player N"/AI-name substitution) — kept
  // across backToMenu (deliberately not reset there) so a player's typed
  // name pre-fills the form again on their next game instead of coming back
  // blank. Seeded once here rather than in SetupScreen's own state so it
  // survives that component fully unmounting between games.
  const [savedPlayerNameInputs, setSavedPlayerNameInputs] = useState(["", "", "", "", ""]);

  // Online state
  const [onlineSession, setOnlineSession] = useState(null); // { roomName, playerId }
  const [roomState, setRoomState] = useState(null); // latest payload from the server
  // Bumped every time handleOnlineReady fires (a room genuinely reaching
  // "playing") and used as <GameBoard>'s key. Needed for "Play Again": that
  // flow goes straight from one finished game's WinScreen into a new one
  // without ever unmounting <GameBoard> in between (same JSX branch, same
  // component type, room name reused on purpose) — React would otherwise
  // treat it as an update, not a fresh mount, and carry over GameBoard's own
  // internal state (messageHistory, selection, etc.) from the just-finished
  // game into the new one. A normal first-time join doesn't need this (the
  // component is mounting into that position for the first time regardless
  // of key), but bumping it there too is harmless and keeps this the one
  // place that owns "is this a new game" rather than only firing on the
  // rejoin path specifically.
  const [onlineGameKey, setOnlineGameKey] = useState(0);
  // Same idea as savedPlayerNameInputs, for OnlineSetup's single "Your name" field.
  const [savedOnlineName, setSavedOnlineName] = useState("");
  // Same idea again, for the "Create Room" screen's room name — lets a
  // player who just finished a game default straight back into the same
  // room name for the next one instead of retyping it (the room itself is
  // freed server-side once a game ends — see the "winner" check in
  // server/index.js's broadcastRoom — so the name really is available again).
  const [savedRoomName, setSavedRoomName] = useState("");
  // Disables the WinScreen's "Play Again" button for the duration of its own
  // create-or-join round trip, so a slow connection or a double-click can't
  // fire two competing attempts from the same client.
  const [playAgainPending, setPlayAgainPending] = useState(false);

  function applyAction(actionFn, ...args) {
    setGame(prevGame => ({ ...actionFn(prevGame, ...args) }));
  }

  // Local hotseat AI: whenever it's an AI-controlled player's turn (or
  // reaction to respond to), automatically decide and apply their move
  // after a short delay so the turn transition is readable.
  useEffect(() => {
    if (screen !== "local" || !game || game.winner !== undefined || game.pendingLaserChaos) {
      return undefined;
    }

    const decisionMakerId = game.pendingAction
      ? game.pendingAction.targetId
      : game.pendingWakeChoice
      ? game.pendingWakeChoice.playerId
      : game.currentPlayerIndex;

    if (!aiPlayerIds.includes(decisionMakerId)) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setGame(prevGame => {
        if (prevGame.pendingAction) {
          return { ...respondAsAi(prevGame, decisionMakerId) };
        }
        if (prevGame.pendingWakeChoice) {
          return { ...respondToWakeChoiceAsAi(prevGame, decisionMakerId) };
        }
        return { ...takeAiTurn(prevGame, decisionMakerId) };
      });
    }, AI_THINK_DELAY_MS);

    return () => clearTimeout(timer);
  }, [screen, game, aiPlayerIds]);

  // A played Laser Pointer highlights its randomly-chosen cat in place
  // (game.pendingLaserChaos) before actually reassigning it — this isn't a
  // decision anyone (human or AI) makes, so it always resolves on its own
  // timer regardless of whose turn it is.
  useEffect(() => {
    if (screen !== "local" || !game || game.winner !== undefined || !game.pendingLaserChaos) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setGame(prevGame => ({ ...resolveLaserChaos(prevGame) }));
    }, LASER_CHAOS_DELAY_MS);

    return () => clearTimeout(timer);
  }, [screen, game]);

  // Online: once we have a session (created or joined a room), subscribe to
  // that room's authoritative state from the server. All game logic and AI
  // turns run server-side — this just mirrors whatever it broadcasts.
  useEffect(() => {
    if (!onlineSession) {
      return undefined;
    }
    return onRoomState(state => {
      if (state.roomName === onlineSession.roomName) {
        setRoomState(state);
      }
    });
  }, [onlineSession]);

  // Read inside the reconnect handler below via a ref rather than as an
  // effect dependency — onlineSession/roomName don't change mid-session, but
  // roomState updates constantly via the subscription above, and
  // re-subscribing to onReconnect on every single broadcast would be wasteful
  // (and pointless, since socket.io's Manager-level "reconnect" event doesn't
  // care how many times a handler gets re-registered).
  const roomStateRef = useRef(roomState);
  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  // A mobile tab backgrounded for more than socket.io's ping-timeout window
  // (~45s by default) gets silently disconnected server-side — which clears
  // that seat's socket binding, same cleanup the abandoned-room sweep relies
  // on (see CLAUDE.md). socket.io's client then auto-reconnects once the tab
  // wakes back up, but under a brand-new socket.id that was never bound to
  // any seat, so every action after that was silently dropped server-side
  // (the same "invalid seat" guard that silently drops a rate-limited
  // action) — the player could still select cards, but nothing they did
  // actually reached the game, and selections just reverted.
  //
  // This is a different gap than the existing "rejoin by name" fix (see
  // CLAUDE.md's "Online multiplayer" section): that one only helps a player
  // who reloads the page and manually retypes their name into "Join Room".
  // Here the tab never reloads at all — GameBoard stays mounted with stale
  // state the whole time — so the fix has to happen automatically, by
  // re-running the exact same rejoin-by-name flow the moment the socket
  // reconnects, without waiting for the player to notice anything's wrong.
  useEffect(() => {
    if (!onlineSession) {
      return undefined;
    }
    return onReconnect(async () => {
      const currentRoomState = roomStateRef.current;
      if (!currentRoomState) return;

      const myName = currentRoomState.playerNames[onlineSession.playerId];
      const result = await joinRoomClient(onlineSession.roomName, myName);

      if (result.error) {
        // Genuinely can't reclaim the seat (room gone, name no longer
        // matches, etc.) — don't leave the player stranded on a frozen
        // board with no path forward.
        backToMenu();
        return;
      }
      setRoomState(result);
    });
  }, [onlineSession]);

  // Seeds roomState with the state OnlineSetup already received, rather than
  // waiting for a fresh subscription below to catch a future broadcast (the
  // "playing" transition is a one-time event that would otherwise be missed
  // in the gap before that effect runs).
  function handleOnlineReady({ roomName, playerId, initialState }) {
    setOnlineSession({ roomName, playerId });
    setRoomState(initialState);
    setOnlineGameKey(k => k + 1);
  }

  // Online WinScreen's "Play Again" button. The room the game was just
  // played in no longer exists server-side by this point — broadcastRoom
  // removes it the moment a winner is set (see "Rooms are freed once the
  // game ends" in CLAUDE.md) — so this recreates one with the same name and
  // settings, read straight off the last roomState this client ever
  // received (still sitting in React state, even though the server's own
  // copy is gone). Every player who clicks races the same create call: the
  // first to reach the server wins and becomes this game's creator (not
  // necessarily the original creator — just whoever clicked first), and
  // every other client's create attempt fails on the room-name collision, at
  // which point it falls back to an ordinary join instead. No coordination
  // between clients beyond that race is needed.
  async function handlePlayAgain() {
    if (!roomState || !onlineSession || playAgainPending) return;
    setPlayAgainPending(true);

    const { roomName, numPlayers, aiPlayerIds, playerNames, blockTimerSeconds } = roomState;
    const numAiOpponents = aiPlayerIds.length;
    const myName = playerNames[onlineSession.playerId];

    let result = await createRoomClient(numPlayers, numAiOpponents, myName, roomName, blockTimerSeconds);
    if (result.error) {
      // Most likely: another player's own "Play Again" click already won the
      // race and recreated this room name first — join it instead.
      result = await joinRoomClient(roomName, myName);
    }

    setPlayAgainPending(false);

    if (result.error) {
      // Both attempts failed (room genuinely gone stale some other way) —
      // don't strand the player on a dead button, send them to the menu.
      backToMenu();
      return;
    }

    if (result.status === "playing") {
      handleOnlineReady({ roomName: result.roomName, playerId: result.playerId, initialState: result });
    } else {
      // Not everyone's rejoined yet — same "waiting for other players" state
      // a normal create/join would produce; OnlineSetup picks this up via
      // its initialRoom prop instead of starting back at the mode chooser.
      setOnlineSession({ roomName: result.roomName, playerId: result.playerId });
      setRoomState(result);
    }
  }

  function backToMenu() {
    setScreen("menu");
    setGame(null);
    setAiPlayerIds([]);
    setPlayerNames([]);
    setBlockTimerSeconds(DEFAULT_BLOCK_TIMER_SECONDS);
    setOnlineSession(null);
    setRoomState(null);
    // savedPlayerNameInputs/savedOnlineName/savedRoomName are deliberately
    // NOT reset here — the whole point is for a typed name/room to survive
    // into the next game instead of coming back blank.
  }

  if (screen === "menu") {
    return <ModeSelect onChooseLocal={() => setScreen("local")} onChooseOnline={() => setScreen("online")} />;
  }

  if (screen === "local") {
    if (!game) {
      return (
        <SetupScreen
          initialNames={savedPlayerNameInputs}
          onBack={backToMenu}
          onStart={(numPlayers, aiIds, names, timerSeconds, rawNames) => {
            setAiPlayerIds(aiIds);
            setPlayerNames(names);
            setBlockTimerSeconds(timerSeconds);
            setSavedPlayerNameInputs(rawNames);
            setGame(createGame(numPlayers));
          }}
        />
      );
    }

    return (
      <GameBoard
        game={game}
        aiPlayerIds={aiPlayerIds}
        playerNames={playerNames}
        blockTimerSeconds={blockTimerSeconds}
        onNewGame={backToMenu}
        onPlayDog={(playerId, cardIndex, slotIndex) => applyAction(playDog, playerId, cardIndex, slotIndex)}
        onPlayFish={(playerId, cardIndex, targetPlayerId, targetCatIndex) =>
          applyAction(playFish, playerId, cardIndex, targetPlayerId, targetCatIndex)
        }
        onPlayCatnip={(playerId, cardIndex, targetPlayerId, targetCatIndex) =>
          applyAction(playCatnip, playerId, cardIndex, targetPlayerId, targetCatIndex)
        }
        onPlayLaserPointer={(playerId, cardIndex) => applyAction(playLaserPointer, playerId, cardIndex)}
        onDiscard={(playerId, cardIndex) => applyAction(discardCard, playerId, cardIndex)}
        onDiscardMathSet={(playerId, cardIndices) => applyAction(discardMathSet, playerId, cardIndices)}
        onRespondToPendingAction={(playerId, blockCardIndex) =>
          applyAction(respondToPendingAction, playerId, blockCardIndex)
        }
        onRespondToWakeChoice={(playerId, slotIndex) => applyAction(respondToWakeChoice, playerId, slotIndex)}
      />
    );
  }

  // screen === "online"
  if (!onlineSession || !roomState || roomState.status !== "playing") {
    return (
      <OnlineSetup
        onReady={handleOnlineReady}
        onBack={backToMenu}
        initialName={savedOnlineName}
        onNameChange={setSavedOnlineName}
        initialRoomName={savedRoomName}
        onRoomNameChange={setSavedRoomName}
        // Set only mid-flight through handlePlayAgain (a fresh create/join
        // that hasn't reached "playing" yet) — null in every other path here
        // (ordinary menu entry, or backToMenu having cleared onlineSession),
        // so OnlineSetup only skips its normal chooser screen for that case.
        initialRoom={onlineSession}
      />
    );
  }

  const { roomName, playerId: myPlayerId } = onlineSession;
  const dispatch = (type, args) => sendGameAction(roomName, type, args);

  return (
    <GameBoard
      key={onlineGameKey}
      game={roomState.game}
      aiPlayerIds={roomState.aiPlayerIds}
      playerNames={roomState.playerNames}
      myPlayerId={myPlayerId}
      blockTimerSeconds={roomState.blockTimerSeconds}
      onNewGame={backToMenu}
      onPlayAgain={handlePlayAgain}
      playAgainPending={playAgainPending}
      onPlayDog={(_playerId, cardIndex, slotIndex) => dispatch("playDog", [cardIndex, slotIndex])}
      onPlayFish={(_playerId, cardIndex, targetPlayerId, targetCatIndex) =>
        dispatch("playFish", [cardIndex, targetPlayerId, targetCatIndex])
      }
      onPlayCatnip={(_playerId, cardIndex, targetPlayerId, targetCatIndex) =>
        dispatch("playCatnip", [cardIndex, targetPlayerId, targetCatIndex])
      }
      onPlayLaserPointer={(_playerId, cardIndex) => dispatch("playLaserPointer", [cardIndex])}
      onDiscard={(_playerId, cardIndex) => dispatch("discardCard", [cardIndex])}
      onDiscardMathSet={(_playerId, cardIndices) => dispatch("discardMathSet", [cardIndices])}
      onRespondToPendingAction={(_playerId, blockCardIndex) => dispatch("respondToPendingAction", [blockCardIndex])}
      onRespondToWakeChoice={(_playerId, slotIndex) => dispatch("respondToWakeChoice", [slotIndex])}
    />
  );
}
