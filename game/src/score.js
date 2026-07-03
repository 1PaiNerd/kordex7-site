const STORAGE_PREFIX = "cordas-infinito-runner";

function safeRead(key, fallback = 0) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // O jogo continua funcional quando armazenamento local está bloqueado.
  }
}

export class ScoreSystem {
  constructor({ worldId, stageCount }) {
    this.worldId = worldId;
    this.stageCount = stageCount;
    this.totalScore = 0;
    this.stageScore = 0;
    this.stageFalls = 0;
  }

  beginStage() {
    this.stageScore = 0;
    this.stageFalls = 0;
  }

  collectFragment() {
    this.stageScore += 100;
    return this.stageScore;
  }

  registerFall() {
    this.stageFalls += 1;
    this.stageScore = Math.max(0, this.stageScore - 25);
    return this.stageScore;
  }

  completeStage({ stageNumber, elapsed }) {
    const timeBonus = Math.max(0, Math.round(1800 - elapsed * 18));
    const completionBonus = 300 + stageNumber * 100;
    this.stageScore += timeBonus + completionBonus;
    this.totalScore += this.stageScore;

    const stageKey = `${STORAGE_PREFIX}:${this.worldId}:stage-${stageNumber}:best-score`;
    const timeKey = `${STORAGE_PREFIX}:${this.worldId}:stage-${stageNumber}:best-time`;
    const previousBest = safeRead(stageKey);
    const previousTime = safeRead(timeKey, Number.POSITIVE_INFINITY);
    const bestScore = Math.max(previousBest, this.stageScore);
    const bestTime = Math.min(previousTime, elapsed);
    safeWrite(stageKey, bestScore);
    safeWrite(timeKey, bestTime);

    const worldKey = `${STORAGE_PREFIX}:${this.worldId}:best-score`;
    safeWrite(worldKey, Math.max(safeRead(worldKey), this.totalScore));

    return {
      stageScore: this.stageScore,
      totalScore: this.totalScore,
      timeBonus,
      completionBonus,
      bestScore,
      bestTime,
      isNewBest: this.stageScore > previousBest,
    };
  }

  getStageBest(stageNumber) {
    return safeRead(
      `${STORAGE_PREFIX}:${this.worldId}:stage-${stageNumber}:best-score`,
    );
  }

  getWorldBest() {
    return safeRead(`${STORAGE_PREFIX}:${this.worldId}:best-score`);
  }

  resetRun() {
    this.totalScore = 0;
    this.beginStage();
  }
}
