import { PI, TAU } from '../core/math';
import { shade } from './palette';
import { glow, material, Sculpt, tone } from './sculpt';
import type { Material } from './sculpt';
import type { BodyArt } from './sprites';

/**
 * Corps sculptés.
 *
 * Chaque plan pose des volumes (voir `sculpt.ts`) en proportions de sa grille : un boss est un
 * plan plus grand et plus détaillé, jamais un sprite agrandi. Le paramètre `t`, de 0 à 1, boucle
 * sur le cycle de marche.
 *
 * `z` s'écrit en pixels autour de 0 : positif vers le spectateur, ce qui fait passer naturellement
 * un bras devant le torse ou une patte derrière le corps, sans ordre de dessin à tenir.
 *
 * Le mouvement suit la règle du héros : tout se déplace par pixels entiers, pièce rigide par pièce
 * rigide (`Sculpt.piece`), et un plan décrit des appuis, pas une oscillation. Un pied quitte le sol
 * puis y revient, l'autre le porte pendant ce temps, et le tronc monte, descend et se déporte sur
 * la jambe qui le tient. Écarter et resserrer les jambes en miroir, comme le faisaient ces plans,
 * donne un pantin qui saute sur place : aucun pied n'y porte jamais rien.
 */

type Plan = (s: Sculpt, a: BodyArt, t: number) => void;

const wave = (t: number, phase = 0): number => Math.sin((t + phase) * TAU);
const body = (a: BodyArt, rough = 0.25): Material => material(a.cols, { rough });
const bone = material(['#6b6058', '#a89c8a', '#d8cfbc'], { gloss: 0.4 });
const iron = material(['#22262f', '#465064', '#8c98ac'], { gloss: 1 });
const leather = material(['#20161a', '#3a2826', '#54403a'], { rough: 0.2 });
const hollow = material(['#050408', '#0c0a12', '#16121e']);

/** Yeux : deux pixels francs, seule lumière propre de la plupart des créatures. */
function eyes(s: Sculpt, x: number, y: number, gap: number, color: string, big = false): void {
  const m = glow(color);
  for (const k of [-1, 1]) {
    s.dot(x + k * gap, y, m);
    if (big) s.dot(x + k * gap, y - 1, m);
  }
}

/** Couronne de pointes dorées, marque des boss. */
function crown(s: Sculpt, x: number, y: number, r: number, m: Material): void {
  s.ball(x, y, 2, r, r * 0.3, r * 0.5, m);
  for (const k of [-1, 0, 1]) s.bone(x + k * r * 0.7, y, 2, r * 0.18, x + k * r * 0.8, y - r * 0.6, 3, 0.4, m);
}

// ---------------------------------------------------------------------- allures

/** Une image de marche, toute en pixels entiers. */
interface Step {
  /** Hauteur de chaque pied au-dessus du sol. */
  left: number;
  right: number;
  /** Décalage du tronc : `x` le porte sur la jambe d'appui, `y` négatif le soulève. */
  x: number;
  y: number;
  /** Retard de la tête sur le tronc, ajouté à celui-ci. */
  head: number;
  /** Balancier des bras, à contretemps des jambes. */
  armLeft: number;
  armRight: number;
}

interface StepShape {
  foot: number;
  bob: number;
  sway: number;
  arm: number;
  /** Un corps lourd finit de descendre après le contact et s'écrase d'un pixel sous son poids. */
  heavy?: boolean;
}

/**
 * Marche vue de face. À `t = 0`, les deux pieds sont au sol et le gauche va partir.
 *
 * Le tronc est au plus haut quand il passe au-dessus du pied d'appui et au plus bas au contact.
 */
function march(t: number, shape: StepShape): Step {
  const { foot, bob, sway, arm, heavy } = shape;
  const lag = heavy ? 0.06 : 0;
  const height = (q: number): number => Math.floor(Math.abs(wave(q)) * bob + 0.4);
  const crushed = heavy && Math.abs(wave(t - lag)) < 0.2 ? 1 : 0;
  const y = crushed - height(t - lag);
  return {
    left: Math.round(foot * Math.max(0, wave(t))),
    right: Math.round(foot * Math.max(0, -wave(t))),
    x: Math.round(sway * wave(t)),
    y,
    head: -height(t - lag - 0.1) - (y - crushed),
    armLeft: Math.round(arm * wave(t)),
    armRight: Math.round(-arm * wave(t)),
  };
}

/**
 * Trajet d'une patte vue de profil : au sol, elle recule à vitesse constante pendant `duty` du
 * cycle, c'est-à-dire qu'elle reste plantée pendant que le corps avance ; puis elle revient
 * en l'air.
 */
function paw(q: number, reach: number, lift: number, duty = 0.55): [number, number] {
  const p = q - Math.floor(q);
  if (p < duty) return [Math.round(reach * (1 - (2 * p) / duty)), 0];
  const r = (p - duty) / (1 - duty);
  return [Math.round(reach * (2 * r - 1)), Math.round(lift * Math.sin(r * PI))];
}

// ------------------------------------------------------------------ humanoïdes

function ghoul(s: Sculpt, a: BodyArt, t: number): void {
  const { w, h } = s;
  const cx = w / 2, m = body(a), g = march(t, { foot: 3, bob: 1, sway: 1, arm: 1 });
  const hip = h * 0.6, sh = h * 0.36, foot = h - 2, u = w * 0.1;
  s.piece(0, -g.left, () => s.bone(cx - u * 1.2, hip, -1, u * 0.9, cx - u * 1.5, foot, 1, u * 0.7, m));
  s.piece(0, -g.right, () => s.bone(cx + u * 1.2, hip, -1, u * 0.9, cx + u * 1.5, foot, 1, u * 0.7, m));
  s.piece(g.x, g.y, () => {
    // Le dos voûté : le torse penche en avant, la tête plonge sous les épaules.
    s.bone(cx, hip, 0, u * 1.3, cx, sh, 2, u * 1.9, m);
    for (const k of [-1, 1]) {
      s.piece(0, k < 0 ? g.armLeft : g.armRight, () => {
        const hx = cx + k * u * 2.6;
        s.bone(cx + k * u * 2, sh, 2, u * 0.75, hx, sh + h * 0.34, 5, u * 0.5, m);
        // Griffes pendantes : ce sont elles qui disent « goule » à cette taille.
        s.bone(hx, sh + h * 0.34, 6, 0.6, hx + k, sh + h * 0.42, 7, 0.3, bone);
      });
    }
    s.piece(0, g.head, () => {
      s.sphere(cx, sh + u * 0.9, 4, u * 1.5, m);
      eyes(s, cx, sh + u * 0.8, u * 0.7, a.eye);
      s.dot(cx, sh + u * 1.8, hollow);
    });
  });
}

function skeleton(s: Sculpt, a: BodyArt, t: number): void {
  const { w, h } = s;
  const cx = w / 2, m = material(a.cols, { gloss: 0.5 }), g = march(t, { foot: 3, bob: 1, sway: 1, arm: 1 });
  const hip = h * 0.62, sh = h * 0.36, foot = h - 2, u = w * 0.09;
  // Les os ne se cachent pas sous un torse : le genou plie pour de bon, vers l'extérieur.
  for (const k of [-1, 1]) {
    const up = k < 0 ? g.left : g.right;
    const hx = cx + k * u + g.x, hy = hip + g.y, fx = cx + k * u * 1.2, fy = foot - up;
    const nx = (hx + fx) / 2 + k * up * 0.5, ny = (hy + fy) / 2;
    s.bone(hx, hy, 0, u * 0.5, nx, ny, 1, u * 0.4, m);
    s.bone(nx, ny, 1, u * 0.4, fx, fy, 1, u * 0.4, m);
  }
  s.piece(g.x, g.y, () => {
    for (const k of [-1, 1]) {
      s.piece(0, k < 0 ? g.armLeft : g.armRight, () => {
        s.bone(cx + k * u * 2.2, sh + 1, 1, u * 0.5, cx + k * u * 2.6, sh + h * 0.3, 3, u * 0.35, m);
      });
    }
    // Colonne, bassin et cage : les côtes laissent passer le noir.
    s.bone(cx, hip, 0, u * 0.4, cx, sh, 0, u * 0.4, m);
    s.ball(cx, hip, 1, u * 1.5, u * 0.9, u, m);
    for (let k = 0; k < 4; k++) {
      const y = sh + 1 + k * u * 1.05, r = u * (1.9 - k * 0.22);
      s.ball(cx, y, 2, r, u * 0.36, u, m);
    }
    s.piece(0, g.head, () => {
      const head = h * 0.18;
      s.ball(cx, head, 2, u * 1.9, u * 1.8, u * 1.7, m);
      s.ball(cx, head + u * 1.6, 3, u * 1.1, u * 0.7, u, m);
      s.carve(cx - u * 0.8, head, u * 0.6, u * 0.6);
      s.carve(cx + u * 0.8, head, u * 0.6, u * 0.6);
      s.dot(cx - u * 0.8, head, glow(a.eye), 9);
      s.dot(cx + u * 0.8, head, glow(a.eye), 9);
    });
  });
}

function zombie(s: Sculpt, a: BodyArt, t: number): void {
  const { w, h } = s;
  const cx = w / 2, m = body(a, 0.4), g = march(t, { foot: 3, bob: 1, sway: 2, arm: 1 });
  const rag = material(['#1f1a18', '#3a3028', '#544638'], { rough: 0.5 });
  const hip = h * 0.62, sh = h * 0.34, foot = h - 2, u = w * 0.11;
  // Il boite : la jambe droite ne décolle presque pas, il la traîne, et tout le corps y bascule.
  s.piece(0, -g.left, () => s.bone(cx - u, hip, -1, u, cx - u, foot, 0, u * 0.8, rag));
  s.piece(0, -Math.min(1, g.right), () => s.bone(cx + u, hip, -1, u, cx + u, foot, 0, u * 0.8, rag));
  s.piece(g.x, g.y, () => {
    s.bone(cx, hip, 0, u * 1.6, cx, sh, 1, u * 1.9, rag);
    // Les bras tendus devant : la pose la plus lisible du genre.
    s.piece(0, g.armLeft, () => s.bone(cx - u * 2, sh + 1, 2, u * 0.75, cx - u * 1.6, sh + h * 0.2, 8, u * 0.6, m));
    s.piece(0, g.armRight, () => s.bone(cx + u * 2, sh + 1, 2, u * 0.75, cx + u * 1.6, sh + h * 0.2, 8, u * 0.6, m));
    s.piece(0, g.head, () => {
      const head = h * 0.2;
      s.sphere(cx, head, 3, u * 1.55, m);
      s.ball(cx, head + u, 4, u, u * 0.6, u, m);
      s.dot(cx + u * 0.3, head + u * 0.9, material(['#3d0a16', '#6b1122', '#9c1c33']));
      eyes(s, cx, head, u * 0.65, a.eye);
    });
  });
}

function armored(s: Sculpt, a: BodyArt, t: number): void {
  const { w, h } = s;
  const cx = w / 2, plate = material(a.cols, { gloss: 0.8 }), g = march(t, { foot: 3, bob: 1, sway: 1, arm: 1 });
  const hip = h * 0.6, sh = h * 0.34, foot = h - 2, u = w * 0.1;
  const flame = glow(a.accent ?? a.eye);
  s.piece(0, -g.left, () => s.bone(cx - u, hip, -1, u, cx - u, foot, 0, u * 0.9, plate));
  s.piece(0, -g.right, () => s.bone(cx + u, hip, -1, u, cx + u, foot, 0, u * 0.9, plate));
  s.piece(g.x, g.y, () => {
    s.bone(cx, hip, 0, u * 1.5, cx, sh, 1, u * 2.1, plate);
    for (const k of [-1, 1]) {
      s.sphere(cx + k * u * 2.3, sh, 2, u * 1.15, plate);
      s.piece(0, k < 0 ? g.armLeft : g.armRight, () => {
        s.bone(cx + k * u * 2.4, sh + 1, 2, u * 0.8, cx + k * u * 2.7, sh + h * 0.28, 4, u * 0.7, plate);
      });
    }
    s.piece(0, g.head, () => {
      const head = h * 0.17;
      s.ball(cx, head, 2, u * 1.6, u * 1.7, u * 1.6, plate);
      s.decal(cx, head, u * 1.25, u * 0.42, hollow);
      eyes(s, cx, head, u * 0.65, a.eye);
    });
    // Une flamme sale sort du col : le Damné brûle de l'intérieur.
    for (let k = 0; k < 3; k++) {
      const f = wave(t * 2, k * 0.3) * u * 0.5;
      s.dot(cx - u + k * u + f, sh - u * 0.2 - k % 2, flame, 8);
    }
  });
}

// ----------------------------------------------------------------------- bêtes

function wolf(s: Sculpt, a: BodyArt, t: number): void {
  const { w, h } = s;
  const m = body(a, 0.45), u = h * 0.11;
  const back = h * 0.42, foot = h - 2, hx = w * 0.3, sx = w * 0.68;
  const reach = Math.round(w * 0.17), lift = Math.round(h * 0.2);
  // Galop : le tronc monte quand les quatre pattes sont groupées, et la tête le suit d'un temps.
  const y = -Math.round(Math.abs(wave(t)) * 1.2);
  const nod = -Math.round(Math.abs(wave(t, -0.12)) * 1.2) - y;
  // Pattes : les deux paires à contretemps, les plus lointaines derrière le corps.
  for (const [x, ph, z] of [[hx, 0, -3], [hx + 2, 0.12, 3], [sx, 0.5, -3], [sx - 2, 0.62, 3]] as const) {
    const [dx, up] = paw(t + ph, reach, lift);
    const hipY = back + u + y, footY = foot - up, knee = hipY + (footY - hipY) * 0.55;
    s.bone(x, hipY, z, u * 0.8, x + dx * 0.5, knee, z, u * 0.5, m);
    s.bone(x + dx * 0.5, knee, z, u * 0.5, x + dx, footY, z, u * 0.42, m);
  }
  s.piece(0, y, () => {
    s.bone(hx, back, 0, u * 1.5, sx, back - u * 0.4, 0, u * 1.9, m);
    s.piece(0, -nod, () => s.bone(hx - u, back - u * 0.4, 0, u * 0.8, w * 0.06, back - u * 1.6, 0, u * 0.35, m));
    s.piece(0, nod, () => {
      const nx = w * 0.82, ny = back - u * 1.5;
      s.bone(sx, back - u * 0.6, 1, u * 1.5, nx, ny, 2, u * 1.1, m);
      s.bone(nx, ny, 2, u, nx + u * 2, ny + u * 0.6, 3, u * 0.5, m);
      s.bone(nx - u * 0.6, ny - u * 0.6, 1, u * 0.5, nx - u * 0.8, ny - u * 1.9, 1, 0.3, m);
      s.bone(nx + u * 0.4, ny - u * 0.6, 3, u * 0.5, nx + u * 0.4, ny - u * 1.9, 3, 0.3, m);
      s.dot(nx + u * 0.5, ny - u * 0.1, glow(a.eye));
      s.dot(nx + u * 2.1, ny + u, bone);
    });
  });
}

function spider(s: Sculpt, a: BodyArt, t: number): void {
  const { w, h } = s;
  const cx = w / 2, m = material(a.cols, { gloss: 0.5, rough: 0.2 }), u = h * 0.1;
  const cy = h * 0.46;
  const lift = Math.max(2, Math.round(u * 1.3));
  // Deux appuis par cycle : le corps retombe à chaque pose d'un groupe de pattes.
  const y = -Math.round(Math.abs(wave(t)) * Math.max(1, u * 0.35));
  // Huit pattes articulées : genou haut, pointe au sol, en deux groupes alternés.
  for (let k = 0; k < 4; k++) {
    for (const side of [-1, 1]) {
      const ph = (k + (side > 0 ? 1 : 0)) % 2 ? 0 : 0.5;
      const up = Math.round(Math.max(0, wave(t, ph)) * lift);
      const kx = cx + side * w * (0.2 + 0.14 * Math.cos(k - 1.5));
      const ky = cy - h * 0.2 + k * u * 0.3;
      const fx = cx + side * w * (0.44 + 0.03 * Math.cos(k * 1.3));
      const fy = h - 2 - (3 - k) * u * 0.9;
      const z = (k - 1.5) * u * 1.4;
      // La patte monte d'un bloc : sa racine, sous le corps, ne se voit pas.
      s.piece(0, -up, () => {
        s.bone(cx + side * u, cy + (k - 1.5) * u * 0.5, z - u * 2, u * 0.5, kx, ky, z, u * 0.4, m);
        s.bone(kx, ky, z, u * 0.4, fx, fy, z, u * 0.15, m);
      });
    }
  }
  s.piece(0, y, () => {
    s.ball(cx, cy + u * 1.7, -2, u * 3.1, u * 2.9, u * 3, m);
    if (a.accent) {
      const mark = glow(a.accent);
      for (let k = 0; k < 3; k++) s.dot(cx, cy + u * (1 + k * 0.9), mark);
      s.dot(cx - u, cy + u * 1.9, mark);
      s.dot(cx + u, cy + u * 1.9, mark);
    }
    s.ball(cx, cy - u * 0.9, 3, u * 1.9, u * 1.7, u * 2, m);
    eyes(s, cx, cy - u * 1.3, u * 0.6, a.eye);
    eyes(s, cx, cy - u * 0.7, u, a.eye);
    if (a.crown) crown(s, cx, cy - u * 2.8, u * 1.9, tone(a.accent ?? '#f2c46b', { gloss: 1 }));
  });
}

function rider(s: Sculpt, a: BodyArt, t: number): void {
  const { w, h } = s;
  const horse = body(a, 0.25), u = h * 0.08, foot = h - 2;
  const back = h * 0.52, hx = w * 0.24, sx = w * 0.7;
  const reach = Math.round(w * 0.14), lift = Math.round(h * 0.17);
  const y = -Math.round(Math.abs(wave(t)) * 1.3);
  const nod = -Math.round(Math.abs(wave(t, -0.1)) * 1.3) - y;
  for (const [x, ph, z] of [[hx, 0, -3], [hx + 2, 0.1, 3], [sx, 0.5, -3], [sx - 2, 0.6, 3]] as const) {
    const [dx, up] = paw(t + ph, reach, lift);
    const hipY = back + u + y, footY = foot - up, knee = hipY + (footY - hipY) * 0.6;
    s.bone(x, hipY, z, u, x + dx * 0.6, knee, z, u * 0.5, horse);
    s.bone(x + dx * 0.6, knee, z, u * 0.5, x + dx, footY, z, u * 0.5, horse);
  }
  s.piece(0, y, () => {
    s.bone(hx, back, 0, u * 2, sx, back - u * 0.5, 0, u * 2.2, horse);
    s.piece(0, nod, () => {
      s.bone(sx + u, back - u, 1, u * 1.3, w * 0.86, h * 0.32, 2, u * 0.9, horse);
      s.bone(w * 0.86, h * 0.32, 2, u * 0.9, w * 0.97, h * 0.4, 3, u * 0.5, horse);
      s.dot(w * 0.89, h * 0.31, glow(a.eye));
    });
    s.piece(0, -nod, () => s.bone(hx - u, back - u, 0, u * 0.7, w * 0.05, back, 0, u * 0.3, leather));
    // Le cavalier, penché sur l'encolure, lance basse : il encaisse le galop avec un temps de retard.
    s.piece(0, nod, () => {
      const cloak = material([shade(a.cols[0], -0.3), a.cols[0], a.cols[1]], { rough: 0.3 });
      s.bone(w * 0.48, back - u * 2, 3, u * 1.5, w * 0.54, back - u * 6, 4, u * 1.2, cloak);
      s.sphere(w * 0.58, back - u * 7.6, 5, u * 1.2, cloak);
      eyes(s, w * 0.6, back - u * 7.6, u * 0.4, a.eye);
      s.bone(w * 0.36, back - u * 3.4, 6, u * 0.25, w * 0.98, back - u * 2.2, 7, u * 0.2, tone(a.accent ?? '#f2c46b', { gloss: 1 }));
    });
  });
}

function golem(s: Sculpt, a: BodyArt, t: number): void {
  const { w, h } = s;
  const cx = w / 2, m = body(a, 0.55), u = w * 0.1, foot = h - 2;
  const g = march(t, { foot: 4, bob: 2, sway: 2, arm: 3, heavy: true });
  const stitch = material(['#1a1012', '#3a2a24', '#6b5a48']);
  s.piece(0, -g.left, () => s.bone(cx - u * 1.4, h * 0.66, -1, u * 1.1, cx - u * 1.4, foot, 0, u * 1.2, m));
  s.piece(0, -g.right, () => s.bone(cx + u * 1.4, h * 0.66, -1, u * 1.1, cx + u * 1.4, foot, 0, u * 1.2, m));
  s.piece(g.x, g.y, () => {
    s.ball(cx, h * 0.5, 0, u * 3, u * 2.9, u * 2.6, m);
    s.sphere(cx - u * 1.5, h * 0.34, 2, u * 1.7, m);
    s.sphere(cx + u * 1.6, h * 0.36, 1, u * 1.8, m);
    s.piece(0, g.armLeft, () => s.bone(cx - u * 3, h * 0.4, 2, u * 1.1, cx - u * 3.6, h * 0.74, 4, u * 1.2, m));
    s.piece(0, g.armRight, () => s.bone(cx + u * 3, h * 0.42, 2, u * 1.2, cx + u * 3.6, h * 0.76, 4, u * 1.3, m));
    // Coutures en travers de la chair : ce corps a été assemblé.
    for (let k = 0; k < 7; k++) s.dot(cx - u * 2 + k * u * 0.7, h * 0.5 + (k % 2) * 1.5, stitch);
    for (let k = 0; k < 5; k++) s.dot(cx + u * 0.6, h * 0.34 + k * u * 0.7, stitch);
    s.piece(0, g.head, () => {
      const head = h * 0.2;
      s.sphere(cx, head, 3, u * 1.4, m);
      if (a.horns) for (const k of [-1, 1]) s.bone(cx + k * u, head - u * 0.8, 3, u * 0.4, cx + k * u * 2, head - u * 2, 3, 0.4, bone);
      eyes(s, cx, head, u * 0.6, a.eye);
      s.decal(cx, head + u * 0.8, u * 0.7, u * 0.3, hollow);
    });
  });
}

// ------------------------------------------------------------------------ boss

function knight(s: Sculpt, a: BodyArt, t: number): void {
  const { w, h } = s;
  const cx = w / 2, plate = material(a.cols, { gloss: 1 }), u = w * 0.1, foot = h - 2;
  const g = march(t, { foot: 6, bob: 2, sway: 2, arm: 2, heavy: true });
  const hip = h * 0.6, sh = h * 0.32;
  const tabard = material(['#3d0a16', '#6b1122', '#9c1c33'], { rough: 0.2 });
  const gold = tone('#c9a24a', { gloss: 1 });
  // Le pan de tissu tient aux épaules et traîne derrière le pas.
  s.sheet([[cx - u * 2.4 + g.x, sh + g.y], [cx + u * 2.4 + g.x, sh + g.y], [cx + u * 3.4 - g.x, foot], [cx - u * 3.4 - g.x, foot]], -4, -0.2, tabard);
  for (const k of [-1, 1]) {
    s.piece(0, -(k < 0 ? g.left : g.right), () => {
      s.bone(cx + k * u, hip, -1, u * 1.1, cx + k * u, h * 0.8, 1, u * 0.85, plate);
      s.bone(cx + k * u, h * 0.8, 1, u * 0.85, cx + k * u, foot, 2, u, plate);
      s.sphere(cx + k * u, h * 0.8, 3, u * 0.75, gold);
    });
  }
  s.piece(g.x, g.y, () => {
    s.bone(cx, hip, 0, u * 1.6, cx, sh + u, 2, u * 2.3, plate);
    s.stroke(cx, sh, cx, hip + u, u * 0.62, tabard);
    s.stroke(cx - u * 2, sh + u * 2.6, cx - u * 0.7, sh + u * 2.6, 0.5, gold);
    s.stroke(cx + u * 0.7, sh + u * 2.6, cx + u * 2, sh + u * 2.6, 0.5, gold);
    for (const k of [-1, 1]) {
      s.ball(cx + k * u * 2.7, sh, 2, u * 1.5, u * 1.2, u * 1.4, plate);
      s.dot(cx + k * u * 2.7, sh - u * 0.6, gold);
    }
    s.piece(0, g.armLeft, () => s.bone(cx - u * 2.8, sh + u, 2, u, cx - u * 3.2, sh + h * 0.26, 4, u * 0.9, plate));
    // L'épée à deux mains, plantée devant lui : la seule chose qui brille encore.
    s.piece(0, g.armRight, () => {
      s.bone(cx + u * 2.8, sh + u, 2, u, cx + u * 2.2, sh + h * 0.2, 7, u * 0.9, plate);
      const sx = cx + u * 2, top = sh + u * 0.4;
      s.bone(sx, top, 8, u * 0.45, sx, foot - u * 0.3, 9, u * 0.15, iron);
      s.bone(sx - u, top + h * 0.17, 9, u * 0.25, sx + u, top + h * 0.17, 9, u * 0.25, gold);
    });
    s.piece(0, g.head, () => {
      const head = h * 0.15;
      s.ball(cx, head, 3, u * 1.5, u * 1.7, u * 1.5, plate);
      s.stroke(cx - u * 1.2, head, cx + u * 1.2, head, u * 0.3, hollow);
      s.stroke(cx, head, cx, head + u * 1.3, u * 0.22, hollow);
      eyes(s, cx, head - u * 0.1, u * 0.65, a.eye, true);
      crown(s, cx, head - u * 1.6, u * 1.3, gold);
    });
  });
}

function choir(s: Sculpt, a: BodyArt, t: number): void {
  const { w, h } = s;
  const cx = w / 2, robe = body(a, 0.35), u = w * 0.1, float = Math.round(wave(t) * 2);
  const ember = glow(a.eye), hem = h - 3;
  s.piece(0, float, () => {
    // Une seule robe, trois têtes : la voûte des épaules les porte comme un retable.
    s.ball(cx, h * 0.62, 0, u * 3.5, h * 0.3, u * 2.6, robe);
    for (const [k, lift, z] of [[-1, 0.26, 1], [1, 0.26, 1], [0, 0.13, 4]] as const) {
      const hx = cx + k * u * 2.4, hy = h * lift;
      s.bone(cx + k * u * 1.2, h * 0.42, z - 1, u * 1.2, hx, hy + u * 1.2, z, u * 0.9, robe);
      s.piece(0, Math.round(wave(t, k * 0.2)), () => {
        s.ball(hx, hy, z, u * 1.5, u * 1.8, u * 1.4, robe);
        s.decal(hx, hy + u * 0.3, u * 1, u * 1.25, hollow);
        s.dot(hx - u * 0.4, hy + u * 0.1, ember);
        s.dot(hx + u * 0.4, hy + u * 0.1, ember);
        // Le chant : une bouche de braise qui s'ouvre tour à tour.
        if (wave(t, k * 0.33) > 0) s.decal(hx, hy + u * 0.85, u * 0.34, u * 0.42, glow(a.accent ?? a.eye));
      });
    }
    for (let k = 0; k < 5; k++) s.dot(cx - u * 2 + k * u, h * 0.54 + (k % 2) * u, ember);
  });
  // Le bas de la robe ne suit pas la flottaison d'un bloc : il ondule, pan après pan.
  for (let k = -3; k <= 3; k++) {
    s.piece(0, float + Math.round(wave(t, k * 0.13) * 2), () => {
      s.bone(cx + k * u, h * 0.7, 2, u * 0.8, cx + k * u * 1.15, hem - u * 0.4, 2, u * 0.25, robe);
    });
  }
}

function lord(s: Sculpt, a: BodyArt, t: number): void {
  const { w, h } = s;
  const cx = w / 2, m = material(a.cols, { gloss: 0.3, rough: 0.5 }), foot = h - 2, u = w * 0.09;
  const g = march(t, { foot: 7, bob: 3, sway: 3, arm: 3, heavy: true });
  const hip = h * 0.6, sh = h * 0.3;
  const cuirass = material(['#120a12', '#2c1a22', '#54343a'], { gloss: 0.9, rough: 0.2 });
  const sinew = material(['#14040a', '#2c0812', '#4e0e1c']);
  const cape = material(['#14040a', '#2c0812', '#4e0e1c'], { rough: 0.25 });
  const gold = tone(a.accent ?? '#f2c46b', { gloss: 1 });
  // La cape s'ouvre en ailes : la silhouette la plus large du jeu, à dessein. Elle pend aux
  // épaules, et sa pointe bat avec un temps de retard sur le pas.
  const flap = Math.round(wave(t, -0.1) * u * 0.5), top = sh + g.y, tx = g.x;
  for (const k of [-1, 1]) {
    s.sheet([[cx + k * u * 2 + tx, top], [cx + k * w * 0.5, top + u * 2 + flap], [cx + k * w * 0.46, h * 0.7], [cx + k * w * 0.28, h * 0.62], [cx + k * w * 0.2, foot], [cx, foot - u]], -6, -0.2, cape);
  }
  for (const k of [-1, 1]) {
    s.piece(0, -(k < 0 ? g.left : g.right), () => {
      s.bone(cx + k * u, hip, -1, u * 1.2, cx + k * u, h * 0.8, 1, u * 0.9, cuirass);
      s.bone(cx + k * u, h * 0.8, 1, u * 0.9, cx + k * u, foot, 2, u * 1.05, cuirass);
      s.sphere(cx + k * u, h * 0.8, 3, u * 0.72, bone);
    });
  }
  s.piece(g.x, g.y, () => {
    s.bone(cx, hip, 0, u * 1.5, cx, sh + u * 1.4, 2, u * 2.4, m);
    // Le poitrail est ouvert : côtes d'os sur la chair, le cœur battant derrière.
    s.decal(cx, sh + u * 1.9, u * 1.25, u * 1.5, sinew);
    s.decal(cx, sh + u * 1.8, u * 0.72 + (wave(t * 2) > 0 ? 1 : 0), u * 0.85, glow('#f0405a'));
    for (let r = 0; r < 4; r++) {
      const y = sh + u * (0.8 + r * 0.72);
      for (const k of [-1, 1]) s.stroke(cx + k * u * 0.25, y, cx + k * u * 1.9, y + u * 0.45, 0.6, bone);
    }
    for (let r = 0; r < 3; r++) s.stroke(cx - u * 1.3, hip - u * (0.4 + r * 0.7), cx + u * 1.3, hip - u * (0.4 + r * 0.7), 0.5, sinew);
    s.ball(cx, hip, 3, u * 1.9, u * 0.7, u * 1.5, gold);
    for (const k of [-1, 1]) {
      s.ball(cx + k * u * 2.6, sh + u * 0.2, 2, u * 1.5, u * 1.15, u * 1.4, bone);
      for (let c = -1; c <= 1; c++) s.bone(cx + k * u * (2.6 + c), sh - u * 0.5, 3, u * 0.25, cx + k * u * (2.8 + c * 1.5), sh - u * 1.9, 3, 0.3, bone);
      s.piece(0, k < 0 ? g.armLeft : g.armRight, () => {
        s.bone(cx + k * u * 2.8, sh + u, 2, u, cx + k * u * 3.6, sh + h * 0.3, 5, u * 0.8, m);
        s.bone(cx + k * u * 3.6, sh + h * 0.3, 5, 1, cx + k * u * 4.2, sh + h * 0.37, 6, 0.3, bone);
      });
    }
    s.piece(0, g.head, () => {
      const head = h * 0.15;
      s.ball(cx, head, 3, u * 1.6, u * 1.9, u * 1.5, m);
      for (const k of [-1, 1]) {
        s.bone(cx + k * u, head - u, 3, u * 0.6, cx + k * u * 2.6, head - u * 1.6, 2, u * 0.4, bone);
        s.bone(cx + k * u * 2.6, head - u * 1.6, 2, u * 0.4, cx + k * u * 2.8, head - u * 3, 2, 0.4, bone);
      }
      eyes(s, cx, head, u * 0.7, a.eye, true);
      s.decal(cx, head + u * 1.1, u * 0.85, u * 0.3, hollow);
      for (let k = -2; k <= 2; k++) s.dot(cx + k * u * 0.35, head + u * 1.05, bone);
      crown(s, cx, head - u * 1.5, u * 1.25, gold);
    });
  });
}

function reaper(s: Sculpt, a: BodyArt, t: number): void {
  const { w, h } = s;
  const cx = w / 2, robe = body(a, 0.2), u = w * 0.1, hem = h - 2, float = Math.round(wave(t) * 2);
  s.piece(0, float, () => {
    s.ball(cx, h * 0.6, 0, u * 3, h * 0.36, u * 2.4, robe);
    s.ball(cx, h * 0.24, 3, u * 2, u * 2.3, u * 1.9, robe);
    s.decal(cx, h * 0.26, u * 1.3, u * 1.55, hollow);
    s.decal(cx, h * 0.26, u * 0.82, u * 1, bone);
    s.dot(cx - u * 0.35, h * 0.25, glow(a.eye));
    s.dot(cx + u * 0.35, h * 0.25, glow(a.eye));
    s.stroke(cx - u * 0.5, h * 0.31, cx + u * 0.5, h * 0.31, 0.5, hollow);
    // La faux, tenue d'une main d'os, dépasse largement de la silhouette.
    const hx = cx + u * 2.4, hy = h * 0.5;
    s.bone(cx + u * 2, h * 0.4, 3, u * 0.7, hx, hy, 6, u * 0.5, robe);
    s.sphere(hx, hy, 7, u * 0.5, bone);
    s.bone(hx + u * 1.1, h * 0.08, 7, u * 0.25, hx - u * 0.6, hem - 2, 7, u * 0.25, leather);
    const edge = material(['#3a3a48', '#8a8a9a', '#e8e8f4'], { gloss: 1 });
    // La lame part du haut du manche et revient en arc vers le corps.
    const tx = hx + u * 1.1, ty = h * 0.08;
    for (let k = 0; k <= 16; k++) {
      const q = k / 16;
      s.sphere(tx - q * u * 5.4, ty - Math.sin(q * PI) * u * 1.3 + q * q * u * 2.4, 8, Math.max(0.5, u * 0.55 * (1 - q * q)), edge);
    }
  });
  for (let k = -3; k <= 3; k++) {
    s.piece(0, float + Math.round(wave(t, k * 0.17) * u * 0.5), () => {
      s.bone(cx + k * u * 0.8, h * 0.7, 2, u * 0.7, cx + k * u, hem - u * 0.5, 2, u * 0.2, robe);
    });
  }
}

function colossus(s: Sculpt, a: BodyArt, t: number): void {
  const { w, h } = s;
  const cx = w / 2, m = material(a.cols, { gloss: 0.5, rough: 0.2 }), u = w * 0.09, foot = h - 2;
  const g = march(t, { foot: 6, bob: 2, sway: 2, arm: 4, heavy: true });
  const dead = glow(a.eye);
  for (const k of [-1, 1]) {
    s.piece(0, -(k < 0 ? g.left : g.right), () => {
      s.bone(cx + k * u * 1.6, h * 0.62, -1, u * 1.3, cx + k * u * 2, foot, 0, u * 1.4, m);
    });
  }
  s.piece(g.x, g.y, () => {
    for (const k of [-1, 1]) {
      s.piece(0, k < 0 ? g.armLeft : g.armRight, () => {
        s.bone(cx + k * u * 3.4, h * 0.3, 1, u * 1.4, cx + k * u * 4.2, h * 0.74, 3, u * 1.5, m);
      });
    }
    // Un corps fait de crânes : une masse d'os d'où chaque tête regarde.
    s.ball(cx, h * 0.48, -2, u * 3.5, h * 0.27, u * 2.6, material(['#2a2420', '#4a4038', '#6b6054'], { rough: 0.6 }));
    const skulls: [number, number, number][] = [
      [-2.6, 0.32, 2], [2.6, 0.33, 2], [-1, 0.27, 3], [1.2, 0.3, 3], [0, 0.42, 4], [-2.2, 0.48, 2], [2.1, 0.5, 2],
      [-0.9, 0.56, 4], [1.1, 0.58, 4], [0, 0.68, 3],
    ];
    for (const [k, y, z] of skulls) {
      // Les crânes s'entrechoquent : chacun rebondit d'un pixel, à son propre temps.
      s.piece(0, Math.round(wave(t * 2, k * 0.1) * 0.8), () => {
        const sx = cx + k * u, sy = h * y;
        s.ball(sx, sy, z, u * 0.95, u * 0.9, u * 0.8, m);
        s.dot(sx - u * 0.35, sy, hollow, z + 9);
        s.dot(sx + u * 0.35, sy, hollow, z + 9);
        s.dot(sx, sy + u * 0.6, hollow, z + 9);
      });
    }
    s.piece(0, g.head, () => {
      const head = h * 0.14;
      s.ball(cx, head, 5, u * 1.9, u * 1.8, u * 1.6, m);
      s.ball(cx, head + u * 1.6, 6, u * 1.2, u * 0.7, u * 1, m);
      s.carve(cx - u * 0.8, head, u * 0.65, u * 0.65);
      s.carve(cx + u * 0.8, head, u * 0.65, u * 0.65);
      s.dot(cx - u * 0.8, head, dead, 12);
      s.dot(cx + u * 0.8, head, dead, 12);
      for (let k = -1; k <= 1; k++) s.dot(cx + k * u * 0.7, head + u * 2, hollow, 12);
    });
  });
}

function worm(s: Sculpt, a: BodyArt, t: number): void {
  const { w, h } = s;
  const m = material(a.cols, { gloss: 0.8, rough: 0.15 }), u = h * 0.1, belly = material([a.cols[1], a.cols[2], shade(a.cols[2], 0.3)], { gloss: 0.8 });
  // Anneaux de la queue vers la tête : ondulation propagée le long du corps.
  const n = 9;
  for (let k = 0; k < n; k++) {
    const q = k / (n - 1);
    const x = w * (0.12 + q * 0.62);
    const y = h * (0.66 - q * 0.26);
    const r = u * (1.1 + Math.sin(q * PI) * 1.5 + q * 1);
    s.piece(0, wave(t, q * 1.4) * u * 0.7, () => {
      s.ball(x, y, k * 0.5, r, r * 0.95, r, m);
      s.decal(x, y + r * 0.5, r * 0.72, r * 0.34, belly);
      s.stroke(x + r * 0.9, y - r * 0.7, x + r * 0.9, y + r * 0.7, 0.5, hollow);
    });
  }
  s.piece(0, wave(t, 1.3) * u * 0.6, () => {
    const hx = w * 0.8, hy = h * 0.34;
    s.ball(hx, hy, 6, u * 3, u * 2.8, u * 2.6, m);
    // La bouche ronde, armée de dents : on voit dedans.
    s.decal(hx + u * 0.6, hy + u * 0.4, u * 1.9, u * 1.8, material(['#2c0812', '#6b1122', '#9c1c33'], { rough: 0.3 }));
    s.decal(hx + u * 0.6, hy + u * 0.4, u * 0.9, u * 0.9, hollow);
    for (let k = 0; k < 12; k++) {
      const g = (k / 12) * TAU;
      s.stroke(hx + u * 0.6 + Math.cos(g) * u * 1.75, hy + u * 0.4 + Math.sin(g) * u * 1.65, hx + u * 0.6 + Math.cos(g) * u * 1.05, hy + u * 0.4 + Math.sin(g) * u, 0.5, bone);
    }
    eyes(s, hx + u * 0.4, hy - u * 1.9, u * 1.2, a.eye);
  });
}

function bellman(s: Sculpt, a: BodyArt, t: number): void {
  const { w, h } = s;
  const cx = w / 2, robe = body(a, 0.3), u = w * 0.095, foot = h - 2;
  const g = march(t, { foot: 4, bob: 2, sway: 3, arm: 3, heavy: true });
  const bronze = material(['#3a2412', '#7a5a2a', '#c9a24a'], { gloss: 1, rough: 0.15 });
  const ring = wave(t) * u * 1.3;
  // Sous la robe, les pas se devinent : un pan se soulève à gauche, puis à droite.
  for (let k = -3; k <= 3; k++) {
    const up = k < 0 ? g.left : k > 0 ? g.right : 0;
    s.piece(0, -up, () => s.bone(cx + k * u * 0.9, h * 0.7, 2, u * 0.7, cx + k * u, foot, 2, u * 0.3, robe));
  }
  s.piece(g.x, g.y, () => {
    s.ball(cx, h * 0.66, 0, u * 3.2, h * 0.3, u * 2.4, robe);
    // Il porte son clocher sur le dos : la cloche remplace sa tête.
    s.piece(0, g.armLeft, () => s.bone(cx - u * 2.6, h * 0.42, 3, u, cx - u * 4, h * 0.6, 6, u * 0.8, robe));
    s.piece(0, g.armRight, () => s.bone(cx + u * 2.6, h * 0.42, 3, u, cx + u * 3.8, h * 0.28, 6, u * 0.8, robe));
    s.bone(cx - u * 3, h * 0.04, 5, u * 0.45, cx + u * 3, h * 0.04, 5, u * 0.45, leather);
    s.piece(ring * 0.2, 0, () => s.bone(cx, h * 0.04, 6, u * 0.3, cx, h * 0.12, 7, u * 0.3, iron));
    const by = h * 0.14;
    // La cloche balance depuis son attache : chaque anneau se décale d'autant qu'il est bas.
    for (let k = 0; k <= 8; k++) {
      const q = k / 8, r = u * (1.3 + q * q * 2.2);
      s.piece(ring * q * 0.6, 0, () => s.ball(cx, by + q * h * 0.26, 7, r, u * 0.75, r * 0.8, bronze));
    }
    s.piece(ring * 0.6, 0, () => s.decal(cx, by + h * 0.27, u * 2.8, u * 0.6, hollow));
    s.piece(ring * 1.1, 0, () => s.sphere(cx, by + h * 0.3, 22, u * 0.65, iron));
    s.piece(ring * 0.3, 0, () => {
      s.decal(cx, by + h * 0.13, u * 1.5, u * 0.5, hollow);
      s.dot(cx - u * 0.7, by + h * 0.13, glow(a.eye));
      s.dot(cx + u * 0.7, by + h * 0.13, glow(a.eye));
    });
    s.piece(ring * 0.5, 0, () => {
      for (let k = 0; k < 3; k++) s.stroke(cx - u * 2, by + h * (0.18 + k * 0.03), cx + u * 2, by + h * (0.18 + k * 0.03), 0.4, bronze);
    });
  });
}

// ---------------------------------------------------------------- objets du décor

function objet(s: Sculpt, a: BodyArt, t: number): void {
  const { w, h } = s;
  const cx = w / 2, m = material(a.cols, { rough: 0.25, gloss: 0.3 }), foot = h - 2;
  const fire = glow(a.eye);
  switch (a.forme) {
    case 'brasero': {
      s.bone(cx - w * 0.24, h * 0.5, -1, 1, cx - w * 0.3, foot, -1, 0.9, m);
      s.bone(cx + w * 0.24, h * 0.5, -1, 1, cx + w * 0.3, foot, -1, 0.9, m);
      s.bone(cx, h * 0.5, 1, 1, cx, foot, 3, 0.9, m);
      s.ball(cx, h * 0.46, 0, w * 0.36, h * 0.16, w * 0.3, iron);
      s.ball(cx, h * 0.42, 2, w * 0.3, h * 0.08, w * 0.26, material(['#3a120c', '#c9281f', '#ff8a2a']));
      for (let k = 0; k < 4; k++) {
        const f = wave(t, k * 0.27);
        s.bone(cx - w * 0.18 + k * w * 0.12, h * 0.42, 3, 1.5, cx - w * 0.18 + k * w * 0.12 + f, h * 0.18 - f * 1.4, 3, 0.3, fire);
      }
      break;
    }
    case 'jarre': {
      for (let k = 0; k <= 10; k++) {
        const q = k / 10, r = w * (0.2 + Math.sin(q * PI) * 0.22);
        s.ball(cx, h * (0.22 + q * 0.66), 0, r, h * 0.08, r, m);
      }
      s.ball(cx, h * 0.15, 1, w * 0.22, h * 0.05, w * 0.2, m);
      s.ball(cx, h * 0.14, 1.5, w * 0.14, h * 0.025, w * 0.12, hollow);
      for (let k = 0; k < 5; k++) s.dot(cx - w * 0.2 + k * w * 0.1, h * 0.55, tone(a.eye));
      break;
    }
    case 'reliquaire': {
      s.block(cx - w * 0.36, h * 0.46, w * 0.72, h * 0.42, 0, 3, m);
      s.block(cx - w * 0.4, h * 0.34, w * 0.8, h * 0.14, 1, 3, tone(a.eye, { gloss: 1 }));
      s.block(cx - w * 0.06, h * 0.52, w * 0.12, h * 0.26, 3, 1, tone(a.eye, { gloss: 1 }), 0.6);
      s.block(cx - w * 0.16, h * 0.58, w * 0.32, h * 0.07, 3, 1, tone(a.eye, { gloss: 1 }), 0.6);
      for (let k = -1; k <= 1; k++) s.bone(cx + k * w * 0.3, h * 0.34, 2, 1, cx + k * w * 0.3, h * 0.16, 2, 0.3, tone(a.eye, { gloss: 1 }));
      break;
    }
    case 'sarcophage': {
      s.block(cx - w * 0.42, h * 0.2, w * 0.84, h * 0.7, 0, 3, m, 2.5);
      s.ball(cx, h * 0.34, 3, w * 0.13, h * 0.15, 2, m);
      s.block(cx - w * 0.2, h * 0.46, w * 0.4, h * 0.36, 3, 1, m, 1.4);
      s.block(cx - w * 0.04, h * 0.5, w * 0.08, h * 0.26, 4.5, 0.6, tone(a.eye), 0.5);
      s.dot(cx - 1.5, h * 0.33, hollow);
      s.dot(cx + 1.5, h * 0.33, hollow);
      break;
    }
    default:
      s.ball(cx, h / 2, 0, w * 0.4, h * 0.4, w * 0.4, m);
  }
}

export const PLANS: Partial<Record<BodyArt['plan'], Plan>> = {
  humanoid: ghoul, skeleton, zombie, armored, beast: wolf, spider, rider, blob: golem, objet,
  knight, choir, lord, reaper, colossus, worm, bellman,
};

/** Allure d'un plan : ce qui relie le dessin de la marche à la vitesse réelle de la créature. */
export interface PlanGait {
  frames: number;
  /**
   * Longueur de foulée, rapportée à la racine de la hauteur du sprite : un grand corps fait de
   * plus grands pas, mais moins que proportionnellement, sinon un boss marcherait au ralenti.
   * Absente, la boucle suit le temps.
   */
  pace?: number;
  /** Durée d'une boucle au temps, pour ce qui flotte : rien ne l'y relie au sol. */
  period?: number;
  /** Amplitude, en pixels, de l'à-coup du corps sur chaque pas : c'est lui qui donne le poids. */
  surge?: number;
}

export const PLAN_GAITS: Partial<Record<BodyArt['plan'], PlanGait>> = {
  humanoid: { frames: 8, pace: 7.6 },
  skeleton: { frames: 8, pace: 7.4 },
  zombie: { frames: 8, pace: 5.9 },
  armored: { frames: 8, pace: 8.2 },
  beast: { frames: 8, pace: 8 },
  spider: { frames: 8, pace: 7 },
  rider: { frames: 8, pace: 12.6 },
  blob: { frames: 12, pace: 5, surge: 1.5 },
  knight: { frames: 12, pace: 7.5, surge: 2 },
  lord: { frames: 12, pace: 6.1, surge: 2 },
  colossus: { frames: 12, pace: 5.5, surge: 2 },
  bellman: { frames: 12, pace: 4.9, surge: 2 },
  worm: { frames: 8, pace: 7.7 },
  choir: { frames: 12, period: 2.4 },
  reaper: { frames: 8, period: 1.2 },
};
