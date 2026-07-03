const DEFAULT_STAGE_PROFILES = Object.freeze({
  1: {
    platformCount: 9,
    fragmentCount: 7,
    phantomRatio: 0.14,
    sidePlatformCount: 1,
    obstacleCount: 1,
    gapMin: 6.8,
    gapMax: 7.8,
    lateralRange: 3.8,
    heightRange: 0.7,
    attunementDrain: 0.14,
  },
  2: {
    platformCount: 11,
    fragmentCount: 8,
    phantomRatio: 0.2,
    sidePlatformCount: 2,
    obstacleCount: 2,
    gapMin: 7.2,
    gapMax: 8.4,
    lateralRange: 4.8,
    heightRange: 0.9,
    attunementDrain: 0.15,
  },
  3: {
    platformCount: 13,
    fragmentCount: 9,
    phantomRatio: 0.34,
    sidePlatformCount: 2,
    obstacleCount: 3,
    gapMin: 7.4,
    gapMax: 8.7,
    lateralRange: 5.4,
    heightRange: 1,
    attunementDrain: 0.16,
  },
  4: {
    platformCount: 15,
    fragmentCount: 10,
    phantomRatio: 0.38,
    sidePlatformCount: 3,
    obstacleCount: 5,
    gapMin: 7.6,
    gapMax: 9,
    lateralRange: 6,
    heightRange: 1.15,
    attunementDrain: 0.185,
  },
  5: {
    platformCount: 18,
    fragmentCount: 12,
    phantomRatio: 0.43,
    sidePlatformCount: 4,
    obstacleCount: 7,
    gapMin: 7.7,
    gapMax: 9.2,
    lateralRange: 6.6,
    heightRange: 1.25,
    attunementDrain: 0.2,
  },
});

function hashSeed(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = hashSeed(seed) || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function range(random, min, max) {
  return min + (max - min) * random();
}

function pickUniqueIndices(random, count, min, max, blocked = new Set()) {
  const candidates = [];
  for (let index = min; index <= max; index += 1) {
    if (!blocked.has(index)) candidates.push(index);
  }

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [candidates[index], candidates[target]] = [candidates[target], candidates[index]];
  }
  return candidates.slice(0, Math.min(count, candidates.length)).sort((a, b) => a - b);
}

function normalizeDifficulty(difficulty) {
  if (typeof difficulty === "number") {
    return Math.max(0.75, Math.min(1.35, difficulty));
  }
  return {
    relaxed: 0.85,
    standard: 1,
    resonant: 1.18,
  }[difficulty] ?? 1;
}

export function generateProceduralLevel({
  worldId,
  stageNumber,
  seed,
  difficulty = "standard",
  profiles = DEFAULT_STAGE_PROFILES,
}) {
  const profile = profiles[stageNumber];
  if (!profile) throw new Error(`Fase procedural desconhecida: ${stageNumber}`);
  console.log(
    "[GENERATOR] generated stage:",
    stageNumber,
    "fragments:",
    profile.fragmentCount,
  );

  const difficultyScale = normalizeDifficulty(difficulty);
  const normalizedSeed = `${worldId}:${stageNumber}:${seed}:${difficulty}`;
  const random = createRandom(normalizedSeed);
  const mainPlatforms = [];
  const checkpoints = [];
  const spawn = [0, 0.35, 8];
  let x = 0;
  let y = 0;
  let z = 8;

  for (let index = 0; index < profile.platformCount; index += 1) {
    if (index > 0) {
      z -= range(random, profile.gapMin, profile.gapMax) * difficultyScale;
      x = Math.max(
        -profile.lateralRange,
        Math.min(
          profile.lateralRange,
          x + range(random, -profile.lateralRange * 0.72, profile.lateralRange * 0.72),
        ),
      );
      y = Math.max(0, y + range(random, -profile.heightRange * 0.45, profile.heightRange));
    }

    const isStart = index === 0;
    const isFinish = index === profile.platformCount - 1;
    const radius = isStart ? 5.2 : isFinish ? 4.8 : range(random, 3.2, 4.15);
    const platform = {
      id: `main-${index}`,
      position: [Number(x.toFixed(2)), Number(y.toFixed(2)), Number(z.toFixed(2))],
      radius: Number(radius.toFixed(2)),
      bob: !isStart && !isFinish && random() < 0.16 ? 0.16 : 0,
      portal: isFinish,
      routeIndex: index,
    };

    const checkpointInterval = stageNumber >= 4 ? 4 : 3;
    if (isStart || (!isFinish && index % checkpointInterval === 0)) {
      platform.checkpoint = {
        id: isStart ? "origin" : `anchor-${index}`,
        label: isStart ? "Origem da Sintonia" : `Âncora ${Math.ceil(index / checkpointInterval)}`,
      };
      checkpoints.push({
        id: platform.checkpoint.id,
        platformIndex: index,
        position: [...platform.position],
      });
    }
    mainPlatforms.push(platform);
  }

  const phantomTarget = Math.max(
    1,
    Math.round((profile.platformCount - 1) * profile.phantomRatio * difficultyScale),
  );
  const phantomIndices = new Set(
    pickUniqueIndices(random, phantomTarget, 2, profile.platformCount - 2),
  );
  const hiddenFragmentTarget = Math.min(
    phantomIndices.size,
    Math.max(1, Math.floor(profile.fragmentCount / 3)),
  );
  const hiddenFragmentIndices = new Set([...phantomIndices].slice(0, hiddenFragmentTarget));

  const cords = [];
  for (let index = 0; index < mainPlatforms.length - 1; index += 1) {
    cords.push({
      from: index,
      to: index + 1,
      phantom: phantomIndices.has(index),
      hiddenFragment: hiddenFragmentIndices.has(index),
    });
  }

  const sidePlatforms = [];
  const sideSourceIndices = pickUniqueIndices(
    random,
    profile.sidePlatformCount,
    2,
    profile.platformCount - 3,
    phantomIndices,
  );
  for (const sourceIndex of sideSourceIndices) {
    const source = mainPlatforms[sourceIndex];
    const direction = random() < 0.5 ? -1 : 1;
    const side = {
      id: `side-${sourceIndex}`,
      position: [
        Number((source.position[0] + direction * range(random, 5.2, 6.5)).toFixed(2)),
        Number((source.position[1] + range(random, -0.1, 0.6)).toFixed(2)),
        Number((source.position[2] - range(random, 0.2, 1.6)).toFixed(2)),
      ],
      radius: Number(range(random, 2.5, 3.15).toFixed(2)),
      sideRoute: true,
    };
    sidePlatforms.push(side);
  }

  const islands = [...mainPlatforms, ...sidePlatforms];
  sidePlatforms.forEach((side, sideOffset) => {
    const sideIndex = mainPlatforms.length + sideOffset;
    const sourceIndex = Number(side.id.split("-")[1]);
    cords.push({ from: sourceIndex, to: sideIndex, phantom: false });
  });

  const visibleFragmentCount = profile.fragmentCount - hiddenFragmentTarget;
  const fragmentIndices = pickUniqueIndices(
    random,
    visibleFragmentCount,
    1,
    mainPlatforms.length - 1,
  );
  const crystals = fragmentIndices.map((platformIndex, index) => {
    const platform = mainPlatforms[platformIndex];
    const angle = range(random, 0, Math.PI * 2);
    const offset = Math.min(1.25, platform.radius * 0.35);
    return {
      id: `visible-${index}`,
      position: [
        Number((platform.position[0] + Math.cos(angle) * offset).toFixed(2)),
        Number((platform.position[1] + 1.05).toFixed(2)),
        Number((platform.position[2] + Math.sin(angle) * offset).toFixed(2)),
      ],
      hidden: false,
    };
  });

  const phantomPlatforms = [];
  if (stageNumber >= 3) {
    const source = mainPlatforms[Math.floor(mainPlatforms.length * 0.58)];
    phantomPlatforms.push({
      id: "phase-pad-1",
      position: [source.position[0] + 3.8, source.position[1] + 0.1, source.position[2] - 1.5],
      size: [3.4, 0.26, 3.4],
    });
  }

  const obstacleIndices = pickUniqueIndices(
    random,
    profile.obstacleCount,
    2,
    mainPlatforms.length - 2,
    new Set([...phantomIndices]),
  );
  const obstacles = obstacleIndices.map((platformIndex, index) => {
    const platform = mainPlatforms[platformIndex];
    return {
      id: `phase-obstacle-${index}`,
      type: index % 2 === 0 ? "phaseGate" : "energyOrb",
      position: [platform.position[0], platform.position[1] + 0.75, platform.position[2]],
      radius: index % 2 === 0 ? 1.15 : 0.85,
      disabledByAttunement: true,
      rotationSpeed: range(random, 0.6, 1.35),
    };
  });

  const finish = mainPlatforms.at(-1);
  const routeLength = Math.abs(spawn[2] - finish.position[2]);

  return {
    worldId,
    stageNumber,
    seed: String(seed),
    normalizedSeed,
    difficulty,
    difficultyScale,
    spawn,
    mainPlatforms,
    sidePlatforms,
    phantomPlatforms,
    crystals,
    obstacles,
    checkpoints,
    portalFinal: {
      position: [...finish.position],
      special: stageNumber === 5,
    },
    islands,
    cords,
    fragments: crystals,
    totalFragments: profile.fragmentCount,
    initialCheckpointId: "origin",
    routeLength,
    routeStartZ: spawn[2],
    routeEndZ: finish.position[2],
    attunementDrain: profile.attunementDrain * difficultyScale,
    killY: -22,
  };
}

export { DEFAULT_STAGE_PROFILES };
