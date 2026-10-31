/** Types de la surface de pixelfx utilisée par le jeu. Le moteur reste en JavaScript. */

export interface FxFrame {
  readonly w: number;
  readonly h: number;
  readonly color: Uint32Array;
  readonly light: Uint32Array;
}

export interface FxMeta {
  readonly size: readonly [number, number];
  readonly origin: readonly [number, number];
  readonly duration: number;
}

export interface FxModule {
  readonly meta: FxMeta;
}

export interface FxInstance {
  update(dt: number): void;
  draw(frame: FxFrame, layer: 'back' | 'front'): void;
}

export function createFrame(w: number, h: number): FxFrame;
export function clearFrame(frame: FxFrame): FxFrame;
export function createFx(mod: FxModule, options?: Record<string, unknown>): FxInstance;
/** `bg` nul : la lumière devient de la couleur sur fond transparent. */
export function composite(frame: FxFrame, out: Uint8ClampedArray, bg: null): Uint8ClampedArray;

export type CritterId = 'bat' | 'bird' | 'eyeball' | 'flyingSkull' | 'frog' | 'ghost' | 'jellyfish' | 'slime' | 'snake' | 'wisp';

export const effects: Readonly<Record<
  | 'hit' | 'crit' | 'bloodBurst' | 'scytheArc' | 'mirrorBurst' | 'mirrorShard' | 'emberPatch' | 'saltCrust'
  | 'spinningCross' | 'thrownDagger' | 'flailHead' | 'thornSpike' | 'shockRing' | 'shockFront' | 'arrow' | 'fireball'
  | 'sunburst' | 'holyPillar' | 'arcaneOrb' | 'ghost' | 'waterOrb' | 'whirlpool' | 'splash' | 'lightningStrike' | 'zapHit' | 'smite' | 'darkExplosion'
  | 'heroAura' | 'trailStep' | 'skillLife' | 'judgementBolt' | 'paintedFlight' | 'incenseCloud' | 'graveBurst' | 'millSails' | 'campfire' | 'spiritFlame' | 'smallExplosion' | 'manaBurst' | 'runeCircle' | 'frostBreath' | CritterId,
  FxModule
>>;
