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

function createCats() {
  const cats = [];
  for (let i = 0; i < 12; i++) {
    cats.push({ type: "cat", id: i, awake: false });
  }
  return cats;
}

function playDog(game, playerId, cardIndex) {
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

  if (game.pendingAction) {
    console.log("Another action is still awaiting a response!");
    return game;
  }

  if (card.type !== "dog") {
    console.log("That's not a Dog!");
    return game; // no change
  }

  // Remove the Dog from the player's hand, put it in the discard pile
  player.hand.splice(cardIndex, 1);
  game.discardPile.push(card);

  drawCard(game, player);

  // Wake the first sleeping Cat and give it to the player
  const cat = game.sleepingCats.shift();
  cat.awake = true;
  player.cats.push(cat);

  // Check for a winner
  const winnerId = checkWinner(game);
  if (winnerId !== null) {
    game.winner = winnerId;
    console.log(`Player ${winnerId} wins!`);
    return game; // stop here — don't advance turn, game is over
  }

  // Advance to the next player
   advanceTurn(game);

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

  if (game.pendingAction) {
    console.log("Another action is still awaiting a response!");
    return game;
  }

  const player = game.players[playerId];
  const card = player.hand[cardIndex];

  if (card.type !== "fish") {
    console.log("That's not a Fish!");
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
  finishPendingAction(game);

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

  if (game.pendingAction) {
    console.log("Another action is still awaiting a response!");
    return game;
  }

  const player = game.players[playerId];
  const card = player.hand[cardIndex];

  if (card.type !== "catnip") {
    console.log("That's not Catnip!");
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
  finishPendingAction(game);

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

  finishPendingAction(game);

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

function resolveFishSteal(game, attackerId, targetId) {
  const attacker = game.players[attackerId];
  const targetPlayer = game.players[targetId];
  const stolenCat = targetPlayer.cats.shift();
  attacker.cats.push(stolenCat);
}

function resolveCatnip(game, targetId, targetCatIndex) {
  const targetPlayer = game.players[targetId];
  const [cat] = targetPlayer.cats.splice(targetCatIndex, 1);
  cat.awake = false;
  game.sleepingCats.push(cat);
}

// Shared end-of-action bookkeeping: clear the pending action, check for a
// winner, and advance the turn if the game isn't over.
function finishPendingAction(game) {
  game.pendingAction = null;

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

  if (game.pendingAction) {
    console.log("Another action is still awaiting a response!");
    return game;
  }

  const player = game.players[playerId];
  const card = player.hand[cardIndex];

  if (card.type !== "laser") {
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
    const targetPlayer = game.players[targetIndex];

    if (game.sleepingCats.length > 0) {
      const randomIndex = Math.floor(Math.random() * game.sleepingCats.length);
      const [cat] = game.sleepingCats.splice(randomIndex, 1);
      cat.awake = true;
      targetPlayer.cats.push(cat);
    }

    drawCard(game, player);
  } else {
    // Kings/Knights/Seagulls/Catnip/Snails go straight into the player's hand
    // as their replacement draw.
    player.hand.push(revealedCard);
  }

  finishPendingAction(game);

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
    sleepingCats: createCats(),
    currentPlayerIndex: 0,
    pendingAction: null
  };
}

function checkWinner(game) {
  for (const player of game.players) {
    if (player.cats.length >= 5) {
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

  if (game.pendingAction) {
    console.log("Another action is still awaiting a response!");
    return game;
  }

  const player = game.players[playerId];
  const card = player.hand[cardIndex];

  player.hand.splice(cardIndex, 1);
  game.discardPile.push(card);

  drawCard(game, player);
  advanceTurn(game);

  return game;
}











// tests
function testWinCondition() {
  const game = createGame(2);

  let attempts = 0;
  while (game.winner === undefined && attempts < 60) {
    const currentPlayer = game.players[game.currentPlayerIndex];
    const dogIndex = currentPlayer.hand.findIndex(c => c.type === "dog");

    if (dogIndex === -1) {
      // No Dog available — discard the first card instead
      discardCard(game, game.currentPlayerIndex, 0);
    } else {
      playDog(game, game.currentPlayerIndex, dogIndex);
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
  const cat = game.sleepingCats.shift();
  cat.awake = true;
  game.players[1].cats.push(cat);

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

  const cat = game.sleepingCats.shift();
  cat.awake = true;
  game.players[1].cats.push(cat);

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

  const cat = game.sleepingCats.shift();
  cat.awake = true;
  game.players[1].cats.push(cat);

  playCatnip(game, 0, 0, 1, 0); // player 0 puts player 1's cat (index 0) back to sleep

  console.log("After Catnip — player 1 cats (should be 0):", game.players[1].cats.length);
  console.log("After Catnip — sleeping cats gained one back:", game.sleepingCats.some(c => c.id === cat.id));
  console.log("Current player (should be 1):", game.currentPlayerIndex);
}

testCatnip();

function testCatnipBlockedBySnail() {
  const game = createGame(2);

  game.players[0].hand[0] = { type: "catnip" };
  game.players[1].hand[0] = { type: "snail" };

  const cat = game.sleepingCats.shift();
  cat.awake = true;
  game.players[1].cats.push(cat);

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

  console.log("After Laser Pointer — player 1 gained a cat:", game.players[1].cats.length === catsBefore + 1);
  console.log("Current player (should be 1):", game.currentPlayerIndex);
}

testLaserPointer();

function testAiAutoBlocks() {
  const game = createGame(2);

  game.players[0].hand[0] = { type: "fish" };
  game.players[1].hand[0] = { type: "seagull" };

  const cat = game.sleepingCats.shift();
  cat.awake = true;
  game.players[1].cats.push(cat);

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