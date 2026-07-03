export class GameUI {
  constructor() {
    this.startScreen = document.querySelector("#start");
    this.pauseScreen = document.querySelector("#pause");
    this.winScreen = document.querySelector("#win");
    this.transitionScreen = document.querySelector("#stageTransition");
    this.hud = document.querySelector("#hud");
    this.fragmentContainer = document.querySelector("#frag");
    this.energy = document.querySelector("#energy");
    this.energyFill = document.querySelector("#energyFill");
    this.energyPercent = document.querySelector("#energyPercent");
    this.toastElement = document.querySelector("#toast");
    this.tutorialElement = document.querySelector("#tutorial");
    this.tutorialText = document.querySelector("#tutorialText");
    this.zorgSay = document.querySelector("#zorgSay");
    this.fade = document.querySelector("#fade");
    this.vignette = document.querySelector("#vignette");
    this.tunePulse = document.querySelector("#tunePulse");
    this.checkpointName = document.querySelector("#checkpointName");
    this.stageIndicator = document.querySelector("#stageIndicator");
    this.distanceValue = document.querySelector("#distanceValue");
    this.scoreValue = document.querySelector("#scoreValue");
    this.bestValue = document.querySelector("#bestValue");
    this.seedDisplay = document.querySelector("#seedDisplay");
    this.toastTimer = 0;
    this.tutorialTimer = 0;
  }

  bind(handlers) {
    const playBtn = document.getElementById("playBtn");
    playBtn.addEventListener("click", () => {
      console.log("[INPUT] iniciar clicado");
      handlers.onPlay();
    });
    document.querySelector("#resumeBtn").addEventListener("click", handlers.onResume);
    document.querySelector("#restartBtn").addEventListener("click", handlers.onRestart);
    document.querySelector("#againBtn").addEventListener("click", handlers.onRestart);
  }

  setWorld(level) {
    this.buildFragments(level.totalFragments);
    const worldTag = document.querySelector("#worldTag");
    if (worldTag) {
      worldTag.querySelector(".eyebrow").textContent = `MUNDO ${String(level.order).padStart(2, "0")}`;
      worldTag.querySelector("strong").textContent = level.shortTitle;
    }
  }

  setRunnerStats({ stageNumber, stageCount, distance, score, best, seed, debug }) {
    this.stageIndicator.textContent = `FASE ${stageNumber}/${stageCount}`;
    this.distanceValue.textContent = `${Math.max(0, Math.round(distance))} m`;
    this.scoreValue.textContent = Math.max(0, Math.round(score)).toLocaleString("pt-BR");
    this.bestValue.textContent = Math.max(0, Math.round(best)).toLocaleString("pt-BR");
    this.seedDisplay.hidden = !debug;
    this.seedDisplay.textContent = debug ? `SEED ${seed}` : "";
  }

  setMuted(muted) {
    this.toast(muted ? "Som desativado" : "Som ativado", 1400);
  }

  buildFragments(total) {
    this.fragmentContainer.innerHTML = "";
    for (let index = 0; index < total; index += 1) {
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.setAttribute("aria-label", `Fragmento ${index + 1}`);
      this.fragmentContainer.appendChild(dot);
    }

    const label = document.createElement("span");
    label.className = "lbl";
    label.textContent = "FRAGMENTOS";
    this.fragmentContainer.appendChild(label);
  }

  setFragmentCount(count) {
    const dots = [...this.fragmentContainer.querySelectorAll(".dot")];
    dots.forEach((dot, index) => dot.classList.toggle("fill", index < count));

    const latest = dots[count - 1];
    if (latest) {
      latest.classList.add("pop");
      setTimeout(() => latest.classList.remove("pop"), 220);
    }
  }

  setEnergy(value) {
    const percent = Math.round(value * 100);
    this.energyFill.style.width = `${percent}%`;
    this.energyPercent.textContent = `${percent}%`;
  }

  setAttuned(attuned) {
    this.vignette.classList.toggle("on", attuned);
    this.energy.classList.toggle("tuned", attuned);
  }

  pulseAttunement() {
    this.tunePulse.classList.remove("fire");
    void this.tunePulse.offsetWidth;
    this.tunePulse.classList.add("fire");
  }

  setCheckpoint(label) {
    this.checkpointName.textContent = label;
  }

  toast(html, duration = 2600) {
    this.toastElement.innerHTML = html;
    this.toastElement.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastElement.classList.remove("show"), duration);
  }

  showToast(message, kind = "") {
    this.toastElement.dataset.kind = kind;
    this.toast(message);
  }

  tutorial(message, duration = 4200) {
    this.tutorialText.textContent = message;
    this.tutorialElement.classList.add("show");
    clearTimeout(this.tutorialTimer);
    this.tutorialTimer = setTimeout(
      () => this.tutorialElement.classList.remove("show"),
      duration,
    );
  }

  showTutorial(message) {
    this.tutorial(message);
  }

  showStart() {
    this.startScreen.classList.remove("hide");
    this.pauseScreen.classList.add("hide");
    this.winScreen.classList.add("hide");
    this.transitionScreen.classList.add("hide");
    this.hud.classList.remove("on");
  }

  showPlaying() {
    this.startScreen.classList.add("hide");
    this.pauseScreen.classList.add("hide");
    this.winScreen.classList.add("hide");
    this.transitionScreen.classList.add("hide");
    this.hud.classList.add("on");
  }

  showPause() {
    this.pauseScreen.classList.remove("hide");
    this.hud.classList.remove("on");
  }

  showStageTransition({ stageNumber, score, message = "NOVA SINTONIA" }) {
    document.querySelector("#transitionTitle").textContent = `FASE ${stageNumber}`;
    document.querySelector("#transitionMessage").textContent = message;
    document.querySelector("#transitionScore").textContent =
      `+${Math.max(0, Math.round(score)).toLocaleString("pt-BR")} PONTOS`;
    this.hud.classList.remove("on");
    this.pauseScreen.classList.add("hide");
    this.transitionScreen.classList.remove("hide");
  }

  showWin({ time, falls, fragments, total, score = 0, xulLine }) {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    document.querySelector("#stTime").textContent =
      `${minutes}:${String(seconds).padStart(2, "0")}`;
    document.querySelector("#stFalls").textContent = falls;
    document.querySelector("#stFragments").textContent = `${fragments}/${total}`;
    document.querySelector("#stScore").textContent =
      Math.max(0, Math.round(score)).toLocaleString("pt-BR");
    document.querySelector("#xulLine").textContent = xulLine;

    this.hud.classList.remove("on");
    this.pauseScreen.classList.add("hide");
    this.transitionScreen.classList.add("hide");
    this.winScreen.classList.remove("hide");
  }

  flashRespawn() {
    this.fade.classList.add("on");
    setTimeout(() => this.fade.classList.remove("on"), 200);
  }

  positionZorg(worldPosition, camera, message, visible) {
    if (!visible) {
      this.zorgSay.classList.remove("show");
      return;
    }

    const projected = worldPosition.clone().project(camera);
    this.zorgSay.textContent = `Zorg: ${message}`;
    this.zorgSay.style.left = `${(projected.x * 0.5 + 0.5) * innerWidth}px`;
    this.zorgSay.style.top = `${(-projected.y * 0.5 + 0.5) * innerHeight}px`;
    this.zorgSay.classList.add("show");
  }

  reset(level) {
    clearTimeout(this.toastTimer);
    clearTimeout(this.tutorialTimer);
    this.toastElement.classList.remove("show");
    this.tutorialElement.classList.remove("show");
    this.zorgSay.classList.remove("show");
    this.setAttuned(false);
    this.setEnergy(1);
    this.buildFragments(level.totalFragments);
    const initialLabel = level.islands.find(
      (island) => island.checkpoint?.id === level.initialCheckpointId,
    )?.checkpoint.label;
    this.setCheckpoint(initialLabel ?? "Origem");
  }
}
