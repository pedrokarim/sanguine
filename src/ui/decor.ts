import { P, shade, rgba } from '../gfx/palette';

/**
 * Ornements d'interface générés par le code, exposés à la CSS sous forme de variables
 * contenant des `data:` URI.
 *
 * Même logique que pour les sprites : rien n'est téléchargé, la palette du jeu est la seule
 * source de vérité, et changer la teinte de toute l'interface tient en un argument.
 *
 * Les cadres sont des images **9-slice** : quatre coins fixes, quatre bords répétés, centre
 * transparent. La CSS les étire via `border-image`, ce qui décore n'importe quelle boîte
 * quelle que soit sa taille, sans un seul élément supplémentaire dans le DOM.
 */

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

const url = (c: HTMLCanvasElement): string => `url("${c.toDataURL()}")`;

/**
 * Cadre 9-slice, 24×24, découpe à 8 px.
 *
 * Les coins portent une équerre double avec un losange, les bords une ligne continue
 * ponctuée d'un cran. Le motif est dessiné une fois puis retourné aux trois autres coins,
 * ce qui garantit une symétrie parfaite.
 */
/**
 * Traitements de monture.
 *
 * Les quatre cadres du jeu ne différaient que par leur couleur. Une rareté doit se lire à la
 * **monture** avant même la couleur du texte : c'est ce qui rend le tri instantané, et ce qui
 * reste vrai pour un joueur daltonien.
 */
export type Monture = 'simple' | 'double' | 'volute' | 'ronce';

function frame(color: string, accent: string, monture: Monture = 'simple'): HTMLCanvasElement {
  const S = 8;
  const [c, ctx] = canvas(S * 3, S * 3);

  // --- coin haut-gauche, dessiné dans un canvas temporaire puis dupliqué ---
  const [corner, cx] = canvas(S, S);
  cx.fillStyle = color;
  cx.fillRect(0, 0, 7, 1); // trait extérieur horizontal
  cx.fillRect(0, 0, 1, 7); // trait extérieur vertical
  cx.fillStyle = shade(color, -0.35);
  cx.fillRect(2, 2, 5, 1); // trait intérieur
  cx.fillRect(2, 2, 1, 5);
  cx.fillStyle = accent;
  cx.fillRect(0, 0, 2, 2); // losange d'angle
  cx.fillRect(4, 0, 1, 1);
  cx.fillRect(0, 4, 1, 1);

  /*
   * Le coin porte la marque de rareté. Elle se joue sur trois ou quatre pixels : à la taille
   * d'un cadre 9-slice, une ornementation plus riche se réduit à une bouillie.
   */
  switch (monture) {
    case 'double':
      // Équerre redoublée : un second retour vers l'intérieur.
      cx.fillStyle = color;
      cx.fillRect(4, 4, 3, 1);
      cx.fillRect(4, 4, 1, 3);
      break;
    case 'volute':
      // Volute : trois pixels qui s'enroulent vers le centre.
      cx.fillStyle = accent;
      cx.fillRect(3, 1, 1, 1);
      cx.fillRect(4, 2, 1, 1);
      cx.fillRect(1, 3, 1, 1);
      cx.fillRect(2, 4, 1, 1);
      cx.fillStyle = color;
      cx.fillRect(5, 5, 2, 2);
      break;
    case 'ronce':
      // Ronce : des épines qui débordent du cadre, irrégulières.
      cx.fillStyle = accent;
      cx.fillRect(3, 0, 1, 1);
      cx.fillRect(6, 1, 1, 1);
      cx.fillRect(0, 3, 1, 1);
      cx.fillRect(1, 6, 1, 1);
      cx.fillStyle = shade(color, -0.2);
      cx.fillRect(2, 5, 1, 2);
      cx.fillRect(5, 2, 2, 1);
      break;
    case 'simple':
      break;
  }

  // --- bord haut ---
  // Deux filets continus et un seul cran discret : un motif plus marqué se répète tous les
  // 8 px et transforme le cadre en pointillés, ce qui parasite la lecture du contenu.
  const [edge, ex] = canvas(S, S);
  ex.fillStyle = color;
  ex.fillRect(0, 0, S, 1);
  ex.fillStyle = shade(color, -0.5);
  ex.fillRect(0, 2, S, 1);
  ex.fillStyle = accent;
  ex.fillRect(4, 0, 1, 1);

  const put = (img: HTMLCanvasElement, x: number, y: number, fx: number, fy: number): void => {
    ctx.save();
    ctx.translate(x + (fx < 0 ? S : 0), y + (fy < 0 ? S : 0));
    ctx.scale(fx, fy);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  };

  put(corner, 0, 0, 1, 1);
  put(corner, S * 2, 0, -1, 1);
  put(corner, 0, S * 2, 1, -1);
  put(corner, S * 2, S * 2, -1, -1);

  put(edge, S, 0, 1, 1);
  put(edge, S, S * 2, 1, -1);

  // Bords verticaux : le bord haut pivoté d'un quart de tour.
  const [vedge, vx] = canvas(S, S);
  vx.translate(S, 0);
  vx.rotate(Math.PI / 2);
  vx.drawImage(edge, 0, 0);
  put(vedge, 0, S, 1, 1);
  put(vedge, S * 2, S, -1, 1);

  return c;
}

/** Fleuron horizontal : deux traits effilés convergeant vers un losange central. */
function flourish(color: string, accent: string): HTMLCanvasElement {
  const W = 96;
  const H = 11;
  const [c, ctx] = canvas(W, H);
  const mid = Math.floor(H / 2);

  ctx.fillStyle = color;
  // Traits qui s'amincissent en s'éloignant du centre.
  for (let x = 0; x < W / 2 - 8; x++) {
    const a = 1 - x / (W / 2 - 8);
    ctx.globalAlpha = 0.25 + a * 0.75;
    ctx.fillRect(x, mid, 1, 1);
    ctx.fillRect(W - 1 - x, mid, 1, 1);
  }
  ctx.globalAlpha = 1;

  // Losange central.
  ctx.fillStyle = accent;
  for (let i = 0; i < 5; i++) {
    const h = 5 - Math.abs(i - 2) * 2;
    ctx.fillRect(W / 2 - 2 + i, mid - Math.floor(h / 2), 1, h);
  }
  // Petites perles de part et d'autre.
  ctx.fillStyle = color;
  ctx.fillRect(W / 2 - 8, mid, 2, 1);
  ctx.fillRect(W / 2 + 6, mid, 2, 1);
  ctx.fillRect(W / 2 - 14, mid, 1, 1);
  ctx.fillRect(W / 2 + 13, mid, 1, 1);

  return c;
}

/** Équerre d'angle libre, posée en `::before`/`::after` sur les éléments mis en avant. */
function corner(color: string, accent: string): HTMLCanvasElement {
  const S = 14;
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 10, 1);
  ctx.fillRect(0, 0, 1, 10);
  ctx.fillStyle = shade(color, -0.4);
  ctx.fillRect(3, 3, 6, 1);
  ctx.fillRect(3, 3, 1, 6);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 3, 3);
  ctx.clearRect(1, 1, 1, 1);
  ctx.fillRect(9, 0, 1, 1);
  ctx.fillRect(0, 9, 1, 1);
  return c;
}

/** Bandeau de titre : dégradé sanglant en fondu, posé derrière les h1/h2. */
function titleBand(): HTMLCanvasElement {
  const W = 256;
  const H = 48;
  const [c, ctx] = canvas(W, H);
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.3, rgba(P.bloodDark, 0.35));
  g.addColorStop(0.5, rgba(P.blood, 0.42));
  g.addColorStop(0.7, rgba(P.bloodDark, 0.35));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, H / 2 - 12, W, 24);

  // Filets clairs qui encadrent le bandeau.
  const line = ctx.createLinearGradient(0, 0, W, 0);
  line.addColorStop(0, 'rgba(0,0,0,0)');
  line.addColorStop(0.5, rgba(P.gold, 0.55));
  line.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = line;
  ctx.fillRect(0, H / 2 - 13, W, 1);
  ctx.fillRect(0, H / 2 + 12, W, 1);
  return c;
}

/** Texture de parchemin discrète pour les panneaux – évite les aplats trop plats. */
function grain(): HTMLCanvasElement {
  const S = 64;
  const [c, ctx] = canvas(S, S);
  const img = ctx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const v = Math.random();
    const o = i * 4;
    img.data[o] = 255;
    img.data[o + 1] = 255;
    img.data[o + 2] = 255;
    // Grain très faible : perceptible sans jamais devenir du bruit.
    img.data[o + 3] = v < 0.5 ? 0 : Math.floor(v * 9);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------
// Curseur
// ---------------------------------------------------------------------------

/**
 * Curseur en pixel art, dessiné à partir d'un masque 16×16 puis agrandi ×2.
 *
 * `#` = corps, `X` = contour. Le contour est indispensable : un curseur sans liseré sombre
 * disparaît dès qu'il passe sur une zone claire de l'interface, et un curseur qu'on perd est
 * pire que pas de curseur personnalisé du tout.
 */
const ARROW = [
  'X...............',
  'XX..............',
  'X#X.............',
  'X##X............',
  'X###X...........',
  'X####X..........',
  'X#####X.........',
  'X######X........',
  'X#######X.......',
  'X########X......',
  'X#####XXXX......',
  'X##X##X.........',
  'X#X.X##X........',
  'XX..X##X........',
  '.....X##X.......',
  '......XXX.......',
];

const SCALE = 2;

/**
 * Construit la valeur CSS complète de `cursor`, repli inclus.
 *
 * Le point chaud est calé sur la pointe de la flèche. Le repli `auto` en fin de déclaration
 * n'est pas décoratif : si le navigateur refuse l'image (taille, contexte, politique), sans
 * lui la propriété entière est invalide et le curseur disparaît.
 */
function cursor(body: string, outline: string, gem: string | null): string {
  const S = 16 * SCALE;
  const [c, ctx] = canvas(S, S);

  for (let y = 0; y < 16; y++) {
    const row = ARROW[y]!;
    for (let x = 0; x < 16; x++) {
      const ch = row[x];
      if (ch !== '#' && ch !== 'X') continue;
      ctx.fillStyle = ch === 'X' ? outline : body;
      ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
    }
  }

  // Petite gemme dans le corps de la flèche : le détail qui rend le curseur « du jeu »
  // plutôt qu'une flèche générique repeinte.
  if (gem) {
    ctx.fillStyle = gem;
    ctx.fillRect(2 * SCALE, 4 * SCALE, SCALE, SCALE);
    ctx.fillRect(2 * SCALE, 5 * SCALE, SCALE, SCALE);
    ctx.fillRect(3 * SCALE, 5 * SCALE, SCALE, SCALE);
  }

  // Point chaud sur la pointe elle-même, au centre du bloc agrandi : avec `SCALE`, le clic
  // atterrirait un pixel logique sous et à droite de la pointe, ce qui se sent à l'usage.
  const hot = Math.floor(SCALE / 2);
  return `url("${c.toDataURL()}") ${hot} ${hot}, auto`;
}

/**
 * Applique un thème d'interface : la teinte des cadres et du fleuron.
 *
 * Seul `--frame-stone` change — c'est le cadre par défaut de tous les éléments. Les cadres
 * or, sang et épique gardent leur sens (survol, danger, évolution) et ne sont donc jamais
 * réassignés : un thème ne doit pas rendre un avertissement indistinct du reste.
 */
export function applyTheme(color: string, accent: string): void {
  const root = document.documentElement.style;
  root.setProperty('--frame-stone', url(frame(color, accent)));
  root.setProperty('--flourish', url(flourish(color, accent)));
  root.setProperty('--corner', url(corner(color, accent)));
}

/** Applique un curseur : teinte du corps et de la gemme. */
export function applyCursor(color: string, accent: string): void {
  document.documentElement.style.setProperty('--cursor', cursor(color, '#05060a', accent));
}

/** Génère tous les ornements et les publie en variables CSS. Appelé une fois au démarrage. */
export function installDecor(): void {
  const root = document.documentElement.style;
  root.setProperty('--frame-gold', url(frame(P.gold, shade(P.gold, 0.45))));
  root.setProperty('--frame-stone', url(frame(P.mist, P.stoneHi)));
  root.setProperty('--frame-blood', url(frame(P.blood, P.bloodHi)));
  root.setProperty('--frame-epic', url(frame('#a855f7', '#d8b4fe')));

  /*
   * Montures de rareté.
   *
   * Elles s'appliquent aux vignettes du Codex, aux cases de la boutique, aux cartes
   * d'amélioration et à l'Archive. Chacune porte un traitement d'angle distinct — équerre
   * simple, équerre redoublée, volute, ronce — pour que la rareté se lise à la forme.
   */
  root.setProperty('--frame-commune', url(frame(P.mist, P.steel, 'simple')));
  root.setProperty('--frame-rare', url(frame('#5b9df5', '#a8c5d6', 'double')));
  root.setProperty('--frame-epique', url(frame('#a855f7', '#d8b4fe', 'volute')));
  root.setProperty('--frame-maudite', url(frame(P.blood, P.bloodHi, 'ronce')));
  root.setProperty('--flourish', url(flourish(P.gold, shade(P.gold, 0.5))));
  root.setProperty('--corner', url(corner(P.gold, shade(P.gold, 0.5))));
  root.setProperty('--title-band', url(titleBand()));
  root.setProperty('--grain', url(grain()));

  // Curseurs : lin au repos, or sur un élément cliquable, rouge sur une action destructrice.
  root.setProperty('--cursor', cursor(P.linen, '#05060a', P.steel));
  root.setProperty('--cursor-hover', cursor(P.gold, '#05060a', shade(P.gold, 0.6)));
  root.setProperty('--cursor-danger', cursor(P.bloodHi, '#05060a', '#ffffff'));
}
