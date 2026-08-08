import { TAU, clamp } from '../core/math';
import { P } from '../gfx/palette';
import { biomeAt } from '../game/terrain';
import type { World } from '../game/world';

/**
 * Minimap.
 *
 * Elle existe pour une raison précise : depuis l'ajout des structures, le monde contient des
 * objectifs qu'il faut **décider** d'aller chercher. Sans carte, un autel ne se découvre qu'au
 * moment où l'on marche dessus, et le pari « je traverse la horde pour aller le chercher »
 * n'existe pas. La minimap transforme l'exploration en choix tactique.
 *
 * Coût maîtrisé par une séparation nette :
 *   – le **fond de biomes** est coûteux (un échantillon de bruit par pixel) mais quasi statique :
 *     il n'est régénéré que si le joueur s'est notablement déplacé, et au plus quelques fois
 *     par seconde ;
 *   – les **marqueurs** sont recalculés à chaque frame, mais ne coûtent que quelques dizaines
 *     de `fillRect`.
 */

/** Rayon du monde couvert par la carte, en pixels monde. Environ quatre écrans de large. */
const WORLD_RADIUS = 880;
/** Résolution du fond de biomes, avant agrandissement. */
const BG = 52;
/** Taille de rendu de la carte, en pixels logiques. */
const SIZE = 104;
const SCALE = SIZE / 2 / WORLD_RADIUS;

/** Le fond n'est régénéré qu'au-delà de ce déplacement, ou de ce délai. */
const REFRESH_DIST = 55;
const REFRESH_TIME = 0.5;

export class Minimap {
  readonly root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private bg: HTMLCanvasElement;
  private bgCtx: CanvasRenderingContext2D;
  private bgX = Infinity;
  private bgY = Infinity;
  private bgAge = 0;

  private visible = true;
  private pulse = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'minimap';

    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;

    const label = document.createElement('div');
    label.className = 'minimap-label';
    label.textContent = 'M';

    this.root.append(this.canvas, label);
    parent.appendChild(this.root);

    this.bg = document.createElement('canvas');
    this.bg.width = BG;
    this.bg.height = BG;
    this.bgCtx = this.bg.getContext('2d')!;
  }

  toggle(): boolean {
    this.visible = !this.visible;
    this.root.style.display = this.visible ? 'block' : 'none';
    return this.visible;
  }

  destroy(): void {
    this.root.remove();
  }

  /**
   * Fond de biomes, en projection centrée sur le joueur. Le rendu se fait par `ImageData`
   * plutôt qu'en `fillRect` : à 2 700 cellules, l'écriture directe des octets est nettement
   * plus rapide que 2 700 appels de dessin.
   */
  private redrawBackground(cx: number, cy: number): void {
    const img = this.bgCtx.createImageData(BG, BG);
    const step = (WORLD_RADIUS * 2) / BG;
    const origin = -WORLD_RADIUS + step / 2;

    for (let j = 0; j < BG; j++) {
      const wy = cy + origin + j * step;
      for (let i = 0; i < BG; i++) {
        const wx = cx + origin + i * step;
        const biome = biomeAt(wx, wy);
        // On réutilise la teinte « claire » du biome : plus lisible en miniature que la base,
        // qui est volontairement très sombre en jeu.
        const hex = biome.ground[2];
        const n = parseInt(hex.slice(1), 16);
        const o = (j * BG + i) * 4;
        img.data[o] = (n >> 16) & 255;
        img.data[o + 1] = (n >> 8) & 255;
        img.data[o + 2] = n & 255;
        img.data[o + 3] = 255;
      }
    }
    this.bgCtx.putImageData(img, 0, 0);
    this.bgX = cx;
    this.bgY = cy;
    this.bgAge = 0;
  }

  update(w: World, dt: number): void {
    if (!this.visible) return;

    const pl = w.player;
    this.pulse += dt;
    this.bgAge += dt;

    const moved = Math.hypot(pl.x - this.bgX, pl.y - this.bgY);
    if (moved > REFRESH_DIST || this.bgAge > REFRESH_TIME) this.redrawBackground(pl.x, pl.y);

    const ctx = this.ctx;
    const half = SIZE / 2;

    // Le fond est dessiné décalé du déplacement effectué depuis sa génération : la carte
    // glisse continûment au lieu de sauter à chaque régénération.
    const offX = (this.bgX - pl.x) * SCALE;
    const offY = (this.bgY - pl.y) * SCALE;
    ctx.globalAlpha = 1;
    ctx.drawImage(this.bg, offX, offY, SIZE, SIZE);

    // Voile sombre : le fond doit rester une indication, pas rivaliser avec les marqueurs.
    ctx.fillStyle = 'rgba(5,6,10,0.42)';
    ctx.fillRect(0, 0, SIZE, SIZE);

    const px = (wx: number): number => half + (wx - pl.x) * SCALE;
    const py = (wy: number): number => half + (wy - pl.y) * SCALE;
    const inside = (x: number, y: number): boolean => x >= 1 && y >= 1 && x < SIZE - 1 && y < SIZE - 1;

    // --- ennemis : nuage de points sombres, sans détail ---
    ctx.fillStyle = 'rgba(196,38,57,0.72)';
    for (const e of w.enemies) {
      if (!e.active || e.dying > 0 || e.boss || e.elite) continue;
      const x = px(e.x);
      const y = py(e.y);
      if (inside(x, y)) ctx.fillRect(x | 0, y | 0, 1, 1);
    }

    // --- élites ---
    ctx.fillStyle = P.bloodHi;
    for (const e of w.enemies) {
      if (!e.active || e.dying > 0 || !e.elite) continue;
      const x = px(e.x);
      const y = py(e.y);
      if (inside(x, y)) ctx.fillRect((x | 0) - 1, (y | 0) - 1, 3, 3);
    }

    // --- butin au sol : seuls les objets qui valent un détour ---
    for (const p of w.pickups) {
      if (!p.active) continue;
      if (p.kind !== 'chest' && p.kind !== 'relic' && p.kind !== 'heart') continue;
      const x = px(p.x);
      const y = py(p.y);
      if (!inside(x, y)) continue;
      ctx.fillStyle =
        p.kind === 'chest' ? P.gold
          : p.kind === 'heart' ? P.bloodHi
            : (['#ffffff', '#5b9df5', '#a855f7', '#dc2626'][clamp(p.rank, 0, 3)] ?? '#fff');
      ctx.fillRect((x | 0) - 1, (y | 0) - 1, 2, 2);
    }

    // --- structures : le vrai intérêt de la carte ---
    const blink = 0.55 + Math.sin(this.pulse * 3.4) * 0.45;
    for (const poi of w.terrain.poisNear(pl.x, pl.y, WORLD_RADIUS + 100)) {
      const x = px(poi.x);
      const y = py(poi.y);
      if (!inside(x, y)) continue;

      if (poi.used) {
        // Une structure épuisée reste affichée, en gris : elle sert encore de repère.
        ctx.fillStyle = 'rgba(120,126,150,0.5)';
        ctx.fillRect((x | 0) - 1, (y | 0) - 1, 2, 2);
        continue;
      }
      ctx.globalAlpha = blink;
      ctx.fillStyle = poi.def.color;
      ctx.fillRect((x | 0) - 2, (y | 0) - 2, 4, 4);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#05060a';
      ctx.fillRect((x | 0) - 1, (y | 0) - 1, 2, 2);
      ctx.fillStyle = poi.def.color;
      ctx.fillRect(x | 0, y | 0, 1, 1);
    }

    // --- boss : impossible à manquer ---
    for (const b of w.bossGroup) {
      if (!b.active || b.dying > 0) continue;
      const x = clamp(px(b.x), 3, SIZE - 3);
      const y = clamp(py(b.y), 3, SIZE - 3);
      ctx.strokeStyle = P.bloodHi;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5 + Math.sin(this.pulse * 6) * 0.4;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = P.bloodHi;
      ctx.fillRect((x | 0) - 1, (y | 0) - 1, 3, 3);
    }

    // --- cadre de vue : rappelle ce que l'écran couvre réellement ---
    ctx.strokeStyle = 'rgba(247,237,224,0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      Math.round(half - (w.cam.viewW / 2) * SCALE) + 0.5,
      Math.round(half - (w.cam.viewH / 2) * SCALE) + 0.5,
      Math.round(w.cam.viewW * SCALE),
      Math.round(w.cam.viewH * SCALE),
    );

    // --- résonance : la seule façon de trouver ce qui est enfoui ---
    //
    // On ne montre jamais la position exacte tant que le joueur est loin : un point sur la
    // carte transformerait la fouille en trajet. Il voit une direction et une intensité, et
    // c'est à lui de chercher — d'où le nom, et d'où le bonus de la sourcière.
    const res = w.nearestCache();
    if (res && res.d < w.resonanceRange) {
      const near = clamp(1 - res.d / w.resonanceRange, 0, 1);
      const beat = 0.35 + Math.sin(this.pulse * (2 + near * 9)) * 0.45 * near + near * 0.3;
      const a = Math.atan2(res.y - pl.y, res.x - pl.x);

      if (res.d > 400) {
        // Loin : un arc sur le bord, dans la bonne direction.
        ctx.globalAlpha = clamp(beat, 0, 1);
        ctx.strokeStyle = P.spark;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(half, half, half - 5, a - 0.34, a + 0.34);
        ctx.stroke();
      } else {
        // Proche : un point, net seulement dans les tout derniers mètres.
        const x = clamp(px(res.x), 3, SIZE - 3);
        const y = clamp(py(res.y), 3, SIZE - 3);
        ctx.globalAlpha = clamp(beat, 0, 1);
        ctx.fillStyle = P.spark;
        const r = res.d < 120 ? 2 : 3;
        ctx.fillRect((x | 0) - r, (y | 0) - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    }

    // --- joueur, toujours au centre ---
    ctx.fillStyle = '#05060a';
    ctx.fillRect(half - 2, half - 2, 4, 4);
    ctx.fillStyle = P.gold;
    ctx.fillRect(half - 1, half - 1, 2, 2);
  }
}
