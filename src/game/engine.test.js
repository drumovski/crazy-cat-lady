import {
  createGame,
  playDog,
  playFish,
  playCatnip,
  respondToPendingAction,
  respondAsAi,
  respondToWakeChoice,
  wakeCatAtSlot,
  giveCatToPlayer,
  drawCard,
  discardCard,
  discardMathSet,
  isValidMathDiscard,
  playLaserPointer,
  resolveLaserReveal,
  checkWinner
} from "./engine.js";

// Test-only helper: wakes and hands a specific player any one sleeping cat,
// bypassing turn/card rules, so tests can set up state directly.
function testGiveAnyCatToPlayer(game, player) {
  const slot = game.sleepingCats.findIndex(c => c !== null);
  const cat = wakeCatAtSlot(game, slot);
  player.cats.push(cat);
  return cat;
}

// tests
function testWinCondition() {
  const game = createGame(2, 0);

  let attempts = 0;
  while (game.winner === undefined && attempts < 60) {
    if (game.pendingWakeChoice) {
      const slot = game.sleepingCats.findIndex(c => c !== null);
      respondToWakeChoice(game, game.pendingWakeChoice.playerId, slot);
      attempts++;
      continue;
    }

    const currentPlayer = game.players[game.currentPlayerIndex];
    const dogIndex = currentPlayer.hand.findIndex(c => c.type === "dog");

    if (dogIndex === -1) {
      // No Dog available — discard the first card instead
      discardCard(game, game.currentPlayerIndex, 0);
    } else {
      const slotIndex = game.sleepingCats.findIndex(c => c !== null);
      playDog(game, game.currentPlayerIndex, dogIndex, slotIndex);
    }

    attempts++;
  }

  console.log("Final cats count, player 0:", game.players[0].cats.length);
  console.log("Final cats count, player 1:", game.players[1].cats.length);
  console.log("Winner:", game.winner);
}

testWinCondition();


function testFish() {
  const game = createGame(2, 0);

  // Force player 0 to have a Fish card at index 0
  game.players[0].hand[0] = { type: "fish" };

  // Make sure player 1 has no Seagull to block with, for a deterministic test
  game.players[1].hand = game.players[1].hand.filter(c => c.type !== "seagull");

  // Force player 1 to already have a cat to steal
  testGiveAnyCatToPlayer(game, game.players[1]);

  console.log("Before steal — player 0 cats:", game.players[0].cats.length);
  console.log("Before steal — player 1 cats:", game.players[1].cats.length);

  playFish(game, 0, 0, 1, 0); // player 0 plays fish at index 0, targeting player 1's cat at index 0

  console.log("After steal — player 0 cats:", game.players[0].cats.length);
  console.log("After steal — player 1 cats:", game.players[1].cats.length);
  console.log("Current player (should be 1):", game.currentPlayerIndex);
}

testFish();

function testFishBlockedBySeagull() {
  const game = createGame(2, 0);

  game.players[0].hand[0] = { type: "fish" };
  game.players[1].hand[0] = { type: "seagull" };

  testGiveAnyCatToPlayer(game, game.players[1]);

  playFish(game, 0, 0, 1, 0);
  console.log("Pending action after Fish (should be 'fish'):", game.pendingAction && game.pendingAction.type);

  respondToPendingAction(game, 1, 0); // player 1 blocks with the Seagull at index 0

  console.log("After block — player 0 cats (should be 0):", game.players[0].cats.length);
  console.log("After block — player 1 cats (should be 1):", game.players[1].cats.length);
  console.log("Pending action cleared:", game.pendingAction);
  console.log("Current player (should be 1):", game.currentPlayerIndex);
}

testFishBlockedBySeagull();

function testCatnip() {
  const game = createGame(2, 0);

  game.players[0].hand[0] = { type: "catnip" };
  game.players[1].hand = game.players[1].hand.filter(c => c.type !== "snail");

  const cat = testGiveAnyCatToPlayer(game, game.players[1]);

  playCatnip(game, 0, 0, 1, 0); // player 0 puts player 1's cat (index 0) back to sleep

  console.log("After Catnip — player 1 cats (should be 0):", game.players[1].cats.length);
  console.log("After Catnip — cat is back asleep in its own slot:", game.sleepingCats[cat.slot] !== null && game.sleepingCats[cat.slot].id === cat.id);
  console.log("Current player (should be 1):", game.currentPlayerIndex);
}

testCatnip();

function testCatnipBlockedBySnail() {
  const game = createGame(2, 0);

  game.players[0].hand[0] = { type: "catnip" };
  game.players[1].hand[0] = { type: "snail" };

  testGiveAnyCatToPlayer(game, game.players[1]);

  playCatnip(game, 0, 0, 1, 0);
  respondToPendingAction(game, 1, 0); // player 1 blocks with the Snail at index 0

  console.log("After block — player 1 still has cat (should be 1):", game.players[1].cats.length);
  console.log("Current player (should be 1):", game.currentPlayerIndex);
}

testCatnipBlockedBySnail();

function testLaserPointer() {
  const game = createGame(2, 0);

  game.players[0].hand[0] = { type: "laser" };
  game.deck.unshift({ type: "number", value: 2 }); // land on player 0 + 2 - 1 = player 1

  const catsBefore = game.players[1].cats.length;
  playLaserPointer(game, 0, 0);

  console.log("Card revealed face-up, effect not yet applied:", game.pendingLaserReveal && game.pendingLaserReveal.revealedCard.value === 2);
  console.log("Turn not yet advanced during reveal:", game.currentPlayerIndex === 0);

  resolveLaserReveal(game);

  console.log("Pending wake choice for player 1:", game.pendingWakeChoice && game.pendingWakeChoice.playerId);

  const chosenSlot = game.sleepingCats.findIndex(c => c !== null);
  respondToWakeChoice(game, 1, chosenSlot);

  console.log("After Laser Pointer — player 1 gained a cat:", game.players[1].cats.length === catsBefore + 1);
  console.log("Current player (should be 1):", game.currentPlayerIndex);
}

testLaserPointer();

function testAiAutoBlocks() {
  const game = createGame(2, 0);

  game.players[0].hand[0] = { type: "fish" };
  game.players[1].hand[0] = { type: "seagull" };

  testGiveAnyCatToPlayer(game, game.players[1]);

  playFish(game, 0, 0, 1, 0);
  respondAsAi(game, 1); // player 1 is AI-controlled — should auto-block since it holds a Seagull

  console.log("AI auto-blocked — player 0 cats (should be 0):", game.players[0].cats.length);
  console.log("AI auto-blocked — player 1 cats (should be 1):", game.players[1].cats.length);
}

testAiAutoBlocks();

function testDeckReshuffle() {
  const game = createGame(2, 0);

  // Empty the deck, but leave some cards sitting in the discard pile
  game.deck = [];
  game.discardPile = [
    { type: "number", value: 3 },
    { type: "number", value: 7 },
    { type: "dog" }
  ];

  const player = game.players[0];
  const handSizeBefore = player.hand.length;

  drawCard(game, player);

  console.log("Discard pile reshuffled into deck (should be empty):", game.discardPile.length === 0);
  console.log("Deck now has cards (should be true):", game.deck.length > 0);
  console.log("Player drew a card (should be true):", player.hand.length === handSizeBefore + 1);
}

testDeckReshuffle();

function testMathDiscardPair() {
  const game = createGame(2, 0);

  game.players[0].hand = [
    { type: "number", value: 5 },
    { type: "number", value: 5 },
    { type: "dog" }
  ];
  const handSizeBefore = game.players[0].hand.length;

  discardMathSet(game, 0, [0, 1]); // discard the matching pair of 5s

  console.log("Pair discard — cards removed, replacements drawn (hand size unchanged):", game.players[0].hand.length === handSizeBefore);
  console.log("Pair discard — discard pile got 2 cards:", game.discardPile.length === 2);
  console.log("Current player (should be 1):", game.currentPlayerIndex);
}

testMathDiscardPair();

function testMathDiscardAddition() {
  const game = createGame(2, 0);

  game.players[0].hand = [
    { type: "number", value: 2 },
    { type: "number", value: 5 },
    { type: "number", value: 7 },
    { type: "dog" }
  ];
  const handSizeBefore = game.players[0].hand.length;

  discardMathSet(game, 0, [0, 1, 2]); // 2 + 5 = 7

  console.log("Addition discard — hand size unchanged:", game.players[0].hand.length === handSizeBefore);
  console.log("Addition discard — discard pile got 3 cards:", game.discardPile.length === 3);
  console.log("Current player (should be 1):", game.currentPlayerIndex);
}

testMathDiscardAddition();

function testMathDiscardRejectsInvalidSet() {
  const game = createGame(2, 0);

  game.players[0].hand = [
    { type: "number", value: 2 },
    { type: "number", value: 3 },
    { type: "number", value: 7 }
  ];
  const handSizeBefore = game.players[0].hand.length;
  const currentPlayerBefore = game.currentPlayerIndex;

  discardMathSet(game, 0, [0, 1, 2]); // 2 + 3 != 7 — invalid

  console.log("Invalid set rejected — hand untouched:", game.players[0].hand.length === handSizeBefore);
  console.log("Invalid set rejected — turn did not advance:", game.currentPlayerIndex === currentPlayerBefore);
}

testMathDiscardRejectsInvalidSet();

function testGingerTomConflict() {
  const game = createGame(2, 0);
  const player = game.players[0];

  const gingerToms = game.sleepingCats.filter(c => c !== null && c.pairKey === "gingerTom");
  const firstSlot = gingerToms[0].slot;
  const secondSlot = gingerToms[1].slot;

  const firstCat = wakeCatAtSlot(game, firstSlot);
  giveCatToPlayer(game, player, firstCat);

  const secondCat = wakeCatAtSlot(game, secondSlot);
  const joined = giveCatToPlayer(game, player, secondCat);

  console.log("Second Ginger Tom rejected (should be false):", joined);
  console.log("Player still only has 1 cat:", player.cats.length === 1);
  console.log("Second Ginger Tom back asleep in its own slot:", game.sleepingCats[secondSlot] !== null && game.sleepingCats[secondSlot].pairKey === "gingerTom");
}

testGingerTomConflict();

function testSphynxBonusWake() {
  const game = createGame(2, 0);

  const sphynx = game.sleepingCats.find(c => c !== null && c.wakesBonus);
  game.players[0].hand[0] = { type: "dog" };

  playDog(game, 0, 0, sphynx.slot);

  console.log("Sphynx woken, bonus wake pending for player 0:", game.pendingWakeChoice && game.pendingWakeChoice.playerId === 0);
  console.log("Turn not yet advanced:", game.currentPlayerIndex === 0);

  const bonusSlot = game.sleepingCats.findIndex(c => c !== null);
  respondToWakeChoice(game, 0, bonusSlot);

  console.log("Player 0 gained 2 cats from one Dog play:", game.players[0].cats.length === 2);
  console.log("Current player (should be 1):", game.currentPlayerIndex);
}

testSphynxBonusWake();

function testPointsWinCondition() {
  const game = createGame(2, 0);
  const player = game.players[0];

  // 20 + 15 + 15 = 50 points from just 3 cats — should win despite < 5 cats
  player.cats = [
    { type: "cat", id: 100, name: "Maine Coon", points: 20 },
    { type: "cat", id: 101, name: "Calico", points: 15 },
    { type: "cat", id: 102, name: "Persian", points: 15 }
  ];

  const winnerId = checkWinner(game);
  console.log("Player wins on points with only 3 cats:", winnerId === 0);
}

testPointsWinCondition();

function testFishRejectsSelfTarget() {
  const game = createGame(2, 0);

  game.players[0].hand[0] = { type: "fish" };
  testGiveAnyCatToPlayer(game, game.players[0]);

  const catsBefore = game.players[0].cats.length;
  const currentPlayerBefore = game.currentPlayerIndex;

  playFish(game, 0, 0, 0, 0); // player 0 targeting themselves

  console.log("Fish self-target rejected — cats unchanged:", game.players[0].cats.length === catsBefore);
  console.log("Fish self-target rejected — turn did not advance:", game.currentPlayerIndex === currentPlayerBefore);
}

testFishRejectsSelfTarget();

function testCatnipRejectsSelfTarget() {
  const game = createGame(2, 0);

  game.players[0].hand[0] = { type: "catnip" };
  testGiveAnyCatToPlayer(game, game.players[0]);

  const catsBefore = game.players[0].cats.length;
  const currentPlayerBefore = game.currentPlayerIndex;

  playCatnip(game, 0, 0, 0, 0); // player 0 targeting themselves

  console.log("Catnip self-target rejected — cats unchanged:", game.players[0].cats.length === catsBefore);
  console.log("Catnip self-target rejected — turn did not advance:", game.currentPlayerIndex === currentPlayerBefore);
}

testCatnipRejectsSelfTarget();

function testInvalidCardIndexIsRejected() {
  const game = createGame(2, 0);
  const player = game.players[0];
  const handSizeBefore = player.hand.length;
  const discardSizeBefore = game.discardPile.length;
  const currentPlayerBefore = game.currentPlayerIndex;

  playFish(game, 0, 99, 1);
  playCatnip(game, 0, 99, 1, 0);
  playLaserPointer(game, 0, 99);
  discardCard(game, 0, 99);

  console.log("Invalid card index — hand untouched:", player.hand.length === handSizeBefore);
  console.log("Invalid card index — discard pile untouched:", game.discardPile.length === discardSizeBefore);
  console.log("Invalid card index — turn did not advance:", game.currentPlayerIndex === currentPlayerBefore);
}

testInvalidCardIndexIsRejected();

function testPlayDogRejectsInvalidPlayerIdWithoutCrashing() {
  const game = createGame(2, 0);
  const currentPlayerBefore = game.currentPlayerIndex;

  playDog(game, 99, 0, 0); // playerId 99 doesn't exist — shouldn't throw

  console.log("Invalid playerId in playDog rejected — turn did not advance:", game.currentPlayerIndex === currentPlayerBefore);
}

testPlayDogRejectsInvalidPlayerIdWithoutCrashing();

function testWinThresholdScalesWithFourPlayers() {
  const game = createGame(4, 0);
  const player = game.players[0];

  // 4 cats, well under 40 points — should still win on cat count alone
  player.cats = [
    { type: "cat", id: 200, name: "Bengal", points: 5 },
    { type: "cat", id: 201, name: "Siamese", points: 5 },
    { type: "cat", id: 202, name: "Toyger", points: 10 },
    { type: "cat", id: 203, name: "Ragdoll", points: 10 }
  ];

  console.log("4-player game wins at 4 cats (should be 0):", checkWinner(game) === 0);
}

testWinThresholdScalesWithFourPlayers();

function testPointsThresholdScalesWithFourPlayers() {
  const game = createGame(4, 0);
  const player = game.players[0];

  // 20 + 20 = 40 points from just 2 cats — should win despite < 4 cats
  player.cats = [
    { type: "cat", id: 210, name: "Maine Coon", points: 20 },
    { type: "cat", id: 211, name: "Maine Coon (test dupe)", points: 20 }
  ];

  console.log("4-player game wins at 40 points with only 2 cats:", checkWinner(game) === 0);
}

testPointsThresholdScalesWithFourPlayers();

function testTwoPlayerThresholdUnaffected() {
  const game = createGame(2, 0);
  const player = game.players[0];

  // 4 cats worth 30 points total — should NOT win in a 2-player game
  // (needs 5 cats or 50 points)
  player.cats = [
    { type: "cat", id: 220, name: "Toyger", points: 10 },
    { type: "cat", id: 221, name: "Ragdoll", points: 10 },
    { type: "cat", id: 222, name: "Bombay", points: 5 },
    { type: "cat", id: 223, name: "Russian Blue", points: 5 }
  ];

  console.log("2-player game does NOT win at 4 cats/30 points:", checkWinner(game) === null);
}

testTwoPlayerThresholdUnaffected();

function testAllCatsAwakeWithNoWinnerBreaksTieByPoints() {
  const game = createGame(3, 0);

  // All 12 cats distributed, 4 each, nobody hits the 5-cat threshold.
  // Player 1 has the most points and should win the tiebreak.
  game.sleepingCats = game.sleepingCats.map(() => null);
  game.players[0].cats = [
    { type: "cat", id: 300, points: 5 },
    { type: "cat", id: 301, points: 5 },
    { type: "cat", id: 302, points: 10 },
    { type: "cat", id: 303, points: 10 }
  ];
  game.players[1].cats = [
    { type: "cat", id: 304, points: 20 },
    { type: "cat", id: 305, points: 15 },
    { type: "cat", id: 306, points: 15 },
    { type: "cat", id: 307, points: 5 }
  ];
  game.players[2].cats = [
    { type: "cat", id: 308, points: 10 },
    { type: "cat", id: 309, points: 10 },
    { type: "cat", id: 310, points: 5 },
    { type: "cat", id: 311, points: 5 }
  ];

  console.log("All cats awake, no threshold met, tiebreak picks the points leader (should be 1):", checkWinner(game) === 1);
}

testAllCatsAwakeWithNoWinnerBreaksTieByPoints();

function testFishStealsChosenCat() {
  const game = createGame(2, 0);

  game.players[0].hand[0] = { type: "fish" };
  game.players[1].hand = game.players[1].hand.filter(c => c.type !== "seagull");
  game.players[1].cats = [
    { type: "cat", id: 400, name: "Toyger", points: 10 },
    { type: "cat", id: 401, name: "Bengal", points: 5 },
    { type: "cat", id: 402, name: "Maine Coon", points: 20 }
  ];

  playFish(game, 0, 0, 1, 2); // steal the Maine Coon at index 2, not the first cat

  console.log("Stole the chosen cat (Maine Coon), not the first one:", game.players[0].cats[0] && game.players[0].cats[0].id === 402);
  console.log("Target kept the other two cats:", game.players[1].cats.length === 2 && game.players[1].cats.every(c => c.id !== 402));
}

testFishStealsChosenCat();

function testTripletDiscardWakesACat() {
  const game = createGame(2, 0);
  const player = game.players[0];
  player.hand = [
    { type: "number", value: 5 },
    { type: "number", value: 5 },
    { type: "number", value: 5 },
    { type: "number", value: 3 },
    { type: "number", value: 7 }
  ];

  console.log(
    "Three matching Number cards are a valid math discard:",
    isValidMathDiscard([player.hand[0], player.hand[1], player.hand[2]])
  );
  console.log(
    "Four matching Number cards are NOT a valid math discard (rule is exactly 3):",
    !isValidMathDiscard([
      { type: "number", value: 5 },
      { type: "number", value: 5 },
      { type: "number", value: 5 },
      { type: "number", value: 5 }
    ])
  );

  discardMathSet(game, 0, [0, 1, 2]);

  console.log("Hand size unchanged (3 discarded, 3 redrawn):", player.hand.length === 5);
  console.log("Discard pile got the 3 matching cards:", game.discardPile.length === 3);
  console.log("A wake choice is now pending for player 0:", game.pendingWakeChoice?.playerId === 0);
  console.log("Turn has not advanced yet:", game.currentPlayerIndex === 0);

  // Resolve the wake choice (and any Sphynx-chained bonus it happens to
  // land on) the same way a player/AI would, then confirm the turn is free
  // to advance normally afterward — same generic pendingWakeChoice mechanism
  // Dog/Sphynx/Hot Dog/Laser Pointer already use, so nothing else should
  // need to know or care that a discard was what granted this one.
  let guard = 0;
  while (game.pendingWakeChoice && guard < 12) {
    const slot = game.sleepingCats.findIndex(c => c !== null);
    respondToWakeChoice(game, 0, slot);
    guard++;
  }
  console.log("Player 0 gained at least one cat:", player.cats.length >= 1);
  console.log("pendingWakeChoice cleared once resolved:", game.pendingWakeChoice === null);
  console.log("Turn advanced to player 1:", game.currentPlayerIndex === 1);
}

testTripletDiscardWakesACat();

function testTripletDiscardWithNoSleepingCatsJustFinishesTurn() {
  const game = createGame(2, 0);
  game.sleepingCats = game.sleepingCats.map(() => null);
  const player = game.players[0];
  player.hand = [
    { type: "number", value: 5 },
    { type: "number", value: 5 },
    { type: "number", value: 5 },
    { type: "number", value: 3 },
    { type: "number", value: 7 }
  ];

  discardMathSet(game, 0, [0, 1, 2]);

  console.log("No sleeping cats left — no wake choice granted:", game.pendingWakeChoice === null);
  console.log("lastMessage falls back to the plain 'discarded' kind:", game.lastMessage.kind === "discarded");
}

testTripletDiscardWithNoSleepingCatsJustFinishesTurn();
