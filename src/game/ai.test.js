import { createGame } from "./engine.js";
import { chooseAiTurn, takeAiTurn, AI_NAMES, pickRandomAiName } from "./ai.js";

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
  // Replace every sleeping slot with a plain (non-Sphynx, no pairKey) cat.
  // Left to the real shuffled sleepingCats, the AI's "random available slot"
  // policy has a ~1-in-12 chance of landing on the Sphynx, which grants a
  // bonus wake instead of finishing the turn — leaving currentPlayerIndex
  // unchanged and making the assertion below flaky. (Reducing to a single
  // available slot instead of replacing all 12 would trade that flakiness
  // for another: waking the one remaining cat empties sleepingCats entirely,
  // which triggers checkWinner's "all cats distributed" fallback and ends
  // the game without advancing the turn either.)
  game.sleepingCats = game.sleepingCats.map((cat, slot) => ({
    type: "cat",
    id: 100 + slot,
    name: "Test Cat",
    points: 5,
    slot,
    awake: false
  }));
  const catsBefore = game.players[0].cats.length;

  takeAiTurn(game, 0);

  console.log("takeAiTurn actually applies the action (gained a cat):", game.players[0].cats.length === catsBefore + 1);
  console.log("Turn advanced after AI's action:", game.currentPlayerIndex === 1);
}

testTakeAiTurnAppliesTheChosenAction();

function testPickRandomAiNameAvoidsUsedNames() {
  const usedNames = AI_NAMES.slice(0, AI_NAMES.length - 1); // all but one taken
  const picked = pickRandomAiName(usedNames);
  console.log("Picks the one remaining unused name:", picked === AI_NAMES[AI_NAMES.length - 1]);
}

testPickRandomAiNameAvoidsUsedNames();

function testPickRandomAiNameFallsBackWhenAllUsed() {
  const picked = pickRandomAiName(AI_NAMES);
  console.log("Falls back to the full list when all names are taken:", AI_NAMES.includes(picked));
}

testPickRandomAiNameFallsBackWhenAllUsed();
