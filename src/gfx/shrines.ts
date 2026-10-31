import type { Brush } from './brush';
import { stoneHash } from './brush';
import { CLOTH, GLASS, GOLD, GROUND_SHADOW, IRON, MOSS, ROOF, STONE, WOOD, masonry, pinnacle, tone } from './castle';

/**
 * Les structures isolées de la carte, peintes au pinceau du château.
 *
 * Un Bûcher ou un Obélisque se voient de loin et valent un détour : ils doivent dominer les arbres
 * (69 px) et se reconnaître à leur silhouette. Chaque peintre reçoit `lit` : une structure épuisée
 * reste debout, mais s'éteint.
 */

const BLOOD = ['#2a0810', '#5a0f1c', '#8e1a2a', '#c42639'] as const;
const VIOLET = ['#2c1250', '#5a26a0', '#a855f7', '#e2c2ff'] as const;
const ICE = ['#16324a', '#2f7fa8', '#7ee8ff', '#e6fbff'] as const;
const WATER = ['#0a1a22', '#10303a', '#18464e', '#2a6a6c', '#5aa8a0'] as const;
const BONE = ['#3a3228', '#7e7058', '#c8ba98', '#f8f0dc'] as const;
const EARTH = ['#14100c', '#221a12', '#33271a'] as const;
const CHAR = ['#0c0a0c', '#1c1614', '#2e2420'] as const;

/** Bloc de pierre vu de trois quarts : le dessus clair, la face, le flanc droit dans l'ombre. */
function block(b: Brush, x: number, foot: number, w: number, h: number, top = 10): void {
  b.rect(x, foot - h, w, h, tone(3));
  masonry(b, x, x + w, foot - h, foot, 3);
  b.rect(x + w - Math.max(6, w * 0.14), foot - h, Math.max(6, w * 0.14), h, tone(2));
  b.rect(x, foot - h, 3, h, tone(5));
  b.rect(x, foot - h - top, w, top, tone(5));
  b.rect(x, foot - h - top, w, 2, tone(6));
  b.rect(x + w - Math.max(6, w * 0.14), foot - h - top, Math.max(6, w * 0.14), top, tone(3));
}

/** Un gros rocher : une masse, un plan éclairé, une ombre franche. Jamais de grain. */
function boulder(b: Brush, cx: number, foot: number, w: number, h: number, seed: number): void {
  const r = w / 2, cy = foot - h / 2;
  b.ellipse(cx, cy, r, h / 2, tone(2));
  b.ellipse(cx - r * 0.14, cy - h * 0.1, r * 0.82, h * 0.4, tone(3));
  b.ellipse(cx - r * 0.3, cy - h * 0.2, r * 0.5, h * 0.24, tone(4));
  b.ellipse(cx - r * 0.42, cy - h * 0.28, r * 0.2, h * 0.09, tone(5));
  if (stoneHash(seed, 3) < 0.5) b.ellipse(cx + r * 0.3, foot - h * 0.2, r * 0.36, h * 0.12, MOSS[1]);
}

/** Pierre dressée, taillée à la hache : deux faces, un sommet cassé. */
function menhir(b: Brush, cx: number, foot: number, w: number, h: number, seed: number): void {
  const lean = (stoneHash(seed, 1) - 0.5) * 10, top = foot - h;
  b.ellipse(cx + 3, foot, w * 0.7, 6, GROUND_SHADOW);
  b.poly([[cx - w / 2, foot], [cx - w * 0.3 + lean, top + 8], [cx + lean, top], [cx, foot]], tone(4));
  b.poly([[cx, foot], [cx + lean, top], [cx + w * 0.34 + lean, top + 12], [cx + w / 2, foot]], tone(2));
  b.poly([[cx - w * 0.3 + lean, top + 8], [cx + lean, top], [cx + lean - 2, top + 22], [cx - w * 0.26 + lean, top + 30]], tone(5));
  b.ellipse(cx - 2, foot - 5, w * 0.5, 7, MOSS[0]);
  b.ellipse(cx - w * 0.2, foot - 7, w * 0.26, 4, MOSS[1]);
}

/** Dalle ronde : un sol qui dit qu'ici, quelqu'un a construit. Aplats seuls, le sol défile dessous. */
function dais(b: Brush, cx: number, cy: number, rx: number, ry: number): void {
  b.ellipse(cx, cy + 4, rx + 6, ry + 5, tone(1));
  b.ellipse(cx, cy, rx, ry, tone(2));
  b.ellipse(cx, cy, rx - 8, ry - 6, tone(3));
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    for (let q = 0.3; q < 0.96; q += 0.04) b.rect(cx + Math.cos(a) * rx * q, cy + Math.sin(a) * ry * q, 2, 1, tone(2));
  }
  b.ellipse(cx, cy, rx * 0.42, ry * 0.42, tone(2));
  b.ellipse(cx, cy, rx * 0.36, ry * 0.36, tone(3));
}

// ---------------------------------------------------------------------- autel

export function paintAltarFloor(b: Brush, lit: boolean): void {
  dais(b, 0, 0, 170, 106);
  // Les rigoles de sang courent de l'autel vers le bord : elles disent à quoi il sert.
  const c = lit ? BLOOD[2] : BLOOD[0];
  for (let k = 0; k < 8; k++) {
    const a = ((k + 0.5) / 8) * Math.PI * 2;
    for (let q = 0.3; q < 0.9; q += 0.012) b.rect(Math.cos(a) * 170 * q, Math.sin(a) * 106 * q, 3, 2, c);
  }
}

export function paintBloodAltar(b: Brush, lit: boolean): void {
  block(b, -76, 0, 152, 16, 12);
  block(b, -58, -22, 116, 22, 10);
  block(b, -42, -50, 84, 34, 8);
  b.rect(-42, -50, 84, 8, tone(2));
  // Le bassin, taillé dans la pierre, et le sang qui déborde sur la face.
  b.ellipse(0, -90, 34, 8, BLOOD[0]);
  b.ellipse(0, -90, 29, 6, lit ? BLOOD[3] : BLOOD[1]);
  if (lit) {
    b.rect(-20, -84, 5, 34, BLOOD[2]);
    b.rect(12, -84, 4, 22, BLOOD[2]);
    b.rect(-2, -84, 6, 46, BLOOD[3]);
  }
  for (const dx of [-30, 30]) {
    b.rect(dx - 2, -44, 4, 8, VIOLET[lit ? 2 : 0]);
  }
}

export function paintRitualColumn(b: Brush, cx: number, foot: number, lit: boolean): void {
  b.ellipse(cx + 3, foot, 24, 7, GROUND_SHADOW);
  block(b, cx - 20, foot, 40, 12, 6);
  const top = foot - 136;
  b.rect(cx - 12, top, 24, 124, tone(3));
  b.rect(cx - 12, top, 8, 124, tone(4));
  b.rect(cx - 12, top, 2, 124, tone(5));
  b.rect(cx + 5, top, 7, 124, tone(2));
  for (let y = top + 22; y < foot - 16; y += 30) b.rect(cx - 12, y, 24, 2, tone(1));
  block(b, cx - 18, top, 36, 10, 6);
  // Coupe de fer et feu froid au sommet.
  b.rect(cx - 12, top - 26, 24, 10, IRON[1]);
  b.rect(cx - 12, top - 26, 24, 3, IRON[3]);
  b.rect(cx - 3, top - 16, 6, 6, IRON[0]);
  if (lit) {
    b.poly([[cx - 10, top - 26], [cx - 4, top - 44], [cx + 2, top - 34], [cx + 7, top - 48], [cx + 10, top - 26]], VIOLET[2]);
    b.poly([[cx - 5, top - 26], [cx, top - 38], [cx + 5, top - 26]], VIOLET[3]);
  }
}

// ---------------------------------------------------------------------- bûcher

export function paintPyreFloor(b: Brush, lit: boolean): void {
  b.ellipse(0, 0, 150, 92, EARTH[0]);
  b.ellipse(-6, -4, 128, 76, EARTH[1]);
  b.ellipse(0, 4, 84, 50, lit ? '#3a1408' : EARTH[0]);
  // Un cercle de pierres noircies borne le feu.
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2, x = Math.cos(a) * 138, y = Math.sin(a) * 84;
    b.ellipse(x, y + 2, 13, 7, tone(1));
    b.ellipse(x, y, 12, 7, tone(k % 3 === 0 ? 3 : 2));
    b.ellipse(x - 3, y - 2, 6, 3, tone(4));
  }
}

function log(b: Brush, x0: number, y0: number, x1: number, y1: number, r: number, c: readonly string[]): void {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * r, ny = (dx / l) * r;
  b.poly([[x0 - nx, y0 - ny], [x1 - nx, y1 - ny], [x1 + nx, y1 + ny], [x0 + nx, y0 + ny]], c[1]!);
  b.poly([[x0 - nx, y0 - ny], [x1 - nx, y1 - ny], [x1 - nx * 0.2, y1 - ny * 0.2], [x0 - nx * 0.2, y0 - ny * 0.2]], c[2]!);
  b.ellipse(x1, y1, r * 0.9, r, c[0]!);
  b.ellipse(x1, y1, r * 0.5, r * 0.6, c[2]!);
}

export function paintPyreStake(b: Brush, lit: boolean): void {
  const c = lit ? WOOD : CHAR;
  b.rect(-9, -214, 18, 170, c[1]!);
  b.rect(-9, -214, 6, 170, c[2]!);
  b.rect(-58, -178, 116, 14, c[1]!);
  b.rect(-58, -178, 116, 5, c[2]!);
  b.rect(-3, -216, 3, 172, c[0]!);
  // Des chaînes pendent de la traverse : on a brûlé quelqu'un ici.
  for (const dx of [-46, 42]) {
    for (let k = 0; k < 8; k++) b.rect(dx + (k % 2), -164 + k * 7, 4, 5, IRON[k % 2 ? 2 : 3]);
  }
}

export function paintPyreLogs(b: Brush, lit: boolean): void {
  const c = lit ? WOOD : CHAR;
  for (const [x0, y0, x1, y1] of [
    [-104, -6, -30, -62], [104, -8, 30, -64], [-90, 0, 90, -4], [-60, -28, 72, -22],
    [-96, -16, -8, -74], [96, -18, 8, -76], [-44, -12, -26, -86], [46, -14, 22, -88], [0, -6, 4, -92],
  ] as const) log(b, x0, y0, x1, y1, 9, c);
}

// ---------------------------------------------------------------------- obélisque

export function paintObelisk(b: Brush, lit: boolean): void {
  b.ellipse(10, 2, 136, 22, GROUND_SHADOW);
  block(b, -114, 0, 228, 22, 14);
  block(b, -86, -36, 172, 22, 12);
  block(b, -60, -70, 120, 22, 10);

  const foot = -92, top = -362, bw = 42, tw = 24;
  // La lumière vient de la gauche : deux faces, et rien d'autre. C'est tout l'obélisque.
  b.poly([[-bw, foot], [-tw, top], [2, top], [2, foot]], tone(4));
  b.poly([[2, foot], [2, top], [tw, top], [bw, foot]], tone(2));
  b.poly([[-bw, foot], [-tw, top], [-tw + 5, top], [-bw + 7, foot]], tone(5));
  // Pyramidion.
  b.poly([[-tw - 1, top], [0, top - 44], [2, top]], tone(6));
  b.poly([[2, top], [0, top - 44], [tw + 1, top]], tone(3));
  b.rect(-tw - 2, top - 1, tw * 2 + 4, 3, tone(5));

  // Runes gravées, une colonne d'éclats : éteintes, il ne reste que l'entaille.
  const glow = lit ? ICE[2] : STONE[0], core = lit ? ICE[3] : STONE[1];
  for (let k = 0; k < 9; k++) {
    const y = foot - 26 - k * 27, half = 6 - k * 0.3;
    const kind = stoneHash(k, 9);
    b.rect(-half - 5, y, 2, 16, glow);
    if (kind < 0.33) {
      b.rect(-half - 5, y + 6, half * 2, 2, glow);
      b.rect(-5, y, 2, 16, core);
    } else if (kind < 0.66) {
      b.rect(-half - 5, y, half * 2, 2, glow);
      b.rect(-half - 5, y + 14, half * 2, 2, core);
    } else {
      b.poly([[-half - 5, y + 16], [-5, y], [-2, y], [-half - 2, y + 16]], glow);
    }
  }
}

// ---------------------------------------------------------------------- puits

export function paintWellFloor(b: Brush): void {
  dais(b, 0, 0, 150, 96);
  // Les pièces jetées à côté : c'est ce qui dit « on y fait un vœu ».
  for (let k = 0; k < 16; k++) {
    const a = stoneHash(k, 11) * Math.PI * 2, d = 0.5 + stoneHash(k, 12) * 0.42;
    b.ellipse(Math.cos(a) * 150 * d, Math.sin(a) * 96 * d, 3, 2, GOLD);
    b.rect(Math.cos(a) * 150 * d - 1, Math.sin(a) * 96 * d - 1, 2, 1, '#fff2a8');
  }
}

export function paintGreatWell(b: Brush, lit: boolean): void {
  const R = 66, rim = -44;
  b.ellipse(4, 3, R + 8, 18, GROUND_SHADOW);
  b.ellipse(0, -2, R, 18, tone(2));
  b.rect(-R, rim, R * 2, 42, tone(3));
  masonry(b, -R, R, rim, -2, 3);
  b.rect(-R, rim, 24, 42, tone(4));
  b.rect(R - 20, rim, 20, 42, tone(2));
  b.ellipse(0, rim, R, 18, tone(5));
  b.ellipse(0, rim, R - 9, 13, tone(1));
  b.ellipse(0, rim + 2, R - 14, 10, lit ? '#6a4a14' : STONE[0]);
  if (lit) {
    b.ellipse(0, rim + 2, R - 22, 7, GOLD);
    b.ellipse(-12, rim, 12, 3, '#fff2a8');
  }

  for (const dx of [-R + 4, R - 12]) {
    b.rect(dx, rim - 118, 12, 120, WOOD[1]);
    b.rect(dx, rim - 118, 4, 120, WOOD[3]);
  }
  // Treuil, corde, seau.
  b.rect(-R - 6, rim - 92, R * 2 + 12, 11, WOOD[2]);
  b.rect(-R - 6, rim - 92, R * 2 + 12, 3, WOOD[3]);
  b.rect(R + 6, rim - 94, 6, 26, IRON[3]);
  b.rect(R + 6, rim - 72, 16, 5, IRON[2]);
  b.rect(-2, rim - 81, 4, 48, '#c8ba98');
  b.rect(-13, rim - 34, 26, 22, WOOD[2]);
  b.rect(-13, rim - 34, 26, 4, IRON[3]);
  b.rect(-13, rim - 18, 26, 3, IRON[2]);
  b.rect(-13, rim - 34, 6, 22, WOOD[3]);

  // Toit de tuiles : deux pans, comme le château.
  const eave = rim - 104, peak = eave - 76, H = R + 34;
  b.poly([[-H, eave], [0, peak], [0, eave]], ROOF[3]);
  b.poly([[H, eave], [0, peak], [0, eave]], ROOF[1]);
  for (let k = 1; k < 5; k++) {
    const y = eave - k * 15, hw = H * (1 - (k * 15) / 76);
    b.rect(-hw, y, hw, 2, ROOF[1]);
    b.rect(0, y, hw, 2, ROOF[0]);
  }
  b.rect(-H - 2, eave - 2, H * 2 + 4, 6, WOOD[2]);
  b.rect(-H - 2, eave - 2, H * 2 + 4, 2, WOOD[3]);
  b.rect(-3, peak - 6, 6, 10, tone(5));
}

// ------------------------------------------------------------------- ossuaire

function skull(b: Brush, cx: number, y: number, dim: boolean): void {
  const c = dim ? BONE[1] : BONE[2], hi = dim ? BONE[2] : BONE[3];
  b.ellipse(cx, y, 8, 7, c);
  b.ellipse(cx - 2, y - 2, 4, 3, hi);
  b.rect(cx - 5, y + 5, 10, 5, c);
  b.rect(cx - 5, y - 1, 4, 4, BONE[0]);
  b.rect(cx + 1, y - 1, 4, 4, BONE[0]);
  b.rect(cx - 3, y + 7, 1, 3, BONE[0]);
  b.rect(cx + 2, y + 7, 1, 3, BONE[0]);
}

export function paintOssuaryFront(b: Brush, lit: boolean): void {
  // Trois rangs de crânes scellés dans la façade : un ossuaire se reconnaît de loin à ça.
  for (const [y, from, to] of [[-146, -112, 112], [-112, -124, 124], [-78, -124, 124]] as const) {
    for (let x = from; x <= to; x += 26) {
      if (Math.abs(x) < 54) continue;
      b.rect(x - 11, y - 11, 22, 24, tone(1));
      skull(b, x, y, !lit);
    }
  }
  // Grand crâne sur le pignon.
  b.ellipse(0, -232, 26, 23, BONE[2]);
  b.ellipse(-7, -240, 12, 9, BONE[3]);
  b.rect(-15, -216, 30, 15, BONE[2]);
  b.ellipse(-10, -232, 7, 7, lit ? '#3cff9a' : BONE[0]);
  b.ellipse(10, -232, 7, 7, lit ? '#3cff9a' : BONE[0]);
  b.poly([[-3, -218], [0, -224], [3, -218]], BONE[0]);
  for (const x of [-11, -4, 3, 10]) b.rect(x, -209, 2, 8, BONE[0]);
  // Lourde porte de fer, entrouverte sur le noir.
  b.arch(0, 0, 92, 128, tone(5));
  b.arch(0, 0, 80, 120, tone(2));
  b.arch(0, 0, 66, 108, STONE[0]);
  b.rect(-33, -70, 24, 70, IRON[1]);
  b.rect(-33, -70, 24, 3, IRON[3]);
  for (let y = -62; y < 0; y += 20) b.rect(-33, y, 24, 3, IRON[2]);
  if (lit) b.ellipse(10, -44, 13, 18, '#1a5a3c');
}

export function paintBonePile(b: Brush, cx: number, foot: number, w: number, seed: number): void {
  b.ellipse(cx, foot - 8, w / 2, 16, BONE[0]);
  b.ellipse(cx - 4, foot - 14, w * 0.4, 12, BONE[1]);
  for (let k = 0; k < 9; k++) {
    const x = cx + (stoneHash(seed, k) - 0.5) * w * 0.8, y = foot - 8 - stoneHash(seed, k + 20) * 22;
    const a = stoneHash(seed, k + 40) * 3;
    const dx = Math.cos(a) * 12, dy = Math.sin(a) * 5;
    b.poly([[x - dx, y - dy - 1], [x + dx, y + dy - 1], [x + dx, y + dy + 2], [x - dx, y - dy + 2]], BONE[2]);
    b.ellipse(x + dx, y + dy, 3, 3, BONE[3]);
  }
  skull(b, cx - w * 0.18, foot - 26, false);
  skull(b, cx + w * 0.2, foot - 18, false);
}

// ---------------------------------------------------------------------- cairn

export function paintCairnFloor(b: Brush): void {
  b.ellipse(0, 0, 160, 98, EARTH[1]);
  b.ellipse(-4, -3, 136, 80, EARTH[2]);
}

export function paintCairnHeap(b: Brush): void {
  b.ellipse(8, 2, 106, 20, GROUND_SHADOW);
  const rows: readonly (readonly [number, number, number, number])[] = [
    [-74, 0, 62, 44], [-14, 2, 68, 50], [56, 0, 66, 46], [-42, -30, 62, 44], [28, -32, 66, 46],
    [-8, -62, 62, 42], [-44, -66, 42, 30], [36, -70, 44, 30], [-10, -96, 50, 34], [4, -124, 36, 26],
  ];
  rows.forEach(([x, foot, w, h], i) => boulder(b, x, foot, w, h, i));
  // Offrandes au pied du tas.
  for (const [x, y, c] of [[-46, 8, CLOTH[2]], [40, 10, GOLD], [-8, 16, BONE[2]]] as const) {
    b.ellipse(x, y, 11, 4, tone(1));
    b.ellipse(x, y - 3, 9, 3, c);
  }
}

export { menhir };

// ------------------------------------------------------------- chapelle noyée

/** L'eau noire autour de la chapelle : de grands aplats, les rides en tirets. */
export function paintFloodwater(b: Brush, cx: number, cy: number, rx: number, ry: number): void {
  b.ellipse(cx, cy, rx + 12, ry + 8, EARTH[0]);
  b.ellipse(cx, cy, rx, ry, WATER[1]);
  b.ellipse(cx - rx * 0.08, cy + ry * 0.04, rx * 0.84, ry * 0.8, WATER[2]);
  for (let k = 0; k < 46; k++) {
    const a = stoneHash(k, 21) * Math.PI * 2, d = Math.sqrt(stoneHash(k, 22)) * 0.92;
    const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
    const w = 14 + stoneHash(k, 23) * 34;
    b.rect(x, y, w, 2, WATER[3]);
    if (k % 3 === 0) b.rect(x + 6, y, w * 0.4, 1, WATER[4]);
  }
}

/** Bandeau humide au pied des murs : l'eau est montée, puis redescendue. */
export function paintWaterline(b: Brush, x0: number, x1: number, foot: number): void {
  b.rect(x0, foot - 34, x1 - x0, 34, '#1a3a3c66');
  b.rect(x0, foot - 35, x1 - x0, 2, WATER[3]);
  for (let x = x0 + 6; x < x1; x += 22) b.rect(x, foot - 33, 3, 8 + stoneHash(x, 4) * 16, MOSS[1]);
}

export function paintSunkenPew(b: Brush, x: number, foot: number, tilt: number): void {
  b.poly([[x, foot + tilt], [x + 62, foot - tilt], [x + 62, foot - tilt - 16], [x, foot + tilt - 16]], WOOD[1]);
  b.poly([[x, foot + tilt - 16], [x + 62, foot - tilt - 16], [x + 62, foot - tilt - 22], [x, foot + tilt - 22]], WOOD[3]);
}

export function paintCandles(b: Brush, cx: number, foot: number, lit: boolean): void {
  for (const dx of [-30, -14, 14, 30]) {
    const h = 26 - Math.abs(dx) * 0.3;
    b.rect(cx + dx - 3, foot - h, 6, h, BONE[2]);
    b.rect(cx + dx - 3, foot - h, 2, h, BONE[3]);
    if (lit) {
      b.poly([[cx + dx - 3, foot - h - 1], [cx + dx, foot - h - 13], [cx + dx + 3, foot - h - 1]], GLASS.glow);
      b.rect(cx + dx - 1, foot - h - 5, 2, 4, GLASS.core);
    }
  }
}

// ------------------------------------------------------- cimetière et prieuré

/** Mur bas de pierre, sans créneaux : il borne un lieu, il ne le défend pas. */
export function paintLowWall(b: Brush, x0: number, x1: number, y: number, depth: number, h: number, seed: number): void {
  const foot = y + depth;
  b.rect(x0, foot, x1 - x0, 6, GROUND_SHADOW);
  masonry(b, x0, x1, foot - h, foot, 3);
  b.rect(x0, foot - h - depth * 0.6, x1 - x0, depth * 0.6, tone(5));
  b.rect(x0, foot - h - depth * 0.6, x1 - x0, 2, tone(6));
  b.rect(x0, foot - h, x1 - x0, 2, tone(1));
  for (let x = x0 + 60; x < x1; x += 148) {
    const w = 22;
    b.rect(x, foot - h - 16, w, h + 16, tone(4));
    b.rect(x, foot - h - 16, 4, h + 16, tone(5));
    b.rect(x + w - 5, foot - h - 16, 5, h + 16, tone(2));
    b.rect(x - 3, foot - h - 20, w + 6, 6, tone(6));
    if (stoneHash(x, seed) < 0.4) b.ellipse(x + 11, foot - 6, 16, 9, MOSS[1]);
  }
}

export function paintLowWallNS(b: Brush, x: number, y0: number, y1: number, depth: number, h: number): void {
  b.rect(x, y0 - h, depth, y1 - y0 + h, tone(4));
  b.rect(x, y0 - h, 4, y1 - y0 + h, tone(5));
  b.rect(x + depth - 5, y0 - h, 5, y1 - y0 + h, tone(2));
}

export function paintCemeteryGate(b: Brush, cx: number, foot: number, w: number): void {
  for (const dx of [-w / 2 - 26, w / 2]) {
    const x = cx + dx;
    b.ellipse(x + 15, foot, 20, 6, GROUND_SHADOW);
    masonry(b, x, x + 26, foot - 112, foot, 4);
    b.rect(x + 20, foot - 112, 6, 112, tone(2));
    b.rect(x - 4, foot - 118, 34, 8, tone(6));
    pinnacle(b, x + 13, foot - 118, 22, 22);
  }
  // La grille est ouverte : deux battants de fer repliés, l'arc au-dessus.
  for (const s of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const x = cx + s * (w / 2 - k * 5), top = foot - 104 + k * 4;
      b.rect(x, top, 2, foot - top - 2 - k * 2, IRON[k % 2 ? 2 : 1]);
    }
  }
  for (let k = 0; k <= 30; k++) {
    const q = k / 30, x = cx - w / 2 + q * w, y = foot - 112 - Math.sin(q * Math.PI) * 26;
    b.rect(x, y, 3, 3, IRON[2]);
  }
  b.rect(cx - 2, foot - 152, 4, 18, IRON[3]);
  b.rect(cx - 7, foot - 147, 14, 3, IRON[3]);
}

export function paintPath(b: Brush, x: number, y: number, w: number, h: number): void {
  b.rect(x, y, w, h, EARTH[2]);
  for (let py = Math.floor(y / 26) * 26; py < y + h; py += 26) {
    for (let px = Math.floor(x / 34) * 34 + (Math.round(py / 26) % 2) * 17; px < x + w; px += 34) {
      if (stoneHash(px, py) < 0.72 && px > x - 8 && py > y - 8) {
        b.rect(Math.max(x, px + 2), py + 2, 28, 20, tone(2));
        b.rect(Math.max(x, px + 2), py + 2, 28, 2, tone(3));
      }
    }
  }
}

/** Herbe rase et morte : des touffes éparses sur un aplat, jamais un damier. */
export function paintGrassPlot(b: Brush, x: number, y: number, w: number, h: number, seed: number): void {
  b.rect(x + 18, y, w - 36, h, MOSS[0]);
  b.rect(x, y + 18, w, h - 36, MOSS[0]);
  for (let k = 0; k < (w * h) / 2600; k++) {
    const px = x + stoneHash(seed + k, 31) * w, py = y + stoneHash(seed + k, 32) * h;
    b.rect(px, py, 2, 5, MOSS[1]);
    b.rect(px + 3, py + 1, 2, 4, MOSS[2]);
  }
}

export function paintGraveMound(b: Brush, cx: number, cy: number, seed: number): void {
  b.ellipse(cx, cy + 2, 25, 13, EARTH[0]);
  b.ellipse(cx, cy, 23, 11, EARTH[2]);
  b.ellipse(cx - 6, cy - 3, 12, 5, stoneHash(seed, 1) < 0.5 ? '#46362a' : MOSS[0]);
}

export function paintOpenGrave(b: Brush, cx: number, foot: number): void {
  b.ellipse(cx + 24, foot - 8, 26, 12, EARTH[2]);
  b.ellipse(cx + 20, foot - 14, 18, 9, '#46362a');
  b.rect(cx - 44, foot - 22, 74, 26, EARTH[1]);
  b.rect(cx - 40, foot - 18, 66, 20, STONE[0]);
  b.rect(cx - 40, foot - 18, 66, 4, EARTH[0]);
  // La pelle plantée dans le tas : quelqu'un creusait encore.
  b.rect(cx + 28, foot - 58, 4, 46, WOOD[3]);
  b.rect(cx + 22, foot - 62, 16, 4, WOOD[2]);
  b.poly([[cx + 24, foot - 14], [cx + 36, foot - 14], [cx + 34, foot - 2], [cx + 26, foot - 2]], IRON[2]);
}

export function paintCalvary(b: Brush, cx: number, foot: number): void {
  b.ellipse(cx + 6, foot + 2, 68, 14, GROUND_SHADOW);
  block(b, cx - 60, foot, 120, 16, 10);
  block(b, cx - 42, foot - 26, 84, 18, 8);
  block(b, cx - 24, foot - 52, 48, 22, 6);
  const top = foot - 214;
  b.rect(cx - 9, top, 18, 136, tone(4));
  b.rect(cx - 9, top, 6, 136, tone(5));
  b.rect(cx + 3, top, 6, 136, tone(2));
  b.rect(cx - 46, top + 32, 92, 18, tone(4));
  b.rect(cx - 46, top + 32, 92, 5, tone(5));
  b.rect(cx - 46, top + 45, 92, 5, tone(2));
  for (const [x, y] of [[cx, top - 4], [cx - 48, top + 41], [cx + 48, top + 41]] as const) b.ellipse(x, y, 11, 11, tone(5));
  b.ellipse(cx, top + 41, 15, 15, tone(5));
  b.ellipse(cx, top + 41, 11, 11, tone(2));
  b.rect(cx - 2, top + 30, 4, 22, tone(5));
  b.rect(cx - 11, top + 39, 22, 4, tone(5));
  ivyStrand(b, cx - 9, top + 58);
}

function ivyStrand(b: Brush, x: number, y: number): void {
  for (let k = 0; k < 8; k++) b.ellipse(x + (k % 2) * 8 + 4, y + k * 12, 7, 5, MOSS[k % 3 === 0 ? 2 : 1]);
}

export function paintMausoleum(b: Brush, cx: number, foot: number, w: number, d: number): void {
  const H = 112, rise = 62;
  b.rect(cx - w - 4, foot, w * 2 + 12, 8, GROUND_SHADOW);
  const eave = foot - H, ridge = eave - rise;
  b.poly([[cx - w, eave], [cx - w, eave - d], [cx, ridge - d], [cx, ridge]], ROOF[3]);
  b.poly([[cx + w, eave], [cx + w, eave - d], [cx, ridge - d], [cx, ridge]], ROOF[1]);
  b.layer((f) => {
    masonry(f, cx - w, cx + w, ridge, foot, 3);
    f.cut([[cx - w - 2, ridge - 2], [cx, ridge - 2], [cx, ridge], [cx - w - 2, eave]]);
    f.cut([[cx + w + 2, ridge - 2], [cx, ridge - 2], [cx, ridge], [cx + w + 2, eave]]);
  });
  for (let k = 0; k <= 24; k++) {
    const q = k / 24;
    b.rect(cx - w + q * w - 3, eave - q * rise - 3, 8, 6, tone(5));
    b.rect(cx + w - q * w - 5, eave - q * rise - 3, 8, 6, tone(4));
  }
  b.rect(cx - w, foot - 12, w * 2, 12, tone(2));
  b.arch(cx, foot, 62, 84, tone(5));
  b.arch(cx, foot, 50, 76, STONE[0]);
  skullBadge(b, cx, ridge + 34);
  b.rect(cx - 2, ridge - 26, 4, 26, tone(5));
  b.rect(cx - 9, ridge - 19, 18, 4, tone(5));
}

function skullBadge(b: Brush, cx: number, y: number): void {
  b.ellipse(cx, y, 11, 10, BONE[2]);
  b.ellipse(cx - 3, y - 3, 5, 4, BONE[3]);
  b.rect(cx - 6, y + 7, 12, 6, BONE[2]);
  b.rect(cx - 6, y - 2, 4, 5, BONE[0]);
  b.rect(cx + 2, y - 2, 4, 5, BONE[0]);
}

// -------------------------------------------------- monuments propres aux biomes

/** Le moulin de la lande : les ailes tournent à part, voir `millSails`. */
export function paintWindmill(b: Brush): void {
  b.ellipse(10, 2, 104, 18, GROUND_SHADOW);
  const foot = 0, top = -258, bw = 86, tw = 54;
  b.poly([[-bw, foot], [-tw, top], [tw, top], [bw, foot]], tone(3));
  b.layer((f) => {
    masonry(f, -bw, bw, top, foot, 3);
    f.cut([[-bw - 2, foot + 2], [-bw - 2, top - 2], [-tw, top - 2], [-bw, foot + 2]]);
    f.cut([[bw + 2, foot + 2], [bw + 2, top - 2], [tw, top - 2], [bw, foot + 2]]);
  });
  b.poly([[-bw, foot], [-tw, top], [-tw + 16, top], [-bw + 26, foot]], tone(4));
  b.poly([[bw, foot], [tw, top], [tw - 22, top], [bw - 34, foot]], tone(2));
  b.arch(0, foot, 66, 96, tone(5));
  b.arch(0, foot, 54, 88, WOOD[1]);
  b.rect(-1, foot - 86, 3, 86, WOOD[0]);
  for (const [x, y] of [[-22, -150], [24, -196]] as const) {
    b.arch(x, y, 26, 40, tone(5));
    b.arch(x, y, 18, 34, STONE[0]);
  }
  // Le chapeau, bois et ardoise, qui suit le vent.
  b.rect(-tw - 8, top - 8, tw * 2 + 16, 12, WOOD[2]);
  b.rect(-tw - 8, top - 8, tw * 2 + 16, 3, WOOD[3]);
  b.poly([[-tw - 6, top - 8], [-tw * 0.4, top - 62], [tw * 0.4, top - 62], [tw + 6, top - 8]], ROOF[2]);
  b.poly([[-tw - 6, top - 8], [-tw * 0.4, top - 62], [-tw * 0.1, top - 62], [-tw * 0.5, top - 8]], ROOF[4]);
  b.poly([[tw + 6, top - 8], [tw * 0.4, top - 62], [tw * 0.1, top - 62], [tw * 0.5, top - 8]], ROOF[0]);
}

/** La cabane de la sorcière, sur ses pilotis : tordue, rapiécée, habitée. */
export function paintWitchHut(b: Brush, lit: boolean): void {
  b.ellipse(0, 0, 116, 18, WATER[1]);
  for (const x of [-92, -52, -6, 40, 88]) {
    b.rect(x, -74, 11, 76, WOOD[1]);
    b.rect(x, -74, 4, 76, WOOD[2]);
    for (let y = -56; y < -4; y += 18) b.rect(x - 1, y, 13, 3, MOSS[1]);
  }
  b.rect(-112, -86, 224, 14, WOOD[1]);
  b.rect(-112, -86, 224, 4, WOOD[3]);
  const wall = -196;
  b.poly([[-96, -84], [-90, wall], [92, wall + 8], [100, -84]], WOOD[2]);
  for (let x = -92; x < 98; x += 17) b.poly([[x, -84], [x + 2, wall + (x + 92) * 0.04], [x + 4, wall + (x + 92) * 0.04], [x + 2, -84]], WOOD[1]);
  b.rect(40, -176, 34, 44, WOOD[0]);
  b.rect(44, -172, 26, 36, lit ? '#3cd8a0' : '#141014');
  b.rect(56, -172, 2, 36, WOOD[1]);
  b.rect(44, -156, 26, 2, WOOD[1]);
  b.rect(-52, -164, 50, 80, WOOD[1]);
  b.rect(-46, -158, 38, 74, WOOD[0]);
  b.ellipse(-16, -120, 3, 3, GOLD);
  // Le chaume, affaissé d'un côté, et un crâne au faîte.
  b.poly([[-128, -176], [-8, -292], [128, -164], [96, -150], [-104, -160]], '#3a3020');
  b.poly([[-128, -176], [-8, -292], [-14, -158], [-104, -160]], '#5a4a2c');
  for (let k = 0; k < 16; k++) {
    const x = -116 + k * 15, y = -166 + (stoneHash(k, 2) - 0.5) * 8;
    b.rect(x, y - 16, 3, 20, '#2a2216');
  }
  b.rect(38, -262, 26, 62, tone(2));
  b.rect(38, -262, 8, 62, tone(4));
  b.rect(34, -268, 34, 8, tone(5));
  b.ellipse(-8, -296, 12, 11, BONE[2]);
  b.rect(-13, -298, 5, 5, BONE[0]);
  b.rect(-3, -298, 5, 5, BONE[0]);
  // L'escalier de planches, et le chaudron au pied.
  for (let k = 0; k < 5; k++) b.rect(-70 + k * 3, -68 + k * 15, 58, 6, k % 2 ? WOOD[2] : WOOD[3]);
  b.ellipse(84, 26, 30, 10, IRON[0]);
  b.rect(58, 2, 52, 24, IRON[1]);
  b.rect(58, 2, 14, 24, IRON[2]);
  b.ellipse(84, 2, 27, 8, IRON[2]);
  b.ellipse(84, 3, 22, 6, lit ? '#3cd8a0' : STONE[0]);
}

/** L'arbre aux pendus : une masse noire plus haute qu'une tour, et ce qui pend à ses branches. */
export function paintHangingTree(b: Brush, lit: boolean): void {
  const dark = BARK2[0], mid = BARK2[1], hi = BARK2[2];
  b.ellipse(12, 4, 150, 26, GROUND_SHADOW);
  for (const [x, w] of [[-112, 56], [-64, 44], [62, 46], [108, 58]] as const) {
    b.poly([[x, 6], [x + (x < 0 ? w : -w), -30], [x + (x < 0 ? w + 22 : -w - 22), -4]], mid);
  }
  b.poly([[-58, 2], [-44, -180], [-74, -274], [-30, -214], [0, -300], [34, -216], [70, -262], [44, -176], [62, 2]], mid);
  b.poly([[-58, 2], [-44, -180], [-74, -274], [-30, -214], [-14, -250], [-16, 2]], hi);
  b.poly([[26, 2], [34, -160], [62, 2]], dark);
  const limbs = [[-30, -210, -190, -292, 14], [34, -214, 196, -304, 14], [-10, -266, -96, -392, 11], [12, -270, 110, -398, 11], [0, -290, 10, -420, 10]] as const;
  for (const [x0, y0, x1, y1, r] of limbs) {
    b.poly([[x0 - r, y0], [x0 + r, y0 + r], [x1, y1]], mid);
    b.poly([[x0 - r, y0], [x0, y0 - 2], [x1, y1]], hi);
  }
  for (const [x, y, dx, dy] of [[-120, -262, -60, -40], [-150, -272, 10, -56], [120, -262, 70, -36], [150, -278, -6, -62], [-62, -340, -44, -44], [66, -340, 46, -46]] as const) {
    b.poly([[x - 3, y], [x + 4, y], [x + dx, y + dy]], mid);
  }
  // Trois pendus : la corde, le sac de toile, deux pieds qui ne touchent rien.
  for (const [x, y, len] of [[-150, -272, 62], [146, -280, 84], [-74, -350, 92]] as const) {
    b.rect(x, y, 2, len, BONE[1]);
    const t = y + len;
    b.ellipse(x + 1, t + 6, 8, 8, lit ? BONE[2] : BONE[1]);
    b.poly([[x - 11, t + 12], [x + 13, t + 12], [x + 10, t + 58], [x - 8, t + 58]], CLOTH[0]);
    b.poly([[x - 11, t + 12], [x + 1, t + 12], [x - 2, t + 58], [x - 8, t + 58]], CLOTH[1]);
    b.rect(x - 6, t + 58, 4, 14, BONE[1]);
    b.rect(x + 3, t + 58, 4, 14, BONE[1]);
  }
}

/** La forge de lave : un four adossé à la coulée, qui n'a jamais refroidi. */
export function paintLavaForge(b: Brush, lit: boolean): void {
  b.ellipse(8, 4, 150, 22, GROUND_SHADOW);
  block(b, -138, 0, 276, 26, 14);
  masonry(b, -112, 112, -196, -26, 2);
  b.rect(-112, -196, 14, 170, tone(4));
  b.rect(98, -196, 14, 170, tone(1));
  b.poly([[-124, -196], [0, -252], [124, -196]], tone(3));
  b.poly([[-124, -196], [0, -252], [0, -196]], tone(4));
  b.rect(-30, -386, 60, 150, tone(3));
  b.rect(-30, -386, 18, 150, tone(4));
  b.rect(14, -386, 16, 150, tone(1));
  b.rect(-38, -398, 76, 14, tone(5));
  for (let y = -372; y < -250; y += 34) b.rect(-30, y, 60, 3, tone(1));
  // La gueule, et ce qu'elle laisse couler.
  b.arch(0, -26, 150, 132, tone(5));
  b.arch(0, -26, 132, 120, STONE[0]);
  const hot = lit ? ['#c22e12', '#ff8a1e', '#ffe28a'] as const : [STONE[1], STONE[0], STONE[1]] as const;
  b.arch(0, -26, 104, 92, hot[0]);
  b.arch(0, -26, 72, 62, hot[1]);
  b.arch(0, -26, 36, 34, hot[2]);
  b.poly([[-30, -26], [30, -26], [48, 2], [-44, 2]], hot[0]);
  b.poly([[-12, -26], [14, -26], [20, 2], [-16, 2]], hot[1]);
  // L'enclume, au pied.
  const ax = -96, ay = 34;
  b.rect(ax - 12, ay - 26, 26, 26, IRON[1]);
  b.rect(ax - 30, ay - 40, 62, 14, IRON[2]);
  b.poly([[ax + 32, ay - 40], [ax + 54, ay - 34], [ax + 32, ay - 30]], IRON[2]);
  b.rect(ax - 30, ay - 40, 62, 3, IRON[3]);
}

/** Le colosse gelé : un géant pris debout dans la glace, le bras encore levé. */
export function paintFrozenColossus(b: Brush, lit: boolean): void {
  b.ellipse(8, 4, 140, 24, GROUND_SHADOW);
  b.ellipse(0, 0, 134, 24, SNOWS[0]);
  b.ellipse(-8, -4, 118, 18, SNOWS[1]);
  const top = -348;
  b.poly([[-118, -4], [-132, -160], [-84, -300], [-20, top], [58, -316], [116, -210], [124, -4]], ICES[1]);
  b.poly([[-118, -4], [-132, -160], [-84, -300], [-20, top], [-30, -4]], ICES[2]);
  b.poly([[-104, -30], [-112, -160], [-74, -280], [-34, -320], [-48, -200], [-62, -30]], ICES[3]);
  // La silhouette, sombre, vue à travers la glace.
  const body = lit ? '#1c3a54' : '#16304a', face = '#0e2436';
  b.ellipse(0, -254, 30, 34, body);
  b.poly([[-72, -214], [72, -214], [58, -92], [-54, -92]], body);
  b.poly([[-54, -92], [-8, -92], [-16, -8], [-52, -8]], body);
  b.poly([[8, -92], [54, -92], [52, -8], [16, -8]], body);
  b.poly([[62, -214], [88, -204], [104, -300], [78, -312]], body);
  b.poly([[-72, -214], [-92, -208], [-104, -96], [-76, -94]], body);
  b.rect(-12, -262, 8, 6, face);
  b.rect(8, -262, 8, 6, face);
  b.rect(-8, -240, 20, 4, face);
  for (const [x0, y0, x1, y1] of [[-96, -300, -20, -150], [-30, -210, 44, -96], [60, -300, 12, -170], [-70, -120, 8, -40]] as const) {
    b.poly([[x0, y0], [x0 + 3, y0], [x1 + 3, y1], [x1, y1]], ICES[4]);
  }
  for (const [x, h, w] of [[-146, 84, 22], [142, 70, 20], [-104, 52, 16], [108, 46, 14]] as const) {
    b.poly([[x - w, 4], [x + 2, -h], [x + w, 4]], ICES[1]);
    b.poly([[x - w, 4], [x + 2, -h], [x - 2, 4]], ICES[3]);
  }
}

const BARK2 = ['#0a0810', '#16121c', '#2a2430'] as const;
const SNOWS = ['#8ca8c0', '#c4dbe8'] as const;
const ICES = ['#16304a', '#2c5a7c', '#5a9cc0', '#a8e0f0', '#eefbff'] as const;
