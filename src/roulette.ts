/** Gap between the first image changes, at full speed. */
const FASTEST_GAP_MS = 40;
/** Ease-out strength: higher starts faster and brakes harder at the end. */
const EASE_POWER = 1.7;

export interface SpinFrame {
  /** Milliseconds from the start of the spin. */
  at: number;
  /** Index of the item shown from this moment on. */
  index: number;
}

/** Uniform random integer in [0, max), using rejection sampling to avoid modulo bias. */
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0) {
    throw new RangeError(`max must be a positive integer, got ${max}`);
  }
  const range = 2 ** 32;
  const limit = range - (range % max);
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

/**
 * Builds the sequence of items shown during a spin. The winner is decided by the caller
 * beforehand; this only stages it. Needs at least 2 items.
 */
export function buildSpinPlan(itemCount: number, winner: number, durationMs: number): SpinFrame[] {
  // The first gap is about duration / (EASE_POWER * frames), so longer spins get more frames
  // and start just as fast.
  const frameCount = Math.max(10, Math.round(durationMs / (EASE_POWER * FASTEST_GAP_MS)));
  const indices = new Array<number>(frameCount + 1);
  indices[frameCount] = winner;
  // Walk backwards from the winner, picking among the *other* items each time,
  // so the same image never shows twice in a row.
  for (let k = frameCount - 1; k >= 0; k--) {
    const r = randomInt(itemCount - 1);
    indices[k] = r >= indices[k + 1] ? r + 1 : r;
  }
  // Frame k appears when the eased progress reaches k / frameCount: gaps grow from ~40 ms
  // to ~350 ms before the final stop of a 3.5 s spin (~600 ms for a 13.5 s one).
  return indices.map((index, k) => ({
    at: durationMs * (1 - (1 - k / frameCount) ** (1 / EASE_POWER)),
    index,
  }));
}

/**
 * Plays a spin plan on the animation clock. `show` receives each item index together with
 * how long it will stay on screen (Infinity for the final one).
 */
export function playSpin(plan: SpinFrame[], show: (index: number, gapMs: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    let next = 0;
    const step = (now: number) => {
      const elapsed = now - start;
      // If the page stalled, jump to the latest due frame instead of drifting behind the audio.
      let due = -1;
      while (next < plan.length && plan[next].at <= elapsed) due = next++;
      if (due >= 0) {
        const gap = due + 1 < plan.length ? plan[due + 1].at - plan[due].at : Infinity;
        show(plan[due].index, gap);
      }
      if (next < plan.length) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}
