/** Persistance : une seule clé localStorage, un objet JSON versionné. */

const KEY = 'sanguine.save.v1';

export interface Options {
  master: number;
  sfx: number;
  music: number;

  /**
   * Échelle de toute l'interface. Par défaut **1.15** et non 1 : la taille d'origine était
   * lisible sur un grand écran de développement, beaucoup moins sur un portable — et un
   * réglage de confort doit partir d'une valeur confortable, pas d'un minimum.
   */
  hudScale: number;

  /** Intensité de la secousse de caméra, 0 = aucune. Volontairement basse par défaut. */
  shake: number;
  /** Supprime flashs plein écran et vignettes pulsées. */
  reduceFlash: boolean;
  /** Supprime les animations décoratives : coulures du logo, sprites du codex, transitions. */
  reduceMotion: boolean;
  /** Anneau permanent sous le joueur, pour ne jamais le perdre dans la horde. */
  highlightPlayer: boolean;
  /** Chiffres de dégâts flottants. Les couper réduit beaucoup le bruit visuel. */
  showDamage: boolean;
  /** Renforce le contraste des textes d'interface. */
  highContrast: boolean;
  /**
   * Vitesse de simulation, 0.6 à 1. Ce n'est pas un réglage de difficulté déguisé : le jeu
   * reste identique, il se déroule simplement moins vite, ce qui rend le kiting accessible
   * à des joueurs que la cadence d'origine exclut.
   */
  gameSpeed: number;
}

export interface Stats {
  runs: number;
  wins: number;
  kills: number;
  gems: number;
  goldEarned: number;
  bestTime: number;
  bestLevel: number;
}

/**
 * Reprise d'une partie interrompue.
 *
 * Ce n'est **pas** un instantané exact du monde : ni les ennemis, ni les projectiles, ni les
 * gemmes au sol n'y figurent. Sérialiser quinze cents entités serait volumineux, fragile, et
 * casserait au moindre changement de structure. On enregistre uniquement ce que le joueur a
 * *acquis* — son build, sa progression, les lieux qu'il a visités — et le director repeuple
 * le terrain à la reprise.
 *
 * Le joueur perd donc la vague en cours et les gemmes qu'il n'avait pas ramassées. C'est un
 * prix compréhensible pour une interruption, et cela rend la reprise robuste par construction.
 */
export interface RunSave {
  seed: number;
  charId: string;
  time: number;
  x: number;
  y: number;
  level: number;
  xp: number;
  hp: number;
  weapons: { id: string; level: number }[];
  passives: [string, number][];
  relics: string[];
  rerolls: number;
  revives: number;
  gold: number;
  kills: number;
  gems: number;
  damage: number;
  /** Clés des structures déjà activées, pour ne pas les rendre à nouveau utilisables. */
  poisUsed: string[];
  /** Index des événements de vague déjà déclenchés. */
  events: number[];
  reaper: boolean;
}

/** Cosmétiques possédés et équipés. Aucun n'influence le jeu. */
export interface CosmeticsSave {
  owned: string[];
  /** `kind` → identifiant équipé. */
  equipped: Record<string, string>;
}

export interface SaveData {
  version: 1;
  /** Partie en cours, `null` si aucune n'est interrompue. */
  run: RunSave | null;
  gold: number;
  /** `id d'amélioration du Sanctuaire` → niveau acheté. */
  sanctuary: Record<string, number>;
  unlockedChars: string[];
  seenWeapons: string[];
  seenRelics: string[];
  /** Ennemis rencontrés au moins une fois – alimente le bestiaire du codex. */
  seenEnemies: string[];
  stats: Stats;
  options: Options;
  cosmetics: CosmeticsSave;
}

function fresh(): SaveData {
  return {
    version: 1,
    run: null,
    gold: 0,
    sanctuary: {},
    unlockedChars: ['ysolde', 'anselme'],
    seenWeapons: [],
    seenRelics: [],
    seenEnemies: [],
    stats: { runs: 0, wins: 0, kills: 0, gems: 0, goldEarned: 0, bestTime: 0, bestLevel: 0 },
    options: {
      master: 0.8, sfx: 0.7, music: 0.45,
      hudScale: 1.15, shake: 0.4,
      reduceFlash: false, reduceMotion: false, highlightPlayer: false,
      showDamage: true, highContrast: false, gameSpeed: 1,
    },
    cosmetics: {
      owned: [],
      equipped: { trail: 'trail-none', theme: 'theme-stone', cursor: 'cursor-linen' },
    },
  };
}

/**
 * Fusionne la sauvegarde chargée avec la structure par défaut. Cela rend l'ajout de nouveaux
 * champs non destructif : une vieille sauvegarde ne perd rien et ne provoque pas d'`undefined`.
 */
function merge(loaded: unknown): SaveData {
  const base = fresh();
  if (!loaded || typeof loaded !== 'object') return base;
  const l = loaded as Partial<SaveData>;
  if (l.version !== 1) return base;
  return {
    version: 1,
    run: (l.run as RunSave | undefined) ?? null,
    gold: typeof l.gold === 'number' && isFinite(l.gold) ? Math.max(0, Math.floor(l.gold)) : 0,
    sanctuary: l.sanctuary && typeof l.sanctuary === 'object' ? { ...l.sanctuary } : {},
    unlockedChars: Array.isArray(l.unlockedChars)
      ? [...new Set([...base.unlockedChars, ...l.unlockedChars])]
      : base.unlockedChars,
    seenWeapons: Array.isArray(l.seenWeapons) ? l.seenWeapons : [],
    seenRelics: Array.isArray(l.seenRelics) ? l.seenRelics : [],
    seenEnemies: Array.isArray(l.seenEnemies) ? l.seenEnemies : [],
    stats: { ...base.stats, ...(l.stats ?? {}) },
    options: { ...base.options, ...(l.options ?? {}) },
    cosmetics: {
      owned: Array.isArray(l.cosmetics?.owned) ? l.cosmetics.owned : [],
      equipped: { ...base.cosmetics.equipped, ...(l.cosmetics?.equipped ?? {}) },
    },
  };
}

let cache: SaveData | null = null;

export function load(): SaveData {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = merge(raw ? JSON.parse(raw) : null);
  } catch {
    // localStorage indisponible (navigation privée, quota, iframe sandboxée) : on joue
    // quand même, simplement sans persistance.
    cache = fresh();
  }
  return cache;
}

export function save(): void {
  if (!cache) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* quota dépassé ou stockage refusé – on ignore silencieusement */
  }
}

export function update(fn: (s: SaveData) => void): SaveData {
  const s = load();
  fn(s);
  save();
  return s;
}

export function wipe(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignoré */
  }
  cache = fresh();
}
