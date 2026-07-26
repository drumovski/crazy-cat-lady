function createDeck() {
  const deck = [];

  // Add number cards 1-10, four of each
  for (let value = 1; value <= 10; value++) {
    for (let copy = 0; copy < 4; copy++) {
      deck.push({ type: "number", value: value });
    }
  }

  // Add 8 Dog cards (wakes a cat)
  for (let i = 0; i < 8; i++) {
    deck.push({ type: "dog" });
  }

    // Add 4 Fish cards (steals a cat)
  for (let i = 0; i < 4; i++) {
    deck.push({ type: "fish" });
  }

  // Add 4 Seagull cards (blocks a Fish steal)
  for (let i = 0; i < 4; i++) {
    deck.push({ type: "seagull" });
  }

  // Add 4 Catnip cards (puts an awake cat back to sleep)
  for (let i = 0; i < 4; i++) {
    deck.push({ type: "catnip" });
  }

  // Add 3 Snail cards (blocks Catnip)
  for (let i = 0; i < 3; i++) {
    deck.push({ type: "snail" });
  }

  // Add 5 Laser Pointer cards
  for (let i = 0; i < 5; i++) {
    deck.push({ type: "laser" });
  }

  return deck;
}

function shuffleDeck(deck) {
  // Work on a copy so we don't accidentally mess with the original
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // Swap shuffled[i] and shuffled[j]
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

function dealHands(deck, numPlayers, handSize = 5) {
  const hands = [];
  let remainingDeck = [...deck]; // copy, so we don't mutate the original

  for (let p = 0; p < numPlayers; p++) {
    const hand = remainingDeck.splice(0, handSize);
    hands.push(hand);
  }

  return { hands, remainingDeck };
}

// pairKey: cats sharing a pairKey can't both be in the same player's
// collection at once (see giveCatToPlayer) — the two Ginger Toms.
// wakesBonus: waking this cat lets the same player immediately pick one more
// sleeping cat slot to wake (the Sphynx).
function createCats() {
  const roster = [
    { name: "Ginger Tom", points: 15, pairKey: "gingerTom" },
    { name: "Ginger Tom", points: 15, pairKey: "gingerTom" },
    { name: "Maine Coon", points: 20 },
    { name: "Calico", points: 15 },
    { name: "Persian", points: 15 },
    { name: "Toyger", points: 10 },
    { name: "Ragdoll", points: 10 },
    { name: "Bombay", points: 10 },
    { name: "Russian Blue", points: 10 },
    { name: "Sphynx", points: 5, wakesBonus: true },
    { name: "Siamese", points: 5 },
    { name: "Bengal", points: 5 }
  ];

  return roster.map((cat, id) => ({ type: "cat", id, ...cat }));
}

// The 12 cats are dealt face-down into fixed slots, like the physical game's
// grid — sleepingCats[slot] holds the cat asleep there, or null once it's
// been woken. Slots never move, and a cat always returns to its own slot
// (see putCatBackToSleep), so a player can remember and re-target a spot.
function createSleepingCats() {
  return shuffleDeck(createCats()).map((cat, slot) => ({ ...cat, slot, awake: false }));
}

function getPlayerPoints(player) {
  return player.cats.reduce((sum, cat) => sum + cat.points, 0);
}

function getAvailableSlots(game) {
  return game.sleepingCats
    .map((cat, slot) => (cat !== null ? slot : null))
    .filter(slot => slot !== null);
}

function wakeCatAtSlot(game, slotIndex) {
  const cat = game.sleepingCats[slotIndex];
  cat.awake = true;
  game.sleepingCats[slotIndex] = null;
  return cat;
}

// Restores a cat to its own home slot — always the same spot it started in.
function putCatBackToSleep(game, cat) {
  cat.awake = false;
  game.sleepingCats[cat.slot] = cat;
}

// Adds a cat to a player's collection, unless it conflicts with a cat they
// already hold (same pairKey — e.g. the two Ginger Toms), in which case the
// new cat goes back to sleep in its own slot instead. Returns true if the cat
// joined the player's collection.
function giveCatToPlayer(game, player, cat) {
  const conflicts = cat.pairKey && player.cats.some(c => c.pairKey === cat.pairKey);

  if (conflicts) {
    putCatBackToSleep(game, cat);
    console.log(`${cat.name} conflicts with a cat Player ${player.id} already has — back to sleep it goes!`);
    return false;
  }

  player.cats.push(cat);
  return true;
}

function playDog(game, playerId, cardIndex, slotIndex) {
  const player = game.players[playerId];
  const card = player.hand[cardIndex];

  // Check for a winner
    if (game.winner !== undefined) {
    console.log("Game is already over!");
    return game;
  }

    // Check it's actually this player's turn
  if (playerId !== game.currentPlayerIndex) {
    console.log("It's not your turn!");
    return game;
  }

  if (game.pendingAction || game.pendingWakeChoice) {
    console.log("Another action is still awaiting a response!");
    return game;
  }

  if (!card || card.type !== "dog") {
    console.log("That's not a Dog!");
    return game; // no change
  }

  if (game.sleepingCats[slotIndex] == null) {
    console.log("That sleeping cat slot is empty or invalid!");
    return game;
  }

  // Remove the Dog from the player's hand, put it in the discard pile
  player.hand.splice(cardIndex, 1);
  game.discardPile.push(card);

  drawCard(game, player);

  // Wake the chosen sleeping Cat and give it to the player
  const cat = wakeCatAtSlot(game, slotIndex);
  const joined = giveCatToPlayer(game, player, cat);

  if (joined && cat.wakesBonus && getAvailableSlots(game).length > 0) {
    game.pendingWakeChoice = { playerId, bonus: true };
    console.log(`${cat.name} lets Player ${playerId} wake one more sleeping cat!`);
    return game; // wait for respondToWakeChoice — turn does not advance yet
  }

  finishTurn(game);

  return game;
}


function playFish(game, playerId, cardIndex, targetPlayerId) {
  if (game.winner !== undefined) {
    console.log("Game is already over!");
    return game;
  }

  if (playerId !== game.currentPlayerIndex) {
    console.log("It's not your turn!");
    return game;
  }

  if (game.pendingAction || game.pendingWakeChoice) {
    console.log("Another action is still awaiting a response!");
    return game;
  }

  const player = game.players[playerId];
  const card = player.hand[cardIndex];

  if (!card || card.type !== "fish") {
    console.log("That's not a Fish!");
    return game;
  }

  if (targetPlayerId === playerId) {
    console.log("You can't target yourself!");
    return game;
  }

  const targetPlayer = game.players[targetPlayerId];

  if (!targetPlayer || targetPlayer.cats.length === 0) {
    console.log("Target player has no cats to steal!");
    return game;
  }

  player.hand.splice(cardIndex, 1);
  game.discardPile.push(card);
  drawCard(game, player);

  const targetHasSeagull = targetPlayer.hand.some(c => c.type === "seagull");
  if (targetHasSeagull) {
    game.pendingAction = { type: "fish", attackerId: playerId, targetId: targetPlayerId };
    console.log(`Player ${targetPlayerId} may block with a Seagull!`);
    return game; // wait for respondToPendingAction — turn does not advance yet
  }

  resolveFishSteal(game, playerId, targetPlayerId);
  finishTurn(game);

  return game;
}

function playCatnip(game, playerId, cardIndex, targetPlayerId, targetCatIndex) {
  if (game.winner !== undefined) {
    console.log("Game is already over!");
    return game;
  }

  if (playerId !== game.currentPlayerIndex) {
    console.log("It's not your turn!");
    return game;
  }

  if (game.pendingAction || game.pendingWakeChoice) {
    console.log("Another action is still awaiting a response!");
    return game;
  }

  const player = game.players[playerId];
  const card = player.hand[cardIndex];

  if (!card || card.type !== "catnip") {
    console.log("That's not Catnip!");
    return game;
  }

  if (targetPlayerId === playerId) {
    console.log("You can't target yourself!");
    return game;
  }

  const targetPlayer = game.players[targetPlayerId];

  if (!targetPlayer || !targetPlayer.cats[targetCatIndex]) {
    console.log("Target player has no such cat to put to sleep!");
    return game;
  }

  player.hand.splice(cardIndex, 1);
  game.discardPile.push(card);
  drawCard(game, player);

  const targetHasSnail = targetPlayer.hand.some(c => c.type === "snail");
  if (targetHasSnail) {
    game.pendingAction = {
      type: "catnip",
      attackerId: playerId,
      targetId: targetPlayerId,
      catIndex: targetCatIndex
    };
    console.log(`Player ${targetPlayerId} may block with a Snail!`);
    return game; // wait for respondToPendingAction — turn does not advance yet
  }

  resolveCatnip(game, targetPlayerId, targetCatIndex);
  finishTurn(game);

  return game;
}

// Called by the target player after a Fish or Catnip is played against them.
// Pass a hand index for blockCardIndex to block with the matching Seagull/Snail,
// or null to let the action resolve.
function respondToPendingAction(game, targetPlayerId, blockCardIndex) {
  if (!game.pendingAction) {
    console.log("There's nothing to respond to!");
    return game;
  }

  const action = game.pendingAction;

  if (targetPlayerId !== action.targetId) {
    console.log("This isn't your action to respond to!");
    return game;
  }

  const counterType = action.type === "fish" ? "seagull" : "snail";
  const targetPlayer = game.players[targetPlayerId];

  if (blockCardIndex !== null && blockCardIndex !== undefined) {
    const blockCard = targetPlayer.hand[blockCardIndex];

    if (!blockCard || blockCard.type !== counterType) {
      console.log(`That's not a ${counterType}!`);
      return game;
    }

    targetPlayer.hand.splice(blockCardIndex, 1);
    game.discardPile.push(blockCard);
    drawCard(game, targetPlayer);
    console.log(`Blocked with a ${counterType}!`);
  } else if (action.type === "fish") {
    resolveFishSteal(game, action.attackerId, action.targetId);
  } else {
    resolveCatnip(game, action.targetId, action.catIndex);
  }

  finishTurn(game);

  return game;
}

// Returns the hand index of the counter card (Seagull/Snail) the target could
// block the current pendingAction with, or null if they don't have one.
function getBlockCardIndex(game, targetPlayerId) {
  if (!game.pendingAction || game.pendingAction.targetId !== targetPlayerId) {
    return null;
  }

  const counterType = game.pendingAction.type === "fish" ? "seagull" : "snail";
  const targetPlayer = game.players[targetPlayerId];
  const index = targetPlayer.hand.findIndex(c => c.type === counterType);

  return index === -1 ? null : index;
}

// AI policy: always block if a counter card is available.
// (Human players go through respondToPendingAction directly — the UI/server
// layer is responsible for enforcing a response time limit and defaulting to
// blockCardIndex = null, i.e. no block, once it expires.)
function respondAsAi(game, targetPlayerId) {
  const blockCardIndex = getBlockCardIndex(game, targetPlayerId);
  return respondToPendingAction(game, targetPlayerId, blockCardIndex);
}

// Called by whichever player currently owes a wake pick — either the Jester's
// (Laser Pointer's) counted-to target, or a player who just woke the Sphynx
// and gets a bonus wake. slotIndex is the sleeping cat slot they choose.
function respondToWakeChoice(game, playerId, slotIndex) {
  if (!game.pendingWakeChoice) {
    console.log("There's nothing to respond to!");
    return game;
  }

  if (playerId !== game.pendingWakeChoice.playerId) {
    console.log("This isn't your wake choice to make!");
    return game;
  }

  if (game.sleepingCats[slotIndex] == null) {
    console.log("That sleeping cat slot is empty or invalid!");
    return game;
  }

  const player = game.players[playerId];
  const cat = wakeCatAtSlot(game, slotIndex);
  const joined = giveCatToPlayer(game, player, cat);

  if (joined && cat.wakesBonus && getAvailableSlots(game).length > 0) {
    game.pendingWakeChoice = { playerId, bonus: true };
    console.log(`${cat.name} lets Player ${playerId} wake one more sleeping cat!`);
    return game; // still pending — pick again
  }

  game.pendingWakeChoice = null;
  finishTurn(game);

  return game;
}

// AI policy: pick a random available sleeping cat slot.
function respondToWakeChoiceAsAi(game, playerId) {
  const availableSlots = getAvailableSlots(game);

  if (availableSlots.length === 0) {
    game.pendingWakeChoice = null;
    finishTurn(game);
    return game;
  }

  const randomSlot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
  return respondToWakeChoice(game, playerId, randomSlot);
}

function resolveFishSteal(game, attackerId, targetId) {
  const attacker = game.players[attackerId];
  const targetPlayer = game.players[targetId];
  const stolenCat = targetPlayer.cats.shift();
  giveCatToPlayer(game, attacker, stolenCat);
}

function resolveCatnip(game, targetId, targetCatIndex) {
  const targetPlayer = game.players[targetId];
  const [cat] = targetPlayer.cats.splice(targetCatIndex, 1);
  putCatBackToSleep(game, cat);
}

// Shared end-of-turn bookkeeping: clear any pending state, check for a
// winner, and advance the turn if the game isn't over.
function finishTurn(game) {
  game.pendingAction = null;
  game.pendingWakeChoice = null;

  const winnerId = checkWinner(game);
  if (winnerId !== null) {
    game.winner = winnerId;
    console.log(`Player ${winnerId} wins!`);
    return;
  }

  advanceTurn(game);
}

function playLaserPointer(game, playerId, cardIndex) {
  if (game.winner !== undefined) {
    console.log("Game is already over!");
    return game;
  }

  if (playerId !== game.currentPlayerIndex) {
    console.log("It's not your turn!");
    return game;
  }

  if (game.pendingAction || game.pendingWakeChoice) {
    console.log("Another action is still awaiting a response!");
    return game;
  }

  const player = game.players[playerId];
  const card = player.hand[cardIndex];

  if (!card || card.type !== "laser") {
    console.log("That's not a Laser Pointer!");
    return game;
  }

  player.hand.splice(cardIndex, 1);
  game.discardPile.push(card);

  if (game.deck.length === 0) {
    reshuffleDiscardIntoDeck(game);
  }

  const revealedCard = game.deck.shift();

  if (revealedCard === undefined) {
    // Nothing left to reveal — just draw back up if possible.
    drawCard(game, player);
  } else if (revealedCard.type === "number") {
    game.discardPile.push(revealedCard);

    const numPlayers = game.players.length;
    const targetIndex = (playerId + revealedCard.value - 1) % numPlayers;

    drawCard(game, player);

    if (getAvailableSlots(game).length > 0) {
      game.pendingWakeChoice = { playerId: targetIndex, bonus: false };
      console.log(`Player ${targetIndex} may wake a sleeping cat!`);
      return game; // wait for respondToWakeChoice — turn does not advance yet
    }
  } else {
    // Kings/Knights/Seagulls/Catnip/Snails go straight into the player's hand
    // as their replacement draw.
    player.hand.push(revealedCard);
  }

  finishTurn(game);

  return game;
}

function drawCard(game, player) {
  if (game.deck.length === 0) {
    reshuffleDiscardIntoDeck(game);
  }

  if (game.deck.length > 0) {
    const newCard = game.deck.shift();
    player.hand.push(newCard);
  }
}

// When the draw pile runs dry, shuffle the discard pile into a fresh deck
// so the game can keep going instead of stalling.
function reshuffleDiscardIntoDeck(game) {
  if (game.discardPile.length === 0) {
    return;
  }

  game.deck = shuffleDeck(game.discardPile);
  game.discardPile = [];
  console.log("Deck was empty — reshuffled the discard pile into a new deck.");
}

function advanceTurn(game) {
  game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
}


function createGame(numPlayers) {
  const deck = shuffleDeck(createDeck());
  const { hands, remainingDeck } = dealHands(deck, numPlayers);

  return {
    players: hands.map((hand, index) => ({
      id: index,
      hand: hand,
      cats: [] // Cats they've woken up — empty at start
    })),
    deck: remainingDeck,
    discardPile: [],
    sleepingCats: createSleepingCats(),
    currentPlayerIndex: 0,
    pendingAction: null,
    pendingWakeChoice: null
  };
}

function checkWinner(game) {
  for (const player of game.players) {
    if (player.cats.length >= 5 || getPlayerPoints(player) >= 50) {
      return player.id;
    }
  }
  return null; // no winner yet
}

function discardCard(game, playerId, cardIndex) {
  if (game.winner !== undefined) {
    console.log("Game is already over!");
    return game;
  }

  if (playerId !== game.currentPlayerIndex) {
    console.log("It's not your turn!");
    return game;
  }

  if (game.pendingAction || game.pendingWakeChoice) {
    console.log("Another action is still awaiting a response!");
    return game;
  }

  const player = game.players[playerId];
  const card = player.hand[cardIndex];

  if (!card) {
    console.log("Invalid card index!");
    return game;
  }

  player.hand.splice(cardIndex, 1);
  game.discardPile.push(card);

  drawCard(game, player);
  finishTurn(game);

  return game;
}

// A math discard is valid if every card is a Number card, and either:
//  - exactly two cards share the same value (a matching pair), or
//  - three or more cards where the largest value equals the sum of the rest
function isValidMathDiscard(cards) {
  if (cards.length < 2 || !cards.every(c => c.type === "number")) {
    return false;
  }

  if (cards.length === 2) {
    return cards[0].value === cards[1].value;
  }

  const sorted = [...cards].sort((a, b) => a.value - b.value);
  const largest = sorted[sorted.length - 1].value;
  const sumOfRest = sorted.slice(0, -1).reduce((sum, c) => sum + c.value, 0);

  return largest === sumOfRest;
}

// Discard a matching pair (e.g. two 5s) or an addition set (e.g. 2 + 5 = 7)
// of Number cards in one go, drawing a replacement for each card discarded.
function discardMathSet(game, playerId, cardIndices) {
  if (game.winner !== undefined) {
    console.log("Game is already over!");
    return game;
  }

  if (playerId !== game.currentPlayerIndex) {
    console.log("It's not your turn!");
    return game;
  }

  if (game.pendingAction || game.pendingWakeChoice) {
    console.log("Another action is still awaiting a response!");
    return game;
  }

  const player = game.players[playerId];
  const uniqueIndices = [...new Set(cardIndices)];

  if (uniqueIndices.length !== cardIndices.length) {
    console.log("Duplicate card indices in math discard!");
    return game;
  }

  const cards = uniqueIndices.map(i => player.hand[i]);

  if (cards.some(c => c === undefined)) {
    console.log("Invalid card index in math discard!");
    return game;
  }

  if (!isValidMathDiscard(cards)) {
    console.log("That's not a valid matching pair or addition set!");
    return game;
  }

  // Remove from the hand highest-index-first so earlier indices stay valid
  const sortedIndices = [...uniqueIndices].sort((a, b) => b - a);
  for (const index of sortedIndices) {
    const [card] = player.hand.splice(index, 1);
    game.discardPile.push(card);
  }

  for (let i = 0; i < cards.length; i++) {
    drawCard(game, player);
  }

  finishTurn(game);

  return game;
}

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
  const game = createGame(2);

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
  const game = createGame(2);

  // Force player 0 to have a Fish card at index 0
  game.players[0].hand[0] = { type: "fish" };

  // Make sure player 1 has no Seagull to block with, for a deterministic test
  game.players[1].hand = game.players[1].hand.filter(c => c.type !== "seagull");

  // Force player 1 to already have a cat to steal
  testGiveAnyCatToPlayer(game, game.players[1]);

  console.log("Before steal — player 0 cats:", game.players[0].cats.length);
  console.log("Before steal — player 1 cats:", game.players[1].cats.length);

  playFish(game, 0, 0, 1); // player 0 plays fish at index 0, targeting player 1

  console.log("After steal — player 0 cats:", game.players[0].cats.length);
  console.log("After steal — player 1 cats:", game.players[1].cats.length);
  console.log("Current player (should be 1):", game.currentPlayerIndex);
}

testFish();

function testFishBlockedBySeagull() {
  const game = createGame(2);

  game.players[0].hand[0] = { type: "fish" };
  game.players[1].hand[0] = { type: "seagull" };

  testGiveAnyCatToPlayer(game, game.players[1]);

  playFish(game, 0, 0, 1);
  console.log("Pending action after Fish (should be 'fish'):", game.pendingAction && game.pendingAction.type);

  respondToPendingAction(game, 1, 0); // player 1 blocks with the Seagull at index 0

  console.log("After block — player 0 cats (should be 0):", game.players[0].cats.length);
  console.log("After block — player 1 cats (should be 1):", game.players[1].cats.length);
  console.log("Pending action cleared:", game.pendingAction);
  console.log("Current player (should be 1):", game.currentPlayerIndex);
}

testFishBlockedBySeagull();

function testCatnip() {
  const game = createGame(2);

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
  const game = createGame(2);

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
  const game = createGame(2);

  game.players[0].hand[0] = { type: "laser" };
  game.deck.unshift({ type: "number", value: 2 }); // land on player 0 + 2 - 1 = player 1

  const catsBefore = game.players[1].cats.length;
  playLaserPointer(game, 0, 0);

  console.log("Pending wake choice for player 1:", game.pendingWakeChoice && game.pendingWakeChoice.playerId);

  const chosenSlot = game.sleepingCats.findIndex(c => c !== null);
  respondToWakeChoice(game, 1, chosenSlot);

  console.log("After Laser Pointer — player 1 gained a cat:", game.players[1].cats.length === catsBefore + 1);
  console.log("Current player (should be 1):", game.currentPlayerIndex);
}

testLaserPointer();

function testAiAutoBlocks() {
  const game = createGame(2);

  game.players[0].hand[0] = { type: "fish" };
  game.players[1].hand[0] = { type: "seagull" };

  testGiveAnyCatToPlayer(game, game.players[1]);

  playFish(game, 0, 0, 1);
  respondAsAi(game, 1); // player 1 is AI-controlled — should auto-block since it holds a Seagull

  console.log("AI auto-blocked — player 0 cats (should be 0):", game.players[0].cats.length);
  console.log("AI auto-blocked — player 1 cats (should be 1):", game.players[1].cats.length);
}

testAiAutoBlocks();

function testDeckReshuffle() {
  const game = createGame(2);

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
  const game = createGame(2);

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
  const game = createGame(2);

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
  const game = createGame(2);

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
  const game = createGame(2);
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
  const game = createGame(2);

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
  const game = createGame(2);
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
  const game = createGame(2);

  game.players[0].hand[0] = { type: "fish" };
  testGiveAnyCatToPlayer(game, game.players[0]);

  const catsBefore = game.players[0].cats.length;
  const currentPlayerBefore = game.currentPlayerIndex;

  playFish(game, 0, 0, 0); // player 0 targeting themselves

  console.log("Fish self-target rejected — cats unchanged:", game.players[0].cats.length === catsBefore);
  console.log("Fish self-target rejected — turn did not advance:", game.currentPlayerIndex === currentPlayerBefore);
}

testFishRejectsSelfTarget();

function testCatnipRejectsSelfTarget() {
  const game = createGame(2);

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
  const game = createGame(2);
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
