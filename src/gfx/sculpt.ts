import { hexToRgb, mix, shade } from './palette';

/**
 * Sculpteur de sprites.
 *
 * Un corps n'est plus une pile d'ellipses plates : c'est un petit assemblage de volumes, posés
 * dans l'espace, dont chaque pixel connaît sa profondeur et son orientation. L'éclairage, les
 * ombres de contact et les arêtes en découlent tout seuls, et une créature animée garde sa
 * lumière à chaque image, là où un sprite dessiné à plat la porte figée sur lui.
 *
 * La finition reprend les recettes de pixelfx : une rampe de sept marches qui glisse vers le
 * violet dans l'ombre et vers le chaud dans la lumière, une transition tramée par matrice de
 * Bayer plutôt qu'un dégradé, et un contour choisi côté par côté, plus sombre dans l'ombre.
 *
 * Axes : `x` à droite, `y` vers le bas, `z` vers le spectateur. Lumière en haut à gauche, comme
 * dans toute la bibliothèque d'effets.
 */

type Rgb = readonly [number, number, number];

export interface Material {
  ramp: readonly Rgb[];
  /** Matière sans ombrage : un œil, une braise. */
  emit?: boolean;
  /** Relief de surface, de 0 (lisse) à 1 (écorce, roche). */
  rough?: number;
  /** Reflet franc, de 0 (mat) à 1 (métal, os poli). */
  gloss?: number;
}

/** Ombre vers laquelle glisse toute rampe : elle lie les créatures au décor nocturne. */
const COOL = '#1a1238';
/** Reflet : il réchauffe le haut de la rampe, sans jamais atteindre le blanc pur. */
const WARM = '#fff0d0';

/**
 * Rampe de sept marches à partir des trois teintes d'une créature.
 *
 * Plus sombre, elle ne perd pas seulement de la lumière : elle change de teinte. C'est ce
 * glissement qui sépare un volume peint d'un sprite simplement assombri.
 */
export function rampOf(dark: string, main: string, light: string): Rgb[] {
  return [
    mix(shade(dark, -0.62), COOL, 0.42),
    mix(shade(dark, -0.3), COOL, 0.26),
    dark,
    main,
    mix(main, light, 0.55),
    light,
    mix(shade(light, 0.32), WARM, 0.3),
  ].map(hexToRgb);
}

export function material(cols: readonly [string, string, string], extra: Omit<Material, 'ramp'> = {}): Material {
  return { ramp: rampOf(cols[0], cols[1], cols[2]), ...extra };
}

/** Une seule couleur vive, déclinée en trois teintes. */
export function tone(color: string, extra: Omit<Material, 'ramp'> = {}): Material {
  return material([shade(color, -0.42), color, shade(color, 0.3)], extra);
}

export function glow(color: string): Material {
  return { ramp: rampOf(shade(color, -0.2), color, shade(color, 0.4)), emit: true };
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

const LIGHT = (() => {
  const v = [-0.52, -0.68, 0.52];
  const l = Math.hypot(v[0]!, v[1]!, v[2]!);
  return v.map((c) => c / l) as [number, number, number];
})();
const HALF = (() => {
  const v = [LIGHT[0], LIGHT[1], LIGHT[2] + 1];
  const l = Math.hypot(v[0]!, v[1]!, v[2]!);
  return v.map((c) => c / l) as [number, number, number];
})();
const AMBIENT = 0.2;

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Bruit de surface : deux octaves, assez fin pour se lire à l'échelle d'un sprite. */
function grain(x: number, y: number): number {
  const a = hash(Math.floor(x / 2), Math.floor(y / 2));
  return (a * 0.6 + hash(x, y) * 0.4) - 0.5;
}

export class Sculpt {
  /** Grille de dessin : les plans s'écrivent en proportions de `w` et `h`. */
  readonly w: number;
  readonly h: number;
  /** Image réelle : la grille plus la marge, où passe un corps qui se soulève. */
  private readonly cw: number;
  private readonly ch: number;
  private readonly depth: Float32Array;
  private readonly nx: Float32Array;
  private readonly ny: Float32Array;
  private readonly nz: Float32Array;
  private readonly mat: Int16Array;
  /** Décalage de la pièce qui a posé chaque pixel : le grain et la trame le suivent. */
  private readonly shiftX: Int16Array;
  private readonly shiftY: Int16Array;
  private readonly mats: Material[] = [];
  private readonly ids = new Map<Material, number>();
  /** Décalage courant, marge comprise. Voir `piece`. */
  private ox: number;
  private oy: number;

  constructor(w: number, h: number, margin = 0) {
    this.w = w;
    this.h = h;
    this.ox = margin;
    this.oy = margin;
    this.cw = w + margin * 2;
    this.ch = h + margin * 2;
    const n = this.cw * this.ch;
    this.depth = new Float32Array(n).fill(-Infinity);
    this.nx = new Float32Array(n);
    this.ny = new Float32Array(n);
    this.nz = new Float32Array(n);
    this.mat = new Int16Array(n).fill(-1);
    this.shiftX = new Int16Array(n);
    this.shiftY = new Int16Array(n);
  }

  /**
   * Pose une pièce rigide, décalée d'un nombre entier de pixels.
   *
   * C'est la règle de mouvement des créatures, celle du héros : une pièce se déplace, elle ne se
   * redessine pas. Ses volumes sont pixellisés à leur place de repos, puis translatés, et son
   * grain comme sa trame voyagent avec elle. Sans cela, un dixième de pixel de balancement
   * rééclaire tout le corps et fait bouillir la moitié de ses pixels d'une image à l'autre.
   */
  piece(dx: number, dy: number, draw: () => void): void {
    const { ox, oy } = this;
    this.ox = ox + Math.round(dx);
    this.oy = oy + Math.round(dy);
    draw();
    this.ox = ox;
    this.oy = oy;
  }

  private idOf(m: Material): number {
    let id = this.ids.get(m);
    if (id === undefined) {
      id = this.mats.length;
      this.mats.push(m);
      this.ids.set(m, id);
    }
    return id;
  }

  /** Indice d'un pixel de la pièce courante, ou -1 hors de l'image. */
  private cellOf(lx: number, ly: number): number {
    const x = lx + this.ox, y = ly + this.oy;
    return x < 0 || y < 0 || x >= this.cw || y >= this.ch ? -1 : y * this.cw + x;
  }

  private write(lx: number, ly: number, z: number, nx: number, ny: number, nz: number, id: number): void {
    const i = this.cellOf(lx, ly);
    if (i < 0 || z <= this.depth[i]!) return;
    this.depth[i] = z;
    this.nx[i] = nx;
    this.ny[i] = ny;
    this.nz[i] = nz;
    this.mat[i] = id;
    this.shiftX[i] = this.ox;
    this.shiftY[i] = this.oy;
  }

  /** Ellipsoïde. */
  ball(x: number, y: number, z: number, rx: number, ry: number, rz: number, m: Material): void {
    if (rx <= 0 || ry <= 0) return;
    const id = this.idOf(m);
    const x0 = Math.floor(x - rx), x1 = Math.ceil(x + rx), y0 = Math.floor(y - ry), y1 = Math.ceil(y + ry);
    for (let py = y0; py <= y1; py++) {
      const dy = (py + 0.5 - y) / ry;
      for (let px = x0; px <= x1; px++) {
        const dx = (px + 0.5 - x) / rx;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        const dz = Math.sqrt(1 - d);
        let nx = dx / rx, ny = dy / ry, nz = dz / rz;
        const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l; ny /= l; nz /= l;
        this.write(px, py, z + dz * rz, nx, ny, nz, id);
      }
    }
  }

  /** Sphère : le cas le plus courant. */
  sphere(x: number, y: number, z: number, r: number, m: Material): void {
    this.ball(x, y, z, r, r, r, m);
  }

  /** Os : un cône arrondi entre deux points, de rayon `r0` à `r1`. */
  bone(x0: number, y0: number, z0: number, r0: number, x1: number, y1: number, z1: number, r1: number, m: Material): void {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0, z1 - z0) * 1.5));
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      this.sphere(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, z0 + (z1 - z0) * u, r0 + (r1 - r0) * u, m);
    }
  }

  /** Bloc à arêtes biseautées, vu de face : stèle, pierre de taille, plastron. */
  block(x: number, y: number, w: number, h: number, z: number, thick: number, m: Material, bevel = 1.5): void {
    const id = this.idOf(m);
    for (let py = Math.floor(y); py < y + h; py++) {
      for (let px = Math.floor(x); px < x + w; px++) {
        const l = px + 0.5 - x, r = x + w - px - 0.5, t = py + 0.5 - y, b = y + h - py - 0.5;
        const nearX = Math.min(l, r), nearY = Math.min(t, b);
        let nx = nearX < bevel ? (l < r ? -1 : 1) * (1 - nearX / bevel) : 0;
        let ny = nearY < bevel ? (t < b ? -1 : 1) * (1 - nearY / bevel) : 0;
        let nz = 1;
        const n = Math.hypot(nx, ny, nz);
        nx /= n; ny /= n; nz /= n;
        this.write(px, py, z + thick * Math.min(1, Math.min(nearX, nearY) / bevel), nx, ny, nz, id);
      }
    }
  }

  /** Surface mince et plane : aile, cape, lame. `tilt` l'incline vers le haut ou le bas. */
  sheet(points: readonly (readonly [number, number])[], z: number, tilt: number, m: Material): void {
    const id = this.idOf(m);
    const ys = points.map((p) => p[1]);
    const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    const l = Math.hypot(tilt, 1);
    for (let py = y0; py <= y1; py++) {
      const cross: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i]!;
        const [bx, by] = points[(i + 1) % points.length]!;
        if ((ay <= py + 0.5 && by > py + 0.5) || (by <= py + 0.5 && ay > py + 0.5)) {
          cross.push(ax + ((py + 0.5 - ay) / (by - ay)) * (bx - ax));
        }
      }
      cross.sort((a, b) => a - b);
      for (let k = 0; k + 1 < cross.length; k += 2) {
        for (let px = Math.ceil(cross[k]! - 0.5); px <= cross[k + 1]! - 0.5; px++) {
          this.write(px, py, z, 0, tilt / l, 1 / l, id);
        }
      }
    }
  }

  /** Un pixel posé à la main : pupille, boucle, clou. Toujours devant ce qu'il couvre. */
  dot(x: number, y: number, m: Material, z = Infinity): void {
    const px = Math.round(x), py = Math.round(y);
    const i = this.cellOf(px, py);
    if (i < 0 || (this.mat[i]! < 0 && z === Infinity)) return;
    this.write(px, py, z === Infinity ? this.depth[i]! + 0.01 : z, 0, 0, 1, this.idOf(m));
  }

  /**
   * Peint une tache sur ce qui est déjà sculpté, sans rien changer au relief : visière,
   * bouche, ceinture. Un volume de plus s'enfoncerait dans celui qu'il devait recouvrir.
   */
  decal(x: number, y: number, rx: number, ry: number, m: Material): void {
    const id = this.idOf(m);
    for (let py = Math.floor(y - ry); py <= y + ry; py++) {
      for (let px = Math.floor(x - rx); px <= x + rx; px++) {
        const i = this.cellOf(px, py);
        if (i < 0) continue;
        const dx = (px + 0.5 - x) / rx, dy = (py + 0.5 - y) / ry;
        if (dx * dx + dy * dy > 1) continue;
        if (this.mat[i]! >= 0) this.mat[i] = id;
      }
    }
  }

  /** Trait peint sur la surface : couture, arête de plaque, ligne de muscle. */
  stroke(x0: number, y0: number, x1: number, y1: number, r: number, m: Material): void {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      this.decal(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, r, r, m);
    }
  }

  /** Efface un disque : orbite, bouche ouverte, trou dans une cape. */
  carve(x: number, y: number, rx: number, ry: number): void {
    for (let py = Math.floor(y - ry); py <= y + ry; py++) {
      for (let px = Math.floor(x - rx); px <= x + rx; px++) {
        const i = this.cellOf(px, py);
        if (i < 0) continue;
        const dx = (px + 0.5 - x) / rx, dy = (py + 0.5 - y) / ry;
        if (dx * dx + dy * dy > 1) continue;
        this.mat[i] = -1;
        this.depth[i] = -Infinity;
      }
    }
  }

  /**
   * Éclaire les volumes posés et renvoie l'image finale.
   *
   * `dither` règle la trame. Le décor défile avec le monde : il en prend très peu, sans quoi
   * les zones tramées clignotent à chaque pas de caméra.
   */
  render(outline = true, dither = 0.75): HTMLCanvasElement {
    const { cw: w, ch: h, depth, nx, ny, nz, mat, mats, shiftX, shiftY } = this;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    const out = img.data;
    const filled = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && mat[y * w + x]! >= 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const id = mat[i]!;
        const o = i * 4;
        if (id < 0) {
          if (!outline) continue;
          // Contour choisi côté par côté : le voisin qui l'a créé décide de sa couleur.
          const left = filled(x + 1, y), top = filled(x, y + 1), right = filled(x - 1, y), bottom = filled(x, y - 1);
          if (!left && !top && !right && !bottom) continue;
          const src = left ? i + 1 : top ? i + w : right ? i - 1 : i - w;
          const ramp = mats[mat[src]!]!.ramp;
          // Le côté tourné vers la lumière reste une marche plus clair que le côté d'ombre.
          const col = ramp[left || top ? 1 : 0]!;
          const k = left || top ? 0.82 : 0.62;
          out[o] = col[0] * k;
          out[o + 1] = col[1] * k;
          out[o + 2] = col[2] * k;
          out[o + 3] = 255;
          continue;
        }

        const m = mats[id]!;
        const ramp = m.ramp;
        let step: number;
        if (m.emit) {
          step = ramp.length - 2;
        } else {
          let ax = nx[i]!, ay = ny[i]!, az = nz[i]!;
          // Coordonnées propres à la pièce : son grain et sa trame ne glissent pas sur elle.
          const lx = x - shiftX[i]!, ly = y - shiftY[i]!;
          if (m.rough) {
            ax += grain(lx + 3, ly) * m.rough * 0.9;
            ay += grain(lx, ly + 7) * m.rough * 0.9;
            const l = Math.hypot(ax, ay, az) || 1;
            ax /= l; ay /= l; az /= l;
          }
          let v = Math.max(0, ax * LIGHT[0] + ay * LIGHT[1] + az * LIGHT[2]);
          v = AMBIENT + v * (1 - AMBIENT);

          // Ombre de contact : un voisin nettement plus proche du spectateur creuse ce pixel.
          const here = depth[i]!;
          let crease = 0;
          for (const j of [i - 1, i + 1, i - w, i + w]) {
            if (j < 0 || j >= depth.length) continue;
            const d = depth[j]! - here;
            if (d > 1.4 && d < 1e6) crease = Math.max(crease, Math.min(1, d / 5));
          }
          v *= 1 - crease * 0.62;
          // Le bas des volumes tombe dans l'ombre du corps : c'est lui qui les pose au sol.
          v *= 0.86 + 0.14 * (1 - ly / this.h);

          step = v * (ramp.length - 1) + BAYER[((ly & 3) << 2) | (lx & 3)]! * dither;

          // Rasante froide sur le bord opposé à la lumière, seulement sur ce qui fait face.
          const rim = Math.max(0, ax * 0.8 + ay * 0.2) * (1 - az);
          if (rim > 0.3) step += rim * 1.5;

          if (m.gloss) {
            const s = Math.max(0, ax * HALF[0] + ay * HALF[1] + az * HALF[2]);
            step += Math.pow(s, 22) * m.gloss * 4;
          }
        }
        const col = ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(step)))]!;
        out[o] = col[0];
        out[o + 1] = col[1];
        out[o + 2] = col[2];
        out[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
}

/**
 * Donne du relief à un sprite dessiné à plat : butin, icônes, objets de collection.
 *
 * Le biseau vient de la distance au bord, et la lumière du même coin que partout : le haut
 * gauche monte d'une marche, le bas droit en descend, la transition est tramée.
 */
export function polish(c: HTMLCanvasElement): HTMLCanvasElement {
  const { width: w, height: h } = c;
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3]! > 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      let lit = 0;
      for (let r = 1; r <= 2; r++) {
        if (!solid(x - r, y) || !solid(x, y - r)) lit += 1 / r;
        if (!solid(x + r, y) || !solid(x, y + r)) lit -= 1 / r;
      }
      const k = lit * 0.14 + BAYER[((y & 3) << 2) | (x & 3)]! * 0.08;
      const o = (y * w + x) * 4;
      for (let i = 0; i < 3; i++) {
        const v = d[o + i]!;
        d[o + i] = k >= 0 ? v + (255 - v) * k : v * (1 + k);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
