import { Brush, stoneHash } from './brush';

/**
 * Le château, peint module par module.
 *
 * Tout est vu en perspective cavalière : une boîte de hauteur `h` montre sa face sud, haute de
 * `h`, et son dessus, décalé de `h` vers le haut de l'écran. C'est ce qui garantit qu'un mur se
 * dessine exactement sur son rectangle de collision : le pied de la face est le bord sud de
 * l'emprise, sans approximation.
 *
 * Direction : gothique, sombre et lisible. Trois tons nets par matière, de gros aplats, un cerne
 * sombre, et les joints de pierre seulement par plaques : un mur entièrement appareillé se lit
 * comme une texture, un mur dont on devine l'appareil se lit comme un mur.
 *
 * Échelle, mesurée en jeu : le héros fait 31 px, le plus haut des arbres 69 px, la vue 841 × 439.
 */

/** Rampe de la pierre, du noir au plus clair. L'ombre glisse vers le violet, comme partout. */
export const STONE = ['#14131f', '#21213a', '#2f304c', '#3f4260', '#525675', '#6d7190', '#9094ad'] as const;
const SHADOW = 1, DARK = 2, MID = 3, LIGHT = 4, BRIGHT = 5, GLARE = 6;

export const OUTLINE = '#0c0b14';
/** Ombre portée au sol : translucide, jamais posée sur de la pierre. */
export const GROUND_SHADOW = '#05050c88';
export const ROOF = ['#180a14', '#2a101c', '#3e1524', '#561c2d', '#74283a'] as const;
export const WOOD = ['#1a110d', '#2e2017', '#463022', '#664930'] as const;
export const IRON = ['#14151e', '#292b3a', '#4a4e62', '#70758c'] as const;
export const CLOTH = ['#3a0c15', '#671320', '#93202e', '#bb3638'] as const;
export const GOLD = '#d9a441';
export const MOSS = ['#1c281a', '#2c4024', '#42592e'] as const;
export const GLASS = { glow: '#f4b860', core: '#ffe2a0', red: '#b5302c', blue: '#3a5aa8', dark: '#3a1f24' } as const;

/** Hauteur d'une assise de pierres. */
const COURSE = 14;

/** Courtine : plus haute que le plus grand arbre (69 px), sinon elle ne protège rien. */
export const RAMPART_HEIGHT = 112;
export const RAMPART_DEPTH = 36;

export const tone = (i: number): string => STONE[Math.max(0, Math.min(STONE.length - 1, i))]!;

/**
 * Appareil de pierre par plaques.
 *
 * Le fond reste un aplat ; seules certaines zones, décidées par paquets de quatre assises,
 * laissent voir leurs joints. Ce sont les vides qui donnent l'échelle : on croit voir de grandes
 * pierres là où il n'y en a qu'une sur trois de dessinée.
 */
export function masonry(b: Brush, x0: number, x1: number, top: number, bottom: number, base: number): void {
  b.rect(x0, top, x1 - x0, bottom - top, tone(base));
  const firstRow = Math.floor(top / COURSE);
  const lastRow = Math.ceil(bottom / COURSE);
  const first = Math.max(x0, b.ox - 64);
  const last = Math.min(x1, b.ox + b.w + 64);
  for (let row = firstRow; row < lastRow; row++) {
    const ry = row * COURSE;
    if (ry + COURSE < b.oy || ry > b.oy + b.h) continue;
    const stagger = row % 2 === 0 ? 0 : 20;
    for (let bx = Math.floor((first - 60) / 40) * 40 + stagger; bx < last; ) {
      const span = stoneHash(bx, row) < 0.3 ? 58 : 40;
      const patch = stoneHash(Math.floor(bx / 96), Math.floor(row / 4));
      const pick = stoneHash(bx + 7, row * 3 + 1);
      if (patch < 0.58 && pick < 0.7) {
        const left = Math.max(bx, x0), right = Math.min(bx + span, x1);
        const y0 = Math.max(ry, top), y1 = Math.min(ry + COURSE, bottom);
        if (right > left && y1 > y0) {
          if (pick < 0.2) b.rect(left, y0, right - left, y1 - y0, tone(base + 1));
          else if (pick < 0.34) b.rect(left, y0, right - left, y1 - y0, tone(base - 1));
          b.rect(left, y1 - 1, right - left, 1, tone(base - 1));
          b.rect(right - 1, y0, 1, y1 - y0, tone(base - 1));
          b.rect(left, y0, right - left - 1, 1, tone(base + 1));
        }
      }
      bx += span;
    }
  }
}

/** Fente de tir, en croix. */
function arrowSlit(b: Brush, x: number, y: number): void {
  b.rect(x - 3, y - 2, 7, 24, tone(MID));
  b.rect(x - 1, y, 3, 20, STONE[0]);
  b.rect(x - 5, y + 7, 11, 3, STONE[0]);
  b.rect(x - 2, y - 1, 1, 21, tone(BRIGHT));
}

/** Pinacle : une flèche de pierre à deux pans, posée sur le sommet d'un contrefort. */
export function pinnacle(b: Brush, cx: number, base: number, w: number, h: number): void {
  b.poly([[cx - w / 2, base], [cx, base - h], [cx, base]], tone(BRIGHT));
  b.poly([[cx, base - h], [cx + w / 2, base], [cx, base]], tone(DARK));
  b.rect(cx - w / 2 - 2, base, w + 4, 3, tone(LIGHT));
  b.rect(cx - 1, base - h - 4, 2, 5, tone(GLARE));
}

/** Contrefort : un pilier qui descend en gradins, éclairé à gauche, ombré à droite. */
export function buttress(b: Brush, x: number, top: number, bottom: number, W = 26): void {
  b.rect(x + W, top + 8, 8, bottom - top - 8, tone(SHADOW));
  b.rect(x, top, W, bottom - top, tone(LIGHT));
  b.rect(x, top, 4, bottom - top, tone(BRIGHT));
  b.rect(x + W - 7, top, 7, bottom - top, tone(DARK));
  for (let y = top + 34; y < bottom - 8; y += 34) {
    b.rect(x - 2, y, W + 4, 5, tone(BRIGHT));
    b.rect(x - 2, y + 5, W + 4, 2, tone(SHADOW));
  }
  pinnacle(b, x + W / 2, top, W, 26);
}

/** Bannière déchirée, suspendue sous le parapet. */
export function banner(b: Brush, cx: number, top: number, len: number, W = 26): void {
  b.rect(cx - W / 2 - 4, top - 2, W + 8, 3, WOOD[2]);
  b.rect(cx - W / 2 + 2, top + 2, W, len, '#05050c55');
  b.rect(cx - W / 2, top, W, len, CLOTH[1]);
  b.rect(cx - W / 2, top, 5, len, CLOTH[2]);
  b.rect(cx + W / 2 - 6, top, 6, len, CLOTH[0]);
  // Le bas s'effiloche en trois pointes : c'est lui qui dit l'abandon.
  b.poly([[cx - W / 2, top + len], [cx - W / 2 + 7, top + len + 12], [cx - 2, top + len]], CLOTH[1]);
  b.poly([[cx - 2, top + len], [cx + 3, top + len + 7], [cx + 8, top + len]], CLOTH[1]);
  b.poly([[cx + 6, top + len], [cx + W / 2 - 2, top + len + 15], [cx + W / 2, top + len]], CLOTH[0]);
  // Sigle : une goutte d'or.
  b.poly([[cx, top + 12], [cx + 6, top + 24], [cx, top + 30], [cx - 6, top + 24]], GOLD);
  b.rect(cx - 2, top + 22, 2, 4, '#f4d58a');
}

/** Lierre : des paquets de feuilles qui s'accrochent et des brins qui pendent. */
export function ivy(b: Brush, x: number, top: number, len: number, seed: number): void {
  const blobs = Math.round(len / 9);
  for (let k = 0; k < blobs; k++) {
    const q = k / blobs;
    const y = top + q * len;
    const off = (stoneHash(seed + k, 3) - 0.5) * (10 + q * 26);
    const r = (11 - q * 7) * (0.7 + stoneHash(seed, k) * 0.6);
    b.ellipse(x + off, y + 1, r + 1, r * 0.8 + 1, MOSS[0]);
    b.ellipse(x + off, y, r, r * 0.8, MOSS[1]);
    b.ellipse(x + off - r * 0.3, y - r * 0.25, r * 0.5, r * 0.4, MOSS[2]);
  }
  for (let k = 0; k < 5; k++) {
    const vx = x + (k - 2) * 7 + (stoneHash(seed, k + 40) - 0.5) * 6;
    const vl = 18 + stoneHash(seed + 1, k) * 26;
    b.rect(vx, top + len - 8, 1, vl, MOSS[1]);
    b.rect(vx - 1, top + len - 8 + vl, 3, 2, MOSS[2]);
  }
}

/** Coulée sombre sous un mâchicoulis : un mur se salit du haut vers le bas. */
function stain(b: Brush, x: number, top: number, len: number, base: number): void {
  for (let y = 0; y < len; y += 4) {
    const half = 3 + (1 - y / len) * 7;
    b.rect(x - half, top + y, half * 2, 4, tone(base - 1));
  }
}

export interface RampartRun {
  x0: number;
  x1: number;
  /** Bord nord de l'emprise. Le pied de la face est en `y + depth`. */
  y: number;
  depth: number;
  height: number;
  buttresses?: readonly number[];
  slits?: readonly number[];
  banners?: readonly number[];
  ivy?: readonly number[];
  /** Fenêtres gothiques : un logis, pas une simple courtine. */
  lancets?: readonly number[];
  /** Bout effondré : la courtine se termine en éboulis à cette extrémité. */
  brokenWest?: boolean;
  brokenEast?: boolean;
  /** Niveau de pierre de la face. Les bâtiments intérieurs sont un cran plus sombres. */
  base?: number;
  /** Logis couvert d'ardoises : le dessus est un toit, pas un chemin de ronde. */
  roofed?: boolean;
}

/** Parapet à créneaux. `y` est le pied des merlons, `front` : ceux de la face vue. */
function merlons(b: Brush, x0: number, x1: number, y: number, front: boolean): void {
  const H = front ? 15 : 9;
  const STEP = 24, W = 15;
  for (let x = Math.floor(x0 / STEP) * STEP; x < x1; x += STEP) {
    const left = Math.max(x, x0), right = Math.min(x + W, x1);
    if (right <= left) continue;
    b.rect(left, y - H, right - left, H, tone(front ? LIGHT : MID));
    b.rect(left, y - H, right - left, 3, tone(GLARE));
    b.rect(left, y - H, Math.min(2, right - left), H, tone(BRIGHT));
    if (right - left > 3) b.rect(right - 3, y - H + 3, 3, H - 3, tone(DARK));
  }
}

/** Dessus d'une boîte : dalles de chemin de ronde, plus clair vers le sud. */
function walkway(b: Brush, x0: number, x1: number, top: number, depth: number): void {
  b.rect(x0, top, x1 - x0, depth, tone(LIGHT));
  b.rect(x0, top + depth - 8, x1 - x0, 8, tone(BRIGHT));
  for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) b.rect(x, top + 3, 1, depth - 11, tone(MID));
  for (let y = top + 44; y < top + depth - 12; y += 44) b.rect(x0, y, x1 - x0, 1, tone(MID));
  b.rect(x0, top + 3, x1 - x0, 2, tone(SHADOW));
}

/**
 * Grand toit d'ardoises, vu de l'avant : des rangs francs, trois bandes de lumière, un faîtage.
 * Sur une aile de quatre cents pixels de profondeur, c'est lui qu'on voit le plus : il porte donc
 * ses cheminées et ses lucarnes, sans quoi il ne serait qu'un aplat.
 */
function slateRoof(b: Brush, x0: number, x1: number, top: number, depth: number): void {
  const bandH = Math.round(depth / 3);
  for (let y = top; y < top + depth; y += 12) {
    const row = Math.floor((y - top) / 12);
    const band = Math.min(2, Math.floor((y - top) / bandH));
    const c = [ROOF[1], ROOF[2], ROOF[2]][band]!, dark = [ROOF[0], ROOF[1], ROOF[1]][band]!;
    b.rect(x0, y, x1 - x0, 12, c);
    b.rect(x0, y + 11, x1 - x0, 1, dark);
    for (let x = Math.floor(x0 / 22) * 22 + (row % 2) * 11; x < x1; x += 22) {
      if (stoneHash(x, row) < 0.72) b.rect(x, y, 1, 11, dark);
      if (stoneHash(x + 1, row * 3) < 0.12) b.rect(x + 1, y, 21, 11, band === 0 ? ROOF[0] : ROOF[3]);
    }
  }
  b.rect(x0, top, x1 - x0, 5, ROOF[4]);
  b.rect(x0, top, x1 - x0, 2, tone(BRIGHT));
  for (let x = Math.floor(x0 / 132) * 132 + 66; x < x1 - 30; x += 132) {
    if (x < x0 + 30) continue;
    for (const y of [top + depth * 0.32, top + depth * 0.72]) dormer(b, x, y, 40, 54);
  }
  for (let x = Math.floor(x0 / 176) * 176 + 120; x < x1 - 24; x += 176) {
    if (x < x0 + 24) continue;
    const y = top + 30;
    b.rect(x + 2, y - 44, 26, 44, tone(MID));
    b.rect(x + 2, y - 44, 6, 44, tone(BRIGHT));
    b.rect(x + 20, y - 44, 8, 44, tone(SHADOW));
    b.rect(x - 2, y - 50, 34, 7, tone(LIGHT));
    b.rect(x - 2, y - 50, 34, 2, tone(GLARE));
  }
}

/** Courtine est-ouest : la pièce qu'on voit le plus, et donc celle qui décide de tout. */
export function paintRampart(b: Brush, r: RampartRun): void {
  const foot = r.y + r.depth;
  const faceTop = foot - r.height;
  const topY = r.y - r.height;
  const base = r.base ?? MID;

  b.rect(r.x0, foot, r.x1 - r.x0, 8, GROUND_SHADOW);

  if (r.roofed) {
    slateRoof(b, r.x0, r.x1, topY, r.depth);
  } else {
    walkway(b, r.x0, r.x1, topY, r.depth);
    merlons(b, r.x0, r.x1, topY + 3, false);
  }

  masonry(b, r.x0, r.x1, faceTop, foot, base);

  // Coulées : elles cassent la frise des pierres.
  for (let x = Math.floor(r.x0 / 72) * 72 + 30; x < r.x1; x += 72) {
    if (stoneHash(x, 91) < 0.55) stain(b, x + stoneHash(x, 3) * 40, faceTop + 26, 26 + stoneHash(x, 8) * (r.height * 0.5), base);
  }

  // Fruit du mur : la base s'évase, c'est elle qui donne le poids.
  const talus = 22;
  masonry(b, r.x0, r.x1, foot - talus, foot, base - 1);
  b.rect(r.x0, foot - talus - 3, r.x1 - r.x0, 3, tone(base + 2));
  b.rect(r.x0, foot - talus, r.x1 - r.x0, 2, tone(SHADOW));

  // Cordon : il coupe la hauteur en deux et rappelle la taille du héros.
  const cord = faceTop + Math.round(r.height * 0.46);
  b.rect(r.x0, cord, r.x1 - r.x0, 4, tone(base + 1));
  b.rect(r.x0, cord, r.x1 - r.x0, 1, tone(GLARE));
  b.rect(r.x0, cord + 4, r.x1 - r.x0, 2, tone(SHADOW));

  for (const x of r.slits ?? []) arrowSlit(b, x, cord + 14);
  for (const x of r.lancets ?? []) lancet(b, x, foot - 44, 18, 62);
  for (const x of r.buttresses ?? []) buttress(b, x, faceTop + 30, foot);

  // Mâchicoulis : une rangée de consoles, et le noir entre elles. C'est le motif qui signe le
  // château à cent pixels de distance.
  const corbelY = faceTop + 12;
  b.rect(r.x0, corbelY + 12, r.x1 - r.x0, 7, tone(SHADOW));
  for (let x = Math.floor(r.x0 / 24) * 24; x < r.x1; x += 24) {
    b.rect(x, corbelY, 24, 12, STONE[0]);
    b.rect(x, corbelY, 8, 12, tone(BRIGHT));
    b.rect(x + 6, corbelY + 2, 2, 10, tone(DARK));
    b.rect(x + 1, corbelY + 10, 6, 2, tone(MID));
  }
  b.rect(r.x0, faceTop - 4, r.x1 - r.x0, 16, tone(LIGHT));
  b.rect(r.x0, faceTop - 4, r.x1 - r.x0, 2, tone(GLARE));
  b.rect(r.x0, faceTop + 9, r.x1 - r.x0, 3, tone(DARK));
  merlons(b, r.x0, r.x1, faceTop - 4, true);

  for (const x of r.banners ?? []) banner(b, x, faceTop + 30, 54);
  for (const x of r.ivy ?? []) ivy(b, x, faceTop + 8, 70, x);

  if (r.brokenEast) breakEnd(b, r, 1);
  if (r.brokenWest) breakEnd(b, r, -1);
}

/**
 * Taille l'extrémité d'une courtine en éboulement : une arête en gradins, hachée à la main, et
 * le noyau de blocage du mur qui apparaît dans la cassure.
 */
function breakEnd(b: Brush, r: RampartRun, side: 1 | -1): void {
  const edge = side > 0 ? r.x1 : r.x0;
  const foot = r.y + r.depth;
  const totalH = r.height + r.depth + 26;
  const reach = 150;
  const STEPS = [0, 0.14, 0.1, 0.3, 0.26, 0.5, 0.42, 0.7, 0.62, 0.86, 1];
  for (let i = 0; i < STEPS.length; i++) {
    const w = reach / STEPS.length;
    const x = edge - side * (i + 1) * w;
    const keep = STEPS[STEPS.length - 1 - i]!;
    const cutTo = foot - totalH + 0;
    const cutBottom = foot - Math.round(totalH * keep * 0.82) - 8;
    const left = side > 0 ? x : x - w;
    if (cutBottom > cutTo) b.erase(left, cutTo - 4, w + 1, cutBottom - cutTo + 4);
    // Le noyau, plus sombre, sur la tranche fraîche.
    b.rect(left, cutBottom, w + 1, 6, tone(SHADOW));
    b.rect(left, cutBottom, w + 1, 2, tone(BRIGHT));
  }
}

/**
 * Courtine nord-sud, vue par le dessus.
 *
 * Une boîte alignée sur l'axe de la caméra ne montre aucune face : sans parade, le mur se
 * réduirait à une bande plate sans hauteur. On triche donc d'une douzaine de pixels, en
 * laissant voir un peu du parement côté cour. L'œil lit la perspective, et le tout reste
 * contenu dans l'emprise de collision.
 */
export function paintRampartNS(b: Brush, x: number, y0: number, y1: number, depth: number, height: number, faceSide: 1 | -1): void {
  const SKEW = 13;
  const strip = depth - SKEW;
  const topX = faceSide > 0 ? x : x + SKEW;
  const faceX = faceSide > 0 ? x + strip : x;
  const top0 = y0 - height, top1 = y1 - height;

  // Le parement côté cour, sur toute la hauteur.
  masonry(b, faceX, faceX + SKEW, top0, y1, MID - 1);
  b.rect(faceSide > 0 ? faceX + SKEW - 2 : faceX, top0, 2, y1 - top0, tone(faceSide > 0 ? SHADOW : LIGHT));

  // Le chemin de ronde.
  b.rect(topX, top0, strip, top1 - top0, tone(LIGHT));
  b.rect(topX, top0, 3, top1 - top0, tone(BRIGHT));
  b.rect(topX + strip - 3, top0, 3, top1 - top0, tone(DARK));
  for (let y = Math.floor(top0 / 44) * 44; y < top1; y += 44) b.rect(topX + 3, y, strip - 6, 1, tone(MID));

  // Merlons des deux bords : de petites boîtes qui rappellent que c'est bien un parapet.
  for (let y = Math.floor(top0 / 24) * 24; y < top1; y += 24) {
    for (const ex of [topX - 1, topX + strip - 6]) {
      b.rect(ex, y - 8, 7, 7, tone(GLARE));
      b.rect(ex, y - 1, 7, 8, tone(MID));
      b.rect(ex + 5, y - 1, 2, 8, tone(DARK));
    }
  }
}

export interface Tower {
  cx: number;
  /** Pied de la tour, au sud du tambour. */
  foot: number;
  radius: number;
  height: number;
  /** Hauteur du toit. Zéro : terrasse à créneaux. */
  roof: number;
  /** Nombre de fenêtres sur le fût. */
  windows?: number;
}

/** Écrasement d'un cercle au sol : la même ellipse que les zones et les auras. */
export const TOWER_SQUASH = 0.34;

/** Couleur d'un fût à l'abscisse normalisée `u` : quatre bandes, la lumière à gauche. */
function drumTone(u: number): number {
  if (u < -0.82) return MID;
  if (u < -0.34) return LIGHT;
  if (u < 0.28) return MID;
  if (u < 0.74) return DARK;
  return SHADOW;
}

/** Courbure d'un anneau de la tour à l'abscisse `px`. */
const bowAt = (px: number, cx: number, r: number): number => {
  const u = (px + 0.5 - cx) / r;
  return Math.sqrt(Math.max(0, 1 - u * u)) * r * TOWER_SQUASH;
};

/** Un cylindre : bandes verticales franches, et des assises qui s'incurvent avec la tour. */
function drum(b: Brush, cx: number, top: number, bottom: number, r: number): void {
  for (let px = Math.floor(cx - r); px < cx + r; px++) {
    const u = (px + 0.5 - cx) / r;
    const bow = bowAt(px, cx, r);
    const t = drumTone(u);
    b.rect(px, top + bow, 1, bottom - top, tone(t));
    for (let row = Math.floor(top / COURSE); row * COURSE < bottom; row++) {
      const y = row * COURSE + bow;
      const shifted = px + (row % 2) * 18;
      const col = Math.floor(shifted / 36);
      if (stoneHash(Math.floor(col / 2), Math.floor(row / 3)) >= 0.6) continue;
      if (y > top + bow && y < bottom + bow) b.dot(px, y, tone(t - 1));
      if (((shifted % 36) + 36) % 36 === 0) b.rect(px, y, 1, COURSE, tone(t - 1));
    }
  }
}

/** Fenêtre gothique éclairée : elle donne l'échelle et réchauffe la masse. */
export function lancet(b: Brush, cx: number, base: number, w: number, h: number, lit = true): void {
  b.arch(cx, base + 2, w + 6, h + 5, tone(BRIGHT));
  b.arch(cx + 1, base + 2, w + 4, h + 3, tone(DARK));
  b.arch(cx, base, w, h, STONE[0]);
  if (lit) {
    b.arch(cx, base - 1, w - 2, h - 2, GLASS.red);
    b.arch(cx, base - 1, w - 4, h - 7, GLASS.glow);
    b.rect(cx - 1, base - h + 8, 2, h - 9, STONE[0]);
    b.rect(cx - w / 2 + 1, base - Math.round(h * 0.42), w - 2, 1, STONE[0]);
    b.rect(cx - w / 2 + 1, base - Math.round(h * 0.2), w - 2, 1, STONE[0]);
    b.rect(cx - 3, base - 6, 2, 4, GLASS.core);
  }
}

/** Couronne en encorbellement, parapet et créneaux : la tête de toute tour. */
function crown(b: Brush, cx: number, y: number, r: number): void {
  const R = r + 8;
  for (let px = Math.floor(cx - R); px < cx + R; px++) {
    const u = (px + 0.5 - cx) / R;
    const bow = bowAt(px, cx, R);
    const k = (((px - cx) % 16) + 16) % 16;
    b.rect(px, y + bow - 2, 1, 8, tone(drumTone(u)));
    b.rect(px, y + bow + 6, 1, 8, k < 7 ? tone(drumTone(u) + 1) : STONE[0]);
    b.rect(px, y + bow + 14, 1, 3, tone(SHADOW));
  }
  const parapet = y - 22;
  for (let px = Math.floor(cx - R); px < cx + R; px++) {
    const u = (px + 0.5 - cx) / R;
    const bow = bowAt(px, cx, R);
    const tn = drumTone(u);
    b.rect(px, parapet + bow, 1, 22, tone(tn + 1));
    if ((((px - cx) % 22) + 22) % 22 < 13) {
      b.rect(px, parapet + bow - 13, 1, 13, tone(tn + 1));
      b.dot(px, parapet + bow - 13, tone(GLARE));
    }
  }
}

/** Toit en poivrière : un cône à arêtes franches, en trois pans, écailles de fines lignes. */
function cone(b: Brush, cx: number, baseY: number, R: number, H: number): void {
  const apex = baseY - H;
  for (let px = Math.floor(cx - R); px < cx + R; px++) {
    const n = (px + 0.5 - cx) / R;
    const edge = baseY + bowAt(px, cx, R);
    const top = apex + Math.abs(n) * H;
    const band = n < -0.48 ? 4 : n < 0.08 ? 3 : n < 0.55 ? 2 : 1;
    b.rect(px, top, 1, edge - top, ROOF[band]!);
    for (let y = Math.ceil((top - apex) / 12) * 12 + apex; y < edge; y += 12) {
      const q = (y - apex) / H;
      const k = Math.floor((px - cx) / Math.max(4, 14 * q) + (Math.round((y - apex) / 12) % 2) * 0.5);
      if (stoneHash(k, Math.round(y)) < 0.72) b.dot(px, y + bowAt(px, cx, R) * q, ROOF[band - 1]!);
    }
  }
  for (let px = Math.floor(cx - R - 3); px < cx + R + 3; px++) {
    const bow = bowAt(px, cx, R + 3);
    b.rect(px, baseY + bow - 3, 1, 3, ROOF[4]);
    b.rect(px, baseY + bow, 1, 2, ROOF[0]);
  }
  b.rect(cx - 1, apex - 26, 3, 28, IRON[1]);
  b.rect(cx - 1, apex - 26, 1, 28, IRON[3]);
  b.rect(cx - 4, apex - 18, 9, 2, IRON[2]);
  b.poly([[cx + 2, apex - 26], [cx + 25, apex - 19], [cx + 2, apex - 12]], CLOTH[2]);
  b.poly([[cx + 2, apex - 19], [cx + 25, apex - 19], [cx + 2, apex - 12]], CLOTH[1]);
}

/** Tour ronde complète, de son pied à la pointe de son toit. */
export function paintRoundTower(b: Brush, t: Tower): void {
  const { cx, foot, radius: r, height: h, roof } = t;
  const footCentre = foot - r * TOWER_SQUASH;
  const top = footCentre - h;

  b.ellipse(cx + 8, footCentre + 6, r + 12, r * TOWER_SQUASH + 6, GROUND_SHADOW);
  drum(b, cx, top, footCentre, r);

  // Fruit : la base s'élargit de quelques pixels et s'assombrit.
  const talus = 26;
  for (let px = Math.floor(cx - r - 5); px < cx + r + 5; px++) {
    const u = (px + 0.5 - cx) / (r + 5);
    const y = footCentre + bowAt(px, cx, r + 5);
    b.rect(px, y - talus, 1, talus, tone(drumTone(u) - 1));
    b.rect(px, y - talus - 2, 1, 2, tone(drumTone(u) + 1));
    b.rect(px, y - 2, 1, 2, tone(SHADOW));
  }

  const n = t.windows ?? 2;
  if (n > 0) lancet(b, cx - r * 0.3, top + h * 0.46, 12, 30);
  if (n > 1) lancet(b, cx + r * 0.2, top + h * 0.72, 10, 24, false);
  if (n > 2) lancet(b, cx + r * 0.1, top + h * 0.26, 10, 24);

  const crownY = top + r * TOWER_SQUASH + 2;
  crown(b, cx, crownY, r);
  if (roof > 0) cone(b, cx, crownY - 18, r + 2, roof);
}

export interface Gate {
  cx: number;
  /** Pied de la façade. */
  foot: number;
  /** Largeur libre du passage. */
  width: number;
  /** Hauteur sous clef. */
  clear: number;
  depth: number;
  height: number;
  /** Largeur totale du massif. */
  span: number;
}

/**
 * Corps de la porte : un massif percé d'une ogive, herse relevée.
 *
 * L'ogive est un vrai trou dans le sprite : le héros qui s'y engage se voit à travers, et le
 * linteau repasse devant lui sans qu'il y ait quoi que ce soit à calculer.
 */
export function paintGateBody(b: Brush, g: Gate): void {
  const x0 = g.cx - g.span / 2, x1 = g.cx + g.span / 2;
  const top = g.foot - g.height;
  const roofY = top - g.depth;

  walkway(b, x0, x1, roofY, g.depth);
  merlons(b, x0, x1, roofY + 3, false);

  masonry(b, x0, x1, top, g.foot, MID);
  masonry(b, x0, x1, g.foot - 22, g.foot, DARK);
  b.rect(x0, g.foot - 25, x1 - x0, 3, tone(BRIGHT));

  // Grand arc de décharge : deux rouleaux de claveaux autour de l'ogive.
  b.arch(g.cx, g.foot, g.width + 34, g.clear + 22, tone(BRIGHT));
  b.arch(g.cx + 2, g.foot, g.width + 30, g.clear + 19, tone(DARK));
  b.arch(g.cx, g.foot, g.width + 22, g.clear + 14, tone(LIGHT));
  b.arch(g.cx + 2, g.foot, g.width + 18, g.clear + 11, tone(SHADOW));
  b.arch(g.cx, g.foot, g.width + 8, g.clear + 5, tone(MID));

  // Clef : un crâne de pierre.
  const keyY = g.foot - g.clear - 34;
  b.ellipse(g.cx, keyY, 14, 12, tone(GLARE));
  b.ellipse(g.cx + 2, keyY + 2, 12, 10, tone(BRIGHT));
  b.rect(g.cx - 8, keyY + 8, 16, 8, tone(BRIGHT));
  b.rect(g.cx - 7, keyY - 3, 5, 6, STONE[0]);
  b.rect(g.cx + 2, keyY - 3, 5, 6, STONE[0]);
  b.rect(g.cx - 1, keyY + 4, 2, 4, STONE[0]);
  for (let k = -6; k <= 6; k += 4) b.rect(g.cx + k, keyY + 11, 1, 5, STONE[0]);

  // Mâchicoulis du massif.
  const corbelY = top + 12;
  for (let x = Math.floor(x0 / 24) * 24; x < x1; x += 24) {
    b.rect(x, corbelY, 24, 12, STONE[0]);
    b.rect(x, corbelY, 8, 12, tone(BRIGHT));
    b.rect(x + 6, corbelY + 2, 2, 10, tone(DARK));
  }
  b.rect(x0, top - 4, x1 - x0, 16, tone(LIGHT));
  b.rect(x0, top - 4, x1 - x0, 2, tone(GLARE));
  merlons(b, x0, x1, top - 4, true);

  // Herse relevée : ses dents dépassent sous l'intrados.
  b.cutArch(g.cx, g.foot, g.width, g.clear);
  const spring = g.foot - g.clear + g.width * 0.86;
  for (let x = g.cx - g.width / 2 + 3; x < g.cx + g.width / 2; x += 11) {
    const y0 = g.foot - g.clear + Math.abs(x - g.cx) * 0.95;
    const y1 = spring - 22 + (Math.round(x) % 2) * 6;
    if (y1 <= y0) continue;
    b.rect(x, y0, 3, y1 - y0, IRON[1]);
    b.rect(x, y0, 1, y1 - y0, IRON[3]);
    b.poly([[x, y1], [x + 3, y1], [x + 1.5, y1 + 7]], IRON[2]);
  }
  b.rect(g.cx - g.width / 2 + 8, spring - 38, g.width - 16, 3, IRON[1]);
}

// ---------------------------------------------------------------------------
// Grande nef : le logis du donjon et la chapelle
// ---------------------------------------------------------------------------

export interface Hall {
  cx: number;
  /** Pied de la façade. */
  foot: number;
  halfWidth: number;
  depth: number;
  height: number;
  /** Hauteur du faîtage au-dessus des murs. */
  rise: number;
  /** Porte de façade. */
  doorWidth: number;
  doorHeight: number;
  /** Rayon de la rose. */
  rose: number;
  /** Largeur du trou réellement percé, pour y voir passer le héros. */
  passable: boolean;
  /** Abscisses des baies latérales, de part et d'autre. */
  lancets: readonly number[];
}

/** Rose gothique : un cercle de pierre, des rayons, un cœur de lumière. */
export function rose(b: Brush, cx: number, cy: number, r: number): void {
  b.ellipse(cx, cy, r + 5, r + 5, tone(GLARE));
  b.ellipse(cx + 1, cy + 1, r + 4, r + 4, tone(DARK));
  b.ellipse(cx, cy, r + 2, r + 2, STONE[0]);
  b.ellipse(cx, cy, r, r, GLASS.red);
  b.ellipse(cx, cy, r * 0.74, r * 0.74, GLASS.glow);
  b.ellipse(cx, cy, r * 0.3, r * 0.3, GLASS.core);
  const n = 12;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    for (let q = 0.26; q < 1.02; q += 0.5 / r) b.rect(cx + Math.cos(a) * q * r, cy + Math.sin(a) * q * r, 2, 2, STONE[0]);
    const lob = r * 0.68;
    b.ellipse(cx + Math.cos(a + 0.26) * lob, cy + Math.sin(a + 0.26) * lob, 2.2, 2.2, GLASS.blue);
  }
  b.ellipse(cx, cy, r * 0.13, r * 0.13, STONE[0]);
}

/** Pan de toit vu de l'avant. Tuiles en bandes parallèles au faîtage. */
function roofSlope(b: Brush, xOuter: number, xRidge: number, eaveS: number, eaveN: number, rise: number, colors: readonly [string, string, string]): void {
  const dir = xRidge > xOuter ? 1 : -1;
  const width = Math.abs(xRidge - xOuter);
  for (let i = 0; i < width; i++) {
    const px = xOuter + dir * i;
    const q = i / width;
    const lift = q * rise;
    b.rect(px, eaveN - lift, 1, eaveS - eaveN, colors[1]);
    const stripe = Math.floor(i / 18);
    if (i % 18 === 0) b.rect(px, eaveN - lift, 1, eaveS - eaveN, colors[0]);
    if (i % 18 === 1) b.rect(px, eaveN - lift, 1, eaveS - eaveN, colors[2]);
    // Rangs de tuiles : des tirets décalés d'une bande à l'autre.
    for (let y = eaveN - lift + (stripe % 2) * 10; y < eaveS - lift; y += 20) {
      if (stoneHash(stripe, Math.round((y + lift) / 20)) < 0.7) b.rect(px, y, 1, 2, colors[0]);
    }
  }
}

/** Lucarne à pignon, posée sur un pan de toit. */
function dormer(b: Brush, cx: number, foot: number, w: number, h: number): void {
  b.poly([[cx - w / 2 - 3, foot - h * 0.5], [cx, foot - h - 6], [cx + w / 2 + 3, foot - h * 0.5]], ROOF[4]);
  b.rect(cx - w / 2, foot - h * 0.5, w, h * 0.5, tone(LIGHT));
  b.poly([[cx - w / 2, foot - h * 0.5], [cx, foot - h], [cx + w / 2, foot - h * 0.5]], tone(LIGHT));
  b.rect(cx + w / 2 - 3, foot - h * 0.5, 3, h * 0.5, tone(DARK));
  lancet(b, cx, foot - 3, 8, 18);
}

/**
 * Flèche à huit pans : deux faces d'une lumière franche, un dos sombre et des crochets sur
 * l'arête. C'est elle qui donne au château sa silhouette à l'horizon.
 */
export function spire(b: Brush, cx: number, base: number, w: number, h: number): void {
  const apex = base - h;
  b.poly([[cx - w / 2, base], [cx, apex], [cx - w * 0.1, base]], ROOF[4]);
  b.poly([[cx - w * 0.1, base], [cx, apex], [cx + w * 0.2, base]], ROOF[3]);
  b.poly([[cx + w * 0.2, base], [cx, apex], [cx + w / 2, base]], ROOF[1]);
  for (let k = 1; k < 8; k++) {
    const q = k / 8, y = base - q * h, hw = (w / 2) * (1 - q);
    b.rect(cx - hw - 3, y, 5, 3, tone(BRIGHT));
    b.rect(cx + hw - 2, y, 5, 3, tone(MID));
  }
  b.rect(cx - w / 2 - 3, base - 3, w + 6, 6, tone(LIGHT));
  b.rect(cx - w / 2 - 3, base - 3, w + 6, 2, tone(GLARE));
  b.rect(cx - 1, apex - 22, 3, 24, IRON[2]);
  b.rect(cx - 7, apex - 16, 15, 3, IRON[2]);
}

/** Nef gothique : deux pans de toit fuyant vers le nord, et un pignon de façade à rose. */
export function paintHall(b: Brush, h: Hall): void {
  const { cx, foot, halfWidth: W, depth, height, rise } = h;
  const x0 = cx - W, x1 = cx + W;
  const eaveS = foot - height;
  const eaveN = eaveS - depth;
  const apexS = eaveS - rise;
  const apexN = eaveN - rise;

  b.rect(x0, foot, W * 2, 8, GROUND_SHADOW);

  // Les deux pans fuient vers le haut de l'écran : la lumière tombe sur celui de gauche.
  roofSlope(b, x0, cx, eaveS, eaveN, rise, [ROOF[2], ROOF[3], ROOF[4]]);
  roofSlope(b, x1, cx, eaveS, eaveN, rise, [ROOF[0], ROOF[1], ROOF[2]]);
  b.rect(cx - 2, apexN, 4, depth, tone(LIGHT));
  b.rect(cx - 2, apexN, 2, depth, tone(GLARE));
  for (let y = apexN + 30; y < apexS; y += 44) b.rect(cx - 4, y, 8, 5, tone(BRIGHT));

  const dormers = Math.floor(depth / 130);
  for (let i = 0; i < dormers; i++) {
    const y = eaveS - 90 - i * 130;
    dormer(b, x0 + W * 0.42, y - W * 0.42 * (rise / W), 44, 60);
    dormer(b, x1 - W * 0.42, y - W * 0.42 * (rise / W), 44, 60);
  }

  // Le pignon se peint en rectangle puis se taille en pointe, sur son propre calque.
  b.layer((f) => {
    masonry(f, x0, x1, apexS, foot, MID);
    masonry(f, x0, x1, foot - 26, foot, DARK);
    f.rect(x0, foot - 29, W * 2, 3, tone(BRIGHT));
    f.cut([[x0 - 2, apexS - 2], [cx, apexS - 2], [cx, apexS], [x0 - 2, eaveS]]);
    f.cut([[x1 + 2, apexS - 2], [cx, apexS - 2], [cx, apexS], [x1 + 2, eaveS]]);

    // Rampants de pierre, crochets réguliers le long de la pente.
    const steps = Math.round(W / 4);
    for (let k = 0; k <= steps; k++) {
      const q = k / steps;
      const y = eaveS - q * rise;
      f.rect(x0 + q * W - 3, y - 4, 8, 7, tone(BRIGHT));
      f.rect(x1 - q * W - 5, y - 4, 8, 7, tone(MID));
      f.rect(x0 + q * W - 3, y - 4, 8, 2, tone(GLARE));
      if (k % 5 === 2) {
        f.rect(x0 + q * W - 6, y - 12, 5, 8, tone(BRIGHT));
        f.rect(x1 - q * W + 2, y - 12, 5, 8, tone(MID));
      }
    }

    // Galerie d'arcatures sous la rose : elle donne l'échelle du héros à la façade.
    const gallery = foot - h.doorHeight - 44;
    f.rect(x0 + 20, gallery - 38, W * 2 - 40, 4, tone(GLARE));
    f.rect(x0 + 20, gallery + 4, W * 2 - 40, 6, tone(BRIGHT));
    f.rect(x0 + 20, gallery + 10, W * 2 - 40, 2, tone(SHADOW));
    for (let x = x0 + 34; x < x1 - 34; x += 26) {
      f.arch(x + 8, gallery + 4, 16, 36, STONE[0]);
      f.arch(x + 7, gallery + 4, 12, 30, tone(SHADOW));
      f.rect(x - 6, gallery - 34, 3, 38, tone(BRIGHT));
    }

    for (const dx of h.lancets) {
      lancet(f, cx + dx, foot - 56, 20, 96);
      lancet(f, cx - dx, foot - 56, 20, 96);
    }

    rose(f, cx, apexS + rise * 0.62, h.rose);

    // Portail à voussures : quatre rouleaux emboîtés et un gâble en pointe.
    const dw = h.doorWidth, dh = h.doorHeight;
    f.poly([[cx - dw / 2 - 40, foot - dh - 6], [cx, foot - dh - 62], [cx + dw / 2 + 40, foot - dh - 6]], tone(BRIGHT));
    f.poly([[cx - dw / 2 - 30, foot - dh - 6], [cx, foot - dh - 50], [cx + dw / 2 + 30, foot - dh - 6]], tone(DARK));
    f.arch(cx, foot, dw + 44, dh + 26, tone(GLARE));
    f.arch(cx + 1, foot, dw + 38, dh + 22, tone(DARK));
    f.arch(cx, foot, dw + 28, dh + 16, tone(BRIGHT));
    f.arch(cx + 1, foot, dw + 22, dh + 12, tone(SHADOW));
    f.arch(cx, foot, dw + 10, dh + 6, tone(LIGHT));
    if (h.passable) {
      f.cutArch(cx, foot, dw, dh);
    } else {
      f.arch(cx, foot, dw, dh, WOOD[1]);
      f.rect(cx - 1, foot - dh, 2, dh, WOOD[0]);
    }
    for (const side of [-1, 1]) buttress(f, cx + side * (W - 18) - 15, eaveS + 30, foot, 30);
  });
}

// ---------------------------------------------------------------------------
// Intérieurs
// ---------------------------------------------------------------------------

/** Tranche d'un mur coupé : le dessus sombre qui dit « on voit l'intérieur en coupe ». */
const CUT = { top: '#191826', edge: '#3a3952', hatch: '#23223a' } as const;

/** Mur intérieur est-ouest : une face peinte et une tranche sombre. */
export function paintInnerWall(b: Brush, x0: number, x1: number, y: number, depth: number, height: number, lancets: readonly number[] = []): void {
  const foot = y + depth;
  const faceTop = foot - height;
  masonry(b, x0, x1, faceTop, foot, DARK);
  b.rect(x0, foot - 12, x1 - x0, 12, tone(SHADOW));
  b.rect(x0, foot - 13, x1 - x0, 1, tone(LIGHT));
  // Arcatures aveugles : elles rythment une grande salle sans la remplir.
  if (height > 70) {
    for (let x = Math.floor(x0 / 88) * 88 + 44; x < x1 - 20; x += 88) {
      if (x < x0 + 20) continue;
      b.arch(x, foot - 12, 54, height - 26, tone(SHADOW));
      b.arch(x + 2, foot - 12, 48, height - 32, tone(DARK));
    }
  }
  for (const x of lancets) lancet(b, x, foot - 26, 26, Math.min(96, height - 34));
  b.rect(x0, y - height, x1 - x0, depth, CUT.top);
  b.rect(x0, y - height + depth - 2, x1 - x0, 2, CUT.edge);
  b.rect(x0, y - height, x1 - x0, 1, CUT.edge);
  for (let x = Math.floor(x0 / 12) * 12; x < x1; x += 12) b.rect(x, y - height + 3, 6, 1, CUT.hatch);
}

/** Mur intérieur nord-sud : on n'en voit que la tranche. */
export function paintInnerWallNS(b: Brush, x: number, y0: number, y1: number, depth: number, height: number): void {
  b.rect(x, y0 - height, depth, y1 - y0, CUT.top);
  b.rect(x, y0 - height, 1, y1 - y0, CUT.edge);
  b.rect(x + depth - 1, y0 - height, 1, y1 - y0, CUT.edge);
  for (let y = Math.floor((y0 - height) / 12) * 12; y < y1 - height; y += 12) b.rect(x + 3, y, depth - 6, 1, CUT.hatch);
  masonry(b, x, x + depth, y1 - height, y1, DARK);
}

/** Pilier gothique : fût rond, base moulurée, chapiteau. */
export function paintPillar(b: Brush, cx: number, foot: number, r: number, h: number): void {
  b.ellipse(cx + 3, foot + 1, r + 7, 6, GROUND_SHADOW);
  b.rect(cx - r - 6, foot - 12, r * 2 + 12, 12, tone(LIGHT));
  b.rect(cx - r - 6, foot - 12, r * 2 + 12, 2, tone(GLARE));
  b.rect(cx + r, foot - 10, 6, 10, tone(DARK));
  for (let px = Math.floor(cx - r); px < cx + r; px++) {
    const u = (px + 0.5 - cx) / r;
    b.rect(px, foot - h, 1, h - 12, tone(drumTone(u)));
  }
  // Colonnettes engagées : deux filets clairs le long du fût.
  b.rect(cx - r * 0.55, foot - h, 2, h - 12, tone(BRIGHT));
  b.rect(cx + r * 0.3, foot - h, 2, h - 12, tone(MID));
  b.rect(cx - r - 5, foot - h - 8, r * 2 + 10, 8, tone(LIGHT));
  b.rect(cx - r - 5, foot - h - 8, r * 2 + 10, 2, tone(GLARE));
  b.rect(cx + r - 1, foot - h - 6, 6, 6, tone(DARK));
  b.rect(cx - r - 3, foot - h, r * 2 + 6, 3, tone(SHADOW));
}

/** Trône de pierre noire sur son estrade à trois marches. */
export function paintThrone(b: Brush, cx: number, foot: number): void {
  for (let k = 0; k < 3; k++) {
    const w = 190 - k * 40, y = foot - k * 12;
    b.rect(cx - w / 2, y - 12, w, 12, tone(MID - (k % 2)));
    b.rect(cx - w / 2, y - 12, w, 2, tone(BRIGHT));
  }
  const y = foot - 36;
  // Dossier en pointe, plus haut qu'un héros debout.
  b.poly([[cx - 26, y], [cx - 26, y - 62], [cx - 12, y - 76], [cx, y - 96], [cx + 12, y - 76], [cx + 26, y - 62], [cx + 26, y]], STONE[1]);
  b.poly([[cx - 26, y], [cx - 26, y - 62], [cx - 12, y - 76], [cx, y - 96], [cx, y]], tone(MID));
  b.rect(cx - 16, y - 58, 32, 46, CLOTH[1]);
  b.rect(cx - 16, y - 58, 8, 46, CLOTH[2]);
  b.rect(cx - 30, y - 22, 60, 22, tone(LIGHT));
  b.rect(cx - 30, y - 22, 60, 3, tone(GLARE));
  b.rect(cx - 34, y - 34, 10, 34, tone(BRIGHT));
  b.rect(cx + 24, y - 34, 10, 34, tone(MID));
  b.ellipse(cx, y - 70, 7, 6, GOLD);
  b.rect(cx - 3, y - 73, 2, 2, STONE[0]);
  b.rect(cx + 1, y - 73, 2, 2, STONE[0]);
}

/** Longue table de banquet, avec ce qu'il en reste. */
export function paintTable(b: Brush, x: number, foot: number, w: number, depth: number): void {
  const h = 18;
  b.rect(x + 3, foot + 1, w, 5, GROUND_SHADOW);
  b.rect(x, foot - h - depth, w, depth, WOOD[2]);
  b.rect(x, foot - h - depth, w, 2, WOOD[3]);
  for (let k = 1; k < 4; k++) b.rect(x, foot - h - depth + (k * depth) / 4, w, 1, WOOD[1]);
  b.rect(x, foot - h, w, 5, WOOD[1]);
  for (const lx of [x + 6, x + w - 14]) b.rect(lx, foot - h + 5, 8, h - 5, WOOD[0]);
  for (let px = x + 30; px < x + w - 20; px += 62) {
    b.ellipse(px, foot - h - depth / 2, 7, 4, IRON[3]);
    b.ellipse(px, foot - h - depth / 2 - 1, 5, 2.4, IRON[1]);
    b.rect(px + 22, foot - h - depth / 2 - 8, 3, 8, GOLD);
    b.rect(px + 22, foot - h - depth / 2 - 11, 3, 3, GLASS.core);
  }
}

/** Candélabre haut sur pied : point de lumière d'une salle. */
export function paintCandelabra(b: Brush, cx: number, foot: number): void {
  b.ellipse(cx + 2, foot, 8, 3, GROUND_SHADOW);
  b.rect(cx - 5, foot - 3, 11, 3, IRON[2]);
  b.rect(cx - 1, foot - 54, 3, 52, IRON[1]);
  b.rect(cx - 1, foot - 54, 1, 52, IRON[3]);
  b.rect(cx - 11, foot - 46, 23, 2, IRON[2]);
  for (const dx of [-10, 0, 10]) {
    const top = foot - (dx === 0 ? 62 : 54);
    b.rect(cx + dx - 1, top + 4, 3, 4, '#d8cfbc');
    b.poly([[cx + dx - 2, top + 4], [cx + dx + 0.5, top - 4], [cx + dx + 3, top + 4]], GLASS.glow);
    b.rect(cx + dx, top, 2, 3, GLASS.core);
  }
}

/** Bibliothèque adossée à un mur : des dos de livres, par blocs de trois tons. */
export function paintBookshelf(b: Brush, x: number, foot: number, w: number, h: number): void {
  b.rect(x, foot - h, w, h, WOOD[1]);
  b.rect(x, foot - h, w, 3, WOOD[3]);
  b.rect(x, foot - h, 3, h, WOOD[2]);
  const inks = [CLOTH[1], '#27476b', '#3c5a33', '#6a4a22', '#4a2a5a', CLOTH[2], '#2a2a44'];
  for (let y = foot - h + 6; y < foot - 16; y += 24) {
    b.rect(x + 4, y, w - 8, 20, WOOD[0]);
    for (let px = x + 5; px < x + w - 7; ) {
      const bw = 3 + Math.floor(stoneHash(px, y) * 4);
      const bh = 12 + Math.floor(stoneHash(y, px) * 6);
      if (stoneHash(px + 1, y + 1) < 0.86) {
        b.rect(px, y + 20 - bh, bw, bh, inks[Math.floor(stoneHash(px, y + 3) * inks.length)]!);
        b.rect(px, y + 20 - bh, 1, bh, '#ffffff14');
      }
      px += bw + 1;
    }
    b.rect(x + 3, y + 20, w - 6, 3, WOOD[2]);
  }
}

/** Râtelier d'armes : lances, épées, boucliers. */
export function paintWeaponRack(b: Brush, x: number, foot: number, w: number): void {
  b.rect(x, foot - 44, w, 5, WOOD[2]);
  b.rect(x, foot - 16, w, 5, WOOD[2]);
  for (const lx of [x + 2, x + w - 8]) b.rect(lx, foot - 54, 6, 54, WOOD[1]);
  for (let px = x + 12; px < x + w - 10; px += 14) {
    b.rect(px, foot - 62, 2, 54, WOOD[3]);
    b.poly([[px - 2, foot - 62], [px + 1, foot - 74], [px + 4, foot - 62]], IRON[3]);
  }
}

/** Armure vide sur son support. Elle regarde la salle ; le joueur croit qu'elle va bouger. */
export function paintArmor(b: Brush, cx: number, foot: number): void {
  b.ellipse(cx + 2, foot, 11, 4, GROUND_SHADOW);
  b.rect(cx - 10, foot - 6, 20, 6, tone(MID));
  b.rect(cx - 7, foot - 26, 5, 20, IRON[2]);
  b.rect(cx + 2, foot - 26, 5, 20, IRON[1]);
  b.rect(cx - 10, foot - 46, 20, 22, IRON[2]);
  b.rect(cx - 10, foot - 46, 6, 22, IRON[3]);
  b.rect(cx + 5, foot - 46, 5, 22, IRON[1]);
  b.rect(cx - 15, foot - 46, 5, 16, IRON[3]);
  b.rect(cx + 10, foot - 46, 5, 16, IRON[1]);
  b.rect(cx - 6, foot - 58, 12, 12, IRON[2]);
  b.rect(cx - 6, foot - 58, 4, 12, IRON[3]);
  b.rect(cx - 4, foot - 53, 8, 2, STONE[0]);
  b.rect(cx - 1, foot - 64, 2, 6, CLOTH[2]);
  b.rect(cx + 17, foot - 66, 2, 64, WOOD[3]);
  b.poly([[cx + 14, foot - 66], [cx + 18, foot - 80], [cx + 22, foot - 66]], IRON[3]);
}

/** Banc d'église. */
export function paintPew(b: Brush, x: number, foot: number, w: number): void {
  b.rect(x + 2, foot + 1, w, 3, GROUND_SHADOW);
  b.rect(x, foot - 22, w, 10, WOOD[1]);
  b.rect(x, foot - 22, w, 2, WOOD[3]);
  b.rect(x, foot - 12, w, 8, WOOD[2]);
  b.rect(x, foot - 12, w, 1, WOOD[3]);
  b.rect(x + 4, foot - 4, 6, 4, WOOD[0]);
  b.rect(x + w - 10, foot - 4, 6, 4, WOOD[0]);
}

/** Autel : un bloc de pierre, un drap, une lueur. */
export function paintAltar(b: Brush, cx: number, foot: number, w: number): void {
  b.rect(cx - w / 2 - 14, foot - 8, w + 28, 8, tone(MID));
  b.rect(cx - w / 2 - 14, foot - 8, w + 28, 2, tone(BRIGHT));
  b.rect(cx - w / 2, foot - 36, w, 28, tone(LIGHT));
  b.rect(cx - w / 2, foot - 54, w, 18, tone(BRIGHT));
  b.rect(cx - w / 2, foot - 54, w, 3, tone(GLARE));
  b.rect(cx - w * 0.3, foot - 54, w * 0.6, 34, CLOTH[1]);
  b.rect(cx - w * 0.3, foot - 54, 6, 34, CLOTH[2]);
  b.rect(cx - 2, foot - 88, 4, 34, GOLD);
  b.rect(cx - 10, foot - 78, 20, 4, GOLD);
}

/** Sarcophage à gisant, dans une salle ou une crypte. */
export function paintTomb(b: Brush, cx: number, foot: number): void {
  b.rect(cx - 30 + 3, foot, 60, 5, GROUND_SHADOW);
  b.rect(cx - 30, foot - 16, 60, 16, tone(MID));
  b.rect(cx - 30, foot - 16, 60, 2, tone(BRIGHT));
  for (let x = cx - 24; x < cx + 22; x += 12) b.arch(x + 4, foot - 2, 8, 10, tone(SHADOW));
  b.rect(cx - 30, foot - 42, 60, 26, tone(LIGHT));
  b.rect(cx - 30, foot - 42, 60, 2, tone(GLARE));
  b.rect(cx - 8, foot - 40, 16, 22, tone(BRIGHT));
  b.ellipse(cx, foot - 38, 5, 4, tone(GLARE));
}

/** Fontaine à vasque, dans la haute cour. L'eau a viré. */
export function paintFountain(b: Brush, cx: number, foot: number): void {
  b.ellipse(cx + 4, foot, 66, 20, GROUND_SHADOW);
  b.ellipse(cx, foot - 12, 62, 19, tone(LIGHT));
  b.ellipse(cx, foot - 18, 62, 19, tone(BRIGHT));
  b.ellipse(cx, foot - 18, 52, 15, tone(SHADOW));
  b.ellipse(cx, foot - 16, 50, 13, CLOTH[0]);
  b.ellipse(cx - 8, foot - 18, 30, 7, CLOTH[1]);
  b.rect(cx - 7, foot - 70, 14, 54, tone(LIGHT));
  b.rect(cx - 7, foot - 70, 4, 54, tone(BRIGHT));
  b.rect(cx + 3, foot - 70, 4, 54, tone(DARK));
  b.ellipse(cx, foot - 72, 24, 7, tone(BRIGHT));
  b.ellipse(cx, foot - 73, 18, 4, CLOTH[0]);
  b.ellipse(cx, foot - 86, 8, 13, tone(GLARE));
  b.rect(cx, foot - 94, 4, 20, tone(MID));
}

/** Puits couvert, repère au milieu d'une place. */
export function paintWell(b: Brush, cx: number, foot: number): void {
  b.ellipse(cx + 3, foot + 1, 34, 11, GROUND_SHADOW);
  b.ellipse(cx, foot - 8, 30, 11, tone(MID));
  b.rect(cx - 30, foot - 26, 60, 18, tone(MID));
  b.rect(cx - 30, foot - 26, 18, 18, tone(LIGHT));
  b.rect(cx + 14, foot - 26, 16, 18, tone(DARK));
  b.ellipse(cx, foot - 26, 30, 11, tone(BRIGHT));
  b.ellipse(cx, foot - 26, 22, 7, STONE[0]);
  for (const dx of [-27, 23]) {
    b.rect(cx + dx, foot - 74, 5, 50, WOOD[1]);
    b.rect(cx + dx, foot - 74, 2, 50, WOOD[3]);
  }
  b.poly([[cx - 40, foot - 70], [cx, foot - 98], [cx + 40, foot - 70]], WOOD[2]);
  b.poly([[cx, foot - 98], [cx + 40, foot - 70], [cx, foot - 70]], WOOD[1]);
  b.rect(cx - 40, foot - 70, 80, 3, WOOD[3]);
  b.rect(cx - 24, foot - 58, 48, 3, WOOD[3]);
  b.rect(cx - 1, foot - 56, 2, 24, IRON[2]);
  b.rect(cx - 4, foot - 34, 8, 6, WOOD[2]);
}

/** Tas d'éboulis : de gros blocs francs, jamais du gravier. */
export function paintRubble(b: Brush, x: number, foot: number, w: number, h: number, seed: number): void {
  b.ellipse(x + w / 2 + 3, foot - 2, w / 2 + 3, 6, GROUND_SHADOW);
  const n = Math.round(w / 9);
  for (let k = 0; k < n; k++) {
    const q = (stoneHash(seed, k) * 2 - 1);
    const hh = h * (1 - q * q);
    const bx = x + w / 2 + (q * w) / 2;
    const by = foot - stoneHash(k, seed) * hh;
    const s = 7 + stoneHash(seed + k, 9) * 10;
    b.rect(bx - s / 2, by - s, s, s, tone(3 + Math.floor(stoneHash(seed, k + 5) * 2)));
    b.rect(bx - s / 2, by - s, s, 2, tone(GLARE - 1));
    b.rect(bx + s / 2 - 2, by - s + 2, 2, s - 2, tone(SHADOW));
  }
}

/** Mannequin d'entraînement, dans la basse-cour. */
export function paintDummy(b: Brush, cx: number, foot: number): void {
  b.ellipse(cx + 2, foot, 9, 3, GROUND_SHADOW);
  b.rect(cx - 2, foot - 48, 5, 48, WOOD[2]);
  b.rect(cx - 2, foot - 48, 2, 48, WOOD[3]);
  b.rect(cx - 17, foot - 40, 34, 4, WOOD[2]);
  b.rect(cx - 9, foot - 44, 18, 26, '#7a6b49');
  b.rect(cx - 9, foot - 44, 5, 26, '#94845c');
  b.rect(cx + 4, foot - 44, 5, 26, '#5a4e36');
  b.ellipse(cx, foot - 52, 7, 7, '#7a6b49');
  b.ellipse(cx - 2, foot - 54, 3, 3, '#94845c');
}

/** Gibet : ce que le château faisait de ses visiteurs. */
export function paintGibbet(b: Brush, cx: number, foot: number): void {
  b.ellipse(cx + 2, foot, 18, 5, GROUND_SHADOW);
  b.rect(cx - 14, foot - 8, 28, 8, tone(MID));
  b.rect(cx - 14, foot - 8, 28, 2, tone(BRIGHT));
  b.rect(cx - 3, foot - 96, 7, 90, WOOD[1]);
  b.rect(cx - 3, foot - 96, 3, 90, WOOD[3]);
  b.rect(cx - 3, foot - 96, 44, 6, WOOD[2]);
  b.rect(cx - 3, foot - 96, 44, 2, WOOD[3]);
  b.poly([[cx + 4, foot - 70], [cx + 26, foot - 90], [cx + 26, foot - 84], [cx + 4, foot - 64]], WOOD[1]);
  b.rect(cx + 34, foot - 90, 2, 14, IRON[2]);
  // La cage et son occupant.
  b.rect(cx + 25, foot - 76, 20, 34, '#0c0b1466');
  for (let x = cx + 25; x <= cx + 45; x += 5) b.rect(x, foot - 76, 2, 34, IRON[2]);
  b.rect(cx + 25, foot - 76, 22, 2, IRON[3]);
  b.rect(cx + 25, foot - 44, 22, 2, IRON[3]);
  b.ellipse(cx + 35, foot - 66, 5, 5, '#d8cfbc');
  b.rect(cx + 33, foot - 62, 5, 16, '#a89c8a');
}

/** Arbre mort, à l'échelle des arbres du monde : il pousse entre les dalles de la cour. */
export function paintDeadTree(b: Brush, cx: number, foot: number, h: number, seed: number): void {
  b.ellipse(cx + 3, foot, 16, 4, GROUND_SHADOW);
  b.poly([[cx - 6, foot], [cx - 2, foot - h * 0.6], [cx + 2, foot - h * 0.6], [cx + 6, foot]], '#2b211d');
  b.poly([[cx - 6, foot], [cx - 2, foot - h * 0.6], [cx, foot - h * 0.6], [cx - 2, foot]], '#463630');
  const tips: [number, number, number, number][] = [
    [0, 0.5, -22, 0.84], [0, 0.56, 20, 0.92], [0, 0.42, 26, 0.62], [0, 0.46, -28, 0.56], [-10, 0.68, -18, 1], [10, 0.72, 8, 1.02],
  ];
  tips.forEach(([sx, sy, ex, ey], k) => {
    const jx = (stoneHash(seed, k) - 0.5) * 8;
    b.poly([[cx + sx - 2, foot - h * sy], [cx + ex + jx, foot - h * ey], [cx + sx + 2, foot - h * sy]], '#352a25');
  });
}

/** Pastille d'un lieu au bord de l'écran : une tour et son toit, ou un pignon brisé. */
const beaconCache = new Map<string, HTMLCanvasElement>();
export function siteBeacon(kind: string): HTMLCanvasElement {
  const hit = beaconCache.get(kind);
  if (hit) return hit;
  const b = new Brush(0, 0, 14, 14);
  if (kind === 'castle') {
    b.rect(2, 7, 4, 7, tone(BRIGHT));
    b.rect(8, 7, 4, 7, tone(LIGHT));
    b.rect(5, 9, 4, 5, tone(MID));
    b.poly([[1, 7], [4, 1], [7, 7]], ROOF[4]);
    b.poly([[7, 7], [10, 1], [13, 7]], ROOF[4]);
  } else {
    b.rect(2, 8, 10, 6, tone(MID));
    b.poly([[1, 8], [5, 3], [8, 7], [11, 5], [13, 8]], tone(BRIGHT));
    b.rect(6, 10, 3, 4, STONE[0]);
  }
  const c = b.toCanvas();
  beaconCache.set(kind, c);
  return c;
}

// ---------------------------------------------------------------------------
// Sols
// ---------------------------------------------------------------------------

export type FloorKind = 'cobble' | 'flagstone' | 'dirt' | 'chapel' | 'tunnel' | 'wood';

const FLOOR_SIZE = 128;
const floorCache = new Map<FloorKind, HTMLCanvasElement>();

/**
 * Tuile de sol d'un lieu, 128 px, sans la moindre trame.
 *
 * Ces surfaces couvrent tout l'écran et défilent par pas de un ou deux pixels : un damier s'y
 * inverserait à chaque pas et l'image entière clignoterait. On ne pose donc que de grands
 * aplats, et le contraste reste bas : le sol doit porter la scène, pas la disputer aux monstres.
 */
export function floorTile(kind: FloorKind): HTMLCanvasElement {
  const hit = floorCache.get(kind);
  if (hit) return hit;
  const S = FLOOR_SIZE;
  const b = new Brush(0, 0, S, S);
  switch (kind) {
    case 'cobble': {
      // Un fond plat et des plaques de pavés : une cour, pas un mur couché sur le sol.
      b.rect(0, 0, S, S, '#24243a');
      for (let row = 0; row < 12; row++) {
        const h = S / 12;
        const stagger = (row % 2) * 9;
        for (let col = 0; col < 7; col++) {
          const x = col * 18 + stagger;
          const patch = stoneHash(Math.floor(col / 2), Math.floor(row / 3) + 40);
          const pick = stoneHash(col, row + 60);
          if (patch > 0.62 || pick > 0.8) continue;
          const c = pick < 0.34 ? '#2a2a42' : '#27273e';
          for (const wrap of [0, S]) {
            b.rect(x + 2 - wrap, row * h + 2, 14, h - 4, c);
            b.rect(x + 2 - wrap, row * h + 2, 14, 1, '#2e2f4a');
          }
        }
      }
      break;
    }
    case 'flagstone': {
      b.rect(0, 0, S, S, '#1b1b2e');
      for (let row = 0; row < 3; row++) {
        const h = S / 3;
        for (let x = (row % 2) * 24 - 48; x < S; x += 48) {
          const pick = stoneHash(((x % S) + S) % S, row + 20);
          const c = pick < 0.4 ? '#2a2a42' : pick < 0.8 ? '#26263c' : '#2e2e48';
          for (const wrap of [0, S]) {
            b.rect(x + 1 - wrap, row * h + 1, 46, h - 2, c);
            b.rect(x + 1 - wrap, row * h + 1, 46, 1, '#343550');
          }
        }
      }
      break;
    }
    case 'chapel': {
      // Pavement à grands carreaux alternés : deux tons proches, jamais un damier serré.
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          b.rect(col * 64, row * 64, 64, 64, (row + col) % 2 ? '#2a2638' : '#322d42');
          b.rect(col * 64, row * 64, 64, 1, '#1b1826');
          b.rect(col * 64, row * 64, 1, 64, '#1b1826');
        }
      }
      break;
    }
    case 'dirt': {
      b.rect(0, 0, S, S, '#25222e');
      for (let k = 0; k < 12; k++) {
        const x = stoneHash(k, 1) * S, y = stoneHash(k, 2) * S;
        b.rect(x, y, 10 + stoneHash(k, 3) * 26, 3 + stoneHash(k, 4) * 5, k % 2 ? '#2a2733' : '#211e29');
      }
      break;
    }
    case 'tunnel': {
      b.rect(0, 0, S, S, '#0f0e18');
      for (let y = 0; y < S; y += 32) b.rect(0, y, S, 1, '#191826');
      break;
    }
    case 'wood': {
      b.rect(0, 0, S, S, '#2a1e18');
      for (let y = 0; y < S; y += 16) {
        b.rect(0, y, S, 1, '#1a110d');
        b.rect(((y * 7) % 128), y, 1, 16, '#1a110d');
      }
      break;
    }
  }
  const c = b.toCanvas();
  floorCache.set(kind, c);
  return c;
}

/** Tapis de nef, avec son galon doré, sur le sol d'une salle. */
export function paintCarpet(b: Brush, x: number, y: number, w: number, h: number): void {
  b.rect(x, y, w, h, CLOTH[1]);
  b.rect(x, y, 6, h, CLOTH[0]);
  b.rect(x + w - 6, y, 6, h, CLOTH[0]);
  b.rect(x + 7, y, 2, h, GOLD);
  b.rect(x + w - 9, y, 2, h, GOLD);
  b.rect(x + 14, y, w - 28, h, CLOTH[2]);
  for (let ly = y + 20; ly < y + h - 10; ly += 56) {
    b.poly([[x + w / 2, ly - 12], [x + w / 2 + 12, ly], [x + w / 2, ly + 12], [x + w / 2 - 12, ly]], CLOTH[1]);
  }
}

/** Marches de pierre, devant un portail. */
export function paintSteps(b: Brush, cx: number, foot: number, w: number, n: number): void {
  for (let k = 0; k < n; k++) {
    const y = foot - n * 12 + k * 12;
    b.rect(cx - w / 2 - k * 6, y, w + k * 12, 12, tone(MID));
    b.rect(cx - w / 2 - k * 6, y, w + k * 12, 3, tone(BRIGHT));
    b.rect(cx - w / 2 - k * 6, y + 10, w + k * 12, 2, tone(SHADOW));
  }
}

/** Colonne de lune tombée d'une verrière : un parallélogramme plat, translucide, sans dégradé. */
export function paintMoonlight(b: Brush, x: number, y: number, w: number, h: number): void {
  b.poly([[x, y], [x + w, y], [x + w + h * 0.3, y + h], [x + h * 0.3, y + h]], '#6f86c228');
}

/** Ombre portée d'une courtine nord-sud sur le sol de la cour. */
export function paintWallShadow(b: Brush, x: number, y0: number, y1: number, w: number): void {
  b.rect(x, y0, w, y1 - y0, GROUND_SHADOW);
}
