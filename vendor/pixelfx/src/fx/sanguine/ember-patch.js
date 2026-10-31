// Les flammes en couches emboîtées suivent le feu open source de Sprite Fusion
// (https://www.spritefusion.com/pixel-art-vfx/fire), licence MIT, Copyright (c) 2026 Hugo Duprez.
import { cycle, fit, noise2, GROUND_SQUASH, TAU } from "../../core/index.js";

export const meta = {
  name: "Sanguine ember patch",
  desc: "A patch of burning coals seen from above: a dark crust split by glowing veins, small flames licking up all over it, sparks rising.",
  tags: ["sanguine", "fire", "zone", "ground", "top-down", "loop"],
  size: [112, 96],
  origin: [56, 56],
  duration: 2,
  loop: true,
  fps: 12,
  bg: "ground",
  options: { palette: ["#160806", "#3a120c", "#7a1c12", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#fff3a6"], reach: 40, seed: 12 },
};

const D = 2;
const S = GROUND_SQUASH;

function flame(p, C, x, y, h, w, k) {
  // Trois couches, de la plus large à la plus chaude, comme les langues de feu de la lib.
  for (const [ws, hs, c] of [[1, 1, C[3]], [0.72, 0.8, C[5]], [0.4, 0.5, C[7]]]) {
    const H = h * hs;
    for (let d = 0; d <= H; d += 0.5) {
      const u = d / H, hw = w * ws * Math.sqrt(1 - u) * (u < 0.18 ? 0.7 + u * 1.6 : 1);
      p.dot(x - hw, y - d, c, k);
      p.dot(x + hw, y - d, c, k);
      for (let e = -hw; e < hw; e += 0.5) p.dot(x + e, y - d, c, k);
    }
  }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), R = o.reach, seed = o.seed;
  // La croûte : des veines de braise qui respirent, le bord tramé pour ne pas dessiner un disque.
  p.shade(-R, -R * S, R, R * S, (x, y, out) => {
    const q = Math.hypot(x, y / S) / R;
    if (q > 1) return;
    const vein = Math.abs(noise2(x * 0.11, y * 0.17, seed) - 0.5) * 2, beat = 0.5 + 0.5 * Math.sin((t / D) * TAU + noise2(x * 0.05, y * 0.05, seed + 3) * 9);
    out.c = vein < 0.1 ? (beat > 0.5 ? C[6] : C[5]) : vein < 0.2 ? C[4] : vein < 0.36 ? C[2] : C[1];
    out.a = q < 0.72 ? 1 : (1 - q) / 0.28;
  });
  p.glow(0, 0, R * 1.2, C[4], 0.2 + 0.05 * Math.sin((t / D) * TAU));

  // Du fond vers l'avant : le tri par profondeur garde les flammes proches devant.
  const flames = [];
  cycle(t, D, 14, seed, (g) => g.range(0.5, 1), (age, L, r) => {
    const a = r.range(0, TAU), q = Math.sqrt(r.next()) * 0.86, k = age / L;
    flames.push({ x: Math.cos(a) * q * R, y: Math.sin(a) * q * R * S, h: r.range(9, 18) * Math.sin(Math.PI * k), w: r.range(1.6, 3), k: Math.min(1, (1 - k) * 3) });
  });
  flames.sort((a, b) => a.y - b.y);
  for (const f of flames) {
    flame(p, C, f.x, f.y, f.h, f.w, f.k);
    p.glow(f.x, f.y - f.h * 0.4, 7, C[5], 0.16 * f.k);
  }

  cycle(t, D, 10, seed + 5, (g) => g.range(0.6, 1.1), (age, L, r) => {
    const a = r.range(0, TAU), q = r.next() * 0.8, k = 1 - age / L;
    p.px(Math.cos(a) * q * R + Math.sin(age * 7 + r.next() * 9) * 2, Math.sin(a) * q * R * S - age * 34, k > 0.5 ? C[7] : C[6]);
  });
}
