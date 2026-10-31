import { Brush, stoneHash } from './brush';
import { GROUND_SHADOW, IRON, MOSS, WOOD } from './castle';

/**
 * Le village en ruine, peint à la main.
 *
 * Pierre chaude et bois brûlé, là où le château est bleu et froid : on doit savoir au premier
 * regard si l'on est chez les seigneurs ou chez ceux qu'ils ont laissés mourir. Tout est encore
 * à l'échelle des arbres : un mur de maison debout atteint un arbre adulte, un pignon le dépasse.
 *
 * Une ruine se dessine par son **profil** : une liste de hauteurs le long du mur, écrite à la
 * main pour chaque maison. C'est ce profil qui raconte ce qui s'est effondré, et de quel côté.
 * Le haut du mur montre sa tranche, décalée de sa hauteur : la cassure a une épaisseur.
 */

/** Rampe de pierre chaude, du noir au clair. */
export const RUBBLE = ['#161214', '#272122', '#3a3232', '#4e4442', '#675b55', '#84776d', '#a89a8b'] as const;
const PLASTER = ['#4a4338', '#5e5647', '#756b58'] as const;
const ROOF_TILES = ['#2c1a19', '#42261f', '#5a3528', '#6e4431'] as const;
const CHAR = '#191413';

const tone = (i: number): string => RUBBLE[Math.max(0, Math.min(RUBBLE.length - 1, i))]!;

/** Une liste de hauteurs : `[position, hauteur]`, position croissante. */
export type Profile = readonly (readonly [number, number])[];

/** Hauteur d'un profil, en marches de quatre pixels et hachée : une cassure n'est jamais lisse. */
function heightAt(p: Profile, v: number, seed: number): number {
  let h = p[p.length - 1]![1];
  for (let i = 0; i + 1 < p.length; i++) {
    const [a, ha] = p[i]!, [c, hc] = p[i + 1]!;
    if (v >= a && v <= c) { h = ha + ((hc - ha) * (v - a)) / Math.max(1, c - a); break; }
  }
  if (v < p[0]![0]) h = p[0]![1];
  if (h < 2) return 0;
  const jag = (stoneHash(Math.floor(v / 12), seed) - 0.5) * 12;
  return Math.max(2, Math.round((h + jag) / 4) * 4);
}

/** Pierres de taille, par plaques : le même principe que les remparts, en plus grossier. */
function stones(b: Brush, x0: number, x1: number, top: number, bottom: number, base: number): void {
  b.rect(x0, top, x1 - x0, bottom - top, tone(base));
  const H = 12;
  for (let row = Math.floor(top / H); row * H < bottom; row++) {
    const stagger = row % 2 ? 16 : 0;
    for (let x = Math.floor(x0 / 32) * 32 + stagger - 32; x < x1; x += 32) {
      if (stoneHash(Math.floor(x / 80), Math.floor(row / 3)) > 0.62 || stoneHash(x, row) > 0.74) continue;
      const left = Math.max(x, x0), right = Math.min(x + 32, x1);
      if (right <= left) continue;
      const y0 = Math.max(row * H, top), y1 = Math.min(row * H + H, bottom);
      if (y1 <= y0) continue;
      const pick = stoneHash(x + 3, row + 5);
      if (pick < 0.28) b.rect(left, y0, right - left, y1 - y0, tone(base + 1));
      else if (pick < 0.44) b.rect(left, y0, right - left, y1 - y0, tone(base - 1));
      b.rect(left, y1 - 1, right - left, 1, tone(base - 1));
      b.rect(right - 1, y0, 1, y1 - y0, tone(base - 1));
    }
  }
}

export interface RuinWall {
  x0: number;
  x1: number;
  /** Bord nord de l'emprise. */
  y: number;
  depth: number;
  profile: Profile;
  /** Portes : `[centre, largeur, hauteur]`. */
  doors?: readonly (readonly [number, number, number])[];
  /** Fenêtres : `[centre, hauteur du seuil, largeur, hauteur]`. */
  windows?: readonly (readonly [number, number, number, number])[];
  /** Étage à colombages, au-dessus de cette hauteur. */
  timberAbove?: number;
  /** Ogives plutôt que linteaux : une église. */
  gothic?: boolean;
  seed: number;
}

/** Mur est-ouest : une face peinte, taillée à sa silhouette, et sa tranche par-dessus. */
export function paintRuinWall(b: Brush, w: RuinWall): void {
  const foot = w.y + w.depth;
  let maxH = 0;
  for (const [, h] of w.profile) maxH = Math.max(maxH, h);
  maxH += 12;
  b.rect(w.x0, foot, w.x1 - w.x0, 6, GROUND_SHADOW);
  b.layer((f) => {
    stones(f, w.x0, w.x1, foot - maxH, foot, 3);
    stones(f, w.x0, w.x1, foot - 14, foot, 2);
    if (w.timberAbove !== undefined) {
      const y1 = foot - w.timberAbove;
      f.rect(w.x0, foot - maxH, w.x1 - w.x0, y1 - foot + maxH, PLASTER[1]);
      for (let x = Math.floor(w.x0 / 44) * 44; x < w.x1; x += 44) {
        if (stoneHash(x, 2) < 0.4) f.rect(x + 8, y1 - 34, 22, 20, PLASTER[0]);
        else if (stoneHash(x, 4) < 0.5) f.rect(x + 4, y1 - 60, 16, 14, PLASTER[2]);
        f.rect(x, foot - maxH, 6, y1 - foot + maxH, WOOD[1]);
        f.rect(x, foot - maxH, 2, y1 - foot + maxH, WOOD[2]);
        // Écharpes : les bois en diagonale qui signent un colombage.
        const left = x % 88 === 0;
        f.poly([[x + (left ? 6 : 44), y1], [x + (left ? 12 : 38), y1], [x + (left ? 44 : 6), y1 - 40], [x + (left ? 38 : 12), y1 - 40]], WOOD[1]);
      }
      f.rect(w.x0, y1 - 6, w.x1 - w.x0, 6, WOOD[2]);
      f.rect(w.x0, y1 - 6, w.x1 - w.x0, 2, WOOD[3]);
      f.rect(w.x0, y1, w.x1 - w.x0, 2, CHAR);
    }
    for (const [cx, dw, dh] of w.doors ?? []) {
      f.rect(cx - dw / 2 - 5, foot - dh - 5, dw + 10, dh + 5, tone(5));
      f.rect(cx - dw / 2 - 2, foot - dh - 3, dw + 6, dh + 3, tone(1));
      f.erase(cx - dw / 2, foot - dh, dw, dh + 1);
    }
    for (const [cx, sill, ww, wh] of w.windows ?? []) {
      if (w.gothic) {
        f.arch(cx, foot - sill + 2, ww + 8, wh + 7, tone(5));
        f.cutArch(cx, foot - sill, ww, wh);
      } else {
        f.rect(cx - ww / 2 - 4, foot - sill - wh - 4, ww + 8, wh + 8, tone(5));
        f.erase(cx - ww / 2, foot - sill - wh, ww, wh);
        f.rect(cx - 1, foot - sill - wh, 3, wh, WOOD[1]);
      }
    }
    // Taille de la silhouette, colonne par colonne, et la tranche de la cassure.
    for (let x = Math.floor(w.x0 / 4) * 4; x < w.x1; x += 4) {
      const h = heightAt(w.profile, x + 2, w.seed);
      f.erase(x, foot - maxH - w.depth - 4, 4, maxH + w.depth + 4 - h);
      if (h <= 0) continue;
      f.rect(x, foot - h - w.depth, 4, w.depth, tone(4));
      f.rect(x, foot - h - w.depth, 4, 2, tone(6));
      f.rect(x, foot - h - 2, 4, 2, tone(5));
    }
  });
}

/** Mur nord-sud : on n'en voit que la tranche, en marches qui descendent ou remontent. */
export function paintRuinWallNS(b: Brush, x: number, y0: number, y1: number, depth: number, profile: Profile, seed: number): void {
  const STEP = 8;
  for (let y = Math.floor(y0 / STEP) * STEP; y < y1; y += STEP) {
    const h = heightAt(profile, y + 4 - y0, seed);
    if (h <= 0) continue;
    const next = y + STEP < y1 ? heightAt(profile, y + 12 - y0, seed) : 0;
    b.rect(x, y - h, depth, STEP, tone(4));
    b.rect(x, y - h, 2, STEP, tone(5));
    b.rect(x + depth - 2, y - h, 2, STEP, tone(2));
    if (next < h) {
      b.rect(x, y + STEP - h, depth, h - next, tone(3));
      b.rect(x, y + STEP - h, depth, 2, tone(5));
      b.rect(x + depth - 2, y + STEP - h, 2, h - next, tone(1));
    }
  }
}

/** Bout de toit encore accroché : des tuiles au bord rongé, et les chevrons nus au-delà. */
export function paintRoofChunk(b: Brush, x0: number, x1: number, ridge: number, eave: number, seed: number): void {
  const span = eave - ridge;
  for (let x = x0; x < x1; x += 4) {
    const bite = stoneHash(Math.floor(x / 16), seed);
    const reach = span * (0.28 + bite * 0.5) * (1 - Math.abs((x - x0) / (x1 - x0) - 0.4) * 0.8);
    b.rect(x, ridge, 4, Math.round(reach / 4) * 4, ROOF_TILES[1]);
    for (let row = 0; row * 9 < reach - 2; row++) {
      const k = Math.floor((x + (row % 2) * 8) / 16);
      const c = ROOF_TILES[stoneHash(k, row + seed) < 0.3 ? 2 : stoneHash(k + 1, row) < 0.3 ? 0 : 1]!;
      b.rect(x, ridge + row * 9, 4, 8, c);
      b.rect(x, ridge + row * 9 + 8, 4, 1, ROOF_TILES[0]);
    }
  }
  for (let x = x0 + 10; x < x1; x += 30) {
    b.rect(x, ridge, 4, span, WOOD[1]);
    b.rect(x, ridge, 1, span, WOOD[3]);
  }
  b.rect(x0 - 8, ridge - 4, x1 - x0 + 16, 6, WOOD[2]);
  b.rect(x0 - 8, ridge - 4, x1 - x0 + 16, 2, WOOD[3]);
}

/** Cheminée seule debout : tout le reste de la maison a brûlé autour d'elle. */
export function paintChimney(b: Brush, x: number, foot: number, w: number, h: number): void {
  b.rect(x + 2, foot, w + 6, 6, GROUND_SHADOW);
  stones(b, x, x + w, foot - h, foot, 3);
  b.rect(x, foot - h, 5, h, tone(5));
  b.rect(x + w - 6, foot - h, 6, h, tone(2));
  b.rect(x - 4, foot - h - 8, w + 8, 8, tone(5));
  b.rect(x - 4, foot - h - 8, w + 8, 2, tone(6));
  b.rect(x + w / 2 - 8, foot - h - 16, 16, 8, tone(4));
  // L'âtre, où l'on devine encore la braise.
  b.arch(x + w / 2, foot, w - 12, 46, RUBBLE[0]);
  b.rect(x + w / 2 - 8, foot - 6, 16, 4, '#7a2a18');
  b.rect(x + w / 2 - 3, foot - 5, 6, 2, '#d9742a');
}

/** Éboulis d'une maison : quelques gros blocs, des poutres. */
export function paintDebris(b: Brush, x: number, foot: number, w: number, seed: number): void {
  b.ellipse(x + w / 2 + 2, foot - 2, w / 2 + 2, 6, GROUND_SHADOW);
  const n = Math.round(w / 12);
  for (let k = 0; k < n; k++) {
    const q = stoneHash(seed, k) * 2 - 1;
    const hh = 26 * (1 - q * q);
    const bx = x + w / 2 + (q * w) / 2;
    const by = foot - stoneHash(k, seed) * hh;
    const s = 8 + stoneHash(seed + k, 9) * 9;
    b.rect(bx - s / 2, by - s, s, s, tone(3 + Math.floor(stoneHash(seed, k + 5) * 2)));
    b.rect(bx - s / 2, by - s, s, 2, tone(5));
    b.rect(bx + s / 2 - 2, by - s + 2, 2, s - 2, tone(1));
  }
  const bx = x + w * 0.2, bw = w * 0.6;
  b.poly([[bx, foot - 10], [bx + bw, foot - 26], [bx + bw, foot - 20], [bx, foot - 4]], WOOD[1]);
  b.poly([[bx, foot - 10], [bx + bw, foot - 26], [bx + bw, foot - 24], [bx, foot - 8]], WOOD[2]);
}

/** Sol battu d'une maison. Un aplat, posé sous les murs. */
export function paintHouseFloor(b: Brush, x: number, y: number, w: number, h: number): void {
  b.rect(x, y, w, h, '#231f22');
  for (let py = y; py < y + h; py += 20) {
    if (stoneHash(py, 3) < 0.6) b.rect(x + 6 + stoneHash(py, 1) * (w - 60), py + 6, 30 + stoneHash(py, 2) * 40, 3, '#2a2528');
  }
}

/** Rue : terre et pavés, aux bords irréguliers, sans la moindre trame. */
export function paintStreet(b: Brush, x0: number, y0: number, x1: number, y1: number, half: number, seed: number): void {
  const horizontal = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
  const len = horizontal ? x1 - x0 : y1 - y0;
  for (let t = 0; t < len; t += 12) {
    const a = half + Math.floor(stoneHash(Math.floor(t / 24), seed) * 3) * 6;
    const c = half + Math.floor(stoneHash(Math.floor(t / 24), seed + 1) * 3) * 6;
    if (horizontal) {
      b.rect(x0 + t, y0 - a, 12, a + c, '#2a2628');
      for (let k = -a + 4; k < c - 8; k += 16) {
        if (stoneHash(t, k + seed) < 0.44) b.rect(x0 + t + 1, y0 + k, 10, 12, stoneHash(k, t) < 0.5 ? '#332e30' : '#2f2a2c');
      }
    } else {
      b.rect(x0 - a, y0 + t, a + c, 12, '#2a2628');
      for (let k = -a + 4; k < c - 8; k += 16) {
        if (stoneHash(k + seed, t) < 0.44) b.rect(x0 + k, y0 + t + 1, 12, 10, stoneHash(t, k) < 0.5 ? '#332e30' : '#2f2a2c');
      }
    }
  }
}

/** Place : un grand ovale de pavés. */
export function paintSquare(b: Brush, cx: number, cy: number, rx: number, ry: number, seed: number): void {
  for (let row = -Math.ceil(ry / 12); row <= Math.ceil(ry / 12); row++) {
    const q = (row * 12) / ry;
    if (Math.abs(q) >= 1) continue;
    const half = rx * Math.sqrt(1 - q * q) + (stoneHash(row, seed) - 0.5) * 16;
    b.rect(cx - half, cy + row * 12, half * 2, 12, '#2a2628');
    for (let x = Math.floor((cx - half) / 18) * 18 + (row % 2 ? 9 : 0); x < cx + half - 14; x += 18) {
      if (stoneHash(x, row + seed) < 0.5) b.rect(x, cy + row * 12 + 1, 16, 10, stoneHash(row, x) < 0.5 ? '#363133' : '#312c2e');
    }
  }
}

/** Tour de clocher éventrée, ou tour de guet. */
export function paintRuinTower(b: Brush, x: number, y: number, w: number, d: number, profile: Profile, seed: number): void {
  const foot = y + d;
  let maxH = 0;
  for (const [, h] of profile) maxH = Math.max(maxH, h);
  maxH += 12;
  b.rect(x, foot, w + 8, 8, GROUND_SHADOW);
  b.layer((f) => {
    stones(f, x, x + w, foot - maxH, foot, 3);
    f.rect(x, foot - maxH, 5, maxH, tone(5));
    f.rect(x + w - 8, foot - maxH, 8, maxH, tone(2));
    for (const cy of [foot - 50, foot - 120, foot - 190]) {
      f.rect(x, cy, w, 3, tone(5));
      f.rect(x, cy + 3, w, 2, tone(1));
    }
    f.arch(x + w / 2, foot - 128, 30, 60, tone(5));
    f.cutArch(x + w / 2, foot - 130, 22, 52);
    f.arch(x + w / 2, foot, 42, 66, tone(5));
    f.cutArch(x + w / 2, foot, 34, 60);
    for (let c = Math.floor(x / 4) * 4; c < x + w; c += 4) {
      const h = heightAt(profile, c + 2 - x, seed);
      f.erase(c, foot - maxH - d - 4, 4, maxH + d + 4 - h);
      f.rect(c, foot - h - d, 4, d, tone(4));
      f.rect(c, foot - h - d, 4, 2, tone(6));
      f.rect(c, foot - h - 2, 4, 2, tone(5));
    }
  });
}

/** Tombe de village : une croix de bois, de guingois. */
export function paintWoodCross(b: Brush, cx: number, foot: number, lean: number): void {
  b.ellipse(cx + 1, foot, 7, 3, GROUND_SHADOW);
  b.ellipse(cx, foot - 2, 12, 4, '#2e2826');
  b.poly([[cx - 2, foot], [cx + lean - 2, foot - 34], [cx + lean + 2, foot - 34], [cx + 2, foot]], WOOD[2]);
  b.poly([[cx + lean * 0.7 - 11, foot - 22], [cx + lean * 0.7 + 11, foot - 25], [cx + lean * 0.7 + 11, foot - 21], [cx + lean * 0.7 - 11, foot - 18]], WOOD[3]);
}

/** Stèle de pierre. */
export function paintHeadstone(b: Brush, cx: number, foot: number): void {
  b.ellipse(cx + 1, foot, 11, 3, GROUND_SHADOW);
  b.rect(cx - 9, foot - 26, 18, 26, tone(4));
  b.ellipse(cx, foot - 26, 9, 7, tone(4));
  b.rect(cx - 9, foot - 30, 4, 30, tone(5));
  b.rect(cx + 5, foot - 26, 4, 26, tone(2));
  b.rect(cx - 1, foot - 24, 2, 12, tone(1));
  b.rect(cx - 4, foot - 20, 8, 2, tone(1));
}

/** Charrette renversée, restée au milieu de la rue. */
export function paintCart(b: Brush, cx: number, foot: number): void {
  b.ellipse(cx + 2, foot, 44, 7, GROUND_SHADOW);
  b.poly([[cx - 40, foot - 12], [cx + 34, foot - 24], [cx + 38, foot - 6], [cx - 34, foot + 2]], WOOD[1]);
  b.poly([[cx - 40, foot - 12], [cx + 34, foot - 24], [cx + 34, foot - 20], [cx - 40, foot - 8]], WOOD[3]);
  for (const dx of [-16, 8]) b.rect(cx + dx, foot - 20 - dx * 0.12, 3, 22, WOOD[0]);
  b.ellipse(cx - 18, foot - 22, 15, 15, WOOD[0]);
  b.ellipse(cx - 18, foot - 22, 12, 12, WOOD[2]);
  b.ellipse(cx - 18, foot - 22, 9, 9, WOOD[0]);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    b.rect(cx - 18 + Math.cos(a) * 7, foot - 22 + Math.sin(a) * 7, 2, 2, WOOD[2]);
  }
  b.rect(cx - 20, foot - 24, 4, 4, IRON[2]);
  b.poly([[cx + 34, foot - 12], [cx + 62, foot - 2], [cx + 60, foot + 2], [cx + 34, foot - 8]], WOOD[2]);
}

/** Étal effondré : un auvent de toile sur deux piquets, de travers. */
export function paintStall(b: Brush, cx: number, foot: number): void {
  b.rect(cx - 36, foot, 76, 5, GROUND_SHADOW);
  b.rect(cx - 34, foot - 56, 4, 56, WOOD[2]);
  b.rect(cx + 28, foot - 40, 4, 40, WOOD[1]);
  b.rect(cx - 30, foot - 18, 56, 18, WOOD[1]);
  b.rect(cx - 30, foot - 18, 56, 2, WOOD[3]);
  b.poly([[cx - 40, foot - 62], [cx + 38, foot - 42], [cx + 30, foot - 28], [cx - 44, foot - 46]], '#5a2b2b');
  b.poly([[cx - 40, foot - 62], [cx + 38, foot - 42], [cx + 36, foot - 38], [cx - 42, foot - 56]], '#7a3a35');
  for (let k = 0; k < 5; k++) b.rect(cx - 22 + k * 11, foot - 26, 7, 8, k % 2 ? '#5e4a2e' : WOOD[2]);
}

/** Tonneaux et caisses : de quoi remplir un coin de rue. */
export function paintBarrels(b: Brush, cx: number, foot: number): void {
  b.ellipse(cx + 2, foot, 22, 5, GROUND_SHADOW);
  for (const [dx, dy] of [[-12, 0], [11, -2], [0, -22]] as const) {
    b.rect(cx + dx - 9, foot + dy - 22, 18, 22, WOOD[2]);
    b.rect(cx + dx - 9, foot + dy - 22, 5, 22, WOOD[3]);
    b.rect(cx + dx + 4, foot + dy - 22, 5, 22, WOOD[1]);
    b.rect(cx + dx - 9, foot + dy - 17, 18, 2, IRON[1]);
    b.rect(cx + dx - 9, foot + dy - 7, 18, 2, IRON[1]);
    b.ellipse(cx + dx, foot + dy - 22, 9, 3, WOOD[1]);
  }
}

/** Palissade de bois écroulée, le long d'un enclos. */
export function paintFence(b: Brush, x0: number, x1: number, foot: number, seed: number): void {
  b.rect(x0, foot - 18, x1 - x0, 3, WOOD[2]);
  b.rect(x0, foot - 8, x1 - x0, 3, WOOD[1]);
  for (let x = x0; x < x1; x += 20) {
    const h = 20 + stoneHash(x, seed) * 12;
    if (stoneHash(x, seed + 1) < 0.2) continue;
    b.rect(x, foot - h, 5, h, WOOD[1]);
    b.rect(x, foot - h, 2, h, WOOD[3]);
  }
}

/** Touffe de ronces, qui reprend le terrain. */
export function paintBrambles(b: Brush, cx: number, foot: number, r: number, seed: number): void {
  for (let k = 0; k < 7; k++) {
    const a = stoneHash(seed, k) * Math.PI * 2, q = stoneHash(k, seed) * r;
    b.ellipse(cx + Math.cos(a) * q, foot - 6 + Math.sin(a) * q * 0.3, r * 0.5, r * 0.34, MOSS[k % 3 === 0 ? 2 : 1]);
  }
}
