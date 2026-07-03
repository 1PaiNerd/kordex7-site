import {
  DEFAULT_STAGE_PROFILES,
  generateProceduralLevel,
} from "./generator.js?v=3.0.3";

export const KORDEX7_RUNNER = Object.freeze({
  id: "kordex7-runner",
  worldId: "kordex7",
  order: 0,
  title: "Mundo 00 — KORDEX-7: Sintonia Runner",
  shortTitle: "KORDEX-7",
  stageCount: 5,
  defaultDifficulty: "standard",
  profiles: DEFAULT_STAGE_PROFILES,
  tutorials: {
    movement: "A rota segue adiante. Use A/D ou o joystick para ajustar sua linha.",
    jump: "Pule entre as ilhas antes que o vazio alcance seu ritmo.",
    attune: "SINTONIZE para tornar pontes e plataformas fantasma sólidas.",
    checkpoint: "Âncora estabilizada. Uma queda retornará você a este trecho.",
    portal: "O portal só responde quando todos os fragmentos desta fase são recuperados.",
  },
  zorgLines: [
    "Uma rota nova a cada sintonia. Estatisticamente elegante.",
    "O vazio não persegue ninguém. Ele só espera embaixo.",
    "As plataformas rosa pertencem a uma frequência menos óbvia.",
    "Xul chamou isso de corrida. Eu prefiro experimento longitudinal.",
  ],
});

export function createKordex7Stage({
  stageNumber,
  seed,
  difficulty = KORDEX7_RUNNER.defaultDifficulty,
}) {
  const generated = generateProceduralLevel({
    worldId: KORDEX7_RUNNER.worldId,
    stageNumber,
    seed,
    difficulty,
    profiles: KORDEX7_RUNNER.profiles,
  });

  return Object.freeze({
    ...generated,
    id: `kordex7-runner-stage-${stageNumber}`,
    order: 0,
    title: KORDEX7_RUNNER.title,
    shortTitle: KORDEX7_RUNNER.shortTitle,
    status: "playable",
    playable: true,
    builderId: "procedural-floating-runner",
    stageCount: KORDEX7_RUNNER.stageCount,
    theme: {
      atmosphere: "cosmic-fantasy",
      cordColor: 0x4de3ff,
      tunedColor: 0xff6ec7,
      crystalColor: 0xffd166,
    },
    tutorials: KORDEX7_RUNNER.tutorials,
    zorgLines: KORDEX7_RUNNER.zorgLines,
    victoryMessage:
      stageNumber === 5
        ? "KORDEX-7 ouviu sua assinatura completa. Drakkareth ainda está além da próxima Corda."
        : `Fase ${stageNumber} estabilizada. Uma nova rota já está se formando.`,
  });
}

export default KORDEX7_RUNNER;
