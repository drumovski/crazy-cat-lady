// game.lastMessage is data ({ kind, ...fields }), not pre-formatted text, so
// it can be rendered using display names instead of a hardcoded "Player N" —
// and, critically, so the pronoun can flip based on who's actually looking.
// In online mode this only ever renders for the one client it's about, so
// "your"/"you" is always correct there. In local hotseat mode there's no
// single "you" — the banner is visible to the whole shared screen regardless
// of whose turn it is now — so isSelf is always false there and every
// message names the affected player instead of assuming it's the viewer.
export function formatLastMessage(message, getName, isSelf, blockTimerSeconds) {
  const who = isSelf ? "You" : getName(message.playerId);
  const subjectPossessive = isSelf ? "your" : `${getName(message.playerId)}'s`;
  const ownPossessive = isSelf ? "your" : "their";

  switch (message.kind) {
    case "fishStolen":
      return `${getName(message.attackerId)} stole ${subjectPossessive} ${message.catName} with a Fish!`;
    case "catnipped":
      return `${getName(message.attackerId)} put ${subjectPossessive} ${message.catName} back to sleep with Catnip!`;
    case "blocked": {
      const counterLabel = message.counterType.charAt(0).toUpperCase() + message.counterType.slice(1);
      const cardLabel = message.cardType === "fish" ? "Fish" : "Catnip";
      return `${getName(message.blockerId)} blocked ${subjectPossessive} ${cardLabel} with a ${counterLabel}!`;
    }
    case "fishStolenConfirm":
      return `${who} stole ${getName(message.targetId)}'s ${message.catName} with ${ownPossessive} Fish!`;
    case "fishStolenConflict":
      return `${who} tried to steal ${getName(message.targetId)}'s ${message.catName} with a Fish, but already had a matching cat — it went back to sleep instead.`;
    case "catnippedConfirm":
      return `${who} put ${getName(message.targetId)}'s ${message.catName} back to sleep with ${ownPossessive} Catnip!`;
    case "laserChaosPicked":
      return `${who} played Laser Pointer — ${getName(message.ownerId)}'s ${message.catName} got caught in the chaos!`;
    case "laserChaosNoCats":
      return isSelf
        ? "You played Laser Pointer, but no cats were awake for the chaos to catch."
        : `${who} played Laser Pointer, but no cats were awake for the chaos to catch.`;
    case "laserChaosMoved":
      return `The chaos sends ${getName(message.ownerId)}'s ${message.catName} to ${getName(message.destinationPlayerId)}!`;
    case "laserChaosConflict":
      return `The chaos tried to send ${getName(message.ownerId)}'s ${message.catName} to ${getName(message.destinationPlayerId)}, but they already have a matching cat — it went back to sleep instead.`;
    case "wokeCat":
      return `${who} woke a ${message.catName} Cat!`;
    case "wokeBonusCat":
      return `${who} woke the ${message.catName} Cat so ${isSelf ? "you" : "they"} can wake another Cat!`;
    case "wokeGuardedCat":
      return message.bonus
        ? `${who} woke a guarded ${message.catName} Cat — it can't be stolen or put to sleep — and gets to wake another Cat!`
        : `${who} woke a guarded ${message.catName} Cat — it can't be stolen or put to sleep!`;
    case "hotDogWoke":
      return message.bonus
        ? `${who} played Hot Dog, waking a ${message.catName} Cat — and gets to wake another Cat!`
        : `${who} played Hot Dog, waking a ${message.catName} Cat!`;
    case "wokeCatConflict":
      return `${who} tried to wake ${message.catName}, but already had a matching cat — it went back to sleep.`;
    case "discarded":
      return `${who} discarded ${message.count} card${message.count === 1 ? "" : "s"}.`;
    case "discardedTriplet":
      return `${who} discarded a matching triplet and may wake a sleeping cat!`;
    case "pendingActionAnnounce": {
      const cardLabel = message.cardType === "fish" ? "Fish" : "Catnip";
      const counterLabel = message.cardType === "fish" ? "Seagull" : "Snail";
      const verb = message.cardType === "fish" ? "steal" : "put to sleep";
      const hasVerb = isSelf ? "have" : "has";
      const timerPhrase =
        blockTimerSeconds === null
          ? `${who} can block with a ${counterLabel} at any time!`
          : `${who} ${hasVerb} ${blockTimerSeconds} seconds to block with a ${counterLabel}!`;
      return `${getName(message.attackerId)} played ${cardLabel} to ${verb} ${subjectPossessive} ${message.catName}! ${timerPhrase}`;
    }
    default:
      return "";
  }
}
