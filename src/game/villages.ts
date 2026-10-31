import type { Rng } from '../core/rng';
import { villagePointNames } from '../data/sites';
import { paintRubble, paintWell, paintDeadTree } from '../gfx/castle';
import {
  paintBarrels, paintBrambles, paintCart, paintChimney, paintDebris, paintFence, paintHeadstone, paintHouseFloor,
  paintRoofChunk, paintRuinTower, paintRuinWall, paintRuinWallNS, paintSquare, paintStall, paintStreet,
  paintWoodCross, type Profile, type RuinWall,
} from '../gfx/hamlet';
import { Plan, type Site } from './siteplan';

/**
 * Les villages : ce qui reste de ceux qui vivaient au pied du château.
 *
 * Un village se lit à trois choses : une rue, une place avec son puits, une église. Les maisons
 * s'alignent sur la rue, leur porte vers elle, et c'est cet alignement qui distingue un bourg
 * d'un champ de décombres. Trois plans écrits à la main, retournables, et chaque maison garde son
 * histoire propre : celle-ci a perdu son toit, celle-là n'a plus que sa cheminée.
 *
 * Règle reprise des anciennes ruines : **toute maison a au moins deux ouvertures**. Un joueur ne
 * doit jamais pouvoir s'y faire enfermer par la horde.
 */

/** Épaisseur d'un mur de maison. Le héros ne doit pas pouvoir le traverser d'un élan. */
const WALL = 18;

export type HouseKind = 'cottage' | 'long' | 'tall' | 'smithy' | 'barn' | 'inn';

interface HouseShape {
  w: number;
  d: number;
  /** Largeur libre de la porte, côté rue. */
  door: number;
  /** Profils des quatre murs. Nord et sud se lisent d'ouest en est, les autres du nord au sud. */
  north: Profile;
  south: Profile;
  west: Profile;
  east: Profile;
  /** Trous dans les murs bas : la seconde issue. `[début, fin]` en position le long du mur. */
  eastGap: readonly [number, number];
  timber?: number;
  windows?: readonly (readonly [number, number, number, number])[];
}

/**
 * Les maisons, une par une.
 *
 * Un pignon debout fait 120 à 150 px, soit deux arbres, et les murs bas tombent à hauteur de
 * hanche du héros. Rien ici n'est tiré au hasard : les profils sont écrits comme on dessinerait
 * la silhouette.
 */
const HOUSES: Record<HouseKind, HouseShape> = {
  cottage: {
    w: 176, d: 136, door: 56,
    north: [[0, 70], [44, 96], [88, 134], [120, 104], [150, 62], [176, 44]],
    south: [[0, 56], [40, 40], [60, 12], [116, 12], [130, 34], [176, 26]],
    west: [[0, 74], [60, 62], [100, 34], [136, 40]],
    east: [[0, 42], [40, 28], [90, 0], [136, 0]],
    eastGap: [50, 118],
    timber: 62,
    windows: [[44, 46, 22, 26], [134, 36, 20, 22]],
  },
  long: {
    w: 280, d: 124, door: 60,
    north: [[0, 90], [60, 96], [150, 88], [190, 60], [240, 44], [280, 62]],
    south: [[0, 30], [60, 44], [110, 12], [170, 12], [220, 38], [280, 24]],
    west: [[0, 92], [50, 70], [124, 26]],
    east: [[0, 60], [30, 16], [80, 0], [124, 30]],
    eastGap: [36, 92],
    windows: [[56, 44, 24, 26], [128, 44, 24, 26], [230, 22, 20, 16]],
  },
  tall: {
    w: 148, d: 148, door: 56,
    north: [[0, 152], [60, 166], [100, 138], [148, 96]],
    south: [[0, 74], [34, 52], [46, 10], [104, 10], [116, 60], [148, 40]],
    west: [[0, 150], [70, 112], [148, 72]],
    east: [[0, 96], [46, 58], [60, 0], [120, 0], [148, 32]],
    eastGap: [58, 122],
    windows: [[44, 96, 22, 30], [104, 90, 20, 28], [74, 40, 22, 28]],
  },
  smithy: {
    w: 196, d: 140, door: 64,
    north: [[0, 56], [80, 70], [120, 50], [196, 34]],
    south: [[0, 36], [50, 26], [66, 10], [130, 10], [150, 22], [196, 14]],
    west: [[0, 56], [80, 40], [140, 30]],
    east: [[0, 34], [50, 20], [62, 0], [126, 0], [140, 12]],
    eastGap: [56, 128],
    windows: [[50, 26, 24, 22]],
  },
  barn: {
    w: 260, d: 170, door: 72,
    north: [[0, 76], [90, 112], [130, 140], [170, 112], [260, 70]],
    south: [[0, 66], [40, 80], [92, 14], [168, 14], [216, 52], [260, 30]],
    west: [[0, 74], [80, 58], [170, 62]],
    east: [[0, 70], [50, 40], [68, 0], [140, 0], [170, 28]],
    eastGap: [64, 144],
    timber: 34,
  },
  inn: {
    w: 240, d: 150, door: 60,
    north: [[0, 104], [60, 130], [120, 158], [170, 120], [200, 90], [240, 66]],
    south: [[0, 86], [50, 74], [90, 12], [150, 12], [190, 54], [240, 40]],
    west: [[0, 104], [70, 84], [150, 80]],
    east: [[0, 66], [50, 38], [66, 0], [132, 0], [150, 24]],
    eastGap: [60, 136],
    timber: 56,
    windows: [[50, 64, 24, 30], [180, 44, 22, 24], [120, 70, 24, 30]],
  },
};

/** Rectangles d'un mur nord-sud, percé de son ouverture. */
function solidNS(p: Plan, x: number, y: number, d: number, gap?: readonly [number, number]): void {
  if (!gap) {
    p.solid(x, y, WALL, d);
    return;
  }
  if (gap[0] > 0) p.solid(x, y, WALL, gap[0]);
  if (gap[1] < d) p.solid(x, y + gap[1], WALL, d - gap[1]);
}

/** Pose une maison, `x, y` étant son coin nord-ouest. */
export function addHouse(p: Plan, x: number, y: number, kind: HouseKind, seed: number): void {
  const h = HOUSES[kind];
  const foot = y + h.d;

  p.decal(x, y, h.w, h.d, (b) => paintHouseFloor(b, x, y, h.w, h.d));

  // Le mur nord passe derrière tout le reste de la maison.
  const north: RuinWall = {
    x0: x, x1: x + h.w, y, depth: WALL, profile: h.north.map(([a, v]) => [a + x, v]), seed,
    windows: h.windows?.map(([cx, sill, ww, wh]) => [x + cx, sill, ww, wh]),
    timberAbove: h.timber,
  };
  let maxN = 0;
  for (const [, v] of h.north) maxN = Math.max(maxN, v);
  const top = y - maxN - 40;
  const section = 96;
  for (let sx = x; sx < x + h.w; sx += section) {
    const w = Math.min(section, x + h.w - sx);
    p.piece(sx, top, w, y + WALL + 8 - top, y + WALL / 2, (b) => paintRuinWall(b, north));
  }
  p.solid(x, y, h.w, WALL);

  // Côtés. L'est porte la seconde issue, l'ouest reste plein : on sait toujours par où sortir.
  const sideTop = (profile: Profile): number => {
    let m = 0;
    for (const [, v] of profile) m = Math.max(m, v);
    return y - m - 8;
  };
  p.piece(x, sideTop(h.west), WALL, foot - sideTop(h.west) + 2, foot - 4, (b) => paintRuinWallNS(b, x, y, foot, WALL, h.west, seed + 1), { fades: false });
  p.piece(x + h.w - WALL, sideTop(h.east), WALL, foot - sideTop(h.east) + 2, foot - 4, (b) => paintRuinWallNS(b, x + h.w - WALL, y, foot, WALL, h.east, seed + 2), { fades: false });
  solidNS(p, x, y + WALL, h.d - WALL * 2);
  solidNS(p, x + h.w - WALL, y + WALL, h.d - WALL * 2, [h.eastGap[0] - WALL, h.eastGap[1] - WALL]);

  // Mur sud, celui de la rue : percé de sa porte, assez bas pour voir dedans.
  const cx = x + h.w / 2;
  const south: RuinWall = {
    x0: x, x1: x + h.w, y: foot - WALL, depth: WALL, profile: h.south.map(([a, v]) => [a + x, v]), seed: seed + 3,
  };
  let maxS = 0;
  for (const [, v] of h.south) maxS = Math.max(maxS, v);
  const sTop = foot - WALL - maxS - 30;
  for (let sx = x; sx < x + h.w; sx += section) {
    const w = Math.min(section, x + h.w - sx);
    p.piece(sx, sTop, w, foot + 8 - sTop, foot - WALL / 2, (b) => paintRuinWall(b, south));
  }
  p.solid(x, foot - WALL, h.w / 2 - h.door / 2, WALL);
  p.solid(cx + h.door / 2, foot - WALL, h.w / 2 - h.door / 2, WALL);

  // Ce qui est tombé dedans.
  const inside = (y + foot) / 2 + 26;
  p.prop(x + h.w * 0.26, inside, 46, 50, (b) => paintDebris(b, x + h.w * 0.26 - 38, inside, 76, seed + 4), { block: [56, 12] });

  if (kind === 'cottage' || kind === 'long' || kind === 'inn') {
    const rx0 = x + 12, rx1 = x + h.w * 0.6;
    const ridge = y - maxN * 0.72;
    p.piece(rx0 - 10, ridge - 8, rx1 - rx0 + 20, 96, y + WALL, (b) => paintRoofChunk(b, rx0, rx1, ridge, ridge + 84, seed), { fades: true });
  }
  if (kind === 'smithy') {
    const fx = x + h.w - 74;
    p.prop(fx + 28, y + 80, 44, 190, (b) => paintChimney(b, fx, y + 80, 56, 168), { block: [56, 24] });
  }
  if (kind === 'barn') {
    for (const dx of [70, 130, 190]) {
      p.prop(x + dx, y + 92, 6, 112, (b) => {
        b.rect(x + dx - 3, y + 92 - 104, 7, 104, '#2e2017');
        b.rect(x + dx - 3, y + 92 - 104, 2, 104, '#664930');
      }, { block: [8, 8] });
    }
  }

  p.clear(x - 34, y - 60, h.w + 68, h.d + 80);
}

/** Un mur de jardin, bas : il organise la rue sans la fermer. */
function lowWall(p: Plan, x0: number, x1: number, y: number, seed: number): void {
  const wall: RuinWall = {
    x0, x1, y, depth: 14, seed,
    profile: [[x0, 30], [x0 + (x1 - x0) * 0.3, 22], [x0 + (x1 - x0) * 0.5, 6], [x0 + (x1 - x0) * 0.7, 20], [x1, 28]],
  };
  p.piece(x0, y - 40, x1 - x0, 62, y + 7, (b) => paintRuinWall(b, wall));
  const span = x1 - x0;
  p.solid(x0, y, span * 0.42, 14);
  p.solid(x0 + span * 0.58, y, span * 0.42, 14);
  p.clear(x0 - 10, y - 30, span + 20, 60);
}

/** Église ruinée : nef sans toit, pignon à rose vide, clocher éventré. */
function addChurch(p: Plan, cx: number, foot: number, seed: number): void {
  const names = villagePointNames();
  const W = 124, D = 340, T = 22;
  const x0 = cx - W, x1 = cx + W;
  const north = foot - D;

  p.decal(x0, north, W * 2, D, (b) => paintHouseFloor(b, x0, north, W * 2, D));

  // Chevet, au nord : le mur le mieux conservé, debout jusqu'à son pignon.
  const apse: RuinWall = {
    x0, x1, y: north, depth: T, seed,
    profile: [[x0, 106], [cx - 84, 134], [cx - 30, 178], [cx, 198], [cx + 34, 170], [cx + 70, 112], [x1, 84]],
    windows: [[cx, 70, 44, 96], [cx - 80, 54, 22, 62], [cx + 80, 54, 22, 62]], gothic: true,
  };
  const aTop = north - 240;
  for (let sx = x0; sx < x1; sx += 96) {
    p.piece(sx, aTop, Math.min(96, x1 - sx), north + T + 8 - aTop, north + T / 2, (b) => paintRuinWall(b, apse));
  }
  p.solid(x0, north, W * 2, T);

  // Murs de la nef : hauts vers le chevet, à terre vers la façade, percés de deux ouvertures.
  const west: Profile = [[0, 120], [90, 104], [170, 118], [220, 60], [340, 74]];
  const east: Profile = [[0, 96], [70, 110], [140, 40], [190, 0], [250, 0], [270, 54], [340, 66]];
  p.piece(x0, north - 130, T, D + 132, foot - 4, (b) => paintRuinWallNS(b, x0, north, foot, T, west, seed + 1), { fades: false });
  p.piece(x1 - T, north - 120, T, D + 122, foot - 4, (b) => paintRuinWallNS(b, x1 - T, north, foot, T, east, seed + 2), { fades: false });
  p.solid(x0, north + T, T, D - T);
  p.solid(x1 - T, north + T, T, 170 - T);
  p.solid(x1 - T, north + 260, T, D - 260);

  // Façade : rose béante, portail à ogive.
  const front: RuinWall = {
    x0, x1, y: foot - T, depth: T, seed: seed + 3,
    profile: [[x0, 124], [cx - 90, 152], [cx - 40, 196], [cx - 6, 214], [cx + 30, 176], [cx + 60, 118], [x1, 64]],
    doors: [], windows: [[cx, 112, 72, 76]], gothic: true,
  };
  const fTop = foot - 290;
  for (let sx = x0; sx < x1; sx += 96) {
    p.piece(sx, fTop, Math.min(96, x1 - sx), foot + 8 - fTop, foot - T / 2, (b) => {
      paintRuinWall(b, front);
      b.arch(cx, foot, 96, 104, '#84776d');
      b.arch(cx + 1, foot, 88, 98, '#3a3232');
      b.cutArch(cx, foot, 72, 92);
    });
  }
  p.solid(x0, foot - T, W - 36, T);
  p.solid(cx + 36, foot - T, W - 36, T);

  // Clocher, posé contre la façade.
  const towerX = x1 - 6, towerW = 92, towerD = 92;
  p.piece(towerX, foot - towerD - 260, towerW + 10, towerD + 268, foot - 6, (b) => paintRuinTower(b, towerX, foot - towerD, towerW, towerD, [[0, 236], [30, 212], [50, 190], [70, 150], [92, 124]], seed + 5));
  p.solid(towerX, foot - towerD, towerW, towerD);

  // La nef, à ciel ouvert.
  for (let y = north + 150; y < foot - 60; y += 60) {
    for (const x of [x0 + 40, cx + 14]) {
      if (stoneHash2(x, y, seed) < 0.3) continue;
      p.prop(x + 34, y, 38, 26, (b) => {
        b.rect(x, y - 16, 68, 8, '#2e2017');
        b.rect(x, y - 16, 68, 2, '#664930');
        b.rect(x, y - 8, 68, 8, '#463022');
      }, { block: [68, 10] });
    }
  }
  p.prop(cx, north + 120, 60, 70, (b) => paintDebris(b, cx - 54, north + 120, 108, seed + 6), { block: [60, 14] });

  p.clear(x0 - 40, north - 80, W * 2 + towerW + 100, D + 120);
  p.point('church', names.church!, cx, foot + 24);
}

const stoneHash2 = (x: number, y: number, s: number): number => {
  const v = Math.sin(x * 12.9898 + y * 78.233 + s) * 43758.5453;
  return v - Math.floor(v);
};

/** Le cimetière du bourg : stèles et croix de bois, à côté de l'église. */
function addGraveyard(p: Plan, x: number, y: number, rows: number, cols: number, rng: Rng): void {
  const names = villagePointNames();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const gx = x + c * 66 + rng.range(-8, 8), gy = y + r * 70 + rng.range(-6, 6);
      if (rng.chance(0.14)) continue;
      const lean = rng.range(-7, 7);
      if (rng.chance(0.5)) p.prop(gx, gy, 16, 42, (b) => paintWoodCross(b, gx, gy, lean), { block: [8, 6] });
      else p.prop(gx, gy, 14, 38, (b) => paintHeadstone(b, gx, gy), { block: [18, 8] });
    }
  }
  p.prop(x - 24, y + 40, 46, 100, (b) => paintDeadTree(b, x - 24, y + 40, 86, rng.int(0, 9)), { block: [12, 8] });
  p.clear(x - 40, y - 50, cols * 70 + 40, rows * 74 + 40);
  p.point('graveyard', names.graveyard!, x + (cols * 66) / 2, y + (rows * 70) / 2);
}

interface Lot { x: number; y: number; kind: HouseKind }

interface Layout {
  /** Rues : `[x0, y0, x1, y1]`, axe par axe. */
  streets: readonly (readonly [number, number, number, number])[];
  square: readonly [number, number, number, number];
  church: readonly [number, number];
  graveyard: readonly [number, number, number, number];
  lots: readonly Lot[];
  walls: readonly (readonly [number, number, number])[];
}

/**
 * Trois plans de bourg.
 *
 * Coordonnées relatives à la place. Les maisons au nord de la rue la regardent par leur mur sud,
 * le plus bas : on voit dedans depuis la rue, et c'est ce qui fait lire un village plutôt qu'une
 * suite de murs. Celles du sud tournent vers elle leur grand pignon arrière.
 */
const LAYOUTS: readonly Layout[] = [
  // La grand-rue, d'est en ouest, l'église au nord de la place.
  {
    streets: [[-700, 0, 700, 0], [0, 0, 0, 500]],
    square: [0, 10, 230, 120],
    church: [-40, -150],
    graveyard: [170, -390, 3, 5],
    lots: [
      { x: -660, y: -220, kind: 'long' }, { x: -360, y: -200, kind: 'cottage' },
      { x: 260, y: -210, kind: 'inn' }, { x: 520, y: -200, kind: 'cottage' },
      { x: -664, y: 70, kind: 'tall' }, { x: -496, y: 70, kind: 'barn' }, { x: -220, y: 150, kind: 'cottage' },
      { x: 90, y: 150, kind: 'smithy' }, { x: 310, y: 90, kind: 'long' }, { x: 610, y: 80, kind: 'tall' },
    ],
    walls: [[-210, -30, 0]],
  },
  // Le carrefour : deux rues se croisent sur la place, l'église à l'angle nord-est.
  {
    streets: [[-700, 30, 700, 30], [-20, -560, -20, 560]],
    square: [-20, 30, 200, 130],
    church: [260, -130],
    graveyard: [420, 110, 3, 4],
    lots: [
      { x: -640, y: -190, kind: 'inn' }, { x: -360, y: -190, kind: 'long' },
      { x: -250, y: -420, kind: 'cottage' }, { x: -470, y: -430, kind: 'tall' },
      { x: -660, y: 120, kind: 'barn' }, { x: -360, y: 150, kind: 'cottage' },
      { x: -220, y: 300, kind: 'smithy' }, { x: 80, y: 160, kind: 'long' }, { x: 60, y: 340, kind: 'cottage' },
    ],
    walls: [[120, 110, 330]],
  },
  // Le bourg clos : les maisons font cercle autour d'une grande place.
  {
    streets: [[0, 180, 0, 640], [-720, -30, -250, -30], [250, -30, 720, -30]],
    square: [0, -30, 300, 190],
    church: [10, -270],
    graveyard: [240, -520, 2, 5],
    lots: [
      { x: -590, y: -300, kind: 'tall' }, { x: -420, y: -320, kind: 'cottage' },
      { x: 350, y: -280, kind: 'long' },
      { x: -600, y: 60, kind: 'smithy' }, { x: -390, y: 150, kind: 'inn' },
      { x: 110, y: 200, kind: 'cottage' }, { x: 310, y: 130, kind: 'barn' },
      { x: -232, y: 312, kind: 'cottage' },
    ],
    walls: [[-340, -110, -250]],
  },
];

export function buildVillage(site: Site, rng: Rng): void {
  const p = new Plan(site);
  const names = villagePointNames();
  const layout = LAYOUTS[rng.int(0, LAYOUTS.length - 1)]!;
  const flip = rng.chance(0.5) ? -1 : 1;
  const fx = (x: number, w = 0): number => (flip > 0 ? x : -x - w);

  // Le lieu est décrit autour de sa place : le monde en reçoit le coin haut-gauche.
  site.radius = 640;
  site.cx = site.x;
  site.cy = site.y;
  site.bounds = { x: site.x - 800, y: site.y - 640, w: 1600, h: 1340 };

  for (const [x0, y0, x1, y1] of layout.streets) {
    const a = Math.min(fx(x0), fx(x1)), c = Math.max(fx(x0), fx(x1));
    const horizontal = y0 === y1;
    const bx = horizontal ? a : a - 70, by = horizontal ? y0 - 70 : Math.min(y0, y1);
    const bw = horizontal ? c - a : 140, bh = horizontal ? 140 : Math.abs(y1 - y0);
    const seed = rng.int(0, 999);
    p.decal(bx, by, bw, bh, (b) => (horizontal ? paintStreet(b, a, y0, c, y1, 42, seed) : paintStreet(b, a, Math.min(y0, y1), c, Math.max(y0, y1), 42, seed)));
    p.clear(bx, by, bw, bh);
  }
  const [sx, sy, srx, sry] = layout.square;
  const scx = fx(sx);
  const squareSeed = rng.int(0, 999);
  p.decal(scx - srx - 12, sy - sry - 12, srx * 2 + 24, sry * 2 + 24, (b) => paintSquare(b, scx, sy, srx, sry, squareSeed));
  p.clear(scx - srx, sy - sry, srx * 2, sry * 2);

  // Le puits, au milieu de la place : le repère du village.
  p.prop(scx, sy + 22, 46, 110, (b) => paintWell(b, scx, sy + 22), { block: [62, 18] });
  p.point('square', names.square!, scx, sy + 60);
  site.entrance = { x: site.x + scx, y: site.y + sy + 70 };
  p.point('well', names.well!, scx, sy + 44);

  const [cx, cFoot] = layout.church;
  addChurch(p, fx(cx), cFoot, rng.int(0, 999));

  const [gx, gy, rows, cols] = layout.graveyard;
  addGraveyard(p, fx(gx, cols * 66), gy, rows, cols, rng);

  for (const lot of layout.lots) {
    const w = HOUSES[lot.kind].w;
    const x = fx(lot.x, w);
    addHouse(p, x, lot.y, lot.kind, rng.int(0, 999));
    const hx = x + w / 2, hy = lot.y + HOUSES[lot.kind].d + 22;
    if (lot.kind === 'smithy') p.point('smithy', names.smithy!, hx, hy);
    if (lot.kind === 'inn') p.point('inn', names.inn!, hx, hy);
    if (lot.kind === 'barn') p.point('barn', names.barn!, hx, hy);
  }

  for (const [x0, y, x1] of layout.walls) {
    const a = Math.min(fx(x0), fx(x1)), c = Math.max(fx(x0), fx(x1));
    lowWall(p, a, c, y, rng.int(0, 999));
  }

  // Ce qui reste de la vie du village, au bord de la place.
  const dx = srx * 0.62;
  p.prop(scx - dx, sy - 40, 66, 56, (b) => paintCart(b, scx - dx, sy - 40), { block: [80, 14] });
  p.prop(scx + dx, sy + 26, 46, 76, (b) => paintStall(b, scx + dx, sy + 26), { block: [62, 14] });
  p.prop(scx + dx * 0.5, sy - sry * 0.7, 28, 54, (b) => paintBarrels(b, scx + dx * 0.5, sy - sry * 0.7), { block: [40, 12] });
  p.prop(scx - dx * 0.6, sy + sry * 0.74, 28, 54, (b) => paintBarrels(b, scx - dx * 0.6, sy + sry * 0.74), { block: [40, 12] });

  // La nature reprend : quelques arbres morts, des ronces, des palissades écroulées.
  for (let k = 0; k < 7; k++) {
    const a = rng.range(0, Math.PI * 2), q = rng.range(320, 620);
    const tx = Math.cos(a) * q, ty = Math.sin(a) * q * 0.7 + 20;
    if (isTaken(p, tx, ty)) continue;
    const h = rng.range(60, 92), seed = rng.int(0, 99);
    p.prop(tx, ty, 44, h + 14, (b) => paintDeadTree(b, tx, ty, h, seed), { block: [12, 8] });
  }
  for (let k = 0; k < 8; k++) {
    const a = rng.range(0, Math.PI * 2), q = rng.range(240, 660);
    const tx = Math.cos(a) * q, ty = Math.sin(a) * q * 0.7;
    if (isTaken(p, tx, ty)) continue;
    const r = rng.range(14, 26), seed = rng.int(0, 99);
    p.prop(tx, ty, r * 2 + 4, 30, (b) => paintBrambles(b, tx, ty, r, seed));
  }
  for (let k = 0; k < 3; k++) {
    const x0 = rng.range(-640, 400), y = rng.range(-430, 430), len = rng.range(100, 180), seed = rng.int(0, 99);
    if (isTaken(p, x0, y) || isTaken(p, x0 + len, y)) continue;
    p.prop(x0 + len / 2, y, len / 2 + 6, 36, (b) => paintFence(b, x0, x0 + len, y, seed), { block: [len * 0.4, 8] });
  }

  p.garrison(scx, sy + 80, 'zombie', 5, 100);
  p.garrison(fx(cx), cFoot - 150, 'skeleton', 8, 60);
  p.garrison(fx(gx, cols * 66) + 120, gy + 60, 'ghoul', 8, 70);
  p.garrison(scx - 420, 40, 'ghoul', 6, 70);
  p.garrison(scx + 420, 40, 'skeleton', 5, 70);
}

/** Vrai si un point tombe sur ce qui est déjà construit ou dégagé. */
function isTaken(p: Plan, x: number, y: number): boolean {
  const wx = p.site.x + x, wy = p.site.y + y;
  for (const r of p.site.clear) {
    if (wx > r.x && wx < r.x + r.w && wy > r.y && wy < r.y + r.h) return true;
  }
  return false;
}

/** Un vestige isolé dans la lande : une maison, une tour, un pan de mur. */
export function buildVestige(site: Site, rng: Rng): void {
  const p = new Plan(site);
  const pick = rng.int(0, 5);
  site.bounds = { x: site.x - 60, y: site.y - 60, w: 460, h: 340 };
  site.cx = site.x + 160;
  site.cy = site.y + 100;
  site.entrance = { x: site.cx, y: site.y + 260 };
  if (pick === 0) addHouse(p, 0, 0, 'cottage', rng.int(0, 999));
  else if (pick === 1) addHouse(p, 0, 0, 'long', rng.int(0, 999));
  else if (pick === 2) addHouse(p, 0, 0, 'smithy', rng.int(0, 999));
  else if (pick === 3) addHouse(p, 0, 0, 'tall', rng.int(0, 999));
  else if (pick === 4) {
    const seed = rng.int(0, 999);
    p.piece(90, -240, 130, 320, 76, (b) => paintRuinTower(b, 100, 0, 110, 80, [[0, 216], [36, 188], [70, 140], [110, 96]], seed));
    p.solid(100, 0, 110, 80);
    p.prop(60, 96, 60, 50, (b) => paintRubble(b, 10, 96, 100, 30, seed), { block: [60, 12] });
    p.clear(40, -40, 240, 170);
  } else {
    lowWall(p, 0, 300, 60, rng.int(0, 999));
    const seed = rng.int(0, 999);
    p.prop(220, 150, 60, 190, (b) => paintChimney(b, 192, 150, 56, 168), { block: [56, 24] });
    p.prop(100, 150, 46, 50, (b) => paintDebris(b, 62, 150, 76, seed), { block: [56, 12] });
    p.clear(-20, 20, 340, 160);
  }
}
