import { Brush } from '../gfx/brush';
import {
  OUTLINE, paintRampart, paintRampartNS, paintRoundTower, TOWER_SQUASH,
  type FloorKind, type RampartRun, type Tower,
} from '../gfx/castle';

/**
 * Plan d'un lieu : ce qui, dans le monde, se visite.
 *
 * Un lieu est décrit en listes distinctes, et c'est cette séparation qui fait tout le travail :
 *   – `solids` : des rectangles, seule vérité pour les collisions et la navigation ;
 *   – `pieces` : des sprites dotés d'une clé de profondeur, triés avec les créatures ;
 *   – `floors` et `decals` : ce qui est posé au sol, sous tout le reste ;
 *   – `points` : les points remarquables, lisibles par le système de quêtes.
 *
 * Rien n'est peint à la construction : un lieu n'est d'abord qu'un plan. Les sprites naissent à
 * l'approche, tronçon par tronçon, et meurent quand on s'éloigne.
 */

export interface Rect { x: number; y: number; w: number; h: number }

/**
 * Décalage entre la position d'une créature et le contact de ses pieds au sol.
 *
 * Le héros est ancré à hauteur de bassin : ses pieds sont dix pixels plus bas. Sans ce décalage,
 * il s'arrêterait quinze pixels avant le pied d'un mur et s'y enfoncerait de l'autre côté.
 */
export const FOOT_OFFSET = 10;

/** Finesse du profil des sprites, voir `Brush.skyline`. */
export const SKYLINE_STEP = 8;

export interface Piece {
  /** Fenêtre du sprite, en coordonnées du lieu. */
  lx: number;
  ly: number;
  w: number;
  h: number;
  /** Coin haut-gauche du sprite, dans le monde. */
  x: number;
  y: number;
  /** Ordonnée de tri, à comparer à celle des créatures. */
  key: number;
  paint: (b: Brush) => void;
  canvas: HTMLCanvasElement | null;
  /** Silhouette : première ligne peinte, par colonnes de `SKYLINE_STEP` pixels. */
  skyline: Int16Array | null;
  alpha: number;
  /** Devient translucide quand le héros passe derrière. */
  fades: boolean;
  /**
   * Distance derrière la clé avant de commencer à s'effacer.
   * Sous une porte, le héros se voit par l'ogive : le massif n'a aucune raison de disparaître.
   */
  clearance: number;
  /** Enveloppe d'un groupe de salles : s'efface dès qu'on y entre. −1 : aucun. */
  shell: number;
  /** Intérieur d'un groupe de salles : invisible tant qu'on n'y est pas. −1 : aucun. */
  inner: number;
}

export interface FloorPatch extends Rect { kind: FloorKind }

export interface SiteLight { x: number; y: number; rx: number; ry: number; color: string; alpha: number }

/** Groupe de salles, sous un même toit. */
export interface RoomGroup {
  rects: Rect[];
  /** 0 fermé, 1 ouvert : où en est le fondu de l'enveloppe. */
  open: number;
}

/** Point remarquable, en coordonnées du monde. */
export interface SitePoint {
  id: string;
  name: string;
  x: number;
  y: number;
}

/** Monstres logés dans un lieu : ils se lèvent quand on approche, une seule fois. */
export interface Garrison {
  x: number;
  y: number;
  enemy: string;
  count: number;
  /** Rang de résistance facultatif, identifiant de `RANG_BY_ID`. */
  rank?: 'endurci' | 'elite' | 'colosse';
  /** Écart des corps autour du point. */
  spread: number;
  done: boolean;
}

export type SiteKind = 'castle' | 'village' | 'vestige' | 'shrine' | 'cemetery' | 'priory';

export type ShrineType =
  | 'altar' | 'pyre' | 'obelisk' | 'well' | 'ossuary' | 'chapel' | 'cairn'
  | 'windmill' | 'hut' | 'hangtree' | 'forge' | 'colossus';

/** Ce qui fait d'un lieu une structure à activer. */
export interface ShrineState {
  type: ShrineType;
  lit: boolean;
  /** Le point à atteindre, dans le monde. */
  x: number;
  y: number;
  /** Là où brûle ce qui l'anime. */
  focusX: number;
  focusY: number;
  /** Groupe de salles dont il faut être à l'intérieur pour voir ce foyer. −1 : toujours visible. */
  group: number;
}

/** Un mort qui attend dans sa tombe que le héros passe la grille. */
export interface Riser {
  x: number;
  y: number;
  enemy: string;
  /** Secondes après l'entrée. */
  delay: number;
}

export interface Site {
  id: string;
  kind: SiteKind;
  name: string;
  subtitle: string;
  /** Origine des coordonnées du lieu, dans le monde. */
  x: number;
  y: number;
  /** Emprise au sol, dans le monde. */
  bounds: Rect;
  /** Centre de gravité : là où pointe la flèche de bord d'écran. */
  cx: number;
  cy: number;
  /** Rayon d'influence, pour la pression de la horde. Zéro : aucune. */
  radius: number;
  /** L'entrée principale, dans le monde. */
  entrance: { x: number; y: number };
  points: SitePoint[];
  solids: Rect[];
  /** Zones que les arbres, cailloux et structures doivent laisser libres. */
  clear: Rect[];
  pieces: Piece[];
  floors: FloorPatch[];
  decals: Piece[];
  lights: SiteLight[];
  groups: RoomGroup[];
  garrison: Garrison[];
  shrine?: ShrineState;
  risers?: Riser[];
  /** Secondes depuis l'entrée. Négatif : la grille n'a pas encore été passée. */
  riseClock: number;
}

/** Lieu vide, prêt à recevoir son plan. */
export const emptySite = (id: string, kind: SiteKind, name: string, subtitle: string, x: number, y: number): Site => ({
  id, kind, name, subtitle, x, y,
  bounds: { x, y, w: 0, h: 0 }, cx: x, cy: y, radius: 0, entrance: { x, y },
  points: [], solids: [], clear: [], pieces: [], floors: [], decals: [], lights: [], groups: [], garrison: [], riseClock: -1,
});

export interface PieceOptions {
  fades?: boolean;
  clearance?: number;
  shell?: number;
  inner?: number;
}

/** Chantier d'un lieu : tout s'y écrit en coordonnées locales. */
export class Plan {
  constructor(readonly site: Site) {}

  piece(x: number, y: number, w: number, h: number, key: number, paint: (b: Brush) => void, opts: PieceOptions = {}): void {
    const s = this.site;
    s.pieces.push({
      lx: x, ly: y, w, h, x: s.x + x, y: s.y + y, key: s.y + key, paint, canvas: null, skyline: null, alpha: 1,
      fades: opts.fades ?? true, clearance: opts.clearance ?? 0, shell: opts.shell ?? -1, inner: opts.inner ?? -1,
    });
  }

  decal(x: number, y: number, w: number, h: number, paint: (b: Brush) => void, inner = -1): void {
    const s = this.site;
    // Découpé en tuiles : un tapis de cinq cents pixels ne doit pas être un seul canvas.
    const S = 256;
    for (let py = y; py < y + h; py += S) {
      for (let px = x; px < x + w; px += S) {
        s.decals.push({
          lx: px, ly: py, w: Math.min(S, x + w - px), h: Math.min(S, y + h - py), x: s.x + px, y: s.y + py,
          key: 0, paint, canvas: null, skyline: null, alpha: 1, fades: false, clearance: 0, shell: -1, inner,
        });
      }
    }
  }

  floor(x: number, y: number, w: number, h: number, kind: FloorKind): void {
    const s = this.site;
    s.floors.push({ x: s.x + x, y: s.y + y, w, h, kind });
  }

  /** Emprise au sol d'un objet : décalée du contact des pieds, voir `FOOT_OFFSET`. */
  solid(x: number, y: number, w: number, h: number): void {
    const s = this.site;
    s.solids.push({ x: s.x + x, y: s.y + y - FOOT_OFFSET, w, h });
  }

  clear(x: number, y: number, w: number, h: number): void {
    const s = this.site;
    s.clear.push({ x: s.x + x, y: s.y + y, w, h });
  }

  light(x: number, y: number, rx: number, ry: number, color: string, alpha: number): void {
    const s = this.site;
    s.lights.push({ x: s.x + x, y: s.y + y, rx, ry, color, alpha });
  }

  point(id: string, name: string, x: number, y: number): void {
    const s = this.site;
    s.points.push({ id, name, x: s.x + x, y: s.y + y });
  }

  garrison(x: number, y: number, enemy: string, count: number, spread: number, rank?: Garrison['rank']): void {
    const s = this.site;
    s.garrison.push({ x: s.x + x, y: s.y + y, enemy, count, spread, rank, done: false });
  }

  group(rects: Rect[]): number {
    const s = this.site;
    s.groups.push({ rects: rects.map((r) => ({ x: s.x + r.x, y: s.y + r.y, w: r.w, h: r.h })), open: 0 });
    return s.groups.length - 1;
  }

  /** Courtine est-ouest, découpée en tronçons : c'est ce qui rend le fondu local. */
  rampart(r: RampartRun, opts: PieceOptions = {}, solid = true): void {
    const top = r.y - r.height - 44;
    const h = r.height + r.depth + 54;
    // Assez étroit pour que le fondu autour du héros se lise comme une lueur, pas comme des blocs.
    const SECTION = 64;
    for (let x = r.x0; x < r.x1; x += SECTION) {
      this.piece(x, top, Math.min(SECTION, r.x1 - x), h, r.y + r.depth / 2, (b) => paintRampart(b, r), opts);
    }
    if (solid) this.solid(r.x0, r.y, r.x1 - r.x0, r.depth);
  }

  rampartNS(x: number, y0: number, y1: number, depth: number, height: number, face: 1 | -1): void {
    const SECTION = 96;
    for (let y = y0; y < y1; y += SECTION) {
      const end = Math.min(y1, y + SECTION);
      this.piece(x - 4, y - height - 10, depth + 8, end - y + height + 12, end, (b) => paintRampartNS(b, x, y0, y1, depth, height, face), { fades: false });
    }
    this.solid(x, y0, depth, y1 - y0);
  }

  tower(t: Tower, opts: PieceOptions = {}): void {
    const R = t.radius + 20;
    const crown = t.height + t.radius * TOWER_SQUASH;
    const top = t.foot - crown - t.roof - 60;
    const footCentre = t.foot - t.radius * TOWER_SQUASH;
    this.piece(t.cx - R, top, R * 2 + 28, t.foot - top + 12, footCentre, (b) => paintRoundTower(b, t), opts);
    const r = t.radius;
    this.solid(t.cx - r * 0.72, t.foot - r * 0.86, r * 1.44, r * 0.86);
    this.solid(t.cx - r, t.foot - r * 0.62, r * 2, r * 0.42);
  }

  /** Objet posé au sol : `foot` est son pied, `paint` le dessine depuis là. */
  prop(cx: number, foot: number, halfW: number, h: number, paint: (b: Brush) => void, opts: PieceOptions & { block?: [number, number] } = {}): void {
    this.piece(cx - halfW, foot - h, halfW * 2, h + 10, foot - 6, paint, { fades: false, ...opts });
    if (opts.block) this.solid(cx - opts.block[0] / 2, foot - opts.block[1], opts.block[0], opts.block[1]);
  }
}

/**
 * Sort de tout mur les points remarquables et les garnisons.
 *
 * Un plan retourné, ou un meuble déplacé, peut poser un point sur un obstacle. Le système de
 * quêtes enverrait alors le joueur vers un endroit qu'il ne peut pas atteindre. Le point glisse
 * donc vers la place libre la plus proche, en spirale, une fois le plan terminé.
 */
export function settlePoints(site: Site): void {
  const blocked = (x: number, y: number): boolean => {
    const M = 16;
    return site.solids.some((r) => x > r.x - M && x < r.x + r.w + M && y > r.y - M && y < r.y + r.h + M);
  };
  const settle = (o: { x: number; y: number }): void => {
    if (!blocked(o.x, o.y)) return;
    for (let ring = 1; ring < 16; ring++) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const x = o.x + Math.cos(a) * ring * 14, y = o.y + Math.sin(a) * ring * 14;
        if (!blocked(x, y)) {
          o.x = x;
          o.y = y;
          return;
        }
      }
    }
  };
  site.points.forEach(settle);
  site.garrison.forEach(settle);
  settle(site.entrance);
}

/** Peint un morceau de lieu. Le contour se calcule sur une marge, recoupée ensuite. */
export function buildPiece(p: Piece): HTMLCanvasElement {
  const pad = 2;
  const b = new Brush(p.lx - pad, p.ly - pad, p.w + pad * 2, p.h + pad * 2);
  p.paint(b);
  b.outline(OUTLINE);
  p.skyline = b.skyline(SKYLINE_STEP, pad);
  p.canvas = b.toCanvas(pad);
  return p.canvas;
}

/** Peint un décalque de sol. Pas de contour : un tapis ne se détache pas du sol. */
export function buildDecal(p: Piece): HTMLCanvasElement {
  const b = new Brush(p.lx, p.ly, p.w, p.h);
  p.paint(b);
  p.canvas = b.toCanvas();
  return p.canvas;
}
