import { P } from '../gfx/palette';
import type { HeroArt } from '../gfx/sprites';
import type { Mods } from './mods';

/**
 * Personnages. Chacun est une **orientation de build**, pas une simple variation de chiffres :
 * l'arme de départ décide de la direction des dix premières minutes, et le malus force à
 * compenser avec les objets trouvés.
 */
export interface CharacterDef {
  id: string;
  name: string;
  epithet: string;
  startWeapon: string;
  perk: string;
  flaw: string;
  mods: Mods;
  art: HeroArt;
  /** Condition de déblocage, `null` si disponible dès le départ. */
  unlock: null | { kind: 'time' | 'gems' | 'kills' | 'win'; value: number; label: string };
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'ysolde',
    name: 'Ysolde',
    epithet: 'la Chasseresse',
    startWeapon: 'stake',
    perk: '+10 % de dégâts',
    flaw: '—',
    mods: { might: 0.1 },
    art: { cloak: '#3f5a3a', cloth: '#8a6a3c', skin: '#e0b088', accent: P.gold, hat: 'hood' },
    unlock: null,
  },
  {
    id: 'anselme',
    name: 'Frère Anselme',
    epithet: 'du Cloître Noyé',
    startWeapon: 'water',
    perk: '+25 % de zone, +40 PV',
    flaw: '−10 % de vitesse',
    mods: { area: 0.25, maxHp: 40, moveSpeed: -0.1 },
    art: { cloak: '#5a4a6b', cloth: '#d8cfc0', skin: '#d9a880', accent: P.ice, hat: 'hood' },
    unlock: null,
  },
  {
    id: 'vasco',
    name: 'Vasco',
    epithet: 'le Braconnier',
    startWeapon: 'garlic',
    perk: '+20 % de vitesse, +1 projectile',
    flaw: '−25 PV max',
    mods: { moveSpeed: 0.2, amount: 1, maxHp: -25 },
    art: { cloak: '#6b4a2a', cloth: '#4a5c3a', skin: '#c99060', accent: P.poison, hat: 'wide' },
    unlock: { kind: 'time', value: 600, label: 'Survivre 10 minutes' },
  },
  {
    id: 'marguerite',
    name: 'Marguerite',
    epithet: 'la Sourcière',
    startWeapon: 'lantern',
    perk: '+60 % de ramassage, +20 % de chance',
    flaw: '−10 % de dégâts',
    mods: { pickup: 0.6, luck: 0.2, might: -0.1 },
    art: { cloak: '#3a4a6b', cloth: '#c0b8a8', skin: '#e8c0a0', accent: P.xp1, hat: 'veil' },
    unlock: { kind: 'gems', value: 3000, label: 'Ramasser 3 000 gemmes' },
  },
  {
    id: 'ombre',
    name: 'Sœur Ombre',
    epithet: 'de l’Ordre Muet',
    startWeapon: 'scythe',
    perk: '−20 % de recharge, +10 % de critique',
    flaw: '−30 PV max',
    mods: { cooldown: 0.2, crit: 0.1, maxHp: -30 },
    art: { cloak: '#1e1e2c', cloth: '#3a3a4e', skin: '#c8b8b0', accent: P.steel, hat: 'hood' },
    unlock: { kind: 'kills', value: 5000, label: 'Terrasser 5 000 ennemis' },
  },
  {
    id: 'comte',
    name: 'Le Comte',
    epithet: 'Déchu',
    startWeapon: 'tainted',
    perk: '+30 % de dégâts, 3 % de vol de vie',
    flaw: 'Aucune régénération, −40 PV',
    mods: { might: 0.3, lifesteal: 0.03, maxHp: -40 },
    art: { cloak: '#4a0e1c', cloth: '#1a1a24', skin: '#d8d0d8', accent: P.bloodHi, hat: 'crown' },
    unlock: { kind: 'win', value: 1, label: 'Remporter une partie' },
  },
];

export const CHARACTER_BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));

export function characterById(id: string): CharacterDef {
  return CHARACTER_BY_ID.get(id) ?? CHARACTERS[0]!;
}

/** Le Comte n'a jamais de régénération, quelle que soit sa source. */
export const NO_REGEN_CHARS = new Set(['comte']);
