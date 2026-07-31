import { useEffect, useState } from "react";
import {
  createGame,
  playDog,
  playFish,
  playCatnip,
  playLaserPointer,
  resolveLaserReveal,
  discardCard,
  discardMathSet,
  respondToPendingAction,
  respondToWakeChoice,
  respondAsAi,
  respondToWakeChoiceAsAi
} from "./game/engine.js";
import { takeAiTurn } from "./game/ai.js";
import { DEFAULT_BLOCK_TIMER_SECONDS } from "./game/blockTimer.js";
import { AI_THINK_DELAY_MS, LASER_REVEAL_DELAY_MS } from "./game/timings.js";
import { onRoomState, sendGameAction } from "./multiplayer/socketClient.js";
import ModeSelect from "./components/ModeSelect.jsx";
import SetupScreen from "./components/SetupScreen.jsx";
import OnlineSetup from "./components/OnlineSetup.jsx";
import GameBoard from "./components/GameBoard.jsx";
import { preloadCardImages } from "./components/preloadCardImages.js";
import "./App.css";

// Fires once, as soon as this module loads (menu screen, before any game
// exists) — starts warming the browser's image cache for the whole deck so
// the first hand a player actually sees is already cached rather than
// fetching each card's art fresh.
preloadCardImages();

export default function App() {
  const [screen, setScreen] = useState("menu"); // 'menu' | 'local' | 'online'

  // Local hotseat state
  const [game, setGame] = useState(null);
  const [aiPlayerIds, setAiPlayerIds] = useState([]);
  const [playerNames, setPlayerNames] = useState([]);
  const [blockTimerSeconds, setBlockTimerSeconds] = useState(DEFAULT_BLOCK_TIMER_SECONDS);

  // Online state
  const [onlineSession, setOnlineSession] = useState(null); // { roomName, playerId }
  const [roomState, setRoomState] = useState(null); // latest payload from the server

  function applyAction(actionFn, ...args) {
    setGame(prevGame => ({ ...actionFn(prevGame, ...args) }));
  }

  // Local hotseat AI: whenever it's an AI-controlled player's turn (or
  // reaction to respond to), automatically decide and apply their move
  // after a short delay so the turn transition is readable.
  useEffect(() => {
    if (screen !== "local" || !game || game.winner !== undefined || game.pendingLaserReveal) {
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

  // A played Laser Pointer flips the top card face-up on the deck for
  // everyone to see (game.pendingLaserReveal) before its effect — added to a
  // hand, or the count-around wake choice — is actually applied. This isn't
  // a decision anyone (human or AI) makes, so it always resolves on its own
  // timer regardless of whose turn it is.
  useEffect(() => {
    if (screen !== "local" || !game || game.winner !== undefined || !game.pendingLaserReveal) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setGame(prevGame => ({ ...resolveLaserReveal(prevGame) }));
    }, LASER_REVEAL_DELAY_MS);

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

  // Seeds roomState with the state OnlineSetup already received, rather than
  // waiting for a fresh subscription below to catch a future broadcast (the
  // "playing" transition is a one-time event that would otherwise be missed
  // in the gap before that effect runs).
  function handleOnlineReady({ roomName, playerId, initialState }) {
    setOnlineSession({ roomName, playerId });
    setRoomState(initialState);
  }

  function backToMenu() {
    setScreen("menu");
    setGame(null);
    setAiPlayerIds([]);
    setPlayerNames([]);
    setBlockTimerSeconds(DEFAULT_BLOCK_TIMER_SECONDS);
    setOnlineSession(null);
    setRoomState(null);
  }

  if (screen === "menu") {
    return <ModeSelect onChooseLocal={() => setScreen("local")} onChooseOnline={() => setScreen("online")} />;
  }

  if (screen === "local") {
    if (!game) {
      return (
        <SetupScreen
          onStart={(numPlayers, aiIds, names, timerSeconds) => {
            setAiPlayerIds(aiIds);
            setPlayerNames(names);
            setBlockTimerSeconds(timerSeconds);
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
    return <OnlineSetup onReady={handleOnlineReady} onBack={backToMenu} />;
  }

  const { roomName, playerId: myPlayerId } = onlineSession;
  const dispatch = (type, args) => sendGameAction(roomName, type, args);

  return (
    <GameBoard
      game={roomState.game}
      aiPlayerIds={roomState.aiPlayerIds}
      playerNames={roomState.playerNames}
      myPlayerId={myPlayerId}
      blockTimerSeconds={roomState.blockTimerSeconds}
      onNewGame={backToMenu}
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
