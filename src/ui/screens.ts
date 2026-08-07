import { formatTime, abbrev } from '../core/math';
import { load, save, update, wipe, type SaveData } from '../core/save';
import { audio } from '../audio/audio';
import {
  makeHero, makeIcon, makeProjectile, makeBody, makeRelic, spriteSheet,
  type Sheet, type SpriteSet,
} from '../gfx/sprites';
import { CHARACTERS, type CharacterDef } from '../data/characters';
import { META_UPGRADES, costOf } from '../data/meta';
import { RELICS, RARITY_LABEL } from '../data/relics';
import { WEAPONS } from '../data/weapons';
import { PASSIVE_BY_ID } from '../data/passives';
import { ENEMIES, BOSSES, type EnemyAI } from '../data/enemies';
import type { Rarity } from '../gfx/palette';
import type { Offer, ChestResult } from '../game/upgrades';

/** Libellés lisibles des comportements d'IA, pour le bestiaire. */
const AI_LABEL: Record<EnemyAI, string> = {
  chase: 'poursuite',
  wave: 'poursuite ondulante',
  erratic: 'trajectoire erratique',
  charger: 'charges répétées',
  phase: 'traverse les corps',
  ranged: 'crache à distance',
  leech: 'se nourrit de vous',
  dasher: 'ruée rectiligne',
  split: 'se scinde à la mort',
};

/** La CSS nomme les raretés en anglais court ; la table évite d'éparpiller la correspondance. */
const RARITY_CSS: Record<Rarity, string> = {
  common: 'common',
  rare: 'rare',
  epic: 'epic',
  cursed: 'cursed',
};

/**
 * Écrans DOM. Chaque écran est reconstruit à l'affichage puis détruit — la fréquence est
 * faible (quelques fois par partie) et cela évite toute désynchronisation d'état.
 *
 * Tous les écrans sont navigables au clavier et à la manette : la sélection courante est
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

type Cleanup = () => void;

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

  // ------------------------------------------------------------------ titre

  title(onPlay: () => void, onSanctuary: () => void, onOptions: () => void, onCodex: () => void): void {
    const el = this.open('title');
    const sv = load();

    el.innerHTML = `
      <h1 class="title-font">SANGUINE</h1>
      <div class="flourish"></div>
      <p class="tagline">« Tenez jusqu'à l'aube. Elle ne viendra pas. »</p>
    `;

    const list = document.createElement('div');
    list.className = 'menu-list';
    const bPlay = this.button('Jouer', 'primary');
    const bSanct = this.button('Sanctuaire');
    const bCodex = this.button('Codex');
    const bOpt = this.button('Options');
    bPlay.addEventListener('click', () => { audio.play('confirm'); onPlay(); });
    bSanct.addEventListener('click', () => { audio.play('confirm'); onSanctuary(); });
    bCodex.addEventListener('click', () => { audio.play('confirm'); onCodex(); });
    bOpt.addEventListener('click', () => { audio.play('confirm'); onOptions(); });
    list.append(bPlay, bSanct, bCodex, bOpt);
    el.appendChild(list);

    const stats = document.createElement('div');
    stats.className = 'hint';
    stats.style.marginTop = '1em';
    stats.textContent = sv.stats.runs > 0
      ? `${sv.stats.runs} parties · ${abbrev(sv.stats.kills)} ennemis abattus · meilleur temps ${formatTime(sv.stats.bestTime)} · ${abbrev(sv.gold)} or`
      : 'ZQSD ou WASD pour se déplacer. Les armes tirent seules.';
    el.appendChild(stats);

    this.navigable([bPlay, bSanct, bCodex, bOpt]);
  }

  // ------------------------------------------------- sélection de personnage

  characterSelect(onPick: (id: string) => void, onBack: () => void): void {
    const el = this.open('charselect');
    const sv = load();
    el.innerHTML = `<h2 class="title-font">Qui entre dans le domaine ?</h2>`;

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
        const lock = document.createElement('div');
        lock.className = 'unlock';
        lock.textContent = c.unlock?.label ?? '';
        card.appendChild(lock);
        card.addEventListener('click', () => audio.play('deny'));
      }
      grid.appendChild(card);
    }

    el.appendChild(grid);
    const back = this.button('Retour');
    back.addEventListener('click', onBack);
    el.appendChild(back);
    items.push(back);
    this.navigable(items, 3);
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

  // ------------------------------------------------------------- montée de niveau

  levelUp(
    offers: Offer[],
    rerollsLeft: number,
    onPick: (o: Offer) => void,
    onReroll: () => void,
    onSkip: () => void,
  ): void {
    const el = this.open('levelup');
    el.innerHTML = `<h2 class="title-font">Niveau supérieur</h2>`;

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
    const skip = this.button('Passer (+50 or)');
    skip.addEventListener('click', () => { audio.play('confirm'); onSkip(); });
    actions.append(reroll, skip);
    el.appendChild(actions);
    items.push(reroll, skip);

    this.navigable(items, offers.length);
  }

  // ---------------------------------------------------------------- coffre

  chest(res: ChestResult, onDone: () => void): void {
    const el = this.open('chestscreen');
    el.innerHTML = `<h2 class="title-font">Coffre</h2>`;

    if (res.evolution) {
      const evo = document.createElement('div');
      evo.className = 'card is-evo';
      evo.style.width = '18em';
      evo.innerHTML = `
        <div class="kind">Évolution</div>
        <div class="name"></div>
        <div class="desc"></div>
        <div class="lvltag"></div>`;
      evo.querySelector('.name')!.textContent = res.evolution.to.name;
      evo.querySelector('.desc')!.textContent = res.evolution.to.desc;
      evo.querySelector('.lvltag')!.textContent = `remplace ${res.evolution.from.name}`;
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
    gold.textContent = `+${res.gold} or${res.rerolls ? ` · +${res.rerolls} reroll` : ''}`;
    el.appendChild(gold);

    const ok = this.button('Empocher', 'primary');
    ok.addEventListener('click', () => { audio.play('confirm'); onDone(); });
    el.appendChild(ok);
    this.navigable([ok]);
  }

  // ------------------------------------------------------------ sanctuaire

  sanctuary(onBack: () => void): void {
    const render = (): void => {
      const el = this.open('sanctuary');
      const sv = load();
      el.innerHTML = `<h2 class="title-font">Sanctuaire</h2>`;

      const gold = document.createElement('div');
      gold.className = 'gold-count';
      gold.textContent = `${abbrev(sv.gold)} or`;
      el.appendChild(gold);

      const grid = document.createElement('div');
      grid.className = 'sanct-grid';
      const items: HTMLElement[] = [];

      for (const up of META_UPGRADES) {
        const lvl = sv.sanctuary[up.id] ?? 0;
        const maxed = lvl >= up.levels;
        const cost = costOf(up, lvl);

        const row = document.createElement('div');
        row.className = 'sanct-row';

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

        const buy = this.button(maxed ? 'MAX' : `${cost}`, 'buy');
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
      const back = this.button('Retour');
      back.addEventListener('click', onBack);
      const reset = this.button('Tout réinitialiser', 'danger');
      let armed = false;
      reset.addEventListener('click', () => {
        if (!armed) {
          armed = true;
          reset.textContent = 'Confirmer ? (irréversible)';
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
   * sprites animés simultanément sans qu'une seule ligne de JavaScript ne tourne — là où une
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
   * (le Sanguinaire) : un facteur fixe ferait déborder les uns et rendrait les autres
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
  ): HTMLDivElement {
    const cell = document.createElement('div');
    cell.className = `codex-cell${discovered ? '' : ' locked'}`;

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
    d.textContent = discovered ? desc : 'Non découvert';
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

    const gWeapons = section('Armes', sv.seenWeapons.filter((id) => base.some((b) => b.id === id)).length, base.length);
    for (const def of base) {
      const seen = sv.seenWeapons.includes(def.id);
      gWeapons.appendChild(this.codexCell(
        sheetOf(`codex:w:${def.id}`, makeProjectile(def.sprite, def.color)),
        seen, def.name, def.desc, `${def.damage} dégâts · ${def.cooldown} s`, 'var(--mist)',
      ));
    }

    const gEvos = section('Évolutions', sv.seenWeapons.filter((id) => evos.some((e) => e.id === id)).length, evos.length);
    for (const def of evos) {
      const seen = sv.seenWeapons.includes(def.id);
      const from = WEAPONS.find((x) => x.evolvesTo === def.id);
      const recipe = from
        ? `${from.name} + ${from.requires ? PASSIVE_BY_ID.get(from.requires)?.name ?? '' : ''}`
        : 'Évolution';
      gEvos.appendChild(this.codexCell(
        sheetOf(`codex:w:${def.id}`, makeProjectile(def.sprite, def.color)),
        seen, def.name, def.desc, recipe, 'var(--rar-epic)',
      ));
    }

    // -------------------------------------------------------------- bestiaire
    const all = [...ENEMIES, ...BOSSES];
    const gBeasts = section('Bestiaire', sv.seenEnemies.length, all.length);
    for (const def of all) {
      const seen = sv.seenEnemies.includes(def.id);
      const isBoss = !!def.boss;
      gBeasts.appendChild(this.codexCell(
        sheetOf(`codex:e:${def.id}`, makeBody(`enemy:${def.id}`, def.art)),
        seen, def.name,
        `${def.hp} PV · ${def.damage} dégâts · ${AI_LABEL[def.ai] ?? def.ai}`,
        isBoss ? 'BOSS' : `dès ${def.from} min`,
        isBoss ? 'var(--blood-hi)' : 'var(--mist)',
        isBoss ? 0.9 : 0.5,
      ));
    }

    // --------------------------------------------------------------- reliques
    const gRelics = section('Reliques', sv.seenRelics.length, RELICS.length);
    for (const r of RELICS) {
      const seen = sv.seenRelics.includes(r.id);
      gRelics.appendChild(this.codexCell(
        sheetOf(`codex:r:${r.rarity}`, makeRelic(r.rarity)),
        seen, r.name, r.desc, RARITY_LABEL[r.rarity], `var(--rar-${RARITY_CSS[r.rarity]})`, 1.1,
      ));
    }

    el.appendChild(scroll);
    const back = this.button('Retour');
    back.addEventListener('click', onBack);
    el.appendChild(back);
    this.navigable([back]);
  }

  // --------------------------------------------------------------- options

  options(
    onBack: () => void,
    onHudScale: (v: number) => void,
    onReduceFlash: (v: boolean) => void,
    onShake: (v: number) => void,
  ): void {
    const el = this.open('options');
    const sv = load();
    el.innerHTML = `<h2 class="title-font">Options</h2>`;

    const slider = (label: string, value: number, apply: (v: number) => void): HTMLDivElement => {
      const row = document.createElement('div');
      row.className = 'opt-row';
      const l = document.createElement('label');
      l.textContent = label;
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = '100';
      input.value = String(Math.round(value * 100));
      input.addEventListener('input', () => {
        const v = Number(input.value) / 100;
        apply(v);
        save();
      });
      row.append(l, input);
      return row;
    };

    el.appendChild(slider('Volume général', sv.options.master, (v) => {
      sv.options.master = v;
      audio.masterVol = v;
      audio.applyVolumes();
    }));
    el.appendChild(slider('Effets sonores', sv.options.sfx, (v) => {
      sv.options.sfx = v;
      audio.sfxVol = v;
      audio.applyVolumes();
    }));
    el.appendChild(slider('Musique', sv.options.music, (v) => {
      sv.options.music = v;
      audio.musicVol = v;
      audio.applyVolumes();
    }));
    el.appendChild(slider('Taille du HUD', (sv.options.hudScale - 0.7) / 0.8, (v) => {
      const scale = 0.7 + v * 0.8;
      sv.options.hudScale = scale;
      onHudScale(scale);
    }));

    // Secousse de caméra : réglable jusqu'à zéro. Un survivor-like enchaîne tant d'impacts
    // qu'une secousse mal dosée devient physiquement pénible ; c'est un réglage de confort,
    // pas un effet cosmétique.
    el.appendChild(slider('Secousse de caméra', sv.options.shake, (v) => {
      sv.options.shake = v;
      onShake(v);
    }));

    const flashRow = document.createElement('div');
    flashRow.className = 'opt-row';
    const fl = document.createElement('label');
    fl.textContent = 'Réduire les flashs et secousses';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = sv.options.reduceFlash;
    cb.addEventListener('change', () => {
      sv.options.reduceFlash = cb.checked;
      onReduceFlash(cb.checked);
      save();
    });
    flashRow.append(fl, cb);
    el.appendChild(flashRow);

    const back = this.button('Retour');
    back.addEventListener('click', onBack);
    el.appendChild(back);
    this.navigable([back]);
  }

  // ----------------------------------------------------------------- pause

  pause(onResume: () => void, onQuit: () => void): void {
    const el = this.open('pause');
    el.innerHTML = `<h2 class="title-font">Pause</h2><p class="hint">Échap pour reprendre</p>`;
    const list = document.createElement('div');
    list.className = 'menu-list';
    const resume = this.button('Reprendre', 'primary');
    const quit = this.button('Abandonner', 'danger');
    resume.addEventListener('click', onResume);
    quit.addEventListener('click', onQuit);
    list.append(resume, quit);
    el.appendChild(list);
    this.navigable([resume, quit]);
  }

  // ------------------------------------------------------------ fin de run

  gameOver(sum: RunSummary, victory: boolean, onRetry: () => void, onMenu: () => void): void {
    const el = this.open(victory ? 'victory' : 'gameover');
    el.innerHTML = victory
      ? `<h1 class="title-font">L'AUBE</h1><p class="tagline">Elle est venue, finalement.</p>`
      : `<h1 class="title-font">MORT</h1><p class="tagline">Le domaine vous garde.</p>`;

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.style.padding = '1.2em 1.8em';
    const table = document.createElement('div');
    table.className = 'stats-table';
    const rows: [string, string][] = [
      ['Temps', formatTime(sum.time)],
      ['Niveau', String(sum.level)],
      ['Ennemis abattus', abbrev(sum.kills)],
      ['Dégâts infligés', abbrev(sum.damage)],
      ['Gemmes ramassées', abbrev(sum.gems)],
      ['Reliques trouvées', String(sum.relics)],
      ['Or gagné', `${abbrev(sum.gold)}`],
      ['Personnage', sum.character],
      ['Graine', String(sum.seed)],
    ];
    for (const [k, v] of rows) {
      const kd = document.createElement('div');
      kd.className = 'k';
      kd.textContent = k;
      const vd = document.createElement('div');
      vd.className = 'v';
      vd.textContent = v;
      table.append(kd, vd);
    }
    panel.appendChild(table);
    el.appendChild(panel);

    const list = document.createElement('div');
    list.className = 'menu-list';
    const retry = this.button('Rejouer', 'primary');
    const menu = this.button('Menu principal');
    retry.addEventListener('click', () => { audio.play('confirm'); onRetry(); });
    menu.addEventListener('click', () => { audio.play('confirm'); onMenu(); });
    list.append(retry, menu);
    el.appendChild(list);
    this.navigable([retry, menu]);
  }
}
