import { P } from '../gfx/palette';
import type { ProjKind } from '../gfx/sprites';
import type { SfxName } from '../audio/audio';

/**
 * Table des armes. Chaque arme est décrite par un **comportement** (une fonction du runtime)
 * plus des paramètres numériques. Ajouter une arme qui réutilise un comportement existant ne
 * demande aucune ligne de code – seulement une entrée ici.
 */

export type WeaponBehavior =
  | 'projectile' // tire vers l'ennemi le plus proche
  | 'boomerang' // part loin puis revient
  | 'orbitFar' // orbite à distance en permanence (évolution de la croix)
  | 'aura' // zone permanente autour du joueur
  | 'lob' // fiole en cloche, laisse une flaque
  | 'orbit' // orbes en rotation autour du joueur
  | 'melee' // arc dans la direction du mouvement
  | 'strike' // frappe des ennemis au hasard
  | 'nova' // salve radiale
  | 'pet' // familier autonome à tête chercheuse
  | 'trail' // dépose derrière le joueur
  | 'reactive' // se déclenche quand le joueur est touché
  | 'cone' // balayage conique
  | 'burst' // rafale rapide vers la cible
  | 'flail' // masse tournoyante au corps-à-corps
  | 'ground' // dépose des zones au sol
  | 'bounce' // ricoche d'ennemi en ennemi
  | 'spikes' // pieux jaillissant en cercle
  | 'shockwave'; // onde circulaire repoussante

export interface WeaponDef {
  id: string;
  name: string;
  desc: string;
  behavior: WeaponBehavior;

  damage: number;
  cooldown: number;
  /** Vitesse des projectiles (px/s). */
  speed: number;
  /** Rayon ou demi-taille de base (px). */
  area: number;
  count: number;
  pierce: number;
  /** Durée de vie des effets persistants (s). */
  duration: number;
  knockback: number;

  color: string;
  sprite: ProjKind;
  sfx: SfxName;

  maxLevel: number;
  /** Gain de dégâts additif par niveau, en fraction de la base. */
  dmgPerLevel: number;
  /** Multiplicateur de recharge appliqué à chaque niveau (< 1 = plus rapide). */
  cdPerLevel: number;
  /** Niveaux auxquels un projectile s'ajoute. */
  countAt: number[];
  /** Niveaux auxquels la zone augmente de 15 %. */
  areaAt: number[];
  /** Niveaux auxquels la perforation augmente. */
  pierceAt: number[];

  /** Passif requis (au niveau 3+) pour rendre l'évolution éligible. */
  requires?: string;
  evolvesTo?: string;
  isEvolution?: boolean;
  /** Marqueurs consultés par le runtime pour les comportements spéciaux. */
  tags?: string[];
}

const W = (d: WeaponDef): WeaponDef => d;

export const WEAPONS: WeaponDef[] = [
  // ---------------------------------------------------------------- de base
  W({
    id: 'stake',
    name: 'Pieu',
    desc: "Projette un pieu vers l’ennemi le plus proche.",
    behavior: 'projectile',
    damage: 10, cooldown: 1.1, speed: 230, area: 3, count: 1, pierce: 1, duration: 2.4, knockback: 26,
    color: P.linen, sprite: 'stake', sfx: 'shoot',
    maxLevel: 8, dmgPerLevel: 0.22, cdPerLevel: 0.94,
    countAt: [2, 4, 6, 8], areaAt: [5], pierceAt: [3, 7],
    requires: 'powder', evolvesTo: 'carpenter',
  }),
  W({
    id: 'cross',
    name: 'Croix',
    desc: 'Une croix qui part au loin et revient, traversant tout.',
    behavior: 'boomerang',
    damage: 12, cooldown: 1.6, speed: 145, area: 5, count: 1, pierce: 99, duration: 2.6, knockback: 14,
    color: P.gold, sprite: 'cross', sfx: 'shootHeavy',
    maxLevel: 8, dmgPerLevel: 0.2, cdPerLevel: 0.95,
    countAt: [3, 5, 7], areaAt: [2, 6], pierceAt: [],
    requires: 'scope', evolvesTo: 'crucifixion',
  }),
  W({
    id: 'garlic',
    name: 'Ail',
    desc: 'Une aura qui blesse et repousse tout ce qui approche.',
    behavior: 'aura',
    damage: 4, cooldown: 0.55, speed: 0, area: 26, count: 1, pierce: 99, duration: 0, knockback: 34,
    color: P.poison, sprite: 'orb', sfx: 'swing',
    maxLevel: 8, dmgPerLevel: 0.25, cdPerLevel: 0.93,
    countAt: [], areaAt: [2, 3, 4, 5, 6, 7, 8], pierceAt: [],
    requires: 'chalice', evolvesTo: 'aioli',
  }),
  W({
    id: 'water',
    name: 'Eau Bénite',
    desc: 'Lance une fiole qui laisse une flaque brûlante.',
    behavior: 'lob',
    damage: 15, cooldown: 2.4, speed: 90, area: 20, count: 1, pierce: 99, duration: 3.2, knockback: 0,
    color: P.ice, sprite: 'flask', sfx: 'shoot',
    maxLevel: 8, dmgPerLevel: 0.24, cdPerLevel: 0.93,
    countAt: [2, 4, 6, 8], areaAt: [3, 5, 7], pierceAt: [],
    requires: 'grimoire', evolvesTo: 'deluge',
  }),
  W({
    id: 'lantern',
    name: 'Lanterne',
    desc: 'Des orbes tournent autour de vous.',
    behavior: 'orbit',
    damage: 9, cooldown: 2.0, speed: 2.4, area: 30, count: 2, pierce: 99, duration: 1.6, knockback: 18,
    color: P.spark, sprite: 'orb', sfx: 'swing',
    maxLevel: 8, dmgPerLevel: 0.23, cdPerLevel: 0.94,
    countAt: [2, 3, 5, 7], areaAt: [4, 8], pierceAt: [],
    requires: 'hourglass', evolvesTo: 'souls',
  }),
  W({
    id: 'scythe',
    name: 'Faux',
    desc: 'Un large arc de mêlée dans votre direction.',
    behavior: 'melee',
    damage: 18, cooldown: 1.3, speed: 0, area: 34, count: 1, pierce: 99, duration: 0.22, knockback: 40,
    color: P.steel, sprite: 'scythe', sfx: 'swing',
    maxLevel: 8, dmgPerLevel: 0.26, cdPerLevel: 0.92,
    countAt: [4, 7], areaAt: [2, 3, 5, 6, 8], pierceAt: [],
    requires: 'reliquary', evolvesTo: 'harvest',
  }),
  W({
    id: 'judgement',
    name: 'Jugement',
    desc: 'La foudre frappe des ennemis au hasard.',
    behavior: 'strike',
    damage: 22, cooldown: 2.8, speed: 0, area: 16, count: 1, pierce: 99, duration: 0.3, knockback: 20,
    color: P.spark, sprite: 'lightning', sfx: 'zap',
    maxLevel: 8, dmgPerLevel: 0.3, cdPerLevel: 0.92,
    countAt: [2, 3, 4, 5, 6, 7, 8], areaAt: [4, 8], pierceAt: [],
    requires: 'clover', evolvesTo: 'wrath',
  }),
  W({
    id: 'mirror',
    name: 'Miroir',
    desc: 'Projette des éclats dans toutes les directions.',
    behavior: 'nova',
    damage: 8, cooldown: 2.2, speed: 175, area: 3, count: 6, pierce: 1, duration: 1.6, knockback: 12,
    color: P.ice, sprite: 'shard', sfx: 'nova',
    maxLevel: 8, dmgPerLevel: 0.22, cdPerLevel: 0.93,
    countAt: [2, 3, 4, 5, 6, 7, 8], areaAt: [5], pierceAt: [4, 8],
    requires: 'feather', evolvesTo: 'kaleidoscope',
  }),
  W({
    id: 'familiar',
    name: 'Familier',
    desc: 'Une chauve-souris qui pourchasse les ennemis pour vous.',
    behavior: 'pet',
    damage: 11, cooldown: 0.9, speed: 120, area: 6, count: 1, pierce: 1, duration: 999, knockback: 10,
    color: P.fleshHi, sprite: 'familiar', sfx: 'swing',
    maxLevel: 8, dmgPerLevel: 0.24, cdPerLevel: 0.91,
    countAt: [3, 6], areaAt: [4, 8], pierceAt: [5],
    requires: 'boots', evolvesTo: 'swarm',
  }),
  W({
    id: 'salt',
    name: 'Sel',
    desc: 'Laisse derrière vous une traînée qui ronge.',
    behavior: 'trail',
    damage: 6, cooldown: 0.4, speed: 0, area: 9, count: 1, pierce: 99, duration: 2.6, knockback: 0,
    color: P.linen, sprite: 'ember', sfx: 'fire',
    maxLevel: 8, dmgPerLevel: 0.24, cdPerLevel: 0.95,
    countAt: [], areaAt: [2, 3, 4, 5, 6, 7, 8], pierceAt: [],
  }),
  W({
    id: 'tainted',
    name: 'Sang Corrompu',
    desc: 'Explose violemment chaque fois que vous êtes touché.',
    behavior: 'reactive',
    damage: 30, cooldown: 0, speed: 0, area: 44, count: 1, pierce: 99, duration: 0.3, knockback: 90,
    color: P.blood, sprite: 'orb', sfx: 'explode',
    maxLevel: 8, dmgPerLevel: 0.35, cdPerLevel: 1,
    countAt: [], areaAt: [2, 3, 4, 5, 6, 7, 8], pierceAt: [],
  }),
  W({
    id: 'censer',
    name: 'Encensoir',
    desc: 'Un lent balayage conique qui purifie une large zone.',
    behavior: 'cone',
    damage: 14, cooldown: 3.0, speed: 0, area: 58, count: 1, pierce: 99, duration: 0.9, knockback: 24,
    color: P.gold, sprite: 'wave', sfx: 'swing',
    maxLevel: 8, dmgPerLevel: 0.26, cdPerLevel: 0.93,
    countAt: [5], areaAt: [2, 3, 4, 6, 7, 8], pierceAt: [],
  }),
  W({
    id: 'crossbow',
    name: 'Arbalète',
    desc: 'Une rafale de carreaux rapides.',
    behavior: 'burst',
    damage: 7, cooldown: 1.4, speed: 300, area: 2.5, count: 3, pierce: 1, duration: 1.4, knockback: 12,
    color: P.steel, sprite: 'bolt', sfx: 'shoot',
    maxLevel: 8, dmgPerLevel: 0.2, cdPerLevel: 0.92,
    countAt: [2, 3, 4, 5, 6, 7, 8], areaAt: [], pierceAt: [4, 8],
    requires: 'feather', evolvesTo: 'ballista',
  }),
  W({
    id: 'flail',
    name: 'Fléau',
    desc: 'Une masse tournoie au bout de sa chaîne.',
    behavior: 'flail',
    damage: 16, cooldown: 0.8, speed: 5.5, area: 22, count: 1, pierce: 99, duration: 0, knockback: 56,
    color: P.stoneHi, sprite: 'flail', sfx: 'swing',
    maxLevel: 8, dmgPerLevel: 0.25, cdPerLevel: 0.94,
    countAt: [3, 6, 8], areaAt: [2, 4, 5, 7], pierceAt: [],
    requires: 'silverheart', evolvesTo: 'comet',
  }),
  W({
    id: 'brazier',
    name: 'Braséro',
    desc: 'Dépose des braises qui brûlent longtemps.',
    behavior: 'ground',
    damage: 9, cooldown: 1.8, speed: 60, area: 17, count: 1, pierce: 99, duration: 4.0, knockback: 0,
    color: P.fire, sprite: 'ember', sfx: 'fire',
    maxLevel: 8, dmgPerLevel: 0.24, cdPerLevel: 0.93,
    countAt: [2, 4, 6, 8], areaAt: [3, 5, 7], pierceAt: [],
    requires: 'grimoire', evolvesTo: 'furnace',
  }),
  W({
    id: 'ricochet',
    name: 'Dague Ricochet',
    desc: "Rebondit d’un ennemi à l’autre.",
    behavior: 'bounce',
    damage: 13, cooldown: 1.5, speed: 250, area: 3.5, count: 1, pierce: 5, duration: 3.0, knockback: 16,
    color: P.spark, sprite: 'dagger', sfx: 'shoot',
    maxLevel: 8, dmgPerLevel: 0.22, cdPerLevel: 0.93,
    countAt: [4, 8], areaAt: [], pierceAt: [2, 3, 5, 6, 7],
    requires: 'clover', evolvesTo: 'bladedance',
  }),
  W({
    id: 'thorns',
    name: 'Ronces',
    desc: 'Des pieux jaillissent du sol autour de vous.',
    behavior: 'spikes',
    damage: 20, cooldown: 2.6, speed: 0, area: 46, count: 5, pierce: 99, duration: 0.45, knockback: 30,
    color: P.fleshHi, sprite: 'thorn', sfx: 'swing',
    maxLevel: 8, dmgPerLevel: 0.27, cdPerLevel: 0.93,
    countAt: [2, 3, 4, 5, 6, 7, 8], areaAt: [3, 6], pierceAt: [],
    requires: 'talisman', evolvesTo: 'irongarden',
  }),
  W({
    id: 'horn',
    name: 'Cor de Chasse',
    desc: 'Une onde de choc qui repousse violemment.',
    behavior: 'shockwave',
    damage: 12, cooldown: 2.9, speed: 190, area: 30, count: 1, pierce: 99, duration: 0.6, knockback: 130,
    color: P.copper, sprite: 'wave', sfx: 'nova',
    maxLevel: 8, dmgPerLevel: 0.25, cdPerLevel: 0.92,
    countAt: [4, 7], areaAt: [2, 3, 5, 6, 8], pierceAt: [],
    requires: 'reliquary', evolvesTo: 'packcall',
  }),

  // ------------------------------------------------------------ évolutions
  W({
    id: 'carpenter',
    name: 'Salve du Charpentier',
    desc: 'Six pieux en éventail qui empalent tout sur leur passage.',
    behavior: 'projectile',
    damage: 24, cooldown: 0.85, speed: 280, area: 4, count: 6, pierce: 5, duration: 2.6, knockback: 40,
    color: P.gold, sprite: 'stake', sfx: 'shootHeavy',
    maxLevel: 1, dmgPerLevel: 0, cdPerLevel: 1, countAt: [], areaAt: [], pierceAt: [],
    isEvolution: true, tags: ['spread'],
  }),
  W({
    id: 'crucifixion',
    name: 'Crucifixion',
    desc: 'Les croix ne reviennent plus : elles orbitent au loin, éternellement.',
    behavior: 'orbitFar',
    damage: 26, cooldown: 3.2, speed: 1.9, area: 78, count: 4, pierce: 99, duration: 999, knockback: 20,
    color: P.gold, sprite: 'cross', sfx: 'shootHeavy',
    maxLevel: 1, dmgPerLevel: 0, cdPerLevel: 1, countAt: [], areaAt: [], pierceAt: [],
    isEvolution: true,
  }),
  W({
    id: 'aioli',
    name: 'Aïoli',
    desc: "L’aura double de rayon et empoisonne durablement.",
    behavior: 'aura',
    damage: 11, cooldown: 0.32, speed: 0, area: 58, count: 1, pierce: 99, duration: 0, knockback: 48,
    color: P.poison, sprite: 'orb', sfx: 'swing',
    maxLevel: 1, dmgPerLevel: 0, cdPerLevel: 1, countAt: [], areaAt: [], pierceAt: [],
    isEvolution: true, tags: ['poison'],
  }),
  W({
    id: 'deluge',
    name: 'Déluge',
    desc: 'Quatre fioles à la fois, et des flaques qui ne tarissent plus.',
    behavior: 'lob',
    damage: 32, cooldown: 1.5, speed: 100, area: 32, count: 4, pierce: 99, duration: 9.0, knockback: 0,
    color: P.ice, sprite: 'flask', sfx: 'shootHeavy',
    maxLevel: 1, dmgPerLevel: 0, cdPerLevel: 1, countAt: [], areaAt: [], pierceAt: [],
    isEvolution: true,
  }),
  W({
    id: 'souls',
    name: 'Ronde des Âmes',
    desc: 'Deux anneaux contrarotatifs de flammes vengeresses.',
    behavior: 'orbit',
    damage: 20, cooldown: 1.4, speed: 3.2, area: 40, count: 8, pierce: 99, duration: 999, knockback: 30,
    color: P.spark, sprite: 'orb', sfx: 'swing',
    maxLevel: 1, dmgPerLevel: 0, cdPerLevel: 1, countAt: [], areaAt: [], pierceAt: [],
    isEvolution: true, tags: ['dualRing'],
  }),
  W({
    id: 'harvest',
    name: 'Moisson',
    desc: "L’arc devient un cercle complet. Chaque quinzaine de morts vous soigne.",
    behavior: 'melee',
    damage: 42, cooldown: 0.9, speed: 0, area: 62, count: 1, pierce: 99, duration: 0.26, knockback: 60,
    color: P.bloodHi, sprite: 'scythe', sfx: 'swing',
    maxLevel: 1, dmgPerLevel: 0, cdPerLevel: 1, countAt: [], areaAt: [], pierceAt: [],
    isEvolution: true, tags: ['full360', 'lifeOnKill'],
  }),
  W({
    id: 'wrath',
    name: 'Colère Divine',
    desc: 'Chaque éclair se ramifie sur trois cibles supplémentaires.',
    behavior: 'strike',
    damage: 46, cooldown: 1.5, speed: 0, area: 22, count: 6, pierce: 99, duration: 0.3, knockback: 34,
    color: '#ffffff', sprite: 'lightning', sfx: 'zap',
    maxLevel: 1, dmgPerLevel: 0, cdPerLevel: 1, countAt: [], areaAt: [], pierceAt: [],
    isEvolution: true, tags: ['chain'],
  }),
  W({
    id: 'kaleidoscope',
    name: 'Kaléidoscope',
    desc: "Les éclats rebondissent sur les bords de l’écran.",
    behavior: 'nova',
    damage: 17, cooldown: 1.2, speed: 200, area: 4, count: 14, pierce: 3, duration: 3.2, knockback: 20,
    color: P.ice, sprite: 'shard', sfx: 'nova',
    maxLevel: 1, dmgPerLevel: 0, cdPerLevel: 1, countAt: [], areaAt: [], pierceAt: [],
    isEvolution: true, tags: ['screenBounce'],
  }),
  W({
    id: 'swarm',
    name: 'Nuée',
    desc: 'Quatre familiers affamés, bien plus rapides.',
    behavior: 'pet',
    damage: 22, cooldown: 0.55, speed: 190, area: 8, count: 4, pierce: 3, duration: 999, knockback: 18,
    color: P.bloodHi, sprite: 'familiar', sfx: 'swing',
    maxLevel: 1, dmgPerLevel: 0, cdPerLevel: 1, countAt: [], areaAt: [], pierceAt: [],
    isEvolution: true,
  }),
  W({
    id: 'ballista',
    name: 'Balista',
    desc: 'Huit carreaux qui percent tout et clouent les corps au sol.',
    behavior: 'burst',
    damage: 16, cooldown: 0.9, speed: 360, area: 3.5, count: 8, pierce: 99, duration: 1.8, knockback: 30,
    color: P.gold, sprite: 'bolt', sfx: 'shootHeavy',
    maxLevel: 1, dmgPerLevel: 0, cdPerLevel: 1, countAt: [], areaAt: [], pierceAt: [],
    isEvolution: true, tags: ['slow'],
  }),
  W({
    id: 'comet',
    name: 'Comète',
    desc: 'La masse se détache et rebondit librement, embrasée.',
    behavior: 'flail',
    damage: 34, cooldown: 0.5, speed: 7.5, area: 34, count: 3, pierce: 99, duration: 0, knockback: 80,
    color: P.fire, sprite: 'flail', sfx: 'explode',
    maxLevel: 1, dmgPerLevel: 0, cdPerLevel: 1, countAt: [], areaAt: [], pierceAt: [],
    isEvolution: true, tags: ['burn'],
  }),
  W({
    id: 'furnace',
    name: 'Fournaise',
    desc: 'Les braises s’étendent jusqu’à recouvrir le sol.',
    behavior: 'ground',
    damage: 20, cooldown: 0.9, speed: 70, area: 30, count: 3, pierce: 99, duration: 7.0, knockback: 0,
    color: P.fire, sprite: 'ember', sfx: 'fire',
    maxLevel: 1, dmgPerLevel: 0, cdPerLevel: 1, countAt: [], areaAt: [], pierceAt: [],
    isEvolution: true, tags: ['grow'],
  }),
  W({
    id: 'bladedance',
    name: 'Danse des Lames',
    desc: 'Vingt rebonds, et les dégâts croissent à chacun.',
    behavior: 'bounce',
    damage: 24, cooldown: 0.85, speed: 300, area: 4, count: 2, pierce: 20, duration: 5.0, knockback: 22,
    color: P.spark, sprite: 'dagger', sfx: 'shoot',
    maxLevel: 1, dmgPerLevel: 0, cdPerLevel: 1, countAt: [], areaAt: [], pierceAt: [],
    isEvolution: true, tags: ['rampBounce'],
  }),
  W({
    id: 'irongarden',
    name: 'Jardin de Fer',
    desc: "Les ronces déferlent en vagues concentriques jusqu’aux bords.",
    behavior: 'spikes',
    damage: 40, cooldown: 1.5, speed: 0, area: 96, count: 14, pierce: 99, duration: 0.5, knockback: 44,
    color: P.steel, sprite: 'thorn', sfx: 'swing',
    maxLevel: 1, dmgPerLevel: 0, cdPerLevel: 1, countAt: [], areaAt: [], pierceAt: [],
    isEvolution: true, tags: ['waves'],
  }),
  W({
    id: 'packcall',
    name: 'Appel de la Meute',
    desc: "L’onde invoque des loups spectraux qui combattent à vos côtés.",
    behavior: 'shockwave',
    damage: 26, cooldown: 1.6, speed: 230, area: 46, count: 2, pierce: 99, duration: 0.7, knockback: 170,
    color: P.copper, sprite: 'wave', sfx: 'nova',
    maxLevel: 1, dmgPerLevel: 0, cdPerLevel: 1, countAt: [], areaAt: [], pierceAt: [],
    isEvolution: true, tags: ['summonWolves'],
  }),
];

export const WEAPON_BY_ID = new Map(WEAPONS.map((w) => [w.id, w]));
/** Armes proposables dans le menu de niveau (les évolutions n'y figurent jamais). */
export const BASE_WEAPONS = WEAPONS.filter((w) => !w.isEvolution);

export function weaponById(id: string): WeaponDef {
  const w = WEAPON_BY_ID.get(id);
  if (!w) throw new Error(`Arme inconnue : ${id}`);
  return w;
}

/** Décrit ce qu'apporte le passage au niveau `next`. Généré, donc toujours exact. */
export function levelUpText(w: WeaponDef, next: number): string {
  const parts: string[] = [];
  if (w.countAt.includes(next)) parts.push('+1 projectile');
  if (w.areaAt.includes(next)) parts.push('+15 % de zone');
  if (w.pierceAt.includes(next)) parts.push('+1 perforation');
  parts.push(`+${Math.round(w.dmgPerLevel * 100)} % de dégâts`);
  if (w.cdPerLevel < 1) parts.push(`−${Math.round((1 - w.cdPerLevel) * 100)} % de recharge`);
  return parts.join(', ');
}
