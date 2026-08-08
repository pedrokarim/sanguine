import { Rng } from '../core/rng';
import { valueNoise2, TAU, dist2 } from '../core/math';
import { P, shade, hexToRgb, mix, rgba } from '../gfx/palette';
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
  /** Essences qui poussent ici. Vide = aucun arbre. */
  trees: TreeKind[];
  /** Densité d'arbres hors bosquet, 0..1. */
  treeDensity: number;
  /** Motifs de sol possibles ici, en plus du sol nu. */
  motifs: SolMotif[];
  /** Texte affiché à l'entrée dans le biome. */
  flavor: string;
}

export type PropKind = 'rock' | 'grave' | 'reed' | 'stump' | 'bone';

/**
 * Familles d'arbres.
 *
 * Le décor n'avait qu'un seul élément arboré — la souche, haute de quatorze pixels — et un
 * seul type de prop par biome. Traverser un biome, c'était croiser mille fois la même
 * silhouette. Quatre familles, déclinées en variantes et en deux tailles, suffisent à ce
 * qu'on cesse de reconnaître le motif.
 */
export type TreeKind = 'pine' | 'oak' | 'willow' | 'burnt';

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
/**
 * Ruines : des bâtiments, pas des bornes.
 *
 * De 80 à 220 pixels, elles arrêtent le joueur et les ennemis terrestres. Elles
 * transforment le terrain en géographie : on contourne, on s'y adosse, on s'y fait piéger.
 *
 * La collision est décrite par une **liste de rectangles alignés sur les axes**, jamais par
 * la silhouette du sprite. Trois à six par ruine suffisent, le test reste trivial, et
 * surtout on garde la main sur les ouvertures.
 *
 * Règle absolue : **toute ruine a au moins deux ouvertures**. Un joueur ne doit jamais
 * pouvoir être coincé entre un mur et la horde sans issue — ce serait une mort qu'il n'a pas
 * commise.
 */
export type RuineType = 'mur' | 'angle' | 'nef' | 'tour' | 'ferme' | 'pontons';

export interface RuineDef {
  type: RuineType;
  w: number;
  h: number;
  /** Rectangles bloquants, en coordonnées locales depuis le coin haut-gauche. */
  murs: [number, number, number, number][];
  /** Biomes où elle peut paraître. Vide = partout. */
  biomes: string[];
}

export const RUINE_DEFS: RuineDef[] = [
  {
    type: 'mur', w: 120, h: 44, biomes: [],
    // Une brèche au milieu : le mur se traverse, mais il faut viser.
    murs: [[0, 26, 46, 14], [74, 26, 46, 14]],
  },
  {
    type: 'angle', w: 92, h: 92, biomes: ['moor', 'graveyard'],
    // Deux murs en L, chacun percé — les deux ouvertures sont sur des côtés différents.
    murs: [[0, 70, 34, 18], [56, 70, 36, 18], [0, 0, 16, 40], [0, 58, 16, 30]],
  },
  {
    type: 'nef', w: 216, h: 120, biomes: ['graveyard'],
    // Deux rangées de colonnes : on circule entre elles, jamais à travers.
    murs: [
      [14, 40, 18, 18], [64, 40, 18, 18], [134, 40, 18, 18], [184, 40, 18, 18],
      [14, 92, 18, 18], [64, 92, 18, 18], [134, 92, 18, 18], [184, 92, 18, 18],
    ],
  },
  {
    type: 'tour', w: 84, h: 112, biomes: ['thicket', 'graveyard'],
    // Cylindre éventré : la face avant est ouverte, on peut entrer.
    murs: [[6, 40, 20, 66], [58, 40, 20, 66], [6, 40, 72, 14]],
  },
  {
    type: 'ferme', w: 160, h: 104, biomes: ['ashes', 'moor'],
    // Quatre murs bas, deux portes.
    murs: [[0, 30, 58, 16], [98, 30, 62, 16], [0, 46, 16, 58], [144, 46, 16, 58], [0, 88, 62, 16], [104, 88, 56, 16]],
  },
  {
    type: 'pontons', w: 176, h: 72, biomes: ['mire'],
    // Pilotis épars : ils gênent sans enfermer, ce qui convient à un marais.
    murs: [[10, 20, 12, 12], [56, 34, 12, 12], [104, 18, 12, 12], [148, 40, 12, 12], [30, 52, 12, 12]],
  },
];

export const RUINE_BY_TYPE = new Map(RUINE_DEFS.map((r) => [r.type, r]));

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
    props: 0.35,
    propKind: 'rock',
    trees: ['oak'],
    treeDensity: 0.42,
    motifs: ['labour', 'dallage'],
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
    trees: ['oak', 'pine'],
    treeDensity: 0.55,
    motifs: ['fouille', 'dallage'],
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
    trees: ['willow'],
    treeDensity: 0.6,
    motifs: ['vase'],
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
    trees: ['burnt'],
    treeDensity: 0.48,
    motifs: ['cendre', 'pave'],
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
    trees: ['pine', 'burnt'],
    treeDensity: 0.92,
    motifs: ['labour'],
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

export interface Ruine {
  x: number;
  y: number;
  def: RuineDef;
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

/**
 * Cellule des ruines.
 *
 * Très large : une ruine est un événement de terrain, pas un meuble. À 1 100 pixels et une
 * chance sur trois, on en croise une toutes les deux ou trois minutes de marche.
 */
const RUINE_CELL = 1100;

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
/**
 * Plafond de la cache de tuiles.
 *
 * Cinq biomes × quatre variantes × sept motifs feraient 140 tuiles de 128 pixels, soit une
 * dizaine de mégaoctets une fois rastérisées — pour un jeu dont le tas mesuré tient en sept.
 * La génération est donc **paresseuse** et la cache bornée : seules les tuiles réellement
 * traversées existent, et les plus anciennes sortent.
 */
const GROUND_CACHE_MAX = 40;

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
  const key = `${kind}:${variant}:${grand ? 'g' : 'p'}:${biome.id}`;
  const hit = treeCache.get(key);
  if (hit) return hit;

  const rng = new Rng(cellSeed(variant * 31 + (grand ? 7 : 0), kind.length * 13, 91));
  const bois = kind === 'burnt' ? '#241d1c' : '#3a2a20';
  /*
   * Le feuillage tire sa couleur d'une teinte propre à l'essence, mêlée au détail du sol.
   * Prendre `ground[3]` seul donnait un houppier gris dans le Cimetière : on y lisait un
   * rocher posé sur un tronc, pas un arbre.
   */
  const VERT: Record<TreeKind, string> = {
    pine: '#2f4a35', oak: '#3d4f2c', willow: '#385238', burnt: '#3a3230',
  };
  const feuille = mix(VERT[kind], biome.ground[3], 0.28);

  const cols = [
    shade(bois, -0.65),      // 0 contour
    shade(bois, -0.2),       // 1 tronc, ombre
    bois,                    // 2 tronc
    shade(feuille, -0.42),   // 3 houppier, ombre
    feuille,                 // 4 houppier
    shade(feuille, 0.3),     // 5 houppier, lumière
    mix(shade(feuille, 0.4), P.ice, 0.45),  // 6 rasante froide
  ];

  const ech = grand ? 1 : 0.68;
  const W = Math.round((kind === 'oak' ? 52 : kind === 'willow' ? 46 : 34) * ech);
  const H = Math.round((kind === 'oak' ? 62 : kind === 'willow' ? 58 : 70) * ech);
  const p = new Pix(W, H);
  const cx = W / 2 - 0.5;
  const pied = H - 1;

  /** Tronc courbe, de la base vers la cime. `pente` incline, `ep` donne l'épaisseur au pied. */
  const tronc = (haut: number, pente: number, ep: number): [number, number] => {
    for (let k = 0; k <= haut; k++) {
      const t = k / haut;
      const x = cx + pente * t * t * W * 0.3;
      const e = Math.max(1, ep * (1 - t * 0.55));
      for (let i = -e; i <= e; i++) p.set(x + i, pied - k, i > e * 0.2 ? 1 : 2);
    }
    return [cx + pente * W * 0.3, pied - haut];
  };

  switch (kind) {
    case 'pine': {
      // Étages triangulaires décroissants. Les largeurs sont tirées au sort : un sapin
      // parfaitement régulier se lit comme un pictogramme, pas comme un arbre.
      const [tx, ty] = tronc(H * 0.9, rng.spread(0.12), 2.2 * ech);
      const etages = 5;
      for (let e = 0; e < etages; e++) {
        const t = e / (etages - 1);
        const y = ty + H * 0.08 + t * H * 0.7;
        const demi = W * 0.46 * (0.35 + t * 0.65) * (0.82 + rng.range(0, 0.36));
        const ep = Math.max(2, H * 0.1);
        for (let j = 0; j <= ep; j++) {
          const d = demi * (0.3 + (j / ep) * 0.7);
          for (let x = -d; x <= d; x++) {
            if (rng.next() < 0.07) continue;         // trouées dans le feuillage
            p.set(tx + x, y + j, x < -d * 0.3 ? 5 : x > d * 0.35 ? 3 : 4);
          }
        }
      }
      break;
    }

    case 'oak': {
      // Houppier large et bas, fait de trois masses qui se chevauchent : une seule ellipse
      // donnerait un champignon.
      const [tx, ty] = tronc(H * 0.52, rng.spread(0.16), 3.2 * ech);
      // Branches maîtresses, visibles sous le feuillage.
      for (const dir of [-1, 1]) {
        p.limb(tx, ty + H * 0.06, tx + dir * W * 0.26, ty - H * 0.06, 2 * ech, 2);
      }
      /*
       * Le houppier est fait de grappes qui se chevauchent, et son bord est rongé au hasard.
       * Trois ellipses pleines donnaient une masse lisse qu'on lisait comme un rocher : à
       * cette distance, c'est l'irrégularité du contour qui dit « feuillage ».
       */
      for (const [dx, dy, r] of [[-0.24, 0.02, 0.34], [0.26, 0.05, 0.32], [0, -0.1, 0.4]]) {
        p.ellipse(tx + dx * W, ty + dy * H, W * r, H * r * 0.55, 4);
      }
      for (let k = 0; k < 22; k++) {
        const a = rng.range(0, TAU);
        const rr = 0.72 + rng.range(0, 0.34);
        p.ellipse(tx + Math.cos(a) * W * 0.34 * rr, ty + Math.sin(a) * H * 0.2 * rr,
          W * 0.1, H * 0.06, rng.next() < 0.45 ? 5 : 4);
      }
      // Trouées : quelques creux sombres qui laissent deviner les branches.
      for (let k = 0; k < 7; k++) {
        p.ellipse(tx + rng.spread(W * 0.3), ty + rng.range(0, H * 0.16),
          W * 0.06, H * 0.04, 3);
      }
      p.ellipse(tx - W * 0.22, ty - H * 0.15, W * 0.16, H * 0.1, 5);
      break;
    }

    case 'willow': {
      // Tronc franchement penché, ramure qui retombe en rideau jusqu'au sol.
      const pente = rng.next() < 0.5 ? -0.5 : 0.5;
      const [tx, ty] = tronc(H * 0.5, pente, 2.8 * ech);
      p.ellipse(tx, ty, W * 0.34, H * 0.16, 4);
      // Les rideaux : des traits verticaux de longueurs inégales. C'est leur irrégularité
      // qui fait le saule ; alignés, ils font une frange de rideau de douche.
      const n = Math.round(9 * ech) + 3;
      for (let i = 0; i < n; i++) {
        const x = tx + (i / (n - 1) - 0.5) * W * 0.78;
        const l = H * (0.2 + rng.range(0, 0.3));
        for (let k = 0; k < l; k++) {
          const xx = x + Math.sin(k * 0.22 + i) * 1.2;
          p.set(xx, ty + H * 0.08 + k, k < l * 0.3 ? 4 : 3);
        }
      }
      p.ellipse(tx - W * 0.16, ty - H * 0.04, W * 0.14, H * 0.07, 5);
      break;
    }

    case 'burnt': {
      // Fût nu, fendu, aux branches cassées. Aucun feuillage : c'est l'absence qui raconte.
      const [tx] = tronc(H * 0.86, rng.spread(0.2), 2.6 * ech);
      for (let k = 0; k < 4; k++) {
        const t = 0.3 + k * 0.17;
        const y = pied - H * 0.86 * t;
        const dir = k % 2 === 0 ? -1 : 1;
        const l = W * (0.16 + rng.range(0, 0.2));
        p.limb(tx, y, tx + dir * l, y - H * 0.1, 1.4 * ech, 2);
      }
      // Fente verticale, plus claire : le bois éclaté sous l'écorce.
      for (let k = 0; k < H * 0.4; k++) p.set(cx + rng.spread(0.6), pied - k, 1);
      p.ellipse(cx, pied - H * 0.88, 2 * ech, 1.4 * ech, 1);
      break;
    }
  }

  // Ombre au pied : sans elle, l'arbre flotte au-dessus du sol.
  p.ellipse(cx, pied, W * 0.24, 1.6 * ech, 0);

  /*
   * La rasante n'est appliquée qu'aux essences à masse pleine.
   *
   * Sur le saule, chaque rideau fait un pixel de large et a donc du vide des deux côtés :
   * tous les brins s'éclairaient, et l'arbre sortait strié de cyan comme une guirlande. Une
   * lumière de bord n'a de sens que s'il y a un volume à border.
   */
  if (kind === 'oak' || kind === 'pine') p.rimLight(1, 0, 6);
  p.outline(0);

  const c = toCanvas(p, cols);
  treeCache.set(key, c);
  return c;
}

const ruineCache = new Map<string, HTMLCanvasElement>();

/**
 * Sprite d'une ruine.
 *
 * Dessiné directement sur un canvas plutôt qu'avec `Pix` : à 216 × 120, une grille indexée
 * coûterait 26 000 entrées par ruine pour un résultat identique. La pierre est un aplat
 * texturé, pas un sprite à palette.
 *
 * Les blocs bloquants sont dessinés **à l'aplomb de leur rectangle de collision** : ce que
 * le joueur voit est exactement ce qui l'arrête. Un décor qui ment sur sa collision est pire
 * que pas de collision du tout.
 */
export function ruineSprite(def: RuineDef, biome: Biome): HTMLCanvasElement {
  const key = `${def.type}:${biome.id}`;
  const hit = ruineCache.get(key);
  if (hit) return hit;

  const c = document.createElement('canvas');
  c.width = def.w;
  c.height = def.h;
  const ctx = c.getContext('2d')!;
  const rng = new Rng(cellSeed(def.type.length * 17, 3, 0x2b91));

  const pierre = mix(biome.ground[1], '#5a5f6e', 0.5);
  const clair = shade(pierre, 0.28);
  const sombre = shade(pierre, -0.42);
  const noir = shade(pierre, -0.72);

  for (const [x, y, w, h] of def.murs) {
    // Base sombre, face éclairée en haut, arête froide à droite — même convention que les
    // créatures, sinon les ruines paraissent venir d'un autre jeu.
    ctx.fillStyle = sombre;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = pierre;
    ctx.fillRect(x, y, w, Math.max(2, h - 4));
    ctx.fillStyle = clair;
    ctx.fillRect(x, y, w, 2);

    // Appareil de pierre : des joints, décalés d'un rang à l'autre.
    ctx.fillStyle = noir;
    for (let ry = y + 5; ry < y + h; ry += 6) {
      ctx.fillRect(x, ry, w, 1);
      const dec = ((ry - y) / 6) % 2 === 0 ? 0 : 7;
      for (let rx = x + dec; rx < x + w; rx += 14) ctx.fillRect(rx, ry, 1, 5);
    }

    // Arêtes rongées : quelques pierres manquantes sur le dessus.
    ctx.clearRect(x, y, w, 1);
    ctx.fillStyle = clair;
    for (let rx = x; rx < x + w; rx += 3) {
      if (rng.next() < 0.72) ctx.fillRect(rx, y + 1, 3, 1);
    }
    for (let k = 0; k < w / 12; k++) {
      if (rng.next() < 0.5) ctx.clearRect(x + rng.int(0, w - 4), y, rng.int(2, 5), rng.int(1, 3));
    }
  }

  // Gravats au pied : ils lient la ruine au sol et masquent la coupe franche du rectangle.
  ctx.fillStyle = rgba(noir, 0.55);
  for (let k = 0; k < def.w / 5; k++) {
    ctx.fillRect(rng.int(0, def.w), def.h - rng.int(1, 7), rng.int(2, 6), rng.int(1, 3));
  }

  ruineCache.set(key, c);
  return c;
}

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
  private trees = new Map<string, Tree[]>();

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
      const densite = Math.min(0.96, biome.treeDensity * this.groveMul(bx, by));
      const n = rng.next() < densite ? rng.int(1, 3) : 0;
      for (let i = 0; i < n; i++) {
        const x = cx * TREE_CELL + rng.range(0, TREE_CELL);
        const y = cy * TREE_CELL + rng.range(0, TREE_CELL);
        out.push({
          x, y,
          kind: biome.trees[rng.int(0, biome.trees.length - 1)]!,
          variant: rng.int(0, TREE_VARIANTS - 1),
          grand: rng.next() < 0.55,
        });
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

  private ruines = new Map<string, Ruine | null>();

  private ruineAt(cx: number, cy: number): Ruine | null {
    const key = `${cx},${cy}`;
    const hit = this.ruines.get(key);
    if (hit !== undefined) return hit;

    const rng = new Rng(cellSeed(cx, cy, this.seed ^ 0x4e2b8d17));
    let out: Ruine | null = null;
    if (rng.next() < 0.34) {
      const x = cx * RUINE_CELL + rng.range(120, RUINE_CELL - 320);
      const y = cy * RUINE_CELL + rng.range(120, RUINE_CELL - 320);
      const biome = biomeAt(x, y);
      const possibles = RUINE_DEFS.filter(
        (d) => d.biomes.length === 0 || d.biomes.includes(biome.id),
      );
      if (possibles.length > 0) {
        const def = possibles[rng.int(0, possibles.length - 1)]!;
        out = { x, y, def };
      }
    }
    this.ruines.set(key, out);
    return out;
  }

  private ruineBuf: Ruine[] = [];
  /** Ruines proches. Tampon réutilisé, ne pas conserver. */
  ruinesNear(x: number, y: number, radius: number): Ruine[] {
    this.ruineBuf.length = 0;
    const c0x = Math.floor((x - radius) / RUINE_CELL);
    const c1x = Math.floor((x + radius) / RUINE_CELL);
    const c0y = Math.floor((y - radius) / RUINE_CELL);
    const c1y = Math.floor((y + radius) / RUINE_CELL);
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const r = this.ruineAt(cx, cy);
        if (r) this.ruineBuf.push(r);
      }
    }
    return this.ruineBuf;
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
