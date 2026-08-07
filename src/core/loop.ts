/**
 * Boucle à pas fixe avec interpolation de rendu.
 *
 * La simulation avance toujours par pas de 1/60 s, quelle que soit la fréquence de l'écran :
 * la physique et l'équilibrage sont donc identiques sur un 60 Hz et sur un 144 Hz. Le rendu,
 * lui, tourne à la fréquence de l'écran et interpole entre les deux derniers états.
 */

export const STEP = 1 / 60;
const MAX_FRAME = 0.25; // 250 ms : au-delà, on abandonne le rattrapage
const MAX_STEPS = 5; // garde-fou anti « spirale de la mort »

export interface LoopHooks {
  update(dt: number): void;
  /** `alpha` ∈ [0,1) : position dans le pas courant, pour interpoler le rendu. */
  render(alpha: number): void;
}

export class Loop {
  private accumulator = 0;
  private last = 0;
  private rafId = 0;
  private running = false;

  /** Moyenne glissante des FPS, pour l'affichage de debug. */
  fps = 60;
  /** Durée du dernier `update` complet, en ms. */
  updateMs = 0;
  /** Durée du dernier `render`, en ms. */
  renderMs = 0;

  constructor(private readonly hooks: LoopHooks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);

    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > MAX_FRAME) dt = MAX_FRAME;
    this.fps += ((dt > 0 ? 1 / dt : 60) - this.fps) * 0.06;

    this.accumulator += dt;

    const t0 = performance.now();
    let steps = 0;
    while (this.accumulator >= STEP && steps < MAX_STEPS) {
      this.hooks.update(STEP);
      this.accumulator -= STEP;
      steps++;
    }
    // Si l'on a saturé le budget de rattrapage, on jette le retard accumulé : mieux vaut
    // un léger ralenti visible qu'une boucle qui ne rend plus jamais la main.
    if (steps === MAX_STEPS) this.accumulator = 0;
    this.updateMs = performance.now() - t0;

    const t1 = performance.now();
    this.hooks.render(this.accumulator / STEP);
    this.renderMs = performance.now() - t1;
  };
}
