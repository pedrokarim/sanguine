import type { Rarity } from '../gfx/palette';
import type { Mods } from './mods';

/**
 * Reliques : objets uniques qu'on ne trouve **jamais** dans le menu de niveau – uniquement
 * au sol (élites, boss) et dans les coffres. Elles n'occupent aucun emplacement, donc on
 * peut toutes les cumuler. C'est la couche de butin « surprise » qui différencie deux runs
 * au même build d'armes.
 *
 * `flags` porte les effets que de simples statistiques ne peuvent pas exprimer ; le runtime
 * lit des clés précises (documentées ci-dessous).
 */
export interface RelicDef {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  mods?: Mods;
  flags?: Partial<Record<RelicFlag, number>>;
}

/**
 * Clés d'effet spécial reconnues par le runtime.
 *
 *  lowHpBonus   multiplicateur de dégâts contre les ennemis sous 30 % de PV
 *  heartBoost   multiplie l'effet des cœurs ramassés
 *  chestBonus   améliorations supplémentaires par coffre
 *  eliteChests  coffres supplémentaires lâchés par les élites
 *  stunEvery    nombre de coups avant d'étourdir la cible
 *  extraPierce  perforation supplémentaire sur tous les projectiles
 *  slowOnKill   durée (s) du ralentissement infligé aux voisins d'un ennemi tué
 *  reflect      probabilité de renvoyer les dégâts subis
 *  gemBonus     bonus d'XP par gemme
 *  bossDamage   dégâts supplémentaires contre les boss
 *  execute      probabilité d'exécuter instantanément un ennemi non-boss
 *  freeNova     intervalle (s) entre deux novas gratuites
 *  lowHpRegen   fraction de PV max régénérée par seconde sous 30 % de PV
 *  noRegen      annule toute régénération
 *  enemyHp      PV supplémentaires accordés aux ennemis (malédiction)
 *  lastBreath   résurrection à 1 PV sans invulnérabilité
 */
export type RelicFlag =
  | 'lowHpBonus' | 'heartBoost' | 'chestBonus' | 'eliteChests' | 'stunEvery'
  | 'extraPierce' | 'slowOnKill' | 'reflect' | 'gemBonus' | 'bossDamage'
  | 'execute' | 'freeNova' | 'lowHpRegen' | 'noRegen' | 'enemyHp' | 'lastBreath';

export const RELICS: RelicDef[] = [
  // ------------------------------------------------------------- communes
  {
    id: 'wolftooth', name: 'Dent de Loup', rarity: 'common',
    desc: 'Achève les blessés : +25 % de dégâts sous 30 % de PV ennemis.',
    flags: { lowHpBonus: 0.25 },
  },
  {
    id: 'glasseye', name: 'Œil de Verre', rarity: 'common',
    desc: 'Vous voyez les points faibles. +8 % de critique.',
    mods: { crit: 0.08 },
  },
  {
    id: 'studdedsoles', name: 'Semelles Cloutées', rarity: 'common',
    desc: 'Bruyantes, mais rapides. +12 % de vitesse.',
    mods: { moveSpeed: 0.12 },
  },
  {
    id: 'holedpurse', name: 'Bourse Percée', rarity: 'common',
    desc: 'Elle attire plus d’or qu’elle n’en perd. +25 % d’or.',
    mods: { greed: 0.25 },
  },
  {
    id: 'warmvial', name: 'Fiole Tiède', rarity: 'common',
    desc: 'Les cœurs ramassés soignent deux fois plus.',
    flags: { heartBoost: 2 },
  },
  {
    id: 'rustykey', name: 'Clé Rouillée', rarity: 'common',
    desc: 'Elle ouvre un peu mieux. +1 amélioration par coffre.',
    flags: { chestBonus: 1 },
  },

  // ----------------------------------------------------------------- rares
  {
    id: 'brokenrosary', name: 'Chapelet Brisé', rarity: 'rare',
    desc: 'Tous les 12 coups, la cible est étourdie une seconde.',
    flags: { stunEvery: 12 },
  },
  {
    id: 'ravenfeather', name: 'Plume de Corbeau', rarity: 'rare',
    desc: 'Vos projectiles traversent un ennemi de plus.',
    flags: { extraPierce: 1 },
  },
  {
    id: 'crackedglass', name: 'Sablier Fêlé', rarity: 'rare',
    desc: 'Le temps se presse, les projectiles traînent. −12 % de recharge, −8 % de vitesse de projectile.',
    mods: { cooldown: 0.12, projSpeed: -0.08 },
  },
  {
    id: 'amber', name: 'Ambre', rarity: 'rare',
    desc: 'Les ennemis tués figent leurs voisins deux secondes.',
    flags: { slowOnKill: 2 },
  },
  {
    id: 'pocketmirror', name: 'Miroir de Poche', rarity: 'rare',
    desc: 'Une chance sur dix de renvoyer les dégâts subis.',
    flags: { reflect: 0.1 },
  },
  {
    id: 'blessedash', name: 'Cendre Bénite', rarity: 'rare',
    desc: 'Chaque gemme vaut 20 % d’XP de plus.',
    flags: { gemBonus: 0.2 },
  },
  {
    id: 'fossilclaw', name: 'Griffe Fossile', rarity: 'rare',
    desc: 'Un projectile de plus pour toutes les armes qui en tirent.',
    mods: { amount: 1 },
  },
  {
    id: 'deaflantern', name: 'Lanterne Sourde', rarity: 'rare',
    desc: 'Elle attire tout, mais éclaire mal. +35 % de ramassage, −5 % de zone.',
    mods: { pickup: 0.35, area: -0.05 },
  },

  // --------------------------------------------------------------- épiques
  {
    id: 'beatingheart', name: 'Cœur Battant', rarity: 'epic',
    desc: '+15 % de PV max, et vous régénérez rapidement sous 30 % de vie.',
    mods: { maxHp: 30 }, flags: { lowHpRegen: 0.01 },
  },
  {
    id: 'ironcrown', name: 'Couronne de Fer', rarity: 'epic',
    desc: 'Les élites lâchent deux coffres au lieu d’un.',
    flags: { eliteChests: 1 },
  },
  {
    id: 'huntermark', name: 'Marque du Chasseur', rarity: 'epic',
    desc: 'Les boss subissent 30 % de dégâts supplémentaires.',
    flags: { bossDamage: 0.3 },
  },
  {
    id: 'tinyscythe', name: 'Faux Miniature', rarity: 'epic',
    desc: 'Trois pour cent de chance d’exécuter net un ennemi ordinaire.',
    flags: { execute: 0.03 },
  },
  {
    id: 'castseal', name: 'Sceau de Fonte', rarity: 'epic',
    desc: 'Lourd, mais il encaisse. +3 armure, −6 % de vitesse.',
    mods: { armor: 3, moveSpeed: -0.06 },
  },
  {
    id: 'fracturedorb', name: 'Orbe Fracturé', rarity: 'epic',
    desc: 'Toutes les huit secondes, une nova jaillit de vous.',
    flags: { freeNova: 8 },
  },

    // -------------------------------------------------------------- maudites
  {
    id: 'spilledchalice', name: 'Calice Renversé', rarity: 'cursed',
    desc: 'Vous buvez la vie de vos victimes, mais ne cicatrisez plus. +4 % de vol de vie.',
    mods: { lifesteal: 0.04 }, flags: { noRegen: 1 },
  },
  {
    id: 'bloodpact', name: 'Pacte de Sang', rarity: 'cursed',
    desc: 'Une puissance dévorante, payée de votre chair. +45 % de dégâts, PV max divisés par deux.',
    mods: { might: 0.45 }, flags: {},
  },
  {
    id: 'stoppedclock', name: 'Horloge Arrêtée', rarity: 'cursed',
    desc: 'Vos armes s’emballent, et vos ennemis grossissent. −30 % de recharge, +15 % de PV ennemis.',
    mods: { cooldown: 0.3 }, flags: { enemyHp: 0.15 },
  },
  {
    id: 'lastbreath', name: 'Dernier Souffle', rarity: 'cursed',
    desc: 'La mort vous recrache une fois – à un point de vie, et sans répit.',
    flags: { lastBreath: 1 },
  },
];

export const RELIC_BY_ID = new Map(RELICS.map((r) => [r.id, r]));

export const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 55,
  rare: 28,
  epic: 12,
  cursed: 5,
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Commune',
  rare: 'Rare',
  epic: 'Épique',
  cursed: 'Maudite',
};

/** `bloodpact` divise les PV max – traité à part car ce n'est pas un modificateur additif. */
export const HALVES_HP = 'bloodpact';
