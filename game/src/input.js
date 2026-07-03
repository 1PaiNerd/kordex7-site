const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class InputController {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.keys = new Set();
    this.jumpQueued = false;
    this.joystick = { x: 0, y: 0 };
    this.joystickPointer = null;
    this.enabled = true;
    this.isTouch =
      matchMedia("(pointer: coarse)").matches ||
      matchMedia("(max-width: 900px)").matches ||
      navigator.maxTouchPoints > 0;

    this.joystickElement = document.querySelector("#joystick");
    this.knobElement = document.querySelector("#joystickKnob");
    this.jumpButton = document.querySelector("#mobileJump");
    this.tuneButton = document.querySelector("#mobileTune");
    this.pauseButton = document.querySelector("#pauseHudBtn");

    document.querySelector("#mobileControls")?.classList.toggle("active", this.isTouch);
    this.bindKeyboard();
    this.bindMobile();
  }

  bindKeyboard() {
    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        event.preventDefault();
      }

      if (!this.keys.has(key)) {
        if (key === " ") this.queueJump();
        if (key === "e") this.handlers.onAttune?.();
        if (key === "r") this.handlers.onRestart?.();
        if (key === "m") this.handlers.onMute?.();
        if (key === "n") this.handlers.onDebugNext?.();
        if (key === "escape" || key === "p") this.handlers.onPause?.();
      }

      this.keys.add(key);
    });

    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.key.toLowerCase());
    });

    window.addEventListener("blur", () => this.clear());
  }

  bindMobile() {
    if (!this.joystickElement) return;

    const updateJoystick = (event) => {
      const rect = this.joystickElement.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const maxRadius = rect.width * 0.34;
      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;
      const distance = Math.hypot(dx, dy) || 1;
      const scale = Math.min(1, maxRadius / distance);
      const offsetX = dx * scale;
      const offsetY = dy * scale;

      this.joystick.x = clamp(offsetX / maxRadius, -1, 1);
      this.joystick.y = clamp(-offsetY / maxRadius, -1, 1);
      this.knobElement.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    };

    this.joystickElement.addEventListener("pointerdown", (event) => {
      this.joystickPointer = event.pointerId;
      this.joystickElement.setPointerCapture(event.pointerId);
      updateJoystick(event);
    });

    this.joystickElement.addEventListener("pointermove", (event) => {
      if (event.pointerId === this.joystickPointer) updateJoystick(event);
    });

    const releaseJoystick = (event) => {
      if (event.pointerId !== this.joystickPointer) return;
      this.joystickPointer = null;
      this.joystick.x = 0;
      this.joystick.y = 0;
      this.knobElement.style.transform = "translate(0, 0)";
    };

    this.joystickElement.addEventListener("pointerup", releaseJoystick);
    this.joystickElement.addEventListener("pointercancel", releaseJoystick);

    this.jumpButton?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.queueJump();
    });

    this.tuneButton?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.handlers.onAttune?.();
    });

    this.pauseButton?.addEventListener("click", () => this.handlers.onPause?.());
    window.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  queueJump() {
    if (this.enabled) this.jumpQueued = true;
  }

  consumeJump() {
    const queued = this.jumpQueued;
    this.jumpQueued = false;
    return queued;
  }

  getMoveAxes() {
    if (!this.enabled) return { x: 0, y: 0 };

    let x = this.joystick.x;
    let y = this.joystick.y;

    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) y += 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) y -= 1;

    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) {
      x /= magnitude;
      y /= magnitude;
    }

    return { x, y };
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  setAttuned(attuned) {
    this.tuneButton?.classList.toggle("active", attuned);
  }

  clear() {
    this.keys.clear();
    this.jumpQueued = false;
    this.joystick.x = 0;
    this.joystick.y = 0;
    if (this.knobElement) this.knobElement.style.transform = "translate(0, 0)";
  }
}
