import { spriteSheet, makeCoin, makeGem, makeBody, makeChest, makeItem, makeHeart, type SpriteSet } from '../gfx/sprites';
import { enemyById } from '../data/enemies';

/**
 * Sprites du jeu insérés **dans le texte**, à hauteur de ligne.
 *
 * Écrire « 900 OR » quand la pièce existe déjà en sprite oblige le joueur à lire là où il
 * pourrait reconnaître. L'icône est la même partout — HUD, boutique, Sanctuaire — si bien
 * qu'elle finit par se lire seule, sans libellé.
 *
 * Les planches sont mises en cache : une même icône répétée cinquante fois dans la boutique
 * ne coûte qu'une seule génération et une seule `data:` URI.
 */

const sheets = new Map<string, ReturnType<typeof spriteSheet>>();

function sheetFor(key: string, make: () => SpriteSet): ReturnType<typeof spriteSheet> {
  let s = sheets.get(key);
  if (!s) {
    const set = make();
    // Facteur 2 : suffisant pour rester net à hauteur de texte, sans planche inutilement lourde.
    s = spriteSheet(`icon:${key}`, set, 2);
    sheets.set(key, s);
  }
  return s;
}

/** Icônes nommées, pour ne pas éparpiller les générateurs dans les écrans. */
const MAKERS: Record<string, () => SpriteSet> = {
  gold: () => makeCoin(),
  gem: () => makeGem(2),
  xp: () => makeGem(0),
  kills: () => makeBody('enemy:ghoul', enemyById('ghoul').art),
  chest: () => makeChest(),
  heart: () => makeHeart(),
  time: () => makeItem('hourglass'),
  scroll: () => makeItem('scroll'),
};

/**
 * Crée un sprite inline. `em` fixe la hauteur relative au texte environnant, ce qui laisse
 * l'icône suivre l'échelle d'interface choisie par le joueur.
 */
/**
 * Hauteur d'un sprite inline, en em du texte qu'il accompagne. Légèrement au-dessus de la
 * hauteur de capitale : en dessous, l'icône se perd sous la ligne ; au-dessus, elle bouscule
 * l'interligne. Une seule valeur pour toute l'interface — les tailles au cas par cas étaient
 * la seconde source d'incohérence.
 */
export const ICON_EM = 1.15;

export function icon(name: keyof typeof MAKERS | string, em = ICON_EM): HTMLSpanElement {
  const make = MAKERS[name];
  const el = document.createElement('span');
  el.className = 'icon-sprite';
  el.setAttribute('aria-hidden', 'true');
  if (!make) return el;

  const s = sheetFor(name, make);
  const ratio = s.w / s.h;
  const fw = em * ratio;

  el.style.height = `${em}em`;
  el.style.width = `${fw}em`;
  el.style.backgroundImage = `url("${s.url}")`;
  /*
   * `auto 100%` cale la planche sur la hauteur et laisse la largeur suivre : chaque frame
   * occupe alors exactement la largeur de l'élément.
   *
   * Le défilement se fait en **em**, jamais en pourcentage. Un `background-position` en
   * pourcentage se résout contre `taille de l'élément − taille de l'image` : sur une planche
   * plus large que sa boîte, cette différence est négative, le sens s'inverse et l'image
   * sort du cadre — l'icône disparaissait cinq frames sur six.
   */
  el.style.backgroundSize = 'auto 100%';
  if (s.frames > 1) {
    el.style.setProperty('--n', String(s.frames));
    el.style.setProperty('--end', `${-fw * s.frames}em`);
    el.style.setProperty('--dur', `${(s.frames * 0.16).toFixed(2)}s`);
    el.classList.add('anim');
  }
  return el;
}

/**
 * Valeur précédée de son icône.
 *
 * Retourne une **boîte** et non un fragment. La première version renvoyait un fragment
 * « pour s'insérer n'importe où sans ajouter de niveau de boîte » : l'écart entre le sprite
 * et son nombre dépendait alors du `gap` du parent, quel qu'il soit, additionné à une marge
 * portée par la valeur. Deux mécanismes qui se composaient au hasard, et cinq écarts
 * différents mesurés dans l'interface pour la même paire pièce + montant.
 *
 * Avec une boîte propre, l'écart interne est fixé une seule fois (`--icon-gap`) et le `gap`
 * du parent ne sépare plus que le couple du texte voisin — ce qui est son rôle.
 */
export function iconValue(name: string, value: string, em = ICON_EM): HTMLSpanElement {
  const box = document.createElement('span');
  box.className = 'icon-pair';
  box.appendChild(icon(name, em));
  const v = document.createElement('span');
  v.className = 'icon-value';
  v.textContent = value;
  box.appendChild(v);
  return box;
}
