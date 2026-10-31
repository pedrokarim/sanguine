import { Rng } from '../core/rng';
import { audio } from '../audio/audio';
import { P } from '../gfx/palette';
import { t } from '../i18n';
import type { World } from './world';

/**
 * Ce qui fait la loi au sol, biome par biome : lave, lac gelé, tourbière, ronciers.
 *
 * Une nappe est faite de lobes : quelques ellipses mises bout à bout, assez pour qu'une coulée
 * serpente sans jamais ressembler à un cercle. Le test de présence ne regarde que ces lobes, et le
 * dessin peint les mêmes : ce qu'on voit est exactement ce qui brûle.
 */

export type PoolKind = 'lava' | 'ice' | 'bog' | 'bramble';

export interface Lobe {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface Pool {
  kind: PoolKind;
  lobes: Lobe[];
  /** Emprise, dans le monde. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  seed: number;
  /** Peint à l'approche : trois images pour la lave, une pour le reste. */
  frames: HTMLCanvasElement[] | null;
}

const CELL = 900;
/** Portée maximale d'une nappe autour de sa case. */
const REACH = 520;
/** Une image sur trois : la horde compte des centaines de corps, et rien ici n'exige davantage. */
const ENEMY_STRIDE = 3;

/** Part de la commande transmise à chaque image : environ 60 px d'élan à la vitesse de base. */
const ICE_GRIP = 0.025;
const BURN_TICK = 0.45;
const BURN_SHARE = 0.05;
/** Dégâts par seconde infligés à ce qui marche dans la lave, avant l'échelle de la partie. */
const LAVA_DPS = 34;

/** Ce que chaque nappe fait au héros. */
export const POOL_SPEED: Readonly<Record<PoolKind, number>> = { lava: 1, ice: 1, bog: 0.62, bramble: 0.74 };

/** Le biome décide de sa nappe : `null` là où le sol ne fait rien. */
export function poolOf(biomeId: string): PoolKind | null {
  switch (biomeId) {
    case 'lava': return 'lava';
    case 'frost': return 'ice';
    case 'mire': return 'bog';
    case 'thicket': return 'bramble';
    default: return null;
  }
}

function makePool(kind: PoolKind, rng: Rng, x: number, y: number): Pool {
  const lobes: Lobe[] = [];
  const big = kind === 'ice' ? 2.3 : kind === 'bramble' ? 0.8 : 1;
  const count = kind === 'lava' ? rng.int(5, 8) : rng.int(3, 5);
  let a = rng.range(0, Math.PI * 2), lx = x, ly = y;
  for (let i = 0; i < count; i++) {
    const rx = rng.range(70, 120) * big, ry = rng.range(44, 70) * big;
    lobes.push({ x: lx, y: ly, rx, ry });
    a += rng.range(-0.7, 0.7);
    const step = rx * 0.95;
    lx += Math.cos(a) * step;
    ly += Math.sin(a) * step * 0.6;
  }
  const pool: Pool = { kind, lobes, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, seed: rng.int(0, 9999), frames: null };
  for (const l of lobes) {
    pool.x0 = Math.min(pool.x0, l.x - l.rx);
    pool.y0 = Math.min(pool.y0, l.y - l.ry);
    pool.x1 = Math.max(pool.x1, l.x + l.rx);
    pool.y1 = Math.max(pool.y1, l.y + l.ry);
  }
  return pool;
}

const inside = (p: Pool, x: number, y: number): boolean => {
  if (x < p.x0 || x > p.x1 || y < p.y0 || y > p.y1) return false;
  for (const l of p.lobes) {
    const dx = (x - l.x) / l.rx, dy = (y - l.y) / l.ry;
    if (dx * dx + dy * dy < 1) return true;
  }
  return false;
};

export class HazardField {
  private readonly cells = new Map<number, Pool[]>();
  private readonly buf: Pool[] = [];
  /** Nappe sous le héros, tenue à jour par `updateHazards`. */
  under: Pool | null = null;
  private burnTimer = 0;
  private stride = 0;

  constructor(
    private readonly seed: number,
    private readonly biomeIdAt: (x: number, y: number) => string,
    private readonly blocked: (x: number, y: number) => boolean,
  ) {}

  private cell(cx: number, cy: number): Pool[] {
    const key = (cx + 0x4000) * 0x8000 + (cy + 0x4000);
    let out = this.cells.get(key);
    if (out) return out;
    out = [];
    const rng = new Rng((Math.imul(cx, 0x27d4eb2d) ^ Math.imul(cy, 0x165667b1) ^ this.seed ^ 0x51ed270b) >>> 0);
    const x = (cx + 0.5) * CELL + rng.range(-180, 180), y = (cy + 0.5) * CELL + rng.range(-180, 180);
    const kind = poolOf(this.biomeIdAt(x, y));
    // Le départ reste libre, et une nappe ne recouvre ni un lieu ni une structure.
    if (kind && rng.chance(0.72) && Math.hypot(x, y) > 640) {
      const pool = makePool(kind, rng, x, y);
      const clear = pool.lobes.every((l) => !this.blocked(l.x, l.y) && !this.blocked(l.x + l.rx, l.y) && !this.blocked(l.x - l.rx, l.y) && !this.blocked(l.x, l.y + l.ry) && !this.blocked(l.x, l.y - l.ry));
      if (clear) out.push(pool);
    }
    this.cells.set(key, out);
    return out;
  }

  /** Nappes proches. Tampon réutilisé, ne pas conserver. */
  near(x: number, y: number, radius: number): Pool[] {
    const out = this.buf;
    out.length = 0;
    const R = radius + REACH;
    const c0x = Math.floor((x - R) / CELL), c1x = Math.floor((x + R) / CELL);
    const c0y = Math.floor((y - R) / CELL), c1y = Math.floor((y + R) / CELL);
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        for (const p of this.cell(cx, cy)) {
          if (x + radius > p.x0 && x - radius < p.x1 && y + radius > p.y0 && y - radius < p.y1) out.push(p);
        }
      }
    }
    return out;
  }

  /** Nappe en un point. Sert au semis : ni arbre dans la lave, ni buisson sur le lac. */
  at(x: number, y: number): Pool | null {
    for (const p of this.near(x, y, 0)) if (inside(p, x, y)) return p;
    return null;
  }

  /** Une nappe loin du héros rend sa mémoire : ses images se repeignent à l'approche. */
  release(x: number, y: number): void {
    for (const list of this.cells.values()) {
      for (const p of list) {
        if (p.frames && (Math.abs(p.x0 - x) > 1800 || Math.abs(p.y0 - y) > 1400)) p.frames = null;
      }
    }
  }

  update(w: World, dt: number): void {
    const pl = w.player;
    const pools = this.near(pl.x, pl.y, 480);
    this.under = null;
    const feet = pl.y + 10;
    for (const p of pools) if (inside(p, pl.x, feet)) this.under = p;
    pl.grip = this.grip;

    if (this.under?.kind === 'lava') {
      this.burnTimer -= dt;
      if (this.burnTimer <= 0) {
        this.burnTimer = BURN_TICK;
        if (pl.takeDamage(pl.stats.maxHp * BURN_SHARE)) {
          w.particles.label(pl.x, pl.y - 18, t('brûlure', 'burn'), P.fire);
          audio.play('hurt');
        }
      }
    }

    // Les corps qui marchent paient aussi : la lave est une arme, pour qui sait attirer la horde.
    this.stride = (this.stride + 1) % ENEMY_STRIDE;
    const step = dt * ENEMY_STRIDE;
    for (let i = this.stride; i < w.enemies.length; i += ENEMY_STRIDE) {
      const e = w.enemies[i]!;
      if (!e.active || e.dying > 0 || e.def.art.flies === true) continue;
      for (const p of pools) {
        if (!inside(p, e.x, e.y + e.radius)) continue;
        if (p.kind === 'lava') {
          if (!e.boss) e.hp -= LAVA_DPS * step * (1 + w.time / 300);
          if (e.hp <= 0) w.killEnemy(e);
        } else {
          e.slow = Math.max(e.slow, 0.3);
        }
        break;
      }
    }
  }

  /** Vitesse du héros sur ce qu'il foule, et adhérence : 1 répond tout de suite, 0 ne répond plus. */
  get speed(): number {
    return this.under ? POOL_SPEED[this.under.kind] : 1;
  }

  get grip(): number {
    return this.under?.kind === 'ice' ? ICE_GRIP : 1;
  }
}
