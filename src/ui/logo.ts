import { Rng } from '../core/rng';
import { P, mix } from '../gfx/palette';

/**
 * Logo animé : « SANGUINE » en pixel art, dont le sang coule.
 *
 * Les lettres sont **dessinées à la main** en bitmap plutôt que rendues avec une police
 * système. Une police varie d'une machine à l'autre — et un logo qui change de forme selon
 * l'ordinateur n'est pas un logo. Sept glyphes suffisent ici : S, A, N, G, U, I, E.
 *
 * L'écoulement est simulé par colonne : chaque colonne encrée du bas des lettres porte une
 * coulure qui s'allonge, marque un temps, puis laisse tomber une goutte. C'est le même
 * principe que la peinture fraîche — la matière s'accumule au point bas avant de céder.
 */

const GLYPHS: Record<string, string[]> = {
  S: ['.XXXXX.', 'XX...XX', 'XX.....', 'XX.....', '.XXXXX.', '.....XX', '.....XX', 'XX...XX', '.XXXXX.'],
  A: ['..XXX..', '.XX.XX.', 'XX...XX', 'XX...XX', 'XXXXXXX', 'XX...XX', 'XX...XX', 'XX...XX', 'XX...XX'],
  N: ['XX...XX', 'XXX..XX', 'XXXX.XX', 'XX.XXXX', 'XX..XXX', 'XX...XX', 'XX...XX', 'XX...XX', 'XX...XX'],
  G: ['.XXXXX.', 'XX...XX', 'XX.....', 'XX.....', 'XX.XXXX', 'XX...XX', 'XX...XX', 'XX...XX', '.XXXXX.'],
  U: ['XX...XX', 'XX...XX', 'XX...XX', 'XX...XX', 'XX...XX', 'XX...XX', 'XX...XX', 'XX...XX', '.XXXXX.'],
  I: ['XXXXXXX', '..XXX..', '..XXX..', '..XXX..', '..XXX..', '..XXX..', '..XXX..', '..XXX..', 'XXXXXXX'],
  E: ['XXXXXXX', 'XX.....', 'XX.....', 'XX.....', 'XXXXX..', 'XX.....', 'XX.....', 'XX.....', 'XXXXXXX'],
  M: ['XX...XX', 'XXX.XXX', 'XXXXXXX', 'XX.X.XX', 'XX...XX', 'XX...XX', 'XX...XX', 'XX...XX', 'XX...XX'],
  O: ['.XXXXX.', 'XX...XX', 'XX...XX', 'XX...XX', 'XX...XX', 'XX...XX', 'XX...XX', 'XX...XX', '.XXXXX.'],
  R: ['XXXXXX.', 'XX...XX', 'XX...XX', 'XX...XX', 'XXXXXX.', 'XX.XX..', 'XX..XX.', 'XX...XX', 'XX...XX'],
  T: ['XXXXXXX', '..XXX..', '..XXX..', '..XXX..', '..XXX..', '..XXX..', '..XXX..', '..XXX..', '..XXX..'],
  B: ['XXXXXX.', 'XX...XX', 'XX...XX', 'XX...XX', 'XXXXXX.', 'XX...XX', 'XX...XX', 'XX...XX', 'XXXXXX.'],
};

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

const GW = 7;
const GH = 9;
const GAP = 2;
/**
 * Hauteur réservée sous les lettres pour les coulures et les gouttes.
 *
 * Elle pèse directement sur les proportions du canvas : à 26, les lettres n'occupaient plus
 * qu'un quart de la hauteur totale, et dimensionner le logo par sa largeur le faisait
 * déborder de l'écran. À 18, le rapport reste maîtrisable.
 */
const DRIP_SPACE = 18;

interface Drip {
  x: number;
  /** Ligne de départ, sous la lettre. */
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
  private mask: Uint8Array;
  private w: number;
  private h: number;
  private drips: Drip[] = [];
  private t = 0;
  private raf = 0;
  private last = 0;

  constructor(text = 'SANGUINE', seed = 0x51a9, private pal: LogoPalette = BLOOD) {
    const letters = [...text];
    this.w = letters.length * (GW + GAP) - GAP;
    this.h = GH + DRIP_SPACE;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.canvas.className = 'blood-logo';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', text);
    this.ctx = this.canvas.getContext('2d')!;

    // Masque des lettres : 1 = encre.
    this.mask = new Uint8Array(this.w * GH);
    letters.forEach((ch, i) => {
      const g = GLYPHS[ch];
      if (!g) return;
      const ox = i * (GW + GAP);
      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
          if (g[y]![x] === 'X') this.mask[y * this.w + ox + x] = 1;
        }
      }
    });

    this.buildDrips(new Rng(seed));
  }

  /**
   * Une coulure ne peut naître que d'un point bas réel de la lettre — un endroit d'où le
   * sang pourrait effectivement tomber. Partir de colonnes arbitraires donnerait des traits
   * suspendus dans le vide.
   */
  private buildDrips(rng: Rng): void {
    const candidates: number[] = [];
    for (let x = 0; x < this.w; x++) {
      for (let y = GH - 1; y >= 0; y--) {
        if (this.mask[y * this.w + x]) {
          // Uniquement les colonnes dont le bas est libre : sinon la coulure part du milieu.
          if (y >= GH - 2) candidates.push(x);
          break;
        }
      }
    }

    rng.shuffle(candidates);
    const n = Math.min(candidates.length, 16);
    for (let i = 0; i < n; i++) {
      const x = candidates[i]!;
      // Deux coulures collées se lisent comme une tache : on impose un écart minimal.
      if (this.drips.some((d) => Math.abs(d.x - x) < 3)) continue;
      this.drips.push({
        x,
        y0: GH,
        len: 0,
        target: rng.range(3, DRIP_SPACE * 0.72),
        speed: rng.range(1.6, 5),
        delay: rng.range(0, 5),
        w: rng.chance(0.35) ? 2 : 1,
        dropY: -1,
        dropDelay: rng.range(2, 9),
      });
    }
  }

  start(): void {
    if (this.raf) return;
    this.last = performance.now();
    const frame = (now: number): void => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
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
    this.t += dt;
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
        d.dropY += 26 * dt;
        if (d.dropY > this.h + 2) {
          d.dropY = -1;
          // La coulure se rétracte un peu après avoir lâché sa goutte.
          d.len = Math.max(2, d.len - 3);
        }
      }
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    const { w, h } = this;
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

    // Lettres : dégradé vertical du sang vif au sang sombre, plus un liseré clair en haut.
    for (let y = 0; y < GH; y++) {
      const k = y / (GH - 1);
      const col = y === 0 ? this.pal.crown : mix(this.pal.top, this.pal.bottom, k * 0.9);
      ctx.fillStyle = col;
      for (let x = 0; x < w; x++) {
        if (this.mask[y * w + x]) ctx.fillRect(x, y, 1, 1);
      }
    }

    // Ombre portée d'un pixel sous chaque lettre : détache le logo du ciel.
    ctx.fillStyle = this.pal.shadow;
    for (let x = 0; x < w; x++) {
      for (let y = GH - 1; y >= 0; y--) {
        if (this.mask[y * w + x]) {
          if (y + 1 < GH && !this.mask[(y + 1) * w + x]) ctx.fillRect(x, y + 1, 1, 1);
          break;
        }
      }
    }
  }
}
