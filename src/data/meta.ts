import type { Mods } from './mods';

/**
 * Sanctuaire — méta-progression permanente achetée avec l'or conservé entre les runs.
 *
 * Volontairement **modeste** : au maximum absolu, il apporte ~35 % de puissance globale.
 * Il doit adoucir la courbe d'apprentissage, jamais remplacer l'habileté. Un joueur qui a
 * tout acheté doit encore pouvoir mourir à la 22ᵉ minute avec un mauvais build.
 */
export interface MetaUpgrade {
  id: string;
  name: string;
  desc: string;
  levels: number;
  baseCost: number;
  /** Modificateurs accordés **par niveau**. */
  perLevel: Mods;
}

export const META_UPGRADES: MetaUpgrade[] = [
  { id: 'power', name: 'Puissance', desc: '+5 % de dégâts', levels: 5, baseCost: 200, perLevel: { might: 0.05 } },
  { id: 'vitality', name: 'Vitalité', desc: '+15 PV max', levels: 5, baseCost: 150, perLevel: { maxHp: 15 } },
  { id: 'celerity', name: 'Célérité', desc: '+4 % de vitesse', levels: 5, baseCost: 180, perLevel: { moveSpeed: 0.04 } },
  { id: 'armor', name: 'Armure', desc: '+1 armure', levels: 3, baseCost: 400, perLevel: { armor: 1 } },
  { id: 'regen', name: 'Régénération', desc: '+0,2 PV/s', levels: 3, baseCost: 350, perLevel: { regen: 0.2 } },
  { id: 'magnetism', name: 'Aimantation', desc: '+15 % de ramassage', levels: 3, baseCost: 120, perLevel: { pickup: 0.15 } },
  { id: 'greed', name: 'Avarice', desc: "+12 % d'or", levels: 4, baseCost: 250, perLevel: { greed: 0.12 } },
  { id: 'growth', name: 'Croissance', desc: "+6 % d'XP", levels: 4, baseCost: 300, perLevel: { growth: 0.06 } },
  { id: 'fortune', name: 'Fortune', desc: '+8 % de chance', levels: 3, baseCost: 450, perLevel: { luck: 0.08 } },
  { id: 'reroll', name: 'Reroll', desc: '+1 reroll par partie', levels: 3, baseCost: 500, perLevel: { rerolls: 1 } },
  { id: 'revive', name: 'Résurrection', desc: '+1 résurrection par partie', levels: 2, baseCost: 1500, perLevel: { revives: 1 } },
];

export const META_BY_ID = new Map(META_UPGRADES.map((u) => [u.id, u]));

/** Le coût croît géométriquement : chaque niveau coûte 80 % de plus que le précédent. */
export function costOf(u: MetaUpgrade, currentLevel: number): number {
  return Math.round(u.baseCost * Math.pow(1.8, currentLevel));
}
