import type { Rng } from '../core/rng';
import type { Site } from './siteplan';

/** Pas de la grille de navigation. */
const NAV_CELL = 20;
/** Marge autour du lieu : la horde doit pouvoir contourner l'enceinte par l'extérieur. */
const NAV_MARGIN = 300;
const UNREACHED = 0xffff;

/** Directions de la grille, en vecteurs unitaires. */
export const NAV_X = [1, 1, 0, -1, -1, -1, 0, 1].map((v, i) => (i % 2 ? v * Math.SQRT1_2 : v));
export const NAV_Y = [0, 1, 1, 1, 0, -1, -1, -1].map((v, i) => (i % 2 ? v * Math.SQRT1_2 : v));
const STEP_X = [1, 1, 0, -1, -1, -1, 0, 1];
const STEP_Y = [0, 1, 1, 1, 0, -1, -1, -1];

/**
 * Champ de navigation du lieu où se trouve le héros.
 *
 * Les ennemis foncent droit sur leur proie, ce qui suffit en rase campagne. Dans un château, ils
 * s'écraseraient tous sur le premier mur et le joueur n'aurait plus qu'à attendre dedans : une
 * forteresse deviendrait un abri gratuit. Un parcours en largeur depuis le héros donne à chaque
 * case la direction de la sortie, pour moins d'une milliseconde, trois fois par seconde.
 */
export class NavField {
  readonly cols: number;
  readonly rows: number;
  readonly x0: number;
  readonly y0: number;
  private readonly blocked: Uint8Array;
  private readonly dist: Uint16Array;
  private readonly dir: Int8Array;
  private readonly queue: Int32Array;
  private readonly sight: Uint8Array;
  private stamp = 1;
  private lastCell = -1;
  /** Cases atteintes par le dernier parcours, rangées par distance croissante dans `queue`. */
  private reached = 0;
  private targetX = 0;
  private targetY = 0;

  constructor(readonly site: Site) {
    const b = site.bounds;
    this.x0 = b.x - NAV_MARGIN;
    this.y0 = b.y - NAV_MARGIN;
    this.cols = Math.ceil((b.w + NAV_MARGIN * 2) / NAV_CELL);
    this.rows = Math.ceil((b.h + NAV_MARGIN * 2) / NAV_CELL);
    const n = this.cols * this.rows;
    this.blocked = new Uint8Array(n);
    this.dist = new Uint16Array(n).fill(UNREACHED);
    this.dir = new Int8Array(n).fill(-1);
    this.queue = new Int32Array(n);
    this.sight = new Uint8Array(n);
    const pad = 6;
    for (const s of site.solids) {
      const c0 = Math.floor((s.x - pad - this.x0) / NAV_CELL), c1 = Math.floor((s.x + s.w + pad - this.x0) / NAV_CELL);
      const r0 = Math.floor((s.y - pad - this.y0) / NAV_CELL), r1 = Math.floor((s.y + s.h + pad - this.y0) / NAV_CELL);
      for (let r = Math.max(0, r0); r <= Math.min(this.rows - 1, r1); r++) {
        for (let c = Math.max(0, c0); c <= Math.min(this.cols - 1, c1); c++) this.blocked[r * this.cols + c] = 1;
      }
    }
  }

  private cellAt(x: number, y: number): number {
    const c = Math.floor((x - this.x0) / NAV_CELL), r = Math.floor((y - this.y0) / NAV_CELL);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  /** Vrai pour une case libre, reliée au héros par le dernier parcours. */
  reachable(x: number, y: number): boolean {
    const i = this.cellAt(x, y);
    return i >= 0 && this.blocked[i] === 0 && this.dist[i] !== UNREACHED;
  }

  /** Distance à pied jusqu'au héros, en pixels. Infini si le point n'est pas relié. */
  walkDistance(x: number, y: number): number {
    const i = this.cellAt(x, y);
    return i >= 0 && this.dist[i] !== UNREACHED ? this.dist[i]! * NAV_CELL : Infinity;
  }

  /** Recalcule le champ si le héros a changé de case. */
  update(px: number, py: number): void {
    this.targetX = px;
    this.targetY = py;
    const { cols, rows, blocked, dist, queue, dir } = this;
    const col = Math.max(0, Math.min(cols - 1, Math.floor((px - this.x0) / NAV_CELL)));
    const row = Math.max(0, Math.min(rows - 1, Math.floor((py - this.y0) / NAV_CELL)));
    let start = row * cols + col;
    if (start === this.lastCell) return;
    this.lastCell = start;
    this.stamp = (this.stamp % 126) + 1;

    if (blocked[start] === 1) {
      // Le héros frôle un mur : on part de la case libre la plus proche.
      search: for (let ring = 1; ring < 6; ring++) {
        for (let d = 0; d < 8; d++) {
          const nc = col + STEP_X[d]! * ring, nr = row + STEP_Y[d]! * ring;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          if (blocked[nr * cols + nc] === 0) { start = nr * cols + nc; break search; }
        }
      }
    }

    dist.fill(UNREACHED);
    let head = 0, tail = 0;
    queue[tail++] = start;
    dist[start] = 0;
    while (head < tail) {
      const i = queue[head++]!;
      const d = dist[i]! + 1;
      const c = i % cols, r = (i / cols) | 0;
      if (c + 1 < cols && dist[i + 1] === UNREACHED && blocked[i + 1] === 0) { dist[i + 1] = d; queue[tail++] = i + 1; }
      if (c > 0 && dist[i - 1] === UNREACHED && blocked[i - 1] === 0) { dist[i - 1] = d; queue[tail++] = i - 1; }
      if (r + 1 < rows && dist[i + cols] === UNREACHED && blocked[i + cols] === 0) { dist[i + cols] = d; queue[tail++] = i + cols; }
      if (r > 0 && dist[i - cols] === UNREACHED && blocked[i - cols] === 0) { dist[i - cols] = d; queue[tail++] = i - cols; }
    }

    this.reached = tail;

    // Direction de chaque case : le voisin le plus proche de la cible, sans couper les angles.
    for (let k = 0; k < tail; k++) {
      const i = queue[k]!;
      const c = i % cols, r = (i / cols) | 0;
      let best = dist[i]! * 4, pick = -1;
      for (let d = 0; d < 8; d++) {
        const dc = STEP_X[d]!, dr = STEP_Y[d]!;
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const j = nr * cols + nc;
        if (dist[j] === UNREACHED) continue;
        if (dc !== 0 && dr !== 0 && (blocked[r * cols + nc] === 1 || blocked[nr * cols + c] === 1)) continue;
        // La diagonale gagne à distance égale : elle évite les marches d'escalier.
        const v = dist[j]! * 4 - (d % 2);
        if (v < best) { best = v; pick = d; }
      }
      dir[i] = pick;
    }
  }

  /** Ligne de vue entre une case et le héros, mémorisée pour la durée d'un parcours. */
  private clearLine(i: number, x: number, y: number): boolean {
    const memo = this.sight[i]!;
    if ((memo & 0x7f) === this.stamp) return (memo & 0x80) !== 0;
    const dx = this.targetX - x, dy = this.targetY - y;
    const steps = Math.ceil(Math.hypot(dx, dy) / (NAV_CELL * 0.7));
    let free = true;
    for (let k = 1; k < steps; k++) {
      const j = this.cellAt(x + (dx * k) / steps, y + (dy * k) / steps);
      if (j >= 0 && this.blocked[j] === 1) { free = false; break; }
    }
    this.sight[i] = this.stamp | (free ? 0x80 : 0);
    return free;
  }

  /**
   * Direction à suivre depuis un point, de 0 à 7.
   * −1 quand il n'y a rien à corriger : hors du champ, ou le héros est en vue directe.
   */
  steer(x: number, y: number): number {
    const i = this.cellAt(x, y);
    if (i < 0) return -1;
    // Une créature plaquée contre un mur occupe une case bloquée : elle vise la case libre voisine
    // la plus proche du héros, sans quoi elle pousserait droit dans le mur pour toujours.
    if (this.dist[i] === UNREACHED) return this.escape(i);
    if (this.clearLine(i, x, y)) return -1;
    return this.dir[i]!;
  }

  private escape(i: number): number {
    const { cols, rows, dist } = this;
    const c = i % cols, r = (i / cols) | 0;
    let best = UNREACHED, pick = -1;
    for (let ring = 1; ring <= 2 && pick < 0; ring++) {
      for (let d = 0; d < 8; d++) {
        const nc = c + STEP_X[d]! * ring, nr = r + STEP_Y[d]! * ring;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const v = dist[nr * cols + nc]!;
        if (v < best) { best = v; pick = d; }
      }
    }
    return pick;
  }

  /** Premier rang de `queue` à une distance au moins égale à `d`. La file est triée par distance. */
  private lowerBound(d: number): number {
    let lo = 0, hi = this.reached;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.dist[this.queue[mid]!]! < d) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /**
   * Une case reliée au héros, à bonne distance à pied, tirée au hasard.
   *
   * On tire dans la tranche voulue de la file du parcours, et non dans toute la grille : au fond
   * d'une crypte, presque aucune case n'est à bonne distance, et un tirage à l'aveugle reviendrait
   * bredouille alors que la place existe.
   */
  pickSpawn(rng: Rng, minD: number, maxD: number, accept: (x: number, y: number) => boolean): { x: number; y: number } | null {
    const a = this.lowerBound(Math.round(minD / NAV_CELL));
    const b = this.lowerBound(Math.round(maxD / NAV_CELL) + 1);
    if (b <= a) return null;
    let fallback: { x: number; y: number } | null = null;
    for (let k = 0; k < 24; k++) {
      const i = this.queue[rng.int(a, b - 1)]!;
      const x = this.x0 + ((i % this.cols) + 0.5) * NAV_CELL;
      const y = this.y0 + (((i / this.cols) | 0) + 0.5) * NAV_CELL;
      if (accept(x, y)) return { x, y };
      fallback = { x, y };
    }
    return fallback;
  }
}
