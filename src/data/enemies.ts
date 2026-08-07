import { P } from '../gfx/palette';
import type { BodyArt } from '../gfx/sprites';

/**
 * Table des ennemis. `hp`, `damage` et `speed` sont les valeurs **de base**, avant la mise à
 * l'échelle temporelle appliquée par le director.
 *
 * Règle d'équilibrage centrale : **la vitesse ne monte jamais avec le temps.** Seuls les PV
 * et les dégâts augmentent. C'est ce qui garde le kiting possible à la 28ᵉ minute.
 */

export type EnemyAI =
  | 'chase' // poursuite directe
  | 'wave' // poursuite en ondulant
  | 'erratic' // trajectoire bruitée
  | 'charger' // accélère par à-coups, marque une pause
  | 'phase' // ignore la séparation, traverse les autres
  | 'ranged' // s'arrête à distance et crache
  | 'leech' // se soigne en touchant le joueur
  | 'dasher' // ruée rectiligne qui traverse l'écran
  | 'split'; // se scinde à la mort

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  damage: number;
  speed: number;
  /** Rayon de collision (px). */
  radius: number;
  gemRank: 0 | 1 | 2 | 3;
  ai: EnemyAI;
  /** 0 = repoussé normalement, 1 = immunisé au recul. */
  kbResist: number;
  art: BodyArt;
  /** Minute à partir de laquelle il peut apparaître. */
  from: number;
  /** Poids relatif dans le tirage d'apparition. */
  weight: number;
  /** Apparaît par grappes de N. */
  cluster?: number;
  goldChance?: number;
  boss?: boolean;
}

const beast = (cols: [string, string, string], eye: string, extra?: Partial<BodyArt>): BodyArt => ({
  plan: 'beast', w: 16, h: 12, cols, eye, ...extra,
});

export const ENEMIES: EnemyDef[] = [
  {
    id: 'bat', name: 'Chauve-souris',
    hp: 8, damage: 5, speed: 62, radius: 5, gemRank: 0, ai: 'wave', kbResist: 0,
    art: { plan: 'flying', w: 14, h: 11, cols: [P.fleshDead, P.flesh, P.fleshHi], eye: P.bloodHi, horns: true, frames: 4 },
    from: 0, weight: 100,
  },
  {
    id: 'ghoul', name: 'Goule',
    hp: 14, damage: 8, speed: 44, radius: 5.5, gemRank: 0, ai: 'chase', kbResist: 0,
    art: { plan: 'humanoid', w: 11, h: 13, cols: [P.fleshDead, P.flesh, P.fleshHi], eye: P.spark, frames: 4 },
    from: 0, weight: 110,
  },
  {
    id: 'crow', name: 'Corbeau',
    hp: 10, damage: 6, speed: 74, radius: 5, gemRank: 0, ai: 'erratic', kbResist: 0,
    art: { plan: 'flying', w: 15, h: 12, cols: ['#1a1a24', '#2b2b3a', '#3d3d52'], eye: P.gold, frames: 4 },
    from: 2, weight: 70,
  },
  {
    id: 'wolf', name: 'Loup',
    hp: 22, damage: 12, speed: 88, radius: 6.5, gemRank: 1, ai: 'charger', kbResist: 0.2,
    art: beast(['#2a2230', '#3d3446', '#524459'], P.bloodHi, { horns: false, tail: true }),
    from: 4, weight: 65,
  },
  {
    id: 'skeleton', name: 'Squelette',
    hp: 40, damage: 12, speed: 40, radius: 6, gemRank: 1, ai: 'chase', kbResist: 0.6,
    art: { plan: 'humanoid', w: 12, h: 14, cols: ['#4a4a52', '#7c7c88', '#b0b0bc'], eye: P.bloodHi, frames: 4 },
    from: 5, weight: 60,
  },
  {
    id: 'spider', name: 'Araignée',
    hp: 16, damage: 9, speed: 70, radius: 5.5, gemRank: 0, ai: 'chase', kbResist: 0,
    art: { plan: 'spider', w: 15, h: 12, cols: ['#221a2c', '#33253f', '#452f52'], eye: P.bloodHi, accent: P.poison, frames: 4 },
    from: 7, weight: 55, cluster: 8,
  },
  {
    id: 'zombie', name: 'Zombie',
    hp: 90, damage: 16, speed: 26, radius: 7, gemRank: 1, ai: 'chase', kbResist: 0.5,
    art: { plan: 'humanoid', w: 13, h: 15, cols: ['#26331f', '#3a4d2e', '#4f6640'], eye: P.poison, frames: 4 },
    from: 8, weight: 45,
  },
  {
    id: 'wraith', name: 'Spectre',
    hp: 30, damage: 14, speed: 96, radius: 6, gemRank: 1, ai: 'phase', kbResist: 0.8,
    art: { plan: 'ghost', w: 14, h: 15, cols: ['#1d2b3a', '#2e4459', '#436079'], eye: P.ice, accent: P.ice, frames: 6 },
    from: 10, weight: 50,
  },
  {
    id: 'spitter', name: 'Nécrophage',
    hp: 55, damage: 10, speed: 34, radius: 6.5, gemRank: 2, ai: 'ranged', kbResist: 0.3,
    art: { plan: 'blob', w: 15, h: 14, cols: ['#2d3320', '#465238', '#5e6b4a'], eye: P.poison, frames: 4 },
    from: 12, weight: 40, goldChance: 0.2,
  },
  {
    id: 'leech', name: 'Sangsue',
    hp: 45, damage: 18, speed: 52, radius: 6, gemRank: 2, ai: 'leech', kbResist: 0.2,
    art: beast(['#3d1520', '#5c2030', '#7a2c42'], P.bloodHi, { tail: true }),
    from: 14, weight: 40, goldChance: 0.2,
  },
  {
    id: 'rider', name: 'Cavalier',
    hp: 70, damage: 22, speed: 130, radius: 7.5, gemRank: 2, ai: 'dasher', kbResist: 0.9,
    art: { plan: 'rider', w: 20, h: 16, cols: ['#2a2438', '#3e3552', '#544a6b'], eye: P.bloodHi, accent: P.gold, frames: 4 },
    from: 16, weight: 35, goldChance: 0.25,
  },
  {
    id: 'golem', name: 'Golem de Chair',
    hp: 220, damage: 28, speed: 22, radius: 11, gemRank: 2, ai: 'chase', kbResist: 1,
    art: { plan: 'blob', w: 24, h: 24, cols: ['#3d2028', '#5c2f3a', '#78404d'], eye: P.spark, horns: true, frames: 4 },
    from: 19, weight: 28, goldChance: 0.4,
  },
  {
    id: 'damned', name: 'Damné',
    hp: 130, damage: 24, speed: 60, radius: 7, gemRank: 2, ai: 'split', kbResist: 0.4,
    art: { plan: 'armored', w: 14, h: 16, cols: ['#2c1f33', '#43304d', '#5a4166'], eye: P.bloodHi, accent: P.fire, frames: 4 },
    from: 22, weight: 30, goldChance: 0.3,
  },
];

export const ENEMY_BY_ID = new Map(ENEMIES.map((e) => [e.id, e]));

export function enemyById(id: string): EnemyDef {
  const e = ENEMY_BY_ID.get(id) ?? BOSS_BY_ID.get(id);
  if (!e) throw new Error(`Ennemi inconnu : ${id}`);
  return e;
}

// ---------------------------------------------------------------------------
// Boss
// ---------------------------------------------------------------------------

export type BossMechanic = 'summon' | 'charge' | 'triad' | 'phases' | 'reaper';

export interface BossDef extends EnemyDef {
  boss: true;
  mechanic: BossMechanic;
  /** Minute d'apparition. */
  minute: number;
  title: string;
  /** Invulnérable et impossible à tuer – réservé à la Faucheuse. */
  invincible?: boolean;
}

export const BOSSES: BossDef[] = [
  {
    id: 'matron', name: 'La Matrone', title: 'mère des mille pattes',
    hp: 3000, damage: 26, speed: 38, radius: 18, gemRank: 3, ai: 'chase', kbResist: 1,
    art: { plan: 'spider', w: 44, h: 38, cols: ['#2a1030', '#43184a', '#5e2266'], eye: P.bloodHi, accent: P.poison, crown: true, frames: 4 },
    from: 10, weight: 0, boss: true, mechanic: 'summon', minute: 10, goldChance: 1,
  },
  {
    id: 'exsanguine', name: 'Le Chevalier Exsangue', title: 'qui ne saigne plus',
    hp: 9000, damage: 36, speed: 46, radius: 20, gemRank: 3, ai: 'charger', kbResist: 1,
    art: { plan: 'armored', w: 40, h: 46, cols: ['#22262f', '#394050', '#525b72'], eye: P.bloodHi, accent: P.steel, crown: true, frames: 4 },
    from: 18, weight: 0, boss: true, mechanic: 'charge', minute: 18, goldChance: 1,
  },
  {
    id: 'ashchoir', name: 'Chœur de Cendres', title: 'trois voix, un seul corps',
    hp: 14000, damage: 40, speed: 40, radius: 17, gemRank: 3, ai: 'phase', kbResist: 1,
    art: { plan: 'ghost', w: 38, h: 44, cols: ['#2b2620', '#453d33', '#605547'], eye: P.fire, accent: P.spark, crown: true, frames: 6 },
    from: 24, weight: 0, boss: true, mechanic: 'triad', minute: 24, goldChance: 1,
  },
  {
    id: 'sanguine', name: 'Le Sanguinaire', title: 'celui qui a donné son nom au domaine',
    hp: 40000, damage: 55, speed: 42, radius: 26, gemRank: 3, ai: 'chase', kbResist: 1,
    art: { plan: 'humanoid', w: 56, h: 60, cols: ['#3d0a16', '#6b1122', '#9c1c33'], eye: P.spark, accent: P.gold, horns: true, crown: true, frames: 4 },
    from: 30, weight: 0, boss: true, mechanic: 'phases', minute: 30, goldChance: 1,
  },
  {
    id: 'reaper', name: 'La Faucheuse', title: 'le rideau',
    hp: 999999, damage: 9999, speed: 105, radius: 20, gemRank: 3, ai: 'chase', kbResist: 1,
    art: { plan: 'ghost', w: 40, h: 48, cols: ['#08080c', '#141420', '#20202e'], eye: P.bloodHi, accent: P.bloodHi, frames: 6 },
    from: 31, weight: 0, boss: true, mechanic: 'reaper', minute: 31, invincible: true,
  },
];

export const BOSS_BY_ID = new Map<string, BossDef>(BOSSES.map((b) => [b.id, b]));
