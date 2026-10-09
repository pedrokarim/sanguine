import { TAU } from '../core/math';
import { fxRng } from '../core/rng';
import { P } from '../gfx/palette';
import { makeProjectile } from '../gfx/sprites';
import {
  fxSettings, fxStats, FX_DEFAULTS, FX_TEXTURES, textureOf,
  type FxSettings, type FxView,
} from '../gfx/fx';
import { WEAPONS, weaponById } from '../data/weapons';
import { ENEMIES } from '../data/enemies';
import { iconFor } from '../game/upgrades';
import type { World } from '../game/world';
import type { Loop } from '../core/loop';
import { t } from '../i18n';

/**
 * Laboratoire d'effets.
 *
 * Un effet se règle à l'œil, pas dans un fichier : changer une constante, recompiler,
 * rejouer jusqu'à retrouver l'arme concernée, c'est dix minutes pour juger un halo. Ce
 * panneau ramène la boucle à une seconde. Il s'ouvre en partie (`F9`, ou `?fx` dans
 * l'adresse), transforme la partie en bac à sable – horde suspendue, joueur intouchable,
 * montées de niveau ignorées – et donne trois choses :
 *
 *   – **voir** : n'importe quelle arme équipée seule, chaque effet déclenché à la demande,
 *     la couche de lumière isolée du reste, et les textures telles qu'elles sont peintes ;
 *   – **régler** : halo, lumière, densité de particules, traînées, cercles, taille, ralenti ;
 *   – **garder** : les réglages sont conservés d'une session à l'autre et s'exportent en
 *     JSON, pour devenir les valeurs par défaut du jeu une fois arrêtés.
 */

const STORAGE_KEY = 'sanguine.fx';

type NumericKey = { [K in keyof FxSettings]: FxSettings[K] extends number ? K : never }[keyof FxSettings];

interface SliderDef {
  key: NumericKey;
  label: string;
  hint: string;
  max: number;
}

const SLIDERS: SliderDef[] = [
  { key: 'bloom', label: t('Halo', 'Bloom'), hint: t('Débordement de la lumière autour de sa forme.', 'How far light spills past its shape.'), max: 2.5 },
  { key: 'light', label: t('Lumière', 'Light'), hint: t('Opacité de toute la couche lumineuse.', 'Opacity of the whole light layer.'), max: 2 },
  { key: 'particles', label: t('Particules', 'Particles'), hint: t('Nombre de particules émises.', 'Number of particles emitted.'), max: 3 },
  { key: 'trails', label: t('Traînées', 'Trails'), hint: t('Longueur des traînées de projectiles.', 'Length of projectile trails.'), max: 3 },
  { key: 'sigils', label: t('Cercles', 'Sigils'), hint: t('Opacité des cercles magiques au sol.', 'Opacity of ground sigils.'), max: 2 },
  { key: 'scale', label: t('Taille', 'Size'), hint: t('Taille des coups, éclairs et explosions.', 'Size of slashes, bolts and blasts.'), max: 2 },
];

const VIEWS: [FxView, string][] = [
  ['normal', t('Normal', 'Normal')],
  ['light', t('Lumière seule', 'Light only')],
  ['flat', t('Sans lumière', 'No light')],
];

/** Applique les réglages enregistrés. À appeler une fois au démarrage, laboratoire ouvert ou non. */
export function loadFxSettings(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<FxSettings>;
    for (const s of SLIDERS) {
      const v = saved[s.key];
      if (typeof v === 'number' && Number.isFinite(v)) fxSettings[s.key] = Math.min(s.max, Math.max(0, v));
    }
  } catch {
    // Stockage indisponible ou contenu illisible : on garde les valeurs par défaut.
  }
}

function saveFxSettings(): void {
  try {
    // La vue est un outil de diagnostic, pas un réglage : elle ne se conserve pas.
    const { view: _view, ...kept } = fxSettings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
  } catch {
    // Voir `loadFxSettings`.
  }
}

export class FxLab {
  readonly root: HTMLDivElement;
  isOpen = false;
  /** Suspend le flux d'ennemis. Lu par la boucle principale. */
  holdSpawns = true;
  invulnerable = true;

  private statsEl!: HTMLDivElement;
  private color: string = P.ice;
  private maxLevel = true;
  private textureRow!: HTMLDivElement;
  private refreshers: (() => void)[] = [];
  private savedSpeed = 1;

  constructor(parent: HTMLElement, private readonly getWorld: () => World | null) {
    this.root = document.createElement('div');
    this.root.className = 'fxlab';
    this.root.style.display = 'none';
    // Un clic dans le panneau ne doit ni armer le joystick tactile ni atteindre le jeu.
    for (const ev of ['pointerdown', 'mousedown', 'touchstart', 'wheel'] as const) {
      this.root.addEventListener(ev, (e) => e.stopPropagation());
    }
    parent.appendChild(this.root);
    this.build();
  }

  toggle(force?: boolean): void {
    const next = force ?? !this.isOpen;
    if (next === this.isOpen) return;
    this.isOpen = next;
    this.root.style.display = next ? 'flex' : 'none';
    const w = this.getWorld();
    if (next) {
      this.savedSpeed = w?.speedScale ?? 1;
      for (const r of this.refreshers) r();
    } else {
      fxSettings.view = 'normal';
      if (w) w.speedScale = this.savedSpeed;
    }
  }

  /** À appeler à chaque image tant que le panneau est ouvert. */
  update(loop: Loop): void {
    const w = this.getWorld();
    if (!w) return;
    if (this.invulnerable) w.player.hp = w.player.stats.maxHp;
    this.statsEl.textContent =
      `${loop.fps.toFixed(0)} fps · ${t('rendu', 'render')} ${loop.renderMs.toFixed(1)} ms\n` +
      `${t('particules', 'particles')} ${w.particles.count} · ${t('lueurs', 'glows')} ${fxStats.glows} · ` +
      `${t('textures', 'textures')} ${fxStats.sprites}\n` +
      `${t('ennemis', 'enemies')} ${w.aliveEnemies}`;
  }

  // ------------------------------------------------------------- construction

  private build(): void {
    const head = document.createElement('div');
    head.className = 'fxlab-head';
    const title = document.createElement('span');
    title.textContent = t('Laboratoire d’effets', 'Effects lab');
    const close = this.smallButton('F9 ✕', () => this.toggle(false));
    head.append(title, close);
    this.root.appendChild(head);

    const body = document.createElement('div');
    body.className = 'fxlab-body';
    this.root.appendChild(body);

    this.statsEl = document.createElement('div');
    this.statsEl.className = 'fxlab-stats';
    body.appendChild(this.statsEl);

    this.buildSettings(this.section(body, t('Réglages', 'Settings')));
    this.buildScene(this.section(body, t('Scène', 'Scene')));
    this.buildWeapons(this.section(body, t('Armes', 'Weapons')));
    this.buildTriggers(this.section(body, t('Déclencheurs', 'Triggers')));
    this.buildTextures(this.section(body, t('Textures précalculées', 'Baked textures')));
  }

  private section(parent: HTMLElement, label: string): HTMLDivElement {
    const h = document.createElement('h3');
    h.textContent = label;
    const box = document.createElement('div');
    box.className = 'fxlab-section';
    parent.append(h, box);
    return box;
  }

  private smallButton(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fxlab-btn';
    b.textContent = label;
    b.addEventListener('click', () => {
      onClick();
      // Rendre le clavier au jeu : sinon Espace ou Entrée rejoueraient le bouton.
      b.blur();
    });
    return b;
  }

  private slider(
    parent: HTMLElement, label: string, hint: string, max: number, step: number,
    read: () => number, write: (v: number) => void,
  ): void {
    const row = document.createElement('label');
    row.className = 'fxlab-row';
    row.title = hint;
    const name = document.createElement('span');
    name.textContent = label;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = String(max);
    input.step = String(step);
    const value = document.createElement('span');
    value.className = 'fxlab-val';
    const show = (): void => {
      input.value = String(read());
      value.textContent = `${Math.round(read() * 100)} %`;
    };
    input.addEventListener('input', () => {
      write(Number(input.value));
      show();
    });
    input.addEventListener('change', () => input.blur());
    this.refreshers.push(show);
    show();
    row.append(name, input, value);
    parent.appendChild(row);
  }

  private checkbox(parent: HTMLElement, label: string, read: () => boolean, write: (v: boolean) => void): void {
    const row = document.createElement('label');
    row.className = 'fxlab-row check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = read();
    input.addEventListener('change', () => {
      write(input.checked);
      input.blur();
    });
    const name = document.createElement('span');
    name.textContent = label;
    row.append(input, name);
    parent.appendChild(row);
  }

  // ----------------------------------------------------------------- réglages

  private buildSettings(box: HTMLElement): void {
    for (const s of SLIDERS) {
      this.slider(box, s.label, s.hint, s.max, 0.05, () => fxSettings[s.key], (v) => {
        fxSettings[s.key] = v;
        saveFxSettings();
      });
    }
    this.slider(
      box, t('Ralenti', 'Slow motion'), t('Vitesse de la simulation, pour décomposer un effet.', 'Simulation speed, to step through an effect.'),
      1, 0.05,
      () => this.getWorld()?.speedScale ?? 1,
      (v) => {
        const w = this.getWorld();
        if (w) w.speedScale = Math.max(0.05, v);
      },
    );

    const views = document.createElement('div');
    views.className = 'fxlab-buttons';
    const buttons: HTMLButtonElement[] = [];
    const mark = (): void => {
      buttons.forEach((b, i) => b.classList.toggle('on', VIEWS[i]![0] === fxSettings.view));
    };
    for (const [view, label] of VIEWS) {
      buttons.push(this.smallButton(label, () => {
        fxSettings.view = view;
        mark();
      }));
    }
    views.append(...buttons);
    this.refreshers.push(mark);
    box.appendChild(views);

    const actions = document.createElement('div');
    actions.className = 'fxlab-buttons';
    const copy = this.smallButton(t('Copier le JSON', 'Copy JSON'), () => {
      const { view: _view, ...kept } = fxSettings;
      void navigator.clipboard?.writeText(JSON.stringify(kept, null, 2));
      copy.textContent = t('Copié', 'Copied');
      window.setTimeout(() => { copy.textContent = t('Copier le JSON', 'Copy JSON'); }, 1200);
    });
    actions.append(
      this.smallButton(t('Réinitialiser', 'Reset'), () => {
        Object.assign(fxSettings, FX_DEFAULTS);
        saveFxSettings();
        for (const r of this.refreshers) r();
      }),
      copy,
    );
    box.appendChild(actions);
  }

  // -------------------------------------------------------------------- scène

  private buildScene(box: HTMLElement): void {
    this.checkbox(box, t('Suspendre la horde', 'Hold the horde'), () => this.holdSpawns, (v) => { this.holdSpawns = v; });
    this.checkbox(box, t('Joueur invulnérable', 'Invulnerable player'), () => this.invulnerable, (v) => { this.invulnerable = v; });

    const row = document.createElement('div');
    row.className = 'fxlab-buttons';
    row.append(
      this.smallButton(t('+ 24 ennemis', '+ 24 enemies'), () => this.spawnRing(24)),
      this.smallButton(t('+ 120 ennemis', '+ 120 enemies'), () => this.spawnRing(120)),
      this.smallButton(t('Vider', 'Clear'), () => this.clearEnemies()),
    );
    box.appendChild(row);
  }

  private spawnRing(count: number): void {
    const w = this.getWorld();
    if (!w) return;
    const pool = ENEMIES.filter((e) => !e.decor).slice(0, 4);
    if (pool.length === 0) return;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + fxRng.spread(0.1);
      const r = 80 + fxRng.range(0, count > 40 ? 110 : 30);
      const def = pool[i % pool.length]!;
      w.spawnEnemy(def.id, w.player.x + Math.cos(a) * r, w.player.y + Math.sin(a) * r * 0.75);
    }
  }

  private clearEnemies(): void {
    const w = this.getWorld();
    if (!w) return;
    for (const e of w.enemies) {
      if (e.active && e.dying <= 0 && !e.def.decor) w.damageEnemy(e, 1e9, 0, 0, 0, true);
    }
  }

  // -------------------------------------------------------------------- armes

  private buildWeapons(box: HTMLElement): void {
    this.checkbox(box, t('Au niveau maximal', 'At max level'), () => this.maxLevel, (v) => { this.maxLevel = v; });
    const grid = document.createElement('div');
    grid.className = 'fxlab-weapons';
    for (const def of WEAPONS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fxlab-weapon';
      b.title = `${def.name} – ${def.behavior}`;
      const icon = iconFor('weapon', def.id);
      const copy = icon.cloneNode(true) as HTMLCanvasElement;
      copy.getContext('2d')!.drawImage(icon, 0, 0);
      b.appendChild(copy);
      b.addEventListener('click', () => {
        this.equipOnly(def.id);
        b.blur();
      });
      grid.appendChild(b);
    }
    box.appendChild(grid);
  }

  /** Équipe une arme seule : c'est le seul moyen de juger son effet sans les cinq autres. */
  private equipOnly(id: string): void {
    const w = this.getWorld();
    if (!w) return;
    const pl = w.player;
    for (const p of w.projectiles) if (!p.hostile) p.active = false;
    pl.weapons.length = 0;
    const inst = pl.addWeapon(id);
    if (this.maxLevel) inst.level = inst.def.maxLevel;
    pl.recompute();
    w.announce(inst.def.name, inst.def.behavior);
  }

  // ------------------------------------------------------------- déclencheurs

  private buildTriggers(box: HTMLElement): void {
    const colorRow = document.createElement('label');
    colorRow.className = 'fxlab-row';
    const name = document.createElement('span');
    name.textContent = t('Couleur', 'Colour');
    const input = document.createElement('input');
    input.type = 'color';
    input.value = this.color;
    input.addEventListener('input', () => {
      this.color = input.value;
      this.paintTextures();
    });
    colorRow.append(name, input);
    box.appendChild(colorRow);

    const at = (w: World): [number, number] => {
      const a = fxRng.angle();
      return [w.player.x + Math.cos(a) * 62, w.player.y + Math.sin(a) * 44];
    };
    const triggers: [string, (w: World, x: number, y: number) => void][] = [
      [t('Explosion', 'Explosion'), (w, x, y) => w.explodeAt(x, y, 70, 40)],
      [t('Foudre', 'Lightning'), (w, x, y) => {
        const def = weaponById('judgement');
        const p = w.spawnProjectile(
          'strike', x, y, 0, 0, 30, def.area, 0.4, 99,
          makeProjectile(def.sprite, this.color), this.color, def.id, [], 0, 9000,
        );
        if (p) p.tick = 0.5;
        w.particles.flash(x, y, 40, this.color, 0.3);
        w.particles.sparks(x, y, -Math.PI / 2, 8, this.color, 1.4);
      }],
      [t('Cercle', 'Sigil'), (w, x, y) => { w.spawnZone(x, y, 44, 6, 5, this.color, 9001, 0.4, false); }],
      [t('Onde', 'Shockwave'), (w, x, y) => w.particles.ring(x, y, 90, this.color, 0.6, 3)],
      [t('Colonne', 'Beam'), (w, x, y) => w.particles.beam(x, y, this.color, 1)],
      [t('Éclat', 'Flash'), (w, x, y) => {
        w.particles.flash(x, y, 60, this.color, 0.4);
        w.particles.sparks(x, y, 0, 28, this.color, TAU);
      }],
      [t('Braises', 'Embers'), (w, x, y) => { for (let i = 0; i < 12; i++) w.particles.ember(x, y, this.color, 2); }],
      [t('Sang', 'Blood'), (w, x, y) => {
        w.particles.blood(x, y, 26);
        w.particles.shards(x, y, 14, P.bloodDark);
      }],
    ];

    const row = document.createElement('div');
    row.className = 'fxlab-buttons';
    for (const [label, run] of triggers) {
      row.appendChild(this.smallButton(label, () => {
        const w = this.getWorld();
        if (w) run(w, ...at(w));
      }));
    }
    box.appendChild(row);
  }

  // ----------------------------------------------------------------- textures

  private buildTextures(box: HTMLElement): void {
    const note = document.createElement('p');
    note.className = 'fxlab-note';
    note.textContent = t(
      'Peintes une seule fois par couleur, puis recopiées, tournées et mises à l’échelle.',
      'Painted once per colour, then copied, rotated and scaled.',
    );
    this.textureRow = document.createElement('div');
    this.textureRow.className = 'fxlab-textures';
    box.append(note, this.textureRow);
    this.paintTextures();
  }

  private paintTextures(): void {
    this.textureRow.textContent = '';
    for (const kind of FX_TEXTURES) {
      const src = textureOf(kind, this.color);
      const cell = document.createElement('figure');
      const c = document.createElement('canvas');
      c.width = src.width;
      c.height = src.height;
      c.getContext('2d')!.drawImage(src, 0, 0);
      const cap = document.createElement('figcaption');
      cap.textContent = `${kind} ${src.width}×${src.height}`;
      cell.append(c, cap);
      this.textureRow.appendChild(cell);
    }
  }
}
