import { Rng } from '../core/rng';
import { valueNoise2, TAU, dist2 } from '../core/math';
import { P, shade, hexToRgb } from '../gfx/palette';
import { Pix, toCanvas } from '../gfx/pix';

/**
 * Terrain : biomes procéduraux, décor et points d'intérêt.
 *
 * Le monde est infini et entièrement **déterministe à partir de sa position** : aucune
 * donnée de carte n'est stockée. Un point d'intérêt situé en (4200, −900) est toujours le
 * même autel, qu'on y arrive par la gauche ou après un détour de dix minutes. Cela permet
 * de générer un monde illimité pour un coût mémoire nul, et rend les runs rejouables à la
 * graine près.
 *
 * Seul l'état « déjà activé » est mémorisé, dans un `Set` de clés de cellule.
 */

// ---------------------------------------------------------------------------
// Biomes
// ---------------------------------------------------------------------------

export interface Biome {
  id: string;
  name: string;
  /** Couleurs du sol : [base, variation sombre, variation claire, détail]. */
  ground: [string, string, string, string];
  /** Multiplicateurs d'apparition par ennemi. Absent = 1. */
  weights: Record<string, number>;
  /** Effet passif sur le joueur tant qu'il s'y trouve. */
  moveMul: number;
  mightMul: number;
  /** Densité de décor, 0..1. */
  props: number;
  /** Type de décor dominant. */
  propKind: PropKind;
  /** Texte affiché à l'entrée dans le biome. */
  flavor: string;
}

export type PropKind = 'rock' | 'grave' | 'reed' | 'stump' | 'bone';

export const BIOMES: Biome[] = [
  {
    id: 'moor',
    name: 'La Lande',
    ground: [P.soil, P.night, P.soilHi, '#25332c'],
    weights: {},
    moveMul: 1,
    mightMul: 1,
    props: 0.35,
    propKind: 'rock',
    flavor: 'rien que de la bruyère morte',
  },
  {
    id: 'graveyard',
    name: 'Le Cimetière',
    ground: ['#191d2a', '#0e1119', '#242a3c', '#3a4152'],
    weights: { skeleton: 3.2, ghoul: 1.8, wraith: 2.4, damned: 1.6, bat: 0.5 },
    moveMul: 1,
    mightMul: 1,
    props: 0.7,
    propKind: 'grave',
    flavor: 'on y a enterré trop de monde',
  },
  {
    id: 'mire',
    name: 'Le Marais',
    ground: ['#16211a', '#0d1410', '#1f2e22', '#2f4a2c'],
    weights: { zombie: 3.0, leech: 2.6, spitter: 2.2, spider: 1.4, rider: 0.3 },
    // Le marais ralentit : c'est le seul biome réellement dangereux à traverser.
    moveMul: 0.86,
    mightMul: 1,
    props: 0.6,
    propKind: 'reed',
    flavor: 'la boue vous retient',
  },
  {
    id: 'ashes',
    name: 'Les Cendres',
    ground: ['#221a1c', '#140f11', '#2e2225', '#4a2c2c'],
    weights: { damned: 2.6, golem: 2.2, wolf: 1.5, crow: 1.6, zombie: 0.5 },
    moveMul: 1,
    // Compense le danger : la chaleur attise les armes.
    mightMul: 1.08,
    props: 0.45,
    propKind: 'bone',
    flavor: 'quelque chose a brûlé ici, longtemps',
  },
  {
    id: 'thicket',
    name: 'Les Bois Morts',
    ground: ['#141c18', '#0b110e', '#1d2a22', '#2a3a2a'],
    weights: { wolf: 3.0, spider: 2.4, crow: 2.2, bat: 1.6, skeleton: 0.6 },
    moveMul: 0.96,
    mightMul: 1,
    props: 0.85,
    propKind: 'stump',
    flavor: 'les arbres sont morts debout',
  },
];

export const BIOME_BY_ID = new Map(BIOMES.map((b) => [b.id, b]));

/** Échelle des biomes en pixels : ~1400 px de large, soit environ trois écrans. */
const BIOME_SCALE = 1400;

/**
 * Biome à une position du monde. Deux octaves de bruit : la première découpe de grandes
 * régions, la seconde brise les frontières pour qu'elles ne soient pas des cercles nets.
 */
export function biomeAt(x: number, y: number): Biome {
  const a = valueNoise2(x / BIOME_SCALE, y / BIOME_SCALE, 1337);
  const b = valueNoise2(x / (BIOME_SCALE * 0.43) + 31.7, y / (BIOME_SCALE * 0.43) + 17.3, 991);
  const v = a * 0.72 + b * 0.28;

  // La Lande domine : les biomes marqués doivent rester des événements, pas la norme.
  if (v < 0.40) return BIOMES[0]!;
  if (v < 0.55) return BIOMES[1]!;
  if (v < 0.68) return BIOMES[4]!;
  if (v < 0.80) return BIOMES[2]!;
  return BIOMES[3]!;
}

// ---------------------------------------------------------------------------
// Points d'intérêt
// ---------------------------------------------------------------------------

export type PoiType = 'altar' | 'pyre' | 'obelisk' | 'well' | 'ossuary' | 'chapel' | 'cairn';

export interface PoiDef {
  type: PoiType;
  name: string;
  hint: string;
  weight: number;
  /** Rayon d'activation. */
  radius: number;
  color: string;
  w: number;
  h: number;
}

export const POI_DEFS: Record<PoiType, PoiDef> = {
  altar: { type: 'altar', name: 'Autel de Sang', hint: 'une relique vous attend', weight: 8, radius: 18, color: '#a855f7', w: 26, h: 26 },
  pyre: { type: 'pyre', name: 'Bûcher', hint: 'la flamme purifie', weight: 16, radius: 18, color: P.fire, w: 22, h: 26 },
  obelisk: { type: 'obelisk', name: 'Obélisque', hint: 'la pierre vous prête sa force', weight: 14, radius: 16, color: P.ice, w: 18, h: 34 },
  well: { type: 'well', name: 'Puits', hint: 'on y a jeté des pièces', weight: 18, radius: 16, color: P.gold, w: 24, h: 22 },
  ossuary: { type: 'ossuary', name: 'Ossuaire', hint: 'quelque chose y dort', weight: 12, radius: 18, color: P.bone, w: 28, h: 24 },
  chapel: { type: 'chapel', name: 'Chapelle Noyée', hint: 'un répit', weight: 7, radius: 22, color: P.linen, w: 40, h: 38 },
  cairn: { type: 'cairn', name: 'Cairn', hint: 'des offrandes', weight: 20, radius: 15, color: P.steel, w: 20, h: 24 },
};

const POI_LIST = Object.values(POI_DEFS);

export interface Poi {
  key: string;
  type: PoiType;
  def: PoiDef;
  x: number;
  y: number;
  used: boolean;
  /** Horloge d'animation propre, pour désynchroniser les structures entre elles. */
  anim: number;
  /** Progression de l'effet d'activation, 1 → 0. */
  flash: number;
}

/** Taille de la cellule de placement. Un POI tous les ~600 px, soit un toutes les ~8 s. */
const POI_CELL = 600;

/** Hachage entier stable : la même cellule donne toujours la même graine. */
function cellSeed(cx: number, cy: number, salt: number): number {
  let n = Math.imul(cx, 0x27d4eb2d) ^ Math.imul(cy, 0x165667b1) ^ Math.imul(salt, 0x9e3779b9);
  n = (n ^ (n >>> 15)) >>> 0;
  n = Math.imul(n, 0x85ebca6b) >>> 0;
  return (n ^ (n >>> 13)) >>> 0;
}

// ---------------------------------------------------------------------------
// Décor
// ---------------------------------------------------------------------------

export interface Prop {
  x: number;
  y: number;
  kind: PropKind;
  variant: number;
}

/** Cellule de décor, plus fine que celle des POI. */
const PROP_CELL = 150;

// ---------------------------------------------------------------------------
// Sprites du terrain
// ---------------------------------------------------------------------------

const groundCache = new Map<string, HTMLCanvasElement>();
const propCache = new Map<string, HTMLCanvasElement>();
const poiCache = new Map<string, HTMLCanvasElement[]>();

/** Nombre de variantes par biome. Quatre suffisent à casser la grille pour l'œil. */
export const GROUND_VARIANTS = 4;

/**
 * Côté d'une tuile de sol. Élargi de 64 à 128 px : à 64, le motif se répétait sept fois et
 * demie par écran, ce qui se remarque immédiatement une fois la texture quantifiée. À 128, il
 * se répète moins de quatre fois, et le rendu coûte quatre fois moins de `drawImage`.
 */
export const GROUND_TILE = 128;

/**
 * Tuile de sol 64×64 propre à un biome.
 *
 * Deux précautions, apprises en regardant le résultat à l'écran :
 *   – **plusieurs variantes**, sélectionnées par la position, sinon la grille de 64 px saute
 *     aux yeux et le monde entier a l'air d'un papier peint ;
 *   – **peu de détails contrastés**, sinon le sol concurrence les ennemis. Le décor doit
 *     être une texture, pas une information.
 */
export function groundTile(biome: Biome, variant = 0): HTMLCanvasElement {
  const key = `${biome.id}:${variant}`;
  const hit = groundCache.get(key);
  if (hit) return hit;

  const S = GROUND_TILE;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d')!;
  const rng = new Rng(cellSeed(biome.id.length * 31 + variant, 7, 42));
  const [base, dark, light, detail] = biome.ground;

  // Le sol est tiré d'un bruit **périodique** évalué par pixel : deux octaves qui se
  // raccordent exactement aux bords de la tuile. C'est ce qui remplace les rectangles semi-
  // transparents de la première version, dont les arêtes donnaient au monde un aspect de
  // patchwork cousu.
  const img = ctx.createImageData(S, S);
  const ramp = [dark, base, light].map(hexToRgb);

  /*
   * Le champ de bruit ne dépend **que du biome**, jamais de la variante : un bruit périodique
   * se raccorde avec lui-même, pas avec un bruit de graine différente. Faire varier la graine
   * par variante rendait la grille de 64 px plus visible qu'avant.
   *
   * Surtout, le résultat est **quantifié**. La première version interpolait continûment entre
   * les trois teintes : mathématiquement correct, mais dans un jeu dont tout le reste est à
   * arêtes dures, un sol en dégradé lisse ne se lit pas comme une texture — il se lit comme du
   * flou. Cinq paliers suffisent à retrouver des aplats francs, cohérents avec les sprites.
   */
  const salt = biome.id.length * 13 + 7;
  const LEVELS = 5;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n =
        periodicNoise(x / 32, y / 32, S / 32, salt) * 0.58 +
        periodicNoise(x / 8, y / 8, S / 8, salt + 101) * 0.42;

      // Quantification : `n` continu → un palier discret, puis une teinte de la rampe.
      // La rampe est ensuite **comprimée** vers le centre : les arêtes restent franches, mais
      // le sol n'atteint jamais ses extrêmes. Sans cette compression, la texture rivalise
      // d'intensité avec les ennemis, ce qui contredit toute la règle de lisibilité du jeu :
      // le décor doit rester une texture, jamais un signal.
      const step = Math.min(LEVELS - 1, Math.floor(n * LEVELS));
      const raw = step / (LEVELS - 1);
      const t = 0.5 + (raw - 0.5) * 0.55;
      const seg = t < 0.5 ? 0 : 1;
      const f = t < 0.5 ? t * 2 : (t - 0.5) * 2;
      const a = ramp[seg]!;
      const b = ramp[seg + 1]!;

      const o = (y * S + x) * 4;
      img.data[o] = a[0] + (b[0] - a[0]) * f;
      img.data[o + 1] = a[1] + (b[1] - a[1]) * f;
      img.data[o + 2] = a[2] + (b[2] - a[2]) * f;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Quelques cailloux seulement – le détail ponctue, il ne meuble pas.
  for (let i = 0; i < 18; i++) {
    const x = rng.int(1, S - 3);
    const y = rng.int(1, S - 3);
    ctx.fillStyle = shade(detail, -0.3);
    ctx.fillRect(x, y, 2, 2);
    ctx.fillStyle = shade(detail, -0.05);
    ctx.fillRect(x, y, 1, 1);
  }

  // Touffes rares et peu contrastées : trois par tuile, pas douze.
  for (let i = 0; i < 11; i++) {
    const x = rng.int(2, S - 4);
    const y = rng.int(3, S - 3);
    ctx.fillStyle = shade(detail, -0.1);
    for (let k = -1; k <= 1; k++) ctx.fillRect(x + k, y - Math.abs(k), 1, 2);
  }

  groundCache.set(key, c);
  return c;
}

/**
 * Bruit de valeur **périodique** : la grille de hachage se replie modulo `period`, donc la
 * texture se raccorde parfaitement sur elle-même. Indispensable ici, sinon chaque tuile
 * afficherait une couture nette sur ses quatre bords.
 */
function periodicNoise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  const h = (a: number, b: number): number => {
    const wa = ((a % period) + period) % period;
    const wb = ((b % period) + period) % period;
    let n = Math.imul(wa, 374761393) + Math.imul(wb, 668265263) + Math.imul(seed, 1442695041);
    n = (n ^ (n >>> 13)) >>> 0;
    n = Math.imul(n, 1274126177) >>> 0;
    return (n >>> 8) / 16777216;
  };

  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  const top = a + (b - a) * u;
  const bottom = c + (d - c) * u;
  return top + (bottom - top) * v;
}

/** Variante de tuile à une position de grille – stable, donc sans scintillement au scroll. */
export function groundVariantAt(tx: number, ty: number): number {
  return cellSeed(tx, ty, 0x51ed) % GROUND_VARIANTS;
}

/**
 * Biome d'une tuile de sol, échantillonné avec un **décalage déterministe** propre à la tuile.
 *
 * Sans ce décalage, la frontière suit exactement le contour du champ de bruit, quantifié à
 * 64 px : là où le champ frôle un seuil, on obtient des îlots de deux ou trois tuiles aux
 * arêtes parfaitement rectilignes. À l'écran, cela ressemble à un rectangle posé sur le
 * décor – un artefact que l'œil repère immédiatement.
 *
 * En bruitant le point d'échantillonnage d'environ trois quarts de tuile, la frontière
 * devient déchiquetée et les îlots se dissolvent en bordures organiques. La granularité du
 * jeu, elle, continue d'utiliser `biomeAt` sur la position exacte du joueur : c'est le champ
 * lisse qui fait foi pour les règles, le bruitage ne concerne que l'affichage.
 */
export function biomeAtTile(tx: number, ty: number): Biome {
  const h = cellSeed(tx, ty, 0x7a11);
  const jx = ((h & 0xffff) / 0xffff - 0.5) * GROUND_TILE * 0.75;
  const jy = (((h >>> 16) & 0xffff) / 0xffff - 0.5) * GROUND_TILE * 0.75;
  return biomeAt(tx * GROUND_TILE + GROUND_TILE / 2 + jx, ty * GROUND_TILE + GROUND_TILE / 2 + jy);
}

/** Décor secondaire : rochers, tombes, roseaux, souches, ossements. */
export function propSprite(kind: PropKind, variant: number, biome: Biome): HTMLCanvasElement {
  const key = `${kind}:${variant}:${biome.id}`;
  const hit = propCache.get(key);
  if (hit) return hit;

  const detail = biome.ground[3];
  const cols = [
    shade(detail, -0.6),
    shade(detail, -0.25),
    detail,
    shade(detail, 0.3),
    P.boneHi,
  ];
  const p = new Pix(16, 18);
  const rng = new Rng(cellSeed(variant, kind.length, 5));

  switch (kind) {
    case 'rock':
      p.ellipse(8, 13, 4 + rng.range(0, 2), 3 + rng.range(0, 1.5), 2);
      p.ellipse(6, 11, 2, 1.6, 3);
      p.ellipse(11, 14, 2.2, 1.4, 1);
      break;
    case 'grave': {
      // Stèle inclinée : l'inclinaison aléatoire évite l'alignement mécanique.
      const tilt = rng.spread(1.4);
      p.limb(8, 17, 8 + tilt, 8, 4.4, 2);
      p.ellipse(8 + tilt, 8, 2.6, 2.2, 2);
      p.rect(7 + tilt, 10, 3, 1, 1);
      p.rect(6.4 + tilt, 11.6, 4, 1, 1);
      p.shadeVertical(2, 3, 1);
      break;
    }
    case 'reed':
      for (let i = 0; i < 6; i++) {
        const bx = 4 + rng.range(0, 8);
        const hgt = 6 + rng.range(0, 6);
        p.line(bx, 17, bx + rng.spread(2), 17 - hgt, 2);
        p.set(bx + rng.spread(2), 17 - hgt - 1, 3);
      }
      break;
    case 'stump':
      p.limb(8, 17, 8, 9, 5, 1);
      p.ellipse(8, 9, 3.2, 1.8, 2);
      p.ellipse(8, 9, 1.6, 0.9, 3);
      // Branche morte : silhouette bien plus reconnaissable qu'un simple cylindre.
      p.line(8, 11, 13, 5, 1);
      p.line(11, 8, 13, 7, 1);
      p.line(8, 12, 3, 7, 1);
      break;
    case 'bone':
      p.rect(4, 14, 8, 1, 4);
      p.rect(4, 13, 1, 1, 4);
      p.rect(11, 15, 1, 1, 4);
      p.ellipse(6, 11, 2.4, 2, 4);
      p.set(5, 11, 0);
      p.set(7, 11, 0);
      break;
  }
  p.outline(0);
  const c = toCanvas(p, cols);
  propCache.set(key, c);
  return c;
}

/** Structure : 4 frames d'animation (lueur pulsée), plus une frame « épuisée ». */
export function poiSprite(type: PoiType): HTMLCanvasElement[] {
  const hit = poiCache.get(type);
  if (hit) return hit;

  const def = POI_DEFS[type];
  const cols = [
    '#05060a',
    P.stone,
    P.stoneHi,
    P.mist,
    def.color,
    shade(def.color, 0.5),
  ];

  const frames: HTMLCanvasElement[] = [];
  for (let f = 0; f < 5; f++) {
    const spent = f === 4;
    const t = f / 4;
    const glow = spent ? -1 : 4; // -1 = transparent : la structure épuisée perd sa lueur
    const p = new Pix(def.w, def.h);
    const cx = def.w / 2 - 0.5;
    const bot = def.h - 1;

    switch (type) {
      case 'altar':
        p.rect(cx - 8, bot - 5, 17, 5, 1);
        p.rect(cx - 6, bot - 8, 13, 3, 2);
        p.rect(cx - 4, bot - 11, 9, 3, 1);
        p.ellipse(cx, bot - 13 - Math.sin(t * TAU) * 1.2, 3.4, 3, glow);
        p.ellipse(cx, bot - 13, 1.6, 1.4, spent ? 1 : 5);
        break;

      case 'pyre':
        p.rect(cx - 7, bot - 3, 15, 3, 1);
        p.line(cx - 5, bot - 3, cx + 3, bot - 9, 1);
        p.line(cx + 5, bot - 3, cx - 3, bot - 9, 1);
        p.line(cx, bot - 3, cx, bot - 10, 2);
        if (!spent) {
          const flick = Math.sin(t * TAU);
          p.ellipse(cx, bot - 13 + flick, 4 - flick * 0.5, 5.5, 4);
          p.ellipse(cx, bot - 14 + flick, 2.2, 3.4, 5);
          p.set(cx, bot - 18 + flick * 2, 5);
        }
        break;

      case 'obelisk':
        // Monolithe effilé : la silhouette verticale se repère de loin.
        p.rect(cx - 5, bot - 3, 11, 3, 1);
        for (let y = 0; y < def.h - 4; y++) {
          const hw = 4 - (y / (def.h - 4)) * 2.2;
          p.rect(cx - hw, bot - 4 - y, hw * 2 + 1, 1, 2);
        }
        p.shadeVertical(2, 3, 1);
        if (!spent) {
          for (let k = 0; k < 3; k++) p.rect(cx - 1, 8 + k * 6 + Math.sin(t * TAU + k) * 0.6, 3, 1, 4);
          p.set(cx, 4, 5);
        }
        break;

      case 'well':
        p.ellipse(cx, bot - 4, 9, 5, 1);
        p.ellipse(cx, bot - 5, 7, 3.6, 0);
        p.ring(cx, bot - 5, 8, 4.6, 2);
        p.limb(cx - 7, bot - 7, cx - 7, bot - 16, 1.8, 3);
        p.limb(cx + 7, bot - 7, cx + 7, bot - 16, 1.8, 3);
        p.rect(cx - 8, bot - 17, 17, 2, 3);
        if (!spent) {
          p.line(cx, bot - 15, cx, bot - 9 - Math.sin(t * TAU), 2);
          p.ellipse(cx, bot - 6, 4, 2, 4);
        }
        break;

      case 'ossuary':
        p.rect(cx - 10, bot - 8, 21, 8, 1);
        p.shadeVertical(1, 2, 0);
        for (let k = 0; k < 5; k++) {
          const bx = cx - 8 + k * 4;
          p.ellipse(bx, bot - 10, 2, 1.8, 3);
          p.set(bx - 1, bot - 10, 0);
          p.set(bx + 1, bot - 10, 0);
        }
        if (!spent) {
          p.rect(cx - 3, bot - 6, 7, 5, 4);
          p.rect(cx - 2, bot - 5, 5, 4, 0);
        }
        break;

      case 'chapel':
        // Ruine : mur arrière, arche béante, clocher penché.
        p.rect(cx - 13, bot - 16, 27, 16, 1);
        p.shadeVertical(1, 2, 0);
        p.rect(cx - 5, bot - 12, 11, 12, 0);
        p.ellipse(cx, bot - 12, 5.4, 4.4, 0);
        for (let k = 0; k < 12; k++) {
          p.set(cx - 13 + k * 2.4, bot - 17 - (k % 3), 2);
        }
        p.rect(cx + 6, bot - 26, 7, 11, 1);
        p.line(cx + 9.5, bot - 27, cx + 9.5, bot - 32, 2);
        p.rect(cx + 8, bot - 30, 4, 1, 2);
        if (!spent) {
          p.ellipse(cx, bot - 8 - Math.sin(t * TAU) * 0.8, 3, 3.4, 4);
          p.set(cx, bot - 9, 5);
        }
        break;

      case 'cairn': {
        // Empilement de pierres : chaque niveau plus petit que le précédent.
        let y = bot;
        let rw = 6.5;
        while (rw > 1.6) {
          p.ellipse(cx, y - 1.5, rw, 2, 2);
          y -= 3.4;
          rw -= 1.3;
        }
        p.shadeVertical(2, 3, 1);
        if (!spent) p.ellipse(cx, y, 2, 1.8, 4);
        break;
      }
    }

    p.outline(0);
    frames.push(toCanvas(p, cols));
  }

  poiCache.set(type, frames);
  return frames;
}

// ---------------------------------------------------------------------------
// Gestionnaire de terrain
// ---------------------------------------------------------------------------

export class Terrain {
  /** POI générés, indexés par clé de cellule. Ne contient que les cellules déjà visitées. */
  private pois = new Map<string, Poi | null>();
  /** Décor généré, indexé par clé de cellule. */
  private props = new Map<string, Prop[]>();

  /** Biome courant du joueur, pour l'annonce d'entrée et les effets passifs. */
  currentBiome: Biome = BIOMES[0]!;
  /** POI découverts et activés, seulement pour les statistiques de fin. */
  activated = 0;

  constructor(private readonly seed: number) {}

  /** POI d'une cellule, généré paresseusement et mémorisé. */
  private poiAt(cx: number, cy: number): Poi | null {
    const key = `${cx},${cy}`;
    const hit = this.pois.get(key);
    if (hit !== undefined) return hit;

    const rng = new Rng(cellSeed(cx, cy, this.seed));
    // La cellule d'origine reste vide : le joueur ne doit pas démarrer sur une structure.
    if ((cx === 0 && cy === 0) || !rng.chance(0.62)) {
      this.pois.set(key, null);
      return null;
    }

    const x = cx * POI_CELL + rng.range(POI_CELL * 0.2, POI_CELL * 0.8);
    const y = cy * POI_CELL + rng.range(POI_CELL * 0.2, POI_CELL * 0.8);
    const biome = biomeAt(x, y);

    // Le biome infléchit le type : un ossuaire au cimetière, un bûcher dans les cendres.
    const weights = POI_LIST.map((d) => {
      let w = d.weight;
      if (biome.id === 'graveyard' && (d.type === 'ossuary' || d.type === 'chapel')) w *= 2.4;
      if (biome.id === 'ashes' && d.type === 'pyre') w *= 2.6;
      if (biome.id === 'mire' && d.type === 'well') w *= 2.2;
      if (biome.id === 'thicket' && d.type === 'cairn') w *= 2.2;
      return w;
    });
    const def = POI_LIST[rng.weighted(weights)] ?? POI_LIST[0]!;

    const poi: Poi = {
      key, type: def.type, def, x, y, used: false,
      anim: rng.range(0, 4), flash: 0,
    };
    this.pois.set(key, poi);
    return poi;
  }

  /** Décor d'une cellule, généré paresseusement. */
  private propsAt(cx: number, cy: number): Prop[] {
    const key = `${cx},${cy}`;
    const hit = this.props.get(key);
    if (hit) return hit;

    const rng = new Rng(cellSeed(cx, cy, this.seed ^ 0x5bf03635));
    const bx = cx * PROP_CELL + PROP_CELL / 2;
    const by = cy * PROP_CELL + PROP_CELL / 2;
    const biome = biomeAt(bx, by);

    const out: Prop[] = [];
    const n = rng.next() < biome.props ? rng.int(1, 3) : 0;
    for (let i = 0; i < n; i++) {
      out.push({
        x: cx * PROP_CELL + rng.range(0, PROP_CELL),
        y: cy * PROP_CELL + rng.range(0, PROP_CELL),
        kind: biome.propKind,
        variant: rng.int(0, 3),
      });
    }
    this.props.set(key, out);
    return out;
  }

  /** POI dans un rayon autour d'un point. Tampon réutilisé, ne pas conserver. */
  private poiBuf: Poi[] = [];
  poisNear(x: number, y: number, radius: number): Poi[] {
    this.poiBuf.length = 0;
    const c0x = Math.floor((x - radius) / POI_CELL);
    const c1x = Math.floor((x + radius) / POI_CELL);
    const c0y = Math.floor((y - radius) / POI_CELL);
    const c1y = Math.floor((y + radius) / POI_CELL);
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const p = this.poiAt(cx, cy);
        if (p) this.poiBuf.push(p);
      }
    }
    return this.poiBuf;
  }

  private propBuf: Prop[] = [];
  propsNear(x: number, y: number, radius: number): Prop[] {
    this.propBuf.length = 0;
    const c0x = Math.floor((x - radius) / PROP_CELL);
    const c1x = Math.floor((x + radius) / PROP_CELL);
    const c0y = Math.floor((y - radius) / PROP_CELL);
    const c1y = Math.floor((y + radius) / PROP_CELL);
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const list = this.propsAt(cx, cy);
        for (const p of list) this.propBuf.push(p);
      }
    }
    return this.propBuf;
  }

  /**
   * Met à jour les animations et détecte les activations. Retourne le POI activé cette
   * frame, ou `null` – l'effet lui-même est appliqué par le monde, qui seul connaît le
   * joueur, les ennemis et le butin.
   */
  update(px: number, py: number, dt: number): Poi | null {
    const biome = biomeAt(px, py);
    const changed = biome.id !== this.currentBiome.id;
    this.currentBiome = biome;

    let triggered: Poi | null = null;
    for (const poi of this.poisNear(px, py, 420)) {
      poi.anim += dt;
      if (poi.flash > 0) poi.flash -= dt;
      if (poi.used || triggered) continue;
      const r = poi.def.radius;
      if (dist2(px, py, poi.x, poi.y) < r * r) {
        poi.used = true;
        poi.flash = 1;
        this.activated++;
        triggered = poi;
      }
    }

    this.biomeChanged = changed;
    return triggered;
  }

  /** `true` la frame où le joueur change de biome. */
  biomeChanged = false;

  /** Clés des structures déjà consommées, pour la sauvegarde de reprise. */
  usedKeys(): string[] {
    const out: string[] = [];
    for (const poi of this.pois.values()) if (poi?.used) out.push(poi.key);
    return out;
  }

  /**
   * Marque des structures comme déjà activées. Les cellules sont générées à la demande :
   * on force donc leur création avant de poser le drapeau, sinon la structure réapparaîtrait
   * intacte à la première visite suivante.
   */
  restoreUsed(keys: string[]): void {
    for (const key of keys) {
      const [cx, cy] = key.split(',').map(Number);
      const poi = this.poiAt(cx!, cy!);
      if (poi) poi.used = true;
    }
  }
}
