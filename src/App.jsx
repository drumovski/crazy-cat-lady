import { useEffect, useState } from "react";
import {
  createGame,
  playDog,
  playFish,
  playCatnip,
  playLaserPointer,
  discardCard,
  discardMathSet,
  respondToPendingAction,
  respondToWakeChoice,
  respondAsAi,
  respondToWakeChoiceAsAi
} from "./game/engine.js";
import { takeAiTurn } from "./game/ai.js";
import { onRoomState, sendGameAction } from "./multiplayer/socketClient.js";
import ModeSelect from "./components/ModeSelect.jsx";
import SetupScreen from "./components/SetupScreen.jsx";
import OnlineSetup from "./components/OnlineSetup.jsx";
import GameBoard from "./components/GameBoard.jsx";
import "./App.css";

const AI_THINK_DELAY_MS = 700;

export default function App() {
  const [screen, setScreen] = useState("menu"); // 'menu' | 'local' | 'online'

  // Local hotseat state
  const [game, setGame] = useState(null);
  const [aiPlayerIds, setAiPlayerIds] = useState([]);
  const [playerNames, setPlayerNames] = useState([]);

  // Online state
  const [onlineSession, setOnlineSession] = useState(null); // { roomCode, playerId }
  const [roomState, setRoomState] = useState(null); // latest payload from the server

  function applyAction(actionFn, ...args) {
    setGame(prevGame => ({ ...actionFn(prevGame, ...args) }));
  }

  // Local hotseat AI: whenever it's an AI-controlled player's turn (or
  // reaction to respond to), automatically decide and apply their move
  // after a short delay so the turn transition is readable.
  useEffect(() => {
    if (screen !== "local" || !game || game.winner !== undefined) {
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

  // Online: once we have a session (created or joined a room), subscribe to
  // that room's authoritative state from the server. All game logic and AI
  // turns run server-side — this just mirrors whatever it broadcasts.
  useEffect(() => {
    if (!onlineSession) {
      return undefined;
    }
    return onRoomState(state => {
      if (state.roomCode === onlineSession.roomCode) {
        setRoomState(state);
      }
    });
  }, [onlineSession]);

  // Seeds roomState with the state OnlineSetup already received, rather than
  // waiting for a fresh subscription below to catch a future broadcast (the
  // "playing" transition is a one-time event that would otherwise be missed
  // in the gap before that effect runs).
  function handleOnlineReady({ roomCode, playerId, initialState }) {
    setOnlineSession({ roomCode, playerId });
    setRoomState(initialState);
  }

  function backToMenu() {
    setScreen("menu");
    setGame(null);
    setAiPlayerIds([]);
    setPlayerNames([]);
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
          onStart={(numPlayers, aiIds, names) => {
            setAiPlayerIds(aiIds);
            setPlayerNames(names);
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

  const { roomCode, playerId: myPlayerId } = onlineSession;
  const dispatch = (type, args) => sendGameAction(roomCode, type, args);

  return (
    <GameBoard
      game={roomState.game}
      aiPlayerIds={roomState.aiPlayerIds}
      playerNames={roomState.playerNames}
      myPlayerId={myPlayerId}
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
