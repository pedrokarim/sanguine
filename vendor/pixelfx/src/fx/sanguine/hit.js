// Recette de l'étincelle à deux tons adaptée de l'impact open source de Sprite Fusion
// (https://www.spritefusion.com/pixel-art-vfx/impact), licence MIT, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, fit, GROUND_SQUASH, WHITE } from "../../core/index.js";

export const meta = {
  name: "Sanguine hit",
  desc: "The everyday hit, sized for a 13 px enemy seen from above: a lopsided cross along the blow, then sparks thrown across the ground in the direction of the knockback.",
  tags: ["sanguine", "impact", "hit", "top-down", "directional", "one-shot"],
  size: [76, 60],
  origin: [38, 40],
  duration: 0.28,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffe26b", "#fff3c4", "#ffffff"], height: 6, aim: 0, seed: 4 },
};

// Une branche de la croix : grasse à la racine, un cheveu à la pointe, le blanc refroidit vers l'extérieur.
function ray(p, x, y, a, L, w, C, from = 0) {
  const c = Math.cos(a), s = Math.sin(a);
  for (let d = from * L; d <= L; d += 0.5) {
    const u = d / L, hw = w * Math.pow(1 - u, 1.6);
    p.px(x + c * d, y + s * d, u < 0.3 ? WHITE : u < 0.62 ? C[5] : u < 0.88 ? C[4] : C[3]);
    if (hw > 0.45) for (let o = 0.5; o <= hw; o += 0.5) for (const e of [-o, o]) p.px(x + c * d - s * e, y + s * d + c * e, C[4]);
  }
}

function diamond(p, x, y, r, C) {
  for (let dy = -r - 1; dy <= r + 1; dy++)
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const m = Math.abs(dx) + Math.abs(dy);
      if (m <= r) p.px(x + dx, y + dy, WHITE);
      else if (m === r + 1) p.px(x + dx, y + dy, C[3]);
    }
}

export function create(o) {
  const C = fit(o.palette, 7), R = new Rng(o.seed), Y = -o.height, aim = o.aim;
  // L'angle du coup est au sol : à l'écran, son axe se lit écrasé.
  const A = Math.atan2(Math.sin(aim) * GROUND_SQUASH, Math.cos(aim));
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [C[6], C[5], C[4], C[2]], yaw: (r) => aim + r.range(-0.75, 0.75) });
  const lights = new Lights();
  const tilt = R.range(-0.1, 0.1);
  const rays = [
    { a: A + tilt, L: R.range(13, 16), w: 1.3 },
    { a: A + Math.PI + tilt, L: R.range(3, 5), w: 1.3 },
    { a: A - Math.PI / 2 + tilt, L: R.range(6, 8), w: 1.5 },
    { a: A + Math.PI / 2 + tilt, L: R.range(4, 6), w: 1.3 },
  ];

  lights.add(0, Y, 15, C[4], 0.3, 0.14);
  lights.add(0, -1, 10, C[3], 0.16, 0.16);
  for (let i = 0; i < 6; i++) ps.spawn(P.SPARK, 1, Y, R.range(60, 150), R.range(-55, -15), R.range(0.14, 0.26), WHITE);
  for (let i = 0; i < 3; i++) ps.spawn(P.GRIT, 1, Y, R.range(25, 70), R.range(-60, -25), R.range(0.2, 0.26), R.pick([C[5], C[4], C[3]]));

  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      ps.draw(p);
      if (t < 0.034) {
        for (const r of rays) ray(p, 0, Y, r.a, r.L, r.w, C);
        diamond(p, 0, Y, 2, C);
      } else if (t < 0.067) {
        for (const r of rays) ray(p, 0, Y, r.a, r.L * 1.2, r.w * 0.55, C, 0.12);
        diamond(p, 0, Y, 1, C);
      } else if (t < 0.1) {
        ray(p, 0, Y, rays[0].a, rays[0].L * 1.3, 0.5, [C[0], C[1], C[2], C[3], C[3], C[4]], 0.4);
      }
      const pop = Math.exp(-t / 0.04);
      if (pop > 0.02) {
        p.glow(0, Y, 10, C[4], 0.3 * pop);
        p.glow(0, Y, 4, WHITE, 0.14 * pop);
      }
      lights.draw(p);
    },
  };
}
