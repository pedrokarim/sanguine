import { language } from '../i18n';

/**
 * Courbes d'apparition et événements scriptés.
 *
 * Le taux monte linéairement et le plafond simultané aussi : c'est la **densité** qui crée la
 * difficulté, jamais la vitesse des ennemis (voir `enemies.ts`).
 */

export const RUN_DURATION = 30 * 60; // 30 minutes

/**
 * Ennemis par seconde à la minute `m`.
 *
 * Valeurs calibrées au bot de test : un joueur qui kite correctement tue ~2 ennemis/s dès
 * la 3ᵉ minute. En dessous de ce débit, la population s'effondre et l'écran se vide – ce
 * qui casse à la fois la tension et la courbe d'XP, puisque l'XP vient des morts.
 *
 * Le terme carré vient d'une mesure, pas d'un goût pour les courbes. Avec un débit
 * seulement linéaire, un joueur bien équipé abattait à la vingtième minute 1748 créatures
 * par minute pour 1212 qui arrivaient : la population se stabilisait autour de cent trente
 * corps, et l'écran de la vingtième minute ressemblait à celui de la cinquième. Une horde
 * n'existe que si elle arrive plus vite qu'on ne la fauche — c'est une soustraction, pas
 * une impression. La puissance du joueur croissant elle-même par paliers multiplicatifs,
 * le débit devait cesser d'être linéaire.
 *
 * Le plafond de population (`spawnCap`) reste le garde-fou : cette courbe décide de la
 * vitesse à laquelle on s'en approche, jamais de la charge maximale de l'appareil.
 */
export function spawnRate(m: number): number {
  return 1.1 + m * 0.55 + Math.pow(m / 4.2, 2);
}

/**
 * Nombre maximal d'ennemis vivants simultanément.
 *
 * Ce plafond est un garde-fou, pas un objectif : en pratique la population s'équilibre au
 * débit de mise à mort du joueur. Le monter trop haut a été testé et produit l'effet inverse
 * de celui recherché – le joueur ne tue plus assez vite, ne ramasse plus de gemmes, et reste
 * bloqué au niveau 5 pendant que l'écran se remplit.
 */
export function spawnCap(m: number): number {
  return Math.min(160 + m * 36, PLAFOND_DUR);
}

/**
 * Plafond absolu d'ennemis vivants : la seule vraie limite de l'appareil.
 *
 * À distinguer de `spawnCap`, qui n'est qu'une courbe de rythme et vaut 268 à la troisième
 * minute. Confondre les deux a coûté cher : la Faucheuse, branchée sur la courbe, venait
 * exécuter un débutant en difficulté **dès la troisième minute**, là où le plafond n'a rien
 * d'un problème de charge. Seule cette constante décrit ce que la machine ne doit pas
 * dépasser, et seule elle a donc le droit d'appeler le rideau.
 *
 * Mesuré à 60 images par seconde, pire image à 17 ms, avec un tiers de la horde marquée.
 */
export const PLAFOND_DUR = 1100;

/**
 * Multiplicateur de PV appliqué aux ennemis.
 *
 * L'horloge seule ne suffisait pas. La puissance du joueur croît par paliers — niveaux
 * d'arme, passifs, reliques, évolutions — et bien plus vite qu'une courbe de temps. Mesuré
 * avant correction : avec un build solide de douze minutes, on pouvait poser la manette et
 * rester **immobile indéfiniment**, jusqu'à la vingt-neuvième minute, sans perdre un point
 * de vie. Rien n'atteignait le joueur, parce que tout mourait avant.
 *
 * Le second terme reprend le principe de Vampire Survivors, où les PV d'un ennemi sont
 * multipliés par le niveau du joueur au moment de son apparition : plus vous devenez fort,
 * plus ce qui vient l'est aussi. Les huit premiers niveaux en sont exemptés — le début de
 * partie sert à se mettre en jambes, pas à être puni d'avoir ramassé trois gemmes.
 *
 * Deuxième réglage, après le retour d'un testeur qui trouvait la partie trop facile. La
 * mesure lui a donné raison et a montré pourquoi : avec un build de six armes montées, le
 * joueur abattait **1071 ennemis par minute à la quinzième pour 696 qui arrivaient**. La
 * horde ne pouvait donc jamais s'accumuler, et cinq minutes d'affilée passaient sans qu'il
 * perde un seul point de vie. Ce n'était pas un défaut de courbe mais d'arithmétique : tant
 * que le débit de mise à mort dépasse celui d'apparition, l'écran se vide quoi qu'on règle
 * par ailleurs. D'où la reprise conjointe des deux termes.
 */
export function hpScale(m: number, level = 1): number {
  const fin = 1 + Math.max(0, m - LATE_FROM) * LATE_HP;
  const temps = (1 + m * 0.22 + Math.pow(m / 7.6, 2)) * fin;
  const au = Math.max(0, level - LEVEL_FRANC);
  const puissance = 1 + au * LEVEL_HP + Math.pow(Math.max(0, level - LEVEL_EMBALLE) / 22, 2);
  return temps * puissance;
}

/**
 * Surcroît de résistance du dernier tiers : minute de départ, et pente par minute.
 *
 * Passé la vingtième minute, un build abouti fauchait tout ce qui apparaissait avant le
 * contact, quelle que soit la densité : mesuré, 9 à 12 % de PV max perdus par tranche de
 * trois minutes alors que la horde touchait son plafond. La « survie pure » promise par le
 * document de conception n'existait pas. Ce facteur la rétablit, et seulement là.
 */
export const LATE_FROM = 20;
export const LATE_HP = 0.12;

/** Part de PV gagnée par niveau de joueur au-delà de `LEVEL_FRANC`. Réglé à la mesure. */
export const LEVEL_HP = 0.05;
/** Les premiers niveaux sont francs de taxe : l'ouverture sert à se mettre en jambes. */
export const LEVEL_FRANC = 8;
/**
 * Niveau à partir duquel la taxe cesse d'être linéaire.
 *
 * Une pente fixe ne peut pas suivre la boucle qui s'installe en fin de partie : les morts
 * donnent de l'expérience, l'expérience donne des niveaux, les niveaux donnent de la
 * puissance, la puissance donne des morts. Mesuré, elle porte un joueur au **niveau 106 dès
 * la quatorzième minute** — sa puissance y a bien plus que doublé, quand une taxe de 5 % par
 * niveau ne multipliait la résistance que par six. Le terme carré rattrape précisément cet
 * écart, et seulement lui : en deçà du seuil il vaut zéro et ne change rien à ce qui a été
 * réglé pour l'ouverture et le milieu de partie.
 */
export const LEVEL_EMBALLE = 30;

/**
 * Au-delà de ce nombre d'ennemis vivants, les murs cessent de bloquer les terrestres.
 *
 * Garde-fou de performance, réglé par la mesure. Le jeu tient 60 images par seconde avec 750
 * ennemis ; il faut que la collision ne puisse jamais être la cause d'une chute, même dans
 * le pire cas d'une Déferlante contre une nef à huit colonnes.
 */
export const MURS_MAX_ENNEMIS = 420;

/**
 * Multiplicateur de dégâts appliqué aux ennemis à la minute `m`.
 *
 * Volontairement plus plat que la courbe de résistance. La difficulté doit venir du
 * **nombre**, pas de la violence de chaque contact : mesuré à l'ancienne pente, un joueur
 * de cent points de vie mourait en trois touches à la quatorzième minute, ce qui produisait
 * une partie sans aucun dégât pendant cinq minutes puis une mort instantanée. Une horde
 * dense qui grignote laisse voir venir sa fin et donne le temps de réagir ; trois touches
 * fatales ne laissent rien à jouer.
 */
export function damageScale(m: number): number {
  return 1 + m * 0.032;
}

/**
 * Rangs de résistance.
 *
 * La montée générale des PV durcit tout le monde à la fois : au bout de quinze minutes,
 * chaque créature demande vingt fois plus de coups qu'à la première, mais l'écran reste
 * uniforme. Rien ne dit au joueur où porter ses efforts, et une horde entièrement coriace
 * se lit comme une horde entièrement molle — seulement plus lente à faucher.
 *
 * Ces rangs cassent l'uniformité. Une minorité d'ennemis est nettement plus dure que le
 * fond, et le **signale** : chaque rang porte son calque (voir `renderer.ts`), pour qu'on
 * décide en un coup d'œil quoi contourner et quoi abattre. Un ennemi trois fois plus
 * résistant sans marque visible n'est pas une difficulté, c'est une surprise désagréable.
 */
export interface Rang {
  id: 'endurci' | 'elite' | 'colosse';
  nom: string;
  /** Multiplicateur de points de vie. */
  hp: number;
  /** Multiplicateur de rayon — un colosse doit se voir venir. */
  taille: number;
  /** Part de la vitesse conservée : plus c'est dur, plus c'est lent. */
  vitesse: number;
  /** Teinte du calque, en RVB. */
  teinte: [number, number, number];
}

export const RANGS: Rang[] = [
  // Cyan franc plutôt que bleu pâle : relevé en capture, le bleu disparaissait dans la
  // teinte rouge du cimetière, et un rang qu'on ne voit pas ne sert à rien.
  { id: 'endurci', nom: 'Endurci', hp: 2.4, taille: 1.12, vitesse: 0.96, teinte: [90, 230, 255] },
  { id: 'elite', nom: 'Élite', hp: 6, taille: 1.4, vitesse: 0.9, teinte: [255, 196, 90] },
  { id: 'colosse', nom: 'Colosse', hp: 18, taille: 1.85, vitesse: 0.74, teinte: [230, 90, 255] },
];

export const RANG_BY_ID = new Map<Rang['id'], Rang>(RANGS.map((r) => [r.id, r]));

/**
 * Probabilité de chaque rang à la minute `m`.
 *
 * Les seuils sont décalés : on croise des endurcis bien avant le premier colosse, si bien
 * que le vocabulaire visuel s'apprend par paliers au lieu d'arriver d'un bloc.
 *
 * Ils ont été repoussés après mesure. Ouverts dès la deuxième minute, ils tuaient un joueur
 * encore désarmé : le bot de test, qui monte son build au hasard, passait d'une mort à la
 * septième minute à une mort à la **troisième et demie**, quatre fois sur quatre. Un ennemi
 * deux fois et demie plus résistant n'a rien d'un obstacle intéressant quand on n'a qu'une
 * arme de niveau un — il est simplement impossible à écarter.
 */
export function rangChances(m: number): { endurci: number; elite: number; colosse: number } {
  return {
    endurci: m < 5 ? 0 : Math.min(0.22, 0.015 + (m - 5) * 0.013),
    elite: m < 9 ? 0 : Math.min(0.07, 0.006 + (m - 9) * 0.0034),
    colosse: m < 14 ? 0 : Math.min(0.02, 0.002 + (m - 14) * 0.0012),
  };
}

export type WaveEventKind =
  | 'ring' // cercle fermé autour du joueur
  | 'flank' // un seul flanc
  | 'wall' // mur qui traverse
  | 'clusters' // grappes dispersées
  | 'column' // formation en ligne
  | 'volleys' // salves successives
  | 'surge' // multiplicateur temporaire du taux
  | 'boss';

export interface WaveEvent {
  /** Minute de déclenchement. */
  at: number;
  kind: WaveEventKind;
  enemy: string;
  count: number;
  label: string;
  /** Pour `surge` : multiplicateur et durée. */
  mult?: number;
  duration?: number;
}

/**
 * Boss errants.
 *
 * Les quatre boss scriptés tombent toujours aux mêmes minutes : au troisième run, on sait
 * ce qui arrive et quand. Ceux-ci apparaissent au hasard, rarement, et rompent la routine
 * d'une partie qui, autrement, se déroule à l'identique.
 *
 * `from` empêche de croiser un boss de la vingtième minute à la sixième : la rareté doit
 * surprendre, pas exécuter.
 */
export interface Rodeur {
  enemy: string;
  label: string;
  from: number;
}

export const RODEURS: Rodeur[] = [
  { enemy: 'matron', label: 'Une Matrone', from: 7 },
  { enemy: 'exsanguine', label: 'Un Chevalier Exsangue', from: 12 },
  { enemy: 'ashchoir', label: 'Un Chœur de Cendres', from: 17 },
];

/**
 * Première minute où un rôdeur peut paraître.
 *
 * Seuls de vrais boss rôdent. Un ennemi ordinaire gonflé en points de vie n'aurait ni barre,
 * ni musique, ni récompense à sa chute : le joueur y verrait un sac à PV, pas un événement.
 */
export const RODEUR_DEBUT = 7;
/** Écart minimal entre deux rôdeurs, en secondes. */
export const RODEUR_ECART = 52;
/** Probabilité, à chaque tirage, qu'un rôdeur se présente. */
export const RODEUR_CHANCE = 0.45;
/** Plafond par partie : au-delà, ce n'est plus une surprise mais une routine. */
export const RODEUR_MAX = 11;

/**
 * Nombre de boss vivants en même temps, toutes provenances confondues.
 *
 * Plafond ferme, pour deux raisons qui vont dans le même sens. Le coût d'abord : un boss
 * est un corps large, avec ses invocations et ses particules ; l'appareil du joueur n'a
 * pas à en encaisser un nombre non borné. La lisibilité ensuite : au-delà de trois barres
 * de vie et de trois thèmes sonores simultanés, on ne combat plus rien, on subit du bruit.
 */
export const BOSS_MAX_SIMULTANES = 3;

/*
 * Le champ `count` d'un événement `boss` vaut le **nombre de corps** à faire lever.
 *
 * Un boss unique par palier ne pesait plus rien passé la douzième minute : le joueur a
 * alors de quoi le fondre plus vite qu'il n'approche. Ils viennent donc à plusieurs, en
 * nombre croissant, et le plafond simultané (`BOSS_MAX_SIMULTANES`) empêche que les
 * rôdeurs ne s'y ajoutent au-delà du raisonnable.
 *
 * Le Sanguinaire reste seul : c'est la fin, elle se joue en duel.
 */
export const WAVE_EVENTS: WaveEvent[] = [
  { at: 3, kind: 'ring', enemy: 'bat', count: 60, label: 'Nuée' },
  { at: 6, kind: 'flank', enemy: 'wolf', count: 20, label: 'Meute' },
  { at: 9, kind: 'wall', enemy: 'ghoul', count: 40, label: 'Marée' },
  { at: 10, kind: 'boss', enemy: 'matron', count: 1, label: 'La Matrone' },
  { at: 13, kind: 'clusters', enemy: 'spider', count: 12, label: 'Nid' },
  { at: 15, kind: 'column', enemy: 'skeleton', count: 30, label: 'Colonne' },
  { at: 16, kind: 'boss', enemy: 'matron', count: 2, label: 'Les Matrones' },
  { at: 18, kind: 'boss', enemy: 'exsanguine', count: 2, label: 'Les Chevaliers Exsangues' },
  { at: 21, kind: 'volleys', enemy: 'rider', count: 25, label: 'Charge' },
  { at: 22, kind: 'boss', enemy: 'exsanguine', count: 3, label: 'La Garde Exsangue' },
  { at: 24, kind: 'boss', enemy: 'ashchoir', count: 1, label: 'Chœur de Cendres' },
  { at: 26, kind: 'flank', enemy: 'golem', count: 15, label: 'Écrasement' },
  { at: 27, kind: 'boss', enemy: 'ashchoir', count: 2, label: 'Les Chœurs' },
  { at: 28, kind: 'surge', enemy: '', count: 0, label: 'Déferlante', mult: 3, duration: 90 },
  { at: 30, kind: 'boss', enemy: 'sanguine', count: 1, label: 'Le Sanguinaire' },
];

if (language() === 'en') {
  const ranks: Record<string, string> = { endurci: 'Hardened', elite: 'Elite', colosse: 'Colossus' };
  for (const rank of RANGS) rank.nom = ranks[rank.id] ?? rank.nom;
  const roamers = ['A Matron', 'A Bloodless Knight', 'A Choir of Ashes'];
  RODEURS.forEach((roamer, i) => { if (roamers[i]) roamer.label = roamers[i]!; });
  const events = ['Swarm', 'Pack', 'Tide', 'The Matron', 'Nest', 'Column', 'The Matrons', 'The Bloodless Knights', 'Charge', 'The Bloodless Guard', 'Choir of Ashes', 'Crushing Force', 'The Choirs', 'Onslaught', 'The Sanguinary'];
  WAVE_EVENTS.forEach((event, i) => { if (events[i]) event.label = events[i]!; });
}

/**
 * Courbe d'XP. Le palier initial doit être bas : les premières cartes sont ce qui donne
 * au joueur le sentiment d'exister, et les faire attendre une minute tue l'ouverture.
 * Mesuré au bot : ~6 niveaux la première minute, ~20 à la cinquième.
 *
 * Le terme carré, lui, répond à un testeur qui trouvait la partie jouée d'avance passé les
 * premières minutes. La mesure lui a donné raison (`tools/balance-bot.js`, build de
 * référence à la douzième minute) : le joueur finissait au **niveau 199**, et ne perdait
 * plus, par tranche de trois minutes, que 0 à 27 % de ses PV max entre la treizième et la
 * trentième. Dix-huit minutes sans enjeu. La courbe ne change rien avant le niveau 45,
 * atteint vers la neuvième minute – l'ouverture garde son rythme de cartes – puis se
 * redresse : la partie se termine désormais autour du niveau 115.
 */
export const XP_LATE_FROM = 45;
export const XP_LATE = 2.2;

export function xpForLevel(level: number): number {
  const late = Math.max(0, level - XP_LATE_FROM);
  return Math.round(4 + level * 5.5 + Math.pow(level, 1.5) + XP_LATE * late * late);
}

/**
 * Or que les ennemis ordinaires peuvent lâcher, en pièces par seconde, à la minute `m`.
 *
 * C'est l'horloge qui paie, pas le débit de mise à mort (voir `World.dropGold`). La pente
 * reproduit le revenu mesuré des six premières minutes – environ 170 pièces par minute – et
 * le prolonge au lieu de le laisser s'emballer : de l'ordre de 2 600 pièces à la dixième
 * minute, 14 000 sur une partie complète, hors boss, coffres et puits.
 */
export function goldRate(m: number): number {
  return 2.5 + m * 0.35;
}

/** Réserve maximale : une accalmie ne doit pas se solder par une pluie de pièces. */
export const GOLD_BUDGET_MAX = 150;
/** Table de butin : probabilité de chaque objet à la mort d'un ennemi ordinaire. */
export const DROP_TABLE = {
  goldCoin: 0.12,
  goldBag: 0.01,
  heart: 0.015,
  magnet: 0.005,
  censer: 0.003,
  bomb: 0.004,
  hourglass: 0.003,
  scroll: 0.0025,
} as const;
