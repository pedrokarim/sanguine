/**
 * La grille des positions à l'écran.
 *
 * Le dessin reste en pixels de jeu : un sprite garde ses gros pixels nets. Mais sa **position** se
 * cale sur le pixel de l'écran, pas sur le pixel de jeu.
 *
 * Calée sur le pixel de jeu, une caméra à 100 px/s et 60 Hz doit avancer de 1,67 : elle alterne des
 * pas de 1 et de 2, soit 2 et 4 pixels d'écran à l'échelle ×2. Ce rythme boiteux, mesuré à 85 %
 * d'irrégularité, était la saccade que l'œil voyait sur tout ce qui défile. Aucune optimisation
 * ne pouvait l'enlever : elle ne venait pas du temps de calcul, mais de l'arrondi.
 */

let scale = 1;

/** Pixels d'écran par pixel de jeu. Toujours entier, voir `resize`. */
export function gridScale(): number {
  return scale;
}

export function setGridScale(value: number): void {
  scale = value;
}

/** Arrondit une position au pixel d'écran le plus proche. */
export function snap(value: number): number {
  return Math.round(value * scale) / scale;
}
