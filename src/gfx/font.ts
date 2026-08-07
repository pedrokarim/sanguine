/**
 * Police bitmap 3×5 générée par le code, pré-rendue en atlas par couleur.
 *
 * Les chiffres de dégâts sont l'élément le plus dessiné du jeu (plusieurs centaines par
 * seconde). `fillText` y serait catastrophique : chaque appel force un rasterisation de police.
 * Un atlas de glyphes réduit chaque chiffre à un `drawImage` d'une sous-région.
 */

const GLYPHS: Record<string, string> = {
  '0': '111101101101111',
  '1': '010110010010111',
  '2': '111001111100111',
  '3': '111001111001111',
  '4': '101101111001001',
  '5': '111100111001111',
  '6': '111100111101111',
  '7': '111001001001001',
  '8': '111101111101111',
  '9': '111101111001111',
  '+': '000010111010000',
  '-': '000000111000000',
  '!': '010010010000010',
  'k': '100101110101101',
  'M': '101111111101101',
  '.': '000000000000010',
  '%': '101001010100101',
  'x': '000101010101000',
};

const GW = 3;
const GH = 5;
const PAD = 1;
const CELL_W = GW + PAD;
const ORDER = Object.keys(GLYPHS);
const INDEX = new Map<string, number>(ORDER.map((ch, i) => [ch, i]));

const atlases = new Map<string, HTMLCanvasElement>();

/** Construit (ou récupère) l'atlas pour une couleur donnée, contour noir compris. */
export function atlas(color: string): HTMLCanvasElement {
  const hit = atlases.get(color);
  if (hit) return hit;

  const w = ORDER.length * CELL_W;
  const h = GH + 2;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  // Passe 1 : contour noir (le glyphe dilaté), pour rester lisible sur n'importe quel fond.
  ctx.fillStyle = '#000000';
  for (let g = 0; g < ORDER.length; g++) {
    const bits = GLYPHS[ORDER[g]!]!;
    const ox = g * CELL_W;
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        if (bits[y * GW + x] !== '1') continue;
        for (let dy = 0; dy <= 2; dy++)
          for (let dx = 0; dx <= 2; dx++) ctx.fillRect(ox + x + dx - 1 + 1, y + dy - 1 + 1, 1, 1);
      }
    }
  }
  // Passe 2 : le glyphe lui-même, par-dessus.
  ctx.fillStyle = color;
  for (let g = 0; g < ORDER.length; g++) {
    const bits = GLYPHS[ORDER[g]!]!;
    const ox = g * CELL_W;
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        if (bits[y * GW + x] === '1') ctx.fillRect(ox + x, y + 1, 1, 1);
      }
    }
  }

  atlases.set(color, c);
  return c;
}

/** Largeur d'une chaîne rendue à l'échelle `scale`. */
export function measure(text: string, scale = 1): number {
  return text.length * CELL_W * scale;
}

/**
 * Dessine `text` avec son coin supérieur gauche en (x, y).
 * `scale` doit rester entier pour préserver la netteté du pixel art.
 */
export function draw(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 1,
): void {
  const a = atlas(color);
  let cx = x;
  for (let i = 0; i < text.length; i++) {
    const idx = INDEX.get(text[i]!);
    if (idx === undefined) {
      cx += CELL_W * scale;
      continue;
    }
    ctx.drawImage(
      a,
      idx * CELL_W,
      0,
      CELL_W,
      GH + 2,
      cx,
      y,
      CELL_W * scale,
      (GH + 2) * scale,
    );
    cx += CELL_W * scale;
  }
}

/** Dessine centré horizontalement sur `x`. */
export function drawCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 1,
): void {
  draw(ctx, text, Math.round(x - measure(text, scale) / 2), Math.round(y), color, scale);
}
