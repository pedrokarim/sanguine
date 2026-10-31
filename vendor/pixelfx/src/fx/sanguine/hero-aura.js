import { band, cycle, fit, sparkle, TAU } from "../../core/index.js";

export const meta = {
  name: "Sanguine hero aura",
  desc: "A cosmetic aura under the hero's feet: rank 1 a soft glow and rising motes, rank 2 a double ring with ticks, rank 3 a turning rune star and a column of light.",
  tags: ["sanguine", "cosmetic", "aura", "ground", "top-down", "loop"],
  size: [64, 72],
  origin: [32, 54],
  duration: 2,
  loop: true,
  fps: 10,
  bg: "ground",
  options: { palette: ["#160a2c", "#3a1a6a", "#6a2cb0", "#a855f7", "#c88cff", "#e4c4ff", "#ffffff"], rank: 1, seed: 3 },
};

const S = 0.5, R = 13;

export function draw(p, t, o) {
  const C = fit(o.palette, 7), ramp = [C[1], C[2], C[3], C[4], C[5], C[6]], ph = t / meta.duration, beat = 0.5 + 0.5 * Math.sin(ph * TAU);
  p.glow(0, 0, R * 1.3, C[3], 0.22 + 0.1 * beat);
  if (o.rank >= 2) {
    band(p, 0, 0, R, S, 1.2, 0.8, ramp);
    band(p, 0, 0, R * 0.62, S, 0.8, 0.5, ramp);
    for (let k = 0; k < 8; k++) {
      const a = ph * (TAU / 8) + (k * TAU) / 8;
      p.dot(Math.cos(a) * (R + 2), Math.sin(a) * (R + 2) * S, k % 2 ? C[5] : C[4]);
    }
  }
  if (o.rank >= 3) {
    // L'étoile tourne d'un sixième de tour par boucle : elle revient exactement sur elle-même.
    const pts = [0, 1, 2, 3, 4, 5].map((k) => {
      const a = ph * (TAU / 6) + (k * TAU) / 6;
      return [Math.cos(a) * R * 1.5, Math.sin(a) * R * 1.5 * S];
    });
    band(p, 0, 0, R * 1.5, S, 1, 0.7, ramp);
    for (const [a, b] of [[0, 2], [2, 4], [4, 0], [1, 3], [3, 5], [5, 1]]) p.line(pts[a][0], pts[a][1], pts[b][0], pts[b][1], C[4], 0.8);
    p.glowLine(0, 0, 0, -24, 7, C[4], 0.16);
  }
  const count = o.rank === 1 ? 3 : o.rank === 2 ? 5 : 8;
  cycle(t, meta.duration, count, o.seed, (g) => g.range(0.9, 1.5), (age, L, r) => {
    const a = r.range(0, TAU), q = age / L, d = r.range(5, 7 + o.rank * 2);
    const x = Math.cos(a) * d + Math.sin(age * 4 + a) * 1.2, y = Math.sin(a) * d * S - q * (14 + o.rank * 4);
    p.dot(x, y, q < 0.5 ? C[5] : C[4], 1 - q);
    if (q < 0.2 && o.rank >= 2) sparkle(p, x, y, 1.6, C[6], C[5], 0.2);
  });
}
