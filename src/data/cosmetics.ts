import { P } from '../gfx/palette';
import type { HeroArt } from '../gfx/sprites';

/**
 * Boutique cosmétique.
 *
 * L'or n'avait qu'un seul débouché : le Sanctuaire, c'est-à-dire de la puissance. Un joueur
 * qui a fini d'acheter ses améliorations n'a plus rien à faire de son or, et un joueur qui
 * hésite n'a aucun arbitrage à rendre. La boutique donne à la monnaie une **seconde raison
 * d'exister**, et met les deux en concurrence : dépenser en puissance ou en allure.
 *
 * Règle absolue : **aucun cosmétique n'influence le jeu.** Ni statistique, ni lisibilité —
 * les teintes de personnage restent chaudes et saturées, les traînées restent discrètes, et
 * rien ne touche aux couleurs réservées aux gemmes ni au sang.
 */

export type CosmeticKind = 'skin' | 'trail' | 'theme' | 'cursor';

export interface Cosmetic {
  id: string;
  kind: CosmeticKind;
  name: string;
  desc: string;
  price: number;
  /** Pour les teintes : le personnage concerné. */
  charId?: string;
  /** Surcharge de l'apparence du héros. */
  art?: Partial<HeroArt>;
  /** Couleur principale, utilisée par l'aperçu et par l'effet. */
  color?: string;
  /** Seconde couleur, pour les thèmes d'interface. */
  accent?: string;
}

const C = (c: Cosmetic): Cosmetic => c;

// ---------------------------------------------------------------------------
// Teintes de personnage
// ---------------------------------------------------------------------------

export const SKINS: Cosmetic[] = [
  C({
    id: 'skin-ysolde-givre', kind: 'skin', charId: 'ysolde', price: 900,
    name: 'Ysolde · Givre', desc: 'Elle a traversé un hiver de trop.',
    art: { cloak: '#3d5570', cloth: '#c9d6e4', accent: P.ice },
  }),
  C({
    id: 'skin-ysolde-braise', kind: 'skin', charId: 'ysolde', price: 900,
    name: 'Ysolde · Braise', desc: 'Le cuir sent encore la fumée.',
    art: { cloak: '#6b2a1e', cloth: '#c9762a', accent: P.fire },
  }),
  C({
    id: 'skin-anselme-heretique', kind: 'skin', charId: 'anselme', price: 900,
    name: 'Anselme · Hérétique', desc: "L'ordre l'a défroqué. Il prie quand même.",
    art: { cloak: '#2a2035', cloth: '#7a5f8f', accent: '#a855f7' },
  }),
  C({
    id: 'skin-anselme-cendre', kind: 'skin', charId: 'anselme', price: 900,
    name: 'Anselme · Cendre', desc: 'Il revient du bûcher.',
    art: { cloak: '#3a3630', cloth: '#8a8378', accent: P.spark },
  }),
  C({
    id: 'skin-vasco-sylve', kind: 'skin', charId: 'vasco', price: 1100,
    name: 'Vasco · Sylve', desc: 'Il ne braconne plus, il appartient au bois.',
    art: { cloak: '#2f4a2c', cloth: '#5a7a3a', accent: P.poison },
  }),
  C({
    id: 'skin-marguerite-nuit', kind: 'skin', charId: 'marguerite', price: 1100,
    name: 'Marguerite · Nuit', desc: 'Sa baguette pointe vers le bas, toujours.',
    art: { cloak: '#1b2440', cloth: '#4a5a80', accent: P.xp1 },
  }),
  C({
    id: 'skin-ombre-suaire', kind: 'skin', charId: 'ombre', price: 1300,
    name: 'Sœur Ombre · Suaire', desc: 'Le silence lui va mieux en blanc.',
    art: { cloak: '#d8d2c8', cloth: '#9a948a', accent: P.linen },
  }),
  C({
    id: 'skin-comte-pourpre', kind: 'skin', charId: 'comte', price: 1600,
    name: 'Le Comte · Pourpre', desc: 'Il a retrouvé sa cour. Elle est vide.',
    art: { cloak: '#3d1050', cloth: '#22102e', accent: '#d8b4fe' },
  }),
];

// ---------------------------------------------------------------------------
// Traînées
// ---------------------------------------------------------------------------

export const TRAILS: Cosmetic[] = [
  C({ id: 'trail-none', kind: 'trail', name: 'Aucune', desc: 'Vous ne laissez rien derrière vous.', price: 0 }),
  C({ id: 'trail-ash', kind: 'trail', name: 'Cendres', desc: 'Une poussière grise qui retombe.', price: 500, color: '#8a8378' }),
  C({ id: 'trail-frost', kind: 'trail', name: 'Givre', desc: 'Le sol gèle sous vos pas.', price: 700, color: P.ice }),
  C({ id: 'trail-ember', kind: 'trail', name: 'Braises', desc: 'Vous marchez et ça fume.', price: 700, color: P.fire }),
  C({ id: 'trail-gold', kind: 'trail', name: 'Or Fondu', desc: 'De quoi se faire remarquer.', price: 1200, color: P.gold }),
  C({ id: 'trail-void', kind: 'trail', name: 'Vide', desc: 'Quelque chose vous suit de trop près.', price: 1500, color: '#a855f7' }),
];

// ---------------------------------------------------------------------------
// Thèmes d'interface
// ---------------------------------------------------------------------------

export const THEMES: Cosmetic[] = [
  C({ id: 'theme-stone', kind: 'theme', name: 'Pierre', desc: 'La monture par défaut.', price: 0, color: P.mist, accent: P.stoneHi }),
  C({ id: 'theme-gold', kind: 'theme', name: 'Reliquaire', desc: 'Cadres dorés, comme une châsse.', price: 800, color: P.gold, accent: '#fff3c4' }),
  C({ id: 'theme-blood', kind: 'theme', name: 'Sang', desc: 'Pour ceux qui assument.', price: 1000, color: P.blood, accent: P.bloodHi }),
  C({ id: 'theme-amethyst', kind: 'theme', name: 'Améthyste', desc: 'La teinte des reliques épiques.', price: 1400, color: '#a855f7', accent: '#d8b4fe' }),
];

// ---------------------------------------------------------------------------
// Curseurs
// ---------------------------------------------------------------------------

export const CURSORS: Cosmetic[] = [
  C({ id: 'cursor-linen', kind: 'cursor', name: 'Lin', desc: 'Le curseur de départ.', price: 0, color: P.linen, accent: P.steel }),
  C({ id: 'cursor-gold', kind: 'cursor', name: 'Or', desc: 'Discrètement fortuné.', price: 400, color: P.gold, accent: '#fff3c4' }),
  C({ id: 'cursor-blood', kind: 'cursor', name: 'Sang', desc: 'Assorti au reste.', price: 400, color: P.bloodHi, accent: '#ffffff' }),
  C({ id: 'cursor-ice', kind: 'cursor', name: 'Givre', desc: 'Froid, net, tranchant.', price: 600, color: P.ice, accent: '#ffffff' }),
];

export const ALL_COSMETICS: Cosmetic[] = [...SKINS, ...TRAILS, ...THEMES, ...CURSORS];
export const COSMETIC_BY_ID = new Map(ALL_COSMETICS.map((c) => [c.id, c]));

/** Éléments possédés d'emblée : ce sont les réglages par défaut, pas des achats. */
export const FREE_IDS = ALL_COSMETICS.filter((c) => c.price === 0).map((c) => c.id);

export const KIND_LABEL: Record<CosmeticKind, string> = {
  skin: 'Teintes',
  trail: 'Traînées',
  theme: 'Interface',
  cursor: 'Curseurs',
};
