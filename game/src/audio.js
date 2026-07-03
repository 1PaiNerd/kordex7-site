const NOTES = [261.63, 293.66, 329.63, 392, 440, 523.25, 659.25];

export class AudioController {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
  }

  async initialize() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.66;
      this.master.connect(this.context.destination);

      const drone = this.context.createGain();
      drone.gain.value = 0.024;
      drone.connect(this.master);

      [55, 55.6, 110.3].forEach((frequency) => {
        const oscillator = this.context.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        oscillator.connect(drone);
        oscillator.start();
      });
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.66, this.context.currentTime, 0.02);
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  tone({ frequency = 440, secondFrequency = null, type = "sine", duration = 0.3, volume = 0.25, slide = 0, delay = 0 }) {
    if (!this.context || this.muted) return;

    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slide) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(30, frequency + slide),
        start + duration,
      );
    }

    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);

    if (secondFrequency) {
      this.tone({
        frequency: secondFrequency,
        type,
        duration,
        volume: volume * 0.5,
        delay,
      });
    }
  }

  jump() {
    this.tone({ frequency: 300, slide: 220, type: "triangle", duration: 0.16, volume: 0.18 });
  }

  land() {
    this.tone({ frequency: 150, slide: -70, duration: 0.12, volume: 0.14 });
  }

  attuneOn() {
    this.tone({ frequency: 220, secondFrequency: 330, type: "sawtooth", duration: 0.5, volume: 0.1, slide: 60 });
    this.tone({ frequency: 660, duration: 0.4, volume: 0.08, delay: 0.05 });
  }

  attuneOff() {
    this.tone({ frequency: 330, slide: -180, duration: 0.3, volume: 0.09 });
  }

  collect(index) {
    const frequency = NOTES[Math.min(index, NOTES.length - 1)];
    this.tone({ frequency, duration: 0.45, volume: 0.3 });
    this.tone({ frequency: frequency * 1.5, duration: 0.35, volume: 0.12, delay: 0.02 });
  }

  deny() {
    this.tone({ frequency: 170, slide: -60, type: "square", duration: 0.15, volume: 0.08 });
  }

  fall() {
    this.tone({ frequency: 420, slide: -330, type: "sawtooth", duration: 0.4, volume: 0.12 });
  }

  checkpoint() {
    this.tone({ frequency: 392, secondFrequency: 523.25, duration: 0.4, volume: 0.16 });
  }

  win() {
    NOTES.forEach((frequency, index) => {
      this.tone({ frequency, duration: 0.34, volume: 0.24, delay: index * 0.11 });
    });
    this.tone({
      frequency: 523.25,
      secondFrequency: 659.25,
      duration: 1.2,
      volume: 0.2,
      delay: 0.85,
    });
  }
}
