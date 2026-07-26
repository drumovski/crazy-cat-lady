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
import SetupScreen from "./components/SetupScreen.jsx";
import GameBoard from "./components/GameBoard.jsx";
import "./App.css";

const AI_THINK_DELAY_MS = 700;

export default function App() {
  const [game, setGame] = useState(null);
  const [aiPlayerIds, setAiPlayerIds] = useState([]);

  function applyAction(actionFn, ...args) {
    setGame(prevGame => ({ ...actionFn(prevGame, ...args) }));
  }

  // Whenever it's an AI-controlled player's turn (or their reaction to
  // respond to), automatically decide and apply their move after a short
  // delay so the turn transition is readable.
  useEffect(() => {
    if (!game || game.winner !== undefined) {
      return;
    }

    const decisionMakerId = game.pendingAction
      ? game.pendingAction.targetId
      : game.pendingWakeChoice
      ? game.pendingWakeChoice.playerId
      : game.currentPlayerIndex;

    if (!aiPlayerIds.includes(decisionMakerId)) {
      return;
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
  }, [game, aiPlayerIds]);

  if (!game) {
    return (
      <SetupScreen
        onStart={(numPlayers, aiIds) => {
          setAiPlayerIds(aiIds);
          setGame(createGame(numPlayers));
        }}
      />
    );
  }

  return (
    <GameBoard
      game={game}
      aiPlayerIds={aiPlayerIds}
      onNewGame={() => setGame(null)}
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
