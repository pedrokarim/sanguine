import { Rng } from '../core/rng';
import { valueNoise2, TAU, dist2 } from '../core/math';
import { P, shade, hexToRgb, mix, rgba } from '../gfx/palette';
import { skillIcon } from '../gfx/skillicons';
import { sculptProp, sculptTree } from '../gfx/worldart';
import { floraProp, floraTree, isFloraProp, isFloraTree, type FloraProp, type FloraTree } from '../gfx/flora';
import { HazardField } from './hazards';
import { extinguish } from './shrines';
import type { ShrineType, Site } from './siteplan';
import { language, localiseById } from '../i18n';
import { EN_BIOMES, EN_POIS } from '../data/en';
import { SHRINE_CELL, SiteField } from './sites';

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
  /** Ce qui pousse et traîne au sol ici : une plante n'existe que dans son biome. */
  flora: PropKind[];
  /** Monuments propres au biome : on ne les croise nulle part ailleurs. */
  monuments: ShrineType[];
  /** Gemmes plus généreuses. Absent = 1. */
  xpMul?: number;
  /** Assombrit l'écran : on voit moins loin. Absent = 0. */
  gloom?: number;
  /** Essences qui poussent ici. Vide = aucun arbre. */
  trees: TreeKind[];
  /** Densité d'arbres hors bosquet, 0..1. */
  treeDensity: number;
  /** Motifs de sol possibles ici, en plus du sol nu. */
  motifs: SolMotif[];
  /** Texte affiché à l'entrée dans le biome. */
  flavor: string;
}

export type PropKind = 'rock' | 'grave' | 'reed' | 'stump' | 'bone' | FloraProp;

/**
 * Familles d'arbres.
 *
 * Le décor n'avait qu'un seul élément arboré — la souche, haute de quatorze pixels — et un
 * seul type de prop par biome. Traverser un biome, c'était croiser mille fois la même
 * silhouette. Quatre familles, déclinées en variantes et en deux tailles, suffisent à ce
 * qu'on cesse de reconnaître le motif.
 */
export type TreeKind = 'pine' | 'oak' | 'willow' | 'burnt' | FloraTree;

/**
 * Motifs de sol.
 *
 * Le sol n'avait que quatre variantes par biome, ne différant que par les cailloux et les
 * touffes : à l'échelle d'une partie, on marche toujours sur la même chose. Un motif change
 * la lecture d'une zone entière, et c'est ce qui annonce qu'on arrive quelque part.
 *
 * `nu` est le sol de bruit d'origine, et reste majoritaire : un motif partout n'est plus un
 * motif.
 */
export type SolMotif = 'nu' | 'dallage' | 'pave' | 'labour' | 'vase' | 'cendre' | 'fouille';

export interface Tree {
  x: number;
  y: number;
  kind: TreeKind;
  variant: number;
  /** 0 = jeune, 1 = adulte. Deux tailles par variante, pour doubler la diversité à peu de frais. */
  grand: boolean;
}

export const BIOMES: Biome[] = [
  {
    id: 'moor',
    name: 'La Lande',
    ground: [P.soil, P.night, P.soilHi, '#25332c'],
    weights: {},
    moveMul: 1,
    mightMul: 1,
    props: 0.5,
    flora: ['heather', 'heather', 'gorse', 'rock'],
    monuments: ['windmill', 'well', 'cairn'],
    trees: ['oak'],
    treeDensity: 0.3,
    motifs: ['labour', 'dallage'],
    flavor: 'rien que de la bruyère morte',
  },
  {
    id: 'graveyard',
    name: 'Le Champ des Morts',
    ground: ['#191d2a', '#0e1119', '#242a3c', '#3a4152'],
    weights: { skeleton: 3.2, ghoul: 1.8, wraith: 2.4, damned: 1.6, bat: 0.5 },
    moveMul: 1,
    mightMul: 1,
    props: 0.7,
    flora: ['grave', 'blackrose', 'blackrose', 'rock'],
    monuments: ['ossuary', 'altar'],
    xpMul: 1.15,
    trees: ['cypress', 'cypress', 'oak'],
    treeDensity: 0.55,
    motifs: ['fouille', 'dallage'],
    flavor: 'on y a enterré trop de monde : +15 % d’expérience',
  },
  {
    id: 'mire',
    name: 'Le Marais',
    ground: ['#16211a', '#0d1410', '#1f2e22', '#2f4a2c'],
    weights: { zombie: 3.0, leech: 2.6, spitter: 2.2, spider: 1.4, rider: 0.3 },
    // Le marais ralentit : c'est le seul biome réellement dangereux à traverser.
    moveMul: 0.86,
    mightMul: 1,
    props: 0.75,
    flora: ['cattail', 'cattail', 'lily', 'reed'],
    monuments: ['hut', 'chapel'],
    trees: ['mangrove', 'mangrove', 'willow', 'mushroom'],
    treeDensity: 0.6,
    motifs: ['vase'],
    flavor: 'la tourbière vous retient, et eux aussi',
  },
  {
    id: 'ashes',
    name: 'Les Cendres',
    ground: ['#221a1c', '#140f11', '#2e2225', '#4a2c2c'],
    weights: { damned: 2.6, golem: 2.2, wolf: 1.5, crow: 1.6, zombie: 0.5 },
    moveMul: 1,
    // Compense le danger : la chaleur attise les armes.
    mightMul: 1.08,
    props: 0.55,
    flora: ['cinder', 'cinder', 'emberflower', 'bone'],
    monuments: ['pyre', 'obelisk'],
    trees: ['burnt'],
    treeDensity: 0.4,
    motifs: ['cendre', 'pave'],
    flavor: 'la chaleur attise vos armes : +8 % de dégâts',
  },
  {
    id: 'thicket',
    name: 'Les Bois Morts',
    ground: ['#141c18', '#0b110e', '#1d2a22', '#2a3a2a'],
    weights: { wolf: 3.0, spider: 2.4, crow: 2.2, bat: 1.6, skeleton: 0.6 },
    moveMul: 0.96,
    mightMul: 1,
    props: 0.9,
    flora: ['thornbush', 'fern', 'fern', 'stump'],
    monuments: ['hangtree', 'cairn'],
    gloom: 0.42,
    trees: ['pine', 'pine', 'burnt', 'mushroom'],
    treeDensity: 0.92,
    motifs: ['labour'],
    flavor: 'il fait nuit ici, et les ronces mordent',
  },
  {
    id: 'frost',
    name: 'Le Lac Gelé',
    ground: ['#1c2c3e', '#121e2c', '#2a4058', '#a8cce0'],
    weights: {},
    moveMul: 1,
    mightMul: 1,
    props: 0.55,
    flora: ['snowbush', 'snowbush', 'icecluster', 'rock'],
    monuments: ['colossus', 'obelisk'],
    trees: ['frostpine', 'frostpine', 'crystal'],
    treeDensity: 0.5,
    motifs: ['dallage'],
    flavor: 'sur la glace, on ne s’arrête pas quand on veut',
  },
  {
    id: 'lava',
    name: 'Les Coulées',
    ground: ['#1a1014', '#0e090c', '#2a161a', '#7e1a10'],
    weights: {},
    moveMul: 1,
    // La lave brûle tout ce qui marche : le héros, et la horde qu'il y attire.
    mightMul: 1.15,
    props: 0.6,
    flora: ['lavarock', 'lavarock', 'emberflower', 'cinder'],
    monuments: ['forge', 'pyre'],
    trees: ['obsidian', 'obsidian', 'burnt'],
    treeDensity: 0.42,
    motifs: ['cendre', 'pave'],
    flavor: 'la lave brûle tout ce qui marche : +15 % de dégâts',
  },
];

localiseById(BIOMES, EN_BIOMES);

export const BIOME_BY_ID = new Map(BIOMES.map((b) => [b.id, b]));

/**
 * Taille d'une région : assez large pour qu'on y entre, qu'on y reste, et qu'on en sorte. À 100 px/s,
 * il faut une bonne vingtaine de secondes pour traverser un biome.
 */
const REGION = 2600;
/** Déformation des frontières : sans elle, les régions seraient des polygones à bords droits. */
const WARP = 620;
const WARP_SCALE = 760;

/**
 * Un paquet par bloc de 4×4 régions, battu à la graine : les parts sont tenues dans chaque coin de la
 * carte, là où un simple tirage laissait des parties presque sans lave.
 */
const CHUNK = 4;
const REGION_DECK: readonly string[] = [
  'moor', 'moor', 'moor', 'moor', 'graveyard', 'graveyard', 'thicket', 'thicket',
  'mire', 'mire', 'frost', 'frost', 'ashes', 'ashes', 'lava', 'lava',
];
/** Autour du départ, un de chaque : tout se découvre dès la première partie. */
const FIRST_RING: readonly string[] = ['graveyard', 'thicket', 'mire', 'frost', 'ashes', 'lava', 'moor', 'moor'];

function shuffled(deck: readonly string[], seed: number): string[] {
  const out = [...deck];
  let h = seed;
  for (let i = out.length - 1; i > 0; i--) {
    h = cellSeed(h, i, 0x2f6e2b1);
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Le biome d'une case de région. */
function regionBiome(cx: number, cy: number): string {
  if (cx === 0 && cy === 0) return 'moor';
  if (Math.abs(cx) <= 1 && Math.abs(cy) <= 1) {
    const order = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    const at = order.findIndex(([x, y]) => x === cx && y === cy);
    return shuffled(FIRST_RING, biomeSeed ^ 0x51a3)[at]!;
  }
  const bx = Math.floor(cx / CHUNK), by = Math.floor(cy / CHUNK);
  const deck = shuffled(REGION_DECK, cellSeed(bx, by, biomeSeed ^ 0x1d872b41));
  return deck[(cy - by * CHUNK) * CHUNK + (cx - bx * CHUNK)]!;
}

interface Region {
  x: number;
  y: number;
  biome: Biome;
}

let biomeSeed = 0;
const regions = new Map<number, Region>();

/** Une région par case, jamais centrée : c'est ce décalage qui casse la grille. */
function regionOf(cx: number, cy: number): Region {
  const key = (cx + 0x4000) * 0x8000 + (cy + 0x4000);
  let r = regions.get(key);
  if (r) return r;
  const h = cellSeed(cx, cy, biomeSeed ^ 0x6c8e9cf5);
  const jx = ((h & 0xff) / 255 - 0.5) * 0.7, jy = (((h >>> 8) & 0xff) / 255 - 0.5) * 0.7;
  // Le départ est toujours en Lande : ni nuit, ni lave, ni glace avant la première arme digne de ce nom.
  const start = cx === 0 && cy === 0;
  r = {
    x: (cx + 0.5 + (start ? 0 : jx)) * REGION - REGION / 2,
    y: (cy + 0.5 + (start ? 0 : jy)) * REGION - REGION / 2,
    biome: BIOME_BY_ID.get(regionBiome(cx, cy))!,
  };
  regions.set(key, r);
  return r;
}

/** Tire une géographie pour cette graine : une partie ne se déroule jamais sur la même carte. */
export function seatBiomes(seed: number): void {
  biomeSeed = seed;
  regions.clear();
}

/** Le biome d'un point : celui de la région la plus proche, sur des coordonnées déformées. */
export function biomeAt(x: number, y: number): Biome {
  const wx = x + (valueNoise2(x / WARP_SCALE, y / WARP_SCALE, 1337) - 0.5) * WARP * 2;
  const wy = y + (valueNoise2(x / WARP_SCALE + 41.3, y / WARP_SCALE - 17.9, 991) - 0.5) * WARP * 2;
  const cx = Math.round(wx / REGION), cy = Math.round(wy / REGION);
  let best: Region | null = null;
  let bestD = Infinity;
  for (let j = cy - 1; j <= cy + 1; j++) {
    for (let i = cx - 1; i <= cx + 1; i++) {
      const r = regionOf(i, j);
      const d = (r.x - wx) ** 2 + (r.y - wy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = r;
      }
    }
  }
  return best!.biome;
}

// ---------------------------------------------------------------------------
// Points d'intérêt
// ---------------------------------------------------------------------------

export type PoiType = ShrineType;

export interface PoiDef {
  type: PoiType;
  name: string;
  hint: string;
  weight: number;
  /** Rayon d'activation : plus large que le socle de la structure, qui arrête le héros. */
  radius: number;
  color: string;
}

export const POI_DEFS: Record<PoiType, PoiDef> = {
  altar: { type: 'altar', name: 'Autel de Sang', hint: 'une relique vous attend', weight: 8, radius: 42, color: '#a855f7' },
  pyre: { type: 'pyre', name: 'Bûcher', hint: 'la flamme purifie', weight: 16, radius: 44, color: P.fire },
  obelisk: { type: 'obelisk', name: 'Obélisque', hint: 'la pierre vous prête sa force', weight: 14, radius: 44, color: P.ice },
  well: { type: 'well', name: 'Puits', hint: 'on y a jeté des pièces', weight: 18, radius: 42, color: P.gold },
  ossuary: { type: 'ossuary', name: 'Ossuaire', hint: 'quelque chose y dort', weight: 12, radius: 42, color: P.bone },
  chapel: { type: 'chapel', name: 'Chapelle Noyée', hint: 'un répit', weight: 7, radius: 44, color: P.linen },
  windmill: { type: 'windmill', name: 'Le Moulin', hint: 'le vent tourne', weight: 16, radius: 44, color: P.linen },
  hut: { type: 'hut', name: 'Cabane de la Sorcière', hint: 'une potion, un poison', weight: 14, radius: 44, color: P.poison },
  hangtree: { type: 'hangtree', name: 'L’Arbre aux Pendus', hint: 'ils tombent', weight: 16, radius: 44, color: P.bloodHi },
  forge: { type: 'forge', name: 'Forge de Lave', hint: 'une arme s’y retrempe', weight: 14, radius: 44, color: P.fire },
  colossus: { type: 'colossus', name: 'Le Colosse Gelé', hint: 'le froid se répand', weight: 16, radius: 44, color: P.ice },
  cairn: { type: 'cairn', name: 'Cairn', hint: 'des offrandes', weight: 20, radius: 42, color: P.steel },
};

if (language() === 'en') {
  for (const [id, def] of Object.entries(POI_DEFS)) Object.assign(def, EN_POIS[id]);
}

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
  site: Site;
}


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

/**
 * Murs proches, tels que le monde les consomme.
 *
 * Les ruines d'autrefois étaient des sprites isolés portant leurs rectangles. Tout ce qui bloque
 * le passage vient désormais des lieux, mais le format reste celui-ci : le monde n'a pas à savoir
 * d'où viennent ses murs.
 */
export interface Ruine {
  x: number;
  y: number;
  def: { murs: [number, number, number, number][] };
}

export interface Prop {
  x: number;
  y: number;
  kind: PropKind;
  variant: number;
}

/** Cellule de décor, plus fine que celle des POI. */
const PROP_CELL = 150;

/**
 * Cellule des arbres, plus large que celle des props.
 *
 * À 150 px, les arbres se seraient répartis aussi régulièrement que les cailloux et le semis
 * se serait lu comme un papier peint. À 220, chaque cellule porte zéro à trois arbres et les
 * vides existent encore.
 *
 * Les densités ont été relevées après coup : à 0,3 dans le Cimetière, on croisait deux arbres
 * par écran et l'ajout ne se remarquait pas. Le boisement doit se voir pour valoir la peine.
 */
const TREE_CELL = 220;

/**
 * Cellule des bosquets.
 *
 * Un second tirage, bien plus grossier, décide qu'une zone est un bosquet : la densité y est
 * multipliée par trois sur un disque. C'est ce qui crée des futaies denses et des clairières,
 * là où un semis uniforme ne donne qu'une moyenne partout.
 */
const GROVE_CELL = 900;
const GROVE_RADIUS = 250;

/** Cellule du décor destructible. Large : ces objets doivent se croiser rarement. */
const DESTR_CELL = 260;

// ---------------------------------------------------------------------------
// Sprites du terrain
// ---------------------------------------------------------------------------

const groundCache = new Map<string, HTMLCanvasElement>();
const propCache = new Map<string, HTMLCanvasElement>();

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
/**
 * Plafond de la cache de tuiles.
 *
 * Cinq biomes × quatre variantes × sept motifs feraient 140 tuiles de 128 pixels, soit une
 * dizaine de mégaoctets une fois rastérisées — pour un jeu dont le tas mesuré tient en sept.
 * La génération est donc **paresseuse** et la cache bornée : seules les tuiles réellement
 * traversées existent, et les plus anciennes sortent.
 */
const GROUND_CACHE_MAX = 40;

export const FRINGE_SIDES = [
  { id: 0, dx: 1, dy: 0 }, { id: 1, dx: -1, dy: 0 }, { id: 2, dx: 0, dy: 1 }, { id: 3, dx: 0, dy: -1 },
] as const;

/** Profondeur maximale de la frange, en pixels. */
const FRINGE_DEPTH = 58;
const fringeCache = new Map<string, HTMLCanvasElement>();

/**
 * Sol d'un biome, découpé en frange irrégulière le long d'un bord de tuile.
 *
 * Le bruit ne dépend que de la position **le long** du bord, et il est périodique : deux
 * franges voisines se raccordent, et un coin reste continu.
 */
export function biomeFringe(biome: Biome, side: number): HTMLCanvasElement {
  const key = `${biome.id}:${side}`;
  const hit = fringeCache.get(key);
  if (hit) return hit;
  const S = GROUND_TILE;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(groundTile(biome), 0, 0);
  const img = ctx.getImageData(0, 0, S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const along = side < 2 ? y : x;
      const depth = side === 0 ? S - 1 - x : side === 1 ? x : side === 2 ? S - 1 - y : y;
      const reach = FRINGE_DEPTH * (0.2 +
        periodicNoise(along / 32, 0.5, S / 32, 311) * 0.55 +
        periodicNoise(along / 8, 0.5, S / 8, 733) * 0.45);
      if (depth > reach) img.data[(y * S + x) * 4 + 3] = 0;
    }
  }
  ctx.putImageData(img, 0, 0);
  fringeCache.set(key, c);
  return c;
}

export function groundTile(biome: Biome, variant = 0, motif: SolMotif = 'nu'): HTMLCanvasElement {
  const key = `${biome.id}:${variant}:${motif}`;
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
      /*
       * Jamais de trame ici. Le sol couvre tout l'écran et défile par pas de un ou deux pixels :
       * un damier s'inverse à chaque pas impair, et l'écran entier clignote. On croit alors que
       * la caméra tremble, alors qu'elle n'a pas bougé.
       */
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

  dessinerMotif(ctx, motif, S, biome, rng);

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

  // Éviction : la première clé insérée est la plus ancienne, les Map de JavaScript
  // conservant l'ordre d'insertion.
  if (groundCache.size >= GROUND_CACHE_MAX) {
    const vieille = groundCache.keys().next().value;
    if (vieille !== undefined) groundCache.delete(vieille);
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
/**
 * Motif du sol à une tuile donnée.
 *
 * Le choix se fait sur un bruit **grossier** — période de 9 tuiles, soit un peu plus de
 * 1 100 pixels — pour que les zones à motif fassent la taille d'un lieu et non d'un carré.
 * Un motif qui changerait à chaque tuile se lirait comme du damier, pas comme un terrain.
 *
 * Le sol nu reste majoritaire : au-delà d'un seuil, le motif cesse d'être un événement.
 */
/**
 * Force de la route à une tuile donnée, entre 0 et 1.
 *
 * Les routes suivent une **ligne de niveau** d'un champ de bruit : elles serpentent donc
 * naturellement, sans qu'on ait à tracer un chemin. Une route en droite se lirait comme une
 * frontière de carte, pas comme un chemin creusé par l'usage.
 *
 * Dans un monde infini et sans carte, une route est un repère de navigation : savoir qu'on
 * la suit donne un sens à la marche.
 */
export function routeAt(tx: number, ty: number): number {
  // Deux réseaux d'orientations différentes, pour que des routes se croisent.
  const a = valueNoise2(tx / 17, ty / 29, 0x51a7);
  const b = valueNoise2(tx / 31 + 5, ty / 13 - 3, 0x9c34);
  const d = Math.min(Math.abs(a - 0.5), Math.abs(b - 0.5));
  // La route est la bande étroite où le champ traverse sa ligne de niveau.
  /*
   * Le seuil décide de la largeur du réseau. Mesuré à 0,028 : 11 % des tuiles portaient une
   * route, ce qui est un quadrillage, pas un chemin. À 0,010 on retombe autour de 4 %, soit
   * une route croisée toutes les quelques minutes de marche — assez pour qu'elle serve de
   * repère, assez rare pour qu'en trouver une compte.
   */
  return d < 0.010 ? 1 - d / 0.010 : 0;
}

export function motifAt(tx: number, ty: number): SolMotif {
  // Une route prime sur le motif du biome : c'est elle qu'on doit voir.
  if (routeAt(tx, ty) > 0.35) return 'pave';
  const biome = biomeAtTile(tx, ty);
  if (biome.motifs.length === 0) return 'nu';
  const n = valueNoise2(tx / 9, ty / 9, 0x3a1f);
  if (n < 0.62) return 'nu';
  const i = Math.floor(valueNoise2(tx / 23 + 11, ty / 23 - 7, 0x77c2) * biome.motifs.length);
  return biome.motifs[Math.min(biome.motifs.length - 1, i)] ?? 'nu';
}

/**
 * Applique un motif par-dessus le sol de bruit.
 *
 * Le motif n'efface pas la texture dessous : il la recouvre partiellement, en gardant sa
 * variation. Un aplat parfaitement régulier trahirait la tuile et ferait réapparaître la
 * grille de 128 pixels que tout le reste s'emploie à cacher.
 */
function dessinerMotif(
  ctx: CanvasRenderingContext2D, motif: SolMotif, S: number, biome: Biome, rng: Rng,
): void {
  const [, dark, light, detail] = biome.ground;

  switch (motif) {
    case 'dallage': {
      // Carreaux de 16 px, joints creusés, un quart d'entre eux fêlés.
      const D = 16;
      for (let y = 0; y < S; y += D) {
        for (let x = 0; x < S; x += D) {
          ctx.fillStyle = rgba(light, 0.1 + rng.range(0, 0.07));
          ctx.fillRect(x + 1, y + 1, D - 2, D - 2);
          ctx.fillStyle = rgba(dark, 0.5);
          ctx.fillRect(x, y, D, 1);
          ctx.fillRect(x, y, 1, D);
          if (rng.next() < 0.26) {
            // Fêlure : une diagonale brisée, jamais une droite.
            ctx.fillStyle = rgba(dark, 0.6);
            let fx = x + rng.int(2, D - 3);
            let fy = y + 2;
            for (let k = 0; k < D - 4; k++) {
              ctx.fillRect(fx, fy + k, 1, 1);
              fx += rng.next() < 0.4 ? (rng.next() < 0.5 ? -1 : 1) : 0;
            }
          }
        }
      }
      break;
    }

    case 'pave': {
      // Galets irréguliers en rangs décalés : l'appareil en quinconce évite la grille.
      const D = 9;
      for (let ry = 0, r = 0; ry < S; ry += D, r++) {
        const dec = (r % 2) * (D / 2);
        for (let x = -D; x < S + D; x += D) {
          const cx = x + dec + rng.spread(1.2);
          const cy = ry + rng.spread(1.2);
          ctx.fillStyle = rgba(light, 0.12 + rng.range(0, 0.1));
          ctx.fillRect(cx + 1, cy + 1, D - 2, D - 2);
          ctx.fillStyle = rgba(dark, 0.45);
          ctx.fillRect(cx, cy, D - 1, 1);
          ctx.fillRect(cx, cy, 1, D - 1);
        }
      }
      break;
    }

    case 'labour': {
      // Sillons parallèles, légèrement obliques. L'obliquité est ce qui les empêche de se
      // confondre avec les bords de la tuile.
      for (let i = -S; i < S * 2; i += 7) {
        ctx.fillStyle = rgba(dark, 0.34);
        for (let y = 0; y < S; y++) ctx.fillRect(i + y * 0.28, y, 3, 1);
        ctx.fillStyle = rgba(light, 0.14);
        for (let y = 0; y < S; y++) ctx.fillRect(i + 3 + y * 0.28, y, 1, 1);
      }
      break;
    }

    case 'vase': {
      // Flaques sombres à reflet clair, et herbes couchées.
      for (let i = 0; i < 7; i++) {
        const x = rng.int(0, S);
        const y = rng.int(0, S);
        const rx = rng.range(7, 18);
        const ry = rx * rng.range(0.4, 0.7);
        ctx.fillStyle = rgba(dark, 0.5);
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = rgba(light, 0.22);
        ctx.fillRect(x - rx * 0.5, y - ry * 0.35, rx * 0.8, 1);
      }
      for (let i = 0; i < 26; i++) {
        const x = rng.int(0, S);
        const y = rng.int(0, S);
        ctx.fillStyle = rgba(detail, 0.3);
        ctx.fillRect(x, y, rng.int(3, 7), 1);
      }
      break;
    }

    case 'cendre': {
      // Croûte craquelée : un réseau de fissures claires qui se ramifient.
      for (let i = 0; i < 9; i++) {
        let x = rng.int(0, S);
        let y = rng.int(0, S);
        let a = rng.range(0, TAU);
        ctx.fillStyle = rgba(light, 0.3);
        for (let k = 0; k < 40; k++) {
          x += Math.cos(a);
          y += Math.sin(a);
          a += rng.spread(0.35);
          ctx.fillRect(((x % S) + S) % S, ((y % S) + S) % S, 1, 1);
        }
      }
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = rgba(dark, 0.3);
        ctx.fillRect(rng.int(0, S), rng.int(0, S), rng.int(3, 8), rng.int(2, 5));
      }
      break;
    }

    case 'fouille': {
      // Terre retournée : monticules irréguliers, ombre en bas, lumière en haut.
      for (let i = 0; i < 16; i++) {
        const x = rng.int(0, S);
        const y = rng.int(0, S);
        const w = rng.int(6, 16);
        const h = rng.int(3, 7);
        ctx.fillStyle = rgba(dark, 0.4);
        ctx.beginPath();
        ctx.ellipse(x, y + 1, w / 2, h / 2, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = rgba(light, 0.2);
        ctx.beginPath();
        ctx.ellipse(x, y - 1, w / 2.4, h / 2.6, 0, 0, TAU);
        ctx.fill();
      }
      break;
    }

    case 'nu':
      break;
  }
}

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
const treeCache = new Map<string, HTMLCanvasElement>();

/** Nombre de variantes de silhouette par essence. */
export const TREE_VARIANTS = 4;

/**
 * Sprite d'arbre.
 *
 * Vu de haut et à distance, un arbre se reconnaît à son **contour**, jamais à son écorce.
 * Les quatre essences se distinguent donc par la silhouette avant la couleur : le pin est
 * étroit et étagé, le chêne large et bas, le saule penché et retombant, le calciné nu et
 * fendu. Un joueur doit pouvoir les trier en niveaux de gris.
 *
 * Le houppier est plus clair que le tronc, et son bord droit porte la même rasante froide
 * que les créatures. La cohérence d'éclairage compte plus que la justesse botanique : c'est
 * elle qui fait qu'un arbre et une goule ont l'air d'appartenir au même monde.
 *
 * Plafond à 80 px de haut. Au-delà, un arbre masque le joueur — intolérable dans un jeu où
 * l'on esquive.
 */
export function treeSprite(
  kind: TreeKind, variant: number, grand: boolean, biome: Biome,
): HTMLCanvasElement {
  if (isFloraTree(kind)) return floraTree(kind, variant, grand);
  const key = `${kind}:${variant}:${grand ? 'g' : 'p'}:${biome.id}`;
  const hit = treeCache.get(key);
  if (hit) return hit;

  const VERT: Record<Exclude<TreeKind, FloraTree>, string> = {
    pine: '#2f4a35', oak: '#3d4f2c', willow: '#385238', burnt: '#3a3230',
  };
  // Le feuillage se mêle au détail du sol : prendre `ground[3]` seul donnait un houppier gris
  // dans le Cimetière, où l'on lisait un rocher posé sur un tronc.
  const feuille = mix(VERT[kind], biome.ground[3], 0.28);
  const ech = grand ? 1 : 0.68;
  const W = Math.round((kind === 'oak' ? 52 : kind === 'willow' ? 46 : 34) * ech);
  const H = Math.round((kind === 'oak' ? 62 : kind === 'willow' ? 58 : 70) * ech);
  const c = sculptTree(kind, W, H, feuille, cellSeed(variant * 31 + (grand ? 7 : 0), kind.length * 13, 91), ech);
  treeCache.set(key, c);
  return c;
}

export function propSprite(kind: PropKind, variant: number, biome: Biome): HTMLCanvasElement {
  if (isFloraProp(kind)) return floraProp(kind, variant);
  const key = `${kind}:${variant}:${biome.id}`;
  const hit = propCache.get(key);
  if (hit) return hit;

  const c = sculptProp(kind, biome.ground[3], cellSeed(variant, kind.length, 5));
  propCache.set(key, c);
  return c;
}

/** La pastille d'une structure, au bord de l'écran et sur la planche. */
export function poiIcon(type: PoiType): HTMLCanvasElement {
  return skillIcon('loot', `shrine${type[0]!.toUpperCase()}${type.slice(1)}`);
}

// ---------------------------------------------------------------------------
// Gestionnaire de terrain
// ---------------------------------------------------------------------------

/** Chaque biome a ses monuments : on ne les voit pas tous sur la carte, il faut aller les chercher. */
function pickShrine(rng: Rng, x: number, y: number): PoiType | null {
  const biome = biomeAt(x, y);
  // Sur une frontière, le monument n'appartiendrait à personne : autant le garder pour le cœur du biome.
  const M = 130;
  if ([[M, 0], [-M, 0], [0, M], [0, -M]].some(([dx, dy]) => biomeAt(x + dx!, y + dy!) !== biome)) return null;
  const list = biome.monuments;
  return list[rng.weighted(list.map((t) => POI_DEFS[t].weight))] ?? list[0]!;
}

export class Terrain {
  /** POI générés, indexés par clé de cellule. Ne contient que les cellules déjà visitées. */
  private pois = new Map<string, Poi | null>();
  /** Décor généré, indexé par clé de cellule. */
  private props = new Map<string, Prop[]>();
  private trees = new Map<string, Tree[]>();

  /** Biome courant du joueur, pour l'annonce d'entrée et les effets passifs. */
  currentBiome: Biome = BIOMES[0]!;
  /** POI découverts et activés, seulement pour les statistiques de fin. */
  activated = 0;

  /** Château, villages et vestiges de cette partie : `sites.list()` en donne la liste. */
  readonly sites: SiteField;
  /** Lave, glace, tourbière, ronces : ce que le sol fait à ceux qui le foulent. */
  readonly hazards: HazardField;

  constructor(private readonly seed: number) {
    seatBiomes(seed);
    this.sites = new SiteField(seed, pickShrine);
    this.hazards = new HazardField(seed, (x, y) => biomeAt(x, y).id, (x, y) => this.sites.isClear(x, y));
  }

  /** POI d'une cellule, généré paresseusement et mémorisé. */
  private poiAt(cx: number, cy: number): Poi | null {
    const key = `${cx},${cy}`;
    const hit = this.pois.get(key);
    if (hit !== undefined) return hit;

    const site = this.sites.shrineAt(cx, cy);
    if (!site?.shrine) {
      this.pois.set(key, null);
      return null;
    }
    const def = POI_DEFS[site.shrine.type];
    const poi: Poi = {
      key, type: def.type, def, x: site.shrine.x, y: site.shrine.y, used: false, site,
      anim: new Rng(cellSeed(cx, cy, this.seed)).range(0, 4), flash: 0,
    };
    this.pois.set(key, poi);
    return poi;
  }

  /** Décor d'une cellule, généré paresseusement. */
  /**
   * Densité d'arbres en un point, bosquets compris.
   *
   * On interroge les neuf cellules de bosquet voisines : un bosquet dont le centre tombe
   * dans la cellule d'à côté doit quand même déborder ici, sinon les futaies s'arrêtent net
   * sur une frontière invisible.
   */
  private groveMul(x: number, y: number): number {
    const c0x = Math.floor((x - GROVE_RADIUS) / GROVE_CELL);
    const c1x = Math.floor((x + GROVE_RADIUS) / GROVE_CELL);
    const c0y = Math.floor((y - GROVE_RADIUS) / GROVE_CELL);
    const c1y = Math.floor((y + GROVE_RADIUS) / GROVE_CELL);
    let mul = 1;
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const rng = new Rng(cellSeed(cx, cy, this.seed ^ 0x2f7d19a3));
        if (rng.next() > 0.3) continue;                    // trois cellules sur dix
        const gx = cx * GROVE_CELL + rng.range(0, GROVE_CELL);
        const gy = cy * GROVE_CELL + rng.range(0, GROVE_CELL);
        const d = Math.hypot(x - gx, y - gy);
        if (d > GROVE_RADIUS) continue;
        // Le bosquet s'estompe vers son bord : une futaie à limite franche se voit.
        mul = Math.max(mul, 1 + 2.4 * (1 - d / GROVE_RADIUS) ** 1.4);
      }
    }
    return mul;
  }

  private treesAt(cx: number, cy: number): Tree[] {
    const key = `${cx},${cy}`;
    const hit = this.trees.get(key);
    if (hit) return hit;

    const rng = new Rng(cellSeed(cx, cy, this.seed ^ 0x1c9e7b45));
    const bx = cx * TREE_CELL + TREE_CELL / 2;
    const by = cy * TREE_CELL + TREE_CELL / 2;
    const biome = biomeAt(bx, by);

    const out: Tree[] = [];
    if (biome.trees.length > 0) {
      // Un village dégage la vue : trois fois moins d'arbres au centre. Sans cela, les
      // maisons disparaîtraient derrière la végétation et le lieu ne se lirait pas.
      const vil = 1 - this.villageForce(bx, by) * 0.72;
      const densite = Math.min(0.96, biome.treeDensity * this.groveMul(bx, by) * vil);
      const n = rng.next() < densite ? rng.int(1, 3) : 0;
      for (let i = 0; i < n; i++) {
        const x = cx * TREE_CELL + rng.range(0, TREE_CELL);
        const y = cy * TREE_CELL + rng.range(0, TREE_CELL);
        const kind = biome.trees[rng.int(0, biome.trees.length - 1)]!;
        const variant = rng.int(0, TREE_VARIANTS - 1);
        const grand = rng.next() < 0.55;
        // Les tirages restent faits avant le filtre : le reste du semis ne bouge pas.
        if (!this.sites.isClear(x, y) && !this.hazards.at(x, y)) out.push({ x, y, kind, variant, grand });
      }
    }
    this.trees.set(key, out);
    return out;
  }

  private treeBuf: Tree[] = [];
  /**
   * Arbres proches, **triés du plus haut au plus bas** sur l'écran.
   *
   * Sans tri, un arbre du fond se dessine par-dessus un arbre du premier plan et la
   * profondeur s'effondre. Le tampon est réutilisé : ne pas le conserver.
   */
  treesNear(x: number, y: number, radius: number): Tree[] {
    this.treeBuf.length = 0;
    const c0x = Math.floor((x - radius) / TREE_CELL);
    const c1x = Math.floor((x + radius) / TREE_CELL);
    const c0y = Math.floor((y - radius) / TREE_CELL);
    const c1y = Math.floor((y + radius) / TREE_CELL);
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        for (const t of this.treesAt(cx, cy)) this.treeBuf.push(t);
      }
    }
    this.treeBuf.sort((a, b) => a.y - b.y);
    return this.treeBuf;
  }

  /**
   * Décor destructible : brasero, jarre, reliquaire, sarcophage.
   *
   * Semé comme les props, mais bien plus rare et sur une cellule large : ces objets doivent
   * se remarquer, donc se croiser rarement. La clé de cellule sert d'identité — c'est elle
   * que le monde retient une fois l'objet brisé, pour qu'il ne repousse pas.
   */
  destructiblesNear(x: number, y: number, radius: number): { x: number; y: number; kind: string; key: string }[] {
    const out: { x: number; y: number; kind: string; key: string }[] = [];
    const c0x = Math.floor((x - radius) / DESTR_CELL);
    const c1x = Math.floor((x + radius) / DESTR_CELL);
    const c0y = Math.floor((y - radius) / DESTR_CELL);
    const c1y = Math.floor((y + radius) / DESTR_CELL);
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const rng = new Rng(cellSeed(cx, cy, this.seed ^ 0x6d3ac71f));
        if (rng.next() > 0.34) continue;
        const px = cx * DESTR_CELL + rng.range(0, DESTR_CELL);
        const py = cy * DESTR_CELL + rng.range(0, DESTR_CELL);
        if (this.sites.isClear(px, py)) continue;
        const biome = biomeAt(px, py);
        // Le sarcophage n'appartient qu'au Cimetière : c'est ce qui donne à ce biome une
        // récompense propre, et une raison d'y rester malgré le danger.
        const t = rng.next();
        const kind = biome.id === 'graveyard' && t < 0.22 ? 'sarcophagus'
          : t < 0.12 ? 'reliquary'
          : t < 0.56 ? 'brazier'
          : 'jar';
        out.push({ x: px, y: py, kind, key: `${cx},${cy}` });
      }
    }
    return out;
  }

  /** Emprise du village en un point, de 0 (dehors) à 1 (sur la place). */
  villageForce(x: number, y: number): number {
    return this.sites.villageForce(x, y);
  }

  private readonly wallBuf: [number, number, number, number][] = [];
  private readonly wallRuine: Ruine[] = [{ x: 0, y: 0, def: { murs: this.wallBuf } }];

  /**
   * Murs proches. Tampon réutilisé, ne pas conserver.
   *
   * La marge couvre l'anneau d'apparition de la horde : un ennemi né à six cents pixels doit déjà
   * rencontrer les murs, sinon il traverse une enceinte avant que le monde ne l'en informe.
   */
  ruinesNear(x: number, y: number, radius: number): Ruine[] {
    this.wallBuf.length = 0;
    this.sites.wallsNear(x, y, radius + 300, this.wallBuf);
    return this.wallRuine;
  }

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
      const x = cx * PROP_CELL + rng.range(0, PROP_CELL);
      const y = cy * PROP_CELL + rng.range(0, PROP_CELL);
      const variant = rng.int(0, 3);
      const kind = biome.flora[rng.int(0, biome.flora.length - 1)]!;
      if (!this.sites.isClear(x, y) && !this.hazards.at(x, y)) out.push({ x, y, kind, variant });
    }
    this.props.set(key, out);
    return out;
  }

  /** POI dans un rayon autour d'un point. Tampon réutilisé, ne pas conserver. */
  private poiBuf: Poi[] = [];
  poisNear(x: number, y: number, radius: number): Poi[] {
    this.poiBuf.length = 0;
    const c0x = Math.floor((x - radius) / SHRINE_CELL);
    const c1x = Math.floor((x + radius) / SHRINE_CELL);
    const c0y = Math.floor((y - radius) / SHRINE_CELL);
    const c1y = Math.floor((y + radius) / SHRINE_CELL);
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
    this.sites.update(px, py, dt);

    let triggered: Poi | null = null;
    for (const poi of this.poisNear(px, py, 420)) {
      poi.anim += dt;
      if (poi.flash > 0) poi.flash -= dt;
      if (poi.used || triggered) continue;
      const r = poi.def.radius;
      if (dist2(px, py, poi.x, poi.y) < r * r) {
        poi.used = true;
        poi.flash = 1;
        extinguish(poi.site);
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
      if (poi) {
        poi.used = true;
        extinguish(poi.site);
      }
    }
  }
}
