/**
 * Courbes d'apparition et événements scriptés.
 *
 * Le taux monte linéairement et le plafond simultané aussi : c'est la **densité** qui crée la
 * difficulté, jamais la vitesse des ennemis (voir `enemies.ts`).
 */

export const RUN_DURATION = 30 * 60; // 30 minutes

/**
 * Ennemis par seconde à la minute `m`.
 *
 * Valeurs calibrées au bot de test : un joueur qui kite correctement tue ~2 ennemis/s dès
 * la 3ᵉ minute. En dessous de ce débit, la population s'effondre et l'écran se vide — ce
 * qui casse à la fois la tension et la courbe d'XP, puisque l'XP vient des morts.
 */
export function spawnRate(m: number): number {
  return 1.1 + m * 0.7;
}

/**
 * Nombre maximal d'ennemis vivants simultanément.
 *
 * Ce plafond est un garde-fou, pas un objectif : en pratique la population s'équilibre au
 * débit de mise à mort du joueur. Le monter trop haut a été testé et produit l'effet inverse
 * de celui recherché — le joueur ne tue plus assez vite, ne ramasse plus de gemmes, et reste
 * bloqué au niveau 5 pendant que l'écran se remplit.
 */
export function spawnCap(m: number): number {
  return Math.min(160 + m * 36, 1100);
}

/** Multiplicateur de PV appliqué aux ennemis à la minute `m`. */
export function hpScale(m: number): number {
  return 1 + m * 0.16 + Math.pow(m / 9, 2);
}

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
  /** Pour `surge` : multiplicateur et durée. */
  mult?: number;
  duration?: number;
}

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
 * Courbe d'XP. Le palier initial doit être bas : les premières cartes sont ce qui donne
 * au joueur le sentiment d'exister, et les faire attendre une minute tue l'ouverture.
 * Mesuré au bot : ~6 niveaux la première minute, ~20 à la cinquième, ~65 sur un run complet.
 */
export function xpForLevel(level: number): number {
  return Math.round(4 + level * 5.5 + Math.pow(level, 1.5));
}

/** Table de butin : probabilité de chaque objet à la mort d'un ennemi ordinaire. */
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
