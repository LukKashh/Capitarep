// Deterministic helpers shared by the simulation. Identical results on any
// server for the same inputs, so simulated markets continue "offline" and
// every player sees the same prices.

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth pseudo-random wave in roughly [-1, 1]. */
export function wave(seed: number, t: number): number {
  const r = mulberry(seed);
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < 6; i++) {
    const period = 20 + r() * 600 * (i + 1);
    const phase = r() * Math.PI * 2;
    const amp = 1 / (i + 1);
    sum += amp * Math.sin((t / period) * Math.PI * 2 + phase);
    norm += amp;
  }
  // jitter
  const j = mulberry(seed ^ Math.floor(t))();
  return (sum / norm) * 0.9 + (j - 0.5) * 0.2;
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function round2(v: number) {
  return Math.round(v * 100) / 100;
}
