// The glob resolves to nothing for a removed file, so the app then falls back to generated
// spin sounds or plays no music instead of failing to build.
const soundFiles = import.meta.glob<string>("./assets/sounds/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
});
const SPIN_SOUND_URL: string | undefined = soundFiles["./assets/sounds/spin.mp3"];
const IDLE_MUSIC_URL: string | undefined = soundFiles["./assets/sounds/idlemusic.mp3"];

/** Second at which the result jingle starts in spin.mp3, measured from its waveform. */
const SPIN_SOUND_RESULT_AT = 3.48;
/**
 * A run of evenly spaced ticks in spin.mp3, cut just before tick onsets, that loops without
 * breaking the rhythm. Longer spins repeat it before the jingle.
 */
const TICK_LOOP_START = 2.1626;
const TICK_LOOP_END = 3.2975;

/** Shortest spin: the spin track as recorded. */
export const MIN_SPIN_SECONDS = SPIN_SOUND_RESULT_AT;
/** Longest spin the duration control offers. */
export const MAX_SPIN_SECONDS = MIN_SPIN_SECONDS + 10;

const MUSIC_VOLUME = 0.5;
/** Music level during a spin, so the ticks and the jingle stand out. */
const MUSIC_DUCKED = 0.12;
/** How long the result jingle lasts after the stop, before the music comes back up. */
const JINGLE_SECONDS = 1.1;

export class SoundPlayer {
  private readonly ctx = new AudioContext();
  private readonly master = this.ctx.createGain();
  private readonly musicGain = this.ctx.createGain();
  private spinBuffer: AudioBuffer | null = null;
  private playing: AudioBufferSourceNode[] = [];

  constructor(muted: boolean) {
    this.master.connect(this.ctx.destination);
    this.musicGain.gain.value = MUSIC_VOLUME;
    this.musicGain.connect(this.master);
    this.setMuted(muted);
    if (SPIN_SOUND_URL) void this.loadSpinSound(SPIN_SOUND_URL);
    if (IDLE_MUSIC_URL) this.startMusic(IDLE_MUSIC_URL);
  }

  private async loadSpinSound(url: string) {
    try {
      const response = await fetch(url);
      this.spinBuffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
    } catch (err) {
      console.warn("Could not load spin.mp3, using generated sounds", err);
    }
  }

  /** Streams the background music in a loop through the mixer (so mute and ducking apply). */
  private startMusic(url: string) {
    const music = new Audio(url);
    music.loop = true;
    this.ctx.createMediaElementSource(music).connect(this.musicGain);
    const play = () => {
      void this.ctx.resume();
      music.play().catch(() => {});
    };
    play();
    // Audio may be held back until the user first interacts with the window.
    window.addEventListener("pointerdown", play, { once: true });
    window.addEventListener("keydown", play, { once: true });
  }

  /** Time between starting a sound and actually hearing it. */
  get latencyMs(): number {
    return (this.ctx.baseLatency + (this.ctx.outputLatency || 0)) * 1000;
  }

  setMuted(muted: boolean) {
    this.master.gain.value = muted ? 0 : 1;
  }

  /**
   * Call when a spin of `seconds` starts. Plays the spin track stretched to that length by
   * looping its ticks, so the result jingle starts exactly when the box stops.
   */
  startSpin(seconds: number) {
    void this.ctx.resume();
    const start = this.ctx.currentTime;
    const stopAt = start + seconds;
    this.duckMusic(start, stopAt + JINGLE_SECONDS);
    if (!this.spinBuffer) return;
    for (const source of this.playing) source.stop();

    if (seconds <= SPIN_SOUND_RESULT_AT + 0.01) {
      const whole = this.source();
      whole.connect(this.master);
      whole.start(start);
      this.playing = [whole];
      return;
    }
    const ticks = this.source();
    ticks.loop = true;
    ticks.loopStart = TICK_LOOP_START;
    ticks.loopEnd = TICK_LOOP_END;
    // A short fade so cutting the loop mid-tick doesn't click.
    const fade = this.ctx.createGain();
    fade.gain.setValueAtTime(1, stopAt - 0.03);
    fade.gain.linearRampToValueAtTime(0, stopAt);
    ticks.connect(fade).connect(this.master);
    ticks.start(start);
    ticks.stop(stopAt + 0.01);

    const jingle = this.source();
    jingle.connect(this.master);
    jingle.start(stopAt, SPIN_SOUND_RESULT_AT);
    this.playing = [ticks, jingle];
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

  private source(): AudioBufferSourceNode {
    const source = this.ctx.createBufferSource();
    source.buffer = this.spinBuffer;
    return source;
  }

  private duckMusic(from: number, until: number) {
    const gain = this.musicGain.gain;
    gain.cancelAndHoldAtTime(from);
    gain.setTargetAtTime(MUSIC_DUCKED, from, 0.08);
    gain.setTargetAtTime(MUSIC_VOLUME, until, 0.4);
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
