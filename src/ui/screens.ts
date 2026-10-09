import { formatTime, abbrev } from '../core/math';
import { locale, setLanguage, t } from '../i18n';
import { load, save, update, wipe, type SaveData, type RunSave } from '../core/save';
import { audio } from '../audio/audio';
import {
  makeHero, makeIcon, makeProjectile, makeBody, makeRelic, makeGem, makeCoin, makeHeart,
  makeChest, makeItem, makePassiveSprite, spriteSheet,
  type Sheet, type SpriteSet,
} from '../gfx/sprites';
import { CHARACTERS, characterById, type CharacterDef } from '../data/characters';
import { META_UPGRADES, costOf } from '../data/meta';
import { RELICS, RELIC_BY_ID, RARITY_LABEL } from '../data/relics';
import { WEAPONS } from '../data/weapons';
import { PASSIVE_BY_ID, passiveById } from '../data/passives';
import { ENEMIES, BOSSES, enemyById, type EnemyAI } from '../data/enemies';
import type { Rarity } from '../gfx/palette';
import { iconFor, type Offer, type ChestResult } from '../game/upgrades';
import type { Player } from '../game/player';
import { BloodLogo, BLOOD, DAWN } from './logo';
import { iconValue } from './icons';
import { isTouch } from './mobile';
import { frameUrl } from './decor';
import { FxLayer } from '../gfx/fx';
import { Particles } from '../gfx/particles';
import type { Camera } from '../gfx/camera';
import { drawAura, drawAmbience, emitTrail } from '../gfx/cosmeticfx';
import {
  FRAGMENTS, CYCLES, EPILOGUE, TOTAL, TYPE_LABEL, roman,
  type FragmentDef,
} from '../data/fragments';
import { makeFragment } from '../gfx/sprites';
import {
  SKINS, TRAILS, THEMES, CURSORS, KIND_LABEL,
  type Cosmetic, type CosmeticKind,
} from '../data/cosmetics';

/** Libellés lisibles des comportements d'IA, pour le bestiaire. */
const AI_LABEL: Record<EnemyAI, string> = {
  chase: t('poursuite', 'chases'),
  wave: t('poursuite ondulante', 'weaving pursuit'),
  erratic: t('trajectoire erratique', 'erratic movement'),
  charger: t('charges répétées', 'repeated charges'),
  phase: t('traverse les corps', 'phases through bodies'),
  ranged: t('crache à distance', 'spits from range'),
  leech: t('se nourrit de vous', 'feeds on you'),
  dasher: t('ruée rectiligne', 'straight-line dash'),
  static: t('immobile', 'stationary'),
  split: t('se scinde à la mort', 'splits on death'),
};

/** La CSS nomme les raretés en anglais court ; la table évite d'éparpiller la correspondance. */
/**
 * Monture par rareté.
 *
 * Appliquée seulement aux objets **découverts** : une vignette encore silhouettée ne doit pas
 * révéler la rareté de ce qu'elle cache.
 */
const MONTURE: Record<Rarity, string> = {
  common: 'rar-commune',
  rare: 'rar-rare',
  epic: 'rar-epique',
  cursed: 'rar-maudite',
};

const RARITY_CSS: Record<Rarity, string> = {
  common: 'common',
  rare: 'rare',
  epic: 'epic',
  cursed: 'cursed',
};

/**
 * Écrans DOM. Chaque écran est reconstruit à l'affichage puis détruit – la fréquence est
 * faible (quelques fois par partie) et cela évite toute désynchronisation d'état.
 *
 * Tous les écrans sont navigables au clavier et à la manette : la sélection courante est
 * suivie explicitement plutôt que de s'en remettre au focus du navigateur, dont le
 * comportement diffère trop d'un moteur à l'autre.
 */

export interface RunSummary {
  time: number;
  level: number;
  kills: number;
  gold: number;
  damage: number;
  gems: number;
  relics: number;
  seed: number;
  character: string;
}

/**
 * Année et version affichées dans la mention de copyright. L'année est figée plutôt que
 * calculée : un écran-titre dont le copyright change tout seul au 1er janvier est un
 * détail qui trahit le bricolage.
 */
const P_GOLD = '#f2c46b';

const YEAR = 2026;
const VERSION = '1.0.0';

type Cleanup = () => void;

/** Taille logique d'un aperçu de boutique, agrandie trois fois à l'écran. */
const PREVIEW_W = 64;
const PREVIEW_H = 42;

export class Screens {
  private current: HTMLDivElement | null = null;
  private cleanup: Cleanup | null = null;
  /** Index sélectionné pour la navigation clavier. */
  private selIndex = 0;
  private selItems: HTMLElement[] = [];

  constructor(private readonly parent: HTMLElement) {}

  get isOpen(): boolean {
    return this.current !== null;
  }

  close(): void {
    this.cleanup?.();
    this.cleanup = null;
    this.current?.remove();
    this.current = null;
    this.selItems = [];
  }

  private open(cls: string): HTMLDivElement {
    this.close();
    const el = document.createElement('div');
    el.className = `screen ${cls}`;
    this.parent.appendChild(el);
    this.current = el;
    this.selIndex = 0;
    return el;
  }

  /** Active la navigation clavier/manette sur une liste d'éléments cliquables. */
  private navigable(items: HTMLElement[], columns = 1): void {
    this.selItems = items;
    this.selIndex = 0;
    this.highlight();

    const onKey = (e: KeyboardEvent): void => {
      const n = this.selItems.length;
      if (n === 0) return;
      let handled = true;
      switch (e.code) {
        case 'ArrowRight': case 'KeyD': this.selIndex = (this.selIndex + 1) % n; break;
        case 'ArrowLeft': case 'KeyA': case 'KeyQ': this.selIndex = (this.selIndex - 1 + n) % n; break;
        case 'ArrowDown': case 'KeyS': this.selIndex = Math.min(n - 1, this.selIndex + columns); break;
        case 'ArrowUp': case 'KeyW': case 'KeyZ': this.selIndex = Math.max(0, this.selIndex - columns); break;
        case 'Enter': case 'Space': case 'NumpadEnter':
          this.selItems[this.selIndex]?.click();
          handled = true;
          break;
        default: handled = false;
      }
      if (handled) {
        e.preventDefault();
        audio.play('select');
        this.highlight();
      }
    };
    window.addEventListener('keydown', onKey);
    const prev = this.cleanup;
    this.cleanup = (): void => {
      prev?.();
      window.removeEventListener('keydown', onKey);
    };
  }

  private highlight(): void {
    this.selItems.forEach((el, i) => el.classList.toggle('sel', i === this.selIndex));
    this.selItems[this.selIndex]?.scrollIntoView({ block: 'nearest' });
  }

  private button(label: string, cls = ''): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = `btn ${cls}`;
    b.textContent = label;
    b.addEventListener('pointerenter', () => audio.play('select'));
    return b;
  }

  // ------------------------------------------------------- tuiles chiffrées

  /**
   * Tuile de statistique : un sprite animé du jeu, une valeur, un intitulé.
   *
   * Une ligne de texte du type « 3,1 k ennemis abattus · 1,2 k gemmes » demande au joueur de
   * *lire* pour comprendre ; une gemme et une goule se reconnaissent d'un coup d'œil. Le jeu
   * dispose déjà de tous ces sprites — les afficher ne coûte rien et évite de traiter en
   * texte ce qui est, par nature, un vocabulaire visuel.
   */
  private statTile(key: string, set: SpriteSet, value: string, label: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'stat-tile';

    const stage = document.createElement('div');
    stage.className = 'stat-icon';
    stage.appendChild(this.spriteBlock(spriteSheet(`stat:${key}`, set, this.fitScale(set, 34, 30)), true, 0.7));

    const v = document.createElement('div');
    v.className = 'stat-value';
    v.textContent = value;
    const l = document.createElement('div');
    l.className = 'stat-label';
    l.textContent = label;

    el.append(stage, v, l);
    return el;
  }

  /** Variante compacte : sprite et valeur côte à côte, pour meubler un coin d'écran. */
  private statChip(key: string, set: SpriteSet, value: string, label: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'stat-chip';
    el.appendChild(this.spriteBlock(spriteSheet(`chip:${key}`, set, this.fitScale(set, 22, 20)), true, 0.7));
    const txt = document.createElement('div');
    txt.className = 'chip-text';
    const v = document.createElement('span');
    v.className = 'chip-value';
    v.textContent = value;
    const l = document.createElement('span');
    l.className = 'chip-label';
    l.textContent = label;
    txt.append(v, l);
    el.appendChild(txt);
    return el;
  }

  /** Groupe de puces ancré dans un coin de l'écran. */
  private statCorner(
    pos: 'tl' | 'tr' | 'bl' | 'br',
    items: [string, SpriteSet, string, string][],
  ): HTMLDivElement {
    const box = document.createElement('div');
    box.className = `stat-corner ${pos}`;
    for (const [k, set, v, l] of items) box.appendChild(this.statChip(k, set, v, l));
    return box;
  }

  private statStrip(items: [string, SpriteSet, string, string][]): HTMLDivElement {
    const strip = document.createElement('div');
    strip.className = 'stat-strip';
    for (const [k, set, v, l] of items) strip.appendChild(this.statTile(k, set, v, l));
    return strip;
  }

  // ------------------------------------------------------------------ titre

  title(
    onPlay: () => void,
    onSanctuary: () => void,
    onOptions: () => void,
    onCodex: () => void,
    onShop: () => void,
    onArchive: () => void,
    onProgress: () => void,
    savedRun: RunSave | null,
    onResume: () => void,
  ): void {
    const el = this.open('title');
    const sv = load();
    // Le personnage illustrant le compteur de parties est le dernier débloqué : il change
    // au fil de la progression, ce qui donne au bandeau une valeur de trophée.
    const lastChar = sv.unlockedChars[sv.unlockedChars.length - 1] ?? 'ysolde';

    // Logo en pixel art dont le sang coule, dessiné et animé par le code.
    /*
     * Le contenu centré vit dans son propre bloc, distinct de l'écran.
     *
     * La mention légale était posée en absolu contre le bas, et le menu centré passait
     * dessous dès qu'il grandissait — d'une entrée de plus, ou d'un joueur qui pousse la
     * taille de l'interface à 200 % dans les options. Réserver une bande chiffrée en bas
     * ne fait que déplacer le problème d'un cran. Ici le corps prend la place restante et
     * défile s'il le faut, le pied se range dessous : plus rien ne se superpose, à aucune
     * échelle, et il n'y a plus de hauteur magique à tenir à jour.
     */
    const corps = document.createElement('div');
    corps.className = 'title-corps';
    el.appendChild(corps);

    const logo = new BloodLogo('SANGUINE');
    const h1 = document.createElement('h1');
    h1.className = 'title-font';
    h1.appendChild(logo.canvas);
    corps.appendChild(h1);
    logo.start();
    // L'animation doit s'arrêter avec l'écran, sinon une boucle rAF survit au menu.
    const prevCleanup = this.cleanup;
    this.cleanup = (): void => {
      prevCleanup?.();
      logo.stop();
    };

    const fl = document.createElement('div');
    fl.className = 'flourish';
    const tag = document.createElement('p');
    tag.className = 'tagline';
    tag.textContent = t('« Tenez jusqu’à l’aube. Elle ne viendra pas. »', '“Hold until dawn. It will not come.”');
    corps.append(fl, tag);

    const list = document.createElement('div');
    list.className = 'menu-list';

    // La reprise passe **avant** « Jouer » et porte le contexte de la partie interrompue :
    // proposer « Jouer » en premier ferait perdre la partie sauvegardée d'un clic distrait.
    let bResume: HTMLButtonElement | null = null;
    if (savedRun) {
      const c = characterById(savedRun.charId);
      bResume = this.button(t(
        `Reprendre · ${formatTime(savedRun.time)} · niv ${savedRun.level}`,
        `Resume · ${formatTime(savedRun.time)} · lvl ${savedRun.level}`,
      ), 'primary');
      bResume.addEventListener('click', () => { audio.play('confirm'); onResume(); });
      const who = document.createElement('div');
      who.className = 'hint';
      who.textContent = `${c.name} ${c.epithet}`;
      // Le bouton et sa légende forment un bloc : sur écran bas de plafond le menu passe
      // sur deux colonnes, et sans cet emballage la légende atterrirait dans la colonne
      // d'à côté, à hauteur de « Nouvelle partie ».
      const bloc = document.createElement('div');
      bloc.className = 'menu-resume';
      bloc.append(bResume, who);
      list.appendChild(bloc);
    }

    const bPlay = this.button(savedRun ? t('Nouvelle partie', 'New run') : t('Jouer', 'Play'), savedRun ? '' : 'primary');
    const bSanct = this.button(t('Sanctuaire', 'Sanctuary'));
    const bShop = this.button(t('Boutique', 'Shop'));
    const bArchive = this.button('Archive');
    const bCodex = this.button('Codex');
    const bProg = this.button(t('Progression', 'Progress'));
    const bOpt = this.button('Options');
    bPlay.addEventListener('click', () => { audio.play('confirm'); onPlay(); });
    bSanct.addEventListener('click', () => { audio.play('confirm'); onSanctuary(); });
    bShop.addEventListener('click', () => { audio.play('confirm'); onShop(); });
    bArchive.addEventListener('click', () => { audio.play('confirm'); onArchive(); });
    bCodex.addEventListener('click', () => { audio.play('confirm'); onCodex(); });
    bProg.addEventListener('click', () => { audio.play('confirm'); onProgress(); });
    bOpt.addEventListener('click', () => { audio.play('confirm'); onOptions(); });
    list.append(bPlay, bSanct, bShop, bArchive, bCodex, bProg, bOpt);
    corps.appendChild(list);

    if (sv.stats.runs > 0) {
      // Les compteurs ne sont pas empilés au centre mais **groupés par sens** dans les
      // quatre coins : le parcours à gauche, les ressources à droite, le carnage en bas.
      // L'écran se remplit, le logo et le menu gardent le centre, et la lune du décor
      // reste dégagée.
      el.appendChild(this.statCorner('tl', [
        ['runs', makeHero(`hero:${lastChar}`, characterById(lastChar).art, false), String(sv.stats.runs), t('parties', 'runs')],
        ['time', makeItem('hourglass'), formatTime(sv.stats.bestTime), t('record', 'best')],
      ]));
      el.appendChild(this.statCorner('tr', [
        ['gold', makeCoin(), abbrev(sv.gold), t('or', 'gold')],
        ['gems', makeGem(2), abbrev(sv.stats.gems), t('gemmes', 'gems')],
      ]));
      el.appendChild(this.statCorner('bl', [
        ['kills', makeBody('enemy:ghoul', enemyById('ghoul').art), abbrev(sv.stats.kills), t('abattus', 'slain')],
      ]));
      el.appendChild(this.statCorner('br', [
        ['wins', makeChest(), String(sv.stats.wins), t('victoires', 'victories')],
        ['relics', makeRelic('epic'), `${sv.seenRelics.length}/24`, t('reliques', 'relics')],
      ]));
    } else {
      const stats = document.createElement('div');
      stats.className = 'hint';
      stats.style.marginTop = '1em';
      // Conseiller des touches à quelqu'un qui n'a pas de clavier ne l'aide pas.
      stats.textContent = isTouch()
        ? t('Glissez le doigt pour vous déplacer. Les armes tirent seules.', 'Drag to move. Weapons fire automatically.')
        : t('ZQSD ou WASD pour se déplacer. Les armes tirent seules.', 'Use WASD or ZQSD to move. Weapons fire automatically.');
      corps.appendChild(stats);
    }

    // Pied de l'écran-titre. Dans le flux, sous le corps : il se plaque en bas tant qu'il
    // reste de la place, et se range à la suite du menu quand il n'y en a plus.
    const pied = document.createElement('div');
    pied.className = 'title-pied';
    el.appendChild(pied);

    // Marque de collection complète : une phrase, en bas, sans fanfare — c'est le ton.
    if (sv.fragments.length >= TOTAL) {
      const mark = document.createElement('div');
      mark.className = 'title-mark';
      mark.textContent = t('Quarante-deux relevés. Le formulaire est complet.', 'Forty-two records. The form is complete.');
      pied.appendChild(mark);
    }

    // Mention de copyright, comme sur un écran-titre de jeu : discrète, en bas, permanente.
    const legal = document.createElement('div');
    legal.className = 'copyright';
    legal.textContent = `© ${YEAR} Ascencia · v${VERSION}`;
    pied.appendChild(legal);

    /*
     * Les puces des quatre coins sont un ornement chiffré ; le menu est la fonction. Dès
     * que le corps ne tient plus et se met à défiler — interface poussée à 200 % dans les
     * options, fenêtre écrasée —, elles s'effacent au profit des boutons.
     *
     * Cela se constate, cela ne se déclare pas : aucune requête média ne sait exprimer
     * « le contenu ne tient pas », puisque la réponse dépend à la fois de la taille de la
     * fenêtre, de l'échelle choisie par le joueur et du nombre d'entrées du menu.
     */
    const jauger = (): void => {
      el.classList.toggle('serre', corps.scrollHeight > corps.clientHeight + 1);
    };
    jauger();
    const guetteur = new ResizeObserver(jauger);
    guetteur.observe(corps);
    const nettoyagePrecedent = this.cleanup;
    this.cleanup = (): void => {
      nettoyagePrecedent?.();
      guetteur.disconnect();
    };

    const nav = [bPlay, bSanct, bShop, bArchive, bCodex, bProg, bOpt];
    this.navigable(bResume ? [bResume, ...nav] : nav);
  }

  // ------------------------------------------------- sélection de personnage

  characterSelect(onPick: (id: string) => void, onBack: () => void): void {
    const el = this.open('charselect');
    const sv = load();
    el.innerHTML = `<h2 class="title-font">${t('Qui entre dans le domaine ?', 'Who enters the domain?')}</h2>`;

    const grid = document.createElement('div');
    grid.className = 'grid-pick';
    const items: HTMLElement[] = [];

    for (const c of CHARACTERS) {
      const unlocked = this.isUnlocked(c, sv);
      const card = document.createElement('div');
      card.className = `pick${unlocked ? '' : ' locked'}`;

      const icon = makeIcon(makeHero(`hero:${c.id}`, c.art, false), 24);
      const big = document.createElement('canvas');
      big.width = 24;
      big.height = 24;
      big.getContext('2d')!.drawImage(icon, 0, 0);
      card.appendChild(big);

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = `${c.name} ${c.epithet}`;
      card.appendChild(name);

      if (unlocked) {
        const wpn = document.createElement('div');
        wpn.className = 'hint';
        wpn.textContent = WEAPONS.find((x) => x.id === c.startWeapon)?.name ?? '';
        const perk = document.createElement('div');
        perk.className = 'perk';
        perk.textContent = c.perk;
        const flaw = document.createElement('div');
        flaw.className = 'flaw';
        flaw.textContent = c.flaw;
        card.append(wpn, perk, flaw);
        card.addEventListener('click', () => { audio.play('confirm'); onPick(c.id); });
        items.push(card);
      } else {
        // Une condition de déblocage sans compteur est inutilisable : le joueur n'a aucun
        // moyen de savoir où il en est, ni si sa dernière partie l'a fait avancer. On affiche
        // donc systématiquement la progression chiffrée et une jauge.
        const p = this.unlockProgress(c, sv);
        const lock = document.createElement('div');
        lock.className = 'unlock';
        lock.textContent = p.label;
        const gauge = document.createElement('div');
        gauge.className = 'unlock-gauge';
        const fill = document.createElement('div');
        fill.style.width = `${Math.round(p.ratio * 100)}%`;
        gauge.appendChild(fill);
        const count = document.createElement('div');
        count.className = 'unlock-count';
        count.textContent = p.count;
        card.append(lock, gauge, count);
        card.addEventListener('click', () => audio.play('deny'));
      }
      grid.appendChild(card);
    }

    el.appendChild(grid);
    const back = this.button(t('Retour', 'Back'));
    back.addEventListener('click', onBack);
    el.appendChild(back);
    items.push(back);
    this.navigable(items, 3);
  }

  /** Avancement chiffré vers le déblocage d'un personnage. */
  private unlockProgress(
    c: CharacterDef,
    sv: SaveData,
  ): { label: string; count: string; ratio: number } {
    const u = c.unlock;
    if (!u) return { label: '', count: '', ratio: 1 };

    const current =
      u.kind === 'time' ? sv.stats.bestTime
        : u.kind === 'gems' ? sv.stats.gems
          : u.kind === 'kills' ? sv.stats.kills
            : sv.stats.wins;

    const fmt = (v: number): string =>
      u.kind === 'time' ? formatTime(v) : v.toLocaleString(locale());

    return {
      label: u.label,
      count: `${fmt(Math.min(current, u.value))} / ${fmt(u.value)}`,
      ratio: Math.min(1, u.value > 0 ? current / u.value : 1),
    };
  }

  private isUnlocked(c: CharacterDef, sv: SaveData): boolean {
    if (!c.unlock) return true;
    if (sv.unlockedChars.includes(c.id)) return true;
    switch (c.unlock.kind) {
      case 'time': return sv.stats.bestTime >= c.unlock.value;
      case 'gems': return sv.stats.gems >= c.unlock.value;
      case 'kills': return sv.stats.kills >= c.unlock.value;
      case 'win': return sv.stats.wins >= c.unlock.value;
    }
  }


  // ------------------------------------------------------------------ progression

  /**
   * Arbre de progression.
   *
   * Le jeu contenait déjà tout ce qu'il fallait — quinze recettes d'évolution et quatre
   * conditions de déblocage — mais rien ne les montrait. Un joueur découvrait les évolutions
   * par accident, ou pas du tout, et n'avait aucun moyen de savoir ce qu'il lui restait à
   * débloquer ni comment.
   *
   * L'écran ne dévoile pas ce qui n'a pas été rencontré. Une recette dont l'arme de base est
   * inconnue reste silhouettée : savoir qu'il existe une évolution est une information, savoir
   * laquelle en est une autre, et la seconde se mérite.
   */
  progression(onBack: () => void): void {
    const el = this.open('progress');
    const sv = load();
    el.innerHTML = `<h2 class="title-font">${t('Progression', 'Progress')}</h2>`;

    const scroll = document.createElement('div');
    scroll.className = 'codex-scroll';

    const section = (titre: string, fait: number, total: number): HTMLDivElement => {
      const h = document.createElement('div');
      h.className = 'codex-section';
      h.innerHTML = `<span class="t">${titre}</span><span class="c">${fait} / ${total}</span>`;
      scroll.appendChild(h);
      const g = document.createElement('div');
      g.className = 'prog-liste';
      scroll.appendChild(g);
      return g;
    };

    // --------------------------------------------------------------- personnages
    const debloques = CHARACTERS.filter((c) => this.isUnlocked(c, sv)).length;
    const gChars = section(t('Personnages', 'Characters'), debloques, CHARACTERS.length);
    for (const c of CHARACTERS) {
      const ouvert = this.isUnlocked(c, sv);
      const ligne = document.createElement('div');
      ligne.className = `prog-ligne${ouvert ? '' : ' locked'}`;

      const jeu = makeHero(`prog:${c.id}`, c.art, false);
      const vign = this.spriteBlock(spriteSheet(`prog:h:${c.id}`, jeu, this.fitScale(jeu, 40, 44)), ouvert, 0.8);
      ligne.appendChild(vign);

      const txt = document.createElement('div');
      txt.className = 'prog-txt';
      txt.innerHTML = `<b>${ouvert ? c.name : '???'}</b>`;
      if (c.unlock && !ouvert) {
        const cond = document.createElement('span');
        cond.className = 'prog-cond';
        cond.textContent = c.unlock.label;
        txt.appendChild(cond);
        // La barre chiffre ce qu'il reste : « survivre dix minutes » sans savoir qu'on en est
        // à huit ne dit pas si l'objectif est proche ou lointain.
        const fait = c.unlock.kind === 'time' ? sv.stats.bestTime
          : c.unlock.kind === 'gems' ? sv.stats.gems
          : c.unlock.kind === 'kills' ? sv.stats.kills
          : sv.stats.wins;
        const jauge = document.createElement('div');
        jauge.className = 'prog-jauge';
        const rempli = document.createElement('div');
        rempli.style.width = `${Math.min(100, (fait / c.unlock.value) * 100)}%`;
        jauge.appendChild(rempli);
        txt.appendChild(jauge);
        const chiffre = document.createElement('span');
        chiffre.className = 'prog-chiffre';
        chiffre.textContent = `${Math.min(fait, c.unlock.value)} / ${c.unlock.value}`;
        txt.appendChild(chiffre);
      } else {
        const d = document.createElement('span');
        d.className = 'prog-cond';
        d.textContent = `${c.perk} · ${c.flaw}`;
        txt.appendChild(d);
      }
      ligne.appendChild(txt);
      gChars.appendChild(ligne);
    }

    // --------------------------------------------------------------- évolutions
    const recettes = WEAPONS.filter((w) => w.evolvesTo && w.requires);
    const trouvees = recettes.filter((w) => sv.seenWeapons.includes(w.evolvesTo!)).length;
    const gEvo = section(t('Évolutions', 'Evolutions'), trouvees, recettes.length);
    for (const w of recettes) {
      const connue = sv.seenWeapons.includes(w.id);
      const faite = sv.seenWeapons.includes(w.evolvesTo!);
      const evo = WEAPONS.find((x) => x.id === w.evolvesTo);
      const pas = PASSIVE_BY_ID.get(w.requires!);
      if (!evo || !pas) continue;

      const ligne = document.createElement('div');
      ligne.className = `prog-recette${faite ? ' faite' : connue ? '' : ' locked'}`;

      const bloc = (set: SpriteSet, vu: boolean, cle: string): HTMLElement => {
        const d = document.createElement('div');
        d.className = 'prog-bloc';
        d.appendChild(this.spriteBlock(spriteSheet(cle, set, this.fitScale(set, 34, 34)), vu, 1));
        return d;
      };
      ligne.appendChild(bloc(makeProjectile(w.sprite, w.color), connue, `prog:w:${w.id}`));
      const plus = document.createElement('span');
      plus.className = 'prog-op';
      plus.textContent = '+';
      ligne.appendChild(plus);
      ligne.appendChild(bloc(makePassiveSprite(pas.icon, pas.color ?? '#f2c46b'), connue, `prog:p:${pas.id}`));
      const fleche = document.createElement('span');
      fleche.className = 'prog-op fleche';
      fleche.textContent = '→';
      ligne.appendChild(fleche);
      ligne.appendChild(bloc(makeProjectile(evo.sprite, evo.color), faite, `prog:e:${evo.id}`));

      const nom = document.createElement('div');
      nom.className = 'prog-nom';
      nom.innerHTML = connue
        ? `<b>${faite ? evo.name : '???'}</b><span class="prog-cond">${t(`${w.name} au niveau maximal, avec ${pas.name}`, `${w.name} at max level, with ${pas.name}`)}</span>`
        : `<b>???</b><span class="prog-cond">${t('Une arme que vous n’avez pas encore vue', 'A weapon you have not seen yet')}</span>`;
      ligne.appendChild(nom);
      gEvo.appendChild(ligne);
    }

    el.appendChild(scroll);
    const back = this.button(t('Retour', 'Back'));
    back.addEventListener('click', onBack);
    el.appendChild(back);
    this.navigable([back]);
  }

  // ------------------------------------------------------------- montée de niveau

  levelUp(
    offers: Offer[],
    rerollsLeft: number,
    onPick: (o: Offer) => void,
    onReroll: () => void,
    onSkip: () => void,
  ): void {
    const el = this.open('levelup');
    el.innerHTML = `<h2 class="title-font">${t('Niveau supérieur', 'Level up')}</h2>`;

    const cards = document.createElement('div');
    cards.className = 'cards';
    const items: HTMLElement[] = [];

    for (const o of offers) {
      const card = document.createElement('div');
      card.className = `card${o.isNew ? ' is-new' : ''}`;

      const cv = document.createElement('canvas');
      cv.width = 20;
      cv.height = 20;
      cv.getContext('2d')!.drawImage(o.icon, 0, 0);
      card.appendChild(cv);

      const kind = document.createElement('div');
      kind.className = 'kind';
      kind.textContent = o.kindLabel;
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = o.name;
      const desc = document.createElement('div');
      desc.className = 'desc';
      desc.textContent = o.desc;
      const lvl = document.createElement('div');
      lvl.className = 'lvltag';
      lvl.textContent = o.levelLabel;

      card.append(kind, name, desc, lvl);
      card.addEventListener('click', () => { audio.play('confirm'); onPick(o); });
      cards.appendChild(card);
      items.push(card);
    }
    el.appendChild(cards);

    const actions = document.createElement('div');
    actions.className = 'levelup-actions';
    const reroll = this.button(`Reroll (${rerollsLeft})`);
    reroll.disabled = rerollsLeft <= 0;
    reroll.addEventListener('click', () => {
      if (rerollsLeft <= 0) { audio.play('deny'); return; }
      audio.play('confirm');
      onReroll();
    });
    const skip = this.button(t('Passer', 'Skip'));
    skip.appendChild(iconValue('gold', '+50'));
    skip.addEventListener('click', () => { audio.play('confirm'); onSkip(); });
    actions.append(reroll, skip);
    el.appendChild(actions);
    items.push(reroll, skip);

    this.navigable(items, offers.length);
  }

  // ---------------------------------------------------------------- coffre

  chest(res: ChestResult, onDone: () => void): void {
    const el = this.open('chestscreen');
    el.innerHTML = `<h2 class="title-font">${t('Coffre', 'Chest')}</h2>`;

    if (res.evolution) {
      const evo = document.createElement('div');
      evo.className = 'card is-evo';
      evo.style.width = '18em';
      evo.innerHTML = `
        <div class="kind">${t('Évolution', 'Evolution')}</div>
        <div class="name"></div>
        <div class="desc"></div>
        <div class="lvltag"></div>`;
      evo.querySelector('.name')!.textContent = res.evolution.to.name;
      evo.querySelector('.desc')!.textContent = res.evolution.to.desc;
      evo.querySelector('.lvltag')!.textContent = t(`remplace ${res.evolution.from.name}`, `replaces ${res.evolution.from.name}`);
      el.appendChild(evo);
    }

    const cards = document.createElement('div');
    cards.className = 'cards';
    for (const o of res.offers) {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.width = '11em';
      card.style.minHeight = '9em';
      const cv = document.createElement('canvas');
      cv.width = 20;
      cv.height = 20;
      cv.getContext('2d')!.drawImage(o.icon, 0, 0);
      card.appendChild(cv);
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = o.name;
      const lvl = document.createElement('div');
      lvl.className = 'lvltag';
      lvl.textContent = o.levelLabel;
      card.append(name, lvl);
      cards.appendChild(card);
    }
    el.appendChild(cards);

    const gold = document.createElement('div');
    gold.className = 'gold-count';
    gold.textContent = `+${res.gold} ${t('or', 'gold')}${res.rerolls ? ` · +${res.rerolls} reroll` : ''}`;
    el.appendChild(gold);

    const ok = this.button(t('Empocher', 'Collect'), 'primary');
    ok.addEventListener('click', () => { audio.play('confirm'); onDone(); });
    el.appendChild(ok);
    this.navigable([ok]);
  }

  // --------------------------------------------------------------- archive

  /**
   * L'Archive.
   *
   * Elle n'affiche **qu'un seul indice à la fois** — celui du plus petit fragment manquant.
   * Une liste complète d'objectifs transformerait la collection en tableau de bord ; un
   * objectif unique laisse la découverte se faire dans l'ordre, en jouant.
   */
  archive(onBack: () => void): void {
    const el = this.open('archive');
    const sv = load();
    const found = new Set(sv.fragments);
    const complete = found.size >= TOTAL;

    el.innerHTML = `<h2 class="title-font">Archive</h2>`;

    const count = document.createElement('div');
    count.className = 'gold-count';
    count.textContent = `${found.size} / ${TOTAL}`;
    el.appendChild(count);

    // Indice courant, ou conclusion.
    const next = FRAGMENTS.find((f) => !found.has(f.n));
    const hint = document.createElement('div');
    hint.className = 'archive-hint';
    hint.textContent = next
      ? CYCLES[next.cycle]!.hint
      : t('Le recueil est complet.', 'The collection is complete.');
    el.appendChild(hint);

    const scroll = document.createElement('div');
    scroll.className = 'codex-scroll';

    for (let c = 0; c < CYCLES.length; c++) {
      const cy = CYCLES[c]!;
      const items = FRAGMENTS.filter((f) => f.cycle === c);
      const got = items.filter((f) => found.has(f.n)).length;
      // Le nom d'un cycle reste caché tant qu'on n'en a rien trouvé : il en dit déjà trop.
      const revealed = got > 0;

      const head = document.createElement('div');
      head.className = 'codex-section';
      head.innerHTML = '<span class="t"></span><span class="c"></span>';
      head.querySelector('.t')!.textContent = revealed ? cy.name : t(`Cycle ${roman(c + 1)}`, `Cycle ${roman(c + 1)}`);
      head.querySelector('.c')!.textContent = `${got} / ${items.length}`;
      scroll.appendChild(head);

      const grid = document.createElement('div');
      grid.className = 'codex-grid archive-grid';
      for (const f of items) {
        const has = found.has(f.n);
        const cell = document.createElement('div');
        cell.className = `codex-cell archive-cell${has ? '' : ' locked'}`;

        const stage = document.createElement('div');
        stage.className = 'codex-stage';
        const set = makeFragment(f.type);
        stage.appendChild(this.spriteBlock(spriteSheet(`frag:${f.type}`, set, this.fitScale(set, 60, 46)), has, 1));
        cell.appendChild(stage);

        const num = document.createElement('div');
        num.className = 'codex-tag';
        num.textContent = roman(f.n);
        const n = document.createElement('div');
        n.className = 'codex-name';
        n.textContent = has ? f.t : '—';
        const d = document.createElement('div');
        d.className = 'codex-desc';
        d.textContent = has ? TYPE_LABEL[f.type] : t('Introuvé', 'Missing');
        cell.append(num, n, d);

        if (has) cell.addEventListener('click', () => this.readFragment(f));
        grid.appendChild(cell);
      }
      scroll.appendChild(grid);
    }

    if (complete) {
      const ep = document.createElement('div');
      ep.className = 'archive-epilogue';
      ep.textContent = t('Lire l’épilogue', 'Read the epilogue');
      ep.addEventListener('click', () => this.readText(t('Épilogue', 'Epilogue'), EPILOGUE));
      scroll.appendChild(ep);
    }

    el.appendChild(scroll);
    const back = this.button(t('Retour', 'Back'));
    back.addEventListener('click', onBack);
    el.appendChild(back);
    this.navigable([back]);
  }

  /** Vue de lecture d'une pièce. */
  readFragment(f: FragmentDef, onClose?: () => void): void {
    this.readText(`${roman(f.n)} · ${f.t}`, f.b, f, onClose);
  }

  /**
   * Vue de lecture plein écran, superposée sans fermer l'écran courant : on revient à
   * l'Archive exactement là où on l'avait laissée.
   */
  readText(title: string, body: string, f?: FragmentDef, onClose?: () => void): void {
    const prev = this.current;
    const overlay = document.createElement('div');
    overlay.className = 'screen reading';

    if (f) {
      const set = makeFragment(f.type);
      const st = document.createElement('div');
      st.className = 'reading-icon';
      st.appendChild(this.spriteBlock(spriteSheet(`read:${f.type}`, set, this.fitScale(set, 120, 88)), true, 1));
      overlay.appendChild(st);
    }

    const h = document.createElement('h2');
    h.className = 'title-font';
    h.textContent = title;
    const kind = document.createElement('div');
    kind.className = 'hint';
    if (f) kind.textContent = TYPE_LABEL[f.type];

    const panel = document.createElement('div');
    panel.className = 'panel reading-panel';
    for (const para of body.split('\n\n')) {
      const pel = document.createElement('p');
      pel.textContent = para;
      panel.appendChild(pel);
    }

    const close = this.button(t('Fermer', 'Close'), 'primary');
    const shut = (): void => {
      overlay.remove();
      window.removeEventListener('keydown', onKey);
      if (prev) prev.style.display = '';
      onClose?.();
    };
    close.addEventListener('click', shut);
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        shut();
      }
    };
    window.addEventListener('keydown', onKey);

    overlay.append(h, kind, panel, close);
    if (prev) prev.style.display = 'none';
    this.parent.appendChild(overlay);
  }

  // -------------------------------------------------------------- boutique

  /**
   * Boutique cosmétique.
   *
   * Elle existe parce que l'or n'avait qu'un seul débouché : le Sanctuaire, c'est-à-dire de
   * la puissance. Un joueur ayant tout acheté n'avait plus rien à faire de sa monnaie. Les
   * deux se disputent désormais la même bourse, ce qui crée un arbitrage : progresser ou
   * avoir de l'allure.
   *
   * Aucun article n'a d'effet sur le jeu — c'est la condition pour que le choix reste libre.
   */
  shop(onBack: () => void, onApply: () => void): void {
    const render = (): void => {
      const el = this.open('shop');
      const sv = load();
      el.innerHTML = `<h2 class="title-font">${t('Boutique', 'Shop')}</h2>`;

      const purse = document.createElement('div');
      purse.className = 'gold-count';
      purse.appendChild(iconValue('gold', abbrev(sv.gold)));
      el.appendChild(purse);

      const note = document.createElement('div');
      note.className = 'hint';
      note.textContent = t('Rien de tout ceci n’influence le jeu.', 'None of this affects gameplay.');
      el.appendChild(note);

      const scroll = document.createElement('div');
      scroll.className = 'codex-scroll';
      this.previews = [];

      const group = (kind: CosmeticKind, items: Cosmetic[]): void => {
        const owned = items.filter((c) => c.price === 0 || sv.cosmetics.owned.includes(c.id));
        const head = document.createElement('div');
        head.className = 'codex-section';
        head.innerHTML = '<span class="t"></span><span class="c"></span>';
        head.querySelector('.t')!.textContent = KIND_LABEL[kind];
        head.querySelector('.c')!.textContent = `${owned.length} / ${items.length}`;
        scroll.appendChild(head);

        const grid = document.createElement('div');
        grid.className = 'codex-grid';

        for (const item of items) {
          // Un article à condition ne s'achète pas : il se mérite, et reste verrouillé tant
          // que la condition n'est pas remplie.
          const gated = item.requires === 'complete' && sv.fragments.length < TOTAL;
          const has = !gated && (item.price === 0 || sv.cosmetics.owned.includes(item.id));
          // Une teinte s'équipe pour son personnage, les autres articles par catégorie.
          const slot = item.kind === 'skin' ? (item.universal ? 'skin:*' : `skin:${item.charId}`) : item.kind;
          const on = sv.cosmetics.equipped[slot] === item.id;

          const cell = document.createElement('div');
          cell.className = `codex-cell shop-cell${has ? '' : ' locked'}${on ? ' equipped' : ''}`;

          const stage = document.createElement('div');
          stage.className = 'codex-stage';
          stage.appendChild(this.shopPreview(item));
          cell.appendChild(stage);

          const n = document.createElement('div');
          n.className = 'codex-name';
          n.textContent = item.name;
          const d = document.createElement('div');
          d.className = 'codex-desc';
          d.textContent = item.desc;
          cell.append(n, d);

          const btn = this.button(
            on ? t('Équipé', 'Equipped') : has ? t('Équiper', 'Equip') : gated ? `${sv.fragments.length} / ${TOTAL}` : '',
            on ? 'primary' : '',
          );
          // Un prix s'écrit avec la monnaie, pas avec son nom.
          if (!on && !has && !gated) btn.appendChild(iconValue('gold', item.price.toLocaleString(locale())));
          btn.classList.add('shop-btn');
          btn.disabled = on || gated || (!has && sv.gold < item.price);
          btn.addEventListener('click', () => {
            const cur = load();
            if (gated) { audio.play('deny'); return; }
            if (!has) {
              if (cur.gold < item.price) { audio.play('deny'); return; }
              update((x) => {
                x.gold -= item.price;
                x.cosmetics.owned.push(item.id);
                x.cosmetics.equipped[slot] = item.id;
              });
              audio.play('unlock');
            } else {
              // On inscrit aussi les articles gratuits ou mérités dans `owned` : sans cela,
              // `owned` ne signifiait « débloqué » que pour les achats, et une teinte
              // équipée mais non listée était ignorée à l'application. Elle s'affichait
              // « Équipé » sans le moindre effet en jeu.
              update((x) => {
                if (!x.cosmetics.owned.includes(item.id)) x.cosmetics.owned.push(item.id);
                x.cosmetics.equipped[slot] = item.id;
              });
              audio.play('confirm');
            }
            onApply();
            render();
          });
          cell.appendChild(btn);
          grid.appendChild(cell);
        }
        scroll.appendChild(grid);
      };

      group('skin', SKINS);
      group('trail', TRAILS);
      group('theme', THEMES);
      group('cursor', CURSORS);

      el.appendChild(scroll);
      const back = this.button(t('Retour', 'Back'));
      back.addEventListener('click', onBack);
      el.appendChild(back);
      this.navigable([back]);

      // Une seule boucle pour tous les aperçus, arrêtée avec l'écran. Avec « Réduire les
      // animations », chaque aperçu est simplement figé sur une image représentative.
      const still = document.body.classList.contains('reduce-motion');
      let raf = 0;
      let last = performance.now();
      let time = 0;
      const frame = (now: number): void => {
        // L'horodatage d'une image peut précéder l'instant où la boucle a été armée.
        const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
        last = now;
        time += dt;
        for (const draw of this.previews) draw(time, dt);
        raf = requestAnimationFrame(frame);
      };
      if (still) {
        for (let i = 0; i < 90; i++) for (const draw of this.previews) draw(i / 60, 1 / 60);
      } else {
        raf = requestAnimationFrame(frame);
      }
      const prev = this.cleanup;
      this.cleanup = (): void => {
        prev?.();
        cancelAnimationFrame(raf);
      };
    };
    render();
  }
  /** Aperçus animés de la boutique. Chacun rend une image ; la boucle est commune. */
  private previews: ((time: number, dt: number) => void)[] = [];

  /**
   * Aperçu d'un article, **animé avec les fonctions du jeu**.
   *
   * La boutique montrait une pastille de couleur pour une traînée et un sprite de treize
   * pixels pour une teinte : rien qui donne envie d'y laisser une partie d'économies.
   * L'aperçu rejoue maintenant l'effet réel – le personnage marche et laisse sa traînée,
   * la teinte porte son aura, le thème montre son ambiance dans son propre cadre. Ce que
   * le joueur voit avant d'acheter est exactement ce qu'il aura.
   */
  private shopPreview(item: Cosmetic): HTMLElement {
    if (item.kind === 'cursor') {
      const sw = document.createElement('div');
      sw.className = 'shop-swatch';
      sw.style.setProperty('--c', item.color ?? 'transparent');
      sw.style.setProperty('--a', item.accent ?? item.color ?? 'transparent');
      return sw;
    }

    const canvas = document.createElement('canvas');
    canvas.width = PREVIEW_W;
    canvas.height = PREVIEW_H;
    canvas.className = 'shop-preview';
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const fx = new FxLayer();
    const groundY = PREVIEW_H - 12;

    const drawHero = (set: SpriteSet, x: number, time: number, flip: boolean): void => {
      const f = set.frames[Math.floor(time * 6) % set.frames.length]!;
      const dx = Math.round(x - f.width / 2);
      const dy = Math.round(groundY - f.height / 2 - 2);
      if (flip) {
        ctx.setTransform(-1, 0, 0, 1, 0, 0);
        ctx.drawImage(f, -dx - f.width, dy);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      } else {
        ctx.drawImage(f, dx, dy);
      }
    };

    if (item.kind === 'skin') {
      const c = characterById(item.charId ?? 'ysolde');
      const set = makeHero(`shop:${item.id}`, { ...c.art, ...(item.art ?? {}) }, false);
      this.previews.push((time) => {
        ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
        fx.begin(PREVIEW_W, PREVIEW_H);
        if (item.aura) drawAura(fx.ctx, item.aura, PREVIEW_W / 2, groundY + 7, time);
        drawHero(set, PREVIEW_W / 2, time * 0.5, false);
        fx.composite(ctx);
      });
      return canvas;
    }

    if (item.kind === 'trail') {
      const set = makeHero('shop:walker', characterById('ysolde').art, true);
      const particles = new Particles();
      const cam = { offsetX: 0, offsetY: 0, viewW: PREVIEW_W, viewH: PREVIEW_H } as unknown as Camera;
      let emit = 0;
      let tick = 0;
      this.previews.push((time, dt) => {
        // Aller-retour : le personnage traverse la vignette, et la traînée a le temps de vivre.
        const x = PREVIEW_W / 2 + Math.sin(time * 1.1) * (PREVIEW_W / 2 - 12);
        const goingLeft = Math.cos(time * 1.1) < 0;
        emit -= dt;
        if (item.trail && item.color && emit <= 0) {
          emit = 0.05;
          emitTrail(particles, item.trail, item.color, x, groundY + 6, tick++);
        }
        particles.update(dt);
        ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
        fx.begin(PREVIEW_W, PREVIEW_H);
        particles.render(ctx, cam, fx.ctx);
        drawHero(set, x, time, goingLeft);
        fx.composite(ctx);
      });
      return canvas;
    }

    // Thème : son ambiance, dans son propre cadre.
    const box = document.createElement('div');
    box.className = 'shop-theme';
    if (item.color && item.accent) box.style.borderImageSource = frameUrl(item.color, item.accent);
    box.appendChild(canvas);
    this.previews.push((time) => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#0b0d14';
      ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
      if (item.ambience && item.color) {
        ctx.imageSmoothingEnabled = true;
        // L'ambiance est écrite pour l'écran entier : on la joue réduite, d'où l'échelle.
        ctx.setTransform(0.4, 0, 0, 0.4, 0, 0);
        drawAmbience(ctx, item.ambience, item.color, time, PREVIEW_W / 0.4, PREVIEW_H / 0.4);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    });
    return box;
  }

  // ------------------------------------------------------------ sanctuaire

  sanctuary(onBack: () => void): void {
    const render = (): void => {
      const el = this.open('sanctuary');
      const sv = load();
      el.innerHTML = `<h2 class="title-font">${t('Sanctuaire', 'Sanctuary')}</h2>`;

      const gold = document.createElement('div');
      gold.className = 'gold-count';
      gold.appendChild(iconValue('gold', abbrev(sv.gold)));
      el.appendChild(gold);

      const grid = document.createElement('div');
      grid.className = 'sanct-grid';
      const items: HTMLElement[] = [];

      // Chaque amélioration reçoit l'icône du passif ou de l'objet qu'elle prolonge : le
      // Sanctuaire parle alors le même vocabulaire visuel que le reste du jeu.
      const ICONS: Record<string, () => SpriteSet> = {
        power: () => makePassiveSprite('gem', P_GOLD),
        vitality: () => makeHeart(),
        celerity: () => makePassiveSprite('boot', '#c96f2a'),
        armor: () => makePassiveSprite('shield', '#232b40'),
        regen: () => makePassiveSprite('cup', '#c42639'),
        magnetism: () => makePassiveSprite('magnet', '#4ea9e8'),
        greed: () => makeCoin(),
        growth: () => makeGem(1),
        fortune: () => makePassiveSprite('clover', '#8ef07a'),
        reroll: () => makeItem('scroll'),
        revive: () => makeRelic('epic'),
      };

      for (const up of META_UPGRADES) {
        const lvl = sv.sanctuary[up.id] ?? 0;
        const maxed = lvl >= up.levels;
        const cost = costOf(up, lvl);

        const row = document.createElement('div');
        row.className = 'sanct-row';

        const make = ICONS[up.id];
        if (make) {
          const icon = document.createElement('div');
          icon.className = 'sanct-icon';
          const set = make();
          icon.appendChild(this.spriteBlock(spriteSheet(`sanct:${up.id}`, set, this.fitScale(set, 28, 26)), true, 0.8));
          row.appendChild(icon);
        }

        const info = document.createElement('div');
        info.className = 'info';
        const n = document.createElement('div');
        n.className = 'n';
        n.textContent = up.name;
        const d = document.createElement('div');
        d.className = 'd';
        d.textContent = up.desc;
        const pips = document.createElement('div');
        pips.className = 'pips';
        for (let i = 0; i < up.levels; i++) {
          const pip = document.createElement('span');
          pip.className = `pip${i < lvl ? ' on' : ''}`;
          pips.appendChild(pip);
        }
        info.append(n, d, pips);

        const buy = this.button(maxed ? 'MAX' : '', 'buy');
        if (!maxed) buy.appendChild(iconValue('gold', String(cost)));
        buy.classList.add('buy');
        buy.disabled = maxed || sv.gold < cost;
        buy.addEventListener('click', () => {
          const s = load();
          const cur = s.sanctuary[up.id] ?? 0;
          const c = costOf(up, cur);
          if (cur >= up.levels || s.gold < c) { audio.play('deny'); return; }
          update((x) => {
            x.gold -= c;
            x.sanctuary[up.id] = cur + 1;
          });
          audio.play('unlock');
          render(); // reconstruit l'écran avec les nouveaux montants
        });
        if (!buy.disabled) items.push(buy);

        row.append(info, buy);
        grid.appendChild(row);
      }
      el.appendChild(grid);

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '.6em';
      const back = this.button(t('Retour', 'Back'));
      back.addEventListener('click', onBack);
      const reset = this.button(t('Tout réinitialiser', 'Reset all'), 'danger');
      let armed = false;
      reset.addEventListener('click', () => {
        if (!armed) {
          armed = true;
          reset.textContent = t('Confirmer ? (irréversible)', 'Confirm? (irreversible)');
          audio.play('deny');
          return;
        }
        wipe();
        audio.play('confirm');
        render();
      });
      actions.append(back, reset);
      el.appendChild(actions);
      items.push(back, reset);

      this.navigable(items, 2);
    };
    render();
  }

  // ----------------------------------------------------------------- codex

  /**
   * Bloc sprite animé en CSS pur.
   *
   * Les frames sont aplaties en une planche horizontale, puis défilées par
   * `steps()` sur `background-position`. Le codex peut ainsi afficher une soixantaine de
   * sprites animés simultanément sans qu'une seule ligne de JavaScript ne tourne – là où une
   * boucle d'animation par vignette coûterait cher pour un écran purement contemplatif.
   */
  private spriteBlock(sheet: Sheet, discovered: boolean, speed = 0.6): HTMLDivElement {
    const el = document.createElement('div');
    el.className = `codex-sprite${discovered ? '' : ' unknown'}`;
    el.style.width = `${sheet.w}px`;
    el.style.height = `${sheet.h}px`;
    el.style.backgroundImage = `url("${sheet.url}")`;
    el.style.backgroundSize = `${sheet.w * sheet.frames}px ${sheet.h}px`;
    el.style.setProperty('--n', String(sheet.frames));
    el.style.setProperty('--end', `-${sheet.w * sheet.frames}px`);
    el.style.animationDuration = `${speed}s`;
    return el;
  }

  /**
   * Facteur d'agrandissement entier le plus grand qui tienne dans la vignette.
   *
   * Nécessaire parce que le codex mélange des sprites allant de 5 px (un éclat) à 60 px
   * (le Sanguinaire) : un facteur fixe ferait déborder les uns et rendrait les autres
   * illisibles. Le facteur reste **entier** pour préserver la netteté du pixel art.
   */
  private fitScale(set: SpriteSet, maxW: number, maxH: number): number {
    return Math.max(1, Math.min(4, Math.floor(Math.min(maxW / set.w, maxH / set.h))));
  }

  private codexCell(
    sheet: Sheet,
    discovered: boolean,
    name: string,
    desc: string,
    tag: string,
    tagColor: string,
    speed?: number,
    /** Monture de rareté. Absente, la vignette garde le cadre de pierre par défaut. */
    monture?: string,
  ): HTMLDivElement {
    const cell = document.createElement('div');
    cell.className = `codex-cell${discovered ? '' : ' locked'}${monture ? ` ${monture}` : ''}`;

    const stage = document.createElement('div');
    stage.className = 'codex-stage';
    stage.appendChild(this.spriteBlock(sheet, discovered, speed));
    cell.appendChild(stage);

    if (tag) {
      const t = document.createElement('div');
      t.className = 'codex-tag';
      t.textContent = tag;
      t.style.color = tagColor;
      cell.appendChild(t);
    }
    const n = document.createElement('div');
    n.className = 'codex-name';
    n.textContent = discovered ? name : '???';
    const d = document.createElement('div');
    d.className = 'codex-desc';
    d.textContent = discovered ? desc : t('Non découvert', 'Undiscovered');
    cell.append(n, d);
    return cell;
  }

  codex(onBack: () => void): void {
    const el = this.open('codex');
    const sv = load();
    el.innerHTML = `<h2 class="title-font">Codex</h2>`;

    const scroll = document.createElement('div');
    scroll.className = 'codex-scroll';

    const section = (title: string, done: number, total: number): HTMLDivElement => {
      const head = document.createElement('div');
      head.className = 'codex-section';
      head.innerHTML = `<span class="t"></span><span class="c"></span>`;
      head.querySelector('.t')!.textContent = title;
      head.querySelector('.c')!.textContent = `${done} / ${total}`;
      scroll.appendChild(head);
      const g = document.createElement('div');
      g.className = 'codex-grid';
      scroll.appendChild(g);
      return g;
    };

    // ------------------------------------------------------------------ armes
    const base = WEAPONS.filter((x) => !x.isEvolution);
    const evos = WEAPONS.filter((x) => x.isEvolution);

    // Boîte disponible pour un sprite dans une vignette, en pixels.
    const BOX_W = 110;
    const BOX_H = 60;
    const sheetOf = (key: string, set: SpriteSet): Sheet =>
      spriteSheet(key, set, this.fitScale(set, BOX_W, BOX_H));

    const gWeapons = section(t('Armes', 'Weapons'), sv.seenWeapons.filter((id) => base.some((b) => b.id === id)).length, base.length);
    for (const def of base) {
      const seen = sv.seenWeapons.includes(def.id);
      gWeapons.appendChild(this.codexCell(
        sheetOf(`codex:w:${def.id}`, makeProjectile(def.sprite, def.color)),
        seen, def.name, def.desc, t(`${def.damage} dégâts · ${def.cooldown} s`, `${def.damage} damage · ${def.cooldown} s`), 'var(--mist)',
      ));
    }

    const gEvos = section(t('Évolutions', 'Evolutions'), sv.seenWeapons.filter((id) => evos.some((e) => e.id === id)).length, evos.length);
    for (const def of evos) {
      const seen = sv.seenWeapons.includes(def.id);
      const from = WEAPONS.find((x) => x.evolvesTo === def.id);
      const recipe = from
        ? `${from.name} + ${from.requires ? PASSIVE_BY_ID.get(from.requires)?.name ?? '' : ''}`
        : t('Évolution', 'Evolution');
      gEvos.appendChild(this.codexCell(
        sheetOf(`codex:w:${def.id}`, makeProjectile(def.sprite, def.color)),
        seen, def.name, def.desc, recipe, 'var(--rar-epic)',
      ));
    }

    // -------------------------------------------------------------- bestiaire
    const all = [...ENEMIES, ...BOSSES];
    const gBeasts = section(t('Bestiaire', 'Bestiary'), sv.seenEnemies.length, all.length);
    for (const def of all) {
      const seen = sv.seenEnemies.includes(def.id);
      const isBoss = !!def.boss;
      gBeasts.appendChild(this.codexCell(
        sheetOf(`codex:e:${def.id}`, makeBody(`enemy:${def.id}`, def.art)),
        seen, def.name,
        t(`${def.hp} PV · ${def.damage} dégâts · ${AI_LABEL[def.ai] ?? def.ai}`, `${def.hp} HP · ${def.damage} damage · ${AI_LABEL[def.ai] ?? def.ai}`),
        isBoss ? 'BOSS' : t(`dès ${def.from} min`, `from ${def.from} min`),
        isBoss ? 'var(--blood-hi)' : 'var(--mist)',
        isBoss ? 0.9 : 0.5,
      ));
    }

    // --------------------------------------------------------------- reliques
    const gRelics = section(t('Reliques', 'Relics'), sv.seenRelics.length, RELICS.length);
    for (const r of RELICS) {
      const seen = sv.seenRelics.includes(r.id);
      gRelics.appendChild(this.codexCell(
        sheetOf(`codex:r:${r.rarity}`, makeRelic(r.rarity)),
        seen, r.name, r.desc, RARITY_LABEL[r.rarity], `var(--rar-${RARITY_CSS[r.rarity]})`, 1.1,
        seen ? MONTURE[r.rarity] : undefined,
      ));
    }

    el.appendChild(scroll);
    const back = this.button(t('Retour', 'Back'));
    back.addEventListener('click', onBack);
    el.appendChild(back);
    this.navigable([back]);
  }

  // --------------------------------------------------------------- options

  options(onBack: () => void, onApply: () => void): void {
    const el = this.open('options');
    const sv = load();
    el.innerHTML = `<h2 class="title-font">Options</h2>`;

    const scroll = document.createElement('div');
    scroll.className = 'opt-scroll';

    const section = (title: string): void => {
      const h = document.createElement('div');
      h.className = 'codex-section';
      h.innerHTML = '<span class="t"></span>';
      h.querySelector('.t')!.textContent = title;
      scroll.appendChild(h);
    };

    /** Curseur avec valeur affichée : un réglage sans retour chiffré se règle à l'aveugle. */
    const slider = (
      label: string, min: number, max: number, step: number,
      get: () => number, set: (v: number) => void, fmt: (v: number) => string,
    ): void => {
      const row = document.createElement('div');
      row.className = 'opt-row';
      const l = document.createElement('label');
      l.textContent = label;
      const val = document.createElement('span');
      val.className = 'opt-val';
      val.textContent = fmt(get());
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(get());
      input.addEventListener('input', () => {
        set(Number(input.value));
        val.textContent = fmt(Number(input.value));
        save();
        onApply();
      });
      row.append(l, input, val);
      scroll.appendChild(row);
    };

    const toggle = (label: string, hint: string, get: () => boolean, set: (v: boolean) => void): void => {
      const row = document.createElement('div');
      row.className = 'opt-row';
      const wrap = document.createElement('div');
      const l = document.createElement('label');
      l.textContent = label;
      const h = document.createElement('div');
      h.className = 'opt-hint';
      h.textContent = hint;
      wrap.append(l, h);
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = get();
      cb.addEventListener('change', () => {
        set(cb.checked);
        save();
        onApply();
      });
      row.append(wrap, cb);
      scroll.appendChild(row);
    };

    const languageSelect = (): void => {
      const row = document.createElement('div');
      row.className = 'opt-row';
      const label = document.createElement('label');
      label.textContent = t('Langue', 'Language');
      const select = document.createElement('select');
      select.className = 'opt-select';
      for (const [value, name] of [['fr', 'Français'], ['en', 'English']] as const) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = name;
        option.selected = sv.options.language === value;
        select.appendChild(option);
      }
      select.addEventListener('change', () => {
        sv.options.language = select.value === 'en' ? 'en' : 'fr';
        setLanguage(sv.options.language);
        save();
        location.reload();
      });
      row.append(label, select);
      scroll.appendChild(row);
    };

    const pct = (v: number): string => `${Math.round(v * 100)} %`;

    section(t('Langue', 'Language'));
    languageSelect();

    section(t('Son', 'Audio'));
    slider(t('Volume général', 'Master volume'), 0, 1, 0.05, () => sv.options.master, (v) => { sv.options.master = v; }, pct);
    slider(t('Effets sonores', 'Sound effects'), 0, 1, 0.05, () => sv.options.sfx, (v) => { sv.options.sfx = v; }, pct);
    slider(t('Musique', 'Music'), 0, 1, 0.05, () => sv.options.music, (v) => { sv.options.music = v; }, pct);

    section(t('Affichage', 'Display'));
    slider(t('Taille de l’interface', 'Interface size'), 0.7, 2, 0.05, () => sv.options.hudScale, (v) => { sv.options.hudScale = v; }, pct);
    slider(t('Secousse de caméra', 'Camera shake'), 0, 1, 0.05, () => sv.options.shake, (v) => { sv.options.shake = v; }, pct);
    toggle(t('Contraste renforcé', 'High contrast'), t('Textes plus clairs et mieux détourés.', 'Brighter text with stronger outlines.'),
      () => sv.options.highContrast, (v) => { sv.options.highContrast = v; });
    toggle(t('Police uniforme', 'Uniform font'), t('Une seule famille sans empattement, plus espacée.', 'A single, more widely spaced sans-serif family.'),
      () => sv.options.plainFont, (v) => { sv.options.plainFont = v; });

    section(t('Confort visuel', 'Visual comfort'));
    toggle(t('Réduire les flashs', 'Reduce flashes'), t('Supprime les flashs plein écran et les vignettes pulsées.', 'Removes full-screen flashes and pulsing vignettes.'),
      () => sv.options.reduceFlash, (v) => { sv.options.reduceFlash = v; });
    toggle(t('Réduire les animations', 'Reduce motion'), t('Coulures du logo, sprites du codex, transitions.', 'Logo drips, Codex sprites and transitions.'),
      () => sv.options.reduceMotion, (v) => { sv.options.reduceMotion = v; });
    toggle(t('Chiffres de dégâts', 'Damage numbers'), t('Les couper réduit beaucoup le bruit à l’écran.', 'Turning them off greatly reduces visual clutter.'),
      () => sv.options.showDamage, (v) => { sv.options.showDamage = v; });

    section(t('Jeu', 'Gameplay'));
    toggle(t('Repère sous le joueur', 'Player marker'), t('Un anneau permanent pour ne jamais vous perdre dans la horde.', 'A permanent ring so you never lose yourself in the horde.'),
      () => sv.options.highlightPlayer, (v) => { sv.options.highlightPlayer = v; });
    slider(t('Vitesse du jeu', 'Game speed'), 0.6, 1, 0.05, () => sv.options.gameSpeed, (v) => { sv.options.gameSpeed = v; }, pct);
    const speedNote = document.createElement('div');
    speedNote.className = 'opt-hint';
    speedNote.style.margin = '-.3em 0 .6em';
    speedNote.textContent = t('Le jeu reste identique, il se déroule simplement moins vite.', 'The game stays the same; it simply runs more slowly.');
    scroll.appendChild(speedNote);

    el.appendChild(scroll);
    const back = this.button(t('Retour', 'Back'));
    back.addEventListener('click', onBack);
    el.appendChild(back);
    this.navigable([back]);
  }

  // ----------------------------------------------------------------- pause

  pause(onResume: () => void, onQuit: () => void, player?: Player, onLab?: () => void): void {
    const el = this.open('pause');
    // « Échap » ne veut rien dire sur une tablette : le raccourci n'y existe pas.
    const rappel = isTouch() ? t('Le temps est arrêté.', 'Time has stopped.') : t('Échap pour reprendre', 'Escape to resume');
    el.innerHTML = `<h2 class="title-font">Pause</h2><p class="hint">${rappel}</p>`;
    const list = document.createElement('div');
    list.className = 'menu-list';
    const resume = this.button(t('Reprendre', 'Resume'), 'primary');
    const quit = this.button(t('Abandonner', 'Abandon run'), 'danger');
    resume.addEventListener('click', onResume);
    quit.addEventListener('click', onQuit);
    list.append(resume, quit);
    el.appendChild(list);
    const items: HTMLElement[] = [resume, quit];
    if (onLab) {
      // Outil de curiosité, pas une option de jeu : un bouton discret, sous le menu.
      const lab = this.button(t('Laboratoire d’effets', 'Effects lab'), 'small');
      lab.title = t('Bac à sable pour voir et régler les effets. La partie ne comptera plus.', 'A sandbox to preview and tune effects. The run will no longer count.');
      lab.addEventListener('click', onLab);
      el.appendChild(lab);
      items.push(lab);
    }
    if (player) el.appendChild(this.inventory(player));
    this.navigable(items);
  }

  /**
   * Inventaire de la partie en cours : armes, objets et reliques, chacun avec son effet.
   *
   * Il vit dans l'écran de pause parce que c'est le seul moment où le joueur peut lire. En
   * jeu, une relique ramassée n'était plus qu'une initiale dans un coin de l'écran, et son
   * effet ne se retrouvait que dans le codex du menu principal – donc en quittant la partie.
   */
  private inventory(pl: Player): HTMLDivElement {
    const box = document.createElement('div');
    box.className = 'pause-build';

    const section = (title: string, count: number): HTMLDivElement => {
      const h = document.createElement('div');
      h.className = 'pause-build-title';
      h.textContent = `${title} · ${count}`;
      const rows = document.createElement('div');
      rows.className = 'pause-build-rows';
      box.append(h, rows);
      return rows;
    };

    const row = (icon: HTMLElement, name: string, level: string, desc: string): HTMLDivElement => {
      const el = document.createElement('div');
      el.className = 'pause-build-row';
      const n = document.createElement('div');
      n.className = 'n';
      n.textContent = name;
      if (level) {
        const l = document.createElement('span');
        l.className = 'l';
        l.textContent = level;
        n.appendChild(l);
      }
      const d = document.createElement('div');
      d.className = 'd';
      d.textContent = desc;
      el.append(icon, n, d);
      return el;
    };

    const iconOf = (kind: 'weapon' | 'passive', id: string): HTMLCanvasElement => {
      const src = iconFor(kind, id);
      const c = src.cloneNode(true) as HTMLCanvasElement;
      c.getContext('2d')!.drawImage(src, 0, 0);
      return c;
    };

    const weapons = section(t('Armes', 'Weapons'), pl.weapons.length);
    for (const inst of pl.weapons) {
      const level = inst.def.isEvolution ? '★' : `${t('niv.', 'lv.')} ${inst.level}/${inst.def.maxLevel}`;
      weapons.appendChild(row(iconOf('weapon', inst.def.id), inst.def.name, level, inst.def.desc));
    }

    if (pl.passives.size > 0) {
      const passives = section(t('Objets', 'Items'), pl.passives.size);
      for (const [id, lvl] of pl.passives) {
        const def = passiveById(id);
        passives.appendChild(row(iconOf('passive', id), def.name, `${t('niv.', 'lv.')} ${lvl}/${def.maxLevel}`, def.desc));
      }
    }

    const relics = section(t('Reliques', 'Relics'), pl.relics.length);
    if (pl.relics.length === 0) {
      const none = document.createElement('div');
      none.className = 'pause-build-none';
      none.textContent = t(
        'Aucune pour l’instant. Les élites, les boss et les autels en lâchent.',
        'None yet. Elites, bosses and altars drop them.',
      );
      relics.appendChild(none);
    }
    for (const id of pl.relics) {
      const def = RELIC_BY_ID.get(id);
      if (!def) continue;
      const chip = document.createElement('div');
      chip.className = `relic-chip ${def.rarity}`;
      chip.textContent = def.name.charAt(0).toUpperCase();
      relics.appendChild(row(chip, def.name, RARITY_LABEL[def.rarity], def.desc));
    }
    return box;
  }

  // ------------------------------------------------------------ fin de run

  gameOver(sum: RunSummary, victory: boolean, onRetry: () => void, onMenu: () => void): void {
    const el = this.open(victory ? 'victory' : 'gameover');

    // Le même logo saignant que l'écran-titre : c'est précisément ici qu'il prend son sens.
    // À la victoire, ce n'est plus du sang qui coule mais la lumière de l'aube.
    const logo = new BloodLogo(victory ? t('AUBE', 'DAWN') : t('MORT', 'DEATH'), victory ? 0x21b : 0x9c4, victory ? DAWN : BLOOD);
    const h1 = document.createElement('h1');
    h1.className = 'title-font';
    h1.appendChild(logo.canvas);
    el.appendChild(h1);
    logo.start();
    const prevCleanup = this.cleanup;
    this.cleanup = (): void => {
      prevCleanup?.();
      logo.stop();
    };

    const tag = document.createElement('p');
    tag.className = 'tagline';
    tag.textContent = victory ? t('Elle est venue, finalement.', 'At last, it came.') : t('Le domaine vous garde.', 'The domain keeps you.');
    el.appendChild(tag);

    // Le bilan de fin est le moment où l'on regarde ses chiffres : c'est précisément là
    // qu'un tableau de texte est le plus décevant.
    el.appendChild(this.statStrip([
      ['t', makeItem('hourglass'), formatTime(sum.time), t('Temps', 'Time')],
      ['lv', makeGem(3), String(sum.level), t('Niveau', 'Level')],
      ['k', makeBody('enemy:ghoul', enemyById('ghoul').art), abbrev(sum.kills), t('Abattus', 'Slain')],
      ['d', makeProjectile('stake', '#f7ede0'), abbrev(sum.damage), t('Dégâts', 'Damage')],
      ['g', makeGem(1), abbrev(sum.gems), t('Gemmes', 'Gems')],
      ['r', makeRelic('epic'), String(sum.relics), t('Reliques', 'Relics')],
      ['o', makeCoin(), abbrev(sum.gold), t('Or', 'Gold')],
    ]));

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.style.padding = '.9em 1.6em';
    const who = document.createElement('div');
    who.className = 'stats-table';
    for (const [k, v] of [[t('Personnage', 'Character'), sum.character], [t('Graine', 'Seed'), String(sum.seed)]] as [string, string][]) {
      const kd = document.createElement('div');
      kd.className = 'k';
      kd.textContent = k;
      const vd = document.createElement('div');
      vd.className = 'v';
      vd.textContent = v;
      who.append(kd, vd);
    }
    panel.appendChild(who);
    el.appendChild(panel);

    const list = document.createElement('div');
    list.className = 'menu-list';
    const retry = this.button(t('Rejouer', 'Play again'), 'primary');
    const menu = this.button(t('Menu principal', 'Main menu'));
    retry.addEventListener('click', () => { audio.play('confirm'); onRetry(); });
    menu.addEventListener('click', () => { audio.play('confirm'); onMenu(); });
    list.append(retry, menu);
    el.appendChild(list);
    this.navigable([retry, menu]);
  }
}
