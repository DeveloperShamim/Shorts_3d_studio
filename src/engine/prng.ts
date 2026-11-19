/**
 * Deterministic PRNG, math helpers, easing curves, and palette tokens.
 * Zero Math.random() anywhere in the render pipeline.
 */

export const COLORS = {
  bgDark: '#090B10',
  moneyGreen: '#22E07A',
  alertRed: '#FF3B5C',
  highlightYellow: '#FFD54A',
  cyan: '#3CE0FF',
  orange: '#FF6A3A',
  mayaTeal: '#5CF2D0',
  jordanYellow: '#FFD54A',
  narratorWhite: '#FFFFFF',
} as const;

export interface Rng {
  next(): number;
  range(min: number, max: number): number;
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
}

/**
 * Mulberry32 seeded PRNG: identical sequence for any given seed.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range(min: number, max: number) {
      return min + (max - min) * next();
    },
    int(min: number, max: number) {
      return Math.floor(min + (max - min + 1) * next());
    },
    pick<T>(arr: readonly T[]) {
      return arr[Math.floor(next() * arr.length)];
    },
  };
}

/** Deterministic stateless hash in [0, 1) */
export function hash1(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function invLerp(a: number, b: number, v: number): number {
  if (b === a) return 0;
  return clamp((v - a) / (b - a), 0, 1);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function easeOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

export function easeInCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * x;
}

export function easeInOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function easeOutQuart(t: number): number {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 4);
}

export function easeOutBack(t: number, overshoot = 1.70158): number {
  const x = clamp(t, 0, 1);
  const c3 = overshoot + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + overshoot * Math.pow(x - 1, 2);
}

export function easeOutBounce(t: number): number {
  const x = clamp(t, 0, 1);
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) {
    return n1 * x * x;
  } else if (x < 2 / d1) {
    const u = x - 1.5 / d1;
    return n1 * u * u + 0.75;
  } else if (x < 2.5 / d1) {
    const u = x - 2.25 / d1;
    return n1 * u * u + 0.9375;
  } else {
    const u = x - 2.625 / d1;
    return n1 * u * u + 0.984375;
  }
}

/**
 * Every shot starts with an 8% tighter FOV punch-in easing out over 0.25s.
 */
export function punchInFov(baseFov: number, shotElapsed: number): number {
  const p = easeOutCubic(clamp(shotElapsed / 0.25, 0, 1));
  return lerp(baseFov * 0.92, baseFov, p);
}
