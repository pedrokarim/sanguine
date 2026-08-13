import { clamp } from '../core/math';
import { makeProjectile, makePassiveSprite, makeIcon, type SpriteSet, type PassiveIcon } from '../gfx/sprites';
import { audio } from '../audio/audio';
import { P } from '../gfx/palette';
import { BASE_WEAPONS, weaponById, levelUpText, type WeaponDef } from '../data/weapons';
import { PASSIVES, passiveById } from '../data/passives';
import { describeMods, SURPASSEMENTS, romain, type Surpassement } from '../data/mods';
import { MAX_WEAPONS, MAX_PASSIVES, type Player } from './player';
import type { World } from './world';
import { t } from '../i18n';

/**
 * Tirage des cartes d'amélioration.
 *
 * Le tirage est **pondéré en faveur de ce que le joueur possède déjà** : sans cela, un build
 * ne pourrait jamais aboutir et chaque partie se terminerait avec six armes de niveau 2.
 * La chance déplace le curseur vers les nouveautés et débloque une quatrième carte.
 */

export type OfferKind =
  | 'weapon-new' | 'weapon-up' | 'passive-new' | 'passive-up' | 'consolation' | 'surpassement';

export interface Offer {
  kind: OfferKind;
  id: string;
  name: string;
  kindLabel: string;
  desc: string;
  levelLabel: string;
  icon: HTMLCanvasElement;
  isNew: boolean;
  apply: (w: World) => void;
}

const WEIGHT = {
  weaponUp: 100,
  passiveUp: 85,
  weaponNew: 70,
  passiveNew: 60,
} as const;

const iconCache = new Map<string, HTMLCanvasElement>();

/**
 * Icône d'un surpassement.
 *
 * Elle réemploie les planches de passifs plutôt que d'en dessiner de nouvelles : un
 * surpassement prolonge une statistique que le joueur connaît déjà par son objet, et lui
 * montrer la même forme dit cela sans une ligne de texte. La teinte, elle, est propre au
 * rang : on ne les confond pas avec un objet qu'on pourrait encore ramasser.
 */
const SURPASSEMENT_FORME: Record<string, PassiveIcon> = {
  'sur-might': 'gem', 'sur-area': 'lens', 'sur-cooldown': 'glass',
  'sur-hp': 'heart', 'sur-speed': 'boot', 'sur-pickup': 'magnet',
  'sur-armor': 'shield', 'sur-crit': 'clover',
};

function surpassementIcon(id: string): HTMLCanvasElement {
  const key = `s:${id}`;
  let c = iconCache.get(key);
  if (!c) {
    c = makeIcon(makePassiveSprite(SURPASSEMENT_FORME[id] ?? 'ring', '#c9a6ff'), 20);
    iconCache.set(key, c);
  }
  return c;
}

function weaponIcon(def: WeaponDef): HTMLCanvasElement {
  const key = `w:${def.id}`;
  let c = iconCache.get(key);
  if (!c) {
    c = makeIcon(makeProjectile(def.sprite, def.color), 20);
    iconCache.set(key, c);
  }
  return c;
}

function passiveIcon(id: string): HTMLCanvasElement {
  const key = `p:${id}`;
  let c = iconCache.get(key);
  if (!c) {
    const def = passiveById(id);
    c = makeIcon(makePassiveSprite(def.icon, def.color), 20);
    iconCache.set(key, c);
  }
  return c;
}

/** Sprite d'icône brut, réutilisé par le HUD. */
export function iconFor(kind: 'weapon' | 'passive', id: string): HTMLCanvasElement {
  return kind === 'weapon' ? weaponIcon(weaponById(id)) : passiveIcon(id);
}

export function weaponSpriteSet(def: WeaponDef): SpriteSet {
  return makeProjectile(def.sprite, def.color);
}

// ---------------------------------------------------------------------------
// Construction des offres
// ---------------------------------------------------------------------------

function offerWeaponUp(pl: Player, id: string): Offer {
  const inst = pl.weapon(id)!;
  const def = inst.def;
  return {
    kind: 'weapon-up',
    id,
    name: def.name,
    kindLabel: t('Arme', 'Weapon'),
    desc: levelUpText(def, inst.level + 1),
    levelLabel: t(`Niveau ${inst.level} → ${inst.level + 1}`, `Level ${inst.level} → ${inst.level + 1}`),
    icon: weaponIcon(def),
    isNew: false,
    apply: (w) => w.player.levelUpWeapon(id),
  };
}

function offerWeaponNew(def: WeaponDef): Offer {
  return {
    kind: 'weapon-new',
    id: def.id,
    name: def.name,
    kindLabel: t('Nouvelle arme', 'New weapon'),
    desc: def.desc,
    levelLabel: t('Niveau 1', 'Level 1'),
    icon: weaponIcon(def),
    isNew: true,
    apply: (w) => {
      w.player.addWeapon(def.id);
      w.particles.label(w.player.x, w.player.y - 16, '', P.gold);
    },
  };
}

function offerPassiveUp(pl: Player, id: string): Offer {
  const def = passiveById(id);
  const lvl = pl.passiveLevel(id);
  return {
    kind: 'passive-up',
    id,
    name: def.name,
    kindLabel: t('Objet', 'Item'),
    desc: describeMods(def.perLevel),
    levelLabel: t(`Niveau ${lvl} → ${lvl + 1}`, `Level ${lvl} → ${lvl + 1}`),
    icon: passiveIcon(id),
    isNew: false,
    apply: (w) => w.player.addPassive(id),
  };
}

function offerPassiveNew(id: string): Offer {
  const def = passiveById(id);
  return {
    kind: 'passive-new',
    id,
    name: def.name,
    kindLabel: t('Nouvel objet', 'New item'),
    desc: `${def.desc} (${describeMods(def.perLevel)})`,
    levelLabel: t('Niveau 1', 'Level 1'),
    icon: passiveIcon(id),
    isNew: true,
    apply: (w) => w.player.addPassive(id),
  };
}

/** Lot de secours : proposé uniquement quand plus rien n'est améliorable. */
function offerConsolation(variant: number): Offer {
  const opts = [
    {
      name: t('Bourse', 'Purse'),
      desc: t('+120 or, à dépenser au Sanctuaire.', '+120 gold to spend at the Sanctuary.'),
      apply: (world: World) => {
        world.gold += Math.round(120 * world.player.stats.greed);
      },
    },
    {
      name: t('Repas chaud', 'Hot Meal'),
      desc: t('Restaure 40 % des points de vie.', 'Restores 40% of your health.'),
      apply: (world: World) => {
        world.player.heal(world.player.stats.maxHp * 0.4);
      },
    },
    {
      name: t('Parchemin', 'Scroll'),
      desc: t('+1 reroll pour la suite de la partie.', '+1 reroll for the rest of the run.'),
      apply: (world: World) => {
        world.player.rerolls++;
      },
    },
  ];
  const o = opts[variant % opts.length]!;
  return {
    kind: 'consolation',
    id: `consolation-${variant}`,
    name: o.name,
    kindLabel: t('Provision', 'Supply'),
    desc: o.desc,
    levelLabel: '–',
    icon: passiveIcon('reliquary'),
    isNew: false,
    apply: o.apply,
  };
}

// ---------------------------------------------------------------------------
// Tirage
// ---------------------------------------------------------------------------

interface Category {
  weight: number;
  makers: (() => Offer)[];
}

/**
 * Les candidats sont groupés **par catégorie**, et le tirage choisit d'abord une catégorie
 * puis un élément à l'intérieur.
 *
 * C'est essentiel : une pondération à plat fait gagner la catégorie la plus **nombreuse**,
 * pas la plus lourde. Avec une seule arme possédée, dix-sept « nouvelle arme » à 70 écrasaient
 * l'unique « améliorer » à 100 – le joueur remplissait ses six emplacements avant la deuxième
 * minute, après quoi plus aucun choix intéressant ne se présentait.
 */
function buildCategories(w: World): Category[] {
  const pl = w.player;
  const luck = pl.stats.luck;

  const weaponUp: (() => Offer)[] = [];
  const passiveUp: (() => Offer)[] = [];
  const weaponNew: (() => Offer)[] = [];
  const passiveNew: (() => Offer)[] = [];

  for (const inst of pl.weapons) {
    if (inst.level < inst.def.maxLevel) {
      const wid = inst.def.id;
      weaponUp.push(() => offerWeaponUp(pl, wid));
    }
  }
  for (const [id, lvl] of pl.passives) {
    if (lvl < passiveById(id).maxLevel) passiveUp.push(() => offerPassiveUp(pl, id));
  }
  if (pl.weapons.length < MAX_WEAPONS) {
    for (const def of BASE_WEAPONS) {
      if (!pl.hasWeapon(def.id)) weaponNew.push(() => offerWeaponNew(def));
    }
  }
  if (pl.passives.size < MAX_PASSIVES) {
    for (const def of PASSIVES) {
      if (!pl.passives.has(def.id)) passiveNew.push(() => offerPassiveNew(def.id));
    }
  }

  return [
    { weight: WEIGHT.weaponUp, makers: weaponUp },
    { weight: WEIGHT.passiveUp, makers: passiveUp },
    { weight: WEIGHT.weaponNew * luck, makers: weaponNew },
    { weight: WEIGHT.passiveNew * luck, makers: passiveNew },
  ].filter((c) => c.makers.length > 0);
}

/** Tire `n` offres distinctes. Retombe sur les lots de secours si le build est complet. */
export function rollOffers(w: World, forced?: number): Offer[] {
  const pl = w.player;
  const extra = w.rng.next() < clamp((pl.stats.luck - 1) * 0.6, 0, 0.5);
  const n = forced ?? (extra ? 4 : 3);

  const cats = buildCategories(w);
  const picked: Offer[] = [];
  const seen = new Set<string>();

  // Le garde-fou d'itérations évite une boucle infinie quand les catégories restantes ne
  // peuvent plus produire que des offres déjà tirées.
  let guard = 0;
  while (picked.length < n && cats.length > 0 && guard++ < 60) {
    const ci = w.rng.weighted(cats.map((c) => c.weight));
    if (ci < 0) break;
    const cat = cats[ci]!;
    const mi = w.rng.int(0, cat.makers.length - 1);
    const offer = cat.makers[mi]!();
    // Retire le candidat consommé, et la catégorie si elle est épuisée.
    cat.makers.splice(mi, 1);
    if (cat.makers.length === 0) cats.splice(ci, 1);
    if (seen.has(offer.id)) continue;
    seen.add(offer.id);
    picked.push(offer);
  }

  /*
   * Rembourrage.
   *
   * Quand plus rien ne peut être amélioré — six armes au maximum, six objets au maximum —,
   * les cartes restantes viennent d'ici. Deux règles, toutes deux tirées d'une mesure :
   *
   *   – **des surpassements d'abord.** Mesuré au build complet, quarante montées de niveau
   *     d'affilée proposaient exactement la même main de trois lots de secours. Un niveau
   *     qui n'apporte rien n'est pas une récompense, c'est une interruption.
   *   – **jamais deux fois la même carte.** L'ancien rembourrage numérotait ses variantes
   *     puis les repliait sur trois libellés : à quatre cartes, la quatrième doublait la
   *     première une fois sur trois. Le tirage se fait donc sur un vivier dédupliqué.
   */
  if (picked.length < n) {
    const vivier: Offer[] = [
      ...SURPASSEMENTS.map((su) => offerSurpassement(pl, su)),
      ...[0, 1, 2].map((i) => offerConsolation(i)),
    ].filter((o) => !seen.has(o.id));

    let garde = 0;
    while (picked.length < n && vivier.length > 0 && garde++ < 40) {
      const i = w.rng.int(0, vivier.length - 1);
      const o = vivier.splice(i, 1)[0]!;
      seen.add(o.id);
      picked.push(o);
    }
  }
  return picked;
}

/**
 * Une carte de surpassement.
 *
 * Le compte déjà acquis est affiché en chiffres romains : « Rage tenace VII » dit d'un coup
 * d'œil qu'on est loin dans la partie, là où « Rage tenace » répété sept fois donnerait
 * l'impression d'un bégaiement de l'interface.
 */
function offerSurpassement(pl: Player, su: Surpassement): Offer {
  const deja = pl.surpassements.get(su.id) ?? 0;
  return {
    kind: 'surpassement',
    id: su.id,
    name: deja > 0 ? `${su.nom} ${romain(deja + 1)}` : su.nom,
    kindLabel: t('Surpassement', 'Transcendence'),
    desc: describeMods(su.mods),
    levelLabel: deja > 0 ? t(`Déjà ${deja}`, `Already ${deja}`) : t('Nouveau', 'New'),
    icon: surpassementIcon(su.id),
    isNew: deja === 0,
    apply: (world) => world.player.addSurpassement(su.id),
  };
}

// ---------------------------------------------------------------------------
// Évolutions
// ---------------------------------------------------------------------------

export interface Evolution {
  from: WeaponDef;
  to: WeaponDef;
}

/**
 * Une évolution est éligible quand l'arme est au niveau maximum **et** que le passif requis
 * est au niveau 3 ou plus. Elle ne sort jamais du menu de niveau : uniquement d'un coffre.
 * C'est ce qui rend les coffres réellement excitants.
 */
export function availableEvolutions(pl: Player): Evolution[] {
  const out: Evolution[] = [];
  for (const inst of pl.weapons) {
    const def = inst.def;
    if (!def.evolvesTo || !def.requires) continue;
    if (inst.level < def.maxLevel) continue;
    if (pl.passiveLevel(def.requires) < 3) continue;
    out.push({ from: def, to: weaponById(def.evolvesTo) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Coffres
// ---------------------------------------------------------------------------

export interface ChestResult {
  gold: number;
  offers: Offer[];
  evolution: Evolution | null;
  rerolls: number;
}

/**
 * Ouvre un coffre : 1, 3 ou 5 améliorations selon un tirage, plus de l'or.
 * Si une évolution est disponible, elle **remplace toujours** la première amélioration.
 */
export function openChest(w: World): ChestResult {
  const pl = w.player;
  const r = w.rng.next();
  let count: number;
  let gold: number;
  let rerolls = 0;

  if (r < 0.65) {
    count = 1;
    gold = 15;
  } else if (r < 0.9) {
    count = 3;
    gold = 40;
  } else if (r < 0.99) {
    count = 5;
    gold = 100;
  } else {
    count = 5;
    gold = 300;
    rerolls = 1;
  }

  count += pl.flag('chestBonus');
  gold = Math.round(gold * pl.stats.greed);

  const evos = availableEvolutions(pl);
  const evolution = evos.length > 0 ? evos[w.rng.int(0, evos.length - 1)]! : null;

  const offers = rollOffers(w, count - (evolution ? 1 : 0));

  return { gold, offers, evolution, rerolls };
}

/** Applique intégralement le contenu d'un coffre. */
export function applyChest(w: World, res: ChestResult): void {
  const pl = w.player;
  w.gold += res.gold;
  pl.rerolls += res.rerolls;

  if (res.evolution) {
    pl.evolveWeapon(res.evolution.from.id, res.evolution.to.id);
    audio.play('evolve');
    w.announce(res.evolution.to.name, t('évolution', 'evolution'));
    w.particles.beam(pl.x, pl.y, '#a855f7', 1.2);
    w.particles.ring(pl.x, pl.y, 60, '#a855f7', 0.7, 3);
    w.cam.shake(0.25, true);
  }

  for (const o of res.offers) o.apply(w);
}
