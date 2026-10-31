// Le tracé, l'encrage et le scintillement reprennent `fx/lightning` : seule la forme change, plus grosse et anguleuse.
import { Lights, P, Particles, Rng, clamp, ease, fit, hex, rand, smooth, TAU, WHITE } from "../../core/index.js";
import { scorch, stroke } from "../lightning/_lib.js";

export const meta = {
  name: "Sanguine judgement bolt",
  desc: "A fat angular bolt seen from above: black-inked, gold-bodied with a white core, it slams into the ground, flickers twice, splits the floor in a star of hot cracks and throws a ring of sparks.",
  tags: ["sanguine", "lightning", "strike", "holy", "top-down", "one-shot"],
  size: [240, 320],
  origin: [120, 240],
  duration: 0.62,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#1c0f06", "#3a2412", "#08060c", "#c97f1c", "#ffe85c", "#f6c63e", "#fff9dc", "#ffffff"],
    halo: "#5a7cff", height: 186, swing: 26, reach: 30, thick: 2.6, forks: 0, seed: 5,
  },
};

const SQUASH = 0.62;
const FLICKER = [1, 0.8, 0.35, 1, 0.65, 0.9, 0.3, 0.6];
const BOLT_END = FLICKER.length / 30;
const SOOT = hex("#14101c");

/** Un trait anguleux : de grands zigzags francs, plus serrés à mesure qu'il approche du sol. */
function trunk(R, height, swing, x0 = 0) {
  const steps = 7, pts = [[x0 + R.range(-swing, swing) * 0.6, -height]];
  let side = R.chance(0.5) ? 1 : -1;
  for (let i = 1; i < steps; i++) {
    const u = i / steps;
    pts.push([x0 * (1 - u) + side * R.range(0.55, 1) * swing * (1 - u * 0.65), -height * (1 - u) + R.range(-6, 6)]);
    side = -side;
  }
  pts.push([0, 0]);
  return pts;
}

/** Une fourche part d'un coude et frappe le sol à côté. */
function fork(R, pts, reach, side) {
  const from = pts[R.int(3, 4)];
  const x = side * reach * R.range(1.2, 1.7), y = reach * R.range(-0.2, 0.3) * SQUASH;
  const at = (u, swing) => [from[0] + (x - from[0]) * u + side * swing, from[1] + (y - from[1]) * u];
  return [from, at(0.3, 9), at(0.55, -7), at(0.8, 6), [x, y]];
}

/** Du haut vers le bas, de plus en plus épais : l'éclair naît fin dans le ciel et frappe gras. */
function ink(p, pts, k, C, thick, hero, core) {
  const n = pts.length - 1;
  const parts = [[0, 2, 0.45], [2, 4, 0.75], [4, n, 1]];
  for (const [a, b, s] of parts)
    stroke(p, { paths: [{ pts: pts.slice(a, b + 1), w: 1 }] }, k, C, thick * s, { hero, core: core * s, light: 0.3, minY: -170 });
}

function cracksOf(R, reach) {
  const out = [];
  const grow = (x, y, a, len, w, d, depth) => {
    const pts = [[x, y, d]];
    for (let s = 0; s < len; s += 2) {
      a += R.range(-0.4, 0.4);
      x += Math.cos(a) * 2;
      y += Math.sin(a) * 2 * SQUASH;
      d += 2;
      pts.push([x, y, d]);
      if (depth < 1 && s > 4 && R.chance(0.16)) grow(x, y, a + R.sign() * R.range(0.5, 1), (len - s) * 0.6, 0.6, d, depth + 1);
    }
    out.push({ pts, w });
  };
  for (let i = 0; i < 7; i++) grow(0, 0, (i / 7) * TAU + R.range(-0.25, 0.25), reach * R.range(0.75, 1.15), 1, 0, 0);
  return out;
}

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), halo = hex(o.halo), reach = o.reach;
  const A = trunk(R, o.height, o.swing), B = trunk(R, o.height, o.swing * 0.8, A[0][0] * 0.5);
  const side = Array.from({ length: o.forks }, (_, i) => fork(R, A, reach, i % 2 ? 1 : -1));
  const cracks = cracksOf(R, reach);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[4]], yaw: (r) => r.range(0, TAU) });
  const lights = new Lights();
  lights.add(0, -4, reach * 1.9, C[4], 0.6, 0.16);
  lights.add(0, -2, reach, WHITE, 0.7, 0.08);
  for (let i = 0; i < 26; i++) ps.spawn(P.SPARK, R.range(-2, 2), -2, R.range(70, 210), R.range(-130, -30), R.range(0.18, 0.42));
  for (let i = 0; i < 8; i++) ps.spawn(P.STAR, 0, -3, R.range(30, 90), R.range(-80, -20), R.range(0.2, 0.34), C[5], R.range(0.6, 1.3));
  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      const heat = 1 - clamp(t / 0.42), fade = 1 - smooth(0.4, 0.62, t), front = reach * 1.15 * ease.outExpo(clamp(t / 0.12));
      scorch(p, 0, 0, reach * 0.42, heat, fade, reach * 0.42 * SQUASH);
      for (const br of cracks)
        for (const [x, y, d] of br.pts) {
          if (d > front) break;
          const q = d / (reach * 1.15), hot = heat - q * 0.45;
          p.dot(x, y + 1, SOOT, fade);
          p.dot(x, y, hot > 0.55 ? WHITE : hot > 0.35 ? C[5] : hot > 0.12 ? C[3] : SOOT, fade);
          if (hot > 0.35 && (Math.round(d) & 7) === 0) p.glow(x, y, 7, C[4], 0.3 * hot);
        }
      ps.draw(p, "back");
    },
    draw(p) {
      const i = Math.floor(t * 30 + 1e-4), k = FLICKER[i] ?? 0;
      if (t < BOLT_END && k > 0) {
        const pts = i < 3 ? A : B, hero = i === 0 || i === 3;
        // Un halo froid, juste derrière l'encre : c'est lui qui détache l'or d'un sol sombre.
        for (let s = 0; s < pts.length - 1; s++) p.glowLine(pts[s][0], pts[s][1], pts[s + 1][0], pts[s + 1][1], 14, halo, 0.16 * k);
        for (const f of side) stroke(p, { paths: [{ pts: f, w: 1 }] }, k, C, o.thick * 0.55, { hero, light: 0.25, minY: -170 });
        ink(p, pts, k, C, o.thick, hero, k > 0.6 ? o.thick * 0.55 : 0);
      }
      // Le point de frappe : un éclat à quatre branches, très bref.
      if (t < 0.13) {
        const s = (1 - t / 0.13) * reach * 1.1;
        p.line(-s, -3, s, -3, WHITE);
        p.line(0, -3 - s * 0.7, 0, -3 + s * 0.7, WHITE);
        p.circle(0, -3, 3 + 6 * (1 - t / 0.13), WHITE);
      }
      // L'onde au sol : aplatie comme tout ce qui court sur le terrain.
      const u = ease.outQuart(clamp(t / 0.3)), r = reach * (0.3 + u), ring = t < 0.3 ? (t < 0.12 ? WHITE : t < 0.2 ? C[5] : C[3]) : 0;
      if (ring)
        for (let a = 0; a < TAU; a += 2.2 / r) {
          if (t > 0.18 && rand(Math.round(a * 20), 3) < (t - 0.18) * 6) continue;
          p.px(Math.cos(a) * r, Math.sin(a) * r * SQUASH, ring);
          if (t < 0.16) p.px(Math.cos(a) * r, Math.sin(a) * r * SQUASH + 1, C[3]);
        }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
