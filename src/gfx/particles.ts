import { fxRng } from '../core/rng';
import { TAU, clamp01, easeOutCubic } from '../core/math';
import { P } from './palette';
import * as font from './font';
import type { Camera } from './camera';

/**
 * Système de particules poolé. Aucune allocation après l'initialisation : le pool est rempli
 * une fois, et les particules sont recyclées par un pointeur circulaire.
 *
 * Le plafond est volontaire — au-delà, les nouvelles demandes de faible priorité sont
 * ignorées. Il vaut mieux perdre de la poussière décorative que le sang du joueur.
 */

/**
 * Objet constant plutôt qu'un `const enum` : `isolatedModules` interdit d'inliner un const enum
 * à travers les modules, et un enum classique génère du code à l'exécution pour rien.
 */
export const PKind = {
  Spark: 0,
  Blood: 1,
  Dust: 2,
  Ring: 3,
  Number: 4,
  Ember: 5,
  Shard: 6,
  Beam: 7,
} as const;

export type PKind = (typeof PKind)[keyof typeof PKind];

interface Particle {
  active: boolean;
  kind: PKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  text: string;
  scale: number;
  gravity: number;
  drag: number;
  rot: number;
  priority: number;
}

const MAX = 1400;

export class Particles {
  private pool: Particle[] = [];
  private cursor = 0;
  private liveCount = 0;

  constructor() {
    for (let i = 0; i < MAX; i++) {
      this.pool.push({
        active: false,
        kind: PKind.Spark,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        color: '#fff',
        text: '',
        scale: 1,
        gravity: 0,
        drag: 1,
        rot: 0,
        priority: 0,
      });
    }
  }

  get count(): number {
    return this.liveCount;
  }

  clear(): void {
    for (const p of this.pool) p.active = false;
    this.liveCount = 0;
  }

  /**
   * Récupère un slot libre. Si le pool est saturé, vole le slot courant seulement si la
   * nouvelle particule est au moins aussi prioritaire — sinon la demande est abandonnée.
   */
  private alloc(priority: number): Particle | null {
    for (let attempts = 0; attempts < 32; attempts++) {
      const p = this.pool[this.cursor]!;
      this.cursor = (this.cursor + 1) % MAX;
      if (!p.active) {
        this.liveCount++;
        return p;
      }
      if (p.priority < priority) return p; // recyclage d'une particule moins importante
    }
    return null;
  }

  private spawn(
    kind: PKind,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    color: string,
    size: number,
    priority: number,
  ): Particle | null {
    const p = this.alloc(priority);
    if (!p) return null;
    p.active = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.color = color;
    p.size = size;
    p.priority = priority;
    p.scale = 1;
    p.gravity = 0;
    p.drag = 1;
    p.rot = 0;
    p.text = '';
    return p;
  }

  // ------------------------------------------------------------------ presets

  /** Gerbe d'étincelles orientée — impact d'arme. */
  sparks(x: number, y: number, angle: number, n = 4, color: string = P.spark, spread = 1.1): void {
    for (let i = 0; i < n; i++) {
      const a = angle + fxRng.spread(spread);
      const s = fxRng.range(28, 82);
      const p = this.spawn(PKind.Spark, x, y, Math.cos(a) * s, Math.sin(a) * s, fxRng.range(0.14, 0.3), color, fxRng.range(0.8, 1.8), 1);
      if (p) p.drag = 0.86;
    }
  }

  /** Éclaboussure de sang — retombe et s'immobilise. */
  blood(x: number, y: number, n = 5, color: string = P.blood): void {
    for (let i = 0; i < n; i++) {
      const a = fxRng.angle();
      const s = fxRng.range(20, 95);
      const p = this.spawn(PKind.Blood, x, y, Math.cos(a) * s, Math.sin(a) * s, fxRng.range(0.3, 0.65), color, fxRng.range(1, 2.4), 2);
      if (p) {
        p.gravity = 130;
        p.drag = 0.93;
      }
    }
  }

  /** Poussière au sol — priorité minimale, première sacrifiée quand ça sature. */
  dust(x: number, y: number, n = 3): void {
    for (let i = 0; i < n; i++) {
      const a = fxRng.angle();
      this.spawn(PKind.Dust, x, y, Math.cos(a) * fxRng.range(4, 16), Math.sin(a) * fxRng.range(2, 8), fxRng.range(0.25, 0.5), P.stoneHi, fxRng.range(1, 2), 0);
    }
  }

  /** Anneau qui s'étend — nova, montée de niveau, onde de choc. */
  ring(x: number, y: number, radius: number, color: string, life = 0.4, thickness = 1.5): void {
    const p = this.spawn(PKind.Ring, x, y, 0, 0, life, color, thickness, 3);
    if (p) p.scale = radius;
  }

  /** Chiffre de dégâts flottant. */
  number(x: number, y: number, value: number, crit: boolean, color?: string): void {
    const p = this.spawn(
      PKind.Number,
      x + fxRng.spread(2),
      y,
      fxRng.spread(14),
      -34,
      crit ? 0.8 : 0.55,
      color ?? (crit ? P.gold : P.linen),
      1,
      crit ? 3 : 1,
    );
    if (!p) return;
    p.text = String(Math.max(1, Math.round(value)));
    p.scale = crit ? 2 : 1;
    p.gravity = 46;
  }

  /** Texte libre flottant (soins, or, « ÉVOLUTION »). */
  label(x: number, y: number, text: string, color: string, scale = 1): void {
    const p = this.spawn(PKind.Number, x, y, 0, -22, 0.95, color, 1, 3);
    if (!p) return;
    p.text = text;
    p.scale = scale;
    p.gravity = 18;
  }

  /** Braise qui monte — feu, magie, aura. */
  ember(x: number, y: number, color: string = P.fire, n = 2): void {
    for (let i = 0; i < n; i++) {
      const p = this.spawn(PKind.Ember, x + fxRng.spread(3), y + fxRng.spread(3), fxRng.spread(9), fxRng.range(-30, -12), fxRng.range(0.3, 0.7), color, fxRng.range(1, 2), 1);
      if (p) p.drag = 0.96;
    }
  }

  /** Éclat pixel qui tourne — mort d'ennemi, bris. */
  shards(x: number, y: number, n: number, color: string): void {
    for (let i = 0; i < n; i++) {
      const a = fxRng.angle();
      const s = fxRng.range(30, 90);
      const p = this.spawn(PKind.Shard, x, y, Math.cos(a) * s, Math.sin(a) * s, fxRng.range(0.3, 0.6), color, fxRng.range(1.4, 2.6), 2);
      if (p) {
        p.gravity = 90;
        p.drag = 0.9;
        p.rot = fxRng.spread(12);
      }
    }
  }

  /** Colonne de lumière verticale — relique, montée de niveau. */
  beam(x: number, y: number, color: string, life = 0.9): void {
    const p = this.spawn(PKind.Beam, x, y, 0, 0, life, color, 5, 3);
    if (p) p.scale = 1;
  }

  // ------------------------------------------------------------------- update

  update(dt: number): void {
    const pool = this.pool;
    let live = 0;
    for (let i = 0; i < MAX; i++) {
      const p = pool[i]!;
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      live++;
      if (p.kind === PKind.Ring || p.kind === PKind.Beam) continue; // statiques
      p.vy += p.gravity * dt;
      if (p.drag !== 1) {
        const d = Math.pow(p.drag, dt * 60);
        p.vx *= d;
        p.vy *= d;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.liveCount = live;
  }

  // ------------------------------------------------------------------- render

  render(ctx: CanvasRenderingContext2D, cam: Camera): void {
    const ox = cam.offsetX;
    const oy = cam.offsetY;
    const pool = this.pool;

    for (let i = 0; i < MAX; i++) {
      const p = pool[i]!;
      if (!p.active) continue;
      const sx = p.x + ox;
      const sy = p.y + oy;
      if (sx < -40 || sy < -40 || sx > cam.viewW + 40 || sy > cam.viewH + 40) continue;

      const t = clamp01(p.life / p.maxLife);

      switch (p.kind) {
        case PKind.Number: {
          const rise = (1 - t) * 3;
          ctx.globalAlpha = t > 0.35 ? 1 : t / 0.35;
          font.drawCentered(ctx, p.text, Math.round(sx), Math.round(sy - rise), p.color, p.scale);
          ctx.globalAlpha = 1;
          break;
        }
        case PKind.Ring: {
          const r = p.scale * easeOutCubic(1 - t);
          ctx.globalAlpha = t * 0.9;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.arc(Math.round(sx), Math.round(sy), Math.max(0.5, r), 0, TAU);
          ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case PKind.Beam: {
          const w = p.size * (t > 0.7 ? (1 - t) / 0.3 : t / 0.7);
          ctx.globalAlpha = t * 0.75;
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.round(sx - w / 2), Math.round(sy - 60), Math.max(1, w), 62);
          ctx.globalAlpha = 1;
          break;
        }
        case PKind.Shard: {
          ctx.globalAlpha = t;
          ctx.fillStyle = p.color;
          const s = p.size;
          ctx.fillRect(Math.round(sx), Math.round(sy), s, s);
          ctx.globalAlpha = 1;
          break;
        }
        default: {
          // Spark / Blood / Dust / Ember : un simple carré, la particule rétrécit en mourant.
          const s = Math.max(1, p.size * (p.kind === PKind.Blood ? 1 : t));
          ctx.globalAlpha = p.kind === PKind.Dust ? t * 0.6 : t;
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.round(sx - s / 2), Math.round(sy - s / 2), Math.ceil(s), Math.ceil(s));
          ctx.globalAlpha = 1;
        }
      }
    }
  }
}
