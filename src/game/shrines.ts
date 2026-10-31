import type { Brush } from '../gfx/brush';
import {
  paintAltar, paintHall, paintInnerWall, paintInnerWallNS, paintPillar, paintRubble, paintSteps, spire, type Hall,
} from '../gfx/castle';
import {
  menhir, paintAltarFloor, paintBloodAltar, paintBonePile, paintCairnFloor, paintCairnHeap, paintCandles, paintFloodwater,
  paintGreatWell, paintObelisk, paintOssuaryFront, paintPyreFloor, paintPyreLogs, paintPyreStake, paintRitualColumn,
  paintSunkenPew, paintWaterline, paintWellFloor,
} from '../gfx/shrines';
import { Plan, settlePoints, type Site, type ShrineState, type ShrineType } from './siteplan';

/**
 * Les structures isolées : autel, bûcher, obélisque, puits, ossuaire, chapelle, cairn.
 *
 * Elles sont construites comme le château : murs, collisions et zones réservées viennent du même
 * plan. Chacune dépasse les arbres et garde son rôle : atteindre `shrine.x, shrine.y` la déclenche,
 * et ce point doit rester libre, puisque `activatePoi` y dépose ses récompenses.
 */

function frame(site: Site, type: ShrineType, spot: [number, number], focus: [number, number], halfW: number, north: number, south: number): ShrineState {
  const shrine: ShrineState = {
    type, lit: true, group: -1,
    x: site.x + spot[0], y: site.y + spot[1],
    focusX: site.x + focus[0], focusY: site.y + focus[1],
  };
  site.shrine = shrine;
  site.bounds = { x: site.x - halfW, y: site.y + north, w: halfW * 2, h: south - north };
  site.cx = site.x;
  site.cy = site.y;
  site.entrance = { x: shrine.x, y: shrine.y };
  return shrine;
}

function buildAltar(p: Plan, site: Site): void {
  const s = frame(site, 'altar', [0, 62], [0, -82], 200, -210, 130);
  p.decal(-180, -116, 360, 232, (b) => paintAltarFloor(b, s.lit));
  p.prop(0, 34, 86, 150, (b) => b.at(0, 34, (f) => paintBloodAltar(f, s.lit)), { block: [150, 44], fades: true });
  for (const [x, y] of [[-132, -52], [132, -52], [-132, 62], [132, 62]] as const) {
    p.prop(x, y, 28, 200, (b) => paintRitualColumn(b, x, y, s.lit), { block: [34, 16], fades: true });
  }
  p.clear(-200, -140, 400, 270);
}

function buildPyre(p: Plan, site: Site): void {
  const s = frame(site, 'pyre', [0, 74], [0, -8], 180, -250, 120);
  p.decal(-170, -104, 340, 208, (b) => paintPyreFloor(b, s.lit));
  p.prop(0, 10, 66, 226, (b) => b.at(0, 10, (f) => paintPyreStake(f, s.lit)), { fades: true });
  p.prop(0, 20, 120, 110, (b) => b.at(0, 20, (f) => paintPyreLogs(f, s.lit)), { block: [170, 44] });
  p.clear(-180, -120, 360, 240);
}

function buildObelisk(p: Plan, site: Site): void {
  const s = frame(site, 'obelisk', [0, 68], [0, 44], 150, -440, 130);
  p.prop(0, 20, 130, 440, (b) => b.at(0, 20, (f) => paintObelisk(f, s.lit)), { block: [224, 56], fades: true });
  p.clear(-170, -90, 340, 200);
}

function buildWell(p: Plan, site: Site): void {
  const s = frame(site, 'well', [0, 58], [0, -30], 170, -270, 110);
  p.decal(-160, -106, 320, 212, (b) => paintWellFloor(b));
  p.prop(0, 16, 120, 270, (b) => b.at(0, 16, (f) => paintGreatWell(f, s.lit)), { block: [136, 44], fades: true });
  p.clear(-170, -120, 340, 230);
}

function buildOssuary(p: Plan, site: Site): void {
  const s = frame(site, 'ossuary', [0, 56], [0, -44], 200, -360, 110);
  const W = 132, D = 130, foot = 0;
  const hall: Hall = { cx: 0, foot, halfWidth: W, depth: D, height: 170, rise: 90, doorWidth: 66, doorHeight: 100, rose: 0, passable: false, lancets: [] };
  const top = foot - D - hall.height - hall.rise - 30;
  p.piece(-W - 16, top, W * 2 + 32, foot + 8 - top, foot - 12, (b) => { paintHall(b, hall); paintOssuaryFront(b, s.lit); });
  p.solid(-W, foot - D, W * 2, D);
  p.prop(-W - 26, 34, 70, 70, (b) => paintBonePile(b, -W - 26, 34, 120, 1), { block: [90, 18] });
  p.prop(W + 26, 28, 70, 70, (b) => paintBonePile(b, W + 26, 28, 110, 2), { block: [84, 18] });
  p.decal(-70, 0, 140, 44, (b) => paintSteps(b, 0, 40, 66, 3));
  p.clear(-200, -170, 400, 260);
}

function buildCairn(p: Plan, site: Site): void {
  frame(site, 'cairn', [0, 62], [0, -130], 190, -230, 120);
  p.decal(-170, -106, 340, 212, (b) => paintCairnFloor(b));
  p.prop(0, 14, 120, 190, (b) => b.at(0, 14, (f) => paintCairnHeap(f)), { block: [150, 44], fades: true });
  [[-150, -30, 44, 120], [-92, -92, 40, 104], [92, -92, 42, 112], [150, -30, 46, 128], [-140, 70, 40, 96], [140, 70, 42, 104]].forEach(([x, y, w, h], i) => {
    p.prop(x!, y!, w!, h! + 12, (b) => menhir(b, x!, y!, w!, h!, i + 3), { block: [w! * 0.7, 14], fades: true });
  });
  p.clear(-190, -130, 380, 240);
}

export interface ChapelShape {
  cx: number;
  foot: number;
  halfWidth: number;
  depth: number;
  height: number;
  rise: number;
  rose: number;
  door: number;
  spire: number;
}

/** Une nef qu'on visite : l'enveloppe s'efface quand le héros passe la porte. */
export function raiseChapel(p: Plan, c: ChapelShape, walls: ((b: Brush) => void) | null = null): { group: number; north: number } {
  const { cx, foot, halfWidth: W, depth, door } = c;
  const wall = 22, north = foot - depth, x0 = cx - W, x1 = cx + W;
  const hall: Hall = { cx, foot, halfWidth: W, depth, height: c.height, rise: c.rise, doorWidth: door, doorHeight: door + 14, rose: c.rose, passable: true, lancets: [] };
  const group = p.group([{ x: x0, y: north, w: W * 2, h: depth - 8 }]);

  p.floor(x0, north, W * 2, depth, 'chapel');
  p.decal(cx - 90, foot, 180, 52, (b) => paintSteps(b, cx, foot + 44, 90, 3));
  const top = north - c.height - c.rise - 30;
  p.piece(x0 - 16, top, W * 2 + 32, foot + 8 - top, foot - 12, (b) => { paintHall(b, hall); walls?.(b); }, { shell: group });
  const spireBase = foot - depth * 0.62 - c.height - c.rise;
  p.piece(cx - 44, spireBase - c.spire - 34, 88, c.spire + 44, foot - 11, (b) => spire(b, cx, spireBase, 58, c.spire), { shell: group });

  p.solid(x0, foot - wall, W - door / 2, wall);
  p.solid(cx + door / 2, foot - wall, W - door / 2, wall);
  p.solid(x0, north, W * 2, wall);
  p.solid(x0, north, wall, depth);
  p.solid(x1 - wall, north, wall, depth);

  const inside = { inner: group, fades: true };
  p.piece(x0, north - 96, W * 2, 128, north + 12, (b) => paintInnerWall(b, x0, x1, north, wall, 86, [cx - 60, cx, cx + 60]), inside);
  for (const [a, b2] of [[x0, cx - door / 2], [cx + door / 2, x1]] as const) {
    p.piece(a, foot - wall - 22, b2 - a, wall + 26, foot - 12, (b) => paintInnerWall(b, a, b2, foot - wall, wall, 22), inside);
  }
  const noFade = { inner: group, fades: false };
  p.piece(x0, north - 40, wall, depth + 42, foot, (b) => paintInnerWallNS(b, x0, north, foot, wall, 40), noFade);
  p.piece(x1 - wall, north - 40, wall, depth + 42, foot, (b) => paintInnerWallNS(b, x1 - wall, north, foot, wall, 40), noFade);

  for (const dy of [130, depth - 130]) {
    for (const dx of [-W + 34, W - 34]) {
      const y = north + dy;
      p.prop(cx + dx, y, 18, 90, (b) => paintPillar(b, cx + dx, y, 9, 76), { block: [18, 10], inner: group, fades: true });
    }
  }
  p.light(cx, north + 60, 90, 50, '#f4b860', 0.2);
  return { group, north };
}

function buildChapel(p: Plan, site: Site): void {
  const W = 118, depth = 280, foot = 150;
  const shape = { cx: 0, foot, halfWidth: W, depth, height: 112, rise: 118, rose: 28, door: 74, spire: 170 };
  const north = foot - depth;
  const s = frame(site, 'chapel', [0, north + 112], [0, north + 58], 230, -460, 300);

  p.decal(-230, north - 50, 460, depth + 200, (b) => paintFloodwater(b, 0, foot - 90, 224, 196));
  const { group } = raiseChapel(p, shape, (b) => paintWaterline(b, -W, W, foot));
  s.group = 0;
  p.decal(-W + 22, north + 150, W * 2 - 44, depth - 172, (b) => paintFloodwater(b, 0, north + 200, W + 40, 90), group);

  const altarFoot = north + 76;
  p.prop(0, altarFoot, 60, 110, (b) => { paintAltar(b, 0, altarFoot, 80); paintCandles(b, 0, altarFoot - 54, s.lit); }, { block: [80, 26], inner: group });
  for (const y of [north + 170, north + 216]) {
    p.prop(-58, y, 36, 34, (b) => paintSunkenPew(b, -88, y, 3), { block: [56, 10], inner: group });
    p.prop(58, y, 36, 34, (b) => paintSunkenPew(b, 28, y, -3), { block: [56, 10], inner: group });
  }
  p.prop(170, foot + 30, 50, 44, (b) => paintRubble(b, 130, foot + 30, 80, 26, 4), { block: [60, 12] });
  p.clear(-240, north - 70, 480, depth + 230);
}

const BUILDERS: Readonly<Record<ShrineType, (p: Plan, site: Site) => void>> = {
  altar: buildAltar, pyre: buildPyre, obelisk: buildObelisk, well: buildWell, ossuary: buildOssuary, chapel: buildChapel, cairn: buildCairn,
};

export function buildShrine(site: Site, type: ShrineType): void {
  BUILDERS[type](new Plan(site), site);
  settlePoints(site);
  // `settlePoints` a pu déplacer l'entrée : c'est elle, le point à atteindre.
  site.shrine!.x = site.entrance.x;
  site.shrine!.y = site.entrance.y;
}

/** Une structure épuisée s'éteint : ses morceaux seront repeints à leur prochain affichage. */
export function extinguish(site: Site): void {
  if (site.shrine) site.shrine.lit = false;
  for (const p of site.pieces) p.canvas = null;
  for (const p of site.decals) p.canvas = null;
}
