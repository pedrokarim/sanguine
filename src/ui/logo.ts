import { Rng } from '../core/rng';
import { P, mix } from '../gfx/palette';

/**
 * Logo animé : « Sanguine » en gothique, dont le sang coule.
 *
 * Les lettres viennent de la police de titre du jeu, Jacquard 24, tracée à sa taille native
 * de vingt-quatre pixels puis relevée point par point. Le logo parle ainsi la même langue
 * que tous les titres de l'interface, au lieu d'être un alphabet à part dessiné pour lui
 * seul. La police est inscrite dans le jeu : elle ne varie pas d'une machine à l'autre.
 *
 * L'écoulement est simulé par colonne : chaque point bas d'une lettre porte une coulure qui
 * s'allonge, marque un temps, puis laisse tomber une goutte. C'est le même principe que la
 * peinture fraîche – la matière s'accumule au point bas avant de céder.
 */

/**
 * Teintes d'une coulure. Le même mécanisme sert au sang du titre et à la lumière de l'aube
 * de l'écran de victoire : ce qui coule change de nature, pas de comportement.
 */
export interface LogoPalette {
  /** Liseré supérieur des lettres. */
  crown: string;
  /** Corps des lettres, du haut vers le bas. */
  top: string;
  bottom: string;
  /** Coulures, de leur naissance à leur pointe. */
  dripTop: string;
  dripEnd: string;
  shadow: string;
}

export const BLOOD: LogoPalette = {
  crown: mix(P.bloodHi, '#ffffff', 0.35),
  top: P.bloodHi,
  bottom: P.blood,
  dripTop: P.blood,
  dripEnd: P.bloodDark,
  shadow: 'rgba(42,3,8,0.55)',
};

/** Aube : ce n'est plus du sang qui coule, c'est la lumière qui revient. */
export const DAWN: LogoPalette = {
  crown: '#fffaf0',
  top: '#fff3c4',
  bottom: P.gold,
  dripTop: P.gold,
  dripEnd: P.leather,
  shadow: 'rgba(60,34,4,0.5)',
};

const FONT = '24px "Jacquard 24"';
/** Marge autour du texte relevé : les jambages et les hampes débordent de la ligne. */
const PAD = 2;
/**
 * Hauteur réservée sous les lettres pour les coulures et les gouttes.
 *
 * Elle pèse directement sur les proportions du canvas : trop grande, les lettres n'occupent
 * plus qu'une fraction de la hauteur et le logo, dimensionné par sa hauteur, rapetisse.
 */
const DRIP_SPACE = 20;

interface Drip {
  x: number;
  /** Ligne de départ : juste sous le dernier point d'encre de la colonne. */
  y0: number;
  len: number;
  target: number;
  speed: number;
  /** Temps restant avant que la coulure ne démarre. */
  delay: number;
  /** Largeur de la coulure, 1 ou 2 px. */
  w: number;
  /** Position de la goutte détachée, `-1` si aucune. */
  dropY: number;
  dropDelay: number;
}

export class BloodLogo {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mask = new Uint8Array(0);
  private w = 1;
  /** Hauteur des lettres seules, coulures non comprises. */
  private inkH = 1;
  private h = 1;
  private drips: Drip[] = [];
  private raf = 0;
  private last = 0;

  constructor(private readonly text = 'Sanguine', private readonly seed = 0x51a9, private pal: LogoPalette = BLOOD) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'blood-logo';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', text);
    this.ctx = this.canvas.getContext('2d')!;
    this.canvas.width = 1;
    this.canvas.height = 1;

    // La police est inscrite dans la feuille de styles, mais son décodage reste asynchrone :
    // tracer avant qu'elle soit prête relèverait la police de repli à sa place.
    void document.fonts.load(FONT, text).then(() => {
      this.rasterize();
      this.draw();
    });
  }

  /** Trace le texte hors écran et en relève le masque : 1 = encre. */
  private rasterize(): void {
    const probe = document.createElement('canvas').getContext('2d')!;
    probe.font = FONT;
    const m = probe.measureText(this.text);
    const ascent = Math.ceil(m.actualBoundingBoxAscent);
    const descent = Math.ceil(m.actualBoundingBoxDescent);
    const left = Math.ceil(m.actualBoundingBoxLeft);
    const width = Math.ceil(left + m.actualBoundingBoxRight) + PAD * 2;
    const height = ascent + descent + PAD * 2;

    const off = document.createElement('canvas');
    off.width = width;
    off.height = height;
    const g = off.getContext('2d', { willReadFrequently: true })!;
    g.font = FONT;
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#ffffff';
    g.fillText(this.text, PAD + left, PAD + ascent);

    // Le tracé est lissé par le navigateur ; un seuil le ramène à des pixels francs.
    const data = g.getImageData(0, 0, width, height).data;
    this.w = width;
    this.inkH = height;
    this.h = height + DRIP_SPACE;
    this.mask = new Uint8Array(width * height);
    for (let i = 0; i < this.mask.length; i++) this.mask[i] = data[i * 4 + 3]! > 110 ? 1 : 0;

    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.canvas.style.aspectRatio = `${this.w} / ${this.h}`;
    this.buildDrips(new Rng(this.seed));
  }

  /** Dernier point d'encre de la colonne `x`, ou `-1` si elle est vide. */
  private lowest(x: number): number {
    for (let y = this.inkH - 1; y >= 0; y--) if (this.mask[y * this.w + x]) return y;
    return -1;
  }

  /**
   * Une coulure ne peut naître que d'un point bas réel de la lettre – un endroit d'où le sang
   * pourrait effectivement tomber. Partir de colonnes arbitraires donnerait des traits
   * suspendus dans le vide.
   *
   * Un point bas est une colonne dont l'encre descend au moins aussi bas que ses deux
   * voisines : le pied d'un jambage, le bas d'une panse, la pointe d'une hampe.
   */
  private buildDrips(rng: Rng): void {
    this.drips = [];
    const candidates: number[] = [];
    for (let x = 1; x < this.w - 1; x++) {
      const y = this.lowest(x);
      if (y < this.inkH * 0.45) continue;
      if (y >= this.lowest(x - 1) && y >= this.lowest(x + 1)) candidates.push(x);
    }

    rng.shuffle(candidates);
    for (const x of candidates) {
      if (this.drips.length >= 11) break;
      // Deux coulures collées se lisent comme une tache : on impose un écart minimal.
      if (this.drips.some((d) => Math.abs(d.x - x) < 6)) continue;
      const y0 = this.lowest(x) + 1;
      const room = this.h - y0 - 3;
      this.drips.push({
        x,
        y0,
        len: 0,
        // Longueurs très inégales : des coulures de même taille feraient un rideau.
        target: rng.chance(0.3) ? rng.range(room * 0.55, room * 0.85) : rng.range(3, Math.max(5, room * 0.4)),
        speed: rng.range(2.2, 6.5),
        delay: rng.range(0, 5),
        w: rng.chance(0.4) ? 2 : 1,
        dropY: -1,
        dropDelay: rng.range(2, 9),
      });
    }
  }

  start(): void {
    if (this.raf) return;
    this.last = performance.now();
    const frame = (now: number): void => {
      const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
      this.last = now;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private update(dt: number): void {
    for (const d of this.drips) {
      if (d.delay > 0) {
        d.delay -= dt;
        continue;
      }
      if (d.len < d.target) {
        // Ralentit en s'allongeant : la goutte se charge avant de céder.
        d.len = Math.min(d.target, d.len + d.speed * dt * (1 - d.len / (d.target * 1.6)));
      } else {
        d.dropDelay -= dt;
        if (d.dropDelay <= 0 && d.dropY < 0) {
          d.dropY = d.y0 + d.len;
          d.dropDelay = 4 + (d.x % 7);
        }
      }
      if (d.dropY >= 0) {
        d.dropY += 34 * dt;
        if (d.dropY > this.h + 2) {
          d.dropY = -1;
          // La coulure se rétracte un peu après avoir lâché sa goutte.
          d.len = Math.max(2, d.len - 4);
        }
      }
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    const { w, h, inkH } = this;
    if (this.mask.length === 0) return;
    ctx.clearRect(0, 0, w, h);

    // Coulures d'abord : elles passent derrière les lettres, ce qui les fait paraître
    // sourdre de la matière plutôt que d'y être collées.
    for (const d of this.drips) {
      if (d.len <= 0) continue;
      for (let i = 0; i < d.len; i++) {
        const y = d.y0 + i;
        if (y >= h) break;
        // La coulure s'assombrit en descendant, comme du sang qui sèche.
        ctx.fillStyle = mix(this.pal.dripTop, this.pal.dripEnd, Math.min(1, i / (DRIP_SPACE * 0.8)));
        ctx.fillRect(d.x, y, d.w, 1);
      }
      // Bourrelet au bout : une coulure à bout carré ne ressemble à rien.
      const tip = d.y0 + d.len;
      if (tip < h - 1) {
        ctx.fillStyle = this.pal.dripEnd;
        ctx.fillRect(d.x, tip, d.w + 1, 2);
      }
      if (d.dropY >= 0) {
        ctx.fillStyle = this.pal.dripTop;
        ctx.fillRect(d.x, Math.round(d.dropY), d.w, 2);
      }
    }

    // Ombre portée d'un pixel, en bas à droite de l'encre : elle détache le logo du ciel.
    ctx.fillStyle = this.pal.shadow;
    for (let y = 0; y < inkH; y++) {
      for (let x = 0; x < w; x++) {
        if (this.mask[y * w + x] && x + 1 < w && y + 1 < inkH && !this.mask[(y + 1) * w + x + 1]) {
          ctx.fillRect(x + 1, y + 1, 1, 1);
        }
      }
    }

    // Lettres : dégradé vertical du sang vif au sang sombre, avec un liseré clair sur chaque
    // bord supérieur d'encre – là où la lumière accrocherait.
    for (let y = 0; y < inkH; y++) {
      const body = mix(this.pal.top, this.pal.bottom, (y / Math.max(1, inkH - 1)) * 0.9);
      for (let x = 0; x < w; x++) {
        if (!this.mask[y * w + x]) continue;
        const edge = y === 0 || !this.mask[(y - 1) * w + x];
        ctx.fillStyle = edge ? this.pal.crown : body;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}
