export const DEFAULT_LEVEL_ID = "kordex7-runner";

export const GAME_CONFIG = Object.freeze({
  physics: {
    gravity: 30,
    moveSpeed: 8.2,
    acceleration: 40,
    friction: 14,
    jumpVelocity: 13.2,
    coyoteTime: 0.16,
    jumpBuffer: 0.12,
    maxDelta: 0.05,
    physicsStep: 1 / 120,
    killY: -26,
  },
  attunement: {
    drainPerSecond: 0.16,
    regenPerSecond: 0.35,
    minimumEnergy: 0.25,
    graceTime: 0.7,
  },
  camera: {
    offset: [0, 8.6, 13.8],
    targetHeight: 0.9,
    damping: 4.8,
    fov: 58,
    near: 0.1,
    far: 700,
  },
  render: {
    maxPixelRatio: 2,
    exposure: 1.08,
    fogDensity: 0.008,
    bloomStrength: 0.74,
    bloomRadius: 0.58,
    bloomThreshold: 0.62,
  },
  respawn: {
    delayMs: 420,
    killY: -26,
  },
  player: {
    radius: 0.36,
    height: 1.25,
  },
});

export const COLORS = Object.freeze({
  void: 0x0d0a1f,
  fog: 0x1a1440,
  fogTuned: 0x33124d,
  cord: 0x4de3ff,
  tune: 0xff6ec7,
  crystal: 0xffd166,
  isleTop: 0x35e0c0,
  isleRock: 0x4a3b8f,
  rim: 0x7de8ff,
});

export const LEVEL_REGISTRY = Object.freeze({
  "kordex7-runner": {
    id: "kordex7-runner",
    order: 0,
    title: "Mundo 00 — KORDEX-7: Sintonia Runner",
    status: "playable",
    load: () => import("./levels/kordex7Runner.js?v=3.0.3"),
  },
  kordex7: {
    id: "kordex7",
    order: 0,
    title: "Mundo 00 — KORDEX-7: A Primeira Sintonia",
    status: "playable",
    load: () => import("./levels/kordex7.js?v=3.0.3"),
  },
  drakkareth: {
    id: "drakkareth",
    order: 1,
    title: "Mundo 01 — Drakkareth",
    status: "planned",
    load: () => import("./levels/drakkareth.js?v=3.0.3"),
  },
});

export async function loadLevelDefinition(levelId) {
  const entry = LEVEL_REGISTRY[levelId];
  if (!entry) {
    throw new Error(`Mundo desconhecido: ${levelId}`);
  }

  const module = await entry.load();
  return module.default;
}

export function createInitialState(level) {
  return {
    mode: "start",
    previousMode: "start",
    collected: 0,
    total: level.totalFragments,
    falls: 0,
    time: 0,
    elapsed: 0,
    energy: 1,
    attuned: false,
    attuneBlend: 0,
    grace: 0,
    muted: false,
    portalActive: false,
    checkpointId: level.initialCheckpointId,
    checkpointPosition: [...level.spawn],
    collectedFragmentIds: new Set(),
    tutorialFlags: new Set(),
    respawning: false,
    stageScore: 0,
    distance: 0,
  };
}
