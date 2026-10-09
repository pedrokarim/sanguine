import { P } from '../gfx/palette';
import type { HeroArt } from '../gfx/sprites';
import type { TrailStyle, Aura, AmbienceStyle } from '../gfx/cosmeticfx';
import { localiseById, t } from '../i18n';
import { EN_COSMETICS } from './en';

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

/*
 * Grille de prix.
 *
 * Elle est calée sur le revenu mesuré au bot (`tools/balance-bot.js`), une fois l'or rendu
 * dépendant de l'horloge et non du débit de mise à mort (`goldRate`) : de l'ordre de
 * **1 100 pièces** pour une partie perdue vers la septième minute, **10 000** pour une
 * partie menée au bout. Quatre paliers, pour qu'il y ait toujours un achat à portée et
 * toujours un autre hors d'atteinte :
 *
 *   – facile        600 à 1 500    une ou deux parties courtes ;
 *   – intermédiaire 3 500 à 5 000  une poignée de parties, ou une demi-partie longue ;
 *   – difficile     8 000 à 14 000 une partie complète, parfois deux ;
 *   – prestige      20 000 à 36 000 plusieurs parties menées au bout.
 *
 * L'ensemble représente environ 172 000 pièces, soit dix-sept parties complètes – et le
 * Sanctuaire, qui se paie sur la même bourse, en demande 33 600 de plus. Les anciens prix
 * (400 à 1 600) dataient d'avant la mesure : une seule partie longue vidait la boutique.
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
  /**
   * Condition de déblocage hors monnaie. `'complete'` exige la collection entière : c'est la
   * seule contrepartie de l'Archive, et elle ne s'achète pas.
   */
  requires?: 'complete';
  /** Teinte universelle : s'applique à n'importe quel personnage. */
  universal?: boolean;
  /** Effet de la traînée : chacune a le sien, pas seulement sa couleur. */
  trail?: TrailStyle;
  /** Aura portée par une teinte, sous les pieds du personnage. */
  aura?: Aura;
  /** Ambiance qu'un thème ajoute à la scène des menus. */
  ambience?: AmbienceStyle;
}

const C = (c: Cosmetic): Cosmetic => c;

// ---------------------------------------------------------------------------
// Teintes de personnage
// ---------------------------------------------------------------------------

export const SKINS: Cosmetic[] = [
  // La teinte universelle est ajoutée en fin de fichier : elle ne s'achète pas.
  C({
    id: 'skin-ysolde-givre', kind: 'skin', charId: 'ysolde', price: 5000,
    name: 'Ysolde · Givre', desc: 'Elle a traversé un hiver de trop.',
    aura: { color: P.ice, tier: 1 },
    art: { cloak: '#3d5570', cloth: '#c9d6e4', accent: P.ice },
  }),
  C({
    id: 'skin-ysolde-braise', kind: 'skin', charId: 'ysolde', price: 5000,
    name: 'Ysolde · Braise', desc: 'Le cuir sent encore la fumée.',
    aura: { color: P.fire, tier: 1 },
    art: { cloak: '#6b2a1e', cloth: '#c9762a', accent: P.fire },
  }),
  C({
    id: 'skin-anselme-heretique', kind: 'skin', charId: 'anselme', price: 5000,
    name: 'Anselme · Hérétique', desc: "L’ordre l’a défroqué. Il prie quand même.",
    aura: { color: '#a855f7', tier: 1 },
    art: { cloak: '#2a2035', cloth: '#7a5f8f', accent: '#a855f7' },
  }),
  C({
    id: 'skin-anselme-cendre', kind: 'skin', charId: 'anselme', price: 5000,
    name: 'Anselme · Cendre', desc: 'Il revient du bûcher.',
    aura: { color: P.spark, tier: 1 },
    art: { cloak: '#3a3630', cloth: '#8a8378', accent: P.spark },
  }),
  C({
    id: 'skin-vasco-sylve', kind: 'skin', charId: 'vasco', price: 9000,
    name: 'Vasco · Sylve', desc: 'Il ne braconne plus, il appartient au bois.',
    aura: { color: P.poison, tier: 2 },
    art: { cloak: '#2f4a2c', cloth: '#5a7a3a', accent: P.poison },
  }),
  C({
    id: 'skin-marguerite-nuit', kind: 'skin', charId: 'marguerite', price: 9000,
    name: 'Marguerite · Nuit', desc: 'Sa baguette pointe vers le bas, toujours.',
    aura: { color: P.xp1, tier: 2 },
    art: { cloak: '#1b2440', cloth: '#4a5a80', accent: P.xp1 },
  }),
  C({
    id: 'skin-ombre-suaire', kind: 'skin', charId: 'ombre', price: 13000,
    name: 'Sœur Ombre · Suaire', desc: 'Le silence lui va mieux en blanc.',
    aura: { color: P.linen, tier: 2 },
    art: { cloak: '#d8d2c8', cloth: '#9a948a', accent: P.linen },
  }),
  C({
    id: 'skin-comte-pourpre', kind: 'skin', charId: 'comte', price: 36000,
    name: 'Le Comte · Pourpre', desc: 'Il a retrouvé sa cour. Elle est vide.',
    aura: { color: '#a855f7', tier: 3 },
    art: { cloak: '#3d1050', cloth: '#22102e', accent: '#d8b4fe' },
  }),
  C({
    id: 'skin-arpente', kind: 'skin', price: 0, universal: true, requires: 'complete',
    name: 'Arpenté', desc: 'Vous avez été mesuré, et vous le savez.',
    aura: { color: '#7de8ff', tier: 3 },
    art: { cloak: '#2a2f3d', cloth: '#9aa2b8', skin: '#e6e2d8', accent: '#7de8ff' },
  }),

];

// ---------------------------------------------------------------------------
// Traînées
// ---------------------------------------------------------------------------

export const TRAILS: Cosmetic[] = [
  C({ id: 'trail-none', kind: 'trail', name: 'Aucune', desc: 'Vous ne laissez rien derrière vous.', price: 0 }),
  C({ id: 'trail-ash', kind: 'trail', trail: 'ash', name: 'Cendres', desc: 'Une poussière grise qui retombe.', price: 1500, color: '#8a8378' }),
  C({ id: 'trail-frost', kind: 'trail', trail: 'frost', name: 'Givre', desc: 'Le sol gèle sous vos pas.', price: 3500, color: P.ice }),
  C({ id: 'trail-ember', kind: 'trail', trail: 'ember', name: 'Braises', desc: 'Vous marchez et ça fume.', price: 3500, color: P.fire }),
  C({ id: 'trail-gold', kind: 'trail', trail: 'gold', name: 'Or Fondu', desc: 'De quoi se faire remarquer.', price: 14000, color: P.gold }),
  C({ id: 'trail-void', kind: 'trail', trail: 'void', name: 'Vide', desc: 'Quelque chose vous suit de trop près.', price: 28000, color: '#a855f7' }),
];

// ---------------------------------------------------------------------------
// Thèmes d'interface
// ---------------------------------------------------------------------------

export const THEMES: Cosmetic[] = [
  C({ id: 'theme-stone', kind: 'theme', name: 'Pierre', desc: 'La monture par défaut.', price: 0, color: P.mist, accent: P.stoneHi }),
  C({ id: 'theme-gold', kind: 'theme', ambience: 'dust', name: 'Reliquaire', desc: 'Cadres dorés, et une poussière d’or dans l’air des menus.', price: 4500, color: P.gold, accent: '#fff3c4' }),
  C({ id: 'theme-blood', kind: 'theme', ambience: 'rain', name: 'Sang', desc: 'Cadres écarlates. Il pleut rouge sur les menus.', price: 8000, color: P.blood, accent: P.bloodHi }),
  C({ id: 'theme-amethyst', kind: 'theme', ambience: 'fireflies', name: 'Améthyste', desc: 'Cadres violets, lucioles et aurore sur les menus.', price: 20000, color: '#a855f7', accent: '#d8b4fe' }),
];

// ---------------------------------------------------------------------------
// Curseurs
// ---------------------------------------------------------------------------

export const CURSORS: Cosmetic[] = [
  C({ id: 'cursor-linen', kind: 'cursor', name: 'Lin', desc: 'Le curseur de départ.', price: 0, color: P.linen, accent: P.steel }),
  C({ id: 'cursor-gold', kind: 'cursor', name: 'Or', desc: 'Discrètement fortuné.', price: 600, color: P.gold, accent: '#fff3c4' }),
  C({ id: 'cursor-blood', kind: 'cursor', name: 'Sang', desc: 'Assorti au reste.', price: 600, color: P.bloodHi, accent: '#ffffff' }),
  C({ id: 'cursor-ice', kind: 'cursor', name: 'Givre', desc: 'Froid, net, tranchant.', price: 1200, color: P.ice, accent: '#ffffff' }),
];

localiseById(SKINS, EN_COSMETICS);
localiseById(TRAILS, EN_COSMETICS);
localiseById(THEMES, EN_COSMETICS);
localiseById(CURSORS, EN_COSMETICS);

export const ALL_COSMETICS: Cosmetic[] = [...SKINS, ...TRAILS, ...THEMES, ...CURSORS];
export const COSMETIC_BY_ID = new Map(ALL_COSMETICS.map((c) => [c.id, c]));

/** Éléments possédés d'emblée : ce sont les réglages par défaut, pas des achats. */
export const FREE_IDS = ALL_COSMETICS.filter((c) => c.price === 0).map((c) => c.id);

export const KIND_LABEL: Record<CosmeticKind, string> = {
  skin: t('Teintes', 'Skins'),
  trail: t('Traînées', 'Trails'),
  theme: t('Interface', 'Interface'),
  cursor: t('Curseurs', 'Cursors'),
};
