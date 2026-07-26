export function createDeck() {
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

export function shuffleDeck(deck) {
  // Work on a copy so we don't accidentally mess with the original
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // Swap shuffled[i] and shuffled[j]
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export function dealHands(deck, numPlayers, handSize = 5) {
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
export function createCats() {
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
export function createSleepingCats() {
  return shuffleDeck(createCats()).map((cat, slot) => ({ ...cat, slot, awake: false }));
}

export function getPlayerPoints(player) {
  return player.cats.reduce((sum, cat) => sum + cat.points, 0);
}

export function getAvailableSlots(game) {
  return game.sleepingCats
    .map((cat, slot) => (cat !== null ? slot : null))
    .filter(slot => slot !== null);
}

export function wakeCatAtSlot(game, slotIndex) {
  const cat = game.sleepingCats[slotIndex];
  cat.awake = true;
  game.sleepingCats[slotIndex] = null;
  return cat;
}

// Restores a cat to its own home slot — always the same spot it started in.
export function putCatBackToSleep(game, cat) {
  cat.awake = false;
  game.sleepingCats[cat.slot] = cat;
}

// Adds a cat to a player's collection, unless it conflicts with a cat they
// already hold (same pairKey — e.g. the two Ginger Toms), in which case the
// new cat goes back to sleep in its own slot instead. Returns true if the cat
// joined the player's collection.
export function giveCatToPlayer(game, player, cat) {
  const conflicts = cat.pairKey && player.cats.some(c => c.pairKey === cat.pairKey);

  if (conflicts) {
    putCatBackToSleep(game, cat);
    console.log(`${cat.name} conflicts with a cat Player ${player.id} already has — back to sleep it goes!`);
    return false;
  }

  player.cats.push(cat);
  return true;
}

// Shared precondition for any turn-taking action: the game must not be over,
// it must be this player's turn, and no reaction (block/wake choice) can be
// outstanding. Logs why and returns false if any check fails.
export function validateTurn(game, playerId) {
  if (game.winner !== undefined) {
    console.log("Game is already over!");
    return false;
  }

  if (playerId !== game.currentPlayerIndex) {
    console.log("It's not your turn!");
    return false;
  }

  if (game.pendingAction || game.pendingWakeChoice) {
    console.log("Another action is still awaiting a response!");
    return false;
  }

  return true;
}

export function playDog(game, playerId, cardIndex, slotIndex) {
  if (!validateTurn(game, playerId)) {
    return game;
  }

  const player = game.players[playerId];
  const card = player.hand[cardIndex];

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


export function playFish(game, playerId, cardIndex, targetPlayerId, targetCatIndex) {
  if (!validateTurn(game, playerId)) {
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

  if (!targetPlayer || !targetPlayer.cats[targetCatIndex]) {
    console.log("Target player has no such cat to steal!");
    return game;
  }

  player.hand.splice(cardIndex, 1);
  game.discardPile.push(card);
  drawCard(game, player);

  const targetHasSeagull = targetPlayer.hand.some(c => c.type === "seagull");
  if (targetHasSeagull) {
    game.pendingAction = {
      type: "fish",
      attackerId: playerId,
      targetId: targetPlayerId,
      catIndex: targetCatIndex
    };
    console.log(`Player ${targetPlayerId} may block with a Seagull!`);
    return game; // wait for respondToPendingAction — turn does not advance yet
  }

  resolveFishSteal(game, playerId, targetPlayerId, targetCatIndex);
  finishTurn(game);

  return game;
}

export function playCatnip(game, playerId, cardIndex, targetPlayerId, targetCatIndex) {
  if (!validateTurn(game, playerId)) {
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
export function respondToPendingAction(game, targetPlayerId, blockCardIndex) {
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
    resolveFishSteal(game, action.attackerId, action.targetId, action.catIndex);
  } else {
    resolveCatnip(game, action.targetId, action.catIndex);
  }

  finishTurn(game);

  return game;
}

// Returns the hand index of the counter card (Seagull/Snail) the target could
// block the current pendingAction with, or null if they don't have one.
export function getBlockCardIndex(game, targetPlayerId) {
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
export function respondAsAi(game, targetPlayerId) {
  const blockCardIndex = getBlockCardIndex(game, targetPlayerId);
  return respondToPendingAction(game, targetPlayerId, blockCardIndex);
}

// Called by whichever player currently owes a wake pick — either the Jester's
// (Laser Pointer's) counted-to target, or a player who just woke the Sphynx
// and gets a bonus wake. slotIndex is the sleeping cat slot they choose.
export function respondToWakeChoice(game, playerId, slotIndex) {
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
export function respondToWakeChoiceAsAi(game, playerId) {
  const availableSlots = getAvailableSlots(game);

  if (availableSlots.length === 0) {
    game.pendingWakeChoice = null;
    finishTurn(game);
    return game;
  }

  const randomSlot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
  return respondToWakeChoice(game, playerId, randomSlot);
}

export function resolveFishSteal(game, attackerId, targetId, targetCatIndex) {
  const attacker = game.players[attackerId];
  const targetPlayer = game.players[targetId];
  const [stolenCat] = targetPlayer.cats.splice(targetCatIndex, 1);
  giveCatToPlayer(game, attacker, stolenCat);
}

export function resolveCatnip(game, targetId, targetCatIndex) {
  const targetPlayer = game.players[targetId];
  const [cat] = targetPlayer.cats.splice(targetCatIndex, 1);
  putCatBackToSleep(game, cat);
}

const CARD_TYPE_LABELS = {
  dog: "Dog",
  fish: "Fish",
  seagull: "Seagull",
  catnip: "Catnip",
  snail: "Snail",
  laser: "Laser Pointer"
};

// Shared end-of-turn bookkeeping: clear any pending state, check for a
// winner, and advance the turn if the game isn't over. `lastMessage` is a
// short player-facing description of what just happened to a specific
// player's hand (e.g. for actions with no other visible effect), tagged with
// whose it is ({ playerId, text }) so the UI can show it only to them rather
// than to whoever's turn it is by the time it renders — it's cleared by
// default so stale messages don't linger past the next action.
export function finishTurn(game, lastMessage = null) {
  game.pendingAction = null;
  game.pendingWakeChoice = null;
  game.lastMessage = lastMessage;

  const winnerId = checkWinner(game);
  if (winnerId !== null) {
    game.winner = winnerId;
    console.log(`Player ${winnerId} wins!`);
    return;
  }

  advanceTurn(game);
}

export function playLaserPointer(game, playerId, cardIndex) {
  if (!validateTurn(game, playerId)) {
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
    finishTurn(game, { playerId, text: "No cards left to reveal." });
    return game;
  } else if (revealedCard.type === "number") {
    game.discardPile.push(revealedCard);

    const numPlayers = game.players.length;
    const targetIndex = (playerId + revealedCard.value - 1) % numPlayers;

    drawCard(game, player);

    if (getAvailableSlots(game).length > 0) {
      game.pendingWakeChoice = { playerId: targetIndex, bonus: false };
      game.lastMessage = null;
      console.log(`Player ${targetIndex} may wake a sleeping cat!`);
      return game; // wait for respondToWakeChoice — turn does not advance yet
    }

    finishTurn(game, { playerId, text: "Revealed a number card, but no sleeping cats are left to wake." });
    return game;
  }

  // Kings/Knights/Seagulls/Catnip/Snails go straight into the player's hand
  // as their replacement draw.
  player.hand.push(revealedCard);
  finishTurn(game, {
    playerId,
    text: `Laser Pointer revealed a ${CARD_TYPE_LABELS[revealedCard.type]} — added to your hand.`
  });

  return game;
}

export function drawCard(game, player) {
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
export function reshuffleDiscardIntoDeck(game) {
  if (game.discardPile.length === 0) {
    return;
  }

  game.deck = shuffleDeck(game.discardPile);
  game.discardPile = [];
  console.log("Deck was empty — reshuffled the discard pile into a new deck.");
}

export function advanceTurn(game) {
  game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
}


export function createGame(numPlayers) {
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
    pendingWakeChoice: null,
    lastMessage: null
  };
}

// Official Sleeping Queens lowers the win bar for bigger tables: 4 cats /
// 40 points for 4-5 players, vs 5 cats / 50 points for 2-3 players.
export function getWinThresholds(numPlayers) {
  return numPlayers >= 4
    ? { cats: 4, points: 40 }
    : { cats: 5, points: 50 };
}

export function checkWinner(game) {
  const thresholds = getWinThresholds(game.players.length);

  for (const player of game.players) {
    if (player.cats.length >= thresholds.cats || getPlayerPoints(player) >= thresholds.points) {
      return player.id;
    }
  }

  // With 3+ players, all 12 cats can end up distributed without anyone
  // crossing the threshold (e.g. three players with 4 cats/~45 points
  // each). Once there's nothing left to wake or fight over, break the tie
  // by points (then by cat count, then by lowest player id).
  if (game.sleepingCats.every(slot => slot === null)) {
    return getPointsLeader(game).id;
  }

  return null; // no winner yet
}

export function getPointsLeader(game) {
  return game.players.reduce((leader, player) => {
    if (getPlayerPoints(player) > getPlayerPoints(leader)) return player;
    if (getPlayerPoints(player) === getPlayerPoints(leader) && player.cats.length > leader.cats.length) return player;
    return leader;
  });
}

export function discardCard(game, playerId, cardIndex) {
  if (!validateTurn(game, playerId)) {
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
export function isValidMathDiscard(cards) {
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
export function discardMathSet(game, playerId, cardIndices) {
  if (!validateTurn(game, playerId)) {
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
