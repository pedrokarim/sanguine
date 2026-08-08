import './ui/style.css';
import { Backdrop } from './ui/backdrop';
import { BloodLogo } from './ui/logo';
import { makeBody, makeHero, makeRelic, makeCoin, makeGem } from './gfx/sprites';
import { treeSprite, BIOME_BY_ID } from './game/terrain';
import { ENEMIES, BOSSES } from './data/enemies';
import { CHARACTERS } from './data/characters';

/**
 * Image de partage — Open Graph.
 *
 * Composée par **le code du jeu**, comme tout le reste : le décor de menu, le logo qui
 * saigne, les créatures et le butin sortent des mêmes générateurs que la partie. Une
 * illustration dessinée à part vieillirait dès la prochaine refonte de sprites ; celle-ci
 * suit.
 *
 * Format 1200 × 630, le rapport attendu par les réseaux. La page se photographie à cette
 * taille exacte — voir `tools/og.mjs`.
 *
 * Trois règles de composition :
 *
 *   1. **Le titre lisible en vignette.** Une image de partage est vue à 300 pixels de large
 *      dans un fil : si le nom ne se lit pas à cette taille, l'image ne sert à rien.
 *   2. **Une seule promesse.** Trente minutes, et rien d'autre. Une image qui énumère des
 *      fonctionnalités ne donne envie à personne.
 *   3. **Des créatures, pas une interface.** On partage un monde, pas un menu.
 */

const W = 1200;
const H = 630;

const scene = document.getElementById('og') as HTMLDivElement;
scene.style.width = `${W}px`;
scene.style.height = `${H}px`;

// ── le décor de menu, en fond ────────────────────────────────────────────────
/*
 * Le décor se rend dans un contexte, pas dans un élément : on lui donne un canvas à la
 * définition logique du jeu, qu'on étire ensuite. Le rendre à 1200 × 630 donnerait des
 * montagnes à la bonne taille mais des étoiles d'un pixel invisibles à l'échelle.
 */
const fond = document.createElement('canvas');
fond.width = 480;
fond.height = 252;
fond.className = 'og-fond';
const fctx = fond.getContext('2d')!;
new Backdrop(0x5a9).render(fctx, 3.2, fond.width, fond.height);
scene.appendChild(fond);

// ── le logo qui saigne ───────────────────────────────────────────────────────
const logo = new BloodLogo('SANGUINE');
logo.canvas.classList.add('og-logo');
scene.appendChild(logo.canvas);
// Une seule image suffit : on photographie, on n'anime pas. Mais il faut laisser le sang
// couler un peu, sinon le logo sort net et sans traînée.
logo.start();

const phrase = document.createElement('p');
phrase.className = 'og-phrase';
phrase.textContent = '« Tenez jusqu’à l’aube. Elle ne viendra pas. »';
scene.appendChild(phrase);

// ── la frise de créatures ────────────────────────────────────────────────────
/**
 * Une rangée de silhouettes en bas de l'image.
 *
 * Elles sont tirées des générateurs du jeu et posées à des tailles inégales, comme dans une
 * mêlée. Alignées à la même échelle, elles se liraient comme une planche de catalogue.
 */
const frise = document.createElement('div');
frise.className = 'og-frise';

const habitants: { c: HTMLCanvasElement; ech: number }[] = [];
const pousser = (frames: HTMLCanvasElement[], ech: number): void => {
  const f = frames[0];
  if (f) habitants.push({ c: f, ech });
};

pousser(makeHero(`og:${CHARACTERS[0]!.id}`, CHARACTERS[0]!.art, false).frames, 3.4);
for (const id of ['ghoul', 'wolf', 'bat', 'spider', 'zombie', 'wraith', 'skeleton']) {
  const def = ENEMIES.find((e) => e.id === id);
  if (def) pousser(makeBody(`og:e:${id}`, def.art).frames, 2.6 + (id === 'wolf' ? 0.4 : 0));
}
const boss = BOSSES.find((b) => b.id === 'matron');
if (boss) pousser(makeBody('og:b:matron', boss.art).frames, 1.7);

for (const { c, ech } of habitants) {
  const el = document.createElement('canvas');
  el.width = c.width;
  el.height = c.height;
  el.getContext('2d')!.drawImage(c, 0, 0);
  el.style.width = `${c.width * ech}px`;
  el.style.height = `${c.height * ech}px`;
  frise.appendChild(el);
}
scene.appendChild(frise);

// ── quelques objets semés, pour l'ambiance ──────────────────────────────────
const semer = (c: HTMLCanvasElement, x: number, y: number, ech: number): void => {
  const el = document.createElement('canvas');
  el.width = c.width;
  el.height = c.height;
  el.getContext('2d')!.drawImage(c, 0, 0);
  el.className = 'og-objet';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = `${c.width * ech}px`;
  el.style.height = `${c.height * ech}px`;
  scene.appendChild(el);
};
/*
 * Positions choisies pour ne rien recouvrir. Une première version posait la gemme sur la
 * tête du héros et la pièce dans la lune : à cette échelle, deux objets qui se chevauchent
 * se lisent comme un seul objet raté.
 */
semer(makeRelic('epic').frames[0]!, 132, 118, 3);
semer(makeCoin().frames[0]!, 866, 96, 3);
semer(makeGem(3).frames[0]!, 262, 486, 2.4);
semer(treeSprite('pine', 1, true, BIOME_BY_ID.get('thicket')!), 52, 296, 1.6);
semer(treeSprite('oak', 0, true, BIOME_BY_ID.get('graveyard')!), 1016, 322, 1.5);

// ── l'adresse, discrète ─────────────────────────────────────────────────────
const url = document.createElement('div');
url.className = 'og-url';
url.textContent = 'sanguine.ascencia.re';
scene.appendChild(url);

document.documentElement.classList.add('og-page');
