import { createGame } from "./engine.js";
import { chooseAiTurn, takeAiTurn } from "./ai.js";

function testAiPlaysDogWhenAvailable() {
  const game = createGame(2);
  game.players[0].hand = [{ type: "dog" }, { type: "fish" }];

  const decision = chooseAiTurn(game, 0);
  console.log("AI plays Dog when available:", decision.type === "dog");
}

testAiPlaysDogWhenAvailable();

function testAiStealsFromRichestOpponentsHighestValueCat() {
  const game = createGame(3);
  game.players[0].hand = [{ type: "fish" }];
  game.players[1].cats = [{ type: "cat", id: 1, name: "Bengal", points: 5 }];
  game.players[2].cats = [
    { type: "cat", id: 2, name: "Toyger", points: 10 },
    { type: "cat", id: 3, name: "Maine Coon", points: 20 }
  ];

  const decision = chooseAiTurn(game, 0);
  console.log("AI targets the richer opponent (player 2):", decision.targetPlayerId === 2);
  console.log("AI targets that opponent's highest-value cat (Maine Coon, index 1):", decision.targetCatIndex === 1);
}

testAiStealsFromRichestOpponentsHighestValueCat();

function testAiCatnipsRichestOpponent() {
  const game = createGame(2);
  game.players[0].hand = [{ type: "catnip" }];
  game.players[1].cats = [
    { type: "cat", id: 1, name: "Siamese", points: 5 },
    { type: "cat", id: 2, name: "Calico", points: 15 }
  ];

  const decision = chooseAiTurn(game, 0);
  console.log("AI plays Catnip when no Dog/Fish available:", decision.type === "catnip");
  console.log("AI targets the opponent's highest-value cat (Calico, index 1):", decision.targetCatIndex === 1);
}

testAiCatnipsRichestOpponent();

function testAiPlaysLaserWhenNothingBetter() {
  const game = createGame(2);
  game.players[0].hand = [{ type: "laser" }, { type: "number", value: 5 }];
  // player 1 has no cats, so Fish/Catnip wouldn't apply anyway

  const decision = chooseAiTurn(game, 0);
  console.log("AI plays Laser Pointer when nothing better applies:", decision.type === "laser");
}

testAiPlaysLaserWhenNothingBetter();

function testAiDiscardsMathPairWhenNoOtherOptions() {
  const game = createGame(2);
  game.players[0].hand = [
    { type: "seagull" },
    { type: "number", value: 6 },
    { type: "number", value: 6 }
  ];

  const decision = chooseAiTurn(game, 0);
  console.log("AI discards a math pair when available:", decision.type === "discardMathSet");
  console.log("AI's pair indices point at the two 6s:", JSON.stringify(decision.cardIndices) === JSON.stringify([1, 2]));
}

testAiDiscardsMathPairWhenNoOtherOptions();

function testAiFallsBackToSingleDiscard() {
  const game = createGame(2);
  game.players[0].hand = [{ type: "seagull" }, { type: "snail" }];

  const decision = chooseAiTurn(game, 0);
  console.log("AI falls back to a single discard:", decision.type === "discard");
  console.log("AI discards the first discardable card:", decision.cardIndex === 0);
}

testAiFallsBackToSingleDiscard();

function testAiSkipsFishWhenNoOpponentHasCats() {
  const game = createGame(2);
  game.players[0].hand = [{ type: "fish" }, { type: "laser" }];
  // no opponent has cats

  const decision = chooseAiTurn(game, 0);
  console.log("AI skips Fish with no valid target, falls through to Laser:", decision.type === "laser");
}

testAiSkipsFishWhenNoOpponentHasCats();

function testTakeAiTurnAppliesTheChosenAction() {
  const game = createGame(2);
  game.players[0].hand = [{ type: "dog" }];
  const catsBefore = game.players[0].cats.length;

  takeAiTurn(game, 0);

  console.log("takeAiTurn actually applies the action (gained a cat):", game.players[0].cats.length === catsBefore + 1);
  console.log("Turn advanced after AI's action:", game.currentPlayerIndex === 1);
}

testTakeAiTurnAppliesTheChosenAction();
