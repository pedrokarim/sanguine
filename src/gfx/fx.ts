import { TAU } from '../core/math';
import { rgba } from './palette';

/**
 * Couche de lumière et textures d'effets.
 *
 * Jusqu'ici, tout effet était un aplat semi-transparent posé sur la scène : un disque à
 * 20 % d'opacité pour une flaque, un carré pour une étincelle. Rien n'**émettait** de
 * lumière, et c'est précisément ce qui sépare un effet terne d'un effet spectaculaire.
 *
 * Deux principes corrigent le défaut à la racine.
 *
 * **La lumière s'additionne.** Tout ce qui brille est dessiné à part, en fusion additive :
 * deux lueurs qui se croisent s'ajoutent et chauffent vers le blanc. La couche est ensuite
 * recopiée sur la scène, puis recopiée encore en version floutée – le halo (*bloom*), qui
 * fait déborder la lumière au-delà de sa forme.
 *
 * **Les formes sont peintes une fois.** Un cercle magique, un croissant de faux, un éclair
 * sont dessinés avec soin dans une texture au premier usage – contours doublés, ombre
 * portée lumineuse, cœur blanc –, puis réemployés par simple recopie tournée et mise à
 * l'échelle. Les retracer trait par trait à chaque image interdisait tout détail : ce qui
 * coûte cher à peindre ne coûte rien à recopier.
 *
 * Le flou du halo suit la même logique d'économie : il s'obtient en réduisant l'image par
 * paliers, sans jamais passer par `ctx.filter`, lent et inégalement pris en charge.
 */

// ---------------------------------------------------------------------------
// Réglages
// ---------------------------------------------------------------------------

export type FxView = 'normal' | 'light' | 'flat';

export interface FxSettings {
  /** Intensité du halo. */
  bloom: number;
  /** Multiplicateur d'opacité de tout ce qui est dessiné sur la couche de lumière. */
  light: number;
  /** Multiplicateur du nombre de particules émises. */
  particles: number;
  /** Longueur et opacité des traînées de projectiles. */
  trails: number;
  /** Opacité des cercles magiques au sol. */
  sigils: number;
  /** Taille des effets ponctuels : coups, éclairs, explosions. */
  scale: number;
  /** `light` isole la couche de lumière, `flat` la masque : pour voir ce qu'elle apporte. */
  view: FxView;
}

export const FX_DEFAULTS: Readonly<FxSettings> = {
  bloom: 1,
  light: 1,
  particles: 1,
  trails: 1,
  sigils: 1,
  scale: 1,
  view: 'normal',
};

/** Réglages courants. Le laboratoire d'effets (`ui/fxlab.ts`) les modifie en direct. */
export const fxSettings: FxSettings = { ...FX_DEFAULTS };

/** Compteurs de l'image courante, remis à zéro par `FxLayer.begin`. */
export const fxStats = { glows: 0, sprites: 0 };

// ---------------------------------------------------------------------------
// Couche
// ---------------------------------------------------------------------------

export class FxLayer {
  readonly canvas = document.createElement('canvas');
  readonly ctx = this.canvas.getContext('2d')!;

  /** Réductions successives : ½, ¼, ⅛. Réduire d'un seul coup ferait scintiller le halo. */
  private readonly steps = [0, 1, 2].map(() => {
    const canvas = document.createElement('canvas');
    return { canvas, ctx: canvas.getContext('2d')! };
  });

  /** Atténuation imposée par l'option « Réduire les flashs », distincte du réglage de halo. */
  comfort = 1;

  /** À appeler en début d'image : vide la couche et l'accorde à la taille de la scène. */
  begin(w: number, h: number): void {
    fxStats.glows = 0;
    fxStats.sprites = 0;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      let sw = w;
      let sh = h;
      for (const s of this.steps) {
        sw = Math.max(1, Math.ceil(sw / 2));
        sh = Math.max(1, Math.ceil(sh / 2));
        s.canvas.width = sw;
        s.canvas.height = sh;
      }
    } else {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.clearRect(0, 0, w, h);
    }
    this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.globalAlpha = 1;
    this.ctx.imageSmoothingEnabled = true;
  }

  /** Ajoute la couche et son halo à la scène. */
  composite(target: CanvasRenderingContext2D): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (fxSettings.view === 'flat') return;
    if (fxSettings.view === 'light') {
      target.fillStyle = '#000000';
      target.fillRect(0, 0, w, h);
    }

    // `screen` plutôt que `lighter` pour la recopie : à l'intérieur de la couche les lueurs
    // s'additionnent franchement, mais posées sur la scène elles saturent en douceur au
    // lieu d'écraser un combat entier sous un aplat blanc.
    target.globalCompositeOperation = 'screen';
    target.globalAlpha = 1;
    target.drawImage(this.canvas, 0, 0);

    const bloom = fxSettings.bloom * this.comfort;
    if (bloom > 0) {
      let src: HTMLCanvasElement = this.canvas;
      for (const s of this.steps) {
        s.ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
        s.ctx.drawImage(src, 0, 0, s.canvas.width, s.canvas.height);
        src = s.canvas;
      }
      target.imageSmoothingEnabled = true;
      target.globalAlpha = Math.min(1, 0.34 * bloom);
      target.drawImage(this.steps[1]!.canvas, 0, 0, w, h);
      target.globalAlpha = Math.min(1, 0.4 * bloom);
      target.drawImage(this.steps[2]!.canvas, 0, 0, w, h);
      target.imageSmoothingEnabled = false;
    }

    target.globalAlpha = 1;
    target.globalCompositeOperation = 'source-over';
  }
}

// ---------------------------------------------------------------------------
// Textures précalculées
// ---------------------------------------------------------------------------

/** Côté des textures carrées. Le motif tient dans un rayon de `TEX_R` autour du centre. */
const TEX = 128;
const TEX_C = TEX / 2;
export const TEX_R = 56;

/** Pivot et rayon du croissant dans sa texture : il pointe vers +x depuis `SLASH_PIVOT`. */
const SLASH_PIVOT = 18;
const SLASH_R = 98;

export const BOLT_W = 64;
export const BOLT_H = 192;
export const BOLT_VARIANTS = 4;

export type FxTexture = 'glow' | 'sigil' | 'star' | 'swirl' | 'slash' | 'flare' | 'ring' | 'bolt';

/** Familles de textures, dans l'ordre où le laboratoire les présente. */
export const FX_TEXTURES: readonly FxTexture[] = [
  'glow', 'sigil', 'star', 'swirl', 'slash', 'flare', 'ring', 'bolt',
];

const cache = new Map<string, HTMLCanvasElement>();

function bake(key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    paint(g);
    cache.set(key, c);
  }
  return c;
}

/**
 * Trace le chemin courant trois fois : un trait large et diffus, un trait net, un cœur blanc.
 * C'est la recette du « néon », et elle n'est abordable que parce qu'elle est peinte une fois.
 */
function neon(g: CanvasRenderingContext2D, color: string, width: number): void {
  g.shadowColor = color;
  g.shadowBlur = width * 3;
  g.strokeStyle = rgba(color, 0.55);
  g.lineWidth = width * 2.2;
  g.stroke();
  g.shadowBlur = width * 1.5;
  g.strokeStyle = color;
  g.lineWidth = width;
  g.stroke();
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = Math.max(0.6, width * 0.35);
  g.stroke();
}

/** Tache de lumière radiale. */
export function glowTexture(color: string): HTMLCanvasElement {
  return bake(`glow:${color}`, 64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, rgba(color, 1));
    grad.addColorStop(0.22, rgba(color, 0.6));
    grad.addColorStop(0.55, rgba(color, 0.16));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });
}

/** Anneau extérieur d'un cercle magique : double liseré, graduations, glyphes. */
export function sigilTexture(color: string): HTMLCanvasElement {
  return bake(`sigil:${color}`, TEX, TEX, (g) => {
    g.translate(TEX_C, TEX_C);

    g.beginPath();
    g.arc(0, 0, TEX_R, 0, TAU);
    neon(g, color, 2.2);

    g.beginPath();
    g.arc(0, 0, TEX_R - 13, 0, TAU);
    neon(g, color, 1);

    // Graduations : une longue toutes les trois, comme un cadran.
    g.beginPath();
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * TAU;
      const inner = TEX_R - (k % 3 === 0 ? 10 : 6);
      g.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      g.lineTo(Math.cos(a) * (TEX_R - 3), Math.sin(a) * (TEX_R - 3));
    }
    neon(g, color, 0.8);

    // Glyphes : douze signes anguleux tirés d'un bruit fixe, qui se lisent comme une
    // écriture sans en être une. Assez pour suggérer une inscription à cette échelle.
    g.beginPath();
    for (let k = 0; k < 12; k++) {
      const a = ((k + 0.5) / 12) * TAU;
      g.save();
      g.rotate(a);
      g.translate(TEX_R - 19.5, 0);
      let px = (noise(k * 3.1) - 0.5) * 5;
      let py = -3;
      g.moveTo(px, py);
      for (let s = 1; s <= 3; s++) {
        px = (noise(k * 7.7 + s * 1.9) - 0.5) * 5;
        py = -3 + s * 2;
        g.lineTo(px, py);
      }
      g.restore();
    }
    neon(g, color, 0.7);
  });
}

/** Cœur d'un cercle magique : étoile à six branches inscrite, et son moyeu. */
export function starTexture(color: string): HTMLCanvasElement {
  return bake(`star:${color}`, TEX, TEX, (g) => {
    g.translate(TEX_C, TEX_C);
    g.beginPath();
    for (let tri = 0; tri < 2; tri++) {
      for (let k = 0; k <= 3; k++) {
        const a = tri * (TAU / 6) + (k / 3) * TAU - TAU / 4;
        const x = Math.cos(a) * TEX_R;
        const y = Math.sin(a) * TEX_R;
        if (k === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
    }
    neon(g, color, 1.3);
    g.beginPath();
    g.arc(0, 0, TEX_R * 0.3, 0, TAU);
    neon(g, color, 1);
  });
}

/** Tourbillon : trois bras en spirale, épais au cœur et effilés au bord. */
export function swirlTexture(color: string): HTMLCanvasElement {
  return bake(`swirl:${color}`, TEX, TEX, (g) => {
    g.translate(TEX_C, TEX_C);
    g.shadowColor = color;
    for (let pass = 0; pass < 2; pass++) {
      for (let arm = 0; arm < 3; arm++) {
        const SEGMENTS = 22;
        for (let s = 0; s < SEGMENTS; s++) {
          const t0 = s / SEGMENTS;
          const t1 = (s + 1) / SEGMENTS;
          const at = (t: number): [number, number] => {
            const a = (arm / 3) * TAU + t * 2.3;
            const r = TEX_R * (0.22 + 0.78 * t);
            return [Math.cos(a) * r, Math.sin(a) * r];
          };
          const [x0, y0] = at(t0);
          const [x1, y1] = at(t1);
          // L'épaisseur culmine au premier tiers du bras, puis s'effile jusqu'à la pointe.
          const body = Math.sin(Math.min(1, t0 * 1.4) * Math.PI);
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          if (pass === 0) {
            g.shadowBlur = 8;
            g.strokeStyle = rgba(color, 0.75);
            g.lineWidth = 1 + body * 6;
          } else {
            g.shadowBlur = 0;
            g.strokeStyle = `rgba(255,255,255,${0.75 * body})`;
            g.lineWidth = 0.6 + body * 1.6;
          }
          g.stroke();
        }
      }
    }
  });
}

/** Croissant de coup : large au milieu, effilé aux pointes, bord d'attaque blanc. */
export function slashTexture(color: string): HTMLCanvasElement {
  return bake(`slash:${color}`, TEX, TEX, (g) => {
    const SPAN = 0.6;
    /** Lentille entre l'arc d'attaque et un arc plus large reculé de `back`. */
    const lens = (back: number): void => {
      const cx = SLASH_PIVOT - back;
      const ex = SLASH_PIVOT + Math.cos(SPAN) * SLASH_R;
      const ey = Math.sin(SPAN) * SLASH_R;
      const r2 = Math.hypot(ex - cx, ey);
      const span2 = Math.atan2(ey, ex - cx);
      g.beginPath();
      g.arc(SLASH_PIVOT, TEX_C, SLASH_R, -SPAN, SPAN);
      g.arc(cx, TEX_C, r2, span2, -span2, true);
      g.closePath();
    };

    lens(46);
    const grad = g.createRadialGradient(SLASH_PIVOT, TEX_C, SLASH_R - 34, SLASH_PIVOT, TEX_C, SLASH_R);
    grad.addColorStop(0, rgba(color, 0));
    grad.addColorStop(0.55, rgba(color, 0.55));
    grad.addColorStop(1, rgba(color, 1));
    g.shadowColor = color;
    g.shadowBlur = 10;
    g.fillStyle = grad;
    g.fill();

    lens(9);
    g.shadowBlur = 4;
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.fill();
  });
}

/** Étoile d'impact à quatre branches. */
export function flareTexture(color: string): HTMLCanvasElement {
  return bake(`flare:${color}`, TEX, TEX, (g) => {
    g.translate(TEX_C, TEX_C);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, TEX_R * 0.5);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, rgba(color, 0.7));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(-TEX_C, -TEX_C, TEX, TEX);

    g.shadowColor = color;
    g.shadowBlur = 6;
    for (const [len, thick] of [[TEX_R, 3.2], [TEX_R * 0.55, 2.2]] as const) {
      g.rotate(TAU / 8);
      g.fillStyle = len === TEX_R ? '#ffffff' : rgba(color, 0.9);
      for (let k = 0; k < 4; k++) {
        g.rotate(TAU / 4);
        g.beginPath();
        g.moveTo(0, -thick);
        g.lineTo(len, 0);
        g.lineTo(0, thick);
        g.closePath();
        g.fill();
      }
    }
  });
}

/** Onde de choc : anneau au bord net vers l'extérieur, fondu vers l'intérieur. */
export function ringTexture(color: string): HTMLCanvasElement {
  return bake(`ring:${color}`, TEX, TEX, (g) => {
    const grad = g.createRadialGradient(TEX_C, TEX_C, TEX_R * 0.55, TEX_C, TEX_C, TEX_R + 4);
    grad.addColorStop(0, rgba(color, 0));
    grad.addColorStop(0.72, rgba(color, 0.38));
    grad.addColorStop(0.9, rgba(color, 1));
    grad.addColorStop(0.95, 'rgba(255,255,255,1)');
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, TEX, TEX);
  });
}

/**
 * Éclair. Quatre tracés par couleur, tirés d'un bruit fixe : les alterner d'une image à
 * l'autre suffit à le faire trembler, sans rien recalculer pendant la partie.
 */
export function boltTexture(color: string, variant: number): HTMLCanvasElement {
  const v = ((variant % BOLT_VARIANTS) + BOLT_VARIANTS) % BOLT_VARIANTS;
  return bake(`bolt:${color}:${v}`, BOLT_W, BOLT_H, (g) => {
    const SEGMENTS = 9;
    const xs: number[] = [];
    g.beginPath();
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS;
      // L'écart se resserre vers le bas : l'éclair doit tomber exactement sur sa cible.
      const x = BOLT_W / 2 + (noise(v * 31.7 + i * 5.3) - 0.5) * 34 * (1 - t * t);
      xs.push(x);
      const y = 4 + t * (BOLT_H - 10);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    neon(g, color, 1.7);

    // Une ramification, partie du premier tiers.
    const from = 2 + (v % 3);
    g.beginPath();
    let bx = xs[from]!;
    let by = 4 + (from / SEGMENTS) * (BOLT_H - 10);
    const dir = v % 2 === 0 ? 1 : -1;
    g.moveTo(bx, by);
    for (let i = 1; i <= 3; i++) {
      bx += dir * (4 + noise(v * 9.1 + i) * 7);
      by += 9 + noise(v * 4.3 + i * 2.2) * 9;
      g.lineTo(bx, by);
    }
    neon(g, color, 0.9);
  });
}

/** Texture d'une famille, pour le laboratoire qui les affiche toutes. */
export function textureOf(kind: FxTexture, color: string): HTMLCanvasElement {
  switch (kind) {
    case 'glow': return glowTexture(color);
    case 'sigil': return sigilTexture(color);
    case 'star': return starTexture(color);
    case 'swirl': return swirlTexture(color);
    case 'slash': return slashTexture(color);
    case 'flare': return flareTexture(color);
    case 'ring': return ringTexture(color);
    case 'bolt': return boltTexture(color, 0);
  }
}

// ---------------------------------------------------------------------------
// Tracé
// ---------------------------------------------------------------------------

/** Dessine une lueur elliptique. Laisse `globalAlpha` à 1. */
export function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, rx: number, ry: number,
  color: string, alpha: number,
): void {
  const a = alpha * fxSettings.light;
  if (a <= 0.01 || rx <= 0 || ry <= 0) return;
  fxStats.glows++;
  ctx.globalAlpha = a > 1 ? 1 : a;
  ctx.drawImage(glowTexture(color), x - rx, y - ry, rx * 2, ry * 2);
  ctx.globalAlpha = 1;
}

/**
 * Recopie une texture carrée centrée, tournée de `rot` puis écrasée verticalement de
 * `squash` – l'ordre compte : c'est ce qui fait tourner un cercle **à plat sur le sol**
 * plutôt que de faire basculer une ellipse.
 *
 * `radius` est le rayon voulu à l'écran pour le motif (qui occupe `TEX_R` dans la texture).
 */
export function drawSpin(
  ctx: CanvasRenderingContext2D, tex: HTMLCanvasElement,
  x: number, y: number, radius: number, squash: number, rot: number, alpha: number,
): void {
  const a = alpha * fxSettings.light;
  if (a <= 0.01 || radius <= 0) return;
  fxStats.sprites++;
  const s = radius / TEX_R;
  const cos = Math.cos(rot) * s;
  const sin = Math.sin(rot) * s;
  ctx.globalAlpha = a > 1 ? 1 : a;
  ctx.setTransform(cos, sin * squash, -sin, cos * squash, x, y);
  ctx.drawImage(tex, -tex.width / 2, -tex.height / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
}

/** Croissant de coup, pivotant autour de (`x`, `y`), de portée `reach`, orienté par `angle`. */
export function drawSlash(
  ctx: CanvasRenderingContext2D, color: string,
  x: number, y: number, reach: number, angle: number, alpha: number,
): void {
  const a = alpha * fxSettings.light;
  if (a <= 0.01 || reach <= 0) return;
  fxStats.sprites++;
  const s = reach / SLASH_R;
  const cos = Math.cos(angle) * s;
  const sin = Math.sin(angle) * s;
  ctx.globalAlpha = a > 1 ? 1 : a;
  ctx.setTransform(cos, sin, -sin, cos, x, y);
  ctx.drawImage(slashTexture(color), -SLASH_PIVOT, -TEX_C);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
}

/** Éclair tombant sur (`x`, `y`) depuis une hauteur `height`. */
export function drawBolt(
  ctx: CanvasRenderingContext2D, color: string, variant: number,
  x: number, y: number, height: number, alpha: number,
): void {
  const a = alpha * fxSettings.light;
  if (a <= 0.01) return;
  fxStats.sprites++;
  const s = height / BOLT_H;
  // Un tracé sur deux est retourné : huit silhouettes pour le prix de quatre.
  const flip = variant % 2 === 0 ? 1 : -1;
  ctx.globalAlpha = a > 1 ? 1 : a;
  ctx.setTransform(s * flip, 0, 0, s, x, y);
  ctx.drawImage(boltTexture(color, variant), -BOLT_W / 2, -(BOLT_H - 6));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
}

/** Bruit déterministe dans [0, 1[. */
export function noise(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}
