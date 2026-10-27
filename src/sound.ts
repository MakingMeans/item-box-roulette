// The glob resolves to nothing if spin.mp3 is removed, so the app then falls back to
// generated sounds instead of failing to build.
const soundFiles = import.meta.glob<string>("./assets/sounds/spin.mp3", {
  eager: true,
  query: "?url",
  import: "default",
});
const SPIN_SOUND_URL: string | undefined = soundFiles["./assets/sounds/spin.mp3"];

/** Second at which the result jingle starts in spin.mp3, measured from its waveform. */
const SPIN_SOUND_RESULT_AT = 3.48;

/** Spin length, matched to the spin track so the winner lands on the result jingle. */
export const SPIN_DURATION_MS = SPIN_SOUND_RESULT_AT * 1000;

export class SoundPlayer {
  private readonly ctx = new AudioContext();
  private readonly master = this.ctx.createGain();
  private spinBuffer: AudioBuffer | null = null;
  private playing: AudioBufferSourceNode | null = null;

  constructor(muted: boolean) {
    this.master.connect(this.ctx.destination);
    this.setMuted(muted);
    if (SPIN_SOUND_URL) void this.loadSpinSound(SPIN_SOUND_URL);
  }

  private async loadSpinSound(url: string) {
    try {
      const response = await fetch(url);
      this.spinBuffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
    } catch (err) {
      console.warn("Could not load spin.mp3, using generated sounds", err);
    }
  }

  /** Time between starting a sound and actually hearing it. */
  get latencyMs(): number {
    return (this.ctx.baseLatency + (this.ctx.outputLatency || 0)) * 1000;
  }

  setMuted(muted: boolean) {
    this.master.gain.value = muted ? 0 : 1;
  }

  /** Call when a spin starts. Plays the spin track (ticks + result jingle) if available. */
  startSpin() {
    void this.ctx.resume();
    if (!this.spinBuffer) return;
    this.playing?.stop();
    const source = this.ctx.createBufferSource();
    source.buffer = this.spinBuffer;
    source.connect(this.master);
    source.start();
    this.playing = source;
  }

  /** Call on every image change. Silent when the spin track already provides the ticks. */
  tick() {
    if (this.spinBuffer) return;
    this.blip(1100 + Math.random() * 300, this.ctx.currentTime, 0.035, "square", 0.08);
  }

  /** Call when the spin stops. Silent when the spin track already provides the jingle. */
  result() {
    if (this.spinBuffer) return;
    const t = this.ctx.currentTime;
    [784, 988, 1175, 1568].forEach((freq, i) => {
      this.blip(freq, t + i * 0.09, i === 3 ? 0.5 : 0.12, "triangle", 0.25);
    });
  }

  private blip(freq: number, start: number, duration: number, type: OscillatorType, volume: number) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain).connect(this.master);
    osc.start(start);
    osc.stop(start + duration);
  }
}
