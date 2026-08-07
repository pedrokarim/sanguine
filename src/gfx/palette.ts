/**
 * Palette fermée. Règle de saturation : plus un élément compte pour la survie du joueur,
 * plus il est saturé. Décor ~15 %, ennemis ~35 %, joueur ~75 %, dégâts 100 %.
 */

export const P = {
  // Décor – froid, désaturé, doit disparaître
  night: '#0b0d14',
  soil: '#131725',
  soilHi: '#1b2133',
  stone: '#232b40',
  stoneHi: '#2d3654',
  mist: '#38425f',

  // Ennemis – sombres, violacés
  fleshDead: '#3a2b46',
  flesh: '#4d3557',
  fleshHi: '#654166',
  bone: '#7c5175',
  boneHi: '#9a6b86',

  // Joueur & alliés – chaud, saturé
  gold: '#f2c46b',
  copper: '#e89a3c',
  leather: '#c96f2a',
  linen: '#f7ede0',
  steel: '#a8c5d6',

  // Sang & danger – rouge pur, exclusivement réservé aux dégâts
  bloodDark: '#8b1a2b',
  blood: '#c42639',
  bloodHi: '#f0405a',

  // Butin
  xp1: '#4ea9e8',
  xp2: '#4ee88a',
  xp3: '#f0405a',
  xp4: '#b968f0',

  // Effets
  white: '#ffffff',
  spark: '#fff3c4',
  ice: '#7de8ff',
  fire: '#ff9c3c',
  poison: '#8ef07a',
  shadow: '#05060a',
} as const;

export type PaletteKey = keyof typeof P;

/** Couleurs de rareté des reliques. */
export const RARITY_COLOR = {
  common: '#ffffff',
  rare: '#5b9df5',
  epic: '#a855f7',
  cursed: '#dc2626',
} as const;

export type Rarity = keyof typeof RARITY_COLOR;

/** `#rrggbb` → `[r, g, b]`. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number): string =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mélange deux couleurs hexadécimales. `t = 0` → a, `t = 1` → b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** Éclaircit (`amt > 0`) ou assombrit (`amt < 0`) une couleur. */
export function shade(hex: string, amt: number): string {
  return amt >= 0 ? mix(hex, '#ffffff', amt) : mix(hex, '#000000', -amt);
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
