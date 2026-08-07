import { damp, clamp } from '../core/math';
import { fxRng } from '../core/rng';

/**
 * Caméra : suit le joueur avec un léger retard, et accumule un « traumatisme » qui se traduit
 * en secousse. La progression quadratique du traumatisme est essentielle : sans elle, la
 * multitude de petits impacts d'un survivor-like ferait trembler l'écran en permanence.
 */
export class Camera {
  x = 0;
  y = 0;
  /** Traumatisme ∈ [0,1]. La secousse vaut `trauma² × maxShake`. */
  private trauma = 0;
  private shakeX = 0;
  private shakeY = 0;
  /**
   * Amplitude maximale en pixels **logiques**. À l'échelle ×4 d'un écran 1080p, 3 px
   * logiques font déjà 12 px réels : c'est largement suffisant pour se faire sentir.
   * Une valeur plus élevée provoque un tremblement continu réellement pénible à regarder,
   * puisqu'un survivor-like enchaîne les impacts en permanence.
   */
  private maxShake = 3;

  /** Phase des oscillateurs : une secousse lissée est bien moins agressive qu'un bruit blanc. */
  private phaseX = fxRng.angle();
  private phaseY = fxRng.angle();

  /** Multiplicateur global : 0 = aucune secousse, réglable dans les options. */
  intensity = 0.55;

  constructor(
    public viewW: number,
    public viewH: number,
  ) {}

  /** Adapte la caméra à une nouvelle résolution logique. */
  resize(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
  }

  snapTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  follow(tx: number, ty: number, dt: number): void {
    // `damp` garde le suivi identique quel que soit le framerate.
    this.x = damp(this.x, tx, 0.0006, dt);
    this.y = damp(this.y, ty, 0.0006, dt);
  }

  /**
   * Ajoute du traumatisme. `amount` typique : 0.06 (mort d'un ennemi lourd) à 0.3 (boss).
   *
   * Le traumatisme est **plafonné à 0.6** hors événements majeurs : c'est ce qui empêche
   * l'accumulation de dizaines de petits impacts de saturer l'écran en tremblement continu.
   */
  shake(amount: number, major = false): void {
    if (this.intensity <= 0) return;
    const cap = major ? 1 : 0.6;
    this.trauma = clamp(this.trauma + amount * this.intensity, 0, cap);
  }

  update(dt: number): void {
    if (this.trauma <= 0) {
      this.shakeX = 0;
      this.shakeY = 0;
      return;
    }
    // Décroissance rapide : la secousse doit être un accent, pas un état.
    this.trauma = Math.max(0, this.trauma - 3.2 * dt);
    const s = this.trauma * this.trauma * this.maxShake;

    // Oscillation sinusoïdale à deux fréquences plutôt qu'un bruit blanc : le mouvement
    // reste continu d'une frame à l'autre, donc lisible, au lieu de scintiller.
    this.phaseX += dt * 41;
    this.phaseY += dt * 33;
    this.shakeX = Math.sin(this.phaseX) * s;
    this.shakeY = Math.cos(this.phaseY * 1.31) * s * 0.75;
  }

  /** Décalage à appliquer au rendu : monde → écran. */
  get offsetX(): number {
    return Math.round(-this.x + this.viewW / 2 + this.shakeX);
  }

  get offsetY(): number {
    return Math.round(-this.y + this.viewH / 2 + this.shakeY);
  }

  /** Test de culling : l'entité est-elle visible (avec une marge) ? */
  visible(x: number, y: number, margin = 32): boolean {
    const hx = this.viewW / 2 + margin;
    const hy = this.viewH / 2 + margin;
    return Math.abs(x - this.x) <= hx && Math.abs(y - this.y) <= hy;
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: sx + this.x - this.viewW / 2, y: sy + this.y - this.viewH / 2 };
  }
}
