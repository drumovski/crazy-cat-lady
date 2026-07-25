function createDeck() {
  const deck = [];

  // Add number cards 1-10, four of each
  for (let value = 1; value <= 10; value++) {
    for (let copy = 0; copy < 4; copy++) {
      deck.push({ type: "number", value: value });
    }
  }

  // Add 8 Dog cards
  for (let i = 0; i < 8; i++) {
    deck.push({ type: "dog" });
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
  for (let i = 0; i < 8; i++) {
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

function drawCard(game, player) {
  if (game.deck.length > 0) {
    const newCard = game.deck.shift();
    player.hand.push(newCard);
  }
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
    currentPlayerIndex: 0
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

  const player = game.players[playerId];
  const card = player.hand[cardIndex];

  player.hand.splice(cardIndex, 1);
  game.discardPile.push(card);

  drawCard(game, player);
  advanceTurn(game);

  return game;
}


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


