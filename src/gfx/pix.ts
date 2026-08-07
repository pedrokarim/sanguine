import { hexToRgb } from './palette';

/**
 * Primitives de dessin sur une grille de pixels indexée.
 *
 * On travaille sur des index de palette (`Int8Array`) plutôt que sur des couleurs RGBA :
 * c'est compact, ça rend le remplacement de palette trivial (une variante « élite » n'est
 * qu'un autre tableau de couleurs), et l'ajout de contour se fait par simple voisinage.
 *
 * Convention : `-1` = transparent, origine en haut à gauche, `y` vers le bas.
 */
export const EMPTY = -1;

export class Pix {
  readonly w: number;
  readonly h: number;
  readonly data: Int8Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Int8Array(w * h).fill(EMPTY);
  }

  clone(): Pix {
    const p = new Pix(this.w, this.h);
    p.data.set(this.data);
    return p;
  }

  set(x: number, y: number, c: number): void {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return;
    this.data[yi * this.w + xi] = c;
  }

  get(x: number, y: number): number {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return EMPTY;
    return this.data[yi * this.w + xi]!;
  }

  /** Ne peint que si le pixel est déjà vide – pratique pour dessiner « derrière ». */
  setBehind(x: number, y: number, c: number): void {
    if (this.get(x, y) === EMPTY) this.set(x, y, c);
  }

  rect(x: number, y: number, w: number, h: number, c: number): void {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x0 + i, y0 + j, c);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: number): void {
    if (rx <= 0 || ry <= 0) return;
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1.02) this.set(x, y, c);
      }
    }
  }

  /** Ellipse creuse (contour uniquement). */
  ring(cx: number, cy: number, rx: number, ry: number, c: number): void {
    const solid = new Pix(this.w, this.h);
    solid.ellipse(cx, cy, rx, ry, 0);
    solid.ellipse(cx, cy, rx - 1, ry - 1, EMPTY);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) if (solid.get(x, y) === 0) this.set(x, y, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: number): void {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const ex = Math.round(x1);
    const ey = Math.round(y1);
    const dx = Math.abs(ex - x);
    const dy = -Math.abs(ey - y);
    const sx = x < ex ? 1 : -1;
    const sy = y < ey ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 512; guard++) {
      this.set(x, y, c);
      if (x === ex && y === ey) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /** Ligne épaisse, utilisée pour les membres. */
  limb(x0: number, y0: number, x1: number, y1: number, thickness: number, c: number): void {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    const r = thickness / 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.ellipse(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, c);
    }
  }

  /** Recopie la moitié gauche sur la moitié droite (symétrie verticale). */
  mirrorX(): void {
    const half = Math.floor(this.w / 2);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < half; x++) {
        const v = this.get(x, y);
        if (v !== EMPTY) this.set(this.w - 1 - x, y, v);
      }
    }
  }

  /**
   * Ajoute un contour de 1 px autour de la silhouette. Indispensable à la lisibilité :
   * sans contour, les ennemis sombres se fondent dans le décor sombre.
   */
  outline(c: number): void {
    const src = this.data.slice();
    const at = (x: number, y: number): number =>
      x < 0 || y < 0 || x >= this.w || y >= this.h ? EMPTY : src[y * this.w + x]!;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (at(x, y) !== EMPTY) continue;
        if (
          at(x - 1, y) !== EMPTY ||
          at(x + 1, y) !== EMPTY ||
          at(x, y - 1) !== EMPTY ||
          at(x, y + 1) !== EMPTY
        ) {
          this.set(x, y, c);
        }
      }
    }
  }

  /**
   * Lumière zénithale implicite : la rangée supérieure de chaque colonne pleine est éclaircie,
   * la rangée inférieure assombrie. `hi` et `lo` sont des index de palette.
   */
  shadeVertical(from: number, hi: number, lo: number): void {
    for (let x = 0; x < this.w; x++) {
      let top = -1;
      let bottom = -1;
      for (let y = 0; y < this.h; y++) {
        if (this.get(x, y) === from) {
          if (top < 0) top = y;
          bottom = y;
        }
      }
      if (top >= 0) {
        this.set(x, top, hi);
        if (bottom > top + 1) this.set(x, bottom, lo);
      }
    }
  }

  /** Damier entre deux index, pour des transitions « 16-bit ». */
  dither(from: number, to: number, y0: number, y1: number): void {
    for (let y = Math.max(0, y0); y < Math.min(this.h, y1); y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) === from && (x + y) % 2 === 0) this.set(x, y, to);
      }
    }
  }

  /** Décale tout le contenu (utilisé pour les frames d'animation). */
  translated(dx: number, dy: number): Pix {
    const p = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const v = this.get(x, y);
        if (v !== EMPTY) p.set(x + dx, y + dy, v);
      }
    return p;
  }

  /**
   * Squash & stretch autour du point d'ancrage bas-centre. C'est la déformation qui donne
   * tout le « game feel » 2D : un sprite qui s'aplatit en touchant le sol paraît vivant.
   */
  scaled(sx: number, sy: number): Pix {
    const p = new Pix(this.w, this.h);
    const ax = this.w / 2;
    const ay = this.h - 1;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const v = this.get(x, y);
        if (v === EMPTY) continue;
        const nx = ax + (x - ax) * sx;
        const ny = ay + (y - ay) * sy;
        p.set(nx, ny, v);
        // Remplit les trous créés par un étirement > 1.
        if (sy > 1.01) p.set(nx, ny + 1, v);
        if (sx > 1.01) p.set(nx + 1, ny, v);
      }
    }
    return p;
  }
}

// ---------------------------------------------------------------------------
// Rasterisation vers canvas
// ---------------------------------------------------------------------------

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Convertit une grille indexée en canvas, via `ImageData` (bien plus rapide que `fillRect`). */
export function toCanvas(pix: Pix, colors: readonly string[]): HTMLCanvasElement {
  const canvas = makeCanvas(pix.w, pix.h);
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(pix.w, pix.h);
  const rgb = colors.map(hexToRgb);
  const out = img.data;
  for (let i = 0; i < pix.data.length; i++) {
    const c = pix.data[i]!;
    const o = i * 4;
    if (c === EMPTY || c >= rgb.length) {
      out[o + 3] = 0;
      continue;
    }
    const [r, g, b] = rgb[c]!;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Variante teintée d'un canvas existant. Utilisée pour pré-calculer le flash blanc de dégâts
 * et la silhouette rouge des élites : aucun filtre n'est appliqué au moment du rendu.
 */
export function tint(src: HTMLCanvasElement, color: string, amount: number): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const [tr, tg, tb] = hexToRgb(color);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    d[i] = d[i]! + (tr - d[i]!) * amount;
    d[i + 1] = d[i + 1]! + (tg - d[i + 1]!) * amount;
    d[i + 2] = d[i + 2]! + (tb - d[i + 2]!) * amount;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Silhouette pleine d'une couleur (halo, ombre portée, télégraphe d'attaque). */
export function silhouette(src: HTMLCanvasElement, color: string, alpha = 1): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Agrandit un canvas d'un facteur entier, sans lissage (pour l'UI). */
export function upscale(src: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const c = makeCanvas(src.width * factor, src.height * factor);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
