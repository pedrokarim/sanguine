import { clamp01, lerp, TAU } from '../core/math';
import { fxRng } from '../core/rng';
import type { ShrineType } from '../game/siteplan';
import type { Camera } from './camera';
import type { Aura, TrailStyle } from './cosmeticfx';
import { fxSettings } from './fx';
import { bake, drainFrameBudget, rush } from './vfxbake';
import type { Atlas, Spec } from './vfxbake';
import {
  auraSpec, beamSpec, blastSpec, critSpecs, deathSpecs, directionOf, graveBurstSpecs, heroAuraSpec, shrineFocusSpec, HIT_HEIGHT, hitSpecs, landingSpec, manaBurstSpec,
  mirrorBurstSpec, prepareWeapon, scytheSpec, shockRingSpec, spikeSet, strikeSpec, trailSpec, zapSpec, zoneSpec,
} from './vfxrecipes';
import type { Flight, ZoneKind } from './vfxrecipes';

export { flightOf, zoneKindOf } from './vfxrecipes';

/**
 * Joue les effets pré-rendus (voir `vfxbake.ts`) : ceux qui durent un instant vivent ici, ce
 * qui dure autant que son projectile ou sa zone est dessiné à sa demande par le rendu.
 */

/** Ce qu'un effet peut suivre : le joueur, ou tout ce qui a une position interpolée. */
export interface Anchor {
  x: number;
  y: number;
  px: number;
  py: number;
}

interface Instance {
  spec: Spec;
  x: number;
  y: number;
  anchor: Anchor | null;
  t: number;
  priority: number;
}

const MAX_INSTANCES = 480;
/** Sous le centre du héros, là où se posait déjà ce qui touche le sol. */
const HERO_GROUND = 7;

const PRIORITY_HIT = 1;
const PRIORITY_DEATH = 2;
const PRIORITY_WEAPON = 3;

/** Un atlas pas encore peint emprunte celui d'une direction voisine, sans figer la partie. */
function atlasOfFlight(flight: Flight, spec: Spec): Atlas {
  if (spec.atlas) return spec.atlas;
  for (const s of flight.specs) if (s.atlas) return s.atlas;
  return bake(spec);
}

export class Vfx {
  private readonly pool: Instance[] = [];
  private live = 0;

  constructor() {
    for (let i = 0; i < MAX_INSTANCES; i++) {
      this.pool.push({ spec: mirrorBurstSpec, x: 0, y: 0, anchor: null, t: 0, priority: 0 });
    }
  }

  get count(): number {
    return this.live;
  }

  clear(): void {
    this.live = 0;
  }

  private play(spec: Spec, x: number, y: number, anchor: Anchor | null, priority: number): void {
    let slot: Instance | undefined;
    if (this.live < MAX_INSTANCES) {
      slot = this.pool[this.live++];
    } else {
      // Pool plein : un coup de plus ne vaut pas qu'on efface quoi que ce soit.
      if (priority === PRIORITY_HIT) return;
      slot = this.pool.find((a) => a.priority < priority);
      if (!slot) return;
    }
    slot = slot!;
    slot.spec = spec;
    slot.x = x;
    slot.y = y;
    slot.anchor = anchor;
    slot.t = 0;
    slot.priority = priority;
  }

  /** `angle` : sens du coup, sur le sol. */
  hit(x: number, y: number, angle: number): void {
    if (!fxRng.chance(fxSettings.particles)) return;
    const seed = fxRng.chance(0.5) ? 0 : 1;
    this.play(hitSpecs[directionOf(angle) * 2 + seed]!, x, y + HIT_HEIGHT, null, PRIORITY_HIT);
  }

  crit(x: number, y: number, angle: number): void {
    this.play(critSpecs[directionOf(angle)]!, x, y + HIT_HEIGHT, null, PRIORITY_HIT);
  }

  /** `tier` : 0 ennemi courant, 1 élite, 2 boss. */
  death(x: number, y: number, radius: number, tier: 0 | 1 | 2): void {
    const set = deathSpecs[tier]!;
    this.play(set[Math.floor(fxRng.range(0, set.length))]!, x, y + radius, null, PRIORITY_DEATH);
  }

  /** Le coup suit son porteur : sans cela, le héros sort de son propre arc en marchant. */
  scythe(anchor: Anchor, angle: number, reach: number, full: boolean, weaponId: string): void {
    this.play(scytheSpec(directionOf(angle), reach, full, weaponId), 0, HERO_GROUND, anchor, PRIORITY_WEAPON);
  }

  mirrorBurst(anchor: Anchor): void {
    this.play(mirrorBurstSpec, 0, HERO_GROUND, anchor, PRIORITY_WEAPON);
  }

  shockRing(anchor: Anchor, radius: number): void {
    this.play(shockRingSpec(radius), 0, HERO_GROUND, anchor, PRIORITY_WEAPON);
  }

  freeNova(anchor: Anchor): void {
    this.play(manaBurstSpec, 0, HERO_GROUND, anchor, PRIORITY_WEAPON);
  }

  strike(x: number, y: number, weaponId: string): void {
    this.play(strikeSpec(weaponId), x, y + HIT_HEIGHT, null, PRIORITY_WEAPON);
  }

  spike(x: number, y: number, weaponId: string): void {
    const set = spikeSet(weaponId);
    this.play(set[Math.floor(fxRng.range(0, set.length))]!, x, y + 4, null, PRIORITY_DEATH);
  }

  zap(x: number, y: number): void {
    this.play(zapSpec, x, y + HIT_HEIGHT, null, PRIORITY_DEATH);
  }

  /** La terre s'ouvre sur une tombe. */
  graveBurst(x: number, y: number): void {
    this.play(graveBurstSpecs[Math.floor(fxRng.range(0, graveBurstSpecs.length))]!, x, y, null, PRIORITY_WEAPON);
  }

  /** Ce qui brûle sur une structure. Pas encore peint : il apparaîtra à l'image suivante. */
  drawShrineFocus(ctx: CanvasRenderingContext2D, light: CanvasRenderingContext2D, type: ShrineType, x: number, y: number, time: number): void {
    const spec = shrineFocusSpec(type);
    if (!spec.atlas) {
      rush(spec);
      return;
    }
    this.loopCell(ctx, light, spec.atlas, spec, x, y, time);
  }

  landing(x: number, y: number): void {
    this.play(landingSpec, x, y, null, PRIORITY_DEATH);
  }

  blast(x: number, y: number, radius: number, blood: boolean): void {
    this.play(blastSpec(radius, blood), x, y, null, PRIORITY_WEAPON);
  }

  /** `anchor` : le pilier reste sur son porteur, sinon sur le lieu qui l'a déclenché. */
  beam(x: number, y: number, color: string, anchor: Anchor | null = null): void {
    this.play(beamSpec(color), anchor ? 0 : x, anchor ? HERO_GROUND : y, anchor, PRIORITY_WEAPON);
  }

  /** Un pas de traînée cosmétique : priorité minimale, il ne doit rien coûter à la partie. */
  trail(style: TrailStyle, color: string, x: number, y: number): void {
    this.play(trailSpec(style, color, Math.floor(fxRng.range(0, 3))), x, y, null, 0);
  }

  prepareWeapon(weaponId: string, behavior: string): void {
    prepareWeapon(weaponId, behavior);
  }

  /** Lance le pré-rendu d'une portée de mêlée, sans rien jouer. */
  prepareScythe(reach: number, full: boolean, weaponId: string): void {
    scytheSpec(0, reach, full, weaponId);
  }

  update(dt: number): void {
    for (let i = this.live - 1; i >= 0; i--) {
      const a = this.pool[i]!;
      a.t += dt;
      if (a.t < a.spec.life) continue;
      // Échange avec le dernier : le pool reste compact, sans allocation.
      const end = this.pool[--this.live]!;
      this.pool[i] = end;
      this.pool[this.live] = a;
    }
  }

  private cell(ctx: CanvasRenderingContext2D, image: HTMLCanvasElement, s: Atlas, index: number, x: number, y: number): void {
    ctx.drawImage(
      image,
      (index % s.cols) * s.cellW, Math.floor(index / s.cols) * s.cellH, s.cellW, s.cellH,
      x - s.anchorX, y - s.anchorY, s.cellW, s.cellH,
    );
  }

  /** Ce qui passe derrière les personnages : la moitié lointaine d'une faux, par exemple. */
  renderBack(ctx: CanvasRenderingContext2D, cam: Camera, alpha: number): void {
    drainFrameBudget();
    const ox = cam.offsetX;
    const oy = cam.offsetY;
    for (let i = 0; i < this.live; i++) {
      const a = this.pool[i]!;
      const s = a.spec.atlas ?? bake(a.spec);
      const index = Math.floor(a.t * a.spec.fps);
      if (!s.back || index >= s.frames) continue;
      this.cell(ctx, s.back, s, index, this.screenX(a, ox, alpha), this.screenY(a, oy, alpha));
    }
  }

  /** Ce qui passe devant, et toute la lumière. */
  renderFront(ctx: CanvasRenderingContext2D, light: CanvasRenderingContext2D, cam: Camera, alpha: number, comfort: number): void {
    const ox = cam.offsetX;
    const oy = cam.offsetY;
    const VW = cam.viewW;
    const VH = cam.viewH;
    light.imageSmoothingEnabled = false;
    light.globalAlpha = clamp01(fxSettings.light * comfort);
    for (let i = 0; i < this.live; i++) {
      const a = this.pool[i]!;
      const s = a.spec.atlas ?? bake(a.spec);
      const index = Math.floor(a.t * a.spec.fps);
      if (index >= s.frames) continue;
      const x = this.screenX(a, ox, alpha);
      const y = this.screenY(a, oy, alpha);
      const left = x - s.anchorX;
      const top = y - s.anchorY;
      if (left > VW || top > VH || left + s.cellW < 0 || top + s.cellH < 0) continue;
      if (s.front) this.cell(ctx, s.front, s, index, x, y);
      if (s.light) this.cell(light, s.light, s, index, x, y);
    }
    light.globalAlpha = 1;
    light.imageSmoothingEnabled = true;
  }

  private loopCell(ctx: CanvasRenderingContext2D, light: CanvasRenderingContext2D, s: Atlas, spec: Spec, x: number, y: number, time: number): void {
    const index = Math.floor(time * spec.fps * spec.speed) % s.frames;
    const sx = Math.round(x);
    const sy = Math.round(y);
    if (s.back) this.cell(ctx, s.back, s, index, sx, sy);
    if (s.front) this.cell(ctx, s.front, s, index, sx, sy);
    if (s.light) {
      const smooth = light.imageSmoothingEnabled;
      light.imageSmoothingEnabled = false;
      this.cell(light, s.light, s, index, sx, sy);
      light.imageSmoothingEnabled = smooth;
    }
  }

  /** Un projectile en vol, dans le sens de sa trajectoire. */
  drawFlight(ctx: CanvasRenderingContext2D, light: CanvasRenderingContext2D, flight: Flight, x: number, y: number, angle: number, time: number): void {
    const facing = flight.directions === 2 ? (Math.cos(angle) < 0 ? 1 : 0) : flight.directions === 1 ? 0 : directionOf(angle, flight.directions);
    const spec = flight.specs[facing]!;
    this.loopCell(ctx, light, atlasOfFlight(flight, spec), spec, x - Math.cos(angle) * flight.back, y - Math.sin(angle) * flight.back, time);
  }

  /** Une zone au sol. `fade` couvre son apparition et son extinction. */
  drawZone(ctx: CanvasRenderingContext2D, light: CanvasRenderingContext2D, kind: ZoneKind, x: number, y: number, radius: number, time: number, fade: number): void {
    const spec = zoneSpec(kind, radius);
    // Pas encore peinte : la zone apparaît en fondu, attendre un instant ne se voit pas.
    if (!spec.atlas) {
      rush(spec);
      return;
    }
    ctx.globalAlpha = fade;
    light.globalAlpha = fade * clamp01(fxSettings.sigils);
    this.loopCell(ctx, light, spec.atlas, spec, x, y, time);
    ctx.globalAlpha = 1;
    light.globalAlpha = 1;
  }

  drawAura(ctx: CanvasRenderingContext2D, light: CanvasRenderingContext2D, x: number, y: number, radius: number, time: number): void {
    const spec = auraSpec(radius);
    if (!spec.atlas) {
      rush(spec);
      return;
    }
    // Moins de lumière que les autres effets : le héros se tient en plein dedans.
    light.globalAlpha = 0.5;
    this.loopCell(ctx, light, spec.atlas, spec, x, y, time);
    light.globalAlpha = 1;
  }

  /** Aura d'une teinte, sous les pieds. La boutique passe par la même fonction que la partie. */
  drawHeroAura(ctx: CanvasRenderingContext2D, light: CanvasRenderingContext2D, aura: Aura, x: number, y: number, time: number): void {
    const spec = heroAuraSpec(aura.color, aura.tier);
    this.loopCell(ctx, light, spec.atlas ?? bake(spec), spec, x, y, time);
  }

  private screenX(a: Instance, ox: number, alpha: number): number {
    const base = a.anchor ? lerp(a.anchor.px, a.anchor.x, alpha) : 0;
    return Math.round(base + a.x + ox);
  }

  private screenY(a: Instance, oy: number, alpha: number): number {
    const base = a.anchor ? lerp(a.anchor.py, a.anchor.y, alpha) : 0;
    return Math.round(base + a.y + oy);
  }
}

/** Sens de déplacement d'un projectile à l'écran, y compris sur une orbite. */
export function headingOf(x: number, y: number, px: number, py: number, fallback: number): number {
  const dx = x - px;
  const dy = y - py;
  return dx === 0 && dy === 0 ? fallback : Math.atan2(dy, dx) % TAU;
}
