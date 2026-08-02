import {
  getAvailableSlots,
  getPlayerPoints,
  playDog,
  playFish,
  playCatnip,
  playLaserPointer,
  discardCard,
  discardMathSet
} from "./engine.js";

export const AI_NAMES = [
  "HAL 9000",
  "R2-D2",
  "C-3PO",
  "WALL-E",
  "Skynet",
  "Agent Smith",
  "Ultron",
  "Baymax",
  "Ava",
  "Bishop",
  "Roy Batty",
  "TARS",
  "CASE",
  "T-800"
];

// Picks a random name for an AI player, avoiding any already in use (e.g. so
// a 3-AI game doesn't end up with two players both named "TARS") — falls
// back to the full list if every name is somehow already taken.
export function pickRandomAiName(usedNames = []) {
  const available = AI_NAMES.filter(name => !usedNames.includes(name));
  const pool = available.length > 0 ? available : AI_NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickRichestOpponent(opponents) {
  return opponents.reduce((richest, player) =>
    getPlayerPoints(player) > getPlayerPoints(richest) ? player : richest
  );
}

// Guarded cats (Guard Dog) can't be targeted by Fish/Catnip at all — skips
// them entirely, so this only ever returns an index the engine will actually
// accept. Caller must only invoke this on a player already known to have at
// least one unguarded cat (see the opponents filter in chooseAiTurn below).
function pickHighestValueCatIndex(player) {
  let bestIndex = -1;
  for (let i = 0; i < player.cats.length; i++) {
    if (player.cats[i].guarded) continue;
    if (bestIndex === -1 || player.cats[i].points > player.cats[bestIndex].points) {
      bestIndex = i;
    }
  }
  return bestIndex;
}

// Finds two Number cards in hand with the same value, for a simple pair
// discard. (The AI doesn't bother looking for addition sets — that's a
// nice-to-have for human strategic play, not something worth modeling here.)
function findMathDiscardPair(hand) {
  for (let i = 0; i < hand.length; i++) {
    if (hand[i].type !== "number") continue;
    for (let j = i + 1; j < hand.length; j++) {
      if (hand[j].type === "number" && hand[j].value === hand[i].value) {
        return [i, j];
      }
    }
  }
  return null;
}

// Decides what an AI-controlled player should do on their turn. Priority:
// wake a cat for free (Dog) > steal the best available cat (Fish) > weaken
// the richest opponent (Catnip) > Laser Pointer > discard (a math pair if
// one's available, otherwise any single non-action card).
export function chooseAiTurn(game, playerId) {
  const player = game.players[playerId];
  // Only opponents with at least one *unguarded* cat are real Fish/Catnip
  // candidates — a Guard Dog-protected cat can't be targeted at all (see
  // playFish/playCatnip in engine.js). Bug, fixed: this used to just check
  // `cats.length > 0` and always target the richest opponent's highest-value
  // cat regardless of guarded status — if that specific cat was guarded, the
  // AI picked the exact same illegal move every time it was asked to decide
  // again, and since a rejected action doesn't advance the turn, it never
  // stopped asking: scheduleNextStep (server/rooms.js) only checks whether
  // the current decision-maker is still AI, not whether its last decision
  // actually changed anything, so this was a genuine infinite loop — visible
  // as the same 1-2 sound effects replaying forever (an unchanging
  // game.sfxEvents re-broadcast on every failed retry, and online broadcasts
  // always re-serialize into a fresh array the client's sfx dedupe can't
  // recognize as unchanged).
  const opponentsWithCats = game.players.filter(p => p.id !== playerId && p.cats.some(c => !c.guarded));

  const dogIndex = player.hand.findIndex(c => c.type === "dog");
  if (dogIndex !== -1 && getAvailableSlots(game).length > 0) {
    const slots = getAvailableSlots(game);
    const slotIndex = slots[Math.floor(Math.random() * slots.length)];
    return { type: "dog", cardIndex: dogIndex, slotIndex };
  }

  const fishIndex = player.hand.findIndex(c => c.type === "fish");
  if (fishIndex !== -1 && opponentsWithCats.length > 0) {
    const target = pickRichestOpponent(opponentsWithCats);
    return {
      type: "fish",
      cardIndex: fishIndex,
      targetPlayerId: target.id,
      targetCatIndex: pickHighestValueCatIndex(target)
    };
  }

  const catnipIndex = player.hand.findIndex(c => c.type === "catnip");
  if (catnipIndex !== -1 && opponentsWithCats.length > 0) {
    const target = pickRichestOpponent(opponentsWithCats);
    return {
      type: "catnip",
      cardIndex: catnipIndex,
      targetPlayerId: target.id,
      targetCatIndex: pickHighestValueCatIndex(target)
    };
  }

  const laserIndex = player.hand.findIndex(c => c.type === "laser");
  if (laserIndex !== -1) {
    return { type: "laser", cardIndex: laserIndex };
  }

  const mathPair = findMathDiscardPair(player.hand);
  if (mathPair) {
    return { type: "discardMathSet", cardIndices: mathPair };
  }

  const discardableIndex = player.hand.findIndex(c =>
    c.type === "number" || c.type === "seagull" || c.type === "snail"
  );
  return { type: "discard", cardIndex: discardableIndex !== -1 ? discardableIndex : 0 };
}

// Computes and applies an AI player's turn action in one step, mutating and
// returning game — same calling convention as the engine's play* functions.
export function takeAiTurn(game, playerId) {
  const decision = chooseAiTurn(game, playerId);

  switch (decision.type) {
    case "dog":
      return playDog(game, playerId, decision.cardIndex, decision.slotIndex);
    case "fish":
      return playFish(game, playerId, decision.cardIndex, decision.targetPlayerId, decision.targetCatIndex);
    case "catnip":
      return playCatnip(game, playerId, decision.cardIndex, decision.targetPlayerId, decision.targetCatIndex);
    case "laser":
      return playLaserPointer(game, playerId, decision.cardIndex);
    case "discardMathSet":
      return discardMathSet(game, playerId, decision.cardIndices);
    default:
      return discardCard(game, playerId, decision.cardIndex);
  }
}
