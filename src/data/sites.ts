import { t } from '../i18n';

/**
 * Noms des lieux du monde et de leurs points remarquables.
 *
 * Les textes sont résolus à la construction du lieu : ils restent de simples chaînes pour tout
 * ce qui les lit ensuite, à commencer par le système de quêtes.
 */

/** Château : un nom par château, tiré à la graine, sans répétition dans une même partie. */
export const castleNames = (): string[] => [
  t('Château de Malvoisine', 'Malvoisine Keep'),
  t('Citadelle de l’Exsangue', 'Citadel of the Bloodless'),
  t('Forteresse des Veilleurs', 'Fortress of the Watchers'),
  t('Château de la Dernière Messe', 'Castle of the Last Mass'),
  t('Bastion de Saint-Ombre', 'Bastion of Saint Shade'),
  t('Haut-Sang', 'High Blood'),
];

export const villageNames = (): string[] => [
  t('Morteville', 'Deadhamlet'),
  t('Les Fosses-Sainte-Anne', 'Saint Anne’s Pits'),
  t('Bourg-la-Cendre', 'Ashborough'),
  t('Vieux-Gibet', 'Old Gallows'),
  t('Hautefange', 'Highmire'),
  t('Sept-Croix', 'Seven Crosses'),
  t('Le Val-Muet', 'Silent Vale'),
  t('Noirmoutier-des-Bois', 'Blackminster Wood'),
  t('Saint-Oubli', 'Saint Forgotten'),
  t('La Pendue', 'The Hanged Woman'),
  t('Ronce-Vieille', 'Oldbramble'),
  t('Les Deux-Clochers', 'Two Belfries'),
];

export const cemeteryNames = (): string[] => [
  t('Cimetière des Pendus', 'Graveyard of the Hanged'),
  t('Le Champ des Cloches', 'The Field of Bells'),
  t('Cimetière Saint-Lazare', 'Saint Lazarus Graveyard'),
  t('Les Sept Fosses', 'The Seven Pits'),
];

export const prioryNames = (): string[] => [
  t('Prieuré du Silence', 'Priory of Silence'),
  t('Abbaye Sainte-Cendre', 'Saint Ash Abbey'),
  t('Prieuré des Veuves', 'Priory of the Widows'),
  t('Abbaye du Dernier Office', 'Abbey of the Last Office'),
];

export const cemeterySubtitle = (): string => t('ne marchez pas sur les tombes', 'do not walk on the graves');
export const cemeteryWarning = (): string => t('les morts se lèvent', 'the dead are rising');
export const priorySubtitle = (): string => t('l’office n’a jamais cessé', 'the office never ended');

export const cemeteryPointNames = (): Record<string, string> => ({
  gate: t('Grille', 'Gate'),
  calvary: t('Calvaire', 'Calvary'),
  crypt: t('Crypte', 'Crypt'),
  grave: t('Fosse ouverte', 'Open Grave'),
});

export const prioryPointNames = (): Record<string, string> => ({
  gate: t('Grille', 'Gate'),
  nave: t('Nef', 'Nave'),
  altar: t('Autel', 'Altar'),
  cloister: t('Cloître', 'Cloister'),
  monks: t('Carré des moines', 'Monks’ Graves'),
});

/** Sous-titre affiché à l'entrée dans un lieu. */
export const castleSubtitle = (): string => t('ses portes n’ont jamais été fermées', 'its gates were never shut');
export const villageSubtitle = (): string => t('ici, il y avait un village', 'there was a village here');

/** Points remarquables du château, dans l'ordre d'une visite. */
export const castlePointNames = (): Record<string, string> => ({
  gate: t('Grande porte', 'Great Gate'),
  bailey: t('Basse-cour', 'Outer Bailey'),
  stables: t('Puits de la basse-cour', 'Bailey Well'),
  gallows: t('Gibet', 'Gallows'),
  innerGate: t('Porte de la haute cour', 'Inner Gate'),
  breach: t('Brèche', 'The Breach'),
  ward: t('Haute cour', 'Inner Ward'),
  fountain: t('Fontaine rouge', 'Red Fountain'),
  hall: t('Grande salle', 'Great Hall'),
  throne: t('Trône', 'Throne'),
  crypt: t('Crypte', 'Crypt'),
  armory: t('Armurerie', 'Armory'),
  library: t('Bibliothèque', 'Library'),
  chapel: t('Chapelle', 'Chapel'),
  altar: t('Autel', 'Altar'),
  barracks: t('Caserne', 'Barracks'),
  graveyard: t('Cimetière des gardes', 'Guards’ Graveyard'),
});

export const villagePointNames = (): Record<string, string> => ({
  square: t('Place', 'Square'),
  well: t('Puits', 'Well'),
  church: t('Église', 'Church'),
  graveyard: t('Cimetière', 'Graveyard'),
  smithy: t('Forge', 'Smithy'),
  inn: t('Auberge', 'Inn'),
  barn: t('Grange', 'Barn'),
  street: t('Grand-rue', 'High Street'),
});
