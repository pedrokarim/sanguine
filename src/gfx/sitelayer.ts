import { clamp } from '../core/math';
import { floorTile, type FloorKind } from './castle';
import { drawGlow } from './fx';
import { gridScale, snap } from './grid';
import type { World } from '../game/world';
import { buildDecal, buildPiece, SKYLINE_STEP, type Piece, type Site } from '../game/siteplan';
import { biomeAt, treeSprite, type Tree } from '../game/terrain';

/**
 * Couche des lieux : tout ce que le rendu fait des bâtiments.
 *
 * Le problème est celui d'une vue plongeante : un mur cache ce qui se tient derrière lui, et pas
 * ce qui se tient devant. On ne peut donc pas tout dessiner avant les créatures. Les morceaux de
 * bâtiment sont triés par leur pied et glissés entre les seaux de profondeur des ennemis ; le
 * héros, dessiné à part, est recouvert ensuite par ce qui se trouve au sud de lui.
 *
 * Reste qu'un rempart de cent douze pixels masquerait entièrement le héros passé derrière. Un
 * monstre qu'on ne voit pas est une mort qu'on n'a pas commise : ce qui le cache devient donc
 * translucide, en fondu selon sa distance, et le toit d'un logis s'efface dès qu'on y entre.
 */

/** Seau d'une ordonnée d'écran : la même règle que le tri des ennemis. */
const BUCKET_H = 24;
const BUCKETS = 32;

/** Opacité d'un mur quand le héros est juste derrière. */
const SEE_THROUGH = 0.26;
/** Budget de peinture anticipée, par image. */
const PREWARM_MS = 3;
/** À cette distance, on commence à peindre un lieu pour qu'il soit prêt à l'arrivée. */
const PREWARM_RANGE = 1100;
/** Au-delà, ses sprites sont rendus à la mémoire. */
const RELEASE_RANGE = 2600;

/** Une entrée du tri : un morceau de bâtiment, ou un arbre pris au milieu d'un village. */
interface Item {
  key: number;
  bucket: number;
  piece: Piece | null;
  tree: Tree | null;
}

export class SiteLayer {
  private readonly items: Item[] = [];
  private cursor = 0;
  private dirty = false;
  private readonly patterns = new Map<FloorKind, CanvasPattern>();
  private readonly loaded = new Set<Site>();
  private lastTime = 0;
  private dt = 0;
  private ox = 0;
  private oy = 0;
  /** Lieux visibles à cette image. */
  private readonly visible: Site[] = [];

  /** Prépare l'image : qui est visible, à quelle opacité, dans quel ordre. */
  begin(w: World, ox: number, oy: number, VW: number, VH: number): void {
    const now = performance.now();
    this.dt = this.lastTime ? clamp((now - this.lastTime) / 1000, 0, 0.1) : 0;
    this.lastTime = now;
    this.ox = ox;
    this.oy = oy;
    this.items.length = 0;
    this.cursor = 0;

    const pl = w.player;
    const sites = w.terrain.sites;
    const near = sites.near(w.cam.x, w.cam.y, Math.max(VW, VH));
    this.visible.length = 0;
    for (const s of near) this.visible.push(s);

    for (const s of this.visible) {
      this.loaded.add(s);
      this.updateGroups(s, pl.x, pl.y);
      for (const p of s.pieces) {
        if (p.x + p.w + ox < -8 || p.y + p.h + oy < -8 || p.x + ox > VW + 8 || p.y + oy > VH + 8) continue;
        const open = p.inner >= 0 ? s.groups[p.inner]!.open : 1;
        if (open <= 0.01) continue;
        p.alpha = this.targetAlpha(s, p, pl.x, pl.y, p.alpha);
        if (p.alpha <= 0.02) continue;
        this.items.push({ key: p.key, bucket: this.bucketOf(p.key + oy), piece: p, tree: null });
      }
    }
    this.items.sort((a, b) => a.key - b.key);
    this.prewarm(pl.x, pl.y, sites.near(pl.x, pl.y, PREWARM_RANGE), now);
    this.release(pl.x, pl.y);
  }

  /**
   * Prend en charge un arbre s'il pousse au milieu d'un lieu.
   *
   * Un arbre planté devant un mur doit passer devant lui. Dessiné avec les autres, avant toute
   * la scène, il serait recouvert par le mur. Il rejoint donc le tri : le renderer le saute.
   */
  takeTree(t: Tree): boolean {
    for (const s of this.visible) {
      const b = s.bounds;
      if (t.x > b.x - 80 && t.x < b.x + b.w + 80 && t.y > b.y - 80 && t.y < b.y + b.h + 80) {
        this.items.push({ key: t.y, bucket: this.bucketOf(t.y + this.oy), piece: null, tree: t });
        this.dirty = true;
        return true;
      }
    }
    return false;
  }

  private bucketOf(sy: number): number {
    return clamp(Math.round(sy / BUCKET_H) + 1, 0, BUCKETS - 1);
  }

  private updateGroups(s: Site, px: number, py: number): void {
    for (const g of s.groups) {
      let inside = false;
      for (const r of g.rects) {
        if (px > r.x && px < r.x + r.w && py > r.y && py < r.y + r.h) { inside = true; break; }
      }
      const target = inside ? 1 : 0;
      g.open += clamp(target - g.open, -this.dt * 5, this.dt * 5);
    }
  }

  /** Opacité voulue d'un morceau, approchée en douceur : un mur ne clignote pas. */
  private targetAlpha(s: Site, p: Piece, hx: number, hy: number, current: number): number {
    let target = 1;
    if (p.shell >= 0) target = 1 - s.groups[p.shell]!.open;
    if (p.fades && p.skyline && hy < p.key - p.clearance && hy + 10 > p.y) {
      // La colonne du sprite la plus proche du héros : couvre-t-elle vraiment ses pieds ?
      const col = clamp(Math.floor((hx - p.x) / SKYLINE_STEP), 0, p.skyline.length - 1);
      if (hy + 10 > p.y + p.skyline[col]!) {
        const dx = hx < p.x ? p.x - hx : hx > p.x + p.w ? hx - p.x - p.w : 0;
        const q = clamp((dx - 26) / 230, 0, 1);
        target = Math.min(target, SEE_THROUGH + (1 - SEE_THROUGH) * q);
      }
    }
    return current + clamp(target - current, -this.dt * 6, this.dt * 6);
  }

  /** Peint à l'avance ce qui va paraître, sans jamais prendre plus de quelques millisecondes. */
  private prewarm(px: number, py: number, near: readonly Site[], now: number): void {
    for (const s of near) {
      this.loaded.add(s);
      for (const list of [s.pieces, s.decals]) {
        for (const p of list) {
          if (p.canvas) continue;
          if (Math.abs(p.x - px) > PREWARM_RANGE + 400 || Math.abs(p.y - py) > PREWARM_RANGE) continue;
          if (list === s.pieces) buildPiece(p);
          else buildDecal(p);
          if (performance.now() - now > PREWARM_MS) return;
        }
      }
    }
  }

  /** Rend à la mémoire les lieux dont on s'est éloigné. */
  private release(px: number, py: number): void {
    for (const s of this.loaded) {
      const b = s.bounds;
      const dx = Math.max(b.x - px, 0, px - b.x - b.w);
      const dy = Math.max(b.y - py, 0, py - b.y - b.h);
      if (dx > RELEASE_RANGE || dy > RELEASE_RANGE) {
        for (const p of s.pieces) p.canvas = null;
        for (const p of s.decals) p.canvas = null;
        this.loaded.delete(s);
      }
    }
  }

  /** Sols et tapis : sous tout le reste. */
  drawFloors(ctx: CanvasRenderingContext2D, VW: number, VH: number): void {
    const { ox, oy } = this;
    const S = gridScale();
    ctx.setTransform(S, 0, 0, S, ox * S, oy * S);
    for (const s of this.visible) {
      for (const f of s.floors) {
        if (f.x + f.w + ox < 0 || f.y + f.h + oy < 0 || f.x + ox > VW || f.y + oy > VH) continue;
        ctx.fillStyle = this.pattern(ctx, f.kind);
        ctx.fillRect(f.x, f.y, f.w, f.h);
      }
    }
    ctx.setTransform(S, 0, 0, S, 0, 0);
    for (const s of this.visible) {
      for (const p of s.decals) {
        if (p.x + p.w + ox < 0 || p.y + p.h + oy < 0 || p.x + ox > VW || p.y + oy > VH) continue;
        if (p.inner >= 0 && s.groups[p.inner]!.open <= 0.01) continue;
        ctx.drawImage(p.canvas ?? buildDecal(p), p.x + ox, p.y + oy);
      }
    }
  }

  private pattern(ctx: CanvasRenderingContext2D, kind: FloorKind): CanvasPattern {
    let p = this.patterns.get(kind);
    if (!p) {
      p = ctx.createPattern(floorTile(kind), 'repeat')!;
      this.patterns.set(kind, p);
    }
    return p;
  }

  /** Dessine ce qui passe avant les créatures de ce seau. */
  drawBucket(ctx: CanvasRenderingContext2D, bucket: number): void {
    const { items, ox, oy } = this;
    if (this.dirty) {
      items.sort((a, b) => a.key - b.key);
      this.dirty = false;
    }
    while (this.cursor < items.length && items[this.cursor]!.bucket <= bucket) {
      const it = items[this.cursor]!;
      if (it.piece) this.blit(ctx, it.piece, ox, oy);
      else if (it.tree) this.blitTree(ctx, it.tree, ox, oy);
      this.cursor++;
    }
  }

  private blitTree(ctx: CanvasRenderingContext2D, t: Tree, ox: number, oy: number): void {
    const s = treeSprite(t.kind, t.variant, t.grand, biomeAt(t.x, t.y));
    ctx.drawImage(s, snap(t.x + ox - s.width / 2), snap(t.y + oy - s.height + 3));
  }

  private blit(ctx: CanvasRenderingContext2D, p: Piece, ox: number, oy: number): void {
    const c = p.canvas ?? buildPiece(p);
    if (p.alpha < 0.99) ctx.globalAlpha = p.alpha;
    ctx.drawImage(c, p.x + ox, p.y + oy);
    ctx.globalAlpha = 1;
  }

  /**
   * Recouvre le héros de ce qui se trouve devant lui.
   *
   * Il est dessiné après toute la horde : plutôt que de le glisser dans le tri, on repeint par
   * dessus lui la seule zone de son sprite, pour les seuls morceaux situés au sud. Quatre ou cinq
   * découpes d'image, jamais plus.
   */
  coverHero(ctx: CanvasRenderingContext2D, hx: number, hy: number, heroY: number): void {
    const { items, ox, oy } = this;
    const L = snap(hx) - 22, T = snap(hy) - 34, W = 44, H = 48;
    for (const it of items) {
      const p = it.piece;
      if (!p || p.key <= heroY) continue;
      const sx = L - (p.x + ox), sy = T - (p.y + oy);
      if (sx >= p.w || sy >= p.h || sx + W <= 0 || sy + H <= 0) continue;
      const cx = Math.max(0, sx), cy = Math.max(0, sy);
      const cw = Math.min(p.w, sx + W) - cx, ch = Math.min(p.h, sy + H) - cy;
      if (cw <= 0 || ch <= 0) continue;
      const c = p.canvas ?? buildPiece(p);
      if (p.alpha < 0.99) ctx.globalAlpha = p.alpha;
      ctx.drawImage(c, cx, cy, cw, ch, p.x + ox + cx, p.y + oy + cy, cw, ch);
      ctx.globalAlpha = 1;
    }
  }

  /** Lueurs : vitraux, foyers. Elles passent par la couche de lumière, comme les sorts. */
  drawLights(fx: CanvasRenderingContext2D, VW: number, VH: number, time: number): void {
    const { ox, oy } = this;
    for (const s of this.visible) {
      for (let i = 0; i < s.lights.length; i++) {
        const l = s.lights[i]!;
        const x = l.x + ox, y = l.y + oy;
        if (x < -l.rx || y < -l.ry || x > VW + l.rx || y > VH + l.ry) continue;
        const breathe = 1 + Math.sin(time * 2.1 + i * 1.7) * 0.12;
        drawGlow(fx, x, y, l.rx, l.ry, l.color, l.alpha * breathe);
      }
    }
  }
}
