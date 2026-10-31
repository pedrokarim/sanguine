import type { Lobe, Pool, PoolKind } from '../game/hazards';
import { Brush, stoneHash } from './brush';

/**
 * Le dessin des nappes : trois anneaux francs, du bord vers le cœur.
 *
 * Aucune trame : ces surfaces défilent par pas d'un pixel et couvrent une bonne part de l'écran. La
 * lave vit par des images entières, tirées de la même graine, et non par du bruit.
 */

const LAVA_FRAMES = 3;

interface Ramp {
  rim: string;
  edge: string;
  body: string;
  core: string;
  spark: string;
}

const RAMPS: Readonly<Record<PoolKind, Ramp>> = {
  lava: { rim: '#120a0c', edge: '#3a1410', body: '#c22e12', core: '#ff8a1e', spark: '#ffe28a' },
  ice: { rim: '#0e2436', edge: '#1e4464', body: '#2c5a7c', core: '#3a7094', spark: '#a8d8ea' },
  bog: { rim: '#0a0f0a', edge: '#1a2416', body: '#242e18', core: '#2e3a1a', spark: '#5a7a34' },
  bramble: { rim: '#0c0a0a', edge: '#1c1412', body: '#241a16', core: '#2e2219', spark: '#8e1a2a' },
};

function ring(b: Brush, lobes: readonly Lobe[], grow: number, scale: number, c: string): void {
  for (const l of lobes) b.ellipse(l.x, l.y, l.rx * scale + grow, l.ry * scale + grow * 0.7, c);
}

function paintLava(b: Brush, p: Pool, f: number): void {
  const r = RAMPS.lava;
  ring(b, p.lobes, 10, 1, r.rim);
  ring(b, p.lobes, 4, 1, r.edge);
  ring(b, p.lobes, 0, 0.9, r.body);
  ring(b, p.lobes, 0, 0.66, r.core);
  // Les plaques de croûte dérivent d'une image à l'autre : la surface coule, sans clignoter.
  p.lobes.forEach((l, i) => {
    for (let k = 0; k < 11; k++) {
      const a = stoneHash(p.seed + i, k) * Math.PI * 2 + f * 0.09;
      const d = 0.2 + stoneHash(p.seed + i, k + 30) * 0.66;
      const x = l.x + Math.cos(a) * l.rx * d, y = l.y + Math.sin(a) * l.ry * d;
      const w = 14 + stoneHash(p.seed, k + i) * 26;
      b.ellipse(x, y, w, w * 0.42, '#3a1410');
      b.ellipse(x - 2, y - 1, w * 0.7, w * 0.26, '#5a2012');
      b.rect(x - w * 0.5, y + w * 0.3, w, 2, f === k % LAVA_FRAMES ? r.spark : r.core);
    }
  });
}

function paintIce(b: Brush, p: Pool): void {
  const r = RAMPS.ice;
  ring(b, p.lobes, 12, 1, '#c4dbe8');
  ring(b, p.lobes, 7, 1, r.rim);
  ring(b, p.lobes, 3, 1, r.edge);
  ring(b, p.lobes, 0, 0.94, r.body);
  ring(b, p.lobes, 0, 0.62, r.core);
  // Fêlures et reflets, qui disent que c'est glissant avant qu'on l'apprenne à ses dépens.
  p.lobes.forEach((l, i) => {
    for (let k = 0; k < 7; k++) {
      let x = l.x + (stoneHash(p.seed + i, k) - 0.5) * l.rx * 1.3, y = l.y + (stoneHash(p.seed + i, k + 9) - 0.5) * l.ry * 1.3;
      let a = stoneHash(p.seed, k + i) * 3;
      for (let s = 0; s < 8; s++) {
        b.rect(x, y, 3, 2, r.spark);
        a += (stoneHash(k, s) - 0.5) * 1.2;
        x += Math.cos(a) * 6;
        y += Math.sin(a) * 3;
      }
    }
    b.rect(l.x - l.rx * 0.4, l.y - l.ry * 0.3, l.rx * 0.5, 3, r.spark);
    b.rect(l.x - l.rx * 0.2, l.y - l.ry * 0.2, l.rx * 0.3, 2, r.spark);
  });
}

function paintBog(b: Brush, p: Pool): void {
  const r = RAMPS.bog;
  ring(b, p.lobes, 8, 1, r.rim);
  ring(b, p.lobes, 3, 1, r.edge);
  ring(b, p.lobes, 0, 0.9, r.body);
  ring(b, p.lobes, 0, 0.6, r.core);
  p.lobes.forEach((l, i) => {
    for (let k = 0; k < 9; k++) {
      const x = l.x + (stoneHash(p.seed + i, k) - 0.5) * l.rx * 1.4, y = l.y + (stoneHash(p.seed + i, k + 9) - 0.5) * l.ry * 1.4;
      b.ellipse(x, y, 5, 3, r.spark);
      b.ellipse(x, y - 1, 3, 1.4, '#8aa84a');
    }
  });
}

function paintBramble(b: Brush, p: Pool): void {
  const r = RAMPS.bramble;
  ring(b, p.lobes, 4, 1, r.rim);
  ring(b, p.lobes, 0, 0.96, r.edge);
  ring(b, p.lobes, 0, 0.7, r.body);
  // Tiges enchevêtrées : des arcs francs, et leurs épines.
  p.lobes.forEach((l, i) => {
    for (let k = 0; k < 14; k++) {
      const cx = l.x + (stoneHash(p.seed + i, k) - 0.5) * l.rx * 1.5, cy = l.y + (stoneHash(p.seed + i, k + 9) - 0.5) * l.ry * 1.5;
      const R = 14 + stoneHash(p.seed, k) * 22, a0 = stoneHash(i, k) * 6;
      for (let q = 0; q < 12; q++) {
        const a = a0 + q * 0.3, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.5;
        b.rect(x, y, 3, 2, q % 4 === 0 ? '#54402c' : '#3a2c20');
        if (q % 4 === 2) b.rect(x + 1, y - 3, 1, 3, '#7e6a4c');
      }
      if (k % 5 === 0) b.rect(cx, cy, 3, 3, r.spark);
    }
  });
}

/** Les images d'une nappe. La lave en a trois, jouées en boucle ; le reste n'en a qu'une. */
export function poolFrames(p: Pool): HTMLCanvasElement[] {
  if (p.frames) return p.frames;
  const M = 16;
  const x = Math.floor(p.x0 - M), y = Math.floor(p.y0 - M), w = Math.ceil(p.x1 - p.x0 + M * 2), h = Math.ceil(p.y1 - p.y0 + M * 2);
  const count = p.kind === 'lava' ? LAVA_FRAMES : 1;
  const frames: HTMLCanvasElement[] = [];
  for (let f = 0; f < count; f++) {
    const b = new Brush(x, y, w, h);
    if (p.kind === 'lava') paintLava(b, p, f);
    else if (p.kind === 'ice') paintIce(b, p);
    else if (p.kind === 'bog') paintBog(b, p);
    else paintBramble(b, p);
    frames.push(b.toCanvas(0));
  }
  p.frames = frames;
  return frames;
}
