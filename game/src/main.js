import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import { COLORS, GAME_CONFIG, createInitialState } from "./config.js?v=3.0.3";
import { AudioController } from "./audio.js?v=3.0.3";
import { InputController } from "./input.js?v=3.0.3";
import { PlayerController } from "./player.js?v=3.0.3";
import { RunnerProgression } from "./progression.js?v=3.0.3";
import { ScoreSystem } from "./score.js?v=3.0.3";
import { GameUI } from "./ui.js?v=3.0.3";
import { GameWorld } from "./world.js?v=3.0.3";

console.log("[BOOT] main.js carregado");
console.log("[BOOT] imports carregados");

const REQUIRED_DOM_IDS = [
  "app",
  "start",
  "hud",
  "playBtn",
  "pause",
  "win",
  "stageTransition",
  "frag",
  "energy",
  "energyFill",
  "energyPercent",
  "tutorial",
  "tutorialText",
  "toast",
  "stageIndicator",
  "distanceValue",
  "scoreValue",
  "bestValue",
  "mobileControls",
  "mobileJump",
  "mobileTune",
];

function assertRequiredDom() {
  const missing = REQUIRED_DOM_IDS.filter((id) => !document.getElementById(id));
  const playBtn = document.getElementById("playBtn");
  console.log("[BOOT] playBtn:", playBtn);
  if (missing.length > 0) {
    throw new Error(
      `Elementos obrigatórios ausentes: ${missing.map((id) => `#${id}`).join(", ")}`,
    );
  }
}

function readRunOptions() {
  const params = new URLSearchParams(window.location.search);
  const difficulty = params.get("difficulty") ?? "standard";
  const seed = params.get("seed") || undefined;
  return {
    difficulty,
    seed,
    debug: params.get("debug") === "1",
  };
}

async function bootstrap() {
  assertRequiredDom();
  const runOptions = readRunOptions();
  const progression = new RunnerProgression(runOptions);
  const score = new ScoreSystem({
    worldId: progression.worldId,
    stageCount: progression.stageCount,
  });

  let level = progression.createCurrentStage();
  let state = createInitialState(level);
  let world;
  let tutorialTimer;
  let transitionTimer;
  const runStats = {
    elapsed: 0,
    falls: 0,
    fragments: 0,
  };

  const ui = new GameUI();
  const audio = new AudioController();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.void);
  scene.fog = new THREE.FogExp2(COLORS.void, GAME_CONFIG.render.fogDensity);

  const camera = new THREE.PerspectiveCamera(
    GAME_CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    GAME_CONFIG.camera.near,
    GAME_CONFIG.camera.far,
  );

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, GAME_CONFIG.render.maxPixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = GAME_CONFIG.render.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.prepend(renderer.domElement);

  const hemisphere = new THREE.HemisphereLight(0xbdeaff, 0x261441, 1.9);
  scene.add(hemisphere);
  const keyLight = new THREE.DirectionalLight(0xfff1cf, 2.4);
  keyLight.position.set(18, 30, 14);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 150;
  keyLight.shadow.camera.left = -65;
  keyLight.shadow.camera.right = 65;
  keyLight.shadow.camera.top = 65;
  keyLight.shadow.camera.bottom = -65;
  scene.add(keyLight);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    GAME_CONFIG.render.bloomStrength,
    GAME_CONFIG.render.bloomRadius,
    GAME_CONFIG.render.bloomThreshold,
  );
  composer.addPass(bloom);

  const player = new PlayerController({
    scene,
    config: GAME_CONFIG,
    audio,
  });

  const input = new InputController({
    onAttune: toggleAttunement,
    onPause: togglePause,
    onRestart: restartCurrentStage,
    onDebugNext: () => {
      if (!runOptions.debug || state.mode !== "playing") return;
      state.collected = level.totalFragments;
      ui.setFragmentCount(state.collected);
      world.activatePortal();
      completeStage();
    },
    onMute: () => {
      state.muted = audio.toggleMuted();
      ui.setMuted(state.muted);
    },
  });

  ui.bind({
    onPlay: startGame,
    onResume: resumeGame,
    onRestart: restartCurrentStage,
  });

  function createWorld(stageLevel) {
    return new GameWorld({
      scene,
      level: stageLevel,
      visualContext: {
        hemisphere,
        bloom,
        baseBloom: GAME_CONFIG.render.bloomStrength,
        attunement: {
          ...GAME_CONFIG.attunement,
          drainPerSecond: stageLevel.attunementDrain,
        },
      },
      callbacks: {
        onCollect: handleCollect,
        onPortalLocked: handlePortalLocked,
        onWin: completeStage,
        onHazard: () => respawnPlayer("A ruptura dimensional desfez seu passo."),
        onTutorial: (type) => {
          const message = level.tutorials[type];
          if (message) ui.showTutorial(message);
        },
        onZorg: (position, zorgCamera, message, visible) =>
          ui.positionZorg(position, zorgCamera, message, visible),
        onAttunementExhausted: () => {
          if (!state.attuned) return;
          setAttunement(false, false);
          audio.deny();
          ui.showToast("A sintonia precisa se recompor.", "warning");
        },
      },
    });
  }

  function initialCheckpointLabel(stageLevel) {
    return (
      stageLevel.islands.find(
        (island) => island.checkpoint?.id === stageLevel.initialCheckpointId,
      )?.checkpoint.label ?? "Origem"
    );
  }

  function updateRunnerHud() {
    const activeStageScore =
      state.mode === "playing" || state.mode === "paused" || state.mode === "start"
        ? score.stageScore
        : 0;
    ui.setRunnerStats({
      stageNumber: progression.stageNumber,
      stageCount: progression.stageCount,
      distance: state.distance,
      score: score.totalScore + activeStageScore,
      best: Math.max(
        score.getWorldBest(),
        score.getStageBest(progression.stageNumber),
      ),
      seed: level.seed,
      debug: runOptions.debug,
    });
  }

  function mountCurrentStage({ mode = "playing" } = {}) {
    clearTimeout(tutorialTimer);
    setAttunement(false, false);
    world?.dispose();

    const muted = state?.muted ?? false;
    const stageNumber = progression.stageNumber;
    console.log("[WORLD] loading stage:", stageNumber);
    level = progression.createCurrentStage();
    if (level.stageNumber !== stageNumber) {
      throw new Error(
        `Progressão inconsistente: solicitado estágio ${stageNumber}, gerado ${level.stageNumber}.`,
      );
    }
    state = createInitialState(level);
    state.mode = mode;
    state.muted = muted;
    score.beginStage();
    world = createWorld(level);

    player.reset(level.spawn);
    player.lastCheckpointId = level.initialCheckpointId;
    input.clear();
    input.setEnabled(mode === "playing");

    ui.setWorld(level);
    ui.reset(level);
    ui.setFragmentCount(0);
    ui.setCheckpoint(initialCheckpointLabel(level));
    updateRunnerHud();
    player.updateCamera(0, camera, GAME_CONFIG.camera, true);
    updateDebugStatus();
  }

  function startGame() {
    console.log("[GAME] startGame chamado");
    audio.initialize();
    state.mode = "playing";
    input.setEnabled(true);
    ui.showPlaying();
    ui.showToast(`Fase 1 gerada — seed ${level.seed}`, "success");
    player.updateCamera(0, camera, GAME_CONFIG.camera, true);
    scheduleOpeningTutorial();
    updateDebugStatus();
  }

  function scheduleOpeningTutorial() {
    clearTimeout(tutorialTimer);
    showTutorial("movement");
    tutorialTimer = window.setTimeout(() => {
      if (state.mode === "playing" && !state.tutorialFlags.has("jump")) {
        showTutorial("jump");
      }
    }, 5000);
  }

  function showTutorial(type) {
    const message = level.tutorials[type];
    if (!message || state.tutorialFlags.has(type)) return;
    state.tutorialFlags.add(type);
    ui.showTutorial(message);
  }

  function handleCollect(fragment) {
    if (state.collectedFragmentIds.has(fragment.id)) return;
    state.collectedFragmentIds.add(fragment.id);
    state.collected = state.collectedFragmentIds.size;
    state.stageScore = score.collectFragment();
    runStats.fragments += 1;
    audio.collect(state.collected - 1);
    ui.setFragmentCount(state.collected);
    ui.pulseAttunement();
    updateRunnerHud();

    const remaining = level.totalFragments - state.collected;
    if (remaining > 0) {
      ui.showToast(`${fragment.label} recuperado — faltam ${remaining}`, "success");
      return;
    }
    world.activatePortal();
    ui.showToast("Todos os fragmentos responderam. Portal aberto!", "victory");
  }

  function handlePortalLocked() {
    const remaining = Math.max(0, level.totalFragments - state.collected);
    audio.deny();
    ui.showToast(
      remaining === 1
        ? "Ainda falta 1 fragmento nesta rota."
        : `Ainda faltam ${remaining} fragmentos nesta rota.`,
      "warning",
    );
    showTutorial("portal");
  }

  function activateCheckpoint(checkpoint) {
    if (!checkpoint || checkpoint.id === state.checkpointId) return;
    state.checkpointId = checkpoint.id;
    state.checkpointPosition = checkpoint.position.toArray();
    state.energy = Math.max(state.energy, 0.72);
    audio.checkpoint();
    ui.setCheckpoint(checkpoint.label);
    ui.setEnergy(state.energy);
    ui.showToast(`Âncora ativada: ${checkpoint.label}`, "checkpoint");
    showTutorial("checkpoint");
  }

  function setAttunement(enabled, playSound = true) {
    const mayEnable =
      state.mode === "playing" &&
      !state.respawning &&
      state.energy >= GAME_CONFIG.attunement.minimumEnergy;
    const next = Boolean(enabled && mayEnable);
    if (enabled && !mayEnable) {
      if (playSound) audio.deny();
      ui.showToast("A Corda ainda está se recompondo.", "warning");
      return;
    }
    if (state.attuned === next) return;

    state.attuned = next;
    if (next) {
      world.startAttunementWave(player.position);
      showTutorial("attune");
    } else {
      state.grace = GAME_CONFIG.attunement.graceTime;
    }
    player.setAttuned(next);
    input.setAttuned(next);
    ui.setAttuned(next);
    if (playSound) {
      if (next) audio.attuneOn();
      else audio.attuneOff();
    }
  }

  function toggleAttunement() {
    setAttunement(!state.attuned);
  }

  function togglePause() {
    if (state.mode === "playing") pauseGame();
    else if (state.mode === "paused") resumeGame();
  }

  function pauseGame() {
    if (state.mode !== "playing") return;
    clearTimeout(tutorialTimer);
    setAttunement(false, false);
    state.mode = "paused";
    input.setEnabled(false);
    ui.showPause();
    updateDebugStatus();
  }

  function resumeGame() {
    if (state.mode !== "paused") return;
    state.mode = "playing";
    input.setEnabled(true);
    ui.showPlaying();
    updateDebugStatus();
  }

  function restartCurrentStage() {
    if (state.mode === "start" || state.mode === "transitioning") return;
    clearTimeout(transitionTimer);

    const restartingRun = state.mode === "won";
    if (restartingRun) {
      progression.restartRun({ newSeed: true });
      score.resetRun();
      runStats.elapsed = 0;
      runStats.falls = 0;
      runStats.fragments = 0;
    }

    mountCurrentStage({ mode: "playing" });
    ui.showPlaying();
    input.setEnabled(true);
    audio.initialize();
    audio.checkpoint();
    ui.showToast(
      restartingRun ? "Nova sequência iniciada." : "Fase regenerada com a mesma seed.",
      "checkpoint",
    );
    scheduleOpeningTutorial();
  }

  function respawnPlayer(message = "A Corda puxou você de volta.") {
    if (state.respawning || state.mode !== "playing") return;
    state.respawning = true;
    state.falls += 1;
    runStats.falls += 1;
    state.stageScore = score.registerFall();
    setAttunement(false, false);
    input.setEnabled(false);
    audio.fall();
    ui.flashRespawn();
    ui.showToast(`${message} −25 pontos`, "warning");
    updateRunnerHud();

    window.setTimeout(() => {
      player.reset(state.checkpointPosition);
      player.lastCheckpointId = state.checkpointId;
      state.energy = Math.max(state.energy, 0.55);
      state.respawning = false;
      ui.setEnergy(state.energy);
      if (state.mode === "playing") input.setEnabled(true);
      player.updateCamera(0, camera, GAME_CONFIG.camera, true);
    }, GAME_CONFIG.respawn.delayMs);
  }

  function completeStage() {
    if (state.mode !== "playing") return;
    const currentStage = progression.stageNumber;
    console.log("[PROGRESSION] current stage before complete:", currentStage);
    clearTimeout(tutorialTimer);
    setAttunement(false, false);
    state.mode = "transitioning";
    input.setEnabled(false);
    audio.win();
    world.burst(
      player.position.clone().add(new THREE.Vector3(0, 1, 0)),
      COLORS.crystal,
      42,
      5.5,
    );

    const result = score.completeStage({
      stageNumber: currentStage,
      elapsed: state.elapsed,
    });
    updateRunnerHud();

    if (!progression.hasNextStage()) {
      state.mode = "won";
      ui.showWin({
        time: runStats.elapsed,
        falls: runStats.falls,
        fragments: state.collected,
        total: level.totalFragments,
        score: score.totalScore,
        xulLine:
          "MUNDO 00 — KORDEX-7 CONCLUÍDO. MUNDO 01 — DRAKKARETH EM PREPARAÇÃO.",
      });
      updateDebugStatus();
      return;
    }

    const advanced = progression.advance();
    if (!advanced) {
      throw new Error(`Não foi possível avançar após a fase ${currentStage}.`);
    }
    const nextStage = progression.stageNumber;
    console.log("[PROGRESSION] advancing to:", nextStage);
    ui.showStageTransition({
      stageNumber: nextStage,
      score: result.stageScore,
      message: result.isNewBest
        ? "NOVO RECORDE — NOVA SINTONIA"
        : "NOVA SINTONIA",
    });

    transitionTimer = window.setTimeout(() => {
      mountCurrentStage({ mode: "playing" });
      ui.showPlaying();
      input.setEnabled(true);
      ui.showToast(`Fase ${progression.stageNumber} — rota recalculada`, "success");
      scheduleOpeningTutorial();
    }, 1400);
    updateDebugStatus();
  }

  function updateDistance() {
    const routeSpan = Math.max(1, level.routeStartZ - level.routeEndZ);
    const progress = THREE.MathUtils.clamp(
      (level.routeStartZ - player.position.z) / routeSpan,
      0,
      1,
    );
    state.distance = Math.max(state.distance, progress * level.routeLength);
  }

  function updateDebugStatus() {
    window.__KORDEX_STATUS__ = Object.freeze({
      mode: state.mode,
      stageNumber: progression.stageNumber,
      stageCount: progression.stageCount,
      seed: level.seed,
      difficulty: progression.difficulty,
      fragments: state.collected,
      totalFragments: level.totalFragments,
      distance: Math.round(state.distance),
      score:
        score.totalScore +
        (state.mode === "playing" || state.mode === "paused" || state.mode === "start"
          ? score.stageScore
          : 0),
      player: player.position.toArray().map((value) => Number(value.toFixed(2))),
    });
    document.documentElement.dataset.kordexMode = state.mode;
    document.documentElement.dataset.kordexStage = String(progression.stageNumber);
    document.documentElement.dataset.kordexPlayer = player.position
      .toArray()
      .map((value) => value.toFixed(2))
      .join(",");
  }

  mountCurrentStage({ mode: "start" });
  ui.showStart();
  input.setEnabled(false);
  window.__KORDEX_BOOTED__ = true;

  const clock = new THREE.Clock();
  const startCameraTarget = new THREE.Vector3(0, 2, -12);
  let statusTimer = 0;

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), GAME_CONFIG.physics.maxDelta);

    if (state.mode === "start") {
      world.updateAmbient(dt, state);
      const orbit = performance.now() * 0.0001;
      camera.position.set(Math.sin(orbit) * 18, 13, 18 + Math.cos(orbit) * 8);
      camera.lookAt(startCameraTarget);
    } else if (state.mode === "playing") {
      state.elapsed += dt;
      runStats.elapsed += dt;
      world.updateAmbient(dt, state);
      world.updateAttunement(dt, state);
      player.update(dt, input, camera, world, {
        onCheckpoint: activateCheckpoint,
        onJump: () => state.tutorialFlags.add("jump"),
      });
      world.updateGameplay(dt, state, player, camera);
      player.updateCamera(dt, camera, GAME_CONFIG.camera);
      updateDistance();
      ui.setEnergy(state.energy);
      updateRunnerHud();

      if (player.position.y < (level.killY ?? GAME_CONFIG.respawn.killY)) {
        respawnPlayer();
      }
    } else if (state.mode === "won" || state.mode === "transitioning") {
      world.updateAmbient(dt, state);
      player.updateCamera(dt, camera, GAME_CONFIG.camera);
    }

    statusTimer += dt;
    if (statusTimer >= 0.25) {
      statusTimer = 0;
      updateDebugStatus();
    }
    composer.render();
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, GAME_CONFIG.render.maxPixelRatio));
    composer.setSize(width, height);
    bloom.resolution.set(width, height);
  }

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.mode === "playing") pauseGame();
  });
  frame();
}

bootstrap().catch((error) => {
  console.error("[BOOT] Falha fatal no Sintonia Runner", error);
  document.body.innerHTML = `
    <main class="fatal-error">
      <h1>A Sintonia foi interrompida</h1>
      <p>${error.message}</p>
      <p>Abra o projeto por servidor local e confira o console do navegador.</p>
    </main>
  `;
});
