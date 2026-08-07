/** Helpers mathématiques. Tout est en fonctions libres : aucune allocation dans la boucle chaude. */

export const TAU = Math.PI * 2;
export const PI = Math.PI;

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Interpolation indépendante du framerate : `rate` = fraction restante après 1 s. */
export const damp = (a: number, b: number, rate: number, dt: number): number =>
  lerp(a, b, 1 - Math.pow(rate, dt));

export const sign = (v: number): number => (v > 0 ? 1 : v < 0 ? -1 : 0);

/** Rapproche `a` de `b` d'au plus `step`. */
export const approach = (a: number, b: number, step: number): number => {
  if (a < b) return Math.min(a + step, b);
  if (a > b) return Math.max(a - step, b);
  return b;
};

export const dist2 = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
};

export const dist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.sqrt(dist2(ax, ay, bx, by));

/** Différence d'angle la plus courte, dans ]-PI, PI]. */
export const angleDiff = (a: number, b: number): number => {
  let d = (b - a) % TAU;
  if (d > PI) d -= TAU;
  if (d < -PI) d += TAU;
  return d;
};

export const smoothstep = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInCubic = (t: number): number => clamp01(t) ** 3;
export const easeOutBack = (t: number): number => {
  const x = clamp01(t);
  return 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);
};

/** Bruit de valeur 2D, lissé. Utilisé pour le décor — pas besoin de vrai Perlin. */
export function valueNoise2(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const h = (a: number, b: number): number => {
    let n = a * 374761393 + b * 668265263 + seed * 1442695041;
    n = (n ^ (n >>> 13)) >>> 0;
    n = (n * 1274126177) >>> 0;
    return (n >>> 8) / 16777216;
  };
  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

/** Formatte des secondes en `MM:SS`. */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

/** Abrège les grands nombres : 1234 → "1.2k". */
export function abbrev(n: number): string {
  const v = Math.round(n);
  if (v < 1000) return String(v);
  if (v < 1_000_000) return `${(v / 1000).toFixed(v < 10_000 ? 1 : 0)}k`;
  return `${(v / 1_000_000).toFixed(1)}M`;
}
