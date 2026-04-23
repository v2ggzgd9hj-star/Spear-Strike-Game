export function getRunMedal(runTimeSeconds, reachedPhaseIndex, runDanger) {
  if (
    runTimeSeconds >= 52 ||
    (reachedPhaseIndex >= 3 && runTimeSeconds >= 44 && runDanger >= 118)
  ) {
    return "Elite";
  }
  if (reachedPhaseIndex >= 3 && runTimeSeconds >= 34) {
    return "Gold";
  }
  if (reachedPhaseIndex >= 2 && runTimeSeconds >= 22) {
    return "Silver";
  }
  if (reachedPhaseIndex >= 1 && runTimeSeconds >= 12) {
    return "Bronze";
  }
  return "-";
}

export function getMaxPlausibleScore(runTimeSeconds, runDanger) {
  return Math.max(Math.floor(runTimeSeconds * 80 + runDanger * 6 + 400), 400);
}

export function isPlausibleScore(score, runTimeSeconds, runDanger) {
  if (
    !Number.isFinite(score) ||
    !Number.isFinite(runTimeSeconds) ||
    !Number.isFinite(runDanger)
  ) {
    return false;
  }

  return score <= getMaxPlausibleScore(runTimeSeconds, runDanger);
}
