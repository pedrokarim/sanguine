import { clamp, lerp, TAU } from '../core/math';
import { P, rgba } from './palette';
import { shadowSprite, type SpriteSet } from './sprites';
import { biomeAt, biomeAtTile, groundTile, groundVariantAt, propSprite, poiSprite } from '../game/terrain';
import type { World } from '../game/world';
import type { Enemy } from '../game/types';

/**
 * Passe de rendu.
 *
 * Trois règles gouvernent ce fichier :
 *   1. **Culling systématique** – rien hors du viewport (+ marge) n'atteint `drawImage`.
 *   2. **Aucun `save()`/`restore()`** dans la boucle chaude ; les retournements horizontaux
 *      passent par `setTransform`, qui est bien moins coûteux.
 *   3. **Tri par seau** plutôt qu'un `sort()` complet : trier 1200 ennemis chaque frame
 *      coûterait plus cher que tout le reste du rendu réuni.
 */

const BUCKET_H = 24;
const BUCKETS = 32;

const TILE = 64;

export class Renderer {
  private buckets: Enemy[][] = [];

  constructor(private readonly ctx: CanvasRenderingContext2D) {
    for (let i = 0; i < BUCKETS; i++) this.buckets.push([]);
  }

  render(w: World, alpha: number): void {
    const ctx = this.ctx;
    const cam = w.cam;
    const ox = cam.offsetX;
    const oy = cam.offsetY;
    const VW = cam.viewW;
    const VH = cam.viewH;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;

    this.drawGround(ox, oy, VW, VH);
    this.drawSplats(w, ox, oy);
    this.drawProps(w, ox, oy);
    this.drawPois(w, ox, oy);
    this.drawZones(w, ox, oy);
    this.drawPickups(w, ox, oy, alpha);
    this.drawEnemies(w, ox, oy, alpha);
    this.drawProjectiles(w, ox, oy, alpha);
    this.drawPlayer(w, ox, oy, alpha);
    w.particles.render(ctx, cam);
    this.drawOverlays(w, VW, VH);
  }

  // ------------------------------------------------------------------- décor

  /**
   * Sol dessiné tuile par tuile, chaque tuile prenant la texture de son biome.
   *
   * Un `createPattern` global serait moins cher, mais interdirait toute transition de biome :
   * une soixantaine de `drawImage` par frame est un prix négligeable pour un monde qui change
   * visiblement de nature quand on le traverse.
   */
  private drawGround(ox: number, oy: number, VW: number, VH: number): void {
    const ctx = this.ctx;
    // Coin supérieur gauche du monde visible, aligné sur la grille de tuiles.
    const startWX = Math.floor(-ox / TILE) * TILE;
    const startWY = Math.floor(-oy / TILE) * TILE;
    const cols = Math.ceil(VW / TILE) + 1;
    const rows = Math.ceil(VH / TILE) + 1;

    for (let r = 0; r < rows; r++) {
      const wy = startWY + r * TILE;
      const ty = Math.floor(wy / TILE);
      for (let c = 0; c < cols; c++) {
        const wx = startWX + c * TILE;
        const tx = Math.floor(wx / TILE);
        const biome = biomeAtTile(tx, ty);
        ctx.drawImage(groundTile(biome, groundVariantAt(tx, ty)), wx + ox, wy + oy);
      }
    }
  }

  private drawProps(w: World, ox: number, oy: number): void {
    const ctx = this.ctx;
    const cam = w.cam;
    for (const prop of w.terrain.propsNear(cam.x, cam.y, 340)) {
      const x = prop.x + ox;
      const y = prop.y + oy;
      if (!this.onScreen(x, y, 24, w)) continue;
      const biome = biomeAt(prop.x, prop.y);
      const s = propSprite(prop.kind, prop.variant, biome);
      ctx.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height + 4));
    }
  }

  /** Structures : lueur pulsée tant qu'elles sont actives, sprite éteint une fois utilisées. */
  private drawPois(w: World, ox: number, oy: number): void {
    const ctx = this.ctx;
    const cam = w.cam;

    for (const poi of w.terrain.poisNear(cam.x, cam.y, 380)) {
      const x = poi.x + ox;
      const y = poi.y + oy;
      if (!this.onScreen(x, y, 60, w)) continue;

      const frames = poiSprite(poi.type);
      const f = poi.used ? frames[4]! : frames[Math.floor(poi.anim * 4) % 4]!;

      if (!poi.used) {
        // Halo au sol : rend la structure repérable même noyée dans la horde.
        const pulse = 0.18 + Math.sin(poi.anim * 2.2) * 0.07;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = poi.def.color;
        ctx.beginPath();
        ctx.ellipse(Math.round(x), Math.round(y), poi.def.radius * 1.5, poi.def.radius * 0.85, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Onde d'activation, brève.
      if (poi.flash > 0) {
        ctx.globalAlpha = poi.flash * 0.8;
        ctx.strokeStyle = poi.def.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(Math.round(x), Math.round(y), (1 - poi.flash) * 70, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      const sh = shadowSprite();
      ctx.globalAlpha = 0.45;
      ctx.drawImage(sh, Math.round(x - f.width * 0.45), Math.round(y - 3), Math.round(f.width * 0.9), 7);
      ctx.globalAlpha = 1;

      ctx.drawImage(f, Math.round(x - f.width / 2), Math.round(y - f.height + 4));
    }
  }

  private drawSplats(w: World, ox: number, oy: number): void {
    const ctx = this.ctx;
    ctx.globalAlpha = 0.55;
    for (const s of w.splats) {
      const x = s.x + ox;
      const y = s.y + oy;
      if (x < -16 || y < -16 || x > w.cam.viewW + 16 || y > w.cam.viewH + 16) continue;
      ctx.drawImage(s.sprite, Math.round(x - 7), Math.round(y - 7));
    }
    ctx.globalAlpha = 1;
  }

  private drawZones(w: World, ox: number, oy: number): void {
    const ctx = this.ctx;
    for (const z of w.zones) {
      if (!z.active) continue;
      const x = z.x + ox;
      const y = z.y + oy;
      if (!this.onScreen(x, y, z.radius + 8, w)) continue;

      const fade = clamp(z.life / Math.max(0.001, z.maxLife), 0, 1);
      // Deux passes : un disque diffus, puis un anneau net qui délimite la zone dangereuse.
      ctx.globalAlpha = 0.2 * fade;
      ctx.fillStyle = z.color;
      ctx.beginPath();
      ctx.ellipse(Math.round(x), Math.round(y), z.radius, z.radius * 0.72, 0, 0, TAU);
      ctx.fill();

      ctx.globalAlpha = 0.55 * fade;
      ctx.strokeStyle = z.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(
        Math.round(x), Math.round(y),
        z.radius + Math.sin(z.anim * 5) * 1.2, (z.radius + Math.sin(z.anim * 5) * 1.2) * 0.72,
        0, 0, TAU,
      );
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // --------------------------------------------------------------- ramassages

  private drawPickups(w: World, ox: number, oy: number, alpha: number): void {
    const ctx = this.ctx;
    for (const p of w.pickups) {
      if (!p.active) continue;
      const wx = lerp(p.px, p.x, alpha);
      const wy = lerp(p.py, p.y, alpha);
      const x = wx + ox;
      const y = wy + oy;
      if (!this.onScreen(x, y, 24, w)) continue;

      const set = p.sprite;
      const frames = set.frames;
      const f = frames[Math.floor(p.anim) % frames.length]!;

      // Les objets rares projettent une lueur qui les rend repérables dans le chaos.
      if (p.kind === 'relic' || p.kind === 'chest') {
        const colors = ['#ffffff', '#5b9df5', '#a855f7', '#dc2626'];
        const glow = p.kind === 'chest' ? P.gold : colors[clamp(p.rank, 0, 3)]!;
        const pulse = 0.35 + Math.sin(p.anim * 2) * 0.15;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(Math.round(x), Math.round(y), 12, 8, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      const bob = p.kind === 'gem' || p.kind === 'gold' ? 0 : Math.sin(p.anim) * 1.2;
      ctx.drawImage(f, Math.round(x - f.width / 2), Math.round(y - f.height / 2 + bob));
    }
  }

  // ------------------------------------------------------------------ ennemis

  private drawEnemies(w: World, ox: number, oy: number, alpha: number): void {
    const ctx = this.ctx;
    const cam = w.cam;

    for (const b of this.buckets) b.length = 0;

    for (const e of w.enemies) {
      if (!e.active) continue;
      if (!cam.visible(e.x, e.y, 48)) continue;
      // Seau selon la position verticale à l'écran : approxime un tri en profondeur
      // pour un coût constant.
      const sy = e.y + oy;
      const idx = clamp(Math.floor(sy / BUCKET_H) + 1, 0, BUCKETS - 1);
      this.buckets[idx]!.push(e);
    }

    for (const bucket of this.buckets) {
      for (const e of bucket) {
        const wx = lerp(e.px, e.x, alpha);
        const wy = lerp(e.py, e.y, alpha);
        const x = wx + ox;
        const y = wy + oy;

        // Ombre portée : ancre le sprite au sol, sans quoi tout paraît flotter.
        const sh = shadowSprite();
        ctx.globalAlpha = 0.5;
        ctx.drawImage(sh, Math.round(x - 8), Math.round(y + e.radius - 4), 16, 8);
        ctx.globalAlpha = 1;

        if (e.dying > 0) {
          this.drawDying(e, x, y);
          continue;
        }

        const set: SpriteSet = e.sprite;
        const frames = e.flash > 0 ? set.flash : e.elite ? set.elite : set.frames;
        const f = frames[Math.floor(e.anim) % frames.length]!;
        const dx = Math.round(x - f.width / 2);
        const dy = Math.round(y - f.height / 2);

        if (e.stun > 0 || e.slow > 0) {
          ctx.globalAlpha = 0.75;
          ctx.drawImage(f, dx, dy);
          ctx.globalAlpha = 1;
        } else if (e.facing < 0 && this.flippable(e)) {
          ctx.setTransform(-1, 0, 0, 1, 0, 0);
          ctx.drawImage(f, -dx - f.width, dy);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        } else {
          ctx.drawImage(f, dx, dy);
        }

        // Barre de vie : uniquement pour les élites, jamais pour la piétaille (bruit visuel).
        if (e.elite && e.hp < e.maxHp) {
          const bw = 14;
          const ratio = clamp(e.hp / e.maxHp, 0, 1);
          ctx.fillStyle = '#000000';
          ctx.fillRect(Math.round(x - bw / 2), Math.round(y - f.height / 2 - 4), bw, 3);
          ctx.fillStyle = P.bloodHi;
          ctx.fillRect(Math.round(x - bw / 2), Math.round(y - f.height / 2 - 4), Math.round(bw * ratio), 3);
        }
      }
    }
  }

  private drawDying(e: Enemy, x: number, y: number): void {
    const ctx = this.ctx;
    const set = e.sprite;
    // 0.28 s d'animation, 5 frames de dislocation.
    const t = 1 - clamp(e.dying / 0.28, 0, 1);
    const frames = set.flash;
    const f = frames[Math.min(frames.length - 1, Math.floor(t * frames.length))]!;
    ctx.globalAlpha = 1 - t * 0.7;
    ctx.drawImage(f, Math.round(x - f.width / 2), Math.round(y - f.height / 2 + t * 2));
    ctx.globalAlpha = 1;
  }

  /** Les plans orientés (bêtes, cavaliers) se retournent ; les plans symétriques non. */
  private flippable(e: Enemy): boolean {
    const plan = e.def.art.plan;
    return plan === 'beast' || plan === 'rider';
  }

  // -------------------------------------------------------------- projectiles

  private drawProjectiles(w: World, ox: number, oy: number, alpha: number): void {
    const ctx = this.ctx;
    for (const p of w.projectiles) {
      if (!p.active) continue;
      const wx = lerp(p.px, p.x, alpha);
      const wy = lerp(p.py, p.y, alpha);
      const x = wx + ox;
      const y = wy + oy;
      if (!this.onScreen(x, y, 40, w)) continue;

      const frames = p.sprite.frames;
      const f = frames[Math.floor(p.anim) % frames.length]!;
      const hw = f.width / 2;
      const hh = f.height / 2;

      // Zones de mêlée / ondes : un halo coloré rend la portée lisible.
      if (p.behavior === 'melee' || p.behavior === 'wave' || p.behavior === 'strike') {
        const fade = clamp(p.life / Math.max(0.001, p.maxLife), 0, 1);
        ctx.globalAlpha = 0.28 * fade;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(Math.round(x), Math.round(y), p.radius, p.radius * 0.78, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      const angle = p.rot + (this.oriented(p.behavior) ? p.angle : 0);
      if (Math.abs(angle) < 0.01) {
        ctx.drawImage(f, Math.round(x - hw), Math.round(y - hh));
      } else {
        ctx.setTransform(
          Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle),
          Math.round(x), Math.round(y),
        );
        ctx.drawImage(f, -hw, -hh);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    }
  }

  private oriented(behavior: string): boolean {
    return behavior === 'linear' || behavior === 'pet' || behavior === 'bounce' ||
      behavior === 'melee' || behavior === 'enemyShot';
  }

  // ---------------------------------------------------------------- joueur

  private drawPlayer(w: World, ox: number, oy: number, alpha: number): void {
    const ctx = this.ctx;
    const pl = w.player;
    const wx = lerp(pl.px, pl.x, alpha);
    const wy = lerp(pl.py, pl.y, alpha);
    const x = wx + ox;
    const y = wy + oy;

    const sh = shadowSprite();
    ctx.globalAlpha = 0.55;
    ctx.drawImage(sh, Math.round(x - 8), Math.round(y + 5), 16, 8);
    ctx.globalAlpha = 1;

    // Clignotement d'invulnérabilité : un créneau, pas un fondu – bien plus lisible.
    if (pl.iframes > 0 && Math.floor(pl.iframes * 14) % 2 === 0) return;

    const set = pl.sprite;
    const frames = pl.hurtFlash > 0 ? set.flash : set.frames;
    const f = frames[pl.frameIndex % frames.length]!;
    const dx = Math.round(x - f.width / 2);
    const dy = Math.round(y - f.height / 2 - 2);

    if (pl.facingX < 0) {
      ctx.setTransform(-1, 0, 0, 1, 0, 0);
      ctx.drawImage(f, -dx - f.width, dy);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      ctx.drawImage(f, dx, dy);
    }
  }

  // -------------------------------------------------------------- surcouches

  private drawOverlays(w: World, VW: number, VH: number): void {
    const ctx = this.ctx;
    const pl = w.player;
    const reduce = w.cam.intensity === 0;

    // Le domaine s'assombrit au fil des 30 minutes : le joueur sent le temps passer
    // sans jamais regarder le chronomètre.
    const dark = clamp(w.minute / 30, 0, 1) * 0.45;
    if (dark > 0.01) {
      ctx.fillStyle = rgba('#000000', dark);
      ctx.fillRect(0, 0, VW, VH);
    }

    // Vignette rouge, qui s'intensifie avec le temps et le danger.
    const vig = dark * 0.5 + (1 - pl.hpRatio) * 0.25;
    if (vig > 0.02) {
      const g = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.3, VW / 2, VH / 2, VH * 0.85);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, rgba(P.bloodDark, clamp(vig, 0, 0.8)));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VW, VH);
    }

    if (!reduce && pl.hurtFlash > 0) {
      ctx.fillStyle = rgba(P.bloodHi, clamp(pl.hurtFlash, 0, 0.35) * 0.5);
      ctx.fillRect(0, 0, VW, VH);
    }

    if (w.freezeTimer > 0) {
      ctx.fillStyle = rgba(P.ice, 0.12);
      ctx.fillRect(0, 0, VW, VH);
    }

    // Indicateurs de bord : une flèche pointe vers un boss ou un coffre hors écran.
    this.drawEdgeMarkers(w, VW, VH);
  }

  private drawEdgeMarkers(w: World, VW: number, VH: number): void {
    const ctx = this.ctx;
    const cam = w.cam;

    const mark = (x: number, y: number, color: string): void => {
      if (cam.visible(x, y, 0)) return;
      const dx = x - cam.x;
      const dy = y - cam.y;
      const a = Math.atan2(dy, dx);
      const r = Math.min(VW, VH) * 0.42;
      const px = VW / 2 + Math.cos(a) * r;
      const py = VH / 2 + Math.sin(a) * r;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(px + Math.cos(a) * 5, py + Math.sin(a) * 5);
      ctx.lineTo(px + Math.cos(a + 2.4) * 4, py + Math.sin(a + 2.4) * 4);
      ctx.lineTo(px + Math.cos(a - 2.4) * 4, py + Math.sin(a - 2.4) * 4);
      ctx.closePath();
      ctx.fill();
    };

    if (w.boss?.active) mark(w.boss.x, w.boss.y, P.bloodHi);
    for (const p of w.pickups) {
      if (p.active && (p.kind === 'chest' || p.kind === 'relic')) {
        mark(p.x, p.y, p.kind === 'chest' ? P.gold : '#a855f7');
      }
    }
  }

  private onScreen(x: number, y: number, margin: number, w: World): boolean {
    return x > -margin && y > -margin && x < w.cam.viewW + margin && y < w.cam.viewH + margin;
  }
}
