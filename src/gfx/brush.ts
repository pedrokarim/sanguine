/**
 * Pinceau de pixels pour les bâtiments.
 *
 * Un château ne se sculpte pas : à cette taille, `Sculpt` produirait de la texture, et c'est
 * exactement ce que l'œil rejette. Ici on peint comme à la main, par aplats francs à arêtes
 * dures : rectangles, polygones et ellipses sans aucun anticrénelage. Le tampon est un
 * `Uint32Array` : le rendu d'un pan de mur tient en une fraction de milliseconde, et rien ne
 * passe par le chemin vectoriel du canvas, qui lisserait les bords.
 *
 * Les coordonnées sont **celles du lieu**, jamais celles du sprite : une `Brush` n'est qu'une
 * fenêtre posée sur un dessin plus grand. C'est ce qui permet de découper une courtine de
 * deux mille pixels en tronçons sans que l'appareil des pierres saute d'un tronçon au suivant.
 */

const packed = new Map<string, number>();

/**
 * Couleur `#rrggbb` en entier petit-boutiste, prêt à écrire dans le tampon.
 *
 * `#rrggbbaa` donne un pixel translucide. Il **remplace** ce qu'il y avait, sans se mélanger :
 * c'est fait pour poser une ombre au sol sur du vide, jamais par-dessus de la pierre.
 */
export function ink(hex: string): number {
  const hit = packed.get(hex);
  if (hit !== undefined) return hit;
  const n = parseInt(hex.slice(1, 7), 16);
  const a = hex.length > 7 ? parseInt(hex.slice(7, 9), 16) : 0xff;
  const v = ((a << 24) | ((n & 0xff) << 16) | (n & 0xff00) | (n >> 16)) >>> 0;
  packed.set(hex, v);
  return v;
}

/** Vrai pour un pixel de matière, faux pour le vide et les ombres translucides. */
const opaque = (v: number): boolean => v >>> 24 === 0xff;

/** Hachage stable d'une position : il décide du sort d'une pierre, toujours le même. */
export function stoneHash(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Brush {
  readonly w: number;
  readonly h: number;
  /** Coin haut-gauche de la fenêtre, en coordonnées du lieu. */
  readonly ox: number;
  readonly oy: number;
  readonly buf: Uint32Array;

  constructor(ox: number, oy: number, w: number, h: number) {
    this.ox = Math.floor(ox);
    this.oy = Math.floor(oy);
    this.w = Math.ceil(w);
    this.h = Math.ceil(h);
    this.buf = new Uint32Array(this.w * this.h);
  }

  /** Rectangle plein. Les coordonnées sont arrondies : jamais de bord à moitié couvert. */
  rect(x: number, y: number, w: number, h: number, c: string): void {
    const col = ink(c);
    const x0 = Math.max(0, Math.round(x) - this.ox);
    const y0 = Math.max(0, Math.round(y) - this.oy);
    const x1 = Math.min(this.w, Math.round(x + w) - this.ox);
    const y1 = Math.min(this.h, Math.round(y + h) - this.oy);
    if (x1 <= x0 || y1 <= y0) return;
    if (!opaque(col)) {
      this.veil(x0, y0, x1, y1, col);
      return;
    }
    for (let py = y0; py < y1; py++) this.buf.fill(col, py * this.w + x0, py * this.w + x1);
  }

  /**
   * Teinte translucide : posée sur le vide elle reste translucide (une ombre au sol), posée sur
   * de la matière elle s'y fond, sans percer de trou dans le sprite.
   */
  private veil(x0: number, y0: number, x1: number, y1: number, col: number): void {
    const a = (col >>> 24) / 255;
    const r = col & 0xff, g = (col >>> 8) & 0xff, bl = (col >>> 16) & 0xff;
    for (let py = y0; py < y1; py++) {
      for (let i = py * this.w + x0, end = py * this.w + x1; i < end; i++) {
        const v = this.buf[i]!;
        if (!opaque(v)) {
          this.buf[i] = col;
          continue;
        }
        const nr = (v & 0xff) * (1 - a) + r * a;
        const ng = ((v >>> 8) & 0xff) * (1 - a) + g * a;
        const nb = ((v >>> 16) & 0xff) * (1 - a) + bl * a;
        this.buf[i] = (0xff000000 | (Math.round(nb) << 16) | (Math.round(ng) << 8) | Math.round(nr)) >>> 0;
      }
    }
  }

  dot(x: number, y: number, c: string): void {
    const px = Math.round(x) - this.ox;
    const py = Math.round(y) - this.oy;
    if (px >= 0 && py >= 0 && px < this.w && py < this.h) this.buf[py * this.w + px] = ink(c);
  }

  /** Remet à vide : c'est ainsi qu'on perce une porte ou qu'on ronge une arête. */
  erase(x: number, y: number, w: number, h: number): void {
    const x0 = Math.max(0, Math.round(x) - this.ox);
    const y0 = Math.max(0, Math.round(y) - this.oy);
    const x1 = Math.min(this.w, Math.round(x + w) - this.ox);
    const y1 = Math.min(this.h, Math.round(y + h) - this.oy);
    if (x1 <= x0 || y1 <= y0) return;
    for (let py = y0; py < y1; py++) this.buf.fill(0, py * this.w + x0, py * this.w + x1);
  }

  /** Polygone plein, balayé ligne par ligne. */
  poly(points: readonly (readonly [number, number])[], c: string): void {
    this.spans(points, (y, a, b) => this.rect(a, y, b - a, 1, c));
  }

  /** Efface l'intérieur d'un polygone : ogive de porte, fenêtre traversante. */
  cut(points: readonly (readonly [number, number])[]): void {
    this.spans(points, (y, a, b) => this.erase(a, y, b - a, 1));
  }

  private spans(points: readonly (readonly [number, number])[], emit: (y: number, a: number, b: number) => void): void {
    const ys = points.map((p) => p[1]);
    const y0 = Math.floor(Math.min(...ys));
    const y1 = Math.ceil(Math.max(...ys));
    for (let py = y0; py < y1; py++) {
      const cross: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i]!;
        const [bx, by] = points[(i + 1) % points.length]!;
        if ((ay <= py + 0.5 && by > py + 0.5) || (by <= py + 0.5 && ay > py + 0.5)) {
          cross.push(ax + ((py + 0.5 - ay) / (by - ay)) * (bx - ax));
        }
      }
      cross.sort((a, b) => a - b);
      for (let k = 0; k + 1 < cross.length; k += 2) emit(py, Math.round(cross[k]!), Math.round(cross[k + 1]!));
    }
  }

  /** Ellipse pleine. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string): void {
    for (let py = Math.floor(cy - ry); py <= cy + ry; py++) {
      const q = (py + 0.5 - cy) / ry;
      if (Math.abs(q) > 1) continue;
      const half = rx * Math.sqrt(1 - q * q);
      this.rect(cx - half, py, half * 2, 1, c);
    }
  }

  /**
   * Ogive gothique, debout sur sa base : deux arcs qui se rejoignent en pointe.
   * `emit` reçoit chaque ligne, ce qui sert aussi bien à peindre qu'à percer.
   */
  private archSpans(cx: number, base: number, w: number, h: number, emit: (y: number, a: number, b: number) => void): void {
    const half = w / 2;
    const spring = base - h + w * 0.86;
    for (let py = Math.floor(base - h); py < base; py++) {
      let hw = half;
      if (py < spring) {
        const q = (spring - py) / (w * 0.86);
        hw = half - w * (1 - Math.sqrt(Math.max(0, 1 - q * q)));
        if (hw < 0) hw = 0;
      }
      if (hw > 0) emit(py, Math.round(cx - hw), Math.round(cx + hw));
    }
  }

  arch(cx: number, base: number, w: number, h: number, c: string): void {
    this.archSpans(cx, base, w, h, (y, a, b) => this.rect(a, y, b - a, 1, c));
  }

  cutArch(cx: number, base: number, w: number, h: number): void {
    this.archSpans(cx, base, w, h, (y, a, b) => this.erase(a, y, b - a, 1));
  }

  /**
   * Couche : `paint` travaille sur un calque de même fenêtre, posé ensuite sur ce tampon.
   *
   * Sert aux formes qu'il faut d'abord découper. Un pignon se peint en rectangle de pierre puis
   * se taille en pointe : taillé directement ici, il emporterait le toit peint derrière lui.
   */
  layer(paint: (b: Brush) => void): void {
    const top = new Brush(this.ox, this.oy, this.w, this.h);
    paint(top);
    for (let i = 0; i < this.buf.length; i++) {
      const v = top.buf[i]!;
      if (v !== 0) this.buf[i] = v;
    }
  }

  /** Peint comme si l'origine était en (x, y) : un même dessin se pose ainsi n'importe où. */
  at(x: number, y: number, paint: (b: Brush) => void): void {
    const top = new Brush(this.ox - x, this.oy - y, this.w, this.h);
    paint(top);
    for (let i = 0; i < this.buf.length; i++) {
      const v = top.buf[i]!;
      if (v !== 0) this.buf[i] = v;
    }
  }

  /**
   * Contour sombre tout autour de ce qui est peint.
   *
   * Il est posé sur le vide, jamais sur la matière : une silhouette ne perd pas de pixels à
   * être cernée. C'est le même cerne que les héros, et c'est lui qui les fait habiter le même
   * monde.
   */
  outline(c: string): void {
    const { w, h, buf } = this;
    const col = ink(c);
    const out: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (opaque(buf[i]!)) continue;
        const edge = (v: number): boolean => opaque(v) && v !== col;
        if ((x > 0 && edge(buf[i - 1]!)) || (x < w - 1 && edge(buf[i + 1]!)) ||
          (y > 0 && edge(buf[i - w]!)) || (y < h - 1 && edge(buf[i + w]!))) {
          out.push(i);
        }
      }
    }
    for (const i of out) buf[i] = col;
  }

  /**
   * Première ligne peinte de chaque colonne de `step` pixels, comptée depuis le haut.
   *
   * C'est le profil de la silhouette : il dit si un sprite couvre réellement un point, là où sa
   * boîte englobante, dix fois plus grande pour une tour à toit pointu, mentirait.
   */
  skyline(step: number, pad: number): Int16Array {
    const cols = Math.ceil((this.w - pad * 2) / step);
    const out = new Int16Array(cols).fill(0x7fff);
    for (let c = 0; c < cols; c++) {
      for (let x = c * step + pad, end = Math.min(this.w - pad, x + step); x < end; x++) {
        for (let y = pad; y < this.h - pad && y - pad < out[c]!; y++) {
          if (opaque(this.buf[y * this.w + x]!)) { out[c] = y - pad; break; }
        }
      }
    }
    return out;
  }

  /**
   * Fige le tampon en canvas, amputé de `pad` pixels sur chaque bord.
   *
   * Le contour se calcule sur une fenêtre élargie puis on recoupe : sans cette marge, chaque
   * tronçon de courtine porterait un trait sombre à sa couture avec le suivant.
   */
  toCanvas(pad = 0): HTMLCanvasElement {
    const w = this.w - pad * 2;
    const h = this.h - pad * 2;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    const dst = new Uint32Array(img.data.buffer);
    for (let y = 0; y < h; y++) {
      const start = (y + pad) * this.w + pad;
      dst.set(this.buf.subarray(start, start + w), y * w);
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
}
