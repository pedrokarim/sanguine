import { Rng } from '../core/rng';
import { TAU, PI } from '../core/math';
import { P, RARITY_COLOR, shade, type Rarity } from './palette';
import { Pix, toCanvas, tint, silhouette } from './pix';

/**
 * Générateur de sprites procéduraux.
 *
 * Tout est dessiné par le code au démarrage (~30 ms), puis mis en cache. Aucun fichier image
 * n'est expédié. Chaque sprite existe en trois teintes pré-calculées – normale, flash blanc de
 * dégâts, silhouette rouge d'élite – pour qu'aucun filtre ne soit appliqué pendant le rendu.
 *
 * Index de palette utilisés par les générateurs :
 *   0 = contour   1 = ombre   2 = teinte principale   3 = lumière   4 = accent (yeux)   5 = accent 2
 */

export interface SpriteSet {
  frames: HTMLCanvasElement[];
  flash: HTMLCanvasElement[];
  elite: HTMLCanvasElement[];
  w: number;
  h: number;
}

export interface BodyArt {
  plan: 'humanoid' | 'beast' | 'flying' | 'spider' | 'blob' | 'ghost' | 'rider' | 'armored';
  w: number;
  h: number;
  /** [ombre, principale, lumière] */
  cols: [string, string, string];
  eye: string;
  accent?: string;
  horns?: boolean;
  tail?: boolean;
  crown?: boolean;
  frames?: number;
}

const cache = new Map<string, SpriteSet>();

function build(pixFrames: Pix[], colors: readonly string[]): SpriteSet {
  const frames = pixFrames.map((p) => toCanvas(p, colors));
  return {
    frames,
    flash: frames.map((f) => tint(f, '#ffffff', 0.85)),
    elite: frames.map((f) => tint(f, P.bloodHi, 0.42)),
    w: frames[0]!.width,
    h: frames[0]!.height,
  };
}

/**
 * Palette d'une créature.
 *
 * Les six premières teintes sont celles d'origine, et les plans corporels continuent de s'y
 * référer par leurs indices — c'est ce qui permet d'enrichir l'ombrage sans réécrire les
 * huit plans. Les trois dernières ne sont posées par aucun plan : ce sont les passes
 * d'éclairage de `makeBody` qui les appliquent.
 *
 * Toutes sont dérivées des trois couleurs de la créature. Une créature reste donc définie
 * par trois teintes dans `data/enemies.ts`, ce qui garde la table lisible.
 */
function paletteOf(a: BodyArt): string[] {
  return [
    shade(a.cols[0], -0.55), // 0 contour
    a.cols[0],               // 1 corps, ombre
    a.cols[1],               // 2 corps
    a.cols[2],               // 3 corps, lumière
    a.eye,                   // 4 œil
    a.accent ?? a.eye,       // 5 accent
    shade(a.cols[1], 0.22),  // 6 rasante — bord opposé à la lumière
    shade(a.cols[0], -0.4),  // 7 occlusion — sous un rebord
    shade(a.cols[0], -0.42), // 8 contour du côté éclairé
  ];
}

// ---------------------------------------------------------------------------
// Plans corporels
// ---------------------------------------------------------------------------

function humanoid(p: Pix, a: BodyArt, t: number): void {
  const cx = p.w / 2 - 0.5;
  const h = p.h;
  const swing = Math.sin(t * TAU);
  const bob = Math.abs(Math.cos(t * TAU)) * 0.7;
  const hipY = h * 0.66 - bob;
  const shY = h * 0.40 - bob;
  const headR = p.w * 0.3;
  const headCy = h * 0.2 - bob;

  // Jambes – la phase opposée des deux jambes crée la marche.
  p.limb(cx - 1.3, hipY, cx - 1.3 + swing * 1.9, h - 1.5, 2, 1);
  p.limb(cx + 1.3, hipY, cx + 1.3 - swing * 1.9, h - 1.5, 2, 1);
  // Bras – balancés à contretemps des jambes.
  p.limb(cx - p.w * 0.26, shY, cx - p.w * 0.32 - swing * 1.3, shY + h * 0.3, 2, 1);
  p.limb(cx + p.w * 0.26, shY, cx + p.w * 0.32 + swing * 1.3, shY + h * 0.3, 2, 1);
  // Torse
  p.ellipse(cx, (shY + hipY) / 2, p.w * 0.27, (hipY - shY) / 2 + 1.2, 2);
  // Tête
  p.ellipse(cx, headCy, headR, headR * 0.98, 2);

  if (a.horns) {
    p.line(cx - headR * 0.8, headCy - headR * 0.5, cx - headR * 1.5, headCy - headR * 1.6, 3);
    p.line(cx + headR * 0.8, headCy - headR * 0.5, cx + headR * 1.5, headCy - headR * 1.6, 3);
  }

  p.shadeVertical(2, 3, 1);
  p.set(cx - headR * 0.45, headCy + 0.2, 4);
  p.set(cx + headR * 0.45, headCy + 0.2, 4);
}

function armored(p: Pix, a: BodyArt, t: number): void {
  humanoid(p, a, t);
  const cx = p.w / 2 - 0.5;
  const bob = Math.abs(Math.cos(t * TAU)) * 0.7;
  const headCy = p.h * 0.2 - bob;
  const headR = p.w * 0.3;
  // Heaume : bandeau sombre à hauteur des yeux, avec une fente lumineuse.
  p.rect(cx - headR, headCy - headR * 0.9, headR * 2 + 1, headR * 1.1, 1);
  p.set(cx - headR * 0.5, headCy + 0.2, 5);
  p.set(cx + headR * 0.5, headCy + 0.2, 5);
  // Spallières
  p.ellipse(cx - p.w * 0.32, p.h * 0.4 - bob, 1.8, 1.4, 3);
  p.ellipse(cx + p.w * 0.32, p.h * 0.4 - bob, 1.8, 1.4, 3);
}

function beast(p: Pix, a: BodyArt, t: number): void {
  // Orienté vers la droite ; le rendu retourne le sprite selon la direction.
  const w = p.w;
  const h = p.h;
  const step = Math.sin(t * TAU);
  const bodyCy = h * 0.5;

  if (a.tail !== false) p.limb(w * 0.14, bodyCy, w * 0.02, bodyCy - h * 0.22 - step, 1.6, 1);

  // Pattes : avant et arrière en opposition de phase.
  p.limb(w * 0.28, bodyCy + h * 0.1, w * 0.28 + step * 2, h - 1, 1.8, 1);
  p.limb(w * 0.66, bodyCy + h * 0.1, w * 0.66 - step * 2, h - 1, 1.8, 1);
  p.limb(w * 0.38, bodyCy + h * 0.1, w * 0.38 - step * 1.6, h - 1, 1.6, 1);
  p.limb(w * 0.76, bodyCy + h * 0.1, w * 0.76 + step * 1.6, h - 1, 1.6, 1);

  p.ellipse(w * 0.48, bodyCy, w * 0.34, h * 0.24, 2); // corps
  p.ellipse(w * 0.76, bodyCy - h * 0.14, w * 0.19, h * 0.19, 2); // tête
  p.ellipse(w * 0.92, bodyCy - h * 0.08, w * 0.1, h * 0.1, 2); // museau

  if (a.horns) {
    p.line(w * 0.7, bodyCy - h * 0.3, w * 0.62, bodyCy - h * 0.52, 3);
    p.line(w * 0.84, bodyCy - h * 0.3, w * 0.9, bodyCy - h * 0.52, 3);
  }
  p.shadeVertical(2, 3, 1);
  p.set(w * 0.82, bodyCy - h * 0.16, 4);
}

function flying(p: Pix, a: BodyArt, t: number): void {
  const cx = p.w / 2 - 0.5;
  const cy = p.h * 0.5;
  const flap = Math.sin(t * TAU); // -1 = ailes basses, +1 = ailes hautes
  const tipY = cy - flap * p.h * 0.3;
  const midY = cy - flap * p.h * 0.12;

  // Ailes membraneuses : deux segments par aile pour suggérer l'articulation.
  for (const s of [-1, 1]) {
    p.limb(cx + s * 1.2, cy, cx + s * p.w * 0.26, midY, 1.6, 1);
    p.limb(cx + s * p.w * 0.26, midY, cx + s * p.w * 0.5, tipY, 1.4, 1);
    p.line(cx + s * p.w * 0.26, midY, cx + s * p.w * 0.44, tipY + 2, 1);
    p.line(cx + s * 1.2, cy + 1, cx + s * p.w * 0.42, tipY + 2.5, 1);
  }
  p.ellipse(cx, cy, p.w * 0.15, p.h * 0.26, 2); // corps
  p.ellipse(cx, cy - p.h * 0.2, p.w * 0.13, p.h * 0.15, 2); // tête
  if (a.horns) {
    p.set(cx - 1, cy - p.h * 0.34, 3);
    p.set(cx + 1, cy - p.h * 0.34, 3);
  }
  p.shadeVertical(2, 3, 1);
  p.set(cx - 1, cy - p.h * 0.2, 4);
  p.set(cx + 1, cy - p.h * 0.2, 4);
}

function spider(p: Pix, a: BodyArt, t: number): void {
  const cx = p.w / 2 - 0.5;
  const cy = p.h * 0.52;
  for (let i = 0; i < 4; i++) {
    const ph = Math.sin(t * TAU + i * 1.4);
    const ay = cy - p.h * 0.16 + i * (p.h * 0.13);
    const reach = p.w * (0.38 + i * 0.03);
    for (const s of [-1, 1]) {
      const kneeX = cx + s * reach * 0.6;
      const kneeY = ay - 1.6 - ph * 1.2;
      p.limb(cx + s * 1.5, ay, kneeX, kneeY, 1.2, 1);
      p.limb(kneeX, kneeY, cx + s * reach, ay + 2.2 + ph * 0.8, 1.2, 1);
    }
  }
  p.ellipse(cx, cy + p.h * 0.08, p.w * 0.22, p.h * 0.24, 2); // abdomen
  p.ellipse(cx, cy - p.h * 0.16, p.w * 0.16, p.h * 0.14, 2); // céphalothorax
  p.shadeVertical(2, 3, 1);
  p.set(cx - 1, cy - p.h * 0.18, 4);
  p.set(cx + 1, cy - p.h * 0.18, 4);
  if (a.accent) {
    p.set(cx, cy + p.h * 0.1, 5);
    p.set(cx, cy + p.h * 0.2, 5);
  }
}

function blob(p: Pix, a: BodyArt, t: number): void {
  const cx = p.w / 2 - 0.5;
  const wob = Math.sin(t * TAU);
  const cy = p.h * 0.56 - Math.abs(wob) * 0.8;
  const rx = p.w * 0.4 * (1 + wob * 0.05);
  const ry = p.h * 0.42 * (1 - wob * 0.05);

  p.limb(cx - rx * 0.85, cy, cx - rx * 1.25, cy + ry * 0.85 + wob, 2.4, 1);
  p.limb(cx + rx * 0.85, cy, cx + rx * 1.25, cy + ry * 0.85 - wob, 2.4, 1);
  p.ellipse(cx, cy, rx, ry, 2);
  // Boursouflures asymétriques : sans elles, la masse ressemble à une simple ellipse.
  p.ellipse(cx - rx * 0.4, cy - ry * 0.3, rx * 0.3, ry * 0.28, 3);
  p.ellipse(cx + rx * 0.45, cy + ry * 0.2, rx * 0.26, ry * 0.24, 1);
  p.shadeVertical(2, 3, 1);
  p.set(cx - rx * 0.35, cy - ry * 0.35, 4);
  p.set(cx + rx * 0.3, cy - ry * 0.2, 4);
  if (a.horns) {
    p.line(cx - rx * 0.6, cy - ry, cx - rx * 0.9, cy - ry * 1.5, 3);
    p.line(cx + rx * 0.6, cy - ry, cx + rx * 0.9, cy - ry * 1.5, 3);
  }
}

function ghost(p: Pix, a: BodyArt, t: number): void {
  const cx = p.w / 2 - 0.5;
  const float = Math.sin(t * TAU) * 0.9;
  const top = p.h * 0.16 + float;
  const rx = p.w * 0.34;

  p.ellipse(cx, top + rx, rx, rx * 1.05, 2);
  // Corps qui s'effiloche : chaque colonne descend d'une hauteur ondulée.
  for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) {
    const nx = x / rx;
    if (Math.abs(nx) > 1) continue;
    const bottom = p.h - 1.5 - Math.abs(Math.sin(x * 0.9 + t * TAU)) * 2.2 - Math.abs(nx) * 2;
    for (let y = top + rx; y <= bottom; y++) {
      const halfW = rx * Math.sqrt(Math.max(0, 1 - Math.pow((y - top - rx) / (p.h * 0.7), 2) * 0.35));
      if (Math.abs(x) <= halfW) p.set(cx + x, y, 2);
    }
  }
  p.shadeVertical(2, 3, 1);
  p.set(cx - rx * 0.4, top + rx, 4);
  p.set(cx + rx * 0.4, top + rx, 4);
  if (a.accent) p.set(cx, top + rx + 2, 5);
}

/** Cavalier : une monture bestiale surmontée d'un buste cuirassé. */
function rider(p: Pix, a: BodyArt, t: number): void {
  beast(p, { ...a, horns: false }, t);
  const cx = p.w * 0.5;
  const bob = Math.abs(Math.cos(t * TAU)) * 0.5;
  const shY = p.h * 0.26 - bob;
  p.limb(cx - 1, shY, cx - 1, p.h * 0.44, 2.2, 1);
  p.ellipse(cx, shY, p.w * 0.13, p.h * 0.12, 3);
  p.ellipse(cx, shY - p.h * 0.13, p.w * 0.1, p.h * 0.1, 2);
  p.set(cx, shY - p.h * 0.13, 5);
  // Lance
  p.line(cx + 1, shY - 1, p.w - 1, shY + p.h * 0.16, 3);
}

const PLANS: Record<BodyArt['plan'], (p: Pix, a: BodyArt, t: number) => void> = {
  humanoid,
  armored,
  beast,
  flying,
  spider,
  blob,
  ghost,
  rider,
};

// ---------------------------------------------------------------------------
// Fabrique publique
// ---------------------------------------------------------------------------

/**
 * Facteur d'agrandissement de tous les corps.
 *
 * Les tailles restent écrites à leur valeur d'origine dans `data/enemies.ts` — elles y sont
 * lisibles et comparables — et c'est ici qu'on les multiplie. Un seul chiffre à changer
 * pour reculer, ce qui compte quand on touche à l'apparence de tout le jeu d'un coup.
 *
 * Les plans dessinent déjà en proportions de la grille ; seule l'épaisseur des membres est
 * absolue, et `Pix.unit` s'en charge.
 */
export const CORPS_ECHELLE = 1.5;

/**
 * Grille des objets — butin, projectiles, reliques, fioles.
 *
 * **Taille native, sans mise à l'échelle**, et c'est une décision prise après échec.
 *
 * Une version précédente agrandissait leurs coordonnées d'un facteur 1,5 pour les mettre au
 * diapason des créatures. Sur des plans corporels, qui dessinent en proportions, cela marche.
 * Sur ces objets-ci, tracés pixel par pixel à leur taille définitive, l'arrondi a détruit les
 * formes : la croix est devenue un L brisé, le sablier un carré, le cœur un triangle. Une
 * forme de douze pixels ne survit pas à une multiplication non entière.
 *
 * Un objet plus petit que la créature qui le lâche se remarque à peine. Un objet
 * méconnaissable se remarque tout de suite.
 */
function pixObjet(w: number, h: number): Pix {
  return new Pix(w, h);
}

export function makeBody(key: string, art: BodyArt): SpriteSet {
  const hit = cache.get(key);
  if (hit) return hit;

  const n = art.frames ?? 4;
  const S = CORPS_ECHELLE;
  const pixFrames: Pix[] = [];
  for (let i = 0; i < n; i++) {
    const p = new Pix(Math.round(art.w * S), Math.round(art.h * S));
    p.unit = S;
    PLANS[art.plan](p, art, i / n);
    if (art.crown) {
      const cx = p.w / 2 - 0.5;
      const k0 = Math.round(2 * S);
      for (let k = -k0; k <= k0; k++) p.set(cx + k, Math.round(S), 5);
      for (const k of [-k0, 0, k0]) p.set(cx + k, 0, 5);
    }
    /*
     * Passes d'éclairage.
     *
     * Elles s'appliquent après le plan, sur la silhouette déjà formée, et c'est ce qui les
     * rend valables pour les huit plans sans en toucher un seul. Mesuré avant : cinq teintes
     * par créature contre neuf pour le héros — les corps avaient grandi sans être éclairés.
     *
     * L'ordre compte : la rasante se pose sur les bords, l'occlusion creuse sous les
     * rebords, et le contour vient en dernier pour ne pas être mangé par les deux autres.
     *
     * Les écarts sont volontairement faibles. Une première version prenait la teinte la plus
     * claire du corps et l'éclaircissait de moitié : chaque créature se retrouvait cernée
     * d'un liseré presque blanc, et l'écran ressemblait à une planche d'autocollants.
     */
    p.rimLight(1, 0, 6);
    p.occlusion(7);
    p.outlineDouble(0, 8);
    pixFrames.push(p);
  }
  const set = build(pixFrames, paletteOf(art));
  cache.set(key, set);
  return set;
}

/** Frames de mort : dislocation progressive du sprite de base. */
export function makeDeath(key: string, base: SpriteSet, seed: number): SpriteSet {
  const hit = cache.get(key);
  if (hit) return hit;
  const rng = new Rng(seed);
  const src = base.frames[0]!;
  const w = src.width;
  const h = src.height;
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d')!;
  tctx.drawImage(src, 0, 0);
  const data = tctx.getImageData(0, 0, w, h).data;

  const frames: HTMLCanvasElement[] = [];
  for (let f = 0; f < 5; f++) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    const t = f / 4;
    const r2 = rng.fork(1);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        if (data[o + 3] === 0) continue;
        if (r2.next() < t * 0.85) continue; // le pixel a « éclaté »
        const nx = Math.round(x + r2.spread(t * 3));
        const ny = Math.round(y + r2.spread(t * 2) + t * 1.5);
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const no = (ny * w + nx) * 4;
        img.data[no] = 200 - t * 60;
        img.data[no + 1] = 40;
        img.data[no + 2] = 60;
        img.data[no + 3] = 255 * (1 - t * 0.5);
      }
    }
    ctx.putImageData(img, 0, 0);
    frames.push(c);
  }
  const set: SpriteSet = { frames, flash: frames, elite: frames, w, h };
  cache.set(key, set);
  return set;
}

// ---------------------------------------------------------------------------
// Joueur
// ---------------------------------------------------------------------------

export interface HeroArt {
  cloak: string;
  cloth: string;
  skin: string;
  accent: string;
  hat: 'hood' | 'wide' | 'none' | 'veil' | 'crown';
}

/**
 * Style de héros en vigueur.
 *
 * Les deux générateurs coexistent le temps de trancher : le détaillé est servi par défaut,
 * et `F8` bascule en jeu. Comparer de mémoire, d'une session à l'autre, ne permet pas de
 * décider — il faut pouvoir alterner sous les yeux.
 */
let styleDetaille = true;

export function setHeroDetaille(v: boolean): void {
  styleDetaille = v;
}

export function getHeroDetaille(): boolean {
  return styleDetaille;
}

/** Aiguillage : les six points d'appel du jeu n'ont pas à connaître les deux variantes. */
export function makeHero(key: string, art: HeroArt, moving: boolean): SpriteSet {
  return styleDetaille ? makeHeroDetaille(key, art, moving) : makeHeroClassique(key, art, moving);
}

export function makeHeroClassique(key: string, art: HeroArt, moving: boolean): SpriteSet {
  const ck = `${key}:${moving ? 'walk' : 'idle'}`;
  const hit = cache.get(ck);
  if (hit) return hit;

  const W = 13;
  const H = 15;
  const n = moving ? 6 : 4;
  const cols = [
    shade(art.cloak, -0.6), // 0 contour
    shade(art.cloak, -0.2), // 1 ombre
    art.cloak, // 2 cape
    art.cloth, // 3 vêtement
    art.skin, // 4 peau
    art.accent, // 5 accent
  ];

  const pixFrames: Pix[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const p = new Pix(W, H);
    const cx = W / 2 - 0.5;
    const swing = moving ? Math.sin(t * TAU) : 0;
    const bob = moving ? Math.abs(Math.cos(t * TAU)) * 0.8 : Math.sin(t * TAU) * 0.4;
    const hipY = 10.2 - bob;
    const shY = 6.4 - bob;
    const headCy = 3.6 - bob;

    // Jambes
    p.limb(cx - 1.4, hipY, cx - 1.4 + swing * 2.1, H - 1.5, 2, 1);
    p.limb(cx + 1.4, hipY, cx + 1.4 - swing * 2.1, H - 1.5, 2, 1);
    // Cape qui traîne derrière – décalée à l'opposé du mouvement.
    p.ellipse(cx - swing * 0.8, shY + 2.4, 4.2, 3.4, 2);
    p.ellipse(cx - swing * 1.4, shY + 4.2, 3.2, 2.2, 1);
    // Torse
    p.ellipse(cx, shY + 1.4, 2.5, 2.6, 3);
    // Bras
    p.limb(cx - 2.6, shY, cx - 3.2 - swing * 1.3, shY + 3.6, 1.8, 3);
    p.limb(cx + 2.6, shY, cx + 3.2 + swing * 1.3, shY + 3.6, 1.8, 3);
    // Tête
    p.ellipse(cx, headCy, 2.5, 2.6, 4);

    switch (art.hat) {
      case 'hood':
        p.ellipse(cx, headCy - 0.7, 2.9, 2.5, 2);
        p.ellipse(cx, headCy + 0.5, 2.1, 1.6, 4);
        break;
      case 'wide':
        p.ellipse(cx, headCy - 1.4, 4.6, 1.1, 2);
        p.ellipse(cx, headCy - 2.4, 2.2, 1.4, 2);
        break;
      case 'veil':
        p.ellipse(cx, headCy - 0.4, 3.0, 2.7, 5);
        p.ellipse(cx, headCy + 0.8, 1.9, 1.5, 4);
        break;
      case 'crown':
        for (let k = -2; k <= 2; k++) p.set(cx + k, headCy - 2.6, 5);
        p.set(cx - 2, headCy - 3.6, 5);
        p.set(cx, headCy - 3.6, 5);
        p.set(cx + 2, headCy - 3.6, 5);
        break;
      case 'none':
        break;
    }

    p.shadeVertical(2, 5, 1);
    // Yeux : deux pixels sombres, le seul détail qui « personnifie » à cette échelle.
    p.set(cx - 1, headCy + 0.3, 0);
    p.set(cx + 1, headCy + 0.3, 0);
    p.outline(0);
    pixFrames.push(p);
  }

  const set = build(pixFrames, cols);
  cache.set(ck, set);
  return set;
}

/**
 * Héros détaillé — variante à l'essai.
 *
 * Même personnage que `makeHero`, à 19 × 23 au lieu de 13 × 15, et sur neuf teintes au lieu
 * de six. Ce que la définition supplémentaire achète : une capuche qui laisse voir un
 * visage, un plastron distinct de la chemise, une ceinture, des bottes, et des plis de cape.
 *
 * Trois contraintes qu'il fallait tenir pour que ce soit remplaçable sans rien casser :
 *
 *   - **les cosmétiques continuent de fonctionner.** `HeroArt` ne fournit que quatre
 *     couleurs ; les neuf teintes en sont dérivées par éclaircissement et assombrissement,
 *     jamais posées en dur. Une teinte de boutique repeint donc toujours le personnage ;
 *   - **la collision ne bouge pas.** Le rayon de contact du joueur est fixé à 5 dans le
 *     monde, indépendamment du sprite : agrandir le dessin ne change rien à la difficulté ;
 *   - **les cinq coiffes existent toujours**, sinon quatre personnages sur six perdraient
 *     ce qui les distingue au premier coup d'œil.
 *
 * Le héros devient nettement plus grand que les ennemis courants, qui font 11 à 16 pixels.
 * C'est assumé : dans ce genre, un protagoniste un peu plus imposant se suit mieux du regard
 * au milieu de quatre cents silhouettes.
 */
export function makeHeroDetaille(key: string, art: HeroArt, moving: boolean): SpriteSet {
  const ck = `detail:${key}:${moving ? 'walk' : 'idle'}`;
  const hit = cache.get(ck);
  if (hit) return hit;

  const W = 19;
  const H = 23;
  const n = moving ? 6 : 4;

  // Neuf marches, toutes dérivées des quatre couleurs du cosmétique.
  const cols = [
    shade(art.cloak, -0.72),  // 0 contour
    shade(art.cloak, -0.42),  // 1 cape, ombre
    art.cloak,                // 2 cape
    shade(art.cloak, 0.28),   // 3 cape, lumière
    shade(art.cloth, -0.35),  // 4 vêtement, ombre
    art.cloth,                // 5 vêtement
    shade(art.skin, -0.3),    // 6 peau, ombre
    art.skin,                 // 7 peau
    art.accent,               // 8 accent
  ];

  const pixFrames: Pix[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const p = new Pix(W, H);
    const cx = W / 2 - 0.5;
    const swing = moving ? Math.sin(t * TAU) : 0;
    const bob = moving ? Math.abs(Math.cos(t * TAU)) * 1.1 : Math.sin(t * TAU) * 0.6;

    const hipY = 15.5 - bob;
    const shY = 9.5 - bob;
    const headCy = 5.2 - bob;

    // --- jambes et bottes -------------------------------------------------
    p.limb(cx - 2, hipY, cx - 2 + swing * 2.6, H - 3, 2.4, 4);
    p.limb(cx + 2, hipY, cx + 2 - swing * 2.6, H - 3, 2.4, 4);
    p.rect(Math.round(cx - 3.4 + swing * 2.6), H - 3, 3, 2, 1);
    p.rect(Math.round(cx + 1.4 - swing * 2.6), H - 3, 3, 2, 1);

    // --- cape, derrière le corps -----------------------------------------
    p.ellipse(cx - swing * 1.1, shY + 4.2, 6.4, 5.6, 1);
    p.ellipse(cx - swing * 1.8, shY + 6.6, 5.0, 3.6, 1);
    // Plis : deux creux verticaux d'écart inégal.
    p.limb(cx - 2.6 - swing, shY + 3, cx - 3.2 - swing, shY + 8, 1, 0);
    p.limb(cx + 2.2 - swing, shY + 3, cx + 2.8 - swing, shY + 8, 1, 0);

    // --- buste ------------------------------------------------------------
    p.ellipse(cx, shY + 2.2, 3.6, 4.0, 5);          // chemise
    p.ellipse(cx, shY + 1.6, 3.4, 2.8, 4);          // plastron, plus sombre
    p.rect(Math.round(cx - 3.2), Math.round(shY + 4.4), 7, 1, 8);   // ceinture
    p.set(cx, Math.round(shY + 4.4), 3);            // boucle

    // --- bras -------------------------------------------------------------
    p.limb(cx - 3.6, shY + 0.6, cx - 4.4 - swing * 1.8, shY + 5.0, 2, 4);
    p.limb(cx + 3.6, shY + 0.6, cx + 4.4 + swing * 1.8, shY + 5.0, 2, 4);
    p.ellipse(cx - 4.4 - swing * 1.8, shY + 5.2, 1.3, 1.3, 6);      // mains
    p.ellipse(cx + 4.4 + swing * 1.8, shY + 5.2, 1.3, 1.3, 6);

    // --- tête -------------------------------------------------------------
    p.ellipse(cx, headCy, 3.4, 3.6, 7);
    p.ellipse(cx, headCy + 1.6, 2.8, 1.8, 6);       // mâchoire dans l'ombre

    switch (art.hat) {
      case 'hood':
        // La capuche est posée par-dessus puis creusée : c'est elle qui doit mordre sur le
        // visage, et non l'inverse.
        p.ellipse(cx, headCy - 0.9, 4.3, 4.0, 2);
        p.ellipse(cx, headCy + 0.7, 2.7, 2.4, 7);
        p.ellipse(cx, headCy + 2.2, 3.4, 1.4, 1);   // retombée sur les épaules
        break;
      case 'wide':
        p.ellipse(cx, headCy - 1.8, 6.8, 1.6, 2);
        p.ellipse(cx, headCy - 1.4, 6.8, 1.0, 1);
        p.ellipse(cx, headCy - 3.2, 3.2, 2.0, 2);
        break;
      case 'veil':
        p.ellipse(cx, headCy - 0.5, 4.4, 4.1, 8);
        p.ellipse(cx, headCy + 1.1, 2.6, 2.2, 7);
        p.ellipse(cx, headCy + 3.0, 3.6, 1.6, 8);
        break;
      case 'crown':
        for (let k = -3; k <= 3; k++) p.set(cx + k, headCy - 3.6, 8);
        for (const k of [-3, 0, 3]) { p.set(cx + k, headCy - 4.6, 8); p.set(cx + k, headCy - 5.3, 3); }
        break;
      case 'none':
        break;
    }

    // Traits : deux yeux et l'arête du nez. Un trait de plus ferait grimace.
    p.set(cx - 1.4, headCy + 0.4, 0);
    p.set(cx + 1.4, headCy + 0.4, 0);
    p.set(cx, headCy + 1.1, 6);

    p.shadeVertical(2, 3, 1);
    p.outline(0);
    pixFrames.push(p);
  }

  const set = build(pixFrames, cols);
  cache.set(ck, set);
  return set;
}

// ---------------------------------------------------------------------------
// Butin et objets
// ---------------------------------------------------------------------------

/** Gemme d'XP : losange qui oscille et scintille. La forme varie par rang (daltonisme). */
export function makeGem(rank: 0 | 1 | 2 | 3): SpriteSet {
  const key = `gem:${rank}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const colors = [P.xp1, P.xp2, P.xp3, P.xp4];
  const base = colors[rank]!;
  const size = 8 + rank * 3;
  const cols = [
    shade(base, -0.68), shade(base, -0.32), base,
    shade(base, 0.4), shade(base, 0.7), '#ffffff',
  ];
  const frames: Pix[] = [];

  for (let i = 0; i < 8; i++) {
    const t = i / 8;
    const p = pixObjet(size + 6, size + 6);
    const cx = p.w / 2 - 0.5;
    const cy = p.h / 2 - 0.5 + Math.sin(t * TAU) * 0.9;
    const r = size / 2;

    /*
     * Le rang se lit au nombre de pointes, et non à la seule couleur : un joueur daltonien
     * doit pouvoir trier ses gemmes. Le taillage est marqué par une arête verticale claire
     * à gauche et sombre à droite, ce qui donne le relief que la seule silhouette ne donne
     * pas.
     */
    const spikes = 4 + rank;
    for (let y = -r - 1; y <= r + 1; y++) {
      for (let x = -r - 1; x <= r + 1; x++) {
        const ang = Math.atan2(y, x);
        const rad = Math.hypot(x, y);
        const edge = r * (0.7 + 0.3 * Math.abs(Math.cos(ang * (spikes / 2))));
        if (rad > edge) continue;
        // Trois plans : lumière en haut à gauche, teinte propre, ombre en bas à droite.
        const n = (x + y) / (r * 2);
        p.set(cx + x, cy + y, n < -0.28 ? 3 : n > 0.3 ? 1 : 2);
      }
    }
    for (let k = -r; k <= r; k++) p.set(cx, cy + k * 0.9, 3);   // arête centrale
    p.ellipse(cx - r * 0.34, cy - r * 0.42, r * 0.24, r * 0.2, 4);
    p.set(cx - r * 0.34, cy - r * 0.42, 5);
    // Scintillement qui tourne autour de la pierre.
    const sa = t * TAU * 2;
    p.set(cx + Math.cos(sa) * (r + 2.2), cy + Math.sin(sa) * (r + 2.2), 4);
    p.outline(0);
    frames.push(p);
  }

  const set = build(frames, cols);
  cache.set(key, set);
  return set;
}

export function makeCoin(): SpriteSet {
  const key = 'coin';
  const hit = cache.get(key);
  if (hit) return hit;
  const cols = [
    shade(P.gold, -0.72), shade(P.gold, -0.36), P.gold,
    shade(P.gold, 0.38), shade(P.gold, 0.7), '#ffffff',
  ];
  const frames: Pix[] = [];
  for (let i = 0; i < 8; i++) {
    const t = i / 8;
    const p = pixObjet(14, 14);
    const cx = 6.5;
    const cy = 6.5;
    // La pièce tourne : sa largeur suit un cosinus, sa hauteur ne bouge pas.
    const rx = Math.max(0.7, Math.abs(Math.cos(t * TAU)) * 5.6);
    p.ellipse(cx, cy, rx, 5.6, 2);
    if (rx > 2.2) {
      // De face : bord frappé, motif au centre, reflet en haut à gauche.
      p.ellipse(cx, cy, rx - 1, 4.6, 3);
      p.ellipse(cx, cy, rx - 2.2, 3.2, 2);
      p.ellipse(cx - rx * 0.35, cy - 2, rx * 0.3, 1.2, 4);
      p.rect(cx - 1, cy - 2, 2, 5, 4);        // le motif frappé
      p.rect(cx - 2, cy - 1, 4, 1, 4);
      p.set(cx - rx * 0.4, cy - 3, 5);
    } else {
      // De tranche : une simple barre, mais éclairée en haut pour garder le volume.
      p.ellipse(cx, cy - 1.6, rx, 1.6, 4);
    }
    p.outline(0);
    frames.push(p);
  }
  const set = build(frames, cols);
  cache.set(key, set);
  return set;
}

export function makeHeart(): SpriteSet {
  const key = 'heart';
  const hit = cache.get(key);
  if (hit) return hit;
  const cols = [
    shade(P.blood, -0.72), P.bloodDark, P.blood,
    P.bloodHi, shade(P.bloodHi, 0.45), '#ffd0d8',
  ];
  const beat = [1.0, 1.16, 1.03, 1.1, 0.99, 1.0];
  const frames: Pix[] = [];
  for (let i = 0; i < 6; i++) {
    const s2 = beat[i]!;
    const p = pixObjet(16, 16);
    const cx = 7.5;
    const cy = 6.4;
    /*
     * La pointe est tracée ligne à ligne plutôt qu'avec une ellipse tronquée : c'est le V
     * franc du bas qui fait lire « cœur ». Sur la version précédente, en 10 × 10, la pointe
     * et les lobes se confondaient et l'objet passait pour un triangle.
     */
    p.ellipse(cx - 2.6 * s2, cy - 0.8 * s2, 3.3 * s2, 3.1 * s2, 2);
    p.ellipse(cx + 2.6 * s2, cy - 0.8 * s2, 3.3 * s2, 3.1 * s2, 2);
    for (let y = 0; y < 8; y++) {
      const hw = (5.6 - y * 0.72) * s2;
      if (hw <= 0) break;
      p.rect(cx - hw, cy + 1 + y, hw * 2 + 1, 1, 2);
    }
    // Volume : ombre sur le lobe droit et le long de la pointe, lumière sur le gauche.
    p.ellipse(cx + 3.2 * s2, cy, 2.0 * s2, 1.9 * s2, 1);
    for (let y = 3; y < 9; y++) p.rect(cx + 0.5, cy + y, Math.max(1, 3 - y * 0.4), 1, 1);
    p.ellipse(cx - 2.8, cy - 1.6, 1.5, 1.3, 3);
    p.ellipse(cx - 3.0, cy - 2.1, 0.9, 0.7, 4);
    p.set(cx - 3, cy - 2, 5);
    p.outline(0);
    frames.push(p);
  }
  const set = build(frames, cols);
  cache.set(key, set);
  return set;
}

export function makeChest(): SpriteSet {
  const key = 'chest';
  const hit = cache.get(key);
  if (hit) return hit;
  const cols = [
    shade(P.leather, -0.72), shade(P.leather, -0.3), P.leather,
    P.gold, '#fff3c4', '#ffffff',
  ];
  const frames: Pix[] = [];
  for (let i = 0; i < 8; i++) {
    const open = Math.min(1, i / 5);
    const p = pixObjet(24, 22);
    // Caisse : planches verticales, cerclage en haut et en bas.
    p.rect(3, 10, 18, 10, 2);
    p.rect(3, 10, 18, 1, 1);
    p.rect(3, 19, 18, 1, 1);
    for (const x of [7, 12, 17]) p.rect(x, 11, 1, 8, 1);
    p.rect(3, 14, 18, 1, 3);                    // ferrure médiane
    // Serrure, au centre : c'est elle qui dit « coffre » plutôt que « caisse ».
    p.rect(11, 13, 3, 4, 3);
    p.set(12, 15, 0);
    p.set(12, 16, 0);

    // Couvercle bombé, qui pivote vers l'arrière en s'ouvrant.
    const lidY = 9 - open * 6;
    const lidH = 5 * (1 - open * 0.5);
    for (let y = 0; y <= lidH; y++) {
      const hw = Math.round(9 * Math.sqrt(Math.max(0, 1 - (y / (lidH + 0.6)) ** 2)));
      p.rect(12 - hw, lidY - y, hw * 2, 1, y > lidH * 0.6 ? 3 : 2);
    }
    p.rect(3, lidY, 18, 1, 1);
    p.rect(3, lidY - 1, 18, 1, 3);

    if (open > 0.15) {
      // Lueur intérieure, puis rayons quand le couvercle est franchement levé.
      p.rect(5, 10, 14, Math.round(open * 4), 4);
      p.rect(6, 10, 12, Math.max(1, Math.round(open * 2)), 5);
      for (let k = 0; k < 5 && open > 0.5; k++) {
        const a = -PI / 2 + (k - 2) * 0.42;
        p.line(12, 10, 12 + Math.cos(a) * 11 * open, 10 + Math.sin(a) * 11 * open, 5);
      }
    }
    p.outline(0);
    frames.push(p);
  }
  const set = build(frames, cols);
  cache.set(key, set);
  return set;
}

export function makeRelic(rarity: Rarity): SpriteSet {
  const key = `relic:${rarity}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const base = RARITY_COLOR[rarity];
  const cols = [shade(base, -0.75), shade(base, -0.35), base, shade(base, 0.5), '#ffffff'];
  const frames: Pix[] = [];
  for (let i = 0; i < 8; i++) {
    const t = i / 8;
    const p = pixObjet(12, 14);
    const cx = 5.5;
    const cy = 7.5 + Math.sin(t * TAU) * 0.9;
    const rx = 3.4 * Math.abs(Math.cos(t * PI * 0.5)) + 1.2;
    p.line(cx, 1, cx, cy - 3, 1); // chaîne
    p.set(cx - 1, 2, 1);
    p.set(cx + 1, 2, 1);
    p.ellipse(cx, cy, rx, 4, 2);
    p.ellipse(cx, cy - 0.8, rx * 0.55, 2.0, 3);
    p.set(cx, cy, 4);
    p.shadeVertical(2, 3, 1);
    p.outline(0);
    frames.push(p);
  }
  const set = build(frames, cols);
  cache.set(key, set);
  return set;
}

/** Petits objets consommables : aimant, bombe, sablier, parchemin, encensoir. */
export function makeItem(kind: 'magnet' | 'bomb' | 'hourglass' | 'scroll' | 'censer'): SpriteSet {
  const key = `item:${kind}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let cols: string[];
  const frames: Pix[] = [];
  const N = 6;

  switch (kind) {
    case 'magnet':
      cols = [shade(P.steel, -0.75), P.bloodDark, P.blood, P.steel, '#ffffff'];
      for (let i = 0; i < N; i++) {
        const p = pixObjet(12, 12);
        const t = i / N;
        p.limb(3, 9, 3, 4, 2.4, 2);
        p.limb(8, 9, 8, 4, 2.4, 2);
        p.ellipse(5.5, 4, 3.2, 3.0, 2);
        p.ellipse(5.5, 4.6, 1.6, 1.6, -1);
        p.rect(2, 8, 3, 2, 3);
        p.rect(7, 8, 3, 2, 3);
        const r = 1 + t * 4;
        p.ring(5.5, 9, r, r * 0.6, 4);
        p.outline(0);
        frames.push(p);
      }
      break;
    case 'bomb':
      cols = [shade(P.stone, -0.8), P.stone, P.stoneHi, P.fire, '#fff3c4'];
      for (let i = 0; i < N; i++) {
        const t = i / N;
        const p = pixObjet(12, 12);
        p.ellipse(5.5, 7.5, 4, 4, 2);
        p.ellipse(4.2, 6.2, 1.4, 1.2, 1);
        p.line(6, 3.6, 7.5 + Math.sin(t * TAU) * 1.2, 1.4, 1);
        p.ellipse(7.6 + Math.sin(t * TAU) * 1.2, 1, 1 + t * 0.6, 1 + t * 0.6, 3);
        p.set(7.6 + Math.sin(t * TAU) * 1.2, 0.6, 4);
        p.outline(0);
        frames.push(p);
      }
      break;
    case 'hourglass':
      cols = [shade(P.ice, -0.8), shade(P.leather, -0.2), P.leather, P.ice, '#ffffff'];
      for (let i = 0; i < N; i++) {
        const t = i / N;
        const p = pixObjet(10, 12);
        p.rect(1, 1, 8, 1, 2);
        p.rect(1, 10, 8, 1, 2);
        for (let y = 2; y <= 5; y++) p.rect(1 + (y - 2), y, 8 - (y - 2) * 2, 1, 3);
        for (let y = 6; y <= 9; y++) p.rect(1 + (9 - y), y, 8 - (9 - y) * 2, 1, 3);
        const sand = Math.floor(t * 3);
        for (let y = 7 + sand; y <= 9; y++) p.rect(3, y, 4, 1, 4);
        p.set(4.5, 5 + (i % 2), 4);
        p.outline(0);
        frames.push(p);
      }
      break;
    case 'scroll':
      cols = [shade(P.linen, -0.75), shade(P.linen, -0.3), P.linen, P.leather, P.blood];
      for (let i = 0; i < N; i++) {
        const t = i / N;
        const p = pixObjet(12, 10);
        const w = 6 + Math.sin(t * TAU) * 1.2;
        p.rect(6 - w / 2, 2, w, 6, 2);
        p.ellipse(6 - w / 2, 5, 1.2, 3.2, 3);
        p.ellipse(6 + w / 2, 5, 1.2, 3.2, 3);
        p.rect(6 - w / 2 + 1, 4, Math.max(1, w - 2), 1, 1);
        p.set(6, 6, 4);
        p.outline(0);
        frames.push(p);
      }
      break;
    case 'censer':
      cols = [shade(P.gold, -0.75), shade(P.gold, -0.3), P.gold, '#fff3c4', '#ffffff'];
      for (let i = 0; i < N; i++) {
        const t = i / N;
        const p = pixObjet(12, 13);
        const sw = Math.sin(t * TAU) * 1.6;
        p.line(6, 0, 6 + sw, 4, 1);
        p.ellipse(6 + sw, 7, 3.4, 3.2, 2);
        p.rect(6 + sw - 3, 5, 7, 1, 3);
        p.ellipse(6 + sw, 8.6, 2.2, 1.4, 1);
        for (let k = 0; k < 3; k++)
          p.set(6 + sw + (k - 1) * 1.6, 3 - Math.abs(Math.sin(t * TAU + k)) * 1.5, 4);
        p.outline(0);
        frames.push(p);
      }
      break;
  }

  const set = build(frames, cols);
  cache.set(key, set);
  return set;
}

// ---------------------------------------------------------------------------
// Projectiles et effets d'armes
// ---------------------------------------------------------------------------

export type ProjKind =
  | 'stake'
  | 'cross'
  | 'orb'
  | 'flask'
  | 'shard'
  | 'bolt'
  | 'dagger'
  | 'thorn'
  | 'ember'
  | 'flail'
  | 'familiar'
  | 'wave'
  | 'lightning'
  | 'scythe';

export function makeProjectile(kind: ProjKind, color?: string): SpriteSet {
  const key = `proj:${kind}:${color ?? 'd'}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const base = color ?? P.linen;
  const cols = [shade(base, -0.7), shade(base, -0.3), base, shade(base, 0.5), '#ffffff'];
  const frames: Pix[] = [];
  const N = 4;

  for (let i = 0; i < N; i++) {
    const t = i / N;
    const wob = Math.sin(t * TAU);
    let p: Pix;
    switch (kind) {
      case 'stake':
        p = pixObjet(10, 6);
        p.limb(1, 3, 6, 3, 2, 2);
        p.line(6, 2, 9, 3, 3);
        p.line(6, 4, 9, 3, 3);
        p.set(1, 3, 1);
        break;
      case 'cross':
        p = pixObjet(11, 11);
        p.rect(4, 1, 3, 9, 2);
        p.rect(1, 3, 9, 3, 2);
        p.rect(5, 2, 1, 7, 3);
        p.rect(2, 4, 7, 1, 3);
        break;
      case 'orb':
        p = pixObjet(10, 10);
        p.ellipse(4.5, 4.5, 3.4 + wob * 0.35, 3.4 + wob * 0.35, 2);
        p.ellipse(3.4, 3.4, 1.5, 1.4, 3);
        p.ellipse(4.5, 4.5, 4.2 + wob * 0.4, 4.2 + wob * 0.4, -1);
        p.ellipse(4.5, 4.5, 3.4 + wob * 0.35, 3.4 + wob * 0.35, 2);
        p.ellipse(3.4, 3.4, 1.4, 1.3, 4);
        break;
      case 'flask':
        p = pixObjet(9, 10);
        p.ellipse(4, 6.5, 3, 3, 2);
        p.rect(3, 1, 2, 3, 1);
        p.rect(2.5, 0, 3, 1, 3);
        p.ellipse(3, 5.5, 1.2, 1.0, 4);
        break;
      case 'shard':
        p = pixObjet(7, 7);
        p.line(3, 0, 3, 6, 2);
        p.line(2, 2, 4, 4, 2);
        p.line(4, 2, 2, 4, 2);
        p.set(3, 3, 4);
        break;
      case 'bolt':
        p = pixObjet(9, 5);
        p.limb(0, 2, 5, 2, 1.6, 2);
        p.line(5, 1, 8, 2, 3);
        p.line(5, 3, 8, 2, 3);
        break;
      case 'dagger':
        p = pixObjet(11, 7);
        p.limb(1, 3, 4, 3, 2, 1);
        p.rect(3, 1, 1, 5, 3);
        p.limb(4, 3, 10, 3, 1.8, 2);
        p.set(10, 3, 4);
        break;
      case 'thorn':
        p = pixObjet(8, 12);
        p.limb(3.5, 11, 3.5, 3, 2.4, 2);
        p.line(3.5, 3, 2, 6, 3);
        p.line(3.5, 3, 5, 6, 3);
        p.set(3.5, 1.5, 4);
        break;
      case 'ember':
        p = pixObjet(9, 9);
        p.ellipse(4, 5.5, 3.2 - wob * 0.3, 2.6, 2);
        p.ellipse(4, 4 - wob * 0.6, 2.0, 2.2, 3);
        p.ellipse(4, 2.6 - wob * 0.8, 1.0, 1.2, 4);
        break;
      case 'flail':
        p = pixObjet(10, 10);
        p.ellipse(5.5, 5.5, 3.4, 3.4, 2);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU + t * 0.6;
          p.set(5.5 + Math.cos(a) * 4.4, 5.5 + Math.sin(a) * 4.4, 3);
        }
        p.ellipse(4.4, 4.4, 1.2, 1.1, 3);
        break;
      case 'familiar': {
        p = pixObjet(12, 10);
        const flap = Math.sin(t * TAU);
        for (const s of [-1, 1]) {
          p.limb(5.5 + s * 1, 5, 5.5 + s * 4.5, 5 - flap * 2.4, 1.4, 2);
          p.line(5.5 + s * 4.5, 5 - flap * 2.4, 5.5 + s * 3.4, 7, 2);
        }
        p.ellipse(5.5, 5, 1.7, 2.2, 2);
        p.set(4.8, 3.8, 4);
        p.set(6.2, 3.8, 4);
        break;
      }
      case 'wave': {
        p = pixObjet(16, 16);
        const r = 5 + t * 2.4;
        p.ring(7.5, 7.5, r, r, 2);
        p.ring(7.5, 7.5, r - 1.4, r - 1.4, 3);
        break;
      }
      case 'lightning': {
        p = pixObjet(11, 22);
        let x = 5.5;
        for (let y = 0; y < 22; y += 2) {
          const nx = x + Math.sin(y * 0.9 + t * 4) * 2.2;
          p.limb(x, y, nx, y + 2, 2.2, 2);
          p.line(x, y, nx, y + 2, 4);
          x = nx;
        }
        break;
      }
      case 'scythe': {
        p = pixObjet(22, 22);
        const cx = 11;
        const cy = 11;
        for (let k = 0; k <= 22; k++) {
          const a = -PI * 0.62 + (k / 22) * PI * 1.24;
          const rr = 9 - Math.abs(k / 22 - 0.5) * 3;
          p.limb(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, cx + Math.cos(a) * (rr - 2), cy + Math.sin(a) * (rr - 2), 2.4, 2);
        }
        break;
      }
    }
    p.outline(0);
    frames.push(p);
  }

  const set = build(frames, cols);
  cache.set(key, set);
  return set;
}

export type PassiveIcon =
  | 'gem' | 'boot' | 'heart' | 'glass' | 'lens' | 'flask'
  | 'feather' | 'book' | 'magnet' | 'shield' | 'clover' | 'cup';

/** Icônes des passifs – dessinées à la main en 12×12, une forme reconnaissable par passif. */
export function makePassiveSprite(icon: PassiveIcon, color: string): SpriteSet {
  const key = `passive:${icon}`;
  const hit = cache.get(key);
  if (hit) return hit;

  /*
   * Icônes des passifs, redessinées en 20 × 20.
   *
   * Elles tenaient en 13 × 13, où une plume n'était qu'un trait oblique et un calice qu'une
   * ellipse sur un bâton. À cette taille il n'y a pas de place pour dire ce qu'est l'objet ;
   * on ne peut qu'en suggérer la masse.
   *
   * Une tentative d'agrandissement par mise à l'échelle des coordonnées avait tout cassé :
   * une forme tracée pixel par pixel ne survit pas à une multiplication non entière, et le
   * sablier était devenu un carré. Elles sont donc **redessinées**, pas agrandies.
   *
   * Six teintes, toutes dérivées de la couleur du passif : la table reste à une couleur par
   * entrée. L'ombre est en bas à droite, la lumière en haut à gauche, sans exception — c'est
   * cette constance qui fait que douze objets d'origines différentes ont l'air d'une série.
   */
  const cols = [
    shade(color, -0.75), // 0 contour
    shade(color, -0.38), // 1 ombre
    color,               // 2 teinte propre
    shade(color, 0.3),   // 3 lumière
    shade(color, 0.62),  // 4 reflet
    '#ffffff',           // 5 éclat
  ];
  const p = pixObjet(20, 20);

  switch (icon) {
    case 'gem': {
      /*
       * Gemme taillée en brillant : table plate en haut, couronne évasée, pavillon en
       * pointe. Les arêtes de facettes comptent plus que la silhouette — sans elles on
       * obtient une pastille bombée, qui se lit comme un galet et non comme une pierre.
       */
      p.rect(6, 3, 8, 1, 2);                       // table
      for (let y = 4; y <= 6; y++) {               // couronne, qui s'évase
        const hw = 4 + (y - 3) * 1.2;
        p.rect(10 - hw, y, hw * 2, 1, 2);
      }
      for (let y = 7; y <= 16; y++) {              // pavillon, qui se referme
        const hw = 7.6 - (y - 7) * 0.78;
        p.rect(10 - hw, y, hw * 2 + 1, 1, 2);
      }
      // Facettes : deux arêtes claires à gauche, deux sombres à droite. C'est le contraste
      // entre ces plans, pas le contour, qui donne le tranchant du taillage.
      p.rect(6, 3, 8, 1, 4);
      p.line(6, 4, 3, 7, 3);
      p.line(14, 4, 17, 7, 1);
      p.line(3, 7, 9, 16, 3);
      p.line(17, 7, 11, 16, 1);
      p.line(6, 4, 8, 16, 3);
      p.line(14, 4, 12, 16, 1);
      p.rect(4, 7, 13, 1, 1);                      // ceinture, la ligne la plus large
      p.rect(6, 4, 3, 1, 4);
      p.set(7, 5, 5);
      break;
    }
    case 'boot': {
      // Botte de marche : tige, cou-de-pied, semelle qui dépasse vers l'avant.
      p.rect(5, 3, 6, 9, 2);            // tige
      p.rect(5, 3, 6, 1, 3);            // ouverture
      p.rect(5, 11, 11, 4, 2);          // pied
      p.rect(4, 15, 13, 2, 1);          // semelle
      p.rect(4, 16, 13, 1, 0);
      p.rect(5, 6, 6, 1, 1);            // pli du cuir
      p.rect(11, 12, 5, 1, 3);
      p.rect(6, 4, 2, 5, 3);            // lumière sur la tige
      p.set(6, 4, 4);
      break;
    }

    case 'heart': {
      // Cœur : deux lobes et une pointe. La pointe est tracée ligne à ligne pour que le V
      // reste net — une ellipse tronquée donne une base molle.
      p.ellipse(7, 7, 3.6, 3.4, 2);
      p.ellipse(13, 7, 3.6, 3.4, 2);
      for (let y = 0; y < 8; y++) {
        const hw = 6.4 - y * 0.82;
        p.rect(10 - hw, 8 + y, hw * 2 + 1, 1, 2);
      }
      // Volume : ombre sur le lobe droit et sous la pointe, lumière sur le gauche.
      p.ellipse(14, 8, 2.4, 2.2, 1);
      for (let y = 11; y < 16; y++) p.rect(10, y, 3 - (y - 11) * 0.5, 1, 1);
      p.ellipse(6, 6, 1.8, 1.6, 3);
      p.ellipse(6, 5, 1.0, 0.8, 4);
      p.set(6, 5, 5);
      break;
    }

    case 'glass': {
      // Sablier : deux montants, deux cônes qui se touchent, le sable en bas.
      p.rect(3, 2, 14, 2, 1);
      p.rect(3, 16, 14, 2, 1);
      p.rect(4, 4, 1, 12, 1);
      p.rect(15, 4, 1, 12, 1);
      for (let y = 4; y <= 9; y++) {
        const hw = 5 - (y - 4) * 0.8;
        p.rect(10 - hw, y, hw * 2, 1, 2);
      }
      for (let y = 10; y <= 15; y++) {
        const hw = 0.6 + (y - 10) * 0.8;
        p.rect(10 - hw, y, hw * 2, 1, 2);
      }
      // Le sable : tas en bas, filet au centre, vide en haut. C'est ce qui dit « il coule ».
      for (let y = 12; y <= 15; y++) {
        const hw = (y - 11) * 1.1;
        p.rect(10 - hw, y, hw * 2, 1, 4);
      }
      p.rect(9, 9, 1, 4, 4);
      p.rect(5, 4, 4, 1, 3);
      p.set(5, 3, 5);
      break;
    }

    case 'lens': {
      // Longue-vue : un tube en perspective, pas un cercle avec un manche.
      p.rect(3, 6, 6, 7, 2);            // corps
      p.rect(9, 7, 5, 5, 2);            // fût
      p.rect(14, 8, 4, 3, 1);           // oculaire
      p.rect(3, 6, 6, 1, 3);
      p.rect(3, 12, 6, 1, 1);
      p.rect(9, 7, 5, 1, 3);
      p.ellipse(3, 9.5, 1.6, 3.4, 3);   // lentille
      p.ellipse(3, 9.5, 0.9, 2.2, 4);
      p.set(3, 8, 5);
      p.rect(8, 6, 1, 7, 1);            // bagues
      p.rect(13, 7, 1, 5, 1);
      break;
    }

    case 'flask': {
      // Fiole : col étroit, panse ronde, bouchon, niveau de liquide net.
      p.rect(8, 2, 4, 2, 1);            // bouchon
      p.rect(8, 4, 4, 4, 3);            // col
      p.ellipse(10, 13, 6, 5.4, 2);     // panse
      for (let y = 11; y <= 17; y++) {  // liquide, arrêté à une ligne franche
        const hw = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 13) / 5.4) ** 2)) * 6);
        if (hw > 0) p.rect(10 - hw, y, hw * 2, 1, 1);
      }
      p.rect(5, 11, 10, 1, 4);          // surface
      p.ellipse(7, 11, 1.4, 1.8, 3);    // reflet vertical sur le verre
      p.set(7, 10, 5);
      break;
    }

    case 'feather': {
      // Plume : un rachis courbe, et des barbes de part et d'autre, plus courtes vers la
      // pointe. Sans les deux côtés, on ne lit qu'une branche.
      const rachis = (t: number): [number, number] => [4 + t * 11, 17 - t * 15];
      for (let k = 0; k <= 26; k++) {
        const t = k / 26;
        const [x, y] = rachis(t);
        // Barbes : longueur maximale au milieu, nulle aux deux bouts.
        const l = Math.sin(t * Math.PI) * 5.2 * (1 - t * 0.3);
        for (let i = 1; i <= l; i++) {
          p.set(x - i * 0.85, y - i * 0.24, i > l - 1.6 ? 1 : 2);
          p.set(x + i * 0.62, y + i * 0.5, i > l - 1.6 ? 1 : 3);
        }
      }
      for (let k = 0; k <= 26; k++) {
        const [x, y] = rachis(k / 26);
        p.set(x, y, 4);                 // le rachis, clair, par-dessus les barbes
      }
      p.set(...rachis(1), 5);
      break;
    }

    case 'book': {
      // Grimoire vu de trois quarts : plat, tranche de pages, dos épais.
      p.rect(2, 4, 15, 13, 2);          // plat
      p.rect(2, 4, 15, 1, 3);
      p.rect(2, 16, 15, 1, 1);
      p.rect(13, 5, 4, 11, 4);          // tranche des pages
      for (let y = 6; y < 16; y += 2) p.rect(13, y, 4, 1, 3);
      p.rect(2, 4, 3, 13, 1);           // dos
      p.rect(3, 7, 1, 7, 3);            // nerfs
      p.rect(6, 8, 6, 1, 3);            // fermoir
      p.rect(6, 11, 6, 1, 3);
      p.set(6, 5, 5);
      break;
    }

    case 'magnet': {
      // Aimant en fer à cheval, ouvert vers le bas, avec ses deux pôles marqués.
      p.ellipse(10, 9, 7, 7, 2);
      p.ellipse(10, 9, 3.4, 3.4, -1);
      p.rect(3, 9, 14, 9, -1);          // on ouvre le bas
      p.rect(3, 9, 4, 7, 2);            // branche gauche
      p.rect(13, 9, 4, 7, 2);           // branche droite
      p.rect(3, 15, 4, 3, 4);           // pôles
      p.rect(13, 15, 4, 3, 1);
      p.rect(3, 3, 4, 2, 3);            // lumière sur l'arceau
      p.ellipse(7, 4, 2.2, 1.4, 3);
      p.set(7, 3, 5);
      break;
    }

    case 'shield': {
      // Écusson : épaules droites, flancs qui se resserrent, pointe basse.
      p.rect(3, 3, 15, 6, 2);
      for (let y = 9; y <= 17; y++) {
        const hw = 7.5 - (y - 9) * 0.85;
        p.rect(10 - hw, y, hw * 2 + 1, 1, 2);
      }
      p.rect(3, 3, 15, 1, 3);
      for (let y = 4; y <= 16; y++) p.set(11 + (y - 4) * 0.35, y, 1);   // flanc d'ombre
      p.rect(5, 5, 4, 1, 3);
      p.limb(10, 6, 10, 14, 1.6, 4);    // nervure centrale
      p.set(5, 4, 5);
      break;
    }

    case 'clover': {
      // Trèfle à quatre feuilles : quatre cœurs disposés en croix, plus la tige.
      for (const [dx, dy] of [[-4, -4], [4, -4], [-4, 3], [4, 3]] as const) {
        const cx = 10 + dx;
        const cy = 8 + dy;
        p.ellipse(cx - 1.6, cy, 2.4, 2.4, 2);
        p.ellipse(cx + 1.6, cy, 2.4, 2.4, 2);
        p.ellipse(cx, cy + 1.4, 2.6, 2.4, 2);
        p.ellipse(cx - 1.8, cy - 1, 1.1, 1.0, 3);
      }
      p.ellipse(10, 8, 1.6, 1.6, 1);    // cœur du trèfle
      for (let k = 0; k < 7; k++) p.set(10 + k * 0.28, 12 + k, 1);   // tige
      p.set(5, 3, 5);
      break;
    }

    case 'cup': {
      // Calice : coupe évasée, nœud, pied. Les trois éléments doivent se distinguer.
      for (let y = 3; y <= 10; y++) {
        const hw = 6.2 - (y - 3) * 0.62;
        p.rect(10 - hw, y, hw * 2 + 1, 1, 2);
      }
      p.rect(4, 3, 13, 1, 4);           // lèvre
      p.rect(5, 4, 11, 2, 1);           // le vin, sous la lèvre
      for (let y = 4; y <= 9; y++) p.set(13 - (y - 4) * 0.5, y, 1);   // ombre de la coupe
      p.ellipse(10, 11.5, 2.2, 1.4, 2); // nœud
      p.rect(9, 12, 3, 4, 2);           // tige
      p.rect(9, 12, 1, 4, 3);
      p.ellipse(10, 17, 5.4, 1.8, 2);   // pied
      p.rect(5, 17, 11, 1, 3);
      p.set(6, 4, 5);
      break;
    }
  }

  p.outline(0);
  const set = build([p], cols);
  cache.set(key, set);
  return set;
}

/** Pièce de collection à demi enfouie : parchemin, sceau, hiéroglyphe ou pierre gravée. */
export function makeFragment(kind: 'parchemin' | 'sceau' | 'hieroglyphe' | 'pierre'): SpriteSet {
  const key = `frag:${kind}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const base = kind === 'parchemin' ? P.linen
    : kind === 'sceau' ? P.gold
      : kind === 'hieroglyphe' ? P.ice : P.steel;
  const cols = [shade(base, -0.75), shade(base, -0.35), base, shade(base, 0.4), P.spark];
  const frames: Pix[] = [];

  for (let i = 0; i < 6; i++) {
    const t = i / 6;
    const p = pixObjet(14, 16);
    const cx = 6.5;
    // Léger flottement : une pièce enfouie qui « respire » se repère bien mieux au sol.
    const lift = Math.sin(t * TAU) * 0.7;

    switch (kind) {
      case 'parchemin':
        p.rect(3, 4 + lift, 8, 9, 2);
        p.ellipse(3, 8.5 + lift, 1.3, 4.6, 3);
        p.ellipse(11, 8.5 + lift, 1.3, 4.6, 3);
        for (let k = 0; k < 4; k++) p.rect(4.5, 6 + k * 2 + lift, 5, 1, 1);
        break;
      case 'sceau':
        p.ellipse(cx, 8 + lift, 4.4, 4.4, 2);
        p.ring(cx, 8 + lift, 3, 3, 1);
        p.set(cx, 8 + lift, 4);
        p.rect(cx - 1, 12 + lift, 3, 3, 1);
        break;
      case 'hieroglyphe':
        p.rect(2, 3 + lift, 11, 11, 2);
        p.shadeVertical(2, 3, 1);
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            if ((r + c + i) % 2 === 0) p.set(4 + c * 3, 5 + r * 3 + lift, 1);
          }
        }
        break;
      case 'pierre':
        // À demi enfouie : seule la face gravée dépasse du sol.
        p.rect(3, 5 + lift, 9, 10, 2);
        p.ellipse(cx, 5 + lift, 4.5, 1.8, 2);
        p.shadeVertical(2, 3, 1);
        p.rect(5, 8 + lift, 5, 1, 1);
        p.rect(5, 10 + lift, 3, 1, 1);
        p.rect(5, 12 + lift, 4, 1, 1);
        break;
    }
    p.outline(0);
    frames.push(p);
  }

  const set = build(frames, cols);
  cache.set(key, set);
  return set;
}

/** Disque plein utilisé pour les auras, flaques et zones – teinté au rendu. */
export function makeDisc(radius: number, color: string, soft = true): HTMLCanvasElement {
  const d = radius * 2 + 2;
  const c = document.createElement('canvas');
  c.width = d;
  c.height = d;
  const ctx = c.getContext('2d')!;
  if (soft) {
    const g = ctx.createRadialGradient(d / 2, d / 2, 0, d / 2, d / 2, radius);
    g.addColorStop(0, color);
    g.addColorStop(0.55, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = color;
  }
  ctx.beginPath();
  ctx.arc(d / 2, d / 2, radius, 0, TAU);
  ctx.fill();
  return c;
}

// ---------------------------------------------------------------------------
// Décor
// ---------------------------------------------------------------------------

/**
 * Tuile de sol 64×64 générée par bruit de valeur, répétée à l'infini par `createPattern`.
 * Le coût est constant quelle que soit la taille du monde.
 */
export function makeGroundTile(seed: number): HTMLCanvasElement {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d')!;
  const rng = new Rng(seed);

  ctx.fillStyle = P.soil;
  ctx.fillRect(0, 0, S, S);

  // Taches de terre plus claire
  for (let i = 0; i < 60; i++) {
    const x = rng.int(0, S - 1);
    const y = rng.int(0, S - 1);
    const w = rng.int(2, 7);
    const h = rng.int(2, 5);
    ctx.fillStyle = rng.chance(0.5) ? P.soilHi : P.night;
    ctx.fillRect(x, y, w, h);
  }
  // Cailloux
  for (let i = 0; i < 14; i++) {
    const x = rng.int(1, S - 3);
    const y = rng.int(1, S - 3);
    ctx.fillStyle = P.stone;
    ctx.fillRect(x, y, 2, 2);
    ctx.fillStyle = P.stoneHi;
    ctx.fillRect(x, y, 1, 1);
  }
  // Touffes d'herbe morte
  for (let i = 0; i < 10; i++) {
    const x = rng.int(2, S - 3);
    const y = rng.int(3, S - 2);
    ctx.fillStyle = rng.chance(0.5) ? '#1e2b2a' : '#25332c';
    for (let k = -1; k <= 1; k++) {
      ctx.fillRect(x + k, y - Math.abs(k), 1, 2 + rng.int(0, 1));
    }
  }
  // Os épars – rappel discret du thème
  for (let i = 0; i < 3; i++) {
    const x = rng.int(3, S - 6);
    const y = rng.int(3, S - 4);
    ctx.fillStyle = '#3a3a46';
    ctx.fillRect(x, y, 4, 1);
    ctx.fillRect(x, y - 1, 1, 1);
    ctx.fillRect(x + 3, y + 1, 1, 1);
  }
  return c;
}

/** Décalque de sang laissé par une mort. Plusieurs variantes pour éviter la répétition. */
export function makeSplat(seed: number): HTMLCanvasElement {
  const S = 14;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d')!;
  const rng = new Rng(seed);
  ctx.fillStyle = P.bloodDark;
  const blobs = rng.int(3, 6);
  for (let i = 0; i < blobs; i++) {
    const a = rng.angle();
    const d = rng.range(0, 4);
    ctx.beginPath();
    ctx.arc(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, rng.range(1.2, 3.4), 0, TAU);
    ctx.fill();
  }
  for (let i = 0; i < 5; i++) {
    const a = rng.angle();
    const d = rng.range(3, 6.5);
    ctx.fillRect(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, 1, 1);
  }
  return c;
}

/** Halo radial réutilisé pour les auras, la lumière des reliques et les glows. */
export function makeGlow(radius: number, color: string): HTMLCanvasElement {
  const d = radius * 2;
  const c = document.createElement('canvas');
  c.width = d;
  c.height = d;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  g.addColorStop(0, color);
  g.addColorStop(0.4, color.replace(/[\d.]+\)$/, '0.35)'));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, d, d);
  return c;
}

/** Ombre portée sous les entités – ancre les sprites au sol. */
export const shadowSprite = (() => {
  let cached: HTMLCanvasElement | null = null;
  return (): HTMLCanvasElement => {
    if (!cached) {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 8;
      const ctx = c.getContext('2d')!;
      const g = ctx.createRadialGradient(8, 4, 0, 8, 4, 8);
      g.addColorStop(0, 'rgba(0,0,0,0.42)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 16, 8);
      cached = c;
    }
    return cached;
  };
})();

export interface Sheet {
  url: string;
  frames: number;
  /** Dimensions d'**une** frame, après agrandissement. */
  w: number;
  h: number;
}

const sheetCache = new Map<string, Sheet>();

/**
 * Planche de sprites horizontale, exportée en `data:` URI.
 *
 * Permet d'animer un sprite en CSS pur (`steps()` sur `background-position`) plutôt qu'avec
 * une boucle JavaScript : le codex peut afficher cinquante sprites animés simultanément sans
 * qu'aucun code ne tourne. `toDataURL` étant coûteux, le résultat est mis en cache par clé.
 */
export function spriteSheet(key: string, set: SpriteSet, scale = 3): Sheet {
  const ck = `${key}@${scale}`;
  const hit = sheetCache.get(ck);
  if (hit) return hit;

  const n = set.frames.length;
  const w = set.w * scale;
  const h = set.h * scale;
  const c = document.createElement('canvas');
  c.width = w * n;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < n; i++) ctx.drawImage(set.frames[i]!, i * w, 0, w, h);

  const sheet: Sheet = { url: c.toDataURL(), frames: n, w, h };
  sheetCache.set(ck, sheet);
  return sheet;
}

/** Icône carrée utilisée par l'UI (cartes, HUD) – dérivée d'un sprite existant. */
export function makeIcon(set: SpriteSet, size = 16): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const src = set.frames[0]!;
  const s = Math.min(size / src.width, size / src.height);
  const w = Math.max(1, Math.floor(src.width * s));
  const h = Math.max(1, Math.floor(src.height * s));
  ctx.drawImage(src, Math.floor((size - w) / 2), Math.floor((size - h) / 2), w, h);
  return c;
}

export { silhouette };
