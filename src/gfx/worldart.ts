import { Rng } from '../core/rng';
import { TAU } from '../core/math';
import { shade } from './palette';
import { glow, material, Sculpt, tone } from './sculpt';
import type { Material } from './sculpt';

/**
 * Décor sculpté : arbres, cailloux et structures. Les bâtiments sont peints, voir `castle.ts`.
 *
 * Mêmes volumes et même lumière que les créatures. C'est ce qui fait qu'un arbre et une goule
 * ont l'air d'appartenir au même monde : la lumière vient du même côté, et l'ombre y glisse vers
 * le même violet.
 *
 * Les silhouettes restent celles du jeu, triables en niveaux de gris : le pin étroit et étagé,
 * le chêne large et bas, le saule penché et retombant, le calciné nu et fendu.
 */

/** Le décor défile avec le monde : presque pas de trame. Voir `Sculpt.render`. */
const DECOR_DITHER = 0.2;

export type TreeForm = 'pine' | 'oak' | 'willow' | 'burnt';

const wood = (base: string): Material => material([shade(base, -0.35), base, shade(base, 0.25)], { rough: 0.9 });

/** Masse de feuillage : des boules bosselées, jamais une seule ellipse lisse. */
function foliage(s: Sculpt, rng: Rng, x: number, y: number, rx: number, ry: number, z: number, n: number, r: number, m: Material): void {
  for (let k = 0; k < n; k++) {
    const a = rng.range(0, TAU), q = Math.sqrt(rng.next());
    s.sphere(x + Math.cos(a) * q * rx, y + Math.sin(a) * q * ry, z + rng.range(-3, 3), r * rng.range(0.7, 1.2), m);
  }
}

export function sculptTree(form: TreeForm, w: number, h: number, leaf: string, seed: number, scale: number): HTMLCanvasElement {
  const s = new Sculpt(w, h);
  const rng = new Rng(seed);
  const cx = w / 2, foot = h - 2;
  const bark = wood(form === 'burnt' ? '#2c2422' : '#4a3626');
  const crown = material([shade(leaf, -0.42), leaf, shade(leaf, 0.34)], { rough: 1 });

  const trunk = (top: number, lean: number, r: number): [number, number] => {
    const tx = cx + lean, ty = foot - top;
    s.bone(cx, foot, 0, r, cx + lean * 0.3, foot - top * 0.5, 0, r * 0.72, bark);
    s.bone(cx + lean * 0.3, foot - top * 0.5, 0, r * 0.72, tx, ty, 0, r * 0.45, bark);
    // Racines : elles posent l'arbre au sol.
    for (const k of [-1, 1]) s.bone(cx, foot - 2, 1, r * 0.6, cx + k * r * 2, foot, 2, 0.5, bark);
    return [tx, ty];
  };

  switch (form) {
    case 'pine': {
      const [tx, ty] = trunk(h * 0.9, rng.range(-1.5, 1.5), 2.4 * scale);
      const tiers = 6;
      for (let e = 0; e < tiers; e++) {
        const q = e / (tiers - 1);
        const y = ty + h * 0.05 + q * h * 0.66;
        const half = w * 0.46 * (0.26 + q * 0.74);
        // Un étage de branches qui retombent : plein au centre, dentelé aux bouts.
        const n = Math.round(10 + q * 12);
        for (let k = 0; k < n; k++) {
          const u = (k / (n - 1)) * 2 - 1;
          const bx = tx + u * half, by = y + Math.abs(u) * h * 0.08 + rng.range(-1, 1);
          s.bone(tx + u * half * 0.2, y - h * 0.04, 2 - Math.abs(u) * 3, 2.6 * scale, bx, by, 2 - Math.abs(u) * 3, 1.1 * scale, crown);
        }
      }
      break;
    }
    case 'oak': {
      const [tx, ty] = trunk(h * 0.5, rng.range(-3, 3), 3.4 * scale);
      for (const k of [-1, 1]) s.bone(tx, ty + h * 0.08, 1, 2 * scale, tx + k * w * 0.28, ty - h * 0.06, 1, 0.9, bark);
      const under = material([shade(leaf, -0.6), shade(leaf, -0.34), shade(leaf, -0.1)], { rough: 1 });
      foliage(s, rng, tx, ty + h * 0.02, w * 0.36, h * 0.13, -2, 22, 5 * scale, under);
      foliage(s, rng, tx - w * 0.2, ty - h * 0.08, w * 0.17, h * 0.1, 2, 12, 5.5 * scale, crown);
      foliage(s, rng, tx + w * 0.2, ty - h * 0.06, w * 0.17, h * 0.1, 2, 12, 5.5 * scale, crown);
      foliage(s, rng, tx, ty - h * 0.2, w * 0.2, h * 0.11, 3, 14, 6 * scale, crown);
      break;
    }
    case 'willow': {
      const lean = rng.next() < 0.5 ? -w * 0.14 : w * 0.14;
      const [tx, ty] = trunk(h * 0.5, lean, 3 * scale);
      foliage(s, rng, tx, ty, w * 0.3, h * 0.1, 1, 16, 4.5 * scale, crown);
      // Les rideaux : des brins de longueurs inégales, chacun un os fin qui ondule.
      const n = Math.round(13 * scale) + 5;
      for (let i = 0; i < n; i++) {
        const u = (i / (n - 1) - 0.5) * 2, x = tx + u * w * 0.4;
        const len = h * rng.range(0.28, 0.5), ph = rng.range(0, TAU);
        let px = x, py = ty - rng.range(0, h * 0.06);
        const z = 3 - Math.abs(u) * 3 + rng.range(-1, 1);
        for (let k = 1; k <= 5; k++) {
          const nx = x + Math.sin(ph + k * 0.8) * 1.4, ny = py + len / 5;
          s.bone(px, py, z, 1.1 * scale, nx, ny, z, 0.8 * scale, crown);
          px = nx; py = ny;
        }
      }
      break;
    }
    case 'burnt': {
      const [tx] = trunk(h * 0.84, rng.range(-3, 3), 2.8 * scale);
      for (let k = 0; k < 5; k++) {
        const q = 0.28 + k * 0.14, y = foot - h * 0.84 * q, dir = k % 2 ? 1 : -1;
        const len = w * rng.range(0.2, 0.38), ex = tx + dir * len, ey = y - h * 0.13;
        s.bone(tx, y, 1, 1.5 * scale, ex, ey, 1, 0.5, bark);
        s.bone(ex - dir * len * 0.4, y - h * 0.07, 1, 0.8, ex - dir * len * 0.1, ey - h * 0.1, 1, 0.3, bark);
      }
      // Le cœur encore rouge dans la fente du bois.
      const ember = glow('#c9281f');
      for (let k = 0; k < 7; k++) s.dot(cx + rng.range(-1, 1), foot - 4 - k * h * 0.05, ember);
      break;
    }
  }
  return s.render(true, DECOR_DITHER);
}

export type PropForm = 'rock' | 'grave' | 'reed' | 'stump' | 'bone';

export function sculptProp(form: PropForm, detail: string, seed: number): HTMLCanvasElement {
  const s = new Sculpt(18, 20);
  const rng = new Rng(seed);
  const stone = material([shade(detail, -0.3), detail, shade(detail, 0.34)], { rough: 0.9 });
  const moss = tone('#3a4f2c', { rough: 1 });
  const ivory = material(['#6b6058', '#a89c8a', '#d8cfbc'], { gloss: 0.4 });
  switch (form) {
    case 'rock':
      s.ball(9, 14, 0, 5 + rng.range(0, 2), 3.8 + rng.range(0, 1), 5, stone);
      s.ball(5.5, 15.5, 2, 2.6, 2, 2.4, stone);
      s.decal(10, 11.5, 2.4, 1, moss);
      break;
    case 'grave': {
      const tilt = rng.range(-1.2, 1.2);
      s.block(4.5 + tilt, 7, 9, 12, 0, 2.4, stone, 1.4);
      s.ball(9 + tilt, 7.5, 1.2, 4.5, 3, 2, stone);
      s.stroke(9 + tilt, 8, 9 + tilt, 14, 0.5, material(['#0c0a12', '#16121e', '#232b40']));
      s.stroke(7 + tilt, 10, 11 + tilt, 10, 0.5, material(['#0c0a12', '#16121e', '#232b40']));
      s.decal(6 + tilt, 17, 3, 1.6, moss);
      break;
    }
    case 'reed': {
      const stem = tone('#4a5c34', { rough: 0.3 });
      const head = tone('#6b4a2a', { rough: 0.3 });
      for (let i = 0; i < 7; i++) {
        const bx = 3 + rng.range(0, 12), tall = 7 + rng.range(0, 7), lean = rng.range(-2, 2);
        s.bone(bx, 19, i, 0.6, bx + lean, 19 - tall, i, 0.4, stem);
        if (i % 2) s.ball(bx + lean, 18 - tall, i, 0.9, 1.6, 0.9, head);
      }
      break;
    }
    case 'stump': {
      const bark = wood('#3a2a20');
      s.bone(9, 18, 0, 4.2, 9, 11, 0, 3.4, bark);
      s.ball(9, 10, 2, 3.5, 1.7, 3, material(['#54403a', '#8a6a4a', '#b89468'], { rough: 0.4 }));
      s.bone(9, 12, 1, 1, 14, 6, 1, 0.4, bark);
      s.bone(8, 13, 1, 0.9, 4, 8, 1, 0.4, bark);
      s.decal(6, 16, 2.4, 1.6, moss);
      break;
    }
    case 'bone':
      s.bone(4, 16, 1, 0.9, 13, 17, 1, 0.9, ivory);
      s.bone(5, 18, 2, 0.8, 11, 15, 2, 0.8, ivory);
      s.ball(7, 13, 3, 2.8, 2.5, 2.4, ivory);
      s.decal(6, 13, 0.8, 0.8, material(['#0c0a12', '#16121e', '#232b40']));
      s.decal(8.4, 13, 0.8, 0.8, material(['#0c0a12', '#16121e', '#232b40']));
      break;
  }
  return s.render(true, DECOR_DITHER);
}
