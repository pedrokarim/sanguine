import { Brush, stoneHash } from './brush';
import { OUTLINE } from './castle';

/**
 * La végétation propre à chaque biome, peinte au pinceau : aplats francs, lumière à gauche, cerne.
 *
 * Une essence n'existe que dans un biome : c'est elle qui dit où l'on est, avant même le nom affiché
 * à l'écran. Chaque dessin se décline à la graine, et jamais par une trame.
 */

export type FloraTree = 'cypress' | 'mangrove' | 'mushroom' | 'obsidian' | 'frostpine' | 'crystal';
export type FloraProp =
  | 'heather' | 'gorse' | 'blackrose' | 'cattail' | 'lily' | 'thornbush' | 'fern'
  | 'emberflower' | 'cinder' | 'lavarock' | 'icecluster' | 'snowbush';

const FLORA_TREES: readonly string[] = ['cypress', 'mangrove', 'mushroom', 'obsidian', 'frostpine', 'crystal'];
const FLORA_PROPS: readonly string[] = ['heather', 'gorse', 'blackrose', 'cattail', 'lily', 'thornbush', 'fern', 'emberflower', 'cinder', 'lavarock', 'icecluster', 'snowbush'];

export const isFloraTree = (kind: string): kind is FloraTree => FLORA_TREES.includes(kind);
export const isFloraProp = (kind: string): kind is FloraProp => FLORA_PROPS.includes(kind);

const BARK = ['#141014', '#241c1c', '#3a2c26'] as const;
const CYPRESS = ['#0e1a1c', '#162a2a', '#20403a', '#2e5a4a'] as const;
const MANGROVE = ['#141e12', '#22331c', '#34502a', '#4e7036'] as const;
const CAP = ['#2a0e2c', '#54205a', '#8a3a94', '#c878d0'] as const;
const GLOW = ['#1a6a5c', '#3cd8b0', '#baffe6'] as const;
const OBSIDIAN = ['#08060e', '#14101e', '#262036', '#544a78'] as const;
const LAVA = ['#7e1a10', '#e0481a', '#ff9a2e', '#ffe28a'] as const;
const FROST = ['#16304a', '#2c5a7c', '#5a9cc0', '#a8e0f0', '#eefbff'] as const;
const SNOW = ['#8ca8c0', '#c4dbe8', '#f2fbff'] as const;
const STEM = ['#1c2a18', '#32482a', '#4e6a3a'] as const;

function trunk(b: Brush, x: number, foot: number, w: number, h: number): void {
  b.rect(x - w / 2, foot - h, w, h, BARK[1]);
  b.rect(x - w / 2, foot - h, Math.max(1, w * 0.35), h, BARK[2]);
  b.rect(x + w / 2 - 1, foot - h, 1, h, BARK[0]);
}

/** Cyprès de cimetière : une flamme sombre, haute et serrée, à trois plans seulement. */
function cypress(b: Brush, s: number, seed: number): void {
  const W = 15 * s, H = 74 * s, foot = 0, top = foot - H, lean = (stoneHash(seed, 1) - 0.5) * 6;
  trunk(b, 0, foot, 5 * s, 10 * s);
  b.poly([[-W, foot - 8 * s], [-W * 0.72, foot - H * 0.5], [lean, top], [W * 0.72, foot - H * 0.5], [W, foot - 8 * s], [0, foot - 2 * s]], CYPRESS[1]);
  b.poly([[-W, foot - 8 * s], [-W * 0.72, foot - H * 0.5], [lean, top], [lean - 1, foot - 6 * s]], CYPRESS[2]);
  b.poly([[-W * 0.7, foot - H * 0.34], [-W * 0.5, foot - H * 0.6], [lean - 2, top + 8 * s], [-W * 0.16, foot - H * 0.4]], CYPRESS[3]);
  for (let k = 0; k < 5; k++) {
    const y = foot - H * (0.2 + k * 0.14);
    b.rect(W * 0.12, y, W * 0.5 * (1 - k * 0.12), 2, CYPRESS[0]);
  }
}

/** Palétuvier : un tronc perché sur ses racines, que l'eau a déchaussé. */
function mangrove(b: Brush, s: number, seed: number): void {
  const H = 62 * s, foot = 0;
  for (const dx of [-20, -11, 0, 12, 22]) {
    const x = dx * s;
    b.poly([[x - 2, foot], [x + 1.5, foot], [x * 0.2 + 2, foot - 24 * s], [x * 0.2 - 2, foot - 24 * s]], BARK[dx % 2 ? 2 : 1]);
  }
  trunk(b, 0, foot - 18 * s, 8 * s, 24 * s);
  const blobs = [[-15, 42, 15, 12], [14, 44, 16, 11], [0, 52, 19, 13], [-6, 38, 12, 8]] as const;
  for (const [dx, dy, rx, ry] of blobs) b.ellipse(dx * s, -dy * s + 1, rx * s, ry * s, MANGROVE[0]);
  for (const [dx, dy, rx, ry] of blobs) b.ellipse(dx * s - 1, -dy * s, rx * s * 0.9, ry * s * 0.86, MANGROVE[1]);
  b.ellipse(-8 * s, -(H - 6 * s), 11 * s, 7 * s, MANGROVE[2]);
  b.ellipse(-12 * s, -(H - 3 * s), 5 * s, 3 * s, MANGROVE[3]);
  for (let k = 0; k < 5; k++) {
    const x = (stoneHash(seed, k) - 0.5) * 44 * s;
    b.rect(x, -34 * s, 1, 10 * s + stoneHash(seed, k + 9) * 12 * s, MANGROVE[1]);
  }
}

/** Champignon géant : le seul être vivant du marais qui donne encore de la lumière. */
function mushroom(b: Brush, s: number, seed: number): void {
  const H = 54 * s, R = 26 * s, foot = 0;
  b.poly([[-7 * s, foot], [7 * s, foot], [4 * s, foot - H * 0.72], [-4 * s, foot - H * 0.72]], '#a89ca8');
  b.poly([[-7 * s, foot], [-1, foot], [-1, foot - H * 0.72], [-4 * s, foot - H * 0.72]], '#d4c8d0');
  const cy = foot - H * 0.72;
  b.ellipse(0, cy + 4 * s, R * 0.9, 5 * s, GLOW[0]);
  b.poly([[-R, cy + 2 * s], [-R * 0.7, cy - 13 * s], [0, cy - 19 * s], [R * 0.7, cy - 13 * s], [R, cy + 2 * s]], CAP[1]);
  b.poly([[-R, cy + 2 * s], [-R * 0.7, cy - 13 * s], [0, cy - 19 * s], [-1, cy + 2 * s]], CAP[2]);
  b.poly([[-R * 0.7, cy - 8 * s], [-R * 0.5, cy - 14 * s], [-R * 0.1, cy - 17 * s], [-R * 0.2, cy - 8 * s]], CAP[3]);
  b.rect(-R, cy + 1, R * 2, 3, CAP[0]);
  for (let k = 0; k < 5; k++) {
    const x = (stoneHash(seed, k + 3) - 0.5) * R * 1.6, y = cy - 4 * s - stoneHash(seed, k + 4) * 9 * s;
    b.ellipse(x, y, 2.2 * s, 2 * s, GLOW[1]);
    b.rect(x - 1, y - 1, 1, 1, GLOW[2]);
  }
}

/** Aiguille d'obsidienne : la lave a figé en lames, et des veines y brûlent encore. */
function obsidian(b: Brush, s: number, seed: number): void {
  const H = (58 + stoneHash(seed, 2) * 22) * s, foot = 0;
  const spikes = [[-15, 0.55, 9], [13, 0.68, 10], [0, 1, 13]] as const;
  for (const [dx, q, w] of spikes) {
    const x = dx * s, hw = w * s, top = foot - H * q;
    b.poly([[x - hw, foot], [x + 2 * s, top], [x + hw, foot]], OBSIDIAN[1]);
    b.poly([[x - hw, foot], [x + 2 * s, top], [x - hw * 0.1, foot]], OBSIDIAN[2]);
    b.poly([[x - hw * 0.7, foot - H * q * 0.28], [x + 1, top + 4], [x - hw * 0.34, foot - H * q * 0.2]], OBSIDIAN[3]);
    const vein = x + hw * 0.32;
    for (let y = foot - 3; y > foot - H * q * 0.62; y -= 3) b.rect(vein + Math.sin(y * 0.4 + seed) * 2, y, 2, 3, y > foot - H * q * 0.3 ? LAVA[2] : LAVA[1]);
  }
  b.ellipse(0, foot, 26 * s, 5 * s, LAVA[0]);
}

/** Pin pris dans la glace : étages lourds de neige, et le bleu dans l'ombre. */
function frostpine(b: Brush, s: number, seed: number): void {
  const H = 72 * s, foot = 0;
  trunk(b, 0, foot, 6 * s, 16 * s);
  for (let k = 0; k < 4; k++) {
    const q = k / 4, y0 = foot - 10 * s - q * H * 0.8, y1 = y0 - H * 0.34, w = (24 - k * 5) * s, sway = (stoneHash(seed, k) - 0.5) * 3;
    b.poly([[-w, y0], [sway, y1], [w, y0]], FROST[1]);
    b.poly([[-w, y0], [sway, y1], [sway, y0]], FROST[2]);
    b.poly([[-w * 0.92, y0 - 1], [-w * 0.3, y0 - 8 * s], [sway, y1], [w * 0.26, y0 - 9 * s], [sway + 2, y0 - 6 * s], [-w * 0.44, y0 - 3 * s]], SNOW[1]);
    b.poly([[-w * 0.5, y0 - 5 * s], [sway - 1, y1 + 1], [-w * 0.1, y0 - 8 * s]], SNOW[2]);
  }
}

/** Amas de cristal : le lac l'a recraché, tout droit, en facettes. */
function crystal(b: Brush, s: number, seed: number): void {
  const foot = 0;
  const shards = [[-14, 34, 8, -4], [15, 42, 9, 3], [0, 66, 12, 1], [-5, 26, 7, -8], [9, 22, 6, 7]] as const;
  for (const [dx, h, w, lean] of shards) {
    const x = dx * s, hw = w * s, tip = lean * s + x, top = foot - h * s * (0.9 + stoneHash(seed, dx + 20) * 0.25);
    b.poly([[x - hw, foot], [x - hw * 0.8, top + 12 * s], [tip, top], [x + hw * 0.8, top + 12 * s], [x + hw, foot]], FROST[2]);
    b.poly([[x - hw, foot], [x - hw * 0.8, top + 12 * s], [tip, top], [x - hw * 0.1, foot]], FROST[3]);
    b.poly([[x - hw * 0.6, foot - 6 * s], [x - hw * 0.5, top + 14 * s], [tip - 1, top + 3], [x - hw * 0.26, foot - 6 * s]], FROST[4]);
    b.rect(x + hw * 0.5, top + 14 * s, 2, (foot - top) * 0.5, FROST[1]);
  }
}

const TREES: Readonly<Record<FloraTree, (b: Brush, s: number, seed: number) => void>> = { cypress, mangrove, mushroom, obsidian, frostpine, crystal };

function sprite(w: number, h: number, paint: (b: Brush) => void): HTMLCanvasElement {
  const pad = 3;
  const b = new Brush(-w / 2 - pad, -h - pad, w + pad * 2, h + pad * 2 + 8);
  paint(b);
  b.outline(OUTLINE);
  return b.toCanvas(0);
}

const cache = new Map<string, HTMLCanvasElement>();

/** Le pied se trouve à 11 px du bas du sprite : le rendu pose les arbres sur cette ligne. */
export function floraTree(kind: FloraTree, variant: number, grand: boolean): HTMLCanvasElement {
  const key = `t:${kind}:${variant}:${grand}`;
  let c = cache.get(key);
  if (!c) {
    const s = grand ? 1 : 0.74;
    c = sprite(84 * s, 100 * s, (b) => TREES[kind](b, s, variant * 13 + 3));
    cache.set(key, c);
  }
  return c;
}

function tuft(b: Brush, x: number, h: number, c: string, lean: number): void {
  b.poly([[x - 1.5, 0], [x + 1.5, 0], [x + lean, -h]], c);
}

function paintProp(b: Brush, kind: FloraProp, seed: number): void {
  const R = (k: number): number => stoneHash(seed, k);
  switch (kind) {
    case 'heather':
      for (let k = 0; k < 9; k++) {
        const x = (R(k) - 0.5) * 30, h = 7 + R(k + 20) * 9;
        tuft(b, x, h, STEM[1], (R(k + 30) - 0.5) * 6);
        b.ellipse(x + (R(k + 30) - 0.5) * 6, -h, 3, 2.4, k % 3 ? '#8a3a94' : '#c878d0');
      }
      break;
    case 'gorse':
      b.ellipse(0, -8, 15, 9, STEM[0]);
      b.ellipse(-2, -10, 12, 7, STEM[1]);
      for (let k = 0; k < 10; k++) b.rect((R(k) - 0.5) * 24, -3 - R(k + 20) * 13, 3, 3, k % 3 ? '#e0a828' : '#ffe28a');
      break;
    case 'blackrose':
      for (let k = 0; k < 4; k++) {
        const x = (R(k) - 0.5) * 20, h = 9 + R(k + 20) * 6;
        tuft(b, x, h, STEM[0], 0);
        b.ellipse(x, -h, 4, 3.4, '#3a0a14');
        b.ellipse(x - 1, -h - 1, 2.4, 2, '#8e1a2a');
        b.rect(x - 1, -h - 2, 2, 1, '#c42639');
      }
      break;
    case 'cattail':
      for (let k = 0; k < 5; k++) {
        const x = (R(k) - 0.5) * 20, h = 18 + R(k + 20) * 14, lean = (R(k + 30) - 0.5) * 7;
        tuft(b, x, h, STEM[2], lean);
        if (k % 2 === 0) {
          b.rect(x + lean - 2, -h - 1, 4, 9, '#3e2616');
          b.rect(x + lean - 2, -h - 1, 2, 9, '#6a4426');
        }
      }
      break;
    case 'lily':
      b.ellipse(0, -2, 15, 6, MANGROVE[0]);
      b.ellipse(-1, -3, 14, 5, MANGROVE[2]);
      b.poly([[0, -3], [9, -7], [13, -3]], '#10241c');
      b.ellipse(-3, -6, 4, 3, '#e6a8c8');
      b.ellipse(-3, -7, 2, 1.6, '#ffe28a');
      break;
    case 'thornbush':
      b.ellipse(0, -9, 16, 10, BARK[0]);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI + Math.PI + (R(k) - 0.5) * 0.4, r = 11 + R(k + 20) * 9;
        b.poly([[Math.cos(a) * 5 - 1, -7], [Math.cos(a) * 5 + 2, -7], [Math.cos(a) * r, -8 + Math.sin(a) * r]], k % 3 ? BARK[1] : BARK[2]);
      }
      b.rect(-6, -14, 3, 2, '#8e1a2a');
      b.rect(6, -11, 3, 2, '#8e1a2a');
      break;
    case 'fern':
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI * (0.14 + k * 0.145), l = 13 + R(k) * 6, x = Math.cos(a) * l, y = Math.sin(a) * l * 0.9;
        b.poly([[-1, 0], [1, 0], [x, y]], STEM[1]);
        b.poly([[x * 0.3, y * 0.3 - 2], [x * 0.3, y * 0.3 + 2], [x, y]], k % 2 ? STEM[2] : STEM[1]);
      }
      break;
    case 'emberflower':
      for (let k = 0; k < 3; k++) {
        const x = (k - 1) * 9, h = 9 + R(k) * 6;
        tuft(b, x, h, '#2a1a18', 0);
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          b.ellipse(x + Math.cos(a) * 3, -h + Math.sin(a) * 2.6, 1.8, 1.6, LAVA[1]);
        }
        b.ellipse(x, -h, 1.8, 1.6, LAVA[3]);
      }
      break;
    case 'cinder':
      b.ellipse(0, -4, 15, 7, '#1a1416');
      b.ellipse(-3, -6, 10, 5, '#2e2426');
      b.rect(-2, -5, 5, 1, LAVA[1]);
      b.rect(3, -3, 3, 1, LAVA[2]);
      break;
    case 'lavarock':
      b.ellipse(0, -6, 17, 9, OBSIDIAN[1]);
      b.ellipse(-3, -8, 12, 6, OBSIDIAN[2]);
      for (let k = 0; k < 4; k++) b.rect(-10 + k * 6, -9 + (k % 2) * 4, 5, 1, k % 2 ? LAVA[1] : LAVA[2]);
      break;
    case 'icecluster':
      for (const [dx, h, w] of [[-8, 13, 5], [7, 16, 6], [0, 22, 7]] as const) {
        b.poly([[dx - w, 0], [dx, -h], [dx + w, 0]], FROST[2]);
        b.poly([[dx - w, 0], [dx, -h], [dx - 1, 0]], FROST[3]);
      }
      b.rect(-1, -15, 2, 8, FROST[4]);
      break;
    case 'snowbush':
      b.ellipse(0, -7, 15, 8, FROST[1]);
      b.ellipse(-1, -9, 14, 6, SNOW[1]);
      b.ellipse(-4, -11, 8, 3, SNOW[2]);
      break;
  }
}

export function floraProp(kind: FloraProp, variant: number): HTMLCanvasElement {
  const key = `p:${kind}:${variant}`;
  let c = cache.get(key);
  if (!c) {
    c = sprite(44, 38, (b) => paintProp(b, kind, variant * 7 + 2));
    cache.set(key, c);
  }
  return c;
}
