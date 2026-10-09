import { TAU } from '../core/math';
import { fxRng } from '../core/rng';
import {
  drawGlow, drawSpin, noise,
  ringTexture, sigilTexture, starTexture, swirlTexture,
} from './fx';
import type { Particles } from './particles';

/**
 * Effets des cosmétiques.
 *
 * Un cosmétique qui ne se voit pas ne se vend pas. Les traînées étaient toutes le même carré
 * d'une couleur différente, les teintes une recoloration de treize pixels de large, les
 * thèmes un liseré. Rien de cela ne valait une partie entière d'économies.
 *
 * Chaque article reçoit donc un effet **propre**, pas une couleur : la cendre retombe, le
 * givre cristallise au sol, l'or laisse des flaques qui s'éteignent, le vide ouvre des
 * failles qui se referment. Les mêmes fonctions servent en partie et dans l'aperçu de la
 * boutique : ce que le joueur voit avant d'acheter est exactement ce qu'il obtient.
 *
 * Règle inchangée : **aucun de ces effets ne touche au jeu.** Ils vivent sur la couche de
 * lumière, sous le joueur ou derrière lui, et leurs particules sont de priorité minimale.
 */

export type TrailStyle = 'ash' | 'frost' | 'ember' | 'gold' | 'void';

/** Lueur d'une teinte. Le rang suit le prix : halo, puis anneau, puis cercle magique. */
export interface Aura {
  color: string;
  tier: 1 | 2 | 3;
}

export type AmbienceStyle = 'dust' | 'rain' | 'fireflies';

// ---------------------------------------------------------------------------
// Traînées
// ---------------------------------------------------------------------------

/**
 * Émet un pas de traînée en (`x`, `y`), le point de contact du joueur avec le sol.
 * `tick` est le numéro du pas : il cadence ce qui ne doit pas sortir à chaque fois.
 */
export function emitTrail(
  particles: Particles, style: TrailStyle, color: string, x: number, y: number, tick: number,
): void {
  const jx = fxRng.spread(3);
  const jy = fxRng.spread(2);

  switch (style) {
    case 'ash':
      // De la fumée qui s'étale, et des flocons de cendre qui retombent.
      particles.glyph(x + jx, y - 2, 'glow', color, 5, 0.9, { grow: 1.4, vy: -7, alpha: 0.4 });
      particles.fall(x + jx * 2, y - 6, color, 1);
      if (tick % 3 === 0) particles.fall(x + fxRng.spread(8), y - 10, '#d8d2c8', 1);
      break;

    case 'frost':
      // Le sol gèle : une plaque de givre, et des cristaux qui scintillent en tournant.
      particles.glyph(x + jx, y + 1, 'glow', color, 7, 1.1, { squash: 0.45, grow: 0.5, alpha: 0.5 });
      particles.glyph(x + fxRng.spread(7), y + fxRng.spread(3), 'flare', color, fxRng.range(2.5, 4.5), 0.55, {
        spin: fxRng.spread(5), squash: 0.8,
      });
      if (tick % 4 === 0) particles.glyph(x, y + 1, 'ring', '#ffffff', 4, 0.6, { squash: 0.45, grow: 2.2, alpha: 0.6 });
      break;

    case 'ember':
      // Des braises qui montent, et un sol qui rougeoie un instant sous le pas.
      particles.ember(x + jx, y, color, 2);
      particles.glyph(x + jx, y + 1, 'glow', color, 6, 0.5, { squash: 0.5, alpha: 0.7 });
      if (tick % 3 === 0) particles.sparks(x, y, -Math.PI / 2, 2, '#fff3c4', 1.6);
      break;

    case 'gold':
      // De l'or fondu : une flaque qui met du temps à s'éteindre, et des éclats.
      particles.glyph(x + jx, y + 1, 'glow', color, 6.5, 1.6, { squash: 0.42, alpha: 0.85 });
      particles.glyph(x + fxRng.spread(8), y - fxRng.range(0, 10), 'flare', '#fff3c4', fxRng.range(2, 5), 0.42, {
        spin: fxRng.spread(7),
      });
      if (tick % 2 === 0) particles.fall(x + jx, y - 5, color, 1);
      break;

    case 'void':
      // Des failles qui s'ouvrent derrière soi puis se referment, et une poussière qui monte.
      if (tick % 2 === 0) {
        particles.glyph(x + jx, y + jy, 'swirl', color, 8, 0.85, { spin: -6, squash: 0.7, grow: -0.7 });
      }
      particles.glyph(x + jx, y, 'glow', color, 7, 0.6, { squash: 0.6, alpha: 0.5 });
      particles.ember(x + fxRng.spread(5), y - 2, '#d8b4fe', 1);
      if (tick % 7 === 0) particles.glyph(x, y + 1, 'sigil', color, 9, 1, { spin: 1.5, squash: 0.5, grow: 0.3 });
      break;
  }
}

// ---------------------------------------------------------------------------
// Auras
// ---------------------------------------------------------------------------

/**
 * Dessine l'aura d'une teinte sous les pieds du joueur, en (`x`, `y`) à l'écran.
 *
 * Tout est tiré du temps, sans état : la même fonction anime le joueur en partie et les
 * neuf aperçus de la boutique, sans que rien ne soit à créer, mettre à jour ou libérer.
 */
export function drawAura(f: CanvasRenderingContext2D, aura: Aura, x: number, y: number, time: number): void {
  const { color, tier } = aura;
  const pulse = 0.5 + Math.sin(time * 2.4) * 0.12;

  drawGlow(f, x, y, 13, 7, color, pulse * 0.7);

  if (tier >= 2) {
    drawSpin(f, ringTexture(color), x, y, 11 + Math.sin(time * 2.4) * 0.6, 0.5, 0, 0.6);
    drawSpin(f, swirlTexture(color), x, y, 10, 0.5, time * 1.6, 0.16);
  }
  if (tier >= 3) {
    drawSpin(f, sigilTexture(color), x, y, 17, 0.5, time * 0.7, 0.8);
    drawSpin(f, starTexture(color), x, y, 10, 0.5, -time * 0.9, 0.5);
    drawGlow(f, x, y - 9, 11, 13, color, 0.22);
  }

  // Poussières qui montent le long du corps, plus nombreuses avec le rang.
  const motes = tier === 1 ? 2 : tier === 2 ? 4 : 7;
  for (let k = 0; k < motes; k++) {
    const phase = (time * (0.45 + noise(k) * 0.3) + k / motes) % 1;
    const px = x + Math.sin(k * 2.4 + time * 1.3) * (5 + tier * 2);
    const py = y - phase * (14 + tier * 4);
    drawGlow(f, px, py, 2, 2, color, (1 - phase) * 0.85);
  }
}

// ---------------------------------------------------------------------------
// Ambiances de menu
// ---------------------------------------------------------------------------

/**
 * Ambiance d'un thème d'interface, dessinée par-dessus la scène des menus.
 *
 * Un thème ne changeait qu'un liseré de cadre. Il habille maintenant tout l'écran : c'est
 * dans les menus que le joueur passe le temps où il regarde, plutôt que celui où il joue.
 */
export function drawAmbience(
  ctx: CanvasRenderingContext2D, style: AmbienceStyle, color: string, t: number, w: number, h: number,
): void {
  ctx.globalCompositeOperation = 'lighter';

  switch (style) {
    case 'dust':
      // Poussière d'or en suspension, qui monte lentement et scintille.
      for (let k = 0; k < 46; k++) {
        const speed = 3 + noise(k * 1.7) * 6;
        const x = (noise(k * 3.3) * w + Math.sin(t * 0.4 + k) * 9 + w) % w;
        const y = h - ((noise(k * 5.1) * h + t * speed) % h);
        const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(t * (1 + noise(k) * 2) + k));
        const r = 1.6 + noise(k * 9.9) * 2.6;
        drawGlow(ctx, x, y, r, r, color, twinkle * 0.8);
      }
      break;

    case 'rain': {
      // Pluie de sang : des traits obliques, et l'éclat de chaque goutte.
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      for (let k = 0; k < 60; k++) {
        const speed = 90 + noise(k * 2.1) * 80;
        const y = (noise(k * 4.7) * h + t * speed) % (h + 20) - 10;
        const x = (noise(k * 6.3) * (w + 60) - y * 0.22 + w) % (w + 60) - 30;
        ctx.globalAlpha = 0.25 + noise(k * 8.8) * 0.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 1.8, y + 8);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      drawGlow(ctx, w * 0.5, h * 1.02, w * 0.7, h * 0.3, color, 0.3 + Math.sin(t * 0.8) * 0.06);
      break;
    }

    case 'fireflies':
      // Une aurore lente en haut du ciel, et des lucioles qui errent.
      for (let k = 0; k < 4; k++) {
        const x = w * (0.15 + k * 0.24) + Math.sin(t * 0.17 + k * 1.9) * w * 0.12;
        drawGlow(ctx, x, h * 0.16, w * 0.3, h * 0.22, color, 0.16 + Math.sin(t * 0.5 + k) * 0.06);
      }
      for (let k = 0; k < 30; k++) {
        const x = noise(k * 3.9) * w + Math.sin(t * (0.2 + noise(k) * 0.3) + k * 2) * 26;
        const y = h * (0.3 + noise(k * 7.1) * 0.65) + Math.cos(t * (0.25 + noise(k * 2) * 0.3) + k) * 14;
        const blink = Math.max(0, Math.sin(t * (0.9 + noise(k * 5) * 1.4) + k * TAU * 0.37));
        drawGlow(ctx, x, y, 3.4, 3.4, color, blink * 0.9);
        drawGlow(ctx, x, y, 1.2, 1.2, '#ffffff', blink * 0.8);
      }
      break;
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
