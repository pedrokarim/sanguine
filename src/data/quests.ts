import { t } from '../i18n';
import type { SiteKind } from '../game/sites';
import type { Rang } from './waves';

/**
 * La trame d'une partie : un village, puis le château, jusqu'au trône.
 *
 * Chaque étape nomme un point d'un lieu (`SitePoint.id`), jamais une coordonnée : les lieux changent
 * avec la graine, et le plan du château peut bouger sans qu'on touche à cette table.
 */

/** « de Saint-Oubli », « du Val-Muet », « des Deux-Clochers » : un nom de lieu garde son article. */
function ofPlace(site: string): string {
  if (site.startsWith('Les ')) return `des ${site.slice(4)}`;
  if (site.startsWith('Le ')) return `du ${site.slice(3)}`;
  return `de ${site}`;
}

export type QuestReward = 'chest' | 'relic' | 'gold' | 'heal';

export interface QuestStep {
  goal: (site: string) => string;
  /** Où le joueur doit se rendre. */
  point: string;
  /** Morts à obtenir dans le lieu, une fois arrivé. */
  slay?: number;
  /** Se lève à l'arrivée ; l'étape se termine à sa mort. */
  guardian?: { enemy: string; rank: Rang['id'] };
}

export interface QuestDef {
  id: string;
  place: Extract<SiteKind, 'village' | 'castle' | 'cemetery' | 'priory'>;
  title: (site: string) => string;
  /** Ce que le joueur lit au lancement, sous le titre. */
  intro: string;
  steps: readonly QuestStep[];
  rewards: readonly QuestReward[];
}

export const QUESTS: readonly QuestDef[] = [
  {
    id: 'bells', place: 'village',
    title: (site) => t(`Les cloches ${ofPlace(site)}`, `The bells of ${site}`),
    intro: t('quelqu’un sonne encore, là où il n’y a plus personne', 'someone still rings where nobody is left'),
    steps: [
      { point: 'well', goal: (site) => t(`Rejoindre le puits ${ofPlace(site)}`, `Reach the well of ${site}`) },
      { point: 'square', slay: 15, goal: (site) => t(`Chasser ce qui hante ${site}`, `Drive out what haunts ${site}`) },
    ],
    rewards: ['chest'],
  },
  {
    id: 'church', place: 'village',
    title: () => t('L’église éventrée', 'The gutted church'),
    intro: t('la cloche sonne seule, et quelque chose la garde', 'the bell rings alone, and something guards it'),
    steps: [
      { point: 'church', goal: (site) => t(`Entrer dans l’église ${ofPlace(site)}`, `Enter the church of ${site}`) },
      { point: 'church', guardian: { enemy: 'wraith', rank: 'elite' }, goal: () => t('Abattre le sonneur', 'Slay the bell-ringer') },
    ],
    rewards: ['relic'],
  },
  {
    id: 'cemetery', place: 'cemetery',
    title: () => t('Ceux qui ne dorment pas', 'Those who do not sleep'),
    intro: t('la cloche sonnait pour eux', 'the bell was ringing for them'),
    steps: [
      { point: 'gate', goal: (site) => t(`Passer la grille : ${site}`, `Pass the gate: ${site}`) },
      { point: 'calvary', slay: 30, goal: () => t('Survivre aux morts, jusqu’au calvaire', 'Survive the dead, up to the calvary') },
    ],
    rewards: ['chest'],
  },
  {
    id: 'priory', place: 'priory',
    title: () => t('Le dernier office', 'The last office'),
    intro: t('les moines chantent encore, sans bouche', 'the monks still sing, without mouths'),
    steps: [
      { point: 'nave', goal: (site) => t(`Entrer dans la nef : ${site}`, `Enter the nave: ${site}`) },
      { point: 'altar', slay: 20, goal: () => t('Faire taire le chœur, jusqu’à l’autel', 'Silence the choir, up to the altar') },
    ],
    rewards: ['relic'],
  },
  {
    id: 'gate', place: 'castle',
    title: () => t('Aux portes du château', 'At the castle gates'),
    intro: t('la cloche répondait à celle du château', 'the bell was answering the castle’s'),
    steps: [
      { point: 'gate', goal: () => t('Atteindre la grande porte', 'Reach the great gate') },
      { point: 'bailey', slay: 25, goal: () => t('Forcer la basse-cour', 'Force the outer bailey') },
      { point: 'fountain', goal: () => t('Gagner la fontaine de la haute cour', 'Reach the fountain of the inner ward') },
    ],
    rewards: ['heal', 'gold'],
  },
  {
    id: 'archives', place: 'castle',
    title: () => t('Ce que le château cache', 'What the castle hides'),
    intro: t('le seigneur a tout écrit, puis tout enterré', 'the lord wrote it all down, then buried it'),
    steps: [
      { point: 'library', goal: () => t('Fouiller la bibliothèque', 'Search the library') },
      { point: 'crypt', slay: 20, goal: () => t('Descendre dans la crypte', 'Descend into the crypt') },
    ],
    rewards: ['relic'],
  },
  {
    id: 'throne', place: 'castle',
    title: () => t('La salle du trône', 'The throne room'),
    intro: t('il attend depuis trop longtemps', 'it has waited too long'),
    steps: [
      { point: 'throne', goal: () => t('Rejoindre le trône', 'Reach the throne') },
      { point: 'throne', guardian: { enemy: 'golem', rank: 'colosse' }, goal: () => t('Abattre le gardien du trône', 'Slay the throne’s keeper') },
    ],
    rewards: ['relic', 'chest'],
  },
];

/** Une fois la trame finie, chaque village encore debout reste une raison de marcher. */
export const PURGE_QUEST: QuestDef = {
  id: 'purge', place: 'village',
  title: (site) => t(`Purger ${site}`, `Purge ${site}`),
  intro: t('la cloche s’est tue, pas ce qu’elle appelait', 'the bell fell silent, what it called did not'),
  steps: [
    { point: 'square', slay: 25, goal: (site) => t(`Nettoyer ${site}`, `Cleanse ${site}`) },
  ],
  rewards: ['chest', 'gold'],
};
