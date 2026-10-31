import { Rng } from '../core/rng';
import { castleNames, castleSubtitle, cemeteryNames, cemeterySubtitle, prioryNames, priorySubtitle, villageNames, villageSubtitle } from '../data/sites';
import { buildCemetery, buildPriory, CEMETERY_DEPTH, CEMETERY_WIDTH, PRIORY_DEPTH, PRIORY_WIDTH } from './holyground';
import { buildShrine } from './shrines';
import type { ShrineType } from './siteplan';
import { buildCastle, CASTLE_DEPTH, CASTLE_WIDTH } from './castleplan';
import { NavField } from './sitenav';
import { emptySite, settlePoints, type Rect, type Site, type SiteKind, type SitePoint } from './siteplan';
import { buildVestige, buildVillage } from './villages';

/**
 * Répartition des lieux dans le monde.
 *
 * Un lieu est **déterministe à partir de la graine et de sa cellule**, comme tout le reste du
 * terrain : rien n'est stocké, et le même château attend au même endroit à chaque reprise.
 */

export type { Site, SiteKind, SitePoint } from './siteplan';

/** Une cellule porte au plus un lieu majeur : elle dépasse largement le plus grand château. */
const SITE_CELL = 4400;
/** Plus grand débord d'un lieu par rapport au centre de sa cellule. */
const SITE_REACH = 2300;
/** Vestiges isolés : une maison, un pan de mur, seuls dans la lande. */
const VESTIGE_CELL = 1500;
/** Une structure toutes les ~1 100 px, soit une toutes les 11 s de marche : elles sont grandes. */
export const SHRINE_CELL = 900;
/** Portée d'une structure autour de son origine : la plus large, la chapelle noyée, y tient. */
const SHRINE_REACH = 480;

/**
 * Vue publique d'un lieu, pour tout ce qui n'a pas à connaître le rendu.
 *
 * C'est l'interface du système de quêtes : `Terrain.sites.list(x, y, rayon)` rend ces fiches, du
 * plus proche au plus lointain, et `points` nomme les endroits où envoyer le joueur.
 */
export interface SiteInfo {
  /** Stable pour une graine donnée : on peut le mémoriser dans une sauvegarde. */
  id: string;
  kind: SiteKind;
  name: string;
  /** Centre du lieu. */
  x: number;
  y: number;
  /** Emprise au sol. */
  bounds: Rect;
  /** L'entrée principale. */
  entrance: { x: number; y: number };
  /** Points d'intérêt intérieurs. */
  points: SitePoint[];
}

export function siteInfo(s: Site): SiteInfo {
  return { id: s.id, kind: s.kind, name: s.name, x: s.cx, y: s.cy, bounds: s.bounds, entrance: s.entrance, points: s.points };
}

function cellHash(cx: number, cy: number, salt: number): number {
  let n = Math.imul(cx, 0x27d4eb2d) ^ Math.imul(cy, 0x165667b1) ^ Math.imul(salt, 0x9e3779b9);
  n = (n ^ (n >>> 15)) >>> 0;
  n = Math.imul(n, 0x85ebca6b) >>> 0;
  return (n ^ (n >>> 13)) >>> 0;
}

const cellKey = (cx: number, cy: number): number => (cx + 0x4000) * 0x8000 + (cy + 0x4000);

/** Tous les lieux d'une partie, générés à la demande. */
export class SiteField {
  private readonly cells = new Map<number, Site | null>();
  private readonly vestiges = new Map<number, Site | null>();
  private readonly shrines = new Map<number, Site | null>();
  private readonly buf: Site[] = [];
  private readonly castleCell: number;
  private readonly castleNameList: string[];
  private readonly villageNameList: string[];
  private readonly cemeterySide: number;
  private nav: NavField | null = null;
  private navTimer = 0;
  private readonly seen = new Set<string>();
  /** Cimetières dont les morts se sont déjà levés : gardé dans la sauvegarde, c'est une seule fois. */
  readonly risen = new Set<string>();
  /** Lieu où se trouve le héros, s'il y en a un. */
  active: Site | null = null;
  /** Lieu dans lequel le héros vient de pénétrer pour la première fois. */
  entered: Site | null = null;

  constructor(private readonly seed: number, private readonly pickShrine: (rng: Rng, x: number, y: number) => ShrineType | null) {
    const rng = new Rng(cellHash(1, 2, seed ^ 0x5a17c0de));
    // Le premier château attend au nord du départ, sa façade tournée vers le joueur.
    this.castleCell = rng.int(-1, 1);
    this.castleNameList = rng.shuffle(castleNames());
    this.villageNameList = rng.shuffle(villageNames());
    // Le premier cimetière et le premier prieuré se partagent les deux flancs du départ.
    this.cemeterySide = rng.chance(0.5) ? 1 : -1;
  }

  private siteAt(cx: number, cy: number): Site | null {
    const key = cellKey(cx, cy);
    const hit = this.cells.get(key);
    if (hit !== undefined) return hit;
    this.cells.set(key, null);

    const rng = new Rng(cellHash(cx, cy, this.seed ^ 0x3c6ef372));
    let out: Site | null = null;
    const firstCastle = cy === -1 && cx === this.castleCell;
    const ring = Math.max(Math.abs(cx), Math.abs(cy));
    // La case de départ reste libre : on ne commence pas une partie dans un village.
    if (cx === 0 && cy === 0) {
      out = null;
    } else if (firstCastle || (ring >= 3 && rng.next() < 0.09)) {
      const room = SITE_CELL / 2 - CASTLE_WIDTH / 2 - 60;
      const x = cx * SITE_CELL - CASTLE_WIDTH / 2 + rng.range(-room, room) * 0.8;
      const y = cy * SITE_CELL - CASTLE_DEPTH / 2 + (firstCastle ? 700 : rng.range(-300, 300));
      const name = this.castleNameList[Math.abs(cx * 7 + cy * 13) % this.castleNameList.length]!;
      const s = emptySite(`castle:${cx}:${cy}`, 'castle', name, castleSubtitle(), x, y);
      s.bounds = { x, y: y - 40, w: CASTLE_WIDTH, h: CASTLE_DEPTH + 120 };
      s.cx = x + CASTLE_WIDTH / 2;
      s.cy = y + CASTLE_DEPTH / 2;
      s.entrance = { x: x + CASTLE_WIDTH / 2, y: y + CASTLE_DEPTH + 90 };
      buildCastle(s);
      settlePoints(s);
      out = s;
    } else if ((cy === 0 && cx === this.cemeterySide) || (ring >= 2 && rng.next() < 0.1)) {
      out = this.placeHolyGround(cx, cy, rng, 'cemetery', ring);
    } else if ((cy === 0 && cx === -this.cemeterySide) || (ring >= 2 && rng.next() < 0.1)) {
      out = this.placeHolyGround(cx, cy, rng, 'priory', ring);
    } else if (rng.next() < 0.78) {
      // Les premiers villages se rapprochent du départ : on en croise un dans la première minute.
      const pull = ring === 1 ? 0.72 : 1;
      const j = SITE_CELL / 2 - 900;
      const x = (cx * SITE_CELL + rng.range(-j, j)) * pull;
      const y = (cy * SITE_CELL + rng.range(-j, j)) * pull;
      // Fonction de la case, pas de l'ordre de visite : voisins distincts, et le même nom à la reprise.
      const count = this.villageNameList.length;
      const name = this.villageNameList[(((cx * 5 + cy * 3) % count) + count) % count]!;
      const s = emptySite(`village:${cx}:${cy}`, 'village', name, villageSubtitle(), x, y);
      buildVillage(s, rng);
      settlePoints(s);
      out = s;
    }
    this.cells.set(key, out);
    return out;
  }

  private placeHolyGround(cx: number, cy: number, rng: Rng, kind: 'cemetery' | 'priory', ring: number): Site {
    const cemetery = kind === 'cemetery';
    const w = cemetery ? CEMETERY_WIDTH : PRIORY_WIDTH, h = cemetery ? CEMETERY_DEPTH : PRIORY_DEPTH;
    const pull = ring === 1 ? 0.72 : 1;
    const j = SITE_CELL / 2 - 900;
    const x = (cx * SITE_CELL + rng.range(-j, j)) * pull - w / 2;
    const y = (cy * SITE_CELL + rng.range(-j, j)) * pull - h / 2;
    const list = cemetery ? cemeteryNames() : prioryNames();
    const name = list[Math.abs(cx * 3 + cy * 5) % list.length]!;
    const s = emptySite(`${kind}:${cx}:${cy}`, kind, name, cemetery ? cemeterySubtitle() : priorySubtitle(), x, y);
    if (cemetery) {
      buildCemetery(s, rng);
      if (this.risen.has(s.id)) s.risers = [];
    }
    if (!cemetery) buildPriory(s, rng);
    settlePoints(s);
    return s;
  }

  /** La structure d'une case, s'il y en a une. Le type revient au terrain, qui connaît les biomes. */
  shrineAt(cx: number, cy: number): Site | null {
    const key = cellKey(cx, cy);
    const hit = this.shrines.get(key);
    if (hit !== undefined) return hit;
    this.shrines.set(key, null);
    const rng = new Rng(cellHash(cx, cy, this.seed ^ 0x2b7e1516));
    if (!rng.chance(0.62)) return null;
    const x = (cx + 0.5) * SHRINE_CELL + rng.range(-130, 130);
    const y = (cy + 0.5) * SHRINE_CELL + rng.range(-130, 130);
    // Le départ reste dégagé, et une structure ne pousse ni dans un lieu ni contre un vestige.
    if (Math.hypot(x, y) < 700 || this.inMajorSite(x, y, 520) || this.nearVestige(x, y)) return null;
    const type = this.pickShrine(rng, x, y);
    if (!type) return null;
    const s = emptySite(`shrine:${cx}:${cy}`, 'shrine', '', '', x, y);
    buildShrine(s, type);
    this.shrines.set(key, s);
    return s;
  }

  private nearVestige(x: number, y: number): boolean {
    const vx = Math.floor(x / VESTIGE_CELL), vy = Math.floor(y / VESTIGE_CELL);
    for (let j = vy - 1; j <= vy + 1; j++) {
      for (let i = vx - 1; i <= vx + 1; i++) {
        const v = this.vestigeAt(i, j);
        if (v && this.overlaps(v, x, y, 440)) return true;
      }
    }
    return false;
  }

  private vestigeAt(cx: number, cy: number): Site | null {
    const key = cellKey(cx, cy);
    const hit = this.vestiges.get(key);
    if (hit !== undefined) return hit;
    const rng = new Rng(cellHash(cx, cy, this.seed ^ 0x1b873593));
    let out: Site | null = null;
    if (rng.next() < 0.3) {
      const x = cx * VESTIGE_CELL + rng.range(200, VESTIGE_CELL - 400);
      const y = cy * VESTIGE_CELL + rng.range(200, VESTIGE_CELL - 300);
      if (Math.hypot(x, y) > 700 && !this.inMajorSite(x, y, 500)) {
        const s = emptySite(`vestige:${cx}:${cy}`, 'vestige', '', '', x, y);
        buildVestige(s, rng);
        out = s;
      }
    }
    this.vestiges.set(key, out);
    return out;
  }

  private inMajorSite(x: number, y: number, margin: number): boolean {
    const cx = Math.round(x / SITE_CELL), cy = Math.round(y / SITE_CELL);
    for (let j = cy - 1; j <= cy + 1; j++) {
      for (let i = cx - 1; i <= cx + 1; i++) {
        const s = this.siteAt(i, j);
        if (!s) continue;
        const b = s.bounds;
        if (x > b.x - margin && x < b.x + b.w + margin && y > b.y - margin && y < b.y + b.h + margin) return true;
      }
    }
    return false;
  }

  /** Lieux dont l'emprise approche d'un point. Tampon réutilisé, ne pas conserver. */
  near(x: number, y: number, radius: number): Site[] {
    const out = this.buf;
    out.length = 0;
    const R = radius + SITE_REACH;
    const c0x = Math.round((x - R) / SITE_CELL), c1x = Math.round((x + R) / SITE_CELL);
    const c0y = Math.round((y - R) / SITE_CELL), c1y = Math.round((y + R) / SITE_CELL);
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const s = this.siteAt(cx, cy);
        if (s && this.overlaps(s, x, y, radius)) out.push(s);
      }
    }
    const V = radius + 420;
    const v0x = Math.floor((x - V) / VESTIGE_CELL), v1x = Math.floor((x + V) / VESTIGE_CELL);
    const v0y = Math.floor((y - V) / VESTIGE_CELL), v1y = Math.floor((y + V) / VESTIGE_CELL);
    for (let cy = v0y; cy <= v1y; cy++) {
      for (let cx = v0x; cx <= v1x; cx++) {
        const s = this.vestigeAt(cx, cy);
        if (s && this.overlaps(s, x, y, radius)) out.push(s);
      }
    }
    const S = radius + SHRINE_REACH;
    const s0x = Math.floor((x - S) / SHRINE_CELL), s1x = Math.floor((x + S) / SHRINE_CELL);
    const s0y = Math.floor((y - S) / SHRINE_CELL), s1y = Math.floor((y + S) / SHRINE_CELL);
    for (let cy = s0y; cy <= s1y; cy++) {
      for (let cx = s0x; cx <= s1x; cx++) {
        const s = this.shrineAt(cx, cy);
        if (s && this.overlaps(s, x, y, radius)) out.push(s);
      }
    }
    return out;
  }

  private overlaps(s: Site, x: number, y: number, r: number): boolean {
    const b = s.bounds;
    return x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r;
  }

  /**
   * Vrai dans une zone que le décor semé doit laisser libre.
   * Appelé pour chaque arbre et chaque caillou générés, jamais à chaque image.
   */
  isClear(x: number, y: number): boolean {
    for (const s of this.near(x, y, 700)) {
      for (const r of s.clear) {
        if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true;
      }
    }
    return false;
  }

  /** Force d'un village en un point : 0 dehors, 1 sur la place. Le château ne compte pas. */
  villageForce(x: number, y: number): number {
    const cx = Math.round(x / SITE_CELL), cy = Math.round(y / SITE_CELL);
    let f = 0;
    for (let j = cy - 1; j <= cy + 1; j++) {
      for (let i = cx - 1; i <= cx + 1; i++) {
        const s = this.siteAt(i, j);
        if (!s || s.radius <= 0) continue;
        const d = Math.hypot(x - s.cx, y - s.cy);
        if (d < s.radius) f = Math.max(f, 1 - d / s.radius);
      }
    }
    return f;
  }

  /** Lieux majeurs dans un rayon, du plus proche au plus lointain : l'entrée des quêtes. */
  list(x: number, y: number, radius: number): SiteInfo[] {
    const out: Site[] = [];
    const R = radius + SITE_REACH;
    for (let cy = Math.round((y - R) / SITE_CELL); cy <= Math.round((y + R) / SITE_CELL); cy++) {
      for (let cx = Math.round((x - R) / SITE_CELL); cx <= Math.round((x + R) / SITE_CELL); cx++) {
        const s = this.siteAt(cx, cy);
        if (s && Math.hypot(s.cx - x, s.cy - y) <= radius) out.push(s);
      }
    }
    return out.sort((a, b) => Math.hypot(a.cx - x, a.cy - y) - Math.hypot(b.cx - x, b.cy - y)).map(siteInfo);
  }

  /** Une fiche par identifiant, pour une quête qui revient à son lieu. */
  byId(id: string): SiteInfo | null {
    const [, a, b] = id.split(':');
    const s = this.siteAt(Number(a), Number(b));
    return s && s.id === id ? siteInfo(s) : null;
  }

  private readonly beaconBuf: Site[] = [];
  private beaconX = Infinity;
  private beaconY = Infinity;

  /**
   * Lieux à signaler au bord de l'écran : le château de loin, un village à portée de marche.
   * Une fois visité, un lieu se tait. Mémorisé, recalculé tous les 200 pixels parcourus.
   */
  beacons(x: number, y: number): readonly Site[] {
    if (Math.hypot(x - this.beaconX, y - this.beaconY) < 200) return this.beaconBuf;
    this.beaconX = x;
    this.beaconY = y;
    const out = this.beaconBuf;
    out.length = 0;
    const R = 7000;
    for (let cy = Math.round((y - R) / SITE_CELL); cy <= Math.round((y + R) / SITE_CELL); cy++) {
      for (let cx = Math.round((x - R) / SITE_CELL); cx <= Math.round((x + R) / SITE_CELL); cx++) {
        const s = this.siteAt(cx, cy);
        if (!s || this.seen.has(s.id)) continue;
        const d = Math.hypot(s.cx - x, s.cy - y);
        if (d < (s.kind === 'castle' ? R : 2800)) out.push(s);
      }
    }
    return out;
  }

  /** Suit le héros : lieu courant, entrée, et champ de navigation. */
  update(px: number, py: number, dt: number): void {
    this.entered = null;
    let found: Site | null = null;
    const M = 320;
    for (const s of this.near(px, py, M)) {
      if ((s.kind === 'vestige' || s.kind === 'shrine') && found) continue;
      found = s;
    }
    if (found !== this.active) {
      this.active = found;
      this.nav = found ? new NavField(found) : null;
      this.navTimer = 0;
    }
    if (found && found.name !== '' && !this.seen.has(found.id)) {
      const b = found.bounds;
      if (px > b.x && px < b.x + b.w && py > b.y && py < b.y + b.h) {
        this.seen.add(found.id);
        this.entered = found;
        this.beaconX = Infinity;
      }
    }
    this.navTimer -= dt;
    if (this.nav && this.navTimer <= 0) {
      this.navTimer = 0.3;
      this.nav.update(px, py);
    }
  }

  /** Direction de contournement à ce point, de 0 à 7, ou −1 s'il suffit d'aller tout droit. */
  steer(x: number, y: number): number {
    return this.nav ? this.nav.steer(x, y) : -1;
  }

  /**
   * Corrige un point d'apparition : jamais dans un mur, jamais de l'autre côté d'une enceinte.
   * Rend `null` quand le point proposé convient tel quel.
   */
  spawnPoint(rng: Rng, x: number, y: number, visible: (x: number, y: number) => boolean): { x: number; y: number } | null {
    const nav = this.nav;
    if (!nav) return this.isSolid(x, y) ? { x: x + 60, y: y + 60 } : null;
    // Une horde qu'il faudrait trois minutes pour rejoindre le héros ne le menace pas.
    if (nav.walkDistance(x, y) < 1100) return null;
    return nav.pickSpawn(rng, 460, 1000, (ax, ay) => !visible(ax, ay));
  }

  /** Vrai si le point est dans un mur d'un lieu proche. */
  isSolid(x: number, y: number): boolean {
    for (const s of this.near(x, y, 60)) {
      for (const r of s.solids) {
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
      }
    }
    return false;
  }

  /** Murs dans un rayon : quatre nombres par mur, comme les attend le monde. */
  wallsNear(x: number, y: number, radius: number, out: [number, number, number, number][]): void {
    for (const s of this.near(x, y, radius)) {
      for (const r of s.solids) {
        if (r.x < x + radius && r.x + r.w > x - radius && r.y < y + radius && r.y + r.h > y - radius) {
          out.push([r.x, r.y, r.w, r.h]);
        }
      }
    }
  }
}
