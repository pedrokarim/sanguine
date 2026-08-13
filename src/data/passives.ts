import { P } from '../gfx/palette';
import type { Mods } from './mods';

/**
 * Passifs : 12 objets, niveau maximum 5, gain linéaire par niveau.
 * Ils occupent 6 emplacements – c'est ce plafond qui force les vrais choix de build.
 */
export interface PassiveDef {
  id: string;
  name: string;
  desc: string;
  /** Modificateurs accordés **par niveau**. Le total est `perLevel × niveau`. */
  perLevel: Mods;
  maxLevel: number;
  color: string;
  /** Forme de l'icône générée. */
  icon: 'gem' | 'boot' | 'heart' | 'glass' | 'lens' | 'flask' | 'feather' | 'book' | 'magnet' | 'shield' | 'clover' | 'cup';
}

export const PASSIVES: PassiveDef[] = [
  {
    id: 'reliquary',
    name: 'Reliquaire',
    desc: 'Les os des saints frappent plus fort que les vôtres.',
    perLevel: { might: 0.1 },
    maxLevel: 5, color: P.gold, icon: 'gem',
  },
  {
    id: 'boots',
    name: 'Bottes de Voyage',
    desc: 'Usées jusqu’à la corde, mais elles vous portent encore.',
    perLevel: { moveSpeed: 0.08 },
    maxLevel: 5, color: P.leather, icon: 'boot',
  },
  {
    id: 'silverheart',
    name: 'Cœur d’Argent',
    desc: 'Un cœur qui ne bat plus vraiment, mais qui tient bon.',
    perLevel: { maxHp: 20 },
    maxLevel: 5, color: P.steel, icon: 'heart',
  },
  {
    id: 'hourglass',
    name: 'Sablier',
    desc: 'Le sable coule à l’envers dans vos mains.',
    perLevel: { cooldown: 0.08 },
    maxLevel: 5, color: P.ice, icon: 'glass',
  },
  {
    id: 'scope',
    name: 'Longue-vue',
    desc: 'Voir loin, frapper large.',
    perLevel: { area: 0.12 },
    maxLevel: 5, color: P.copper, icon: 'lens',
  },
  {
    id: 'powder',
    name: 'Poudre',
    desc: 'Une pincée de plus à chaque charge.',
    perLevel: { amount: 0.5 },
    maxLevel: 5, color: P.stoneHi, icon: 'flask',
  },
  {
    id: 'feather',
    name: 'Plume',
    desc: 'Arrachée à quelque chose qui volait mieux que vous.',
    perLevel: { projSpeed: 0.15 },
    maxLevel: 5, color: P.linen, icon: 'feather',
  },
  {
    id: 'grimoire',
    name: 'Grimoire',
    desc: 'Les mots y restent gravés bien après avoir été prononcés.',
    perLevel: { duration: 0.15 },
    maxLevel: 5, color: P.fleshHi, icon: 'book',
  },
  {
    id: 'magnet',
    name: 'Aimant',
    desc: 'Ce qui brille finit toujours par venir à vous.',
    perLevel: { pickup: 0.25 },
    maxLevel: 5, color: P.xp1, icon: 'magnet',
  },
  {
    id: 'talisman',
    name: 'Talisman',
    desc: 'Il absorbe une part de chaque coup.',
    perLevel: { armor: 1 },
    maxLevel: 5, color: P.stone, icon: 'shield',
  },
  {
    id: 'clover',
    name: 'Trèfle',
    desc: 'La chance ne sourit qu’à ceux qui la portent sur eux.',
    perLevel: { luck: 0.08, crit: 0.03 },
    maxLevel: 5, color: P.poison, icon: 'clover',
  },
  {
    id: 'chalice',
    name: 'Calice',
    desc: 'Il se remplit tout seul. Mieux vaut ne pas savoir de quoi.',
    perLevel: { regen: 0.4 },
    maxLevel: 5, color: P.blood, icon: 'cup',
  },
];

export const PASSIVE_BY_ID = new Map(PASSIVES.map((p) => [p.id, p]));

export function passiveById(id: string): PassiveDef {
  const p = PASSIVE_BY_ID.get(id);
  if (!p) throw new Error(`Passif inconnu : ${id}`);
  return p;
}
