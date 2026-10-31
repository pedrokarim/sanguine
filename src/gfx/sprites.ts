import { Rng } from '../core/rng';
import { TAU, PI } from '../core/math';
import { P, shade, mix } from './palette';
import { COIN_ART, FRAGMENT_ART, GEM_ART, LOOT_ART } from './lootart';
import { floatingFrames, spinningFrames } from './skillicons';
import { Pix, toCanvas, tint, silhouette } from './pix';
import { clearFrame, composite, createFrame, createFx, effects } from '../../vendor/pixelfx/src/sanguine.js';
import type { CritterId } from '../../vendor/pixelfx/src/sanguine.js';
import { heroFrames } from './hero';
import type { HeroFigure } from './herofigures';
import { PLAN_GAITS, PLANS as SCULPTED } from './bodies';
import { polish, Sculpt } from './sculpt';

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
  /** Allure d'une créature. Absente sur ce qui n'est pas un corps. */
  gait?: Gait;
}

/** Ce qui relie une boucle d'animation au déplacement réel de la créature. */
export interface Gait {
  /** Pixels de sol couverts par une boucle. À 0, la boucle suit le temps : ce corps ne pose rien. */
  stride: number;
  /** Durée d'une boucle au temps, en secondes. */
  period: number;
  /** Boucle calée sur l'alternance élan et pause de l'IA, pas sur la distance. */
  leap: boolean;
  /** Avance ou retard du corps sur sa position réelle, en pixels, le long de la boucle. */
  surge: readonly number[];
  /** Distance du centre du sprite au sol, et largeur de l'ombre. Absentes pour ce qui vole. */
  feet?: number;
  shadow?: number;
  /** Marge vide autour du corps dans chaque image : cerne et barre de vie s'y calent sans elle. */
  margin: number;
}

/** Position de dessin le long de la boucle : la table se parcourt sans à-coup entre ses points. */
export function surgeAt(g: Gait, phase: number): number {
  const n = g.surge.length;
  if (n === 0) return 0;
  const p = phase * n, i = Math.floor(p);
  const a = g.surge[i % n]!, b = g.surge[(i + 1) % n]!;
  return a + (b - a) * (p - i);
}

export interface BodyArt {
  plan: 'humanoid' | 'beast' | 'spider' | 'blob' | 'rider' | 'armored' | 'objet' | 'skeleton'
    | 'zombie' | 'knight' | 'choir' | 'lord' | 'reaper' | 'colossus' | 'worm' | 'bellman'
    | 'critter';
  /** Passe au-dessus du décor : les ruines ne l'arrêtent pas. */
  flies?: boolean;
  /** Créature de la bibliothèque pixelfx, retexturée. Remplace le plan si elle est présente. */
  critter?: { id: CritterId; zoom: number; options?: Record<string, unknown> };
  /** Forme précise, pour le plan `objet`. Les plans corporels l'ignorent. */
  forme?: 'brasero' | 'jarre' | 'reliquaire' | 'sarcophage';
  w: number;
  h: number;
  /** [ombre, principale, lumière] */
  cols: [string, string, string];
  eye: string;
  accent?: string;
  horns?: boolean;
  tail?: boolean;
  crown?: boolean;
  /** Images de la boucle, pour ce qui n'a pas d'allure propre (voir `PLAN_GAITS`). */
  frames?: number;
}

const cache = new Map<string, SpriteSet>();

function build(pixFrames: Pix[], colors: readonly string[]): SpriteSet {
  return setOf(pixFrames.map((p) => polish(toCanvas(p, colors))));
}

function setOf(frames: HTMLCanvasElement[]): SpriteSet {
  return {
    frames,
    // Un grand corps tout blanc masquerait la scène : il blanchit moins fort qu'un petit.
    flash: frames.map((f) => tint(f, '#ffffff', f.width > 44 ? 0.32 : 0.85)),
    elite: frames.map((f) => tint(f, P.bloodHi, 0.42)),
    w: frames[0]!.width,
    h: frames[0]!.height,
  };
}

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

/** Retard d'un corps qui avance par bonds : il stationne au sol et rattrape sa position en l'air. */
function hopSurge(length: number, takeoff: number, landing: number): number[] {
  const n = 16;
  const table = Array.from({ length: n }, (_, i) => {
    const q = i / n;
    const done = q < takeoff ? 0 : q < landing ? (q - takeoff) / (landing - takeoff) : 1;
    return (done - q) * length;
  });
  const mean = table.reduce((sum, v) => sum + v, 0) / n;
  return table.map((v) => v - mean);
}

/** Découpe d'une boucle de pixelfx pour le jeu. */
interface CritterBake {
  frames: number;
  /** Portion gardée de la boucle d'origine, en secondes. Par défaut, toute la boucle. */
  from?: number;
  span?: number;
  /** Durée d'une boucle en jeu. */
  period?: number;
  /** Pixels de sol par boucle, pour ce qui touche le sol. */
  stride?: number;
  leap?: boolean;
  surge?: readonly number[];
  /** Trajet de vitrine de la créature, en fonction de l'angle de la boucle. Voir `critterFrames`. */
  path?: (angle: number) => readonly [number, number];
  /** Retire la poussière, la mouche et la plume détachées du corps. */
  clean?: boolean;
}

/**
 * Comment chaque créature passe de la vitrine au jeu.
 *
 * Une boucle de pixelfx est une petite scène de démonstration : deux à trois secondes, en général
 * jouées à 30 images par seconde. Six images prises à intervalles réguliers en faisaient un
 * diaporama, et tombaient parfois pile sur la période du geste : six battements d'aile en 2,4 s,
 * échantillonnés six fois, c'est six fois la même aile. On garde donc ici un seul geste entier,
 * à sa vraie cadence, et les chiffres de `span` viennent des constantes de chaque module.
 */
const CRITTER_BAKES: Partial<Record<CritterId, CritterBake>> = {
  // Six battements par boucle, quatre poses par battement.
  bat: { frames: 4, from: 0.05, span: 0.4, period: 0.4, clean: true, path: (a) => [22 * Math.sin(a), 7 * Math.sin(2 * a)] },
  // Quatre battements en 1,5 s, puis un plané qu'on écarte : un corbeau de poursuite ne plane pas.
  bird: { frames: 6, span: 0.375, period: 0.375, clean: true },
  wisp: { frames: 8, period: 1, path: (a) => [34 * Math.sin(a), -10 * Math.sin(2 * a)] },
  ghost: { frames: 8, period: 1.2 },
  flyingSkull: { frames: 8, period: 1.2 },
  eyeball: { frames: 8, period: 2.4 },
  // Une boucle contient deux pulsations.
  jellyfish: { frames: 8, span: 1.6, period: 1.6 },
  // Le bond occupe la moitié à 80 % de la boucle d'origine.
  slime: { frames: 8, stride: 37, surge: hopSurge(14, 0.5, 0.8), clean: true },
  // Une ondulation entière sur les deux que compte la boucle.
  snake: { frames: 8, span: 1.2, stride: 30, clean: true },
  // Accroupi, en l'air, retombé : le reste de la boucle est un numéro avec une mouche.
  frog: { frames: 10, from: 0.75, span: 1.3, period: 1.45, leap: true, clean: true },
};

/** Efface ce qui flotte autour du corps : seuls les amas d'une taille sérieuse restent. */
function dropSpecks(img: ImageData): void {
  const { width: w, height: h, data } = img;
  const label = new Int32Array(w * h).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (label[i] !== -1 || data[i * 4 + 3]! < 150) continue;
    const id = sizes.length;
    let size = 0;
    label[i] = id;
    stack.push(i);
    while (stack.length > 0) {
      const c = stack.pop()!;
      size++;
      const x = c % w;
      for (const n of [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, c - w, c + w]) {
        if (n < 0 || n >= w * h || label[n] !== -1 || data[n * 4 + 3]! < 150) continue;
        label[n] = id;
        stack.push(n);
      }
    }
    sizes.push(size);
  }
  const keep = Math.max(...sizes) * 0.12;
  for (let i = 0; i < w * h; i++) {
    if (label[i] !== -1 && sizes[label[i]!]! < keep) data[i * 4 + 3] = 0;
  }
}

/**
 * Fait tourner une créature de pixelfx et garde ses images : couleur et lumière réunies, sur
 * fond transparent, recadrées sur la zone utilisée par l'ensemble du cycle.
 *
 * Le trajet de vitrine est annulé image par image. Une chauve-souris de pixelfx vole en huit dans
 * sa case : gardé tel quel, ce vol faisait sauter son corps de vingt pixels à chaque image,
 * par-dessus la trajectoire du jeu.
 */
function critterFrames(art: BodyArt): HTMLCanvasElement[] {
  const { id, zoom, options } = art.critter!;
  const mod = effects[id];
  const bake = CRITTER_BAKES[id];
  const n = bake?.frames ?? art.frames ?? 6;
  const duration = mod.meta.duration;
  const span = bake?.span ?? duration;
  const [mw, mh] = mod.meta.size;
  const w = Math.ceil(mw * zoom) + 8;
  const h = Math.ceil(mh * zoom) + 8;
  const homeX = Math.ceil(mod.meta.origin[0] * zoom) + 4;
  const homeY = Math.ceil(mod.meta.origin[1] * zoom) + 4;
  const frame = createFrame(w, h);
  const images: ImageData[] = [];
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let i = 0; i < n; i++) {
    const time = (bake?.from ?? 0) + (i * span) / n;
    const [dx, dy] = bake?.path?.((time / duration) * TAU) ?? [0, 0];
    // Ces boucles ne dépendent que du temps : une instance posée au bon endroit, à chaque image.
    const fx = createFx(mod, { ...options, zoom, x: homeX - dx * zoom, y: homeY - dy * zoom });
    fx.update(time);
    clearFrame(frame);
    fx.draw(frame, 'back');
    fx.draw(frame, 'front');
    const img = new ImageData(w, h);
    composite(frame, img.data, null);
    if (bake?.clean) dropSpecks(img);
    images.push(img);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (img.data[(y * w + x) * 4 + 3]! < 40) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return images.map((img) => {
    const c = document.createElement('canvas');
    c.width = x1 - x0 + 1;
    c.height = y1 - y0 + 1;
    c.getContext('2d')!.putImageData(img, -x0, -y0);
    return c;
  });
}

/** Marge autour d'un corps sculpté : tronc soulevé, cloche qui balance, pas qui décolle. */
const BODY_MARGIN = 4;

/** Allure tirée du plan ou de la découpe, pour un corps de `h` pixels de haut. */
function gaitOf(art: BodyArt, w: number, h: number, frames: number): Gait {
  if (art.critter) {
    const bake = CRITTER_BAKES[art.critter.id];
    return { stride: bake?.stride ?? 0, period: bake?.period ?? frames / 4, leap: bake?.leap ?? false, surge: bake?.surge ?? [], margin: 0 };
  }
  const plan = PLAN_GAITS[art.plan];
  const amount = plan?.surge ?? 0;
  return {
    stride: plan?.pace ? plan.pace * Math.sqrt(h) : 0,
    // Un décor animé garde sa cadence d'origine, deux images par seconde.
    period: plan?.period ?? frames / 2,
    leap: false,
    // Au contact, le corps retient son élan ; il se jette en avant quand la jambe passe.
    surge: amount > 0 ? Array.from({ length: 16 }, (_, i) => -amount * Math.sin((i / 16) * TAU * 2)) : [],
    feet: h / 2 - 2,
    shadow: Math.round(w * 0.8),
    margin: BODY_MARGIN,
  };
}

export function makeBody(key: string, art: BodyArt): SpriteSet {
  const hit = cache.get(key);
  if (hit) return hit;

  const n = PLAN_GAITS[art.plan]?.frames ?? art.frames ?? 4;
  const S = CORPS_ECHELLE;
  const w = Math.round(art.w * S), h = Math.round(art.h * S);
  const plan = SCULPTED[art.plan];
  const frames = art.critter
    ? critterFrames(art)
    : Array.from({ length: n }, (_, i) => {
      const sculpt = new Sculpt(w, h, BODY_MARGIN);
      plan!(sculpt, art, i / n);
      return sculpt.render();
    });
  const set: SpriteSet = { ...setOf(frames), gait: gaitOf(art, w, h, frames.length) };
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
  /** Le signe qui distingue un personnage à sa seule silhouette. */
  trait?: 'quiver' | 'robe' | 'scarf';
  figure: HeroFigure;
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

/** Héros détaillé, dessiné au pixel près : voir `hero.ts`. */
export function makeHeroDetaille(key: string, art: HeroArt, moving: boolean): SpriteSet {
  const ck = `detail:${key}:${moving ? 'walk' : 'idle'}`;
  const hit = cache.get(ck);
  if (hit) return hit;
  const set = setOf(heroFrames(art, moving));
  cache.set(ck, set);
  return set;
}

// ---------------------------------------------------------------------------
// Butin et objets
// ---------------------------------------------------------------------------

/** Gemme d'XP : losange qui oscille et scintille. La forme varie par rang (daltonisme). */
/** Ce qui se ramasse : les dessins vivent dans `lootart.ts`, seule l'animation se décide ici. */
function paintedLoot(key: string, frames: () => HTMLCanvasElement[]): SpriteSet {
  let set = cache.get(key);
  if (!set) {
    set = setOf(frames());
    cache.set(key, set);
  }
  return set;
}

export function makeGem(rank: 0 | 1 | 2 | 3): SpriteSet {
  return paintedLoot(`gem:${rank}`, () => floatingFrames(GEM_ART[rank]!));
}

export function makeCoin(): SpriteSet {
  return paintedLoot('coin', () => spinningFrames(COIN_ART));
}

export function makeHeart(): SpriteSet {
  return paintedLoot('heart', () => floatingFrames(LOOT_ART.heart!));
}

export function makeChest(): SpriteSet {
  return paintedLoot('chest', () => floatingFrames(LOOT_ART.chest!));
}

/** Petits objets consommables : aimant, bombe, sablier, parchemin, encensoir. */
export function makeItem(kind: 'magnet' | 'bomb' | 'hourglass' | 'scroll' | 'censer'): SpriteSet {
  return paintedLoot(`item:${kind}`, () => floatingFrames(LOOT_ART[kind]!));
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
  /*
   * Sept teintes au lieu de cinq. Les trois dernières ne sont posées par aucun dessin : ce
   * sont les passes d'éclairage, comme pour les créatures.
   *
   * La **taille ne change pas**. Un projectile est vu une fraction de seconde au milieu de
   * la mêlée : l'agrandir brouillerait la lecture du combat, ce que le détail ne rachète
   * pas. On gagne du volume, pas de la place.
   */
  const cols = [
    shade(base, -0.72),                  // 0 contour
    shade(base, -0.32),                  // 1 ombre
    base,                                // 2 teinte propre
    shade(base, 0.5),                    // 3 lumière
    '#ffffff',                           // 4 éclat
    mix(shade(base, 0.4), P.ice, 0.4),   // 5 rasante froide
    shade(base, -0.5),                   // 6 contour du côté éclairé
  ];
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

    /*
     * Mêmes passes que sur les créatures, pour que projectiles et monde aient l'air éclairés
     * par la même lumière. L'occlusion est écartée : sur un sprite de dix pixels, chercher
     * un rebord ne produit que du bruit.
     */
    p.rimLight(1, 0, 5);
    p.outlineDouble(0, 6);
    frames.push(p);
  }

  const set = build(frames, cols);
  cache.set(key, set);
  return set;
}

/** Pièce de collection : parchemin, sceau, hiéroglyphe ou pierre gravée. */
export function makeFragment(kind: 'parchemin' | 'sceau' | 'hieroglyphe' | 'pierre'): SpriteSet {
  return paintedLoot(`frag:${kind}`, () => floatingFrames(FRAGMENT_ART[kind]!));
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
