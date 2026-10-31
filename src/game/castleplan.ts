import type { Brush } from '../gfx/brush';
import { valueNoise2 } from '../core/math';
import {
  paintAltar, paintArmor, paintBookshelf, paintCandelabra, paintCarpet, paintDeadTree, paintDummy,
  paintFountain, paintGateBody, paintGibbet, paintHall, paintInnerWall, paintInnerWallNS, paintMoonlight,
  paintPew, paintPillar, paintRampart, paintRubble, paintSteps, paintTable, paintThrone, paintTomb,
  paintWallShadow, paintWeaponRack, paintWell, spire, RAMPART_DEPTH, RAMPART_HEIGHT, STONE,
  type Gate, type Hall, type RampartRun,
} from '../gfx/castle';
import { castlePointNames } from '../data/sites';
import { Plan, type Site } from './siteplan';
import { addHouse } from './villages';
import { paintBarrels, paintCart, paintStall } from '../gfx/hamlet';

/**
 * Le plan du château.
 *
 * Mesures de référence : héros 31 px, plus haut arbre 69 px, vue 841 × 439 à l'échelle ×2.
 *   – l'enceinte fait plus de trois écrans de large et plus de quatre de profondeur ;
 *   – une courtine monte à 112 px, une fois et demie le plus haut arbre ;
 *   – une tour d'angle atteint 360 px avec son toit, presque une hauteur d'écran ;
 *   – une porte laisse passer trois héros de front.
 *
 * On y entre par le sud. Une basse-cour, un mur percé d'une seconde porte, une haute cour, et au
 * fond le logis : la grande salle, son trône, la crypte derrière lui, l'armurerie et la
 * bibliothèque dans les ailes. La chapelle et la caserne se tiennent de part et d'autre.
 *
 * Deux brèches, l'une dans l'enceinte, l'autre dans le mur de la haute cour : la règle des ruines
 * vaut aussi ici. On ne doit jamais pouvoir se faire enfermer sans issue.
 */

export const CASTLE_WIDTH = 2640;
export const CASTLE_DEPTH = 1900;
/** Passage libre de la grande porte : trois héros de front. */
export const GATE_WIDTH = 88;
export const GATE_CLEAR = 104;

export function buildCastle(site: Site): void {
  const p = new Plan(site);
  const names = castlePointNames();
  const CW = CASTLE_WIDTH, CD = CASTLE_DEPTH, T = RAMPART_DEPTH, H = RAMPART_HEIGHT;
  const midX = CW / 2;

  // --- Les sols, du plus grand au plus petit ---
  p.floor(36, 36, CW - 72, 1090, 'cobble');
  p.floor(36, 1120, CW - 72, CD - 1120 + 30, 'dirt');
  p.floor(midX - 90, 1120, 180, CD - 1120 + 40, 'cobble');
  p.floor(36, 36, CW - 72, 190, 'dirt');

  const gateFloor = (cx: number, y: number, w: number, h: number): void => p.floor(cx - w / 2, y, w, h, 'tunnel');

  // --- Enceinte extérieure ---
  const gateSpan = GATE_WIDTH + 112;
  const south = { y: CD, depth: T, height: H };
  p.rampart({ ...south, x0: 40, x1: midX - gateSpan / 2, buttresses: [300, 520, 860, 1080], slits: [190, 430, 620, 780, 980], banners: [700, 1160], ivy: [400] });
  p.rampart({ ...south, x0: midX + gateSpan / 2, x1: 1860, brokenEast: true, buttresses: [1500], slits: [1560, 1620], banners: [1460] });
  p.rampart({ ...south, x0: 2010, x1: CW - 40, brokenWest: true, buttresses: [2300, 2470], slits: [2240, 2400, 2540], ivy: [2360] });

  p.rampart({ y: 0, depth: T, height: H, x0: 40, x1: CW - 40, buttresses: [340, 640, 1980, 2280], slits: [500, 800, 1100, 1540, 1840, 2140], banners: [960, 1680], ivy: [230, 2420] });
  p.rampartNS(0, 40, CD + 8, T, H, 1);
  p.rampartNS(CW - T, 40, 1250, T, H, -1);
  p.rampartNS(CW - T, 1380, CD + 8, T, H, -1);

  // Ombre portée de la courtine ouest sur le sol de la cour : c'est elle qui lui donne sa hauteur.
  p.decal(36, 40, 42, CD, (b) => paintWallShadow(b, 36, 40, CD + 40, 42));

  // --- La grande porte ---
  const gate: Gate = { cx: midX, foot: CD + T + 6, width: GATE_WIDTH, clear: GATE_CLEAR, depth: T + 12, height: H + 24, span: gateSpan };
  gateFloor(midX, CD - 16, GATE_WIDTH + 16, T + 40);
  const gateTop = gate.foot - gate.height - gate.depth - 24;
  p.piece(midX - gateSpan / 2, gateTop, gateSpan, gate.foot + 8 - gateTop, gate.foot - T / 2, (b) => paintGateBody(b, gate), { clearance: 50 });
  p.solid(midX - gateSpan / 2, CD, gateSpan / 2 - GATE_WIDTH / 2, T + 6);
  p.solid(midX + GATE_WIDTH / 2, CD, gateSpan / 2 - GATE_WIDTH / 2, T + 6);
  for (const dx of [-1, 1]) p.tower({ cx: midX + dx * (gateSpan / 2 + 18), foot: CD + T + 30, radius: 54, height: 206, roof: 150, windows: 3 });

  // --- Tours de l'enceinte ---
  for (const [cx, foot, r, h, roof] of [
    [20, CD + T + 28, 74, 190, 170], [CW - 20, CD + T + 28, 74, 190, 170],
    [20, T + 28, 74, 190, 170], [CW - 20, T + 28, 74, 190, 170],
    [640, CD + T + 22, 54, 160, 0], [2340, CD + T + 22, 54, 160, 0],
    [860, T + 22, 54, 160, 110], [1780, T + 22, 54, 160, 110],
    [20, 640, 60, 170, 120], [CW - 20, 640, 60, 170, 120],
    [20, 1460, 60, 170, 0], [CW - 20, 1100, 60, 170, 0],
  ] as const) {
    p.tower({ cx, foot, radius: r, height: h, roof });
  }

  // --- Mur de la haute cour ---
  const innerY = 1090, innerT = 30, innerH = 96;
  const innerSpan = 84 + 100;
  const inner = { y: innerY, depth: innerT, height: innerH, base: 3 };
  p.rampart({ ...inner, x0: 36, x1: 560, brokenEast: true, buttresses: [160, 340], slits: [250, 440], banners: [260] });
  p.rampart({ ...inner, x0: 720, x1: midX - innerSpan / 2, brokenWest: true, buttresses: [900, 1110], slits: [1000, 1170], banners: [1040] });
  p.rampart({ ...inner, x0: midX + innerSpan / 2, x1: CW - 36, buttresses: [1520, 1750, 1990, 2240, 2440], slits: [1600, 1840, 2100, 2340], banners: [1660, 2180], ivy: [1900] });
  const innerGate: Gate = { cx: midX, foot: innerY + innerT + 6, width: 84, clear: 92, depth: innerT + 10, height: innerH + 22, span: innerSpan };
  gateFloor(midX, innerY - 12, 96, innerT + 34);
  const innerTop = innerGate.foot - innerGate.height - innerGate.depth - 24;
  p.piece(midX - innerSpan / 2, innerTop, innerSpan, innerGate.foot + 8 - innerTop, innerGate.foot - innerT / 2, (b) => paintGateBody(b, innerGate), { clearance: 44 });
  p.solid(midX - innerSpan / 2, innerY, innerSpan / 2 - 42, innerT + 6);
  p.solid(midX + 42, innerY, innerSpan / 2 - 42, innerT + 6);
  for (const dx of [-1, 1]) p.tower({ cx: midX + dx * (innerSpan / 2 + 16), foot: innerY + innerT + 26, radius: 46, height: 168, roof: 120 });

  // Les deux brèches : les éboulis gênent sans fermer le passage.
  p.prop(640, innerY + innerT + 12, 100, 60, (b) => paintRubble(b, 580, innerY + innerT + 12, 120, 34, 11), { block: [48, 12] });
  p.prop(1935, CD + T + 12, 100, 60, (b) => paintRubble(b, 1875, CD + T + 12, 120, 34, 12), { block: [48, 12] });
  p.prop(CW - 60, 1320, 70, 60, (b) => paintRubble(b, CW - 120, 1320, 120, 34, 13), { block: [40, 12] });

  // --- Basse-cour : les communs, et ce qu'il en reste ---
  addHouse(p, 130, 1190, 'long', 21);
  addHouse(p, 560, 1200, 'barn', 22);
  addHouse(p, 880, 1560, 'cottage', 23);
  addHouse(p, 1560, 1600, 'long', 24);
  addHouse(p, 2120, 1230, 'smithy', 25);
  addHouse(p, 2380, 1460, 'cottage', 26);
  p.prop(420, 1420, 46, 110, (b) => paintWell(b, 420, 1420), { block: [62, 18] });
  for (const [x, y] of [[1650, 1290], [1720, 1330], [1790, 1290], [1860, 1330]] as const) {
    p.prop(x, y, 24, 72, (b) => paintDummy(b, x, y), { block: [12, 8] });
  }
  p.prop(2120, 1640, 54, 120, (b) => paintGibbet(b, 2100, 1640), { block: [28, 10] });
  p.prop(760, 1720, 46, 100, (b) => paintDeadTree(b, 760, 1720, 92, 3), { block: [12, 8] });
  p.prop(1040, 1300, 46, 100, (b) => paintDeadTree(b, 1040, 1300, 84, 7), { block: [12, 8] });
  p.prop(2460, 1240, 46, 100, (b) => paintDeadTree(b, 2460, 1240, 90, 9), { block: [12, 8] });
  p.prop(1960, 1800, 60, 50, (b) => paintRubble(b, 1900, 1800, 120, 30, 5), { block: [64, 12] });
  p.prop(240, 1820, 60, 50, (b) => paintRubble(b, 180, 1820, 120, 30, 6), { block: [64, 12] });

  // Ce qui traîne encore dans la cour : la vie s'est arrêtée d'un coup.
  p.prop(1090, 1470, 66, 56, (b) => paintCart(b, 1090, 1470), { block: [80, 14] });
  p.prop(1500, 1250, 46, 76, (b) => paintStall(b, 1500, 1250), { block: [62, 14] });
  p.prop(1140, 1760, 28, 54, (b) => paintBarrels(b, 1140, 1760), { block: [40, 12] });
  p.prop(1490, 1780, 28, 54, (b) => paintBarrels(b, 1490, 1780), { block: [40, 12] });
  p.prop(2240, 1800, 66, 56, (b) => paintCart(b, 2240, 1800), { block: [80, 14] });
  for (const [mx, my, mw, mh] of [[300, 1500, 300, 130], [1000, 1250, 200, 90], [1520, 1450, 260, 110], [2200, 1560, 240, 120], [640, 1780, 240, 80]] as const) {
    p.decal(mx, my, mw, mh, (b) => paintMud(b, mx, my, mw, mh));
  }

  // --- Haute cour ---
  p.prop(midX, 930, 72, 116, (b) => paintFountain(b, midX, 930), { block: [116, 30] });
  p.light(midX, 900, 90, 44, '#a33a3a', 0.14);

  buildKeep(p);
  buildChapel(p);
  buildBarracks(p);
  buildGraveyard(p);

  // Route d'arrivée : elle mène à la porte depuis la lande.
  p.decal(midX - 96, CD + T, 192, 420, (b) => paintApproach(b, midX, CD + T, 420));

  const front = CD + T + 30;
  p.point('gate', names.gate!, midX, front);
  p.point('bailey', names.bailey!, midX, 1560);
  p.point('stables', names.stables!, 420, 1440);
  p.point('gallows', names.gallows!, 2120, 1660);
  p.point('breach', names.breach!, 1935, front);
  p.point('innerGate', names.innerGate!, midX, innerY + innerT + 30);
  p.point('ward', names.ward!, midX, 1010);
  p.point('fountain', names.fountain!, midX, 960);
  p.point('graveyard', names.graveyard!, 420, 190);

  p.garrison(midX - 500, 1700, 'skeleton', 8, 90);
  p.garrison(midX + 480, 1700, 'zombie', 6, 90);
  p.garrison(420, 1500, 'ghoul', 10, 110);
  p.garrison(1750, 1400, 'skeleton', 7, 70, 'endurci');
  p.garrison(2300, 1260, 'ghoul', 10, 110);
  p.garrison(midX, 1020, 'skeleton', 10, 120, 'endurci');
  p.garrison(760, 1000, 'zombie', 6, 80);
  p.garrison(1940, 1000, 'zombie', 6, 80);
  p.garrison(300, 210, 'ghoul', 12, 90);
  p.garrison(2300, 210, 'wraith', 5, 100);

  p.clear(-180, -160, CW + 360, CD + T + 260);
  // L'allée d'arrivée reste dégagée : la façade doit se voir de loin.
  p.clear(midX - 170, CD + T, 340, 520);
}

/** Boue de la basse-cour : de grands bords en marches, et les ornières de ce qui y passait. */
function paintMud(b: Brush, x: number, y: number, w: number, h: number): void {
  const rows = Math.floor(h / 10);
  for (let r = 0; r < rows; r++) {
    const q = (r + 0.5) / rows * 2 - 1;
    const half = (w / 2) * Math.sqrt(1 - q * q) * (0.82 + Math.floor(valueNoise2(r / 3, x / 50, 5) * 3) * 0.09);
    b.rect(x + w / 2 - half, y + r * 10, half * 2, 10, '#1f1c27');
  }
  for (const ry of [y + h * 0.42, y + h * 0.6]) b.rect(x + w * 0.16, ry, w * 0.68, 3, '#181520');
}

/** Pavés de la route, irréguliers sur leurs bords, de grands aplats et aucune trame. */
function paintApproach(b: Brush, cx: number, y0: number, len: number): void {
  for (let y = 0; y < len; y += 8) {
    const half = 58 + Math.floor(valueNoise2(y / 30, 3, 91) * 3) * 6;
    const stagger = Math.floor(y / 8) % 2 ? 8 : 0;
    for (let x = Math.floor((cx - half) / 16) * 16; x < cx + half; x += 16) {
      // Chaque colonne s'arrête à sa propre distance : la route se défait, elle n'est pas coupée.
      const end = len * (0.42 + valueNoise2(x / 40, 5, 37) * 0.5);
      if (y > end) continue;
      b.rect(x, y0 + y, 16, 8, '#24243a');
      if (valueNoise2(x / 30, y / 30, 17) < 0.66) b.rect(x + 1 - stagger / 2, y0 + y + 1, 14, 6, (x * 7 + y) % 3 === 0 ? '#2d2d48' : '#292a42');
    }
  }
}

function buildKeep(p: Plan): void {
  const names = castlePointNames();
  const cx = CASTLE_WIDTH / 2;
  const foot = 760, depth = 600, hallW = 300, wall = 30;
  const hall: Hall = {
    cx, foot, halfWidth: hallW, depth, height: 190, rise: 250, doorWidth: 92, doorHeight: 110, rose: 62,
    passable: true, lancets: [150, 226],
  };
  const north = foot - depth;
  const wingN = 300, wingS = 720, wingW = 260;
  const x0 = cx - hallW, x1 = cx + hallW;
  const wx0 = x0 - wingW, wx1 = x1 + wingW;

  const keep = p.group([
    { x: x0, y: north, w: hallW * 2, h: depth - 8 },
    { x: wx0, y: wingN, w: wingW, h: wingS - wingN },
    { x: x1, y: wingN, w: wingW, h: wingS - wingN },
  ]);

  // --- Sols ---
  p.floor(x0, north, hallW * 2, depth, 'flagstone');
  p.floor(wx0, wingN, wingW, wingS - wingN, 'flagstone');
  p.floor(x1, wingN, wingW, wingS - wingN, 'wood');
  p.decal(cx - 56, 380, 112, foot - 380, (b) => paintCarpet(b, cx - 56, 380, 112, foot - 380), keep);
  for (const dx of [-226, -150, 150, 226]) {
    p.decal(cx + dx - 18, 470, 104, 226, (b) => paintMoonlight(b, cx + dx - 18, 470, 34, 220), keep);
  }
  p.decal(cx - 150, foot, 300, 80, (b) => paintSteps(b, cx, foot + 72, 150, 6));

  // --- Enveloppe : ce qu'on voit de la cour ---
  const shell = { shell: keep };
  const hallTop = foot - depth - hall.height - hall.rise - 30;
  p.piece(x0 - 16, hallTop, hallW * 2 + 32, foot + 8 - hallTop, foot - 16, (b) => paintHall(b, hall), shell);
  // Flèche à la croisée : la pointe de la silhouette, visible de toute la basse-cour.
  const spireBase = foot - depth * 0.45 - hall.height - hall.rise;
  p.piece(cx - 56, spireBase - 300, 112, 310, foot - 15, (b) => spire(b, cx, spireBase, 96, 270), shell);

  const wing = (ax: number, bx: number): void => {
    p.rampart({
      x0: ax, x1: bx, y: wingN, depth: wingS - wingN, height: 150, base: 3, roofed: true,
      lancets: [ax + 60, ax + 130, ax + 200], buttresses: [ax + 82, ax + 152],
    }, shell, false);
  };
  wing(wx0, x0);
  wing(x1, wx1);
  for (const [tx, tf, h, roof] of [[wx0, wingS + 26, 250, 190], [wx1, wingS + 26, 250, 190], [wx0, wingN + 40, 220, 150], [wx1, wingN + 40, 300, 240]] as const) {
    p.tower({ cx: tx, foot: tf, radius: 62, height: h, roof, windows: 3 });
  }
  p.light(cx, foot - 300, 120, 90, '#f4b860', 0.08);
  p.light(cx, foot - 40, 80, 50, '#f4b860', 0.1);

  // --- Murs : la collision, vraie que l'enveloppe soit là ou non ---
  const doorW = hall.doorWidth;
  p.solid(x0, foot - wall, hallW - doorW / 2, wall);
  p.solid(cx + doorW / 2, foot - wall, hallW - doorW / 2, wall);
  p.solid(x0, north, hallW * 2, wall);
  // Murs ouest et est de la nef, percés d'une porte vers chaque aile.
  const sideDoor = 500, sideW = 74;
  p.solid(x0 - 10, north, 20, sideDoor - north);
  p.solid(x0 - 10, sideDoor + sideW, 20, foot - sideDoor - sideW);
  p.solid(x1 - 10, north, 20, sideDoor - north);
  p.solid(x1 - 10, sideDoor + sideW, 20, foot - sideDoor - sideW);
  // Ailes : une porte vers l'extérieur à chaque extrémité.
  const outerDoor = 540;
  p.solid(wx0, wingN, x0 - wx0, wall);
  p.solid(x1, wingN, wx1 - x1, wall);
  p.solid(wx0, wingS - wall, x0 - wx0, wall);
  p.solid(x1, wingS - wall, wx1 - x1, wall);
  p.solid(wx0, wingN, 24, outerDoor - wingN);
  p.solid(wx0, outerDoor + sideW, 24, wingS - outerDoor - sideW);
  p.solid(wx1 - 24, wingN, 24, outerDoor - wingN);
  p.solid(wx1 - 24, outerDoor + sideW, 24, wingS - outerDoor - sideW);
  // Mur du fond de la nef : la crypte, derrière le trône.
  const cryptY = 340, cryptDoor = 74, cryptDoorX = 190;
  p.solid(x0, cryptY, hallW - cryptDoorX - cryptDoor / 2, 24);
  p.solid(cx - cryptDoorX + cryptDoor / 2, cryptY, cryptDoorX * 2 - cryptDoor, 24);
  p.solid(cx + cryptDoorX + cryptDoor / 2, cryptY, hallW - cryptDoorX - cryptDoor / 2, 24);

  // --- Dedans : les murs en coupe ---
  const inside = { inner: keep, fades: true };
  const innerSeg = (a: number, b2: number, y: number, d: number, h: number, l: readonly number[] = []): void => {
    const SECTION = 128;
    for (let x = a; x < b2; x += SECTION) {
      p.piece(x, y - h - 2, Math.min(SECTION, b2 - x), h + d + 4, y + d / 2, (b) => paintInnerWall(b, a, b2, y, d, h, l), inside);
    }
  };
  const innerNS = (x: number, a: number, b2: number, d: number, h: number): void => {
    p.piece(x, a - h - 2, d, b2 - a + h + 4, b2, (b) => paintInnerWallNS(b, x, a, b2, d, h), { inner: keep, fades: false });
  };
  // Murs du nord : hauts, percés de verrières, ils portent la scène.
  innerSeg(x0, x1, north, wall, 118, [cx - 200, cx, cx + 200]);
  innerSeg(x0, cx - cryptDoorX - cryptDoor / 2, cryptY, 24, 104);
  innerSeg(cx - cryptDoorX + cryptDoor / 2, cx + cryptDoorX - cryptDoor / 2, cryptY, 24, 104, [cx]);
  innerSeg(cx + cryptDoorX + cryptDoor / 2, x1, cryptY, 24, 104);
  innerSeg(wx0, x0, wingN, wall, 104, [wx0 + 130]);
  innerSeg(x1, wx1, wingN, wall, 104, [x1 + 130]);
  // Murs du sud : bas, pour ne rien cacher.
  const low = 22;
  innerSeg(x0, cx - doorW / 2, foot - wall, wall, low);
  innerSeg(cx + doorW / 2, x1, foot - wall, wall, low);
  innerSeg(wx0, x0, wingS - wall, wall, low);
  innerSeg(x1, wx1, wingS - wall, wall, low);
  // Refends nord-sud.
  for (const x of [x0 - 10, x1 - 10]) {
    innerNS(x, north, sideDoor, 20, 56);
    innerNS(x, sideDoor + sideW, foot, 20, low);
  }
  for (const x of [wx0, wx1 - 24]) {
    innerNS(x, wingN, outerDoor, 24, 56);
    innerNS(x, outerDoor + sideW, wingS, 24, low);
  }

  // --- La grande salle ---
  for (const y of [476, 596]) {
    for (const dx of [-150, 150]) {
      p.prop(cx + dx, y, 28, 130, (b) => paintPillar(b, cx + dx, y, 16, 104), { block: [32, 16], inner: keep, fades: true });
    }
  }
  p.prop(cx, 430, 96, 140, (b) => paintThrone(b, cx, 430), { block: [120, 40], inner: keep });
  for (const dx of [-112, 112]) {
    p.prop(cx + dx, 410, 16, 70, (b) => paintCandelabra(b, cx + dx, 410), { block: [10, 8], inner: keep });
    p.light(cx + dx, 360, 52, 40, '#f4b860', 0.14);
  }
  for (const [tx, ty] of [[x0 + 32, 546], [x0 + 32, 670], [x1 - 122, 546], [x1 - 122, 670]] as const) {
    p.prop(tx + 45, ty, 50, 50, (b) => paintTable(b, tx, ty, 90, 26), { block: [90, 16], inner: keep });
  }

  // --- La crypte, derrière le trône ---
  for (const dx of [-120, 0, 120]) {
    p.prop(cx + dx, 256, 36, 56, (b) => paintTomb(b, cx + dx, 256), { block: [60, 18], inner: keep });
  }
  p.light(cx, 240, 90, 40, '#6f86c2', 0.1);

  // --- L'armurerie, à l'ouest ---
  for (const x of [wx0 + 40, wx0 + 130]) {
    const y = wingN + 90;
    p.prop(x + 32, y, 40, 90, (b) => paintWeaponRack(b, x, y, 64), { block: [64, 12], inner: keep });
  }
  for (const [ax, ay] of [[wx0 + 80, 470], [wx0 + 180, 470], [wx0 + 80, 660], [wx0 + 180, 660]] as const) {
    p.prop(ax, ay, 26, 90, (b) => paintArmor(b, ax, ay), { block: [20, 10], inner: keep });
  }

  // --- La bibliothèque, à l'est ---
  for (const x of [x1 + 40, x1 + 130]) {
    const y = wingN + 120;
    p.prop(x + 40, y, 44, 96, (b) => paintBookshelf(b, x, y, 80, 86), { block: [80, 14], inner: keep });
  }
  for (const y of [520, 640]) {
    p.prop(x1 + 130, y, 74, 110, (b) => paintBookshelf(b, x1 + 60, y, 140, 86), { block: [140, 14], inner: keep });
  }
  p.prop(x1 + 40, 460, 16, 70, (b) => paintCandelabra(b, x1 + 40, 460), { block: [10, 8], inner: keep });
  p.light(x1 + 40, 410, 60, 44, '#f4b860', 0.14);

  p.point('hall', names.hall!, cx, 680);
  p.point('throne', names.throne!, cx, 470);
  p.point('crypt', names.crypt!, cx, 300);
  p.point('armory', names.armory!, wx0 + 130, 600);
  p.point('library', names.library!, x1 + 130, 480);

  p.garrison(cx - 80, 680, 'skeleton', 10, 60, 'endurci');
  p.garrison(cx + 80, 600, 'skeleton', 8, 50);
  p.garrison(cx, 480, 'golem', 1, 8, 'colosse');
  p.garrison(cx - 60, 300, 'wraith', 6, 40);
  p.garrison(cx + 60, 300, 'ghoul', 8, 30);
  p.garrison(wx0 + 130, 570, 'skeleton', 8, 50, 'elite');
  p.garrison(x1 + 200, 590, 'ghoul', 10, 30);
}

function buildChapel(p: Plan): void {
  const names = castlePointNames();
  const cx = 380, foot = 960, W = 140, depth = 480, wall = 24;
  const north = foot - depth;
  const hall: Hall = {
    cx, foot, halfWidth: W, depth, height: 124, rise: 150, doorWidth: 76, doorHeight: 84, rose: 34,
    passable: true, lancets: [],
  };
  const x0 = cx - W, x1 = cx + W;
  const group = p.group([{ x: x0, y: north, w: W * 2, h: depth - 8 }]);

  p.floor(x0, north, W * 2, depth, 'chapel');
  p.decal(cx - 34, north + 60, 68, depth - 60, (b) => paintCarpet(b, cx - 34, north + 60, 68, depth - 60), group);
  p.decal(cx - 100, foot, 200, 60, (b) => paintSteps(b, cx, foot + 48, 100, 4));

  const top = foot - depth - hall.height - hall.rise - 30;
  p.piece(x0 - 16, top, W * 2 + 32, foot + 8 - top, foot - 12, (b) => paintHall(b, hall), { shell: group });
  const spireBase = foot - depth * 0.62 - hall.height - hall.rise;
  p.piece(cx - 40, spireBase - 240, 80, 250, foot - 11, (b) => spire(b, cx, spireBase, 64, 214), { shell: group });

  const doorW = hall.doorWidth, sideDoor = 720, sideW = 74;
  p.solid(x0, foot - wall, W - doorW / 2, wall);
  p.solid(cx + doorW / 2, foot - wall, W - doorW / 2, wall);
  p.solid(x0, north, W * 2, wall);
  p.solid(x0, north, wall, depth);
  p.solid(x1 - wall, north, wall, sideDoor - north);
  p.solid(x1 - wall, sideDoor + sideW, wall, foot - sideDoor - sideW);

  const inside = { inner: group, fades: true };
  p.piece(x0, north - 110, W * 2, 142, north + 12, (b) => paintInnerWall(b, x0, x1, north, wall, 100, [cx - 60, cx, cx + 60]), inside);
  for (const [a, b2] of [[x0, cx - doorW / 2], [cx + doorW / 2, x1]] as const) {
    p.piece(a, foot - wall - 22, b2 - a, wall + 26, foot - 12, (b) => paintInnerWall(b, a, b2, foot - wall, wall, 22), inside);
  }
  const noFade = { inner: group, fades: false };
  p.piece(x0, north - 40, wall, depth + 42, foot, (b) => paintInnerWallNS(b, x0, north, foot, wall, 40), noFade);
  p.piece(x1 - wall, north - 40, wall, sideDoor - north + 42, sideDoor, (b) => paintInnerWallNS(b, x1 - wall, north, sideDoor, wall, 40), noFade);
  p.piece(x1 - wall, sideDoor + sideW - 22, wall, foot - sideDoor - sideW + 24, foot, (b) => paintInnerWallNS(b, x1 - wall, sideDoor + sideW, foot, wall, 22), noFade);

  p.prop(cx, north + 110, 66, 110, (b) => paintAltar(b, cx, north + 110, 90), { block: [90, 26], inner: group });
  p.light(cx, north + 50, 80, 50, '#b5302c', 0.16);
  for (const y of [630, 690, 750, 810, 870]) {
    for (const x of [x0 + 58, cx + 30]) {
      p.prop(x + 31, y, 36, 32, (b) => paintPew(b, x, y, 62), { block: [62, 10], inner: group });
    }
  }
  for (const y of [560, 700, 900]) {
    for (const dx of [-W + 38, W - 38]) {
      if (dx > 0 && y === 700) continue;
      p.prop(cx + dx, y, 20, 110, (b) => paintPillar(b, cx + dx, y, 10, 92), { block: [20, 12], inner: group, fades: true });
    }
  }

  p.point('chapel', names.chapel!, cx, 930);
  p.point('altar', names.altar!, cx, north + 140);
  p.garrison(cx, 790, 'ghoul', 10, 30);
  p.garrison(cx, north + 180, 'wraith', 4, 40);
}

function buildBarracks(p: Plan): void {
  const names = castlePointNames();
  const x0 = 2060, x1 = 2450, north = 520, foot = 930, H = 120, wall = 24, door = 76;
  const cx = (x0 + x1) / 2;
  const group = p.group([{ x: x0, y: north, w: x1 - x0, h: foot - north - 8 }]);
  p.floor(x0, north, x1 - x0, foot - north, 'wood');

  const run: RampartRun = { x0, x1, y: north, depth: foot - north, height: H, base: 3, roofed: true, buttresses: [x0 + 70, x1 - 96], lancets: [x0 + 40, x1 - 40] };
  const SECTION = 96;
  const sectionTop = north - H - 44;
  for (let x = x0; x < x1; x += SECTION) {
    const w = Math.min(SECTION, x1 - x);
    p.piece(x, sectionTop, w, foot + 10 - sectionTop, foot - 12, (b) => {
      paintRampart(b, run);
      b.arch(cx, foot, door + 18, 92, STONE[5]);
      b.cutArch(cx, foot, door, 84);
    }, { shell: group });
  }

  p.solid(x0, foot - wall, cx - door / 2 - x0, wall);
  p.solid(cx + door / 2, foot - wall, x1 - cx - door / 2, wall);
  p.solid(x0, north, x1 - x0, wall);
  p.solid(x0, north, wall, foot - north);
  const sideDoor = 700;
  p.solid(x1 - wall, north, wall, sideDoor - north);
  p.solid(x1 - wall, sideDoor + door, wall, foot - sideDoor - door);

  const inside = { inner: group, fades: true };
  p.piece(x0, north - 106, x1 - x0, 134, north + 12, (b) => paintInnerWall(b, x0, x1, north, wall, 100, [cx - 110, cx + 110]), inside);
  for (const [a, b2] of [[x0, cx - door / 2], [cx + door / 2, x1]] as const) {
    p.piece(a, foot - wall - 22, b2 - a, wall + 26, foot - 12, (b) => paintInnerWall(b, a, b2, foot - wall, wall, 22), inside);
  }
  const noFade = { inner: group, fades: false };
  p.piece(x0, north - 40, wall, foot - north + 42, foot, (b) => paintInnerWallNS(b, x0, north, foot, wall, 40), noFade);
  p.piece(x1 - wall, north - 40, wall, sideDoor - north + 42, sideDoor, (b) => paintInnerWallNS(b, x1 - wall, north, sideDoor, wall, 40), noFade);
  p.piece(x1 - wall, sideDoor + door - 22, wall, foot - sideDoor - door + 24, foot, (b) => paintInnerWallNS(b, x1 - wall, sideDoor + door, foot, wall, 22), noFade);

  for (const y of [660, 760, 860]) {
    for (const x of [x0 + 44, cx + 50]) p.prop(x + 50, y, 56, 50, (b) => paintTable(b, x, y, 100, 26), { block: [100, 16], inner: group });
  }
  p.prop(x0 + 90, north + 100, 44, 90, (b) => paintWeaponRack(b, x0 + 58, north + 100, 64), { block: [64, 12], inner: group });
  p.prop(x1 - 90, north + 100, 44, 90, (b) => paintWeaponRack(b, x1 - 122, north + 100, 64), { block: [64, 12], inner: group });

  p.point('barracks', names.barracks!, cx, 720);
  p.garrison(cx, 700, 'skeleton', 12, 60);
}

function buildGraveyard(p: Plan): void {
  for (const y of [130, 186]) {
    for (let x = 150; x < 700; x += 92) {
      p.prop(x, y, 36, 56, (b) => paintTomb(b, x, y), { block: [60, 16] });
    }
  }
  p.prop(2300, 170, 46, 100, (b) => paintDeadTree(b, 2300, 170, 96, 2), { block: [12, 8] });
  p.prop(2440, 150, 46, 100, (b) => paintDeadTree(b, 2440, 150, 80, 4), { block: [12, 8] });
}
