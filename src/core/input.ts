import { clamp } from './math';

/**
 * Entrées unifiées : clavier, manette et tactile produisent le même vecteur de direction.
 *
 * Le clavier est lu par **code physique** (`KeyW`, `KeyZ`…), donc AZERTY et QWERTY
 * fonctionnent tous les deux sans configuration : `KeyZ` sur un AZERTY est la touche
 * située là où un QWERTY a `KeyW`, et on écoute simplement les deux.
 */

export interface Stick {
  x: number;
  y: number;
}

const MOVE_CODES = {
  up: ['KeyW', 'KeyZ', 'ArrowUp', 'Numpad8'],
  down: ['KeyS', 'ArrowDown', 'Numpad5', 'Numpad2'],
  left: ['KeyA', 'KeyQ', 'ArrowLeft', 'Numpad4'],
  right: ['KeyD', 'ArrowRight', 'Numpad6'],
} as const;

export class Input {
  private held = new Set<string>();
  /** Codes pressés pendant la frame courante (consommés par `consumePressed`). */
  private pressed = new Set<string>();
  private touchId: number | null = null;
  private touchOrigin = { x: 0, y: 0 };
  private touchCur = { x: 0, y: 0 };
  private stickEl: HTMLDivElement | null = null;
  private nubEl: HTMLDivElement | null = null;

  readonly move: Stick = { x: 0, y: 0 };
  /** `true` tant qu'aucune interaction n'a eu lieu (bloque le démarrage de l'audio). */
  interacted = false;

  constructor(
    private readonly target: HTMLElement,
    private readonly touchLayer: HTMLElement,
  ) {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.releaseAll);
    this.target.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove, { passive: false });
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.interacted = true;
    // On ne bloque jamais F5/F12/Ctrl+…, mais on empêche le défilement des flèches et de l'espace.
    if (
      !e.ctrlKey &&
      !e.metaKey &&
      (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab')
    ) {
      e.preventDefault();
    }
    if (e.repeat) return;
    this.held.add(e.code);
    this.pressed.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code);
  };

  private releaseAll = (): void => {
    this.held.clear();
    this.touchId = null;
    this.hideStick();
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.interacted = true;
    if (e.pointerType === 'mouse') return; // la souris ne pilote pas le déplacement
    if (this.touchId !== null) return;
    this.touchId = e.pointerId;
    this.touchOrigin = { x: e.clientX, y: e.clientY };
    this.touchCur = { x: e.clientX, y: e.clientY };
    this.showStick();
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.touchId) return;
    e.preventDefault();
    this.touchCur = { x: e.clientX, y: e.clientY };
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.touchId) return;
    this.touchId = null;
    this.hideStick();
  };

  private showStick(): void {
    if (!this.stickEl) {
      this.stickEl = document.createElement('div');
      this.stickEl.className = 'touch-stick';
      this.nubEl = document.createElement('div');
      this.nubEl.className = 'nub';
      this.stickEl.appendChild(this.nubEl);
      this.touchLayer.appendChild(this.stickEl);
    }
    this.stickEl.style.display = 'block';
  }

  private hideStick(): void {
    if (this.stickEl) this.stickEl.style.display = 'none';
  }

  private anyHeld(codes: readonly string[]): boolean {
    for (const c of codes) if (this.held.has(c)) return true;
    return false;
  }

  /** Appelé une fois par pas de simulation, avant tout le reste. */
  update(): void {
    let x = 0;
    let y = 0;

    if (this.anyHeld(MOVE_CODES.left)) x -= 1;
    if (this.anyHeld(MOVE_CODES.right)) x += 1;
    if (this.anyHeld(MOVE_CODES.up)) y -= 1;
    if (this.anyHeld(MOVE_CODES.down)) y += 1;

    // Manette — premier pad connecté, stick gauche + croix directionnelle.
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) {
      if (!pad) continue;
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      const DEAD = 0.22;
      if (Math.abs(ax) > DEAD) x += ax;
      if (Math.abs(ay) > DEAD) y += ay;
      if (pad.buttons[12]?.pressed) y -= 1;
      if (pad.buttons[13]?.pressed) y += 1;
      if (pad.buttons[14]?.pressed) x -= 1;
      if (pad.buttons[15]?.pressed) x += 1;
      if (pad.buttons[0]?.pressed || pad.buttons[9]?.pressed) this.interacted = true;
      break;
    }

    // Tactile — joystick virtuel avec rayon mort de 12 px et saturation à 54 px.
    if (this.touchId !== null) {
      const dx = this.touchCur.x - this.touchOrigin.x;
      const dy = this.touchCur.y - this.touchOrigin.y;
      const len = Math.hypot(dx, dy);
      if (len > 12) {
        const norm = Math.min(len, 54) / 54;
        x += (dx / len) * norm;
        y += (dy / len) * norm;
      }
      if (this.stickEl && this.nubEl) {
        this.stickEl.style.left = `${this.touchOrigin.x - 54}px`;
        this.stickEl.style.top = `${this.touchOrigin.y - 54}px`;
        const cl = Math.min(len, 54);
        const a = Math.atan2(dy, dx);
        this.nubEl.style.left = `${54 + Math.cos(a) * cl}px`;
        this.nubEl.style.top = `${54 + Math.sin(a) * cl}px`;
      }
    }

    // Normalisation : la diagonale ne doit pas être plus rapide.
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    this.move.x = clamp(x, -1, 1);
    this.move.y = clamp(y, -1, 1);
  }

  /** À appeler en toute fin de frame : vide le tampon des appuis ponctuels. */
  endFrame(): void {
    this.pressed.clear();
  }

  isDown(code: string): boolean {
    return this.held.has(code);
  }

  /** `true` une seule fois, à la frame de l'appui. */
  wasPressed(...codes: string[]): boolean {
    for (const c of codes) if (this.pressed.has(c)) return true;
    return false;
  }

  get anyKeyPressed(): boolean {
    return this.pressed.size > 0;
  }
}
