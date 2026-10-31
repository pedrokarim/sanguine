import './ui/style.css';
import {
  makeBody, makeHero, makeGem, makeCoin, makeHeroClassique,
  makeGroundTile, makeSplat, CORPS_ECHELLE,
  type SpriteSet,
} from './gfx/sprites';
import { ENEMIES, BOSSES } from './data/enemies';
import { CHARACTERS } from './data/characters';
import { WEAPONS } from './data/weapons';
import { PASSIVES } from './data/passives';
import { RELICS } from './data/relics';
import { livingSkillSet } from './gfx/skillicons';
import {
  treeSprite, TREE_VARIANTS, BIOME_BY_ID,
  type PoiType, type TreeKind,
} from './game/terrain';
import { installDecor } from './ui/decor';
import { castleSheet, houseSheet, HOUSE_KINDS, holyGroundSheet, shrineSheet } from './gfx/sitesheet';

/**
 * Planche de tous les sprites du jeu.
 *
 * Page séparée, servie par la même construction que le jeu et alimentée par **les
 * générateurs eux-mêmes**. Elle ne peut donc jamais diverger de ce que le joueur voit : ce
 * n'est pas une documentation qu'on met à jour, c'est le jeu qui se montre.
 *
 * Sa raison d'être est de rendre les manques visibles. Tant que les sprites étaient
 * dispersés entre le Codex, le bestiaire et le terrain, il fallait fouiller pour repérer ce
 * qui n'avait pas suivi un changement d'échelle ou de palette. Ici tout est côte à côte, et
 * ce qui détonne saute aux yeux.
 */

const racine = document.getElementById('planche')!;
// Lève le verrouillage de défilement posé par la feuille du jeu — voir style.css.
document.documentElement.classList.add('planche');
installDecor();

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------

/** Compte les couleurs distinctes d'une image — la mesure du « détail » d'un sprite. */
function teintes(c: HTMLCanvasElement): number {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  const vues = new Set<number>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! < 8) continue;
    vues.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
  }
  return vues.size;
}

/** La cadence du héros en jeu : à une autre vitesse, la planche montrerait un mouvement faux. */
const HERO_FRAME_MS = 1000 / 12;

interface Vignette {
  /** Durée d'une image, pour un sprite qui n'a pas la cadence commune. */
  frameMs?: number;
  nom: string;
  frames: HTMLCanvasElement[];
  w: number;
  h: number;
  note?: string;
}

/** Une planche animée : les frames défilent, comme en jeu. */
function vignette(v: Vignette, zoom: number): HTMLElement {
  const el = document.createElement('figure');
  el.className = 'pl-cell';

  const scene = document.createElement('div');
  scene.className = 'pl-scene';
  const cv = document.createElement('canvas');
  cv.width = v.w;
  cv.height = v.h;
  cv.style.width = `${v.w * zoom}px`;
  cv.style.height = `${v.h * zoom}px`;
  const ctx = cv.getContext('2d')!;
  let i = 0;
  const jouer = (): void => {
    ctx.clearRect(0, 0, v.w, v.h);
    const f = v.frames[i % v.frames.length];
    if (f) ctx.drawImage(f, 0, 0);
    i++;
  };
  jouer();
  if (v.frames.length > 1) setInterval(jouer, v.frameMs ?? 140);
  scene.appendChild(cv);
  el.appendChild(scene);

  const cap = document.createElement('figcaption');
  const n = document.createElement('b');
  n.textContent = v.nom;
  cap.appendChild(n);
  const meta = document.createElement('span');
  meta.className = 'pl-meta';
  const nb = v.frames[0] ? teintes(v.frames[0]) : 0;
  meta.textContent = `${v.w}×${v.h} · ${v.frames.length} img · ${nb} teintes`;
  cap.appendChild(meta);
  if (v.note) {
    const note = document.createElement('span');
    note.className = 'pl-note';
    note.textContent = v.note;
    cap.appendChild(note);
  }
  el.appendChild(cap);
  return el;
}

function section(titre: string, sous: string, items: Vignette[], zoom = 4): void {
  const h = document.createElement('h2');
  h.innerHTML = `<span>${titre}</span><i>${items.length}</i>`;
  racine.appendChild(h);
  if (sous) {
    const p = document.createElement('p');
    p.className = 'pl-sous';
    p.textContent = sous;
    racine.appendChild(p);
  }
  const g = document.createElement('div');
  g.className = 'pl-grille';
  for (const it of items) g.appendChild(vignette(it, zoom));
  racine.appendChild(g);
}

const deSet = (nom: string, s: SpriteSet, note?: string): Vignette =>
  ({ nom, frames: s.frames, w: s.w, h: s.h, note });

/** Une créature à la cadence qu'elle a en jeu : sa foulée rapportée à sa vitesse de marche. */
const enSet = (nom: string, s: SpriteSet, speed: number): Vignette => {
  const gait = s.gait;
  const loop = gait && gait.stride > 0 && speed > 0 ? gait.stride / speed : gait?.period ?? 1;
  return { ...deSet(nom, s), frameMs: (loop * 1000) / s.frames.length };
};

// ---------------------------------------------------------------------------
// En-tête
// ---------------------------------------------------------------------------

const entete = document.createElement('header');
entete.className = 'pl-entete';
entete.innerHTML = `
  <h1>Planche des sprites</h1>
  <p class="pl-chapeau">Tout ce que le jeu sait dessiner, généré à l’instant par ses propres
  fonctions. Aucun fichier image n’intervient – cette page ne peut donc pas diverger du jeu.</p>
  <p class="pl-chapeau">Le compteur de <b>teintes</b> sous chaque vignette mesure le détail :
  c’est le nombre de couleurs distinctes réellement présentes. Un sprite agrandi sans travail
  d’ombrage garde le même compte qu’avant – c’est ce qui permet de repérer d’un coup d’œil ce
  qui a seulement grandi et ce qui a vraiment gagné en définition.</p>
  <p class="pl-chapeau">Échelle des corps en vigueur : <b>×${CORPS_ECHELLE}</b>.</p>`;
racine.appendChild(entete);

// ---------------------------------------------------------------------------
// Les sections
// ---------------------------------------------------------------------------

section('Héros', 'Six personnages, au repos et en marche. Le dernier est l’ancien style, laissé pour comparaison.',
  [
    ...CHARACTERS.flatMap((c) => [
      { ...deSet(`${c.name} — repos`, makeHero(`pl:${c.id}`, c.art, false)), frameMs: HERO_FRAME_MS },
      { ...deSet(`${c.name} — marche`, makeHero(`pl:${c.id}:w`, c.art, true)), frameMs: HERO_FRAME_MS },
    ]),
    deSet('Ysolde — ancien style', makeHeroClassique('pl:cmp', CHARACTERS[0]!.art, false), 'pour comparaison'),
  ], 5);

section('Ennemis', 'Chaque créature dans son animation de déplacement.',
  ENEMIES.map((e) => enSet(e.name, makeBody(`pl:e:${e.id}`, e.art), e.speed)), 4);

section('Boss', 'Neuf, dont la Faucheuse – invulnérable, elle met fin à la partie.',
  BOSSES.map((b) => enSet(b.name, makeBody(`pl:b:${b.id}`, b.art), b.speed)), 3);

section('Passifs', 'Même série que les armes : 24 colonnes, peints à la main.',
  PASSIVES.map((p) => deSet(p.name, livingSkillSet('passive', p.id))), 3);

section('Armes', 'Trente-trois objets peints à la main, sur 24 colonnes. Sur les cartes, pixelfx les anime.',
  WEAPONS.map((w) => deSet(w.name, livingSkillSet('weapon', w.id))), 3);

section('Reliques', 'Une par objet : la rareté se lit à l’aura, le dessin dit de quoi il s’agit.',
  RELICS.map((r) => deSet(r.name, livingSkillSet('relic', r.id, r.rarity))), 3);

section('Butin', 'Ce qui tombe au sol et se ramasse : petit pour ce qui fait tapis, grand pour ce qui compte.',
  [
    deSet('Gemme bleue', makeGem(0)), deSet('Gemme verte', makeGem(1)),
    deSet('Gemme rouge', makeGem(2)), deSet('Gemme violette', makeGem(3)),
    deSet('Or', makeCoin()),
    deSet('Cœur', livingSkillSet('loot', 'heart')), deSet('Coffre', livingSkillSet('loot', 'chest')),
  ], 3);

section('Objets', 'Ramassages à effet immédiat.',
  (['magnet', 'bomb', 'hourglass', 'scroll', 'censer'] as const).map((k) => deSet(k, livingSkillSet('loot', k))), 3);

section('Pièces de collection', 'Les quatre supports de l’Archive.',
  (['parchemin', 'sceau', 'hieroglyphe', 'pierre'] as const).map((k) => deSet(k, livingSkillSet('loot', k))), 3);

const BIOME_ARBRE: Record<TreeKind, string> = {
  pine: 'thicket', oak: 'graveyard', willow: 'mire', burnt: 'ashes',
  cypress: 'graveyard', mangrove: 'mire', mushroom: 'mire', obsidian: 'lava', frostpine: 'frost', crystal: 'frost',
};
section('Végétation', 'Quatre essences, quatre silhouettes par essence, deux tailles. Semées en bosquets plutôt qu’en semis régulier.',
  (['pine', 'oak', 'willow', 'burnt', 'cypress', 'mangrove', 'mushroom', 'obsidian', 'frostpine', 'crystal'] as TreeKind[]).flatMap((k) =>
    Array.from({ length: TREE_VARIANTS }, (_, v) => {
      const b = BIOME_BY_ID.get(BIOME_ARBRE[k])!;
      const c = treeSprite(k, v, true, b);
      return { nom: `${k} ${v + 1}`, frames: [c], w: c.width, h: c.height };
    })), 3);

section('Château', 'Le plan complet du premier château, vu du dehors puis avec ses toits levés. Trois écrans et demi de large, à l’échelle des arbres : une courtine dépasse le plus haut d’entre eux d’une fois et demie.',
  [
    { nom: 'Enveloppe', frames: [castleSheet(false)], w: 660, h: 640 },
    { nom: 'Intérieurs', frames: [castleSheet(true)], w: 660, h: 640 },
  ], 1);

section('Ruines', 'Les six maisons d’un bourg. Les murs sont peints à leur profil exact et leurs rectangles de collision à l’aplomb : ce qu’on voit est ce qui arrête.',
  HOUSE_KINDS.map((k) => {
    const c = houseSheet(k);
    return { nom: k, frames: [c], w: c.width, h: c.height };
  }), 2);

section('Structures', 'Bâties comme le château, à l’échelle des arbres. Atteindre leur pied les déclenche.',
  (['altar', 'pyre', 'obelisk', 'well', 'ossuary', 'chapel', 'cairn', 'windmill', 'hut', 'hangtree', 'forge', 'colossus'] as PoiType[]).map((t) => {
    const c = shrineSheet(t);
    return { nom: t, frames: [c], w: c.width, h: c.height };
  }), 1);

section('Lieux consacrés', 'Le cimetière, dont les morts se lèvent à la première entrée, et le prieuré.',
  [
    { nom: 'cimetière', kind: 'cemetery', inside: false }, { nom: 'prieuré', kind: 'priory', inside: false },
    { nom: 'prieuré, intérieur', kind: 'priory', inside: true },
  ].map(({ nom, kind, inside }) => {
    const c = holyGroundSheet(kind as 'cemetery' | 'priory', inside);
    return { nom, frames: [c], w: c.width, h: c.height };
  }), 1);

section('Tuiles de sol', 'Quatre variantes, tirées de la même graine que le biome.',
  [0, 1, 2, 3].map((i) => {
    const c = makeGroundTile(i);
    return { nom: `variante ${i}`, frames: [c], w: c.width, h: c.height };
  }), 1);

section('Éclaboussures', 'Traces laissées par les morts, semées au sol.',
  [0, 1, 2, 3, 4, 5].map((i) => {
    const c = makeSplat(i);
    return { nom: `tache ${i}`, frames: [c], w: c.width, h: c.height };
  }), 3);

// ---------------------------------------------------------------------------
// Bilan
// ---------------------------------------------------------------------------

const toutes = [...racine.querySelectorAll('.pl-meta')].map((e) => e.textContent ?? '');
const nb = toutes.length;
const moyTeintes = Math.round(
  toutes.reduce((s, t) => s + Number(/(\d+) teintes/.exec(t)?.[1] ?? 0), 0) / Math.max(1, nb));
const bilan = document.createElement('div');
bilan.className = 'pl-bilan';
bilan.innerHTML = `<b>${nb} sprites</b> générés · moyenne de <b>${moyTeintes} teintes</b> par image.`;
racine.appendChild(bilan);
