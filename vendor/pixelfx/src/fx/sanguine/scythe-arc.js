// La recette du croissant vient de `melee/scythe-reap`, elle-même adaptée du slash open source de Sprite Fusion
// (https://www.spritefusion.com/pixel-art-vfx), licence MIT, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, PF, Rng, fit, sparkle, clamp, smooth, ease, rand, GROUND_SQUASH } from "../../core/index.js";
import { swing, onSwing, travel, smear, glowAlong } from "../melee/_lib.js";

export const meta = {
  name: "Sanguine scythe arc",
  desc: "The scythe from above: a dark crescent with a pale edge sweeps flat around the wielder, then tears into cold vapour. span 6.28 closes it into a ring.",
  tags: ["sanguine", "melee", "scythe", "top-down", "directional", "one-shot"],
  size: [120, 100],
  origin: [60, 56],
  duration: 0.54,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#07040c", "#141026", "#26233c", "#433f5c", "#6b7a92", "#a8c5d6", "#e4f4fa", "#ffffff"],
    reach: 44, width: 12, span: 2.3, aim: 0, height: 8, seed: 13,
  },
};

const SWEEP = 0.2, HANG = 0.02, TEAR = 0.18;
const T1 = SWEEP, T2 = T1 + HANG, T3 = T2 + TEAR;
const head = (t) => ease.outSine(clamp(t / SWEEP));

export function create(o) {
  const C = fit(o.palette, 8), Rg = new Rng(o.seed), ps = new Particles({ rng: Rg, ground: () => 0, haze: C[5] }), lights = new Lights();
  const A = swing({ cx: 0, cy: -o.height, R: o.reach, sy: GROUND_SQUASH, k: 0.08, a0: o.aim - o.span / 2, dir: 1, span: o.span });
  const W = o.width;
  let t = 0, lastTear = 0;
  const tear = () => smooth(T2, T3, t);
  return {
    update(dt) {
      t += dt;
      if (t < T1 && Rg.chance(0.6)) {
        const tr = travel(A, A.span * head(t) * Rg.range(0.75, 1));
        ps.spawn(P.VAPOUR, tr.x, tr.y, tr.dx * 16, -Rg.range(3, 9), Rg.range(0.16, 0.3), C[6], Rg.range(1, 2), 0, Math.sin(tr.a) < 0 ? PF.BACK : 0);
      }
      // En se déchirant, la lame part en vapeur là où elle se défait.
      const k = tear();
      for (let u = lastTear; u < k * 1.15; u += 0.05) {
        const tr = travel({ ...A, R: A.R - Rg.range(0, W * 0.5) }, Math.min(1, u) * A.span), far = Math.sin(tr.a) < 0;
        if (Rg.chance(0.5)) ps.spawn(P.VAPOUR, tr.x, tr.y, Rg.range(-8, 8), -Rg.range(5, 14), Rg.range(0.1, 0.14), Rg.chance(0.5) ? C[5] : C[4], Rg.range(1.2, 2.4), 0, far ? PF.BACK : 0);
        if (Rg.chance(0.18)) ps.spawn(P.STAR, tr.x, tr.y, 0, -6, Rg.range(0.08, 0.13), C[6], 0.7, 0, far ? PF.BACK : 0);
      }
      lastTear = Math.max(lastTear, k * 1.15);
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      this.blade(p, -1);
      ps.draw(p, "back");
    },
    draw(p) {
      this.blade(p, 1);
      const g = t - T1 + 0.03;
      if (g > 0 && g < 0.14) {
        const [x, y] = onSwing(A, A.R - 2, A.span);
        sparkle(p, x, y, 6 * ease.outBack(Math.min(1, g / 0.05)) * (1 - g / 0.14), C[6], C[5], 0.5);
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
    blade(p, half) {
      const U = A.span * head(t), k = tear();
      if (U < 0.02 || k >= 1) return;
      const ramp = half < 0 ? [C[0], C[0], C[1], C[2], C[3], C[4], C[5], C[6]] : C;
      smear(p, A, 0, U, W, (u, r, out) => {
        const v = u / U, w = W * Math.pow(Math.sin(Math.PI * Math.pow(v, 1.7)), 0.55);
        if (w < 0.5) return;
        const q = (A.R - r) / w;
        if (q < 0 || q > 1) return;
        const n = rand(Math.floor(u * 40), Math.floor(r), 7);
        if (k > 0 && u / A.span < k * 1.2 - n * 0.2) return;
        const ci = q < 0.1 ? 7 : q < 0.2 ? 6 : q < 0.32 ? 5 : q < 0.5 ? 4 : q < 0.72 ? 3 : 2;
        out.c = ramp[t > T1 && q < 0.2 ? ci - 1 : ci];
        out.a = Math.min(1, v / 0.25);
      }, half);
      glowAlong(p, A, A.R - 1, Math.max(0, k * 1.2 * A.span - 0.3), U, 8, C[5], (u) => 0.26 * (u / U), half, 0.3);
    },
  };
}
