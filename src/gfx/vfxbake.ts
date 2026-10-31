import { clearFrame, createFrame, createFx } from '../../vendor/pixelfx/src/sanguine.js';
import type { FxModule } from '../../vendor/pixelfx/src/sanguine.js';

/**
 * Pré-rendu des effets pixelfx.
 *
 * Recomposer un effet à chaque image coûte trop cher en pleine horde : mesuré à ×4 de
 * bridage processeur, 15 images par seconde en combat, contre 38 avec des atlas. Chaque
 * effet est donc peint une fois, puis `drawImage` suffit.
 *
 * Un effet produit jusqu'à **trois** atlas. L'arrière passe sous les personnages, l'avant
 * par-dessus, et la lumière part dans `FxLayer` : le halo, l'épaulement et « Réduire les
 * flashs » s'y appliquent comme à tout le reste.
 *
 * Tous les atlas sont recopiés sur des pixels entiers, sans rotation ni étirement : un pixel
 * d'effet vaut un pixel de sprite. Un effet orienté est peint dans chaque direction, et un
 * effet plus petit est repeint à sa taille par le moteur, jamais réduit après coup.
 */

export interface Atlas {
  front: HTMLCanvasElement | null;
  back: HTMLCanvasElement | null;
  light: HTMLCanvasElement | null;
  frames: number;
  cols: number;
  cellW: number;
  cellH: number;
  /** Position de l'origine de l'effet dans une cellule. */
  anchorX: number;
  anchorY: number;
}

export interface Spec {
  mod: FxModule;
  options: Record<string, unknown>;
  fps: number;
  size: readonly [number, number];
  origin: readonly [number, number];
  /** Accélération de l'effet : la lib vise un personnage lent, pas une horde. */
  speed: number;
  /** Secondes sautées au début : un sort qui frappe tout de suite n'a pas le temps de se charger. */
  skip: number;
  loop: boolean;
  /** Connue sans le pré-rendu : `update` ne touche jamais au DOM. */
  life: number;
  atlas: Atlas | null;
}

export interface Tuning {
  zoom?: number;
  speed?: number;
  skip?: number;
  angle?: number;
  fps?: number;
  loop?: boolean;
  flip?: boolean;
}

export const vfxStats = { atlases: 0, bytes: 0, bakeMs: 0, longestBakeMs: 0 };

/** Temps de pré-rendu accordé à chaque image : assez peu pour que la cadence n'en voie rien. */
const BAKE_BUDGET_MS = 2;
/** Marge autour d'un cadre : une lueur coupée net dessinerait un carré à l'écran. */
const PAD = 14;
/** Plafond d'une tranche prise sur les temps morts du navigateur. */
const IDLE_BUDGET_MS = 8;

export function specOf(mod: FxModule, options: Record<string, unknown>, tuning: Tuning = {}): Spec {
  const { zoom = 1, speed = 1, skip = 0, angle = 0, fps = 30, loop = false, flip = false } = tuning;
  const [w, h] = mod.meta.size;
  const [ox, oy] = mod.meta.origin;
  const merged: Record<string, unknown> = { ...options, zoom, angle, flip };
  // Un effet orienté tourne autour de son origine : le cadre doit contenir tout le cercle.
  const radius = Math.ceil(Math.max(Math.hypot(ox, oy), Math.hypot(w - ox, oy), Math.hypot(ox, h - oy), Math.hypot(w - ox, h - oy)) * zoom) + PAD;
  return {
    mod,
    options: merged,
    fps,
    size: angle ? [radius * 2, radius * 2] : [Math.ceil(w * zoom) + PAD * 2, Math.ceil(h * zoom) + PAD * 2],
    origin: angle ? [radius, radius] : [Math.ceil((flip ? w - ox : ox) * zoom) + PAD, Math.ceil(oy * zoom) + PAD],
    speed,
    skip,
    loop,
    life: (mod.meta.duration - (loop ? 0 : skip)) / speed,
    atlas: null,
  };
}

/** Canal par canal : comparée comme un entier, une lueur jaune sans bleu passerait pour du noir. */
function isLit(pixel: number): boolean {
  return (pixel & 0xff) > 6 || ((pixel >> 8) & 0xff) > 6 || ((pixel >> 16) & 0xff) > 6;
}

function canvasOf(width: number, height: number, source: ImageData): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  c.getContext('2d')!.putImageData(source, 0, 0);
  return c;
}

/**
 * Peint toutes les images d'un effet, recadrées sur la zone réellement utilisée.
 *
 * Générateur : la file de pré-rendu s'arrête entre deux images de l'effet, ce qui lui évite
 * de bloquer la partie le temps d'un gros atlas.
 */
function* paint(spec: Spec): Generator<void, Atlas> {
  const [w, h] = spec.size;
  const [originX, originY] = spec.origin;
  const frame = createFrame(w, h);
  const fx = createFx(spec.mod, { ...spec.options, x: originX, y: originY });
  for (let t = 0; t < spec.skip; t += 1 / 30) fx.update(1 / 30);

  const total = Math.max(1, Math.round(spec.life * spec.fps));
  const painted: { back: Uint32Array; front: Uint32Array; light: Uint32Array }[] = [];
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  let last = 0;
  let hasBack = false;

  for (let i = 0; i < total; i++) {
    clearFrame(frame);
    fx.draw(frame, 'back');
    const back = frame.color.slice();
    frame.color.fill(0);
    fx.draw(frame, 'front');
    const front = frame.color.slice();
    const light = frame.light.slice();
    for (let y = 0, j = 0; y < h; y++) {
      for (let x = 0; x < w; x++, j++) {
        const inBack = back[j]! >>> 24 > 8;
        if (inBack) hasBack = true;
        if (inBack || front[j]! >>> 24 > 8 || isLit(light[j]!)) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
          last = i;
        }
      }
    }
    painted.push({ back, front, light });
    fx.update(spec.speed / spec.fps);
    yield;
  }

  // Une boucle garde toutes ses images : couper les dernières créerait un saut.
  const frames = spec.loop ? total : last + 1;
  const cellW = Math.max(1, x1 - x0 + 1);
  const cellH = Math.max(1, y1 - y0 + 1);
  const cols = Math.ceil(Math.sqrt(frames));
  const rows = Math.ceil(frames / cols);
  const atlasW = cols * cellW;
  const atlasH = rows * cellH;
  const frontImage = new ImageData(atlasW, atlasH);
  const backImage = new ImageData(atlasW, atlasH);
  const lightImage = new ImageData(atlasW, atlasH);
  const frontOut = new Uint32Array(frontImage.data.buffer);
  const backOut = new Uint32Array(backImage.data.buffer);
  const lightOut = new Uint32Array(lightImage.data.buffer);
  let hasLight = false;

  for (let i = 0; i < frames; i++) {
    const cx = (i % cols) * cellW;
    const cy = Math.floor(i / cols) * cellH;
    const p = painted[i]!;
    for (let y = 0; y < cellH; y++) {
      for (let x = 0; x < cellW; x++) {
        const from = (y + y0) * w + x + x0;
        const to = (cy + y) * atlasW + cx + x;
        frontOut[to] = p.front[from]!;
        backOut[to] = p.back[from]!;
        const glow = p.light[from]! & 0xffffff;
        if (glow) hasLight = true;
        // Noir opaque : recopié en `screen` dans `FxLayer`, le noir ne change rien.
        lightOut[to] = 0xff000000 | glow;
      }
    }
  }

  return {
    front: canvasOf(atlasW, atlasH, frontImage),
    back: hasBack ? canvasOf(atlasW, atlasH, backImage) : null,
    light: hasLight ? canvasOf(atlasW, atlasH, lightImage) : null,
    frames,
    cols,
    cellW,
    cellH,
    anchorX: originX - x0,
    anchorY: originY - y0,
  };
}

function store(spec: Spec, atlas: Atlas): void {
  spec.atlas = atlas;
  const layers = 1 + (atlas.back ? 1 : 0) + (atlas.light ? 1 : 0);
  const rows = Math.ceil(atlas.frames / atlas.cols);
  vfxStats.atlases++;
  vfxStats.bytes += atlas.cols * atlas.cellW * rows * atlas.cellH * 4 * layers;
}

function recordBake(elapsed: number): void {
  vfxStats.bakeMs += elapsed;
  vfxStats.longestBakeMs = Math.max(vfxStats.longestBakeMs, elapsed);
}

/** Atlas indispensable tout de suite : ce qui passe par ici peut faire perdre une image. */
export function bake(spec: Spec): Atlas {
  const startedAt = performance.now();
  const steps = paint(spec);
  let step = steps.next();
  while (!step.done) step = steps.next();
  store(spec, step.value);
  recordBake(performance.now() - startedAt);
  return step.value;
}

const queue: Spec[] = [];
const chores: (() => void)[] = [];
let painting: { spec: Spec; steps: Generator<void, Atlas> } | null = null;

/** Avance la file de pré-rendu sans dépasser `budgetMs`. */
function drainQueue(budgetMs: number): void {
  if (!painting && queue.length === 0 && chores.length === 0) return;
  const startedAt = performance.now();
  while (performance.now() - startedAt < budgetMs) {
    const chore = chores.shift();
    if (chore) {
      chore();
      continue;
    }
    if (!painting) {
      const spec = queue.shift();
      if (!spec) break;
      if (spec.atlas) continue;
      painting = { spec, steps: paint(spec) };
    }
    const step = painting.steps.next();
    if (step.done) {
      if (!painting.spec.atlas) store(painting.spec, step.value);
      painting = null;
    }
  }
  recordBake(performance.now() - startedAt);
}

/** Pré-rendu garanti à chaque image, même quand le navigateur n'a aucun temps mort. */
export function drainFrameBudget(): void {
  drainQueue(BAKE_BUDGET_MS);
}

/**
 * Le gros du pré-rendu se fait sur les temps morts, donc surtout dans les menus : sur un
 * processeur bridé ×4, le faire pendant la partie coûtait un tiers de la cadence au début
 * d'une run.
 */
function bakeWhenIdle(): void {
  if (!painting && queue.length === 0 && chores.length === 0) return;
  // Safari n'a pas `requestIdleCallback` : une tranche courte à chaque tour en tient lieu.
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback((deadline) => {
      drainQueue(Math.min(deadline.timeRemaining(), IDLE_BUDGET_MS));
      bakeWhenIdle();
    });
  } else {
    setTimeout(() => {
      drainQueue(BAKE_BUDGET_MS * 3);
      bakeWhenIdle();
    }, 32);
  }
}

/** Passe devant la file : ce qui attend à l'écran n'attend pas les autres. */
export function rush(spec: Spec): void {
  const at = queue.indexOf(spec);
  if (at > 0) {
    queue.splice(at, 1);
    queue.unshift(spec);
  }
}

/** Travail à faire sur les temps morts, pour qu'il ne tombe pas en pleine partie. */
export function whenIdle(...tasks: (() => void)[]): void {
  const idle = !painting && queue.length === 0 && chores.length === 0;
  chores.push(...tasks);
  if (idle) bakeWhenIdle();
}

export function enqueue(...specs: Spec[]): void {
  const idle = !painting && queue.length === 0 && chores.length === 0;
  queue.push(...specs);
  if (idle) bakeWhenIdle();
}
