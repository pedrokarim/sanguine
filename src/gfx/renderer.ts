import { skillIcon } from './skillicons';
import { clamp, lerp, TAU } from '../core/math';
import * as font from './font';
import { P, rgba } from './palette';
import { RISE_TIME } from '../game/garrison';
import { shadowSprite, surgeAt, type SpriteSet } from './sprites';
import {
  biomeAt, BIOMES, biomeAtTile, biomeFringe, FRINGE_SIDES, groundTile, groundVariantAt, motifAt, propSprite, poiIcon, treeSprite,
  GROUND_TILE,
} from '../game/terrain';
import { areaOf } from '../game/weapons';
import { flightOf, headingOf, zoneKindOf } from './vfx';
import { FxLayer, fxSettings, drawGlow } from './fx';
import { SiteLayer } from './sitelayer';
import { siteBeacon } from './castle';
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

/** Hauteur réservée au chronomètre en haut de l'écran, en pixels de monde. */
const TIMER_CLEARANCE = 22;
const BUCKET_H = 24;
const BUCKETS = 32;

const TILE = GROUND_TILE;

/** Écrasement vertical des zones au sol : la vue est plongeante, un cercle s'y lit en ellipse. */

/** Teinte de la lueur d'une gemme, par rang. */
const GEM_GLOW = [P.xp1, P.xp2, P.xp3, P.xp4] as const;

export class Renderer {
  private buckets: Enemy[][] = [];
  /** Couche de lumière additive et son halo – voir `fx.ts`. */
  readonly fx = new FxLayer();
  /** Châteaux et villages, triés avec les créatures : voir `sitelayer.ts`. */
  private readonly sites = new SiteLayer();

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
    this.sites.begin(w, ox, oy, VW, VH);
    this.sites.drawFloors(ctx, VW, VH);
    this.drawSplats(w, ox, oy);
    this.drawProps(w, ox, oy);
    this.drawTrees(w, ox, oy);
    this.drawPois(w, ox, oy);
    this.drawCaches(w, ox, oy);
    this.drawZones(w, ox, oy);
    this.drawAuras(w, ox, oy, alpha);
    this.drawPickups(w, ox, oy, alpha);
    w.vfx.renderBack(ctx, cam, alpha);
    this.drawEnemies(w, ox, oy, alpha);
    this.drawProjectiles(w, ox, oy, alpha);
    this.drawPlayer(w, ox, oy, alpha);
    this.sites.coverHero(ctx, lerp(w.player.px, w.player.x, alpha) + ox, lerp(w.player.py, w.player.y, alpha) + oy, w.player.y);
    this.sites.drawLights(this.fx.ctx, VW, VH, w.time);
    w.particles.render(ctx, cam, this.fx.ctx);
    this.drawShrineFoci(w, ox, oy);
    w.vfx.renderFront(ctx, this.fx.ctx, cam, alpha, this.fx.comfort);
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
    const tx0 = Math.floor(startWX / TILE);
    const ty0 = Math.floor(startWY / TILE);

    for (let r = 0; r < rows; r++) {
      const wy = startWY + r * TILE;
      for (let c = 0; c < cols; c++) {
        const wx = startWX + c * TILE;
        const tx = tx0 + c;
        const ty = ty0 + r;
        ctx.drawImage(groundTile(biomeAtTile(tx, ty), groundVariantAt(tx, ty), motifAt(tx, ty)), wx + ox, wy + oy);
      }
    }

    /*
     * Une tuile est un carré de 128 px : deux biomes voisins s'y rencontraient sur une ligne
     * droite, et la carte se lisait comme un damier. Le biome de rang le plus élevé déborde
     * donc sur son voisin en frange irrégulière. Une seule des deux tuiles dessine chaque
     * raccord, et la frange se raccorde d'une tuile à l'autre : la limite ne se voit plus.
     */
    for (let r = 0; r < rows; r++) {
      const wy = startWY + r * TILE;
      for (let c = 0; c < cols; c++) {
        const wx = startWX + c * TILE;
        const tx = tx0 + c;
        const ty = ty0 + r;
        const here = biomeAtTile(tx, ty);
        for (const side of FRINGE_SIDES) {
          const next = biomeAtTile(tx + side.dx, ty + side.dy);
          if (next.id !== here.id && BIOMES.indexOf(next) > BIOMES.indexOf(here)) {
            ctx.drawImage(biomeFringe(next, side.id), wx + ox, wy + oy);
          }
        }
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
  private drawTrees(w: World, ox: number, oy: number): void {
    const ctx = this.ctx;
    const cam = w.cam;
    for (const t of w.terrain.treesNear(cam.x, cam.y, 420)) {
      const x = t.x + ox;
      const y = t.y + oy;
      if (!this.onScreen(x, y, 90, w)) continue;
      if (this.sites.takeTree(t)) continue;
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


      if (!poi.used) {
        // Halo au sol : rend la structure repérable même noyée dans la horde.
        const pulse = 0.18 + Math.sin(poi.anim * 2.2) * 0.07;
        drawGlow(this.fx.ctx, x, y, poi.def.radius * 1.6, poi.def.radius, poi.def.color, pulse);
      }

      // Un cercle de runes se pose au sol : il passe sous tout ce qui se tient dessus.
      if (!poi.used && poi.type === 'obelisk') w.vfx.drawShrineFocus(ctx, this.fx.ctx, poi.type, x, y - 26, poi.anim);

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
    }
  }

  /** Ce qui brûle sur les structures passe devant leurs pierres, donc après elles. */
  private drawShrineFoci(w: World, ox: number, oy: number): void {
    const cam = w.cam;
    for (const poi of w.terrain.poisNear(cam.x, cam.y, 520)) {
      const shrine = poi.site.shrine;
      if (poi.used || !shrine || poi.type === 'obelisk') continue;
      if (shrine.group >= 0 && (poi.site.groups[shrine.group]?.open ?? 0) < 0.5) continue;
      w.vfx.drawShrineFocus(this.ctx, this.fx.ctx, poi.type, shrine.focusX + ox, shrine.focusY + oy, poi.anim);
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
      w.vfx.drawZone(ctx, this.fx.ctx, zoneKindOf(z.color), x, y, z.radius, z.anim, fade);
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
    const pl = w.player;
    const x = lerp(pl.px, pl.x, alpha) + ox;
    const y = lerp(pl.py, pl.y, alpha) + oy;

    for (const inst of pl.weapons) {
      if (inst.def.behavior !== 'aura') continue;
      w.vfx.drawAura(this.ctx, this.fx.ctx, x, y + 7, areaOf(inst, pl), w.time);
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
    const subX = cam.remainderX;
    const subY = cam.remainderY;

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

    for (let b = 0; b < this.buckets.length; b++) {
      // Les bâtiments s'intercalent ici : ce qui est derrière un mur passe avant lui.
      this.sites.drawBucket(ctx, b);
      for (const e of this.buckets[b]!) {
        const set: SpriteSet = e.sprite;
        const gait = set.gait;
        // L'à-coup du pas ne se lit qu'en marche : il suit la direction du déplacement.
        const surge = gait && e.dying <= 0 ? surgeAt(gait, e.walk) / Math.max(Math.hypot(e.vx, e.vy), e.speed, 1) : 0;
        /*
         * La position s'arrondit une seule fois, reste de la caméra compris, et tout le reste en
         * découle : ombre, halo, sprite et barre de vie restent solidaires au pixel près. Un
         * `Math.round(x - largeur / 2)` par élément les faisait glisser les uns sur les autres
         * selon la parité de leur largeur.
         */
        const x = Math.round(lerp(e.px, e.x, alpha) + ox + subX + e.vx * surge);
        const y = Math.round(lerp(e.py, e.y, alpha) + oy + subY + e.vy * surge);

        // Ombre portée : ancre le sprite au sol, sans quoi tout paraît flotter. Sous les pieds
        // d'un corps qui marche, et à sa largeur : sous un boss, elle disparaissait derrière lui.
        const sh = shadowSprite();
        const shadowW = gait?.shadow ?? 16;
        const shadowH = Math.max(8, shadowW >> 2);
        ctx.globalAlpha = 0.5;
        ctx.drawImage(sh, x - (shadowW >> 1), y + (gait?.feet ?? e.radius) - (shadowH >> 1), shadowW, shadowH);
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
          ctx.ellipse(x, Math.round(y + e.radius - 1), rr, rr * 0.42, 0, 0, TAU);
          ctx.fill();
        }

        if (e.dying > 0) {
          this.drawDying(e, x, y);
          continue;
        }

        const frames = e.flash > 0 ? set.flash : e.elite ? set.elite : set.frames;
        const f = frames[Math.floor(e.walk * frames.length) % frames.length]!;
        const dx = x - (f.width >> 1);
        const dy = y - (f.height >> 1);
        const margin = gait?.margin ?? 0;

        if (e.stun > 0 || e.slow > 0) ctx.globalAlpha = 0.75;
        if (e.facing < 0 && this.flippable(e)) {
          ctx.setTransform(-1, 0, 0, 1, 0, 0);
          ctx.drawImage(f, -dx - f.width, dy);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        } else {
          // Sortie de terre : seul ce qui a dépassé du sol se voit, pieds toujours au même endroit.
          const shown = e.rise > 0 ? Math.ceil(f.height * (1 - e.rise / RISE_TIME)) : f.height;
          ctx.drawImage(f, 0, 0, f.width, shown, dx, dy + f.height - shown, f.width, shown);
        }
        ctx.globalAlpha = 1;


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
          ctx.ellipse(x, y, f.width * 0.5 - margin + 1.5, (f.height - margin * 2) * 0.52 + 1.5, 0, 0, TAU);
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
          ctx.fillRect(x - (bw >> 1), dy + margin - 4, bw, 3);
          ctx.fillStyle = e.rang ? `rgb(${e.rang.teinte[0]},${e.rang.teinte[1]},${e.rang.teinte[2]})` : P.bloodHi;
          ctx.fillRect(x - (bw >> 1), dy + margin - 4, Math.round(bw * ratio), 3);
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
    // Le sang dit déjà la mort : la silhouette blanche ne doit plus que disparaître dessous.
    ctx.globalAlpha = (1 - t) * 0.45;
    ctx.drawImage(f, x - (f.width >> 1), y - (f.height >> 1) + Math.round(t * 2));
    ctx.globalAlpha = 1;
  }

  /** Les plans orientés (bêtes, cavaliers) se retournent ; les plans symétriques non. */
  private flippable(e: Enemy): boolean {
    const { plan, critter } = e.def.art;
    return plan === 'beast' || plan === 'rider' || plan === 'worm' ||
      critter?.id === 'snake' || critter?.id === 'frog' || critter?.id === 'bird';
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

      // Une compétence n'a plus de sprite : son visuel entier vient de `Vfx`.
      if (p.behavior === 'melee' || p.behavior === 'strike' || p.behavior === 'spike') continue;
      const flight = flightOf(p.weaponId, p.behavior);
      if (flight) {
        if (p.behavior === 'flail') this.drawChain(plx, ply, x, y);
        const heading = headingOf(wx, wy, p.px, p.py, Math.atan2(p.vy, p.vx));
        w.vfx.drawFlight(ctx, this.fx.ctx, flight, x, y, heading, p.maxLife - p.life);
        continue;
      }

      this.drawProjectileLight(p, x, y);

      if (p.behavior === 'wave') continue;

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

  /** Chaîne du fléau : des maillons sur la grille, du héros à sa masse. */
  private drawChain(x0: number, y0: number, x1: number, y1: number): void {
    const ctx = this.ctx;
    const links = Math.max(2, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 4));
    for (let i = 1; i < links; i++) {
      const u = i / links;
      ctx.fillStyle = i % 2 ? P.stoneHi : P.mist;
      ctx.fillRect(Math.round(lerp(x0, x1, u)), Math.round(lerp(y0, y1, u)), 2, 2);
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

    /*
     * Le héros s'arrondit **avant** tout décalage.
     *
     * La caméra suit sa position arrondie : `x` vaut donc un entier plus la partie
     * fractionnaire de sa position. `Math.round(x - largeur / 2)` tombait pile sur la frontière
     * d'arrondi pour toute largeur impaire : le sprite sautait d'un pixel en arrière et en
     * avant selon le signe de cette fraction, mesuré à 130 allers-retours par seconde, sur un
     * personnage que l'œil suit en permanence. Arrondi d'abord, il ne bouge plus d'un pixel.
     */
    const sx = Math.round(x);
    const sy = Math.round(y);

    const sh = shadowSprite();
    ctx.globalAlpha = 0.55;
    ctx.drawImage(sh, sx - 8, sy + 5, 16, 8);
    ctx.globalAlpha = 1;

    // Repère d'accessibilité : un anneau permanent au sol. Dans une horde de trois cents
    // créatures, retrouver son personnage est le premier obstacle du genre.
    if (w.highlightPlayer) {
      ctx.strokeStyle = P.gold;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 7, 10, 5, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (pl.aura) w.vfx.drawHeroAura(ctx, this.fx.ctx, pl.aura, sx, sy + 7, w.time);

    // Clignotement d'invulnérabilité : un créneau, pas un fondu – bien plus lisible.
    if (pl.iframes > 0 && Math.floor(pl.iframes * 14) % 2 === 0) return;

    const set = pl.sprite;
    const frames = pl.hurtFlash > 0 ? set.flash : set.frames;
    const f = frames[pl.frameIndex % frames.length]!;
    const dx = sx - (f.width >> 1);
    const dy = sy + 10 - f.height;

    if (pl.facingX < 0) {
      ctx.setTransform(-1, 0, 0, 1, 0, 0);
      ctx.drawImage(f, -dx - f.width, dy);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      ctx.drawImage(f, dx, dy);
    }
  }

  /** Tirs ennemis : seuls projectiles restés hors de `Vfx`, ils doivent se détacher de tout. */
  private drawProjectileLight(p: Projectile, x: number, y: number): void {
    const f = this.fx.ctx;
    const S = fxSettings;
    const g = p.radius * 1.5 + 5;
    const color = p.hostile ? P.bloodHi : p.color;
    if (S.trails > 0) {
      for (let k = 1; k <= 4; k++) {
        const d = k * 0.016 * S.trails;
        const r = g * (1 - k * 0.16);
        drawGlow(f, x - p.vx * d, y - p.vy * d, r, r, color, 0.2 * (1 - k / 5));
      }
    }
    drawGlow(f, x, y, g, g, color, 0.38);
    drawGlow(f, x, y, g * 0.4, g * 0.4, '#ffffff', 0.28);
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
    for (const poi of w.terrain.poisNear(cam.x, cam.y, 900)) {
      if (!poi.used) add(poi.x, poi.y, poi.def.color, poiIcon(poi.type), 5, 900);
    }
    // Le but de la quête passe avant tout le reste, à n'importe quelle distance.
    const quest = w.quests.target;
    if (quest) add(quest.x, quest.y, P.gold, skillIcon('relic', 'huntermark'), 0, Infinity);
    // Un château se signale de très loin : c'est lui qui donne une direction à la partie.
    for (const s of w.terrain.sites.beacons(cam.x, cam.y)) {
      add(s.entrance.x, s.entrance.y, s.kind === 'castle' ? P.bloodHi : P.bone, siteBeacon(s.kind), s.kind === 'castle' ? 1 : 5, 7000);
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
      // En haut, la pastille s'arrête sous le chronomètre, qu'elle masquait quand le but est au nord.
      const sy = Math.abs(dy) > 0.001 ? (dy < 0 ? hh - TIMER_CLEARANCE : hh) / Math.abs(dy) : Infinity;
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
