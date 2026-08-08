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
 */
export function spawnRate(m: number): number {
  return 1.1 + m * 0.7;
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
  return Math.min(160 + m * 36, 1100);
}

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
 */
export function hpScale(m: number, level = 1): number {
  const temps = 1 + m * 0.16 + Math.pow(m / 9, 2);
  const puissance = 1 + Math.max(0, level - 8) * LEVEL_HP;
  return temps * puissance;
}

/** Part de PV gagnée par niveau de joueur au-delà du huitième. Réglé à la mesure. */
export const LEVEL_HP = 0.05;

/**
 * Au-delà de ce nombre d'ennemis vivants, les murs cessent de bloquer les terrestres.
 *
 * Garde-fou de performance, réglé par la mesure. Le jeu tient 60 images par seconde avec 750
 * ennemis ; il faut que la collision ne puisse jamais être la cause d'une chute, même dans
 * le pire cas d'une Déferlante contre une nef à huit colonnes.
 */
export const MURS_MAX_ENNEMIS = 420;

/** Multiplicateur de dégâts appliqué aux ennemis à la minute `m`. */
export function damageScale(m: number): number {
  return 1 + m * 0.05;
}

/** Probabilité qu'un ennemi apparaisse en élite. */
export function eliteChance(m: number): number {
  return m < 6 ? 0 : Math.min(0.028, 0.006 + m * 0.0009);
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
export const RODEUR_ECART = 75;
/** Probabilité, à chaque tirage, qu'un rôdeur se présente. */
export const RODEUR_CHANCE = 0.34;
/** Plafond par partie : au-delà, ce n'est plus une surprise mais une routine. */
export const RODEUR_MAX = 5;

export const WAVE_EVENTS: WaveEvent[] = [
  { at: 3, kind: 'ring', enemy: 'bat', count: 60, label: 'Nuée' },
  { at: 6, kind: 'flank', enemy: 'wolf', count: 20, label: 'Meute' },
  { at: 9, kind: 'wall', enemy: 'ghoul', count: 40, label: 'Marée' },
  { at: 10, kind: 'boss', enemy: 'matron', count: 1, label: 'La Matrone' },
  { at: 13, kind: 'clusters', enemy: 'spider', count: 12, label: 'Nid' },
  { at: 15, kind: 'column', enemy: 'skeleton', count: 30, label: 'Colonne' },
  { at: 18, kind: 'boss', enemy: 'exsanguine', count: 1, label: 'Le Chevalier Exsangue' },
  { at: 21, kind: 'volleys', enemy: 'rider', count: 25, label: 'Charge' },
  { at: 24, kind: 'boss', enemy: 'ashchoir', count: 1, label: 'Chœur de Cendres' },
  { at: 26, kind: 'flank', enemy: 'golem', count: 15, label: 'Écrasement' },
  { at: 28, kind: 'surge', enemy: '', count: 0, label: 'Déferlante', mult: 3, duration: 90 },
  { at: 30, kind: 'boss', enemy: 'sanguine', count: 1, label: 'Le Sanguinaire' },
];

/**
 * Courbe d'XP. Le palier initial doit être bas : les premières cartes sont ce qui donne
 * au joueur le sentiment d'exister, et les faire attendre une minute tue l'ouverture.
 * Mesuré au bot : ~6 niveaux la première minute, ~20 à la cinquième, ~65 sur un run complet.
 */
export function xpForLevel(level: number): number {
  return Math.round(4 + level * 5.5 + Math.pow(level, 1.5));
}

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
