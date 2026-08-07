import type { SpriteSet } from '../gfx/sprites';
import type { EnemyDef, BossDef } from '../data/enemies';
import type { WeaponDef } from '../data/weapons';

/**
 * Interfaces des entités. Tous les pools stockent des objets **pré-alloués** : `active`
 * remplace la suppression, et rien n'est jamais créé pendant une partie.
 *
 * `px`/`py` conservent la position du pas précédent pour permettre au rendu d'interpoler
 * entre deux pas de simulation (la simulation tourne à 60 Hz, le rendu à la fréquence écran).
 */

/**
 * Chaque ennemi mémorise jusqu'à 4 sources de dégâts persistantes récemment subies, avec
 * leur date d'expiration. C'est ce qui permet à une aura, deux orbes et une flaque de
 * toucher le même ennemi sans se voler mutuellement leurs coups.
 */
export const IMMUNE_SLOTS = 4;

export interface Enemy {
  active: boolean;
  id: number;

  x: number; y: number;
  px: number; py: number;
  vx: number; vy: number;
  /** Vitesse de recul, amortie séparément du déplacement propre. */
  kx: number; ky: number;

  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  radius: number;

  def: EnemyDef | BossDef;
  sprite: SpriteSet;
  boss: boolean;
  elite: boolean;

  /** Horloge d'animation, en secondes. */
  anim: number;
  /** Durée restante du flash blanc de dégâts. */
  flash: number;
  facing: number;
  /** Délai avant de pouvoir blesser le joueur à nouveau. */
  touchCd: number;

  slow: number;
  stun: number;
  poison: number;
  poisonDps: number;
  /** Marque le dernier projectile ayant touché : évite les coups multiples en perforation. */
  lastPid: number;

  immuneSrc: Int32Array;
  immuneUntil: Float32Array;
  immuneCursor: number;

  /** État libre pour l'IA (phase de charge, compte de scission…). */
  state: number;
  timer: number;
  /** Direction verrouillée des ennemis en ruée (`dasher`). */
  dirX: number;
  dirY: number;
  /** Pour les boss : phase courante et compteur de mécanique. */
  phase: number;
  mechTimer: number;
  /** Mort en cours : durée restante de l'animation de dislocation. */
  dying: number;
}

export type ProjBehavior =
  | 'linear'
  | 'boomerang'
  | 'orbit'
  | 'pet'
  | 'bounce'
  | 'lob'
  | 'melee'
  | 'strike'
  | 'wave'
  | 'spike'
  | 'flail'
  | 'enemyShot';

export interface Projectile {
  active: boolean;
  /** Identifiant unique croissant, comparé à `Enemy.lastPid`. */
  pid: number;

  x: number; y: number;
  px: number; py: number;
  vx: number; vy: number;

  damage: number;
  radius: number;
  life: number;
  maxLife: number;
  pierce: number;
  knockback: number;

  behavior: ProjBehavior;
  sprite: SpriteSet;
  color: string;
  weaponId: string;
  /** Marqueurs de l'arme (`chain`, `burn`, `poison`…). */
  tags: string[];

  angle: number;
  rot: number;
  spin: number;
  anim: number;

  /** Champs libres selon le comportement (rayon d'orbite, rebonds restants, cible…). */
  a: number;
  b: number;
  c: number;
  /** Intervalle entre deux coups pour les sources persistantes (orbes, mêlée, auras). */
  tick: number;
  /** Pour les fioles : ce que devient le projectile à l'impact (rayon, dégâts, durée). */
  zoneRadius: number;
  zoneDamage: number;
  zoneLife: number;
  /** Source persistante, pour la table d'immunité des ennemis. */
  srcId: number;
  /** `true` pour les projectiles ennemis (touchent le joueur, pas les ennemis). */
  hostile: boolean;
  /** Le projectile suit le joueur (orbes, fléau). */
  anchored: boolean;
}

export interface Zone {
  active: boolean;
  x: number; y: number;
  radius: number;
  targetRadius: number;
  damage: number;
  life: number;
  maxLife: number;
  tickTimer: number;
  tickRate: number;
  color: string;
  srcId: number;
  anim: number;
  grow: boolean;
}

export type PickupKind =
  | 'gem'
  | 'gold'
  | 'heart'
  | 'magnet'
  | 'bomb'
  | 'hourglass'
  | 'scroll'
  | 'censer'
  | 'chest'
  | 'relic';

export interface Pickup {
  active: boolean;
  kind: PickupKind;
  x: number; y: number;
  px: number; py: number;
  vx: number; vy: number;
  /** XP pour les gemmes, or pour les pièces, index de relique sinon. */
  value: number;
  /** Rang de gemme 0..3, ou rareté de relique. */
  rank: number;
  anim: number;
  /** Le ramassage a commencé : l'objet fonce vers le joueur. */
  drawn: boolean;
  /** Délai avant de pouvoir être ramassé (évite le ramassage instantané à l'éjection). */
  armTime: number;
  relicId: string;
  sprite: SpriteSet;
}

export interface WeaponInstance {
  def: WeaponDef;
  level: number;
  /** Temps restant avant le prochain déclenchement. */
  cd: number;
  /** Angle courant pour les armes en orbite. */
  angle: number;
  /** Identifiant de source persistante, unique par arme équipée. */
  srcId: number;
  /** Compteur libre (rafales en cours, morts cumulées pour Moisson…). */
  counter: number;
  /** Sous-minuterie pour les rafales. */
  burst: number;
  burstLeft: number;
}

/** Statistiques dérivées du joueur, recalculées à chaque changement de build. */
export interface Stats {
  maxHp: number;
  regen: number;
  armor: number;
  moveSpeed: number;
  might: number;
  area: number;
  cooldown: number;
  projSpeed: number;
  duration: number;
  amount: number;
  pickupRadius: number;
  luck: number;
  growth: number;
  greed: number;
  crit: number;
  lifesteal: number;
  pierce: number;
  revives: number;
  rerolls: number;
}

export function makeEnemy(id: number): Enemy {
  return {
    active: false, id,
    x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, kx: 0, ky: 0,
    hp: 1, maxHp: 1, damage: 1, speed: 0, radius: 5,
    def: null as unknown as EnemyDef,
    sprite: null as unknown as SpriteSet,
    boss: false, elite: false,
    anim: 0, flash: 0, facing: 1, touchCd: 0,
    slow: 0, stun: 0, poison: 0, poisonDps: 0, lastPid: -1,
    immuneSrc: new Int32Array(IMMUNE_SLOTS).fill(-1),
    immuneUntil: new Float32Array(IMMUNE_SLOTS),
    immuneCursor: 0,
    state: 0, timer: 0, dirX: 0, dirY: 0, phase: 0, mechTimer: 0, dying: 0,
  };
}

export function makeProjectile(): Projectile {
  return {
    active: false, pid: 0,
    x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0,
    damage: 0, radius: 3, life: 0, maxLife: 1, pierce: 1, knockback: 0,
    behavior: 'linear',
    sprite: null as unknown as SpriteSet,
    color: '#fff', weaponId: '', tags: [],
    angle: 0, rot: 0, spin: 0, anim: 0,
    a: 0, b: 0, c: 0, tick: 0.35, zoneRadius: 0, zoneDamage: 0, zoneLife: 0,
    srcId: -1, hostile: false, anchored: false,
  };
}

export function makeZone(): Zone {
  return {
    active: false, x: 0, y: 0, radius: 0, targetRadius: 0,
    damage: 0, life: 0, maxLife: 1, tickTimer: 0, tickRate: 0.35,
    color: '#fff', srcId: -1, anim: 0, grow: false,
  };
}

export function makePickup(): Pickup {
  return {
    active: false, kind: 'gem',
    x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0,
    value: 1, rank: 0, anim: 0, drawn: false, armTime: 0, relicId: '',
    sprite: null as unknown as SpriteSet,
  };
}

/**
 * Vérifie qu'une source persistante (aura, orbe, flaque) a le droit de toucher cet ennemi,
 * et enregistre l'immunité si oui. Quatre créneaux suffisent en pratique : au-delà, la
 * source la plus ancienne est écrasée, ce qui n'est pas perceptible en jeu.
 */
export function claimHit(e: Enemy, srcId: number, now: number, cooldown: number): boolean {
  for (let i = 0; i < IMMUNE_SLOTS; i++) {
    if (e.immuneSrc[i] === srcId) {
      if (e.immuneUntil[i]! > now) return false;
      e.immuneUntil[i] = now + cooldown;
      return true;
    }
  }
  const slot = e.immuneCursor;
  e.immuneCursor = (e.immuneCursor + 1) % IMMUNE_SLOTS;
  e.immuneSrc[slot] = srcId;
  e.immuneUntil[slot] = now + cooldown;
  return true;
}

export function resetImmunity(e: Enemy): void {
  e.immuneSrc.fill(-1);
  e.immuneUntil.fill(0);
  e.immuneCursor = 0;
}
