import { clamp, lerp, easeOutCubic, TAU } from '../core/math';
import * as font from './font';
import { P, rgba } from './palette';
import { shadowSprite, type SpriteSet } from './sprites';
import {
  biomeAt, biomeAtTile, groundTile, groundVariantAt, motifAt, propSprite, poiSprite, treeSprite,
  ruineSprite,
  GROUND_TILE,
} from '../game/terrain';
import { areaOf } from '../game/weapons';
import { drawAura } from './cosmeticfx';
import {
  FxLayer, fxSettings, drawGlow, drawSpin, drawSlash, drawBolt,
  sigilTexture, starTexture, swirlTexture, ringTexture, flareTexture,
} from './fx';
import type { World } from '../game/world';
import type { Enemy, Projectile } from '../game/types';

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

const TILE = GROUND_TILE;

/** Écrasement vertical des zones au sol : la vue est plongeante, un cercle s'y lit en ellipse. */
const ZONE_SQUASH = 0.72;
const AURA_SQUASH = 0.85;

/** Teinte de la lueur d'une gemme, par rang. */
const GEM_GLOW = [P.xp1, P.xp2, P.xp3, P.xp4] as const;

export class Renderer {
  private buckets: Enemy[][] = [];
  /** Couche de lumière additive et son halo – voir `fx.ts`. */
  readonly fx = new FxLayer();

  constructor(private readonly ctx: CanvasRenderingContext2D) {
    for (let i = 0; i < BUCKETS; i++) this.buckets.push([]);
  }

  render(w: World, alpha: number): void {
    const ctx = this.ctx;
    const cam = w.cam;
    // La caméra se cale sur la position **interpolée** du joueur, avant tout tracé.
    cam.frame(alpha, lerp(w.player.px, w.player.x, alpha), lerp(w.player.py, w.player.y, alpha));
    const ox = cam.offsetX;
    const oy = cam.offsetY;
    const VW = cam.viewW;
    const VH = cam.viewH;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    this.fx.begin(VW, VH);

    this.drawGround(ox, oy, VW, VH);
    this.drawSplats(w, ox, oy);
    this.drawRuines(w, ox, oy);
    this.drawProps(w, ox, oy);
    this.drawTrees(w, ox, oy);
    this.drawPois(w, ox, oy);
    this.drawCaches(w, ox, oy);
    this.drawZones(w, ox, oy);
    this.drawAuras(w, ox, oy, alpha);
    this.drawPickups(w, ox, oy, alpha);
    this.drawEnemies(w, ox, oy, alpha);
    this.drawProjectiles(w, ox, oy, alpha);
    this.drawPlayer(w, ox, oy, alpha);
    w.particles.render(ctx, cam, this.fx.ctx);
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
        ctx.drawImage(groundTile(biome, groundVariantAt(tx, ty), motifAt(tx, ty)), wx + ox, wy + oy);
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
  /**
   * Végétation.
   *
   * Dessinée **avant les entités**, donc toujours derrière le joueur et les ennemis. C'est un
   * choix, pas une facilité : dans un jeu où l'on esquive en permanence, un arbre qui masque
   * une silhouette coûte une vie. Les arbres décorent, ils n'occultent jamais.
   *
   * Le tri par ordonnée vient du terrain : sans lui, un arbre du fond se dessinerait
   * par-dessus un arbre du premier plan, et la profondeur s'effondrerait.
   */
  /**
   * Ruines.
   *
   * Dessinées juste après le sol et avant tout le reste : ce sont des masses posées au sol,
   * et le joueur comme les ennemis passent devant. Les dessiner par-dessus donnerait
   * l'impression qu'on marche sous les murs.
   */
  private drawRuines(w: World, ox: number, oy: number): void {
    const ctx = this.ctx;
    const cam = w.cam;
    for (const r of w.terrain.ruinesNear(cam.x, cam.y, 460)) {
      const x = Math.round(r.x + ox);
      const y = Math.round(r.y + oy);
      if (!this.onScreen(x + r.def.w / 2, y + r.def.h / 2, r.def.w, w)) continue;
      ctx.drawImage(ruineSprite(r.def, biomeAt(r.x, r.y)), x, y);
    }
  }

  private drawTrees(w: World, ox: number, oy: number): void {
    const ctx = this.ctx;
    const cam = w.cam;
    for (const t of w.terrain.treesNear(cam.x, cam.y, 420)) {
      const x = t.x + ox;
      const y = t.y + oy;
      if (!this.onScreen(x, y, 90, w)) continue;
      const s = treeSprite(t.kind, t.variant, t.grand, biomeAt(t.x, t.y));
      ctx.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height + 3));
    }
  }

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

  /** Caches de collection : halo discret et colonne de lumière, visibles de loin. */
  private drawCaches(w: World, ox: number, oy: number): void {
    const ctx = this.ctx;
    for (const k of w.caches) {
      if (k.taken) continue;
      const x = k.x + ox;
      const y = k.y + oy;
      if (!this.onScreen(x, y, 70, w)) continue;

      const pulse = 0.3 + Math.sin(k.anim * 2.6) * 0.16;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = P.spark;
      ctx.beginPath();
      ctx.ellipse(Math.round(x), Math.round(y), 15, 8, 0, 0, TAU);
      ctx.fill();
      // Colonne de lumière : c'est elle qui rend la pièce repérable dans la horde.
      ctx.globalAlpha = pulse * 0.5;
      ctx.fillRect(Math.round(x - 1), Math.round(y - 46), 3, 46);
      ctx.globalAlpha = 1;

      const set = w.cacheSprite(k.def);
      const f = set.frames[Math.floor(k.anim * 5) % set.frames.length]!;
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

      // Apparition et extinction en fondu : une zone qui surgit d'un bloc se lit comme un bug.
      const born = clamp((z.maxLife - z.life) / 0.18, 0, 1);
      const fade = Math.min(born, clamp(z.life / 0.45, 0, 1));

      // Sur la scène : un fond teinté, qui garde la zone lisible même sans la lumière.
      ctx.globalAlpha = 0.16 * fade;
      ctx.fillStyle = z.color;
      ctx.beginPath();
      ctx.ellipse(Math.round(x), Math.round(y), z.radius, z.radius * ZONE_SQUASH, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;

      this.drawSigil(x, y, z.radius, z.color, z.anim, fade);
    }
  }

  /**
   * Cercle magique au sol : lueur, anneau gradué, étoile inscrite et tourbillon, chacun à
   * sa vitesse et l'étoile à contresens.
   *
   * C'est la rotation qui fait le travail. Une flaque immobile est un décor ; des anneaux
   * qui tournent l'un contre l'autre disent qu'un sort est **en cours**, et le joueur n'a
   * plus à se demander si la zone blesse encore.
   */
  private drawSigil(x: number, y: number, radius: number, color: string, anim: number, fade: number): void {
    const f = this.fx.ctx;
    const k = fade * fxSettings.sigils;
    const pulse = 1 + Math.sin(anim * 5) * 0.03;

    drawGlow(f, x, y, radius * 1.4, radius * 1.4 * ZONE_SQUASH, color, 0.16 * k);
    drawSpin(f, sigilTexture(color), x, y, radius * pulse, ZONE_SQUASH, anim * 0.7, 0.62 * k);
    // En dessous d'une certaine taille, le détail ne serait qu'un pâté : l'anneau suffit.
    if (radius >= 13) {
      drawSpin(f, starTexture(color), x, y, radius * 0.62, ZONE_SQUASH, -anim * 0.9, 0.36 * k);
      drawSpin(f, swirlTexture(color), x, y, radius * 0.95, ZONE_SQUASH, anim * 2.6, 0.14 * k);
    }
  }

  /**
   * Auras du joueur.
   *
   * Elles n'avaient **aucune** représentation : l'Ail blessait dans un rayon que rien ne
   * montrait, et le joueur ne pouvait ni juger sa portée ni voir qu'elle grandissait en
   * montant de niveau. Une arme invisible est une arme qu'on croit en panne.
   */
  private drawAuras(w: World, ox: number, oy: number, alpha: number): void {
    const ctx = this.ctx;
    const f = this.fx.ctx;
    const pl = w.player;
    const x = lerp(pl.px, pl.x, alpha) + ox;
    const y = lerp(pl.py, pl.y, alpha) + oy;

    for (const inst of pl.weapons) {
      if (inst.def.behavior !== 'aura') continue;
      const r = areaOf(inst, pl);
      const color = inst.def.color;
      const breathe = 1 + Math.sin(w.time * 3) * 0.04;

      ctx.globalAlpha = 0.08;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(Math.round(x), Math.round(y), r, r * AURA_SQUASH, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;

      drawGlow(f, x, y, r * 1.25, r * 1.25 * AURA_SQUASH, color, 0.08);
      drawSpin(f, ringTexture(color), x, y, r * breathe, AURA_SQUASH, 0, 0.4);
      drawSpin(f, swirlTexture(color), x, y, r * 0.92, AURA_SQUASH, w.time * 1.4, 0.2);
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
        drawGlow(this.fx.ctx, x, y, 22, 16, glow, pulse);
      } else if (p.kind === 'gem') {
        // Une gemme luit faiblement : un tapis d'XP doit se lire comme un trésor, pas du gravier.
        drawGlow(this.fx.ctx, x, y, 6, 6, GEM_GLOW[clamp(p.rank, 0, 3)]!, 0.14);
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

        /*
         * Halo de rang, au sol.
         *
         * Posé **avant** le sprite, comme l'ombre : dessiné après, il recouvrait les pieds
         * de la créature et la faisait paraître enfoncée dans une flaque.
         *
         * Il pulse hors phase d'un ennemi à l'autre — l'horloge d'animation, déjà décalée à
         * l'apparition, sert de déphasage. Des halos synchrones se liraient comme un effet
         * d'interface posé sur le jeu, pas comme des créatures.
         */
        if (e.rang) {
          const [cr, cg, cb] = e.rang.teinte;
          const pulse = 0.55 + 0.18 * Math.sin(e.anim * 1.7);
          const rr = e.radius * 1.8;
          ctx.fillStyle = `rgba(${cr},${cg},${cb},${(pulse * 0.7).toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(Math.round(x), Math.round(y + e.radius - 1), rr, rr * 0.42, 0, 0, TAU);
          ctx.fill();
        }

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


        /*
         * Cerne, par-dessus le corps. Réservé aux deux rangs supérieurs : mis aussi sur
         * l'endurci, qui est fréquent, il ferait de la moitié de l'écran un pointillé.
         */
        if (e.rang && e.rang.id !== 'endurci') {
          const [cr, cg, cb] = e.rang.teinte;
          const pulse = 0.55 + 0.18 * Math.sin(e.anim * 1.7);
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${pulse.toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(Math.round(x), Math.round(y), f.width * 0.5 + 1.5, f.height * 0.52 + 1.5, 0, 0, TAU);
          ctx.stroke();
        }

        /*
         * Barre de vie. Jamais pour la piétaille — ce serait du bruit —, à l'usage pour ce
         * qui porte un rang, et **en permanence** pour un colosse : sa barre est ce qui
         * permet de juger, avant de s'engager, si on a de quoi l'abattre.
         */
        const barre = e.rang ? (e.rang.id === 'colosse' || e.hp < e.maxHp) : (e.elite && e.hp < e.maxHp);
        if (barre) {
          const bw = e.rang && e.rang.id === 'colosse' ? 20 : 14;
          const ratio = clamp(e.hp / e.maxHp, 0, 1);
          ctx.fillStyle = '#000000';
          ctx.fillRect(Math.round(x - bw / 2), Math.round(y - f.height / 2 - 4), bw, 3);
          ctx.fillStyle = e.rang ? `rgb(${e.rang.teinte[0]},${e.rang.teinte[1]},${e.rang.teinte[2]})` : P.bloodHi;
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
    const pl = w.player;
    const plx = lerp(pl.px, pl.x, alpha) + ox;
    const ply = lerp(pl.py, pl.y, alpha) + oy;

    for (const p of w.projectiles) {
      if (!p.active) continue;
      const wx = lerp(p.px, p.x, alpha);
      const wy = lerp(p.py, p.y, alpha);
      const x = wx + ox;
      const y = wy + oy;
      // La marge couvre l'éclair, qui tombe de bien plus haut que son point d'impact.
      if (!this.onScreen(x, y, p.behavior === 'strike' ? 190 : 60, w)) continue;

      this.drawProjectileLight(p, x, y, plx, ply);

      // Un coup, une onde ou un éclair **sont** leur effet : y reposer la petite icône de
      // l'arme reviendrait à coller une étiquette sur le sort. Le sprite ne reste que pour
      // ce qui est un objet en vol – pieu, orbe, fiole, masse, pieu de ronce.
      if (p.behavior === 'melee' || p.behavior === 'wave' || p.behavior === 'strike') continue;

      const frames = p.sprite.frames;
      const f = frames[Math.floor(p.anim) % frames.length]!;
      const hw = f.width / 2;
      const hh = f.height / 2;

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

  /**
   * Lumière d'un projectile, selon son comportement.
   *
   * Le sprite dit **ce que c'est** ; la lumière dit **ce que ça fait** : une traînée pour ce
   * qui file, un croissant pour ce qui tranche, un éclair pour ce qui tombe. Chaque forme
   * est une texture précalculée (voir `fx.ts`), simplement recopiée.
   */
  private drawProjectileLight(p: Projectile, x: number, y: number, plx: number, ply: number): void {
    const f = this.fx.ctx;
    const S = fxSettings;
    const fade = clamp(p.life / Math.max(0.001, p.maxLife), 0, 1);
    const t = 1 - fade;
    const color = p.hostile ? P.bloodHi : p.color;

    switch (p.behavior) {
      case 'melee': {
        if (p.tags.includes('full360')) {
          const r = p.radius * (0.45 + 0.6 * easeOutCubic(t)) * S.scale;
          drawSpin(f, ringTexture(color), x, y, r, 0.8, 0, fade);
          drawSpin(f, swirlTexture(color), x, y, r * 0.9, 0.8, t * 5, fade * 0.7);
        } else {
          // Le croissant pivote autour du joueur et balaie l'arc pendant la durée du coup.
          const reach = p.radius * 1.75 * S.scale;
          const sweep = (easeOutCubic(t) - 0.5) * 1.5;
          drawSlash(f, color, plx, ply, reach * 0.94, p.angle + sweep - 0.35, fade * 0.35);
          drawSlash(f, color, plx, ply, reach, p.angle + sweep, Math.min(1, fade * 2.2));
        }
        drawGlow(f, x, y, p.radius * 1.3, p.radius, color, 0.14 * fade);
        break;
      }

      case 'wave': {
        const a = Math.atan2(p.vy, p.vx);
        const reach = p.radius * 1.5 * S.scale;
        drawSlash(
          f, color, x - Math.cos(a) * reach * 0.75, y - Math.sin(a) * reach * 0.75,
          reach, a, Math.min(1, fade * 1.8) * 0.9,
        );
        drawGlow(f, x, y, p.radius * 1.4, p.radius * 1.1, color, 0.14 * fade);
        break;
      }

      case 'strike': {
        const r = p.radius * S.scale;
        drawBolt(f, color, p.pid + Math.floor(p.anim * 1.6), x, y, 120 * S.scale, Math.min(1, fade * 1.6) * 0.85);
        drawGlow(f, x, y, r * 1.5, r * 1.1, color, 0.3 * fade);
        drawSpin(f, flareTexture(color), x, y, r * (0.5 + fade * 0.5), 0.75, p.anim * 0.2, fade * 0.7);
        drawSpin(f, ringTexture(color), x, y, r * (0.3 + t), ZONE_SQUASH, 0, fade * 0.6);
        break;
      }

      case 'orbit':
      case 'flail': {
        // Traînée le long de l'orbite : c'est elle qui donne le sens et la vitesse de rotation.
        const squash = p.behavior === 'orbit' ? 0.8 : 0.7;
        const dir = p.b >= 0 ? 1 : -1;
        const len = 1.1 * S.trails;
        if (len > 0.05 && p.a > 0) {
          f.lineCap = 'round';
          f.strokeStyle = color;
          f.lineWidth = 4;
          f.globalAlpha = Math.min(1, 0.22 * S.light);
          f.beginPath();
          f.ellipse(plx, ply, p.a, p.a * squash, 0, p.c - dir * len, p.c, dir < 0);
          f.stroke();
          f.lineWidth = 2;
          f.globalAlpha = Math.min(1, 0.55 * S.light);
          f.beginPath();
          f.ellipse(plx, ply, p.a, p.a * squash, 0, p.c - dir * len * 0.4, p.c, dir < 0);
          f.stroke();
          f.globalAlpha = 1;
        }
        const g = p.radius * 1.6 + 5;
        drawGlow(f, x, y, g, g, color, 0.38);
        drawGlow(f, x, y, g * 0.4, g * 0.4, '#ffffff', 0.25);
        break;
      }

      case 'spike':
        drawGlow(f, x, y + 2, p.radius * 1.8, p.radius * 1.1, color, 0.55 * fade);
        break;

      default: {
        const g = p.radius * 1.5 + 5;
        const flies = p.behavior === 'linear' || p.behavior === 'bounce' ||
          p.behavior === 'pet' || p.behavior === 'enemyShot';
        if (flies && S.trails > 0) {
          for (let k = 1; k <= 4; k++) {
            const d = k * 0.016 * S.trails;
            const r = g * (1 - k * 0.16);
            drawGlow(f, x - p.vx * d, y - p.vy * d, r, r, color, 0.2 * (1 - k / 5));
          }
        }
        drawGlow(f, x, y, g, g, color, 0.38);
        drawGlow(f, x, y, g * 0.4, g * 0.4, '#ffffff', 0.28);
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

    // Repère d'accessibilité : un anneau permanent au sol. Dans une horde de trois cents
    // créatures, retrouver son personnage est le premier obstacle du genre.
    if (w.highlightPlayer) {
      ctx.strokeStyle = P.gold;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(Math.round(x), Math.round(y + 7), 10, 5, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (pl.aura) drawAura(this.fx.ctx, pl.aura, x, y + 7, w.time);

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

    // La lumière s'ajoute **après** l'assombrissement : plus la nuit tombe, plus les sorts
    // ressortent, au lieu de s'éteindre avec le décor.
    this.fx.composite(ctx);

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

  /**
   * Bulles de proximité.
   *
   * Un objet précieux hors champ est signalé par une **pastille plaquée au bord de l'écran**,
   * portant son propre sprite, un chevron vers sa direction et sa distance. C'est le seul
   * moyen de rendre l'exploration décidable : sans elles, on ne quitte jamais la zone
   * dégagée qu'on s'est ménagée, faute de savoir ce qu'on gagnerait à le faire.
   *
   * Trois précautions contre l'encombrement :
   *   – les pastilles sont **plafonnées** et **priorisées** (un boss prime sur un cœur) ;
   *   – elles s'estompent avec la distance, si bien qu'un objet lointain ne crie pas aussi
   *     fort qu'un objet à deux pas ;
   *   – rien n'est affiché pour un objet déjà visible : la pastille ne double jamais ce que
   *     le joueur a sous les yeux.
   */
  private drawEdgeMarkers(w: World, VW: number, VH: number): void {
    const ctx = this.ctx;
    const cam = w.cam;

    interface Marker {
      x: number; y: number; color: string; sprite: HTMLCanvasElement | null;
      prio: number; d: number;
    }
    const marks: Marker[] = [];

    const add = (
      x: number, y: number, color: string, sprite: HTMLCanvasElement | null,
      prio: number, maxDist: number,
    ): void => {
      if (cam.visible(x, y, 10)) return;
      const d = Math.hypot(x - cam.x, y - cam.y);
      if (d > maxDist) return;
      marks.push({ x, y, color, sprite, prio, d });
    };

    // Priorités décroissantes : ce qui menace ou ce qui est rare passe devant.
    for (const b of w.bossGroup) {
      if (b.active && b.dying <= 0) add(b.x, b.y, P.bloodHi, b.sprite.frames[0] ?? null, 0, 4000);
    }
    for (const k of w.caches) {
      if (!k.taken) add(k.x, k.y, P.spark, w.cacheSprite(k.def).frames[0] ?? null, 1, w.resonanceRange);
    }
    for (const p of w.pickups) {
      if (!p.active) continue;
      const f = p.sprite?.frames[0] ?? null;
      if (p.kind === 'relic') {
        const cols = ['#ffffff', '#5b9df5', '#a855f7', '#dc2626'];
        add(p.x, p.y, cols[clamp(p.rank, 0, 3)]!, f, 2, 1600);
      } else if (p.kind === 'chest') {
        add(p.x, p.y, P.gold, f, 3, 1400);
      } else if (p.kind === 'heart') {
        add(p.x, p.y, P.bloodHi, f, 4, 700);
      }
    }
    // Structures encore actives : plus discrètes, et seulement à courte portée. Elles
    // portent leur propre sprite comme le reste — une pastille avec un simple point paraît
    // vide et ne dit pas ce qui attend là-bas.
    for (const poi of w.terrain.poisNear(cam.x, cam.y, 620)) {
      if (!poi.used) add(poi.x, poi.y, poi.def.color, poiSprite(poi.type)[0] ?? null, 5, 620);
    }

    if (marks.length === 0) return;
    marks.sort((a, b) => a.prio - b.prio || a.d - b.d);

    // Marge suffisante pour que la pastille, son chevron et sa distance tiennent à l'écran.
    const hw = VW / 2 - 20;
    const hh = VH / 2 - 22;

    for (const m of marks.slice(0, 6)) {
      const dx = m.x - cam.x;
      const dy = m.y - cam.y;
      const a = Math.atan2(dy, dx);

      // Projection sur le **rectangle** de l'écran, pas sur un cercle : une pastille posée
      // sur un cercle flotte au milieu des bords longs au lieu de les épouser.
      const sx = Math.abs(dx) > 0.001 ? hw / Math.abs(dx) : Infinity;
      const sy = Math.abs(dy) > 0.001 ? hh / Math.abs(dy) : Infinity;
      const k = Math.min(sx, sy);
      const px = Math.round(VW / 2 + dx * k);
      const py = Math.round(VH / 2 + dy * k);

      // Plus c'est proche, plus c'est franc.
      const near = clamp(1 - m.d / 1600, 0.18, 1);
      const alpha = 0.35 + near * 0.6;

      const R = 9;
      ctx.globalAlpha = alpha;

      // Pastille : fond sombre, liseré à la couleur de l'objet.
      ctx.fillStyle = 'rgba(5,6,10,0.86)';
      ctx.fillRect(px - R, py - R, R * 2, R * 2);
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(px - R + 0.5, py - R + 0.5, R * 2 - 1, R * 2 - 1);

      if (m.sprite) {
        const sc = Math.min((R * 2 - 4) / m.sprite.width, (R * 2 - 4) / m.sprite.height, 1);
        const dw = Math.max(1, Math.round(m.sprite.width * sc));
        const dh = Math.max(1, Math.round(m.sprite.height * sc));
        ctx.drawImage(m.sprite, px - dw / 2, py - dh / 2, dw, dh);
      } else {
        // Structures : pas de sprite en pastille, un losange plein suffit.
        ctx.fillStyle = m.color;
        ctx.fillRect(px - 2, py - 2, 4, 4);
      }

      /*
       * Chevron vers l'extérieur.
       *
       * Sa base est construite **perpendiculairement** à la direction, et non par un décalage
       * angulaire : à ±2,5 rad, les deux points de base repassaient derrière la pointe et
       * produisaient un immense triangle qui recouvrait entièrement la pastille.
       */
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const nx = -uy;
      const ny = ux;
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.moveTo(px + ux * (R + 6), py + uy * (R + 6));
      ctx.lineTo(px + ux * (R + 1) + nx * 3.5, py + uy * (R + 1) + ny * 3.5);
      ctx.lineTo(px + ux * (R + 1) - nx * 3.5, py + uy * (R + 1) - ny * 3.5);
      ctx.closePath();
      ctx.fill();

      // Distance, arrondie à la dizaine — une valeur au pixel près serait du bruit. Elle se
      // place du côté **intérieur** de la pastille, sinon elle sort de l'écran en bas.
      const dist = Math.round(m.d / 10) * 10;
      const below = py < VH / 2;
      // L'écart au liseré est nommé une fois et retranché de la hauteur du texte dans le cas
      // « au-dessus » : écrit en nombres bruts, il ne restait symétrique que tant que la
      // police gardait exactement sept pixels de haut.
      const LABEL_GAP = 2;
      const ly = below ? py + R + LABEL_GAP : py - R - LABEL_GAP - font.TEXT_H;
      font.drawCentered(ctx, String(dist), px, ly, m.color, 1);

      ctx.globalAlpha = 1;
    }
  }

  private onScreen(x: number, y: number, margin: number, w: World): boolean {
    return x > -margin && y > -margin && x < w.cam.viewW + margin && y < w.cam.viewH + margin;
  }
}
