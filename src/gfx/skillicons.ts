import { clearFrame, composite, createFrame, createFx, effects } from '../../vendor/pixelfx/src/sanguine.js';
import type { Rarity } from './palette';
import { FRAGMENT_ART, LOOT_ART, SHRINE_ART } from './lootart';
import { RELIC_ART } from './relicart';
import { ART_COLORS, PASSIVE_ART, WEAPON_ART, type ArtRows } from './skillart';
import type { SpriteSet } from './sprites';

/**
 * Les icônes des compétences : le dessin à la main (`skillart.ts`, `relicart.ts`), rendu immobile
 * pour le HUD et les listes, et animé par pixelfx sur les cartes.
 */

export type SkillKind = 'weapon' | 'relic' | 'passive' | 'loot';

/** 24 colonnes, plus une de contour de chaque côté. */
export const ICON_SIZE = 26;

const OUTLINE = '#08060c';
/** Marge autour de l'objet, laissée aux effets : une flèche d'arc ne doit pas être coupée. */
const LIVING_SIZE = 44;
const LIVING_FRAMES = 24;
const LIVING_FPS = 15;
/** Durée de la boucle animée d'une carte, en secondes. */
export const LIVING_LOOP = LIVING_FRAMES / LIVING_FPS;

export type SkillLife = 'gleam' | 'volt' | 'flame' | 'soul' | 'holy' | 'frost' | 'blood' | 'poison' | 'smoke' | 'dark';

const WEAPON_LIFE: Readonly<Record<string, SkillLife>> = {
  cross: 'holy', crucifixion: 'holy', kaleidoscope: 'holy',
  garlic: 'poison', aioli: 'poison', thorns: 'poison',
  water: 'frost', mirror: 'frost', salt: 'frost', deluge: 'frost',
  lantern: 'flame', brazier: 'flame', comet: 'flame', furnace: 'flame', packcall: 'flame',
  judgement: 'volt', wrath: 'volt',
  familiar: 'dark', swarm: 'dark',
  tainted: 'blood', harvest: 'blood',
  censer: 'smoke',
  souls: 'soul',
};

const RELIC_LIFE: Readonly<Record<string, SkillLife>> = {
  warmvial: 'smoke', blessedash: 'smoke', lastbreath: 'smoke',
  beatingheart: 'blood', spilledchalice: 'blood', bloodpact: 'blood',
  amber: 'holy', huntermark: 'holy',
  glasseye: 'frost', pocketmirror: 'frost',
  fracturedorb: 'volt',
  deaflantern: 'flame',
  ravenfeather: 'dark',
};

const PASSIVE_LIFE: Readonly<Record<string, SkillLife>> = {
  chalice: 'blood',
  grimoire: 'dark',
  clover: 'poison',
  hourglass: 'frost', talisman: 'frost',
  powder: 'flame',
  reliquary: 'holy',
};

const LOOT_LIFE: Readonly<Record<string, SkillLife>> = {
  heart: 'blood', bomb: 'flame', censer: 'smoke', hourglass: 'frost', sceau: 'holy', hieroglyphe: 'frost',
};

const LOOT: Readonly<Record<string, ArtRows>> = { ...LOOT_ART, ...FRAGMENT_ART, ...SHRINE_ART };

const RARITY_AURA: Readonly<Record<Rarity, string>> = {
  common: '',
  rare: '#5b9df5',
  epic: '#a855f7',
  cursed: '#dc2626',
};

function artOf(kind: SkillKind, id: string): ArtRows {
  const rows = (kind === 'weapon' ? WEAPON_ART : kind === 'relic' ? RELIC_ART : kind === 'passive' ? PASSIVE_ART : LOOT)[id];
  if (!rows) throw new Error(`Dessin inconnu : ${kind} ${id}`);
  return rows;
}

const stills = new Map<string, HTMLCanvasElement>();

/** Une carte de lettres sur un canvas, quelle que soit sa taille, avec son contour noir. */
function artCanvas(rows: ArtRows): HTMLCanvasElement {
  const w = rows[0]!.length;
  const h = rows.length;
  const c = document.createElement('canvas');
  c.width = w + 2;
  c.height = h + 2;
  const ctx = c.getContext('2d')!;
  const filled = (x: number, y: number): boolean => (rows[y]?.[x] ?? '.') !== '.';
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      const inside = filled(x, y);
      if (!inside && !(filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1))) continue;
      ctx.fillStyle = inside ? ART_COLORS[rows[y]![x]!]! : OUTLINE;
      ctx.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  return c;
}

/** Le dessin seul. Toujours recopié par l'appelant s'il doit le modifier. */
export function skillIcon(kind: SkillKind, id: string): HTMLCanvasElement {
  const key = `${kind}:${id}`;
  let c = stills.get(key);
  if (!c) {
    c = artCanvas(artOf(kind, id));
    stills.set(key, c);
  }
  return c;
}

/** Le passif d'origine, teinté : un surpassement prolonge un objet connu sans se confondre avec lui. */
export function tintedPassive(id: string, color: string): HTMLCanvasElement {
  const key = `tint:${id}:${color}`;
  let c = stills.get(key);
  if (!c) {
    const base = skillIcon('passive', id);
    c = base.cloneNode(true) as HTMLCanvasElement;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(base, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
    stills.set(key, c);
  }
  return c;
}

/** Montée et descente par pixels entiers : un objet posé respire sans jamais baver. */
const FLOAT = [0, 0, 1, 1, 1, 1, 0, 0] as const;
/** Largeur apparente d'une pièce qui tourne sur elle-même. */
const COIN_SPIN = [1, 0.8, 0.45, 0.16, 0.45, 0.8] as const;

/** Un petit objet flottant, avec un reflet qui le traverse une fois par tour. */
export function floatingFrames(rows: ArtRows): HTMLCanvasElement[] {
  const base = artCanvas(rows);
  return FLOAT.map((dy, i) => {
    const c = document.createElement('canvas');
    c.width = base.width;
    c.height = base.height + 1;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(base, 0, dy);
    if (i >= 3 && i <= 5) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255, 255, 255, .75)';
      const at = ((i - 3) / 2) * base.width;
      for (let y = 0; y < c.height; y++) ctx.fillRect(Math.round(at - y * 0.5), y, 2, 1);
    }
    return c;
  });
}

/** Une pièce : écrasée colonne par colonne, jamais lissée. */
export function spinningFrames(rows: ArtRows): HTMLCanvasElement[] {
  const base = artCanvas(rows);
  return COIN_SPIN.map((k) => {
    const c = document.createElement('canvas');
    c.width = base.width;
    c.height = base.height;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const w = Math.max(2, Math.round(base.width * k));
    ctx.drawImage(base, Math.round((base.width - w) / 2), 0, w, base.height);
    return c;
  });
}

/** Copie d'une relique pour un élément d'interface : un canvas ne peut pas être à deux endroits. */
export function relicChipArt(id: string): HTMLCanvasElement {
  const icon = skillIcon('relic', id);
  const copy = icon.cloneNode(true) as HTMLCanvasElement;
  copy.getContext('2d')!.drawImage(icon, 0, 0);
  return copy;
}

/** Une icône d'objet comme planche d'une image, pour ce qui attend un `SpriteSet`. */
export function skillIconSet(kind: SkillKind, id: string): SpriteSet {
  const frame = skillIcon(kind, id);
  return { frames: [frame], flash: [frame], elite: [frame], w: frame.width, h: frame.height };
}

const living = new Map<string, SpriteSet>();

/**
 * L'objet animé par `skillLife`. Peint à la demande : une carte n'en montre que quelques-uns, et
 * le jeu est en pause quand elle s'ouvre, donc ces quelques millisecondes ne se voient pas.
 */
export function livingSkillSet(kind: SkillKind, id: string, rarity?: Rarity): SpriteSet {
  const key = `${kind}:${id}`;
  const hit = living.get(key);
  if (hit) return hit;

  const life = (kind === 'weapon' ? WEAPON_LIFE : kind === 'relic' ? RELIC_LIFE : kind === 'passive' ? PASSIVE_LIFE : LOOT_LIFE)[id] ?? 'gleam';
  const seed = [...id].reduce((sum, ch) => sum * 31 + ch.charCodeAt(0), 7) & 0xffff;
  const frame = createFrame(LIVING_SIZE, LIVING_SIZE);
  const fx = createFx(effects.skillLife, {
    rows: artOf(kind, id), colors: ART_COLORS, life, seed, x: LIVING_SIZE / 2, y: LIVING_SIZE / 2,
    aura: rarity ? RARITY_AURA[rarity] : '',
    ramp: id === 'fracturedorb' ? 'amethyst' : '',
  });
  const pixels = new ImageData(LIVING_SIZE, LIVING_SIZE);
  const frames: HTMLCanvasElement[] = [];
  for (let i = 0; i < LIVING_FRAMES; i++) {
    clearFrame(frame);
    fx.draw(frame, 'back');
    fx.draw(frame, 'front');
    composite(frame, pixels.data, null);
    const c = document.createElement('canvas');
    c.width = LIVING_SIZE;
    c.height = LIVING_SIZE;
    c.getContext('2d')!.putImageData(pixels, 0, 0);
    frames.push(c);
    fx.update(1 / LIVING_FPS);
  }
  const set: SpriteSet = { frames, flash: frames, elite: frames, w: LIVING_SIZE, h: LIVING_SIZE };
  living.set(key, set);
  return set;
}
