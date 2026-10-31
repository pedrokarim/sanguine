import { Rng } from '../core/rng';
import { cemeteryPointNames, prioryPointNames } from '../data/sites';
import { paintAltar, paintDeadTree, paintRoundTower, paintTomb, paintWell, type Tower } from '../gfx/castle';
import { paintHeadstone, paintRuinWall, paintWoodCross, type RuinWall } from '../gfx/hamlet';
import { paintCalvary, paintCemeteryGate, paintGrassPlot, paintGraveMound, paintLowWall, paintLowWallNS, paintMausoleum, paintOpenGrave, paintPath } from '../gfx/shrines';
import { raiseChapel } from './shrines';
import { Plan, type Rect, type Riser, type Site } from './siteplan';

/**
 * Les deux lieux consacrés : le cimetière et le prieuré.
 *
 * Ils tiennent chacun sur plus d'un écran, ceints d'un mur bas et percés d'une seule grille : on sait
 * quand on y entre. Le cimetière a sa surprise : à la première entrée, les morts sortent des tombes
 * sous les yeux du joueur (`updateGarrisons`), une seule fois.
 */

export const CEMETERY_WIDTH = 1320;
export const CEMETERY_DEPTH = 1020;
export const PRIORY_WIDTH = 1180;
export const PRIORY_DEPTH = 1020;

const WALL = 20;
const WALL_HEIGHT = 58;
const GATE = 112;

/** Enceinte basse, à une seule grille au sud. Rend le centre de la grille. */
function enclosure(p: Plan, w: number, h: number, seed: number): number {
  const gx = w / 2, south = h - WALL;
  const x0 = gx - GATE / 2, x1 = gx + GATE / 2;
  const STEP = 96;
  for (let x = 0; x < w; x += STEP) {
    const end = Math.min(w, x + STEP);
    p.piece(x, -WALL_HEIGHT - 10, end - x, WALL_HEIGHT + WALL + 14, WALL / 2, (b) => paintLowWall(b, 0, w, 0, WALL, WALL_HEIGHT, seed));
  }
  p.solid(0, 0, w, WALL);
  for (const [a, b2] of [[0, x0], [x1, w]] as const) {
    for (let x = a; x < b2; x += STEP) {
      const end = Math.min(b2, x + STEP);
      p.piece(x, south - WALL_HEIGHT - 10, end - x, WALL_HEIGHT + WALL + 14, south + WALL / 2, (b) => paintLowWall(b, a, b2, south, WALL, WALL_HEIGHT, seed + 1));
    }
    p.solid(a, south, b2 - a, WALL);
  }
  for (const x of [0, w - WALL]) {
    for (let y = 0; y < h; y += STEP) {
      const end = Math.min(h, y + STEP);
      p.piece(x - 2, y - WALL_HEIGHT, WALL + 4, end - y + WALL_HEIGHT + 2, end, (b) => paintLowWallNS(b, x, 0, h, WALL, WALL_HEIGHT), { fades: false });
    }
    p.solid(x, 0, WALL, h);
  }
  p.piece(gx - 110, south - 150, 220, 180, south + WALL, (b) => paintCemeteryGate(b, gx, south + WALL, GATE));
  p.solid(x0 - 26, south, 26, WALL);
  p.solid(x1, south, 26, WALL);
  return gx;
}

interface Grave {
  x: number;
  y: number;
}

/** Une rangée de tombes par place : stèle, croix ou gisant. Rend les places, pour les morts. */
function plantGraves(p: Plan, rng: Rng, spots: readonly Grave[]): void {
  for (const { x, y } of spots) {
    const seed = rng.int(0, 999);
    p.decal(x - 26, y - 6, 52, 34, (b) => paintGraveMound(b, x, y + 10, seed));
    const roll = rng.next();
    if (roll < 0.55) p.prop(x, y, 18, 40, (b) => paintHeadstone(b, x, y), { block: [20, 8] });
    else if (roll < 0.85) p.prop(x, y, 18, 50, (b) => paintWoodCross(b, x, y, (seed % 7) - 3));
    else p.prop(x, y + 8, 44, 46, (b) => paintTomb(b, x, y + 8), { block: [56, 18] });
  }
}

export function buildCemetery(site: Site, rng: Rng): void {
  const p = new Plan(site);
  const names = cemeteryPointNames();
  const W = CEMETERY_WIDTH, H = CEMETERY_DEPTH;
  site.bounds = { x: site.x, y: site.y, w: W, h: H };
  site.cx = site.x + W / 2;
  site.cy = site.y + H / 2;
  site.entrance = { x: site.x + W / 2, y: site.y + H + 70 };

  const seed = rng.int(0, 999);
  const gx = enclosure(p, W, H, seed);
  p.floor(WALL, WALL, W - WALL * 2, H - WALL * 2, 'dirt');
  const cross = 470;
  p.decal(gx - 44, cross, 88, H - cross, (b) => paintPath(b, gx - 44, cross, 88, H - cross));
  p.decal(WALL, cross - 34, W - WALL * 2, 68, (b) => paintPath(b, WALL, cross - 34, W - WALL * 2, 68));
  for (const [x, y, w, h] of [[60, 80, 520, 330], [W - 580, 80, 520, 330], [60, 540, 520, 400], [W - 580, 540, 520, 400]] as const) {
    p.decal(x, y, w, h, (b) => paintGrassPlot(b, x, y, w, h, seed));
  }

  // Le calvaire, au carrefour : il se voit dès la grille.
  p.prop(gx, cross + 30, 70, 230, (b) => paintCalvary(b, gx, cross + 30), { block: [96, 30], fades: true });

  const spots: Grave[] = [];
  for (let y = 120; y < H - 60; y += 94) {
    if (Math.abs(y - cross) < 64) continue;
    for (let x = 96; x < W - 80; x += 86) {
      if (Math.abs(x - gx) < 90) continue;
      // Quelques places vides : un carré parfait se lirait comme une grille, pas comme un cimetière.
      if (rng.next() < 0.14) continue;
      const gxy = { x: x + rng.range(-6, 6), y: y + rng.range(-5, 5) };
      if ((gxy.x < 330 || gxy.x > W - 330) && gxy.y < 300) continue;
      spots.push(gxy);
    }
  }
  plantGraves(p, rng, spots);

  // Les chapelles funéraires ferment le fond du cimetière.
  for (const [cx, foot, w, d] of [[186, 250, 92, 96], [W - 186, 250, 92, 96], [gx, 300, 128, 130]] as const) {
    p.piece(cx - w - 14, foot - d - 260, (w + 14) * 2, d + 268, foot - 8, (b) => paintMausoleum(b, cx, foot, w, d));
    p.solid(cx - w, foot - d, w * 2, d);
    p.clear(cx - w - 10, foot - d - 10, w * 2 + 20, d + 20);
  }

  // Une fosse ouverte, et les arbres morts qui penchent dessus.
  p.prop(W - 300, 700, 50, 40, (b) => paintOpenGrave(b, W - 300, 700), { block: [80, 22] });
  for (const [x, y, h] of [[84, 500, 110], [W - 96, 470, 124], [420, 110, 96], [W - 430, 96, 118], [150, 930, 104], [W - 150, 920, 112]] as const) {
    p.prop(x, y, 60, h + 10, (b) => paintDeadTree(b, x, y, h, seed + x));
  }

  p.light(gx, cross, 240, 130, '#3cff9a', 0.05);
  p.point('gate', names.gate!, gx, H + 30);
  p.point('calvary', names.calvary!, gx, cross + 74);
  p.point('crypt', names.crypt!, gx, 340);
  p.point('grave', names.grave!, W - 300, 734);

  // Les morts se lèvent de leur tombe, de plus en plus loin de la grille : la marée vient du fond.
  const risers: Riser[] = spots
    .filter((s) => rng.next() < 0.62 && Math.abs(s.x - gx) > 110)
    .map((s) => {
      const fromGate = Math.hypot(s.x - gx, s.y - H);
      const roll = rng.next();
      return {
        x: site.x + s.x, y: site.y + s.y + 12,
        enemy: roll < 0.6 ? 'skeleton' : roll < 0.85 ? 'ghoul' : 'zombie',
        delay: 0.2 + (fromGate / 1000) * 3.6 + rng.range(0, 0.5),
      };
    });
  site.risers = risers;
  p.clear(-30, -80, W + 60, H + 110);
}

export function buildPriory(site: Site, rng: Rng): void {
  const p = new Plan(site);
  const names = prioryPointNames();
  const W = PRIORY_WIDTH, H = PRIORY_DEPTH;
  site.bounds = { x: site.x, y: site.y, w: W, h: H };
  site.cx = site.x + W / 2;
  site.cy = site.y + H / 2;
  site.entrance = { x: site.x + W / 2, y: site.y + H + 70 };

  const seed = rng.int(0, 999);
  const gx = enclosure(p, W, H, seed);
  p.floor(WALL, WALL, W - WALL * 2, H - WALL * 2, 'dirt');
  const foot = 690;
  p.decal(gx - 50, foot, 100, H - foot, (b) => paintPath(b, gx - 50, foot, 100, H - foot));

  const nave = raiseChapel(p, { cx: gx, foot, halfWidth: 150, depth: 440, height: 128, rise: 146, rose: 34, door: 80, spire: 220 });
  const north = foot - 440;

  // Le clocher, tour ronde adossée à la nef.
  const tower: Tower = { cx: gx + 240, foot: foot - 110, radius: 58, height: 210, roof: 130 };
  p.tower(tower);
  void paintRoundTower;

  // Le cloître : ce qu'il reste de ses arcades, à l'ouest.
  const walls: Rect[] = [{ x: 90, y: 300, w: 280, h: 0 }, { x: 90, y: 560, w: 280, h: 0 }];
  walls.forEach((r, i) => {
    const wall: RuinWall = {
      x0: r.x, x1: r.x + r.w, y: r.y, depth: 18, seed: seed + i,
      profile: [[r.x, 96], [r.x + 70, 104], [r.x + 130, 62], [r.x + 190, 88], [r.x + r.w, 40]],
      windows: [[r.x + 60, 26, 36, 54], [r.x + 130, 22, 36, 44], [r.x + 210, 22, 36, 40]], gothic: true,
    };
    p.piece(r.x, r.y - 124, r.w, 150, r.y + 9, (b) => paintRuinWall(b, wall));
    p.solid(r.x, r.y, r.w, 18);
  });
  p.decal(120, 340, 220, 190, (b) => paintGrassPlot(b, 120, 340, 220, 190, seed));
  p.prop(230, 470, 50, 100, (b) => paintWell(b, 230, 470), { block: [64, 22] });

  // Le carré des moines, à l'est de la grille.
  const graves: Grave[] = [];
  for (let y = 760; y < H - 70; y += 78) {
    for (let x = W - 380; x < W - 90; x += 74) if (rng.next() > 0.2) graves.push({ x, y });
  }
  p.decal(W - 410, 730, 340, 230, (b) => paintGrassPlot(b, W - 410, 730, 340, 230, seed + 4));
  plantGraves(p, rng, graves);
  for (const [x, y, h] of [[110, 820, 110], [W - 110, 240, 122], [90, 150, 96]] as const) {
    p.prop(x, y, 60, h + 10, (b) => paintDeadTree(b, x, y, h, seed + x));
  }

  const altarFoot = north + 96;
  p.prop(gx, altarFoot, 66, 110, (b) => paintAltar(b, gx, altarFoot, 92), { block: [92, 26], inner: nave.group });

  p.point('gate', names.gate!, gx, H + 30);
  p.point('nave', names.nave!, gx, foot - 60);
  p.point('altar', names.altar!, gx, north + 150);
  p.point('cloister', names.cloister!, 230, 520);
  p.point('monks', names.monks!, W - 240, 700);

  p.garrison(gx, foot + 130, 'ghoul', 10, 80);
  p.garrison(gx, foot - 170, 'wraith', 7, 60);
  p.garrison(gx, north + 190, 'wraith', 4, 40, 'elite');
  p.garrison(230, 420, 'skeleton', 10, 70);
  p.clear(-30, -80, W + 60, H + 110);
}
