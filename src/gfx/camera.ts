import { damp, clamp, lerp } from '../core/math';
import { fxRng } from '../core/rng';

/**
 * Caméra : suit le joueur avec un léger retard, et accumule un « traumatisme » qui se traduit
 * en secousse. La progression quadratique du traumatisme est essentielle : sans elle, la
 * multitude de petits impacts d'un survivor-like ferait trembler l'écran en permanence.
 */
/** Écart, en pixels, au-delà duquel le retard arrondi est recalculé. Un demi-pixel suffirait
 * en théorie ; la marge absorbe le bruit numérique autour de la frontière. */
const LAG_HYSTERESIS = 0.65;

export class Camera {
  x = 0;
  y = 0;
  /** Position au pas de simulation précédent, pour lisser le rendu entre deux pas. */
  private prevX = 0;
  private prevY = 0;
  /** Position réellement utilisée par le rendu de l'image courante. Voir `frame`. */
  private viewX = 0;
  private viewY = 0;
  /** Retard de la caméra sur sa cible, en pixels entiers. */
  private lagX = 0;
  private lagY = 0;
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
    this.prevX = x;
    this.prevY = y;
    this.viewX = x;
    this.viewY = y;
    this.lagX = 0;
    this.lagY = 0;
  }

  follow(tx: number, ty: number, dt: number): void {
    this.prevX = this.x;
    this.prevY = this.y;
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

  /**
   * Fixe la position de rendu de l'image courante. À appeler une fois, avant tout tracé.
   *
   * Deux défauts faisaient « gigoter » l'écran dès que le personnage marchait.
   *
   * La caméra n'avançait qu'aux pas de simulation, soixante fois par seconde, alors que le
   * joueur est interpolé entre deux pas. Sur un écran qui n'est pas exactement à 60 Hz, le
   * décor avançait donc de zéro ou de deux crans selon l'image. Elle est maintenant
   * interpolée comme le reste (`alpha`).
   *
   * Surtout, le joueur et la caméra étaient arrondis chacun de son côté. Comme la caméra
   * suit avec un léger retard, leurs parties fractionnaires ne coïncident pas : la somme des
   * deux arrondis oscillait, et le personnage sautait d'un pixel logique – trois ou quatre
   * pixels réels – d'une image à l'autre. On arrondit donc **le retard**, pas la caméra :
   * la position de rendu se déduit de la cible, à un nombre entier de pixels près. Tant que
   * le retard est stable, le joueur occupe exactement le même pixel d'écran, et le décor
   * défile par crans réguliers, calés sur son mouvement.
   *
   * L'hystérésis évite l'autre piège : un retard posé pile entre deux entiers basculerait
   * d'une image à l'autre et rétablirait le tremblement qu'on vient d'enlever.
   */
  frame(alpha: number, targetX: number, targetY: number): void {
    const cx = lerp(this.prevX, this.x, alpha);
    const cy = lerp(this.prevY, this.y, alpha);
    const lx = targetX - cx;
    const ly = targetY - cy;
    if (Math.abs(lx - this.lagX) > LAG_HYSTERESIS) this.lagX = Math.round(lx);
    if (Math.abs(ly - this.lagY) > LAG_HYSTERESIS) this.lagY = Math.round(ly);
    this.viewX = targetX - this.lagX;
    this.viewY = targetY - this.lagY;
  }

  /**
   * Décalage à appliquer au rendu : monde → écran.
   *
   * La secousse est arrondie à part, pour ne pas réintroduire de partie fractionnaire dans
   * la position de suivi.
   *
   * Le centre est pris en pixels entiers : la vue peut avoir une largeur impaire (601 px
   * mesurés), et un demi-pixel de centre suffisait à faire osciller le joueur entre deux
   * colonnes alors même que le retard était parfaitement stable.
   */
  get offsetX(): number {
    return Math.round(-this.viewX + Math.floor(this.viewW / 2)) + Math.round(this.shakeX);
  }

  get offsetY(): number {
    return Math.round(-this.viewY + Math.floor(this.viewH / 2)) + Math.round(this.shakeY);
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
