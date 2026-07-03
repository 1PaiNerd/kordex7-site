import {
  createKordex7Stage,
  KORDEX7_RUNNER,
} from "./levels/kordex7Runner.js?v=3.0.3";

function createRunSeed() {
  const cryptoSeed = globalThis.crypto?.getRandomValues
    ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0]
    : Math.floor(Math.random() * 0xffffffff);
  return cryptoSeed.toString(36).toUpperCase();
}

export class RunnerProgression {
  constructor({
    worldId = KORDEX7_RUNNER.worldId,
    difficulty = KORDEX7_RUNNER.defaultDifficulty,
    seed,
  } = {}) {
    this.worldId = worldId;
    this.difficulty = difficulty;
    this.runSeed = seed || createRunSeed();
    this.stageNumber = 1;
    this.stageCount = KORDEX7_RUNNER.stageCount;
  }

  getStageSeed(stageNumber = this.stageNumber) {
    return `${this.runSeed}-${String(stageNumber).padStart(2, "0")}`;
  }

  createCurrentStage() {
    if (this.worldId !== "kordex7") {
      throw new Error(`Mundo procedural ainda não implementado: ${this.worldId}`);
    }
    return createKordex7Stage({
      stageNumber: this.stageNumber,
      seed: this.getStageSeed(),
      difficulty: this.difficulty,
    });
  }

  hasNextStage() {
    return this.stageNumber < this.stageCount;
  }

  advance() {
    if (!this.hasNextStage()) return false;
    this.stageNumber += 1;
    return true;
  }

  restartRun({ newSeed = true } = {}) {
    this.stageNumber = 1;
    if (newSeed) this.runSeed = createRunSeed();
  }
}
