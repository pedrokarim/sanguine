import { TAU } from '../core/math';
import { effects } from '../../vendor/pixelfx/src/sanguine.js';
import type { FxModule } from '../../vendor/pixelfx/src/sanguine.js';
import type { ShrineType } from '../game/siteplan';
import type { TrailStyle } from './cosmeticfx';
import { P } from './palette';
import { ART_COLORS, WEAPON_ART } from './skillart';
import { enqueue, specOf } from './vfxbake';
import type { Spec, Tuning } from './vfxbake';

/**
 * Le visuel de chaque compétence.
 *
 * Tout ce tableau suit la même règle : l'effet vient de la bibliothèque pixelfx quand elle en
 * a un équivalent, repeint à l'échelle des sprites (`zoom`), accéléré (`speed`) et recoloré.
 * Sinon il est recréé dans `vendor/pixelfx/src/fx/sanguine/` avec les mêmes briques.
 */

/** Hauteur de l'impact au-dessus du sol, reprise par les effets de coup. */
export const HIT_HEIGHT = 6;
/** Assez pour un coup, bref ou large : l'écart reste sous les 23°. */
export const DIRECTIONS = 8;
/** Un projectile long montre sa direction : il lui faut le double. */
export const FLIGHT_DIRECTIONS = 16;
/** Pas des rayons pré-rendus : assez fin pour que la portée reste celle de l'arme. */
const RADIUS_STEP = 6;

const GOLD = ['#3a2412', '#7a4a1c', '#b87a2a', '#e0a848', '#f2c46b', '#ffe59a', '#fff3c4', '#ffffff'];
const BLOOD = ['#14040a', '#3a0a14', '#6a101c', '#8b1a2b', '#c42639', '#f0405a', '#ff9a8a', '#ffffff'];
const HARVEST = ['#14040a', '#2c0812', '#4e0e1c', '#8b1a2b', '#c42639', '#f0405a', '#ffc2b8', '#ffffff'];
const POISON = ['#0a1a10', '#123a1c', '#1f6a2c', '#3aa040', '#8ef07a', '#c8f8a0', '#eaffd0', '#ffffff'];
const STEEL = ['#0b0d14', '#232b40', '#3a4660', '#5a6a86', '#8498b0', '#a8c5d6', '#e4f4fa', '#ffffff'];
const COPPER = ['#2c1408', '#54260e', '#8a4418', '#c9702a', '#e89a3c', '#f2c46b', '#fff0c4'];

const aimsOf = (count: number): number[] => Array.from({ length: count }, (_, i) => (i / count) * TAU);
export const aims = aimsOf(DIRECTIONS);

export function directionOf(angle: number, count = DIRECTIONS): number {
  return Math.round((angle / TAU) * count) & (count - 1);
}

// -------------------------------------------------------------- effets ponctuels

/** Deux graines par direction : à cadence de horde, une seule se reconnaîtrait. */
export const hitSpecs = aims.flatMap((aim) => [4, 9].map((seed) => specOf(effects.hit, { aim, seed, height: HIT_HEIGHT })));
export const critSpecs = aims.map((aim) => specOf(effects.crit, { aim, seed: 4, height: HIT_HEIGHT }));
export const deathSpecs = [
  [6, 11, 23].map((seed) => specOf(effects.bloodBurst, { seed })),
  [6, 11].map((seed) => specOf(effects.bloodBurst, { seed, scale: 1.5 }, { zoom: 1 })).map(sized(1.5)),
  [6].map((seed) => specOf(effects.bloodBurst, { seed, scale: 2.6 }, { zoom: 1 })).map(sized(2.6)),
];

/** `bloodBurst` grandit par son option `scale`, qui élargit la gerbe : le cadre doit suivre. */
function sized(k: number): (spec: Spec) => Spec {
  return (spec) => {
    spec.size = [Math.ceil(spec.size[0] * k), Math.ceil(spec.size[1] * k)];
    spec.origin = [Math.ceil(spec.origin[0] * k), Math.ceil(spec.origin[1] * k)];
    return spec;
  };
}

export const mirrorBurstSpec = specOf(effects.mirrorBurst, {});
export const zapSpec = specOf(effects.zapHit, {}, { zoom: 0.42, speed: 1.6 });
export const landingSpec = specOf(effects.splash, {}, { zoom: 0.36, speed: 2, skip: 0.2 });
export const manaBurstSpec = specOf(effects.manaBurst, {}, { zoom: 0.55, speed: 1.5, skip: 0.45 });

const channel = (color: string, at: number): number => parseInt(color.slice(at, at + 2), 16);

/** Rampe du noir au blanc en passant par `color` : la lib attend une palette, le jeu a une teinte. */
function rampOf(color: string): string[] {
  const hex = (v: number): string => Math.round(v).toString(16).padStart(2, '0');
  const rgb = [1, 3, 5].map((at) => channel(color, at));
  return [0.14, 0.3, 0.5, 0.74, 1, 1.25, 1.55, 2].map((k) => {
    const mixed = rgb.map((v) => (k <= 1 ? v * k : v + (255 - v) * (k - 1)));
    return `#${mixed.map(hex).join('')}`;
  });
}

const strikeSpecs: Record<string, Spec> = {
  judgement: specOf(effects.judgementBolt, {}),
  wrath: specOf(effects.judgementBolt, { thick: 2.7, swing: 32, reach: 42, forks: 2, halo: '#ffb040', seed: 8 }),
};
export const strikeSpec = (weaponId: string): Spec => strikeSpecs[weaponId] ?? strikeSpecs.judgement!;

const spikeSpecs: Record<string, Spec[]> = {
  thorns: [5, 8].map((seed) => specOf(effects.thornSpike, { seed }, { zoom: 0.72 })),
  irongarden: [5, 8].map((seed) => specOf(effects.thornSpike, { seed, palette: STEEL, dust: '#3a4660' }, { zoom: 0.9 })),
};
export const spikeSet = (weaponId: string): Spec[] => spikeSpecs[weaponId] ?? spikeSpecs.thorns!;

/** Les effets à portée variable sont peints par paliers, à la demande. */
const sizedSpecs = new Map<string, Spec>();

function bucketOf(radius: number): number {
  return Math.max(RADIUS_STEP, Math.round(radius / RADIUS_STEP) * RADIUS_STEP);
}

function sizedSpec(key: string, create: () => Spec): Spec {
  let spec = sizedSpecs.get(key);
  if (!spec) {
    spec = create();
    sizedSpecs.set(key, spec);
    enqueue(spec);
  }
  return spec;
}

export function blastSpec(radius: number, blood: boolean): Spec {
  const r = bucketOf(radius);
  return blood
    ? sizedSpec(`blood-blast/${r}`, () => specOf(effects.darkExplosion, { palette: BLOOD }, { zoom: r / 92, speed: 1.8, skip: 0.45, fps: 20 }))
    : sizedSpec(`blast/${r}`, () => specOf(effects.smallExplosion, {}, { zoom: r / 92, speed: 3, fps: 12 }));
}

/** Pilier de lumière : montée de niveau, relique, évolution, lieu activé. */
export function beamSpec(color: string): Spec {
  return sizedSpec(`beam/${color}`, () => specOf(effects.holyPillar, { palette: rampOf(color), light: 0.6 }, { zoom: 0.34, speed: 2.4, fps: 20 }));
}

const TRAIL_STYLES: readonly TrailStyle[] = ['ash', 'frost', 'ember', 'gold', 'void'];

/** Un pas de traînée. Trois graines : des empreintes identiques dessineraient un motif. */
export function trailSpec(style: TrailStyle, color: string, seed: number): Spec {
  return sizedSpec(`trail/${style}/${color}/${seed}`, () => specOf(effects.trailStep, { palette: rampOf(color), style: TRAIL_STYLES.indexOf(style), seed: seed * 7 + 3 }, { fps: 15 }));
}

export function heroAuraSpec(color: string, rank: number): Spec {
  return sizedSpec(`hero-aura/${color}/${rank}`, () => specOf(effects.heroAura, { palette: rampOf(color), rank }, { loop: true, fps: 10 }));
}

export function shockRingSpec(radius: number): Spec {
  const r = bucketOf(radius);
  return sizedSpec(`shock/${r}`, () => {
    const spec = specOf(effects.shockRing, { reach: r });
    const flat = Math.ceil(r * 0.72);
    spec.size = [r * 2 + 40, flat * 2 + 56];
    spec.origin = [r + 20, flat + 34];
    return spec;
  });
}

function scytheVariant(weaponId: string, direction: number, r: number, full: boolean): Spec {
  return sizedSpec(`${weaponId}/${direction}/${r}`, () => {
    const options: Record<string, unknown> = { aim: aims[direction], reach: r, width: Math.min(16, Math.max(9, r * 0.22)), span: full ? TAU : 2.3 };
    if (weaponId === 'harvest') options.palette = HARVEST;
    const spec = specOf(effects.scytheArc, options);
    const flat = Math.ceil(r * 0.72);
    spec.size = [r * 2 + 28, flat * 2 + 44];
    spec.origin = [r + 14, flat + 30];
    return spec;
  });
}

/** Une nouvelle portée met aussitôt toutes ses directions en file. */
export function scytheSpec(direction: number, reach: number, full: boolean, weaponId: string): Spec {
  const r = bucketOf(reach);
  if (full) return scytheVariant(weaponId, 0, r, true);
  for (const d of aims.keys()) scytheVariant(weaponId, d, r, false);
  return scytheVariant(weaponId, direction, r, false);
}

// ------------------------------------------------------------------ projectiles

export interface Flight {
  specs: Spec[];
  /** 1 : l'effet tourne sur lui-même. 2 : gauche et droite. 16 : toutes les directions. */
  directions: number;
  /** Recul de l'effet sur sa trajectoire : un souffle part de derrière son point de frappe. */
  back: number;
}

function turning(mod: FxModule, options: Record<string, unknown>, tuning: Tuning, directions = FLIGHT_DIRECTIONS, back = 0): Flight {
  return { specs: aimsOf(directions).map((angle) => specOf(mod, options, { fps: 12, loop: true, ...tuning, angle: angle || 1e-4 })), directions, back };
}

function spinning(mod: FxModule, options: Record<string, unknown>, tuning: Tuning = {}): Flight {
  return { specs: [specOf(mod, options, { loop: true, ...tuning })], directions: 1, back: 0 };
}

function facing(mod: FxModule, options: Record<string, unknown>, tuning: Tuning): Flight {
  return { specs: [false, true].map((flip) => specOf(mod, options, { fps: 12, loop: true, ...tuning, flip })), directions: 2, back: 0 };
}

function aimedFront(palette?: string[]): Flight {
  return {
    specs: aimsOf(FLIGHT_DIRECTIONS).map((aim) => specOf(effects.shockFront, palette ? { aim, palette, reach: 36 } : { aim, reach: 36 }, { loop: true, fps: 15 })),
    directions: FLIGHT_DIRECTIONS,
    back: 0,
  };
}

/** Le dessin de la carte, en vol : le joueur reconnaît ce qu'il vient de choisir. */
function thrown(artId: string, options: Record<string, unknown>): Flight {
  const painted = { rows: WEAPON_ART[artId], colors: ART_COLORS, ...options };
  return { specs: [specOf(effects.paintedFlight, painted, { loop: true })], directions: 1, back: 0 };
}

/** Un objet qui part pointe devant : dessiné à 45°, il est repeint dans chaque direction. */
function pointed(artId: string, options: Record<string, unknown>): Flight {
  const painted = { rows: WEAPON_ART[artId], colors: ART_COLORS, base: -TAU / 8, ...options };
  return {
    specs: aimsOf(FLIGHT_DIRECTIONS).map((heading) => specOf(effects.paintedFlight, { ...painted, heading }, { loop: true })),
    directions: FLIGHT_DIRECTIONS,
    back: 0,
  };
}

/** Un objet vivant : `skillLife` fait danser ses flammes pendant qu'il tourne autour du héros. */
function living(artId: string, life: string, zoom: number): Flight {
  return spinning(effects.skillLife, { rows: WEAPON_ART[artId], colors: ART_COLORS, life, seed: 3 }, { zoom });
}

const GILDED_TIP = { ...ART_COLORS, N: ART_COLORS.Y!, n: ART_COLORS.y! };

const FLIGHTS: Record<string, Flight> = {
  stake: pointed('stake', { scale: 0.8, wake: '#e0b474' }),
  carpenter: pointed('stake', { scale: 0.95, colors: GILDED_TIP, wake: '#f6c63e' }),
  crossbow: turning(effects.arrow, { palette: ['#232b40', '#5a6a86', '#a8c5d6', '#ffffff'], wood: STEEL.slice(1, 5) }, { zoom: 1 }),
  ballista: turning(effects.arrow, { palette: ['#7a4a1c', '#e0a848', '#fff3c4', '#ffffff'], wood: GOLD.slice(1, 5), steel: GOLD.slice(3, 7) }, { zoom: 1.25 }),
  cross: thrown('cross', { scale: 0.75, spin: 1, wake: '#fff2a8', glow: '#f6c63e' }),
  crucifixion: thrown('crucifixion', { scale: 0.85, spin: 0.5, wake: '#fff2a8', glow: '#f6c63e' }),
  ricochet: thrown('ricochet', { scale: 0.8, spin: 2, base: -TAU / 8, wake: '#c8f4ff' }),
  bladedance: thrown('ricochet', { scale: 0.9, spin: 2, base: -TAU / 8, wake: '#f6c63e', glow: '#f6c63e' }),
  mirror: turning(effects.mirrorShard, {}, { fps: 10, zoom: 1.8 }),
  kaleidoscope: turning(effects.mirrorShard, {}, { fps: 10, zoom: 2.1 }),
  lantern: living('lantern', 'flame', 0.8),
  souls: living('souls', 'soul', 0.75),
  water: thrown('water', { scale: 0.7, spin: 0.5, wake: '#5ab8f6' }),
  deluge: thrown('water', { scale: 0.85, spin: 0.5, wake: '#5ab8f6' }),
  flail: spinning(effects.flailHead, { size: 8, palette: ['#0e0c14', '#2a2e46', '#4c5474', '#8f9bb6', '#b8c2d6', '#dbe2f0', '#ffffff'] }),
  comet: turning(effects.fireball, {}, { zoom: 0.5 }),
  familiar: facing(effects.bat, { palette: ['#1c0a33', '#4c2288', '#7a34c0', '#9846e0', '#c07cf4', '#e0b0ff', '#ffffff'] }, { zoom: 0.85 }),
  swarm: facing(effects.bat, { palette: BLOOD.slice(0, 7) }, { zoom: 0.85 }),
  censer: spinning(effects.incenseCloud, {}),
  horn: aimedFront(),
  packcall: aimedFront(['#3a1408', '#7a2c10', '#c0561c', '#f2803c', '#ffb46b', '#fff0c4', '#ffffff']),
};

/** Les loups de l'Appel de la Meute sortent de la même arme que son onde. */
const SPIRIT_WOLF = facing(effects.ghost, { palette: COPPER }, { zoom: 0.45 });

export function flightOf(weaponId: string, behavior: string): Flight | undefined {
  if (behavior === 'pet' && weaponId === 'packcall') return SPIRIT_WOLF;
  return FLIGHTS[weaponId];
}

// --------------------------------------------------------------- zones et auras

export type ZoneKind = 'embers' | 'water' | 'salt';

/** Une zone ne porte que sa couleur : c'est elle qui dit de quelle compétence elle vient. */
export function zoneKindOf(color: string): ZoneKind {
  if (color === P.ice) return 'water';
  if (color === P.linen) return 'salt';
  return 'embers';
}

export function zoneSpec(kind: ZoneKind, radius: number): Spec {
  const r = bucketOf(radius);
  return sizedSpec(`zone/${kind}/${r}`, () => {
    switch (kind) {
      case 'water': return specOf(effects.whirlpool, {}, { zoom: r / 52, loop: true, fps: 12 });
      case 'salt': return specOf(effects.saltCrust, {}, { zoom: r / 13, loop: true, fps: 10 });
      case 'embers': return specOf(effects.emberPatch, {}, { zoom: r / 40, loop: true, fps: 12 });
    }
  });
}

export function auraSpec(radius: number): Spec {
  const r = bucketOf(radius);
  return sizedSpec(`aura/${r}`, () => specOf(effects.runeCircle, { palette: POISON }, { zoom: r / 46, loop: true, fps: 8 }));
}

// ---------------------------------------------------------------- structures

const ICE_RAMP = ['#06141c', '#0c2c3c', '#16506a', '#2f7fa8', '#58b8e0', '#7ee8ff', '#e6fbff', '#ffffff'];
const VIOLET_RAMP = ['#14062a', '#2c1250', '#44209a', '#7a34c0', '#a855f7', '#c890ff', '#e2c2ff', '#ffffff'];
const GOLD_WATER = ['#1c1006', '#3a2412', '#7a4a1c', '#b87a2a', '#e0a848', '#f2c46b', '#fff3c4', '#ffffff'];
const SPECTRE = ['#06161a', '#0c3a34', '#14604e', '#2ca878', '#3cff9a', '#9cffc8', '#e6fff2', '#ffffff'];

/** Ce qui vit sur une structure tant qu'elle n'est pas épuisée. Peint une fois, à la demande. */
const SHRINE_FOCUS: Readonly<Record<ShrineType, () => Spec>> = {
  altar: () => specOf(effects.arcaneOrb, { palette: VIOLET_RAMP, hover: true }, { zoom: 0.55, fps: 12, loop: true }),
  pyre: () => specOf(effects.campfire, { height: 84 }, { fps: 12, loop: true }),
  obelisk: () => specOf(effects.runeCircle, { palette: ICE_RAMP }, { zoom: 1.5, fps: 8, loop: true }),
  well: () => specOf(effects.whirlpool, { palette: GOLD_WATER }, { zoom: 0.4, fps: 10, loop: true }),
  ossuary: () => specOf(effects.spiritFlame, { palette: SPECTRE }, { zoom: 0.5, fps: 12, loop: true }),
  chapel: () => specOf(effects.spiritFlame, { palette: GOLD }, { zoom: 0.4, fps: 12, loop: true }),
  cairn: () => specOf(effects.spiritFlame, {}, { zoom: 0.62, fps: 12, loop: true }),
  windmill: () => specOf(effects.millSails, {}, { loop: true, fps: 12 }),
  hut: () => specOf(effects.spiritFlame, { palette: SPECTRE }, { zoom: 0.4, fps: 12, loop: true }),
  hangtree: () => specOf(effects.spiritFlame, { palette: BLOOD }, { zoom: 0.4, fps: 12, loop: true }),
  forge: () => specOf(effects.campfire, { height: 60 }, { fps: 12, loop: true }),
  colossus: () => specOf(effects.spiritFlame, { palette: ICE_RAMP }, { zoom: 0.6, fps: 12, loop: true }),
};

export function shrineFocusSpec(type: ShrineType): Spec {
  return sizedSpec(`shrine/${type}`, SHRINE_FOCUS[type]);
}

export const graveBurstSpecs = [3, 8, 14].map((seed) => specOf(effects.graveBurst, { seed }));

// ---------------------------------------------------------------- préparation

/** Ce qui revient sans cesse : peint avant la partie, pour que le premier coup ne saccade pas. */
enqueue(...hitSpecs, ...critSpecs, ...deathSpecs[0]!);

const prepared = new Set<string>();

/** Une arme part au pré-rendu dès qu'elle est dans la main du joueur, pas à son premier tir. */
export function prepareWeapon(weaponId: string, behavior: string): void {
  if (prepared.has(weaponId)) return;
  prepared.add(weaponId);
  const flight = FLIGHTS[weaponId];
  if (flight) enqueue(...flight.specs);
  if (behavior === 'strike') enqueue(strikeSpec(weaponId));
  if (behavior === 'spikes') enqueue(...spikeSet(weaponId));
  if (behavior === 'nova') enqueue(mirrorBurstSpec);
  if (behavior === 'lob') enqueue(landingSpec);
}
