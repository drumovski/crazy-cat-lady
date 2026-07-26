import { useState } from "react";
import {
  createGame,
  playDog,
  playFish,
  playCatnip,
  playLaserPointer,
  discardCard,
  discardMathSet,
  respondToPendingAction,
  respondToWakeChoice
} from "./game/engine.js";
import SetupScreen from "./components/SetupScreen.jsx";
import GameBoard from "./components/GameBoard.jsx";
import "./App.css";

export default function App() {
  const [game, setGame] = useState(null);

  function applyAction(actionFn, ...args) {
    setGame(prevGame => ({ ...actionFn(prevGame, ...args) }));
  }

  if (!game) {
    return <SetupScreen onStart={numPlayers => setGame(createGame(numPlayers))} />;
  }

  return (
    <GameBoard
      game={game}
      onNewGame={() => setGame(null)}
      onPlayDog={(playerId, cardIndex, slotIndex) => applyAction(playDog, playerId, cardIndex, slotIndex)}
      onPlayFish={(playerId, cardIndex, targetPlayerId) => applyAction(playFish, playerId, cardIndex, targetPlayerId)}
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
