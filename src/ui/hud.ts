import { formatTime, abbrev, clamp } from '../core/math';
import { RELIC_BY_ID } from '../data/relics';
import { passiveById } from '../data/passives';
import { iconFor } from '../game/upgrades';
import { Minimap } from './minimap';
import type { World } from '../game/world';

/**
 * HUD en DOM plutôt qu'en canvas : texte net à toute résolution, accessible aux lecteurs
 * d'écran, et coût nul dans la boucle de rendu.
 *
 * Les nœuds sont créés une fois puis mis à jour ; les listes d'emplacements ne sont
 * reconstruites que lorsque la signature du build change.
 */
export class Hud {
  readonly root: HTMLDivElement;

  private xpFill!: HTMLDivElement;
  private timer!: HTMLDivElement;
  private hpBar!: HTMLDivElement;
  private hpText!: HTMLDivElement;
  private levelText!: HTMLDivElement;
  private weaponRow!: HTMLDivElement;
  private passiveRow!: HTMLDivElement;
  private goldText!: HTMLSpanElement;
  private killsText!: HTMLSpanElement;
  private relicRail!: HTMLDivElement;
  private bossBar!: HTMLDivElement;
  private bossName!: HTMLDivElement;
  private bossFill!: HTMLDivElement;
  private banner!: HTMLDivElement;
  private lowHp!: HTMLDivElement;

  private buildSig = '';
  private relicSig = 0;
  private tooltip: HTMLDivElement | null = null;
  readonly minimap: Minimap;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div class="xp-track"><div class="xp-fill"></div></div>
      <div class="hud-timer">00:00</div>
      <div class="hud-topleft">
        <div class="hud-stat"><span class="k">NIV</span> <span class="v lvl">1</span></div>
        <div class="hp-wrap" style="width:9em;margin-top:3px">
          <div style="height:7px;background:#05060a;border:1px solid #232b40">
            <div class="hp-fill" style="height:100%;width:100%;background:linear-gradient(180deg,#f0405a,#c42639 60%,#8b1a2b);transition:width .1s linear"></div>
          </div>
          <div class="hp-text hud-stat" style="font-size:.78em;margin-top:1px"></div>
        </div>
        <div class="slot-row weapons"></div>
        <div class="slot-row passives"></div>
      </div>
      <div class="hud-topright">
        <div class="hud-stat"><span class="k">OR</span> <span class="v gold">0</span></div>
        <div class="hud-stat"><span class="k">MORTS</span> <span class="v kills">0</span></div>
      </div>
      <div class="relic-rail"></div>
      <div class="boss-bar" style="display:none">
        <div class="name"></div>
        <div class="track"><div class="fill" style="width:100%"></div></div>
      </div>
      <div class="banner" style="display:none"><div class="big"></div><div class="sub"></div></div>
      <div class="lowhp" style="display:none"></div>
    `;
    parent.appendChild(this.root);

    const q = <T extends HTMLElement>(sel: string): T => this.root.querySelector(sel) as T;
    this.xpFill = q('.xp-fill');
    this.timer = q('.hud-timer');
    this.hpBar = q('.hp-fill');
    this.hpText = q('.hp-text');
    this.levelText = q('.lvl');
    this.weaponRow = q('.slot-row.weapons');
    this.passiveRow = q('.slot-row.passives');
    this.goldText = q('.gold');
    this.killsText = q('.kills');
    this.relicRail = q('.relic-rail');
    this.bossBar = q('.boss-bar');
    this.bossName = q('.boss-bar .name');
    this.bossFill = q('.boss-bar .fill');
    this.banner = q('.banner');
    this.lowHp = q('.lowhp');

    this.minimap = new Minimap(this.root);
  }

  show(): void {
    this.root.style.display = 'block';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  destroy(): void {
    this.minimap.destroy();
    this.root.remove();
    this.tooltip?.remove();
  }

  /** `dt` sert uniquement aux animations du HUD (clignotements de la minimap). */
  update(w: World, dt = 1 / 60): void {
    const pl = w.player;
    this.minimap.update(w, dt);

    this.xpFill.style.width = `${pl.xpRatio * 100}%`;
    this.levelText.textContent = String(pl.level);

    const t = formatTime(w.time);
    if (this.timer.textContent !== t) this.timer.textContent = t;
    this.timer.classList.toggle('urgent', w.minute >= 25);

    const hpRatio = pl.hpRatio;
    this.hpBar.style.width = `${hpRatio * 100}%`;
    this.hpText.textContent = `${Math.ceil(pl.hp)} / ${Math.round(pl.stats.maxHp)}`;

    this.goldText.textContent = abbrev(w.gold);
    this.killsText.textContent = abbrev(w.kills);

    this.syncSlots(w);
    this.syncRelics(w);
    this.syncBoss(w);
    this.syncBanner(w);

    const critical = hpRatio < 0.25 && !pl.dead;
    this.lowHp.style.display = critical ? 'block' : 'none';
  }

  // ------------------------------------------------------------- emplacements

  private syncSlots(w: World): void {
    const pl = w.player;
    const sig =
      pl.weapons.map((x) => `${x.def.id}${x.level}`).join(',') +
      '|' +
      [...pl.passives].map(([k, v]) => `${k}${v}`).join(',');
    if (sig === this.buildSig) return;
    const isFirst = this.buildSig === '';
    this.buildSig = sig;

    this.weaponRow.textContent = '';
    for (const inst of pl.weapons) {
      const maxed = inst.level >= inst.def.maxLevel;
      this.weaponRow.appendChild(
        this.makeSlot(
          iconFor('weapon', inst.def.id),
          inst.def.isEvolution ? '★' : String(inst.level),
          inst.def.isEvolution ? 'evolved' : maxed ? 'maxed' : '',
          inst.def.name,
          inst.def.desc,
          isFirst,
        ),
      );
    }

    this.passiveRow.textContent = '';
    for (const [id, lvl] of pl.passives) {
      const def = passiveById(id);
      this.passiveRow.appendChild(
        this.makeSlot(
          iconFor('passive', id),
          String(lvl),
          lvl >= def.maxLevel ? 'maxed' : '',
          def.name,
          def.desc,
          isFirst,
        ),
      );
    }
  }

  private makeSlot(
    icon: HTMLCanvasElement,
    label: string,
    cls: string,
    title: string,
    desc: string,
    skipAnim: boolean,
  ): HTMLDivElement {
    const el = document.createElement('div');
    el.className = `slot ${cls}${skipAnim ? '' : ' new'}`;
    const c = icon.cloneNode(true) as HTMLCanvasElement;
    c.getContext('2d')!.drawImage(icon, 0, 0);
    el.appendChild(c);
    const lvl = document.createElement('span');
    lvl.className = 'lvl';
    lvl.textContent = label;
    el.appendChild(lvl);
    this.attachTip(el, title, desc);
    return el;
  }

  private syncRelics(w: World): void {
    const pl = w.player;
    if (pl.relics.length === this.relicSig) return;
    this.relicSig = pl.relics.length;

    this.relicRail.textContent = '';
    for (const id of pl.relics) {
      const def = RELIC_BY_ID.get(id);
      if (!def) continue;
      const chip = document.createElement('div');
      chip.className = `relic-chip ${def.rarity}`;
      chip.textContent = def.name.charAt(0).toUpperCase();
      this.attachTip(chip, def.name, def.desc);
      this.relicRail.appendChild(chip);
    }
  }

  private syncBoss(w: World): void {
    const group = w.bossGroup.filter((b) => b.active && b.dying <= 0);
    if (group.length === 0) {
      this.bossBar.style.display = 'none';
      return;
    }
    let hp = 0;
    let max = 0;
    for (const b of group) {
      hp += Math.max(0, b.hp);
      max += b.maxHp;
    }
    this.bossBar.style.display = 'block';
    this.bossName.textContent = w.bossName;
    this.bossFill.style.width = `${clamp(hp / Math.max(1, max), 0, 1) * 100}%`;
  }

  private syncBanner(w: World): void {
    const a = w.announcement;
    if (!a) {
      this.banner.style.display = 'none';
      return;
    }
    const big = this.banner.querySelector('.big')!;
    const sub = this.banner.querySelector('.sub')!;
    if (big.textContent !== a.text) {
      big.textContent = a.text;
      sub.textContent = a.sub;
      // Force le rejeu de l'animation CSS d'entrée.
      this.banner.style.display = 'none';
      void this.banner.offsetHeight;
    }
    this.banner.style.display = 'block';
    this.banner.style.opacity = String(clamp(a.time / 0.5, 0, 1));
  }

  // ---------------------------------------------------------------- infobulle

  private attachTip(el: HTMLElement, title: string, desc: string): void {
    el.addEventListener('pointerenter', () => {
      this.tooltip?.remove();
      const tip = document.createElement('div');
      tip.className = 'tip';
      tip.innerHTML = `<span class="t"></span>`;
      tip.querySelector('.t')!.textContent = title;
      tip.appendChild(document.createTextNode(desc));
      this.root.appendChild(tip);
      const r = el.getBoundingClientRect();
      const rootR = this.root.getBoundingClientRect();
      tip.style.left = `${clamp(r.left - rootR.left, 4, rootR.width - 200)}px`;
      tip.style.top = `${r.bottom - rootR.top + 4}px`;
      this.tooltip = tip;
    });
    el.addEventListener('pointerleave', () => {
      this.tooltip?.remove();
      this.tooltip = null;
    });
  }
}
