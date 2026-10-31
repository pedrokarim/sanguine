import { Rng } from '../core/rng';
import { buildCastle, CASTLE_DEPTH, CASTLE_WIDTH } from '../game/castleplan';
import { buildCemetery, buildPriory, CEMETERY_DEPTH, CEMETERY_WIDTH, PRIORY_DEPTH, PRIORY_WIDTH } from '../game/holyground';
import { buildShrine } from '../game/shrines';
import type { ShrineType } from '../game/siteplan';
import { buildDecal, buildPiece, emptySite, Plan, type Site } from '../game/siteplan';
import { addHouse, type HouseKind } from '../game/villages';
import { floorTile } from './castle';

/**
 * Planches des lieux, pour la page des sprites.
 *
 * Elles sont peintes par les mêmes plans que le jeu : un mur déplacé dans `castleplan.ts` se voit
 * ici tout de suite, sans lancer de partie.
 */

export const HOUSE_KINDS: readonly HouseKind[] = ['cottage', 'long', 'tall', 'smithy', 'barn', 'inn'];

/** Compose un lieu entier sur un seul canvas, puis le réduit à la taille voulue. */
function composeSite(site: Site, x: number, y: number, w: number, h: number, interior: boolean, scale: number): HTMLCanvasElement {
  const big = document.createElement('canvas');
  big.width = w;
  big.height = h;
  const g = big.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#16211c';
  g.fillRect(0, 0, w, h);
  g.setTransform(1, 0, 0, 1, -x, -y);
  for (const f of site.floors) {
    g.fillStyle = g.createPattern(floorTile(f.kind), 'repeat')!;
    g.fillRect(f.x, f.y, f.w, f.h);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (const p of site.decals) {
    if (p.inner >= 0 && !interior) continue;
    g.drawImage(p.canvas ?? buildDecal(p), p.x - x, p.y - y);
  }
  for (const p of [...site.pieces].sort((a, b) => a.key - b.key)) {
    if (interior ? p.shell >= 0 : p.inner >= 0) continue;
    g.drawImage(p.canvas ?? buildPiece(p), p.x - x, p.y - y);
  }
  if (scale === 1) return big;
  const out = document.createElement('canvas');
  out.width = Math.round(w * scale);
  out.height = Math.round(h * scale);
  const o = out.getContext('2d')!;
  o.imageSmoothingQuality = 'high';
  o.drawImage(big, 0, 0, out.width, out.height);
  return out;
}

export function castleSheet(interior: boolean): HTMLCanvasElement {
  const site = emptySite('sheet', 'castle', '', '', 0, 0);
  buildCastle(site);
  return composeSite(site, -260, -560, CASTLE_WIDTH + 520, CASTLE_DEPTH + 960, interior, 660 / (CASTLE_WIDTH + 520));
}

export function houseSheet(kind: HouseKind): HTMLCanvasElement {
  const site = emptySite('sheet', 'village', '', '', 0, 0);
  addHouse(new Plan(site), 0, 0, kind, 7);
  return composeSite(site, -30, -210, 340, 400, false, 1);
}

/** Une structure entière, à l'échelle du jeu. */
export function shrineSheet(type: ShrineType): HTMLCanvasElement {
  const site = emptySite('sheet', 'shrine', '', '', 0, 0);
  buildShrine(site, type);
  return composeSite(site, -270, -560, 540, 880, false, 0.5);
}

/** Le cimetière ou le prieuré, vus d'un bloc. */
export function holyGroundSheet(kind: 'cemetery' | 'priory', interior: boolean): HTMLCanvasElement {
  const site = emptySite('sheet', kind, '', '', 0, 0);
  if (kind === 'cemetery') buildCemetery(site, new Rng(7));
  else buildPriory(site, new Rng(7));
  const w = kind === 'cemetery' ? CEMETERY_WIDTH : PRIORY_WIDTH, h = kind === 'cemetery' ? CEMETERY_DEPTH : PRIORY_DEPTH;
  return composeSite(site, -60, -440, w + 120, h + 560, interior, 660 / (w + 120));
}
