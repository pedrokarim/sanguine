import { FIGURES, LEG_FAR, LEG_LIFT, LEG_NEAR, LEG_PLANT, type Figure, type FigurePart } from './herofigures';
import { hexToRgb, mix, rgbToHex } from './palette';
import { EMPTY, Pix, toCanvas } from './pix';
import type { HeroArt } from './sprites';

/**
 * Le héros : assemble les cartes de `herofigures.ts` en une boucle.
 *
 * Tout bouge par pixels entiers et aucun ombrage n'est recalculé : le sprite reste lisible sur
 * l'image où on l'arrête, et rien ne scintille sur le personnage que l'œil suit toute la partie.
 * Les 40 colonnes gardent l'icône de sélection à l'échelle 1, et le contour des pieds tombe sur la
 * dernière ligne, car le renderer ancre le héros par le bas du cadre.
 */

const W = 40;
const H = 35;
const FRAMES = 8;
const HIP_Y = 23;

const NIGHT = '#0c0a18';
const WARM = '#fff4d8';
const DEFAULT_TROUSERS = ['#70748a', '#3e4052', '#22222e'] as const;
const DEFAULT_BOOTS = ['#94694a', '#523828'] as const;

/** Une lettre vers son rang dans la palette ; le contour `k` doit rester au rang 0. */
const LETTERS = 'keHhjsSzVCcdDTtuAabWmnNpPqOo';
const OUTLINE = 0;

/** La jambe du fond, un cran plus sombre : c'est elle qui fait lire la foulée. */
const FAR_SHADE: Readonly<Record<string, string>> = { p: 'P', P: 'q', m: 'p', O: 'o', o: 'k' };

interface Leg {
  rows: readonly string[];
  x: number;
  far?: boolean;
}

const STANCE: readonly [Leg, Leg] = [{ rows: LEG_FAR, x: 10 }, { rows: LEG_NEAR, x: 21 }];

/** Pose d'écart, jambes croisées, l'autre écart, l'autre croisement. */
const STRIDE: readonly (readonly [Leg, Leg])[] = [
  [{ rows: LEG_FAR, x: 10, far: true }, { rows: LEG_NEAR, x: 21 }],
  [{ rows: LEG_PLANT, x: 16, far: true }, { rows: LEG_LIFT, x: 19 }],
  [{ rows: LEG_NEAR, x: 21, far: true }, { rows: LEG_FAR, x: 10 }],
  [{ rows: LEG_LIFT, x: 19, far: true }, { rows: LEG_PLANT, x: 16 }],
];

/** Saturée et assez claire pour ressortir d'un sol sombre, quelle que soit la teinte d'origine. */
function vivid(color: string): string {
  const [r, g, b] = hexToRgb(color).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const chroma = max - min;
  // Une teinte déjà très claire, comme le suaire de Sœur Ombre, le reste.
  if (light > 0.6 || chroma === 0) return color;
  const targetLight = Math.max(0.36, Math.min(0.44, light * 1.4));
  const saturation = Math.min(0.68, Math.max(0.5, (chroma / (1 - Math.abs(2 * light - 1))) * 1.3));
  const gain = Math.min(1, saturation) * (1 - Math.abs(2 * targetLight - 1));
  const channel = (v: number): number => (targetLight + ((v - light) / chroma) * gain) * 255;
  return rgbToHex(channel(r), channel(g), channel(b));
}

/** Dans l'ordre de `LETTERS`. */
function paletteOf(art: HeroArt, figure: Figure): string[] {
  const cape = vivid(art.cloak);
  const [hairHi, hair, hairLow] = figure.hair;
  const [legHi, leg, legLow] = figure.trousers ?? DEFAULT_TROUSERS;
  const [boot, bootLow] = figure.boots ?? DEFAULT_BOOTS;
  return [
    '#08060c', '#08060c',
    hairHi, hair, hairLow,
    art.skin, mix(art.skin, '#7a3a28', 0.32), mix(art.skin, '#3a1a18', 0.55),
    mix(cape, WARM, 0.55), mix(cape, WARM, 0.2), cape, mix(cape, NIGHT, 0.5), mix(cape, NIGHT, 0.75),
    mix(art.cloth, WARM, 0.2), mix(art.cloth, NIGHT, 0.5), mix(art.cloth, NIGHT, 0.75),
    mix(art.accent, WARM, 0.55), art.accent, mix(art.accent, NIGHT, 0.5),
    '#fffaf0', '#d4d8e4', '#6a7084', '#4a5064',
    legHi, leg, legLow, boot, bootLow,
  ];
}

function stamp(
  p: Pix, rows: readonly string[], x: number, y: number, swap?: Readonly<Record<string, string>>,
): void {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const letter = row[i]!;
      if (letter !== '.') p.set(x + i, y + j, LETTERS.indexOf(swap?.[letter] ?? letter));
    }
  });
}

/** Le tissu tient en haut et flotte en bas : chaque ligne glisse d'autant qu'elle est basse. */
function drawCloth(p: Pix, part: FigurePart, frame: number, moving: boolean, bob: number): void {
  const last = Math.max(1, part.rows.length - 1);
  const phase = (frame / FRAMES) * Math.PI * 2;
  part.rows.forEach((row, j) => {
    const u = j / last;
    const trail = moving ? -2.2 * u * u : 0;
    const wave = (moving ? 1.3 : 0.8) * u * Math.sin(phase - u * 3);
    stamp(p, [row], part.x + Math.round(trail + wave), part.y + j + bob);
  });
}

/** Tout pixel vide qui touche un îlot devient noir : c'est lui qui rend la silhouette solide. */
function outline(p: Pix): void {
  const filled = Uint8Array.from(p.data, (v) => (v === EMPTY ? 0 : 1));
  const isFilled = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < W && y < H && filled[y * W + x] === 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (isFilled(x, y)) continue;
      if (isFilled(x + 1, y) || isFilled(x - 1, y) || isFilled(x, y + 1) || isFilled(x, y - 1)) {
        p.set(x, y, OUTLINE);
      }
    }
  }
}

function drawFrame(figure: Figure, moving: boolean, frame: number): Pix {
  const p = new Pix(W, H);
  const pose = (frame >> 1) % 4;
  const bob = moving ? pose % 2 ? -1 : 0 : frame >= FRAMES / 2 ? 1 : 0;
  const swing = moving ? [-1, 0, 1, 0][pose]! : 0;
  const face = !moving && frame === 6 ? { e: 'S' } : undefined;

  for (const part of figure.back) {
    if (part.cloth) drawCloth(p, part, frame, moving, bob);
    else stamp(p, part.rows, part.x, part.y + bob);
  }
  if (figure.legs !== 'robe') {
    for (const leg of moving ? STRIDE[pose]! : STANCE) {
      stamp(p, leg.rows, leg.x, HIP_Y, leg.far ? FAR_SHADE : undefined);
    }
  }
  if (figure.feet) stamp(p, figure.feet.rows, figure.feet.x + swing, figure.feet.y);
  if (figure.dress) drawCloth(p, figure.dress, frame, moving, bob);
  stamp(p, figure.swing.rows, figure.swing.x + swing, figure.swing.y + bob);
  for (const part of figure.upper) stamp(p, part.rows, part.x, part.y + bob, face);
  outline(p);
  return p;
}

export function heroFrames(art: HeroArt, moving: boolean): HTMLCanvasElement[] {
  const figure = FIGURES[art.figure];
  const colors = paletteOf(art, figure);
  return Array.from({ length: FRAMES }, (_, n) => toCanvas(drawFrame(figure, moving, n), colors));
}
