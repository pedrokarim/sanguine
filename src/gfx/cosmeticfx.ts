import { TAU } from '../core/math';
import { drawGlow, noise } from './fx';

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
