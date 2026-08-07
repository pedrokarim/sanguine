import './ui/style.css';

import { Loop } from './core/loop';
import { Input } from './core/input';
import { load, save, update } from './core/save';
import { formatTime } from './core/math';
import { audio } from './audio/audio';
import { Renderer } from './gfx/renderer';
import {
  spriteSheet, makeProjectile, makeBody, makeRelic, makeHero, makePassiveSprite,
  makeGem, makeCoin, makeHeart, makeChest, type SpriteSet,
} from './gfx/sprites';
import { WEAPONS } from './data/weapons';
import { ENEMIES, BOSSES } from './data/enemies';
import { PASSIVES } from './data/passives';
import { POI_DEFS, poiSprite } from './game/terrain';
import { World, VIEW_W, VIEW_H } from './game/world';
import { Director } from './game/director';
import { updateWeapons } from './game/weapons';
import { rollOffers, openChest, applyChest, type Offer, type ChestResult } from './game/upgrades';
import { characterById, CHARACTERS } from './data/characters';
import { Hud } from './ui/hud';
import { Screens, type RunSummary } from './ui/screens';
import { Backdrop } from './ui/backdrop';
import { installDecor } from './ui/decor';

/**
 * Point d'entrée et machine à états d'écrans.
 *
 * `PLAYING` est le seul état qui fait avancer la simulation ; tous les autres continuent de
 * **rendre** la scène figée, ce qui garde le contexte visuel derrière les menus.
 */

type State =
  | 'title' | 'charselect' | 'playing' | 'levelup' | 'chest'
  | 'paused' | 'sanctuary' | 'codex' | 'options' | 'gameover' | 'victory';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiLayer = document.getElementById('ui') as HTMLDivElement;
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })!;

canvas.width = VIEW_W;
canvas.height = VIEW_H;

const input = new Input(canvas, document.body);
const screens = new Screens(uiLayer);
const renderer = new Renderer(ctx);
const director = new Director();
const backdrop = new Backdrop();

// Les ornements d'interface sont générés une fois puis publiés en variables CSS.
installDecor();

let hud: Hud | null = null;
let world: World | null = null;
let state: State = 'title';
let lastCharId = 'ysolde';
let debug = false;
let debugEl: HTMLDivElement | null = null;
let currentOffers: Offer[] = [];
let currentChest: ChestResult | null = null;

// ---------------------------------------------------------------------------
// Mise à l'échelle : facteur entier, jamais d'interpolation
// ---------------------------------------------------------------------------

function resize(): void {
  const scale = Math.max(
    1,
    Math.floor(Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H)),
  );
  const w = VIEW_W * scale;
  const h = VIEW_H * scale;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  // La couche UI recouvre exactement le canvas.
  uiLayer.style.width = `${w}px`;
  uiLayer.style.height = `${h}px`;
  uiLayer.style.left = `${Math.round((window.innerWidth - w) / 2)}px`;
  uiLayer.style.top = `${Math.round((window.innerHeight - h) / 2)}px`;
}

window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------------------
// Curseur : effacement automatique pendant le jeu
// ---------------------------------------------------------------------------

/**
 * Le jeu vise tout seul : en partie, la souris ne sert strictement à rien. Le curseur
 * s'efface donc après un temps d'immobilité et revient au moindre mouvement. Il n'est
 * **jamais** masqué dans les menus, où il reste le principal moyen d'interaction.
 */
const CURSOR_IDLE_DELAY = 1.6;
let cursorIdle = 0;
let cursorHidden = false;

window.addEventListener('pointermove', () => {
  cursorIdle = 0;
  if (cursorHidden) {
    cursorHidden = false;
    document.body.classList.remove('cursor-hidden');
  }
});

function updateCursor(dt: number): void {
  const inGame = state === 'playing';
  if (!inGame) {
    cursorIdle = 0;
    if (cursorHidden) {
      cursorHidden = false;
      document.body.classList.remove('cursor-hidden');
    }
    return;
  }
  cursorIdle += dt;
  if (!cursorHidden && cursorIdle > CURSOR_IDLE_DELAY) {
    cursorHidden = true;
    document.body.classList.add('cursor-hidden');
  }
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

function applyOptions(): void {
  const o = load().options;
  audio.masterVol = o.master;
  audio.sfxVol = o.sfx;
  audio.musicVol = o.music;
  audio.applyVolumes();
  document.documentElement.style.setProperty('--hud-scale', String(o.hudScale));
  if (world) world.cam.intensity = o.reduceFlash ? 0 : o.shake;
}

// ---------------------------------------------------------------------------
// Transitions d'état
// ---------------------------------------------------------------------------

function goTitle(): void {
  state = 'title';
  world = null;
  hud?.destroy();
  hud = null;
  audio.stopMusic();
  audio.setBossMode(false);
  screens.title(goCharSelect, goSanctuary, goOptions, goCodex);
}

function goCharSelect(): void {
  state = 'charselect';
  screens.characterSelect(startRun, goTitle);
}

function goSanctuary(): void {
  state = 'sanctuary';
  screens.sanctuary(goTitle);
}

function goCodex(): void {
  state = 'codex';
  screens.codex(goTitle);
}

function goOptions(): void {
  state = 'options';
  screens.options(
    goTitle,
    (scale) => {
      document.documentElement.style.setProperty('--hud-scale', String(scale));
    },
    (reduce) => {
      if (world) world.cam.intensity = reduce ? 0 : load().options.shake;
    },
    (shake) => {
      if (world) world.cam.intensity = load().options.reduceFlash ? 0 : shake;
    },
  );
}

function startRun(charId: string): void {
  lastCharId = charId;
  screens.close();

  world = new World(charId);
  world.warmup();
  director.reset();
  applyOptions();

  hud?.destroy();
  hud = new Hud(uiLayer);
  hud.show();

  state = 'playing';
  audio.init();
  audio.startMusic();

  // Enregistre l'arme de départ dans le codex.
  markWeaponSeen(world.player.weaponIds[0]!);
}

function markWeaponSeen(id: string): void {
  update((s) => {
    if (!s.seenWeapons.includes(id)) s.seenWeapons.push(id);
  });
}

function markRelicsSeen(ids: string[]): void {
  update((s) => {
    for (const id of ids) if (!s.seenRelics.includes(id)) s.seenRelics.push(id);
  });
}

// ---------------------------------------------------------------------------
// Montée de niveau et coffres
// ---------------------------------------------------------------------------

function openLevelUp(): void {
  if (!world) return;
  state = 'levelup';
  currentOffers = rollOffers(world);
  showLevelUp();
}

function showLevelUp(): void {
  const w = world;
  if (!w) return;
  screens.levelUp(
    currentOffers,
    w.player.rerolls,
    (offer) => {
      offer.apply(w);
      if (offer.kind === 'weapon-new' || offer.kind === 'weapon-up') markWeaponSeen(offer.id);
      w.pendingLevelUps--;
      screens.close();
      resumeAfterMenu();
    },
    () => {
      w.player.rerolls--;
      currentOffers = rollOffers(w);
      showLevelUp();
    },
    () => {
      w.gold += Math.round(50 * w.player.stats.greed);
      w.pendingLevelUps--;
      screens.close();
      resumeAfterMenu();
    },
  );
}

function openChestScreen(): void {
  const w = world;
  if (!w) return;
  state = 'chest';
  currentChest = openChest(w);
  screens.chest(currentChest, () => {
    if (currentChest) {
      applyChest(w, currentChest);
      for (const o of currentChest.offers) {
        if (o.kind === 'weapon-new' || o.kind === 'weapon-up') markWeaponSeen(o.id);
      }
      if (currentChest.evolution) markWeaponSeen(currentChest.evolution.to.id);
    }
    currentChest = null;
    w.pendingChests--;
    screens.close();
    resumeAfterMenu();
  });
}

/** Après un menu, enchaîne sur le suivant s'il en reste, sinon reprend la partie. */
function resumeAfterMenu(): void {
  const w = world;
  if (!w) return;
  if (w.state === 'dead') return endRun(false);
  if (w.state === 'won') return endRun(true);
  if (w.pendingLevelUps > 0) return openLevelUp();
  if (w.pendingChests > 0) return openChestScreen();
  state = 'playing';
}

// ---------------------------------------------------------------------------
// Pause et fin de partie
// ---------------------------------------------------------------------------

function togglePause(): void {
  if (state === 'playing') {
    state = 'paused';
    audio.suspend();
    screens.pause(
      () => {
        screens.close();
        state = 'playing';
        audio.resume();
      },
      () => {
        audio.resume();
        endRun(false);
      },
    );
  } else if (state === 'paused') {
    screens.close();
    state = 'playing';
    audio.resume();
  }
}

function endRun(victory: boolean): void {
  const w = world;
  if (!w) return;
  state = victory ? 'victory' : 'gameover';
  audio.stopMusic();
  audio.setBossMode(false);
  if (victory) audio.play('victory');
  hud?.hide();

  const char = characterById(w.player.char.id);
  const summary: RunSummary = {
    time: w.time,
    level: w.player.level,
    kills: w.kills,
    gold: w.gold,
    damage: w.player.damageDealt,
    gems: w.gemsCollected,
    relics: w.player.relics.length,
    seed: w.seed,
    character: `${char.name} ${char.epithet}`,
  };

  markRelicsSeen(w.player.relics);
  update((s) => {
    for (const id of w.seenEnemies) if (!s.seenEnemies.includes(id)) s.seenEnemies.push(id);
    s.gold += w.gold;
    s.stats.runs++;
    s.stats.kills += w.kills;
    s.stats.gems += w.gemsCollected;
    s.stats.goldEarned += w.gold;
    s.stats.bestTime = Math.max(s.stats.bestTime, w.time);
    s.stats.bestLevel = Math.max(s.stats.bestLevel, w.player.level);
    if (victory) {
      s.stats.wins++;
      if (!s.unlockedChars.includes('comte')) s.unlockedChars.push('comte');
    }
  });
  save();

  screens.gameOver(summary, victory, () => startRun(lastCharId), goTitle);
}

// ---------------------------------------------------------------------------
// Boucle
// ---------------------------------------------------------------------------

const loop = new Loop({
  update(dt: number): void {
    input.update();
    handleGlobalKeys();

    if (state === 'playing' && world) {
      const w = world;
      w.player.update(dt * w.timeScale, input.move.x, input.move.y, w.terrain.currentBiome.moveMul);
      w.cam.follow(w.player.x, w.player.y, dt);
      updateWeapons(w, dt * w.timeScale);
      director.update(w, dt * w.timeScale);
      w.update(dt);

      if (w.state === 'dead') endRun(false);
      else if (w.state === 'won') endRun(true);
      else if (w.pendingLevelUps > 0) openLevelUp();
      else if (w.pendingChests > 0) openChestScreen();
    }

    input.endFrame();
  },

  render(alpha: number): void {
    const now = performance.now();
    const rdt = Math.min(0.1, (now - lastRender) / 1000);
    lastRender = now;
    updateCursor(rdt);

    if (world) {
      renderer.render(world, state === 'playing' ? alpha : 0);
      if (hud && state !== 'title') hud.update(world, rdt);
    } else {
      // Hors partie, le canvas affiche la scène illustrée des menus.
      backdrop.render(ctx, rdt);
    }
    if (debug) updateDebug();
  },
});

let lastRender = performance.now();

// ---------------------------------------------------------------------------
// Touches globales, debug et triches de développement
// ---------------------------------------------------------------------------

function handleGlobalKeys(): void {
  if (input.interacted) audio.init();

  if (input.wasPressed('Escape', 'KeyP')) {
    if (state === 'playing' || state === 'paused') togglePause();
  }

  if (input.wasPressed('KeyM') && hud) {
    audio.play('select');
    hud.minimap.toggle();
  }

  if (input.wasPressed('KeyF')) {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.();
    else void document.exitFullscreen?.();
  }

  if (input.wasPressed('Backquote')) {
    debug = !debug;
    if (!debug && debugEl) {
      debugEl.remove();
      debugEl = null;
    }
  }

  if (state === 'title' && input.wasPressed('Enter', 'Space')) goCharSelect();

  // Triches de développement – pratiques pour tester l'équilibrage tardif.
  if (!world || state !== 'playing') return;
  const w = world;
  if (input.wasPressed('F1')) {
    for (let i = 0; i < 10; i++) w.player.addXp(w.player.xpNext);
    w.pendingLevelUps += 10;
  }
  if (input.wasPressed('F2')) w.time += 60;
  if (input.wasPressed('F3')) w.player.heal(9999);
  if (input.wasPressed('F4')) w.purge();
  if (input.wasPressed('F5')) w.gold += 10000;
  if (input.wasPressed('F6')) w.dropRelic(w.player.x + 20, w.player.y);
  if (input.wasPressed('F7')) w.spawnPickup('chest', w.player.x + 20, w.player.y, 0, 0);
}

function updateDebug(): void {
  if (!debugEl) {
    debugEl = document.createElement('div');
    debugEl.id = 'debug';
    uiLayer.appendChild(debugEl);
  }
  const w = world;
  const lines = [
    `${loop.fps.toFixed(0)} fps  upd ${loop.updateMs.toFixed(2)}ms  ren ${loop.renderMs.toFixed(2)}ms`,
  ];
  if (w) {
    let proj = 0;
    let zones = 0;
    let picks = 0;
    for (const p of w.projectiles) if (p.active) proj++;
    for (const z of w.zones) if (z.active) zones++;
    for (const p of w.pickups) if (p.active) picks++;
    lines.push(
      `t ${formatTime(w.time)}  ennemis ${w.aliveEnemies}  proj ${proj}  zones ${zones}  loot ${picks}  part ${w.particles.count}`,
      `niv ${w.player.level}  pv ${w.player.hp.toFixed(0)}/${w.player.stats.maxHp.toFixed(0)}  dmg×${w.player.stats.might.toFixed(2)}  cd×${w.player.stats.cooldown.toFixed(2)}  zone×${w.player.stats.area.toFixed(2)}`,
      `graine ${w.seed}  intensité ${w.intensity.toFixed(2)}  état ${state}`,
    );
  }
  debugEl.textContent = lines.join('\n');
}

// ---------------------------------------------------------------------------
// Cycle de vie
// ---------------------------------------------------------------------------

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    audio.suspend();
    if (state === 'playing') togglePause();
  } else if (state !== 'paused') {
    audio.resume();
  }
});

/**
 * Poignée de développement. Sert au mode debug (`~`), aux tests automatisés en navigateur
 * headless, et à inspecter un build depuis la console sans instrumenter le code.
 */
Object.defineProperty(window, 'sanguine', {
  value: {
    get world(): World | null { return world; },
    get state(): State { return state; },
    get loop(): Loop { return loop; },
    startRun,
    countActiveProjectiles(): number {
      let n = 0;
      if (world) for (const p of world.projectiles) if (p.active) n++;
      return n;
    },
    /**
     * Exporte toutes les planches de sprites du jeu en `data:` URI.
     *
     * Sert à alimenter le manuel en ligne : les visuels de la documentation sont ainsi
     * produits par **les générateurs du jeu eux-mêmes**, et ne peuvent donc jamais diverger
     * de ce que le joueur voit réellement à l'écran.
     */
    exportSprites(): Record<string, { url: string; frames: number; w: number; h: number }> {
      const out: Record<string, { url: string; frames: number; w: number; h: number }> = {};
      const put = (key: string, set: SpriteSet, scale: number): void => {
        const s = spriteSheet(`export:${key}`, set, scale);
        out[key] = { url: s.url, frames: s.frames, w: s.w, h: s.h };
      };
      const fit = (set: SpriteSet, max: number): number =>
        Math.max(1, Math.min(6, Math.floor(max / Math.max(set.w, set.h))));

      for (const def of WEAPONS) {
        const set = makeProjectile(def.sprite, def.color);
        put(`weapon-${def.id}`, set, fit(set, 40));
      }
      for (const def of [...ENEMIES, ...BOSSES]) {
        const set = makeBody(`enemy:${def.id}`, def.art);
        put(`enemy-${def.id}`, set, fit(set, 48));
      }
      for (const r of ['common', 'rare', 'epic', 'cursed'] as const) {
        const set = makeRelic(r);
        put(`relic-${r}`, set, fit(set, 40));
      }
      for (const c of CHARACTERS) {
        const set = makeHero(`hero:${c.id}`, c.art, false);
        put(`hero-${c.id}`, set, fit(set, 44));
      }
      for (const p of PASSIVES) {
        put(`passive-${p.id}`, makePassiveSprite(p.icon, p.color), 3);
      }
      for (const t of Object.keys(POI_DEFS) as (keyof typeof POI_DEFS)[]) {
        const frames = poiSprite(t);
        const set: SpriteSet = {
          frames: frames.slice(0, 4),
          flash: frames,
          elite: frames,
          w: frames[0]!.width,
          h: frames[0]!.height,
        };
        put(`poi-${t}`, set, fit(set, 56));
      }
      for (let r = 0; r < 4; r++) put(`gem-${r}`, makeGem(r as 0 | 1 | 2 | 3), 4);
      put('coin', makeCoin(), 4);
      put('heart', makeHeart(), 4);
      put('chest', makeChest(), 3);
      return out;
    },

    /** Instantané complet du build courant, pour vérifier l'équilibrage. */
    snapshot(): unknown {
      if (!world) return null;
      const w = world;
      return {
        time: w.time,
        state,
        level: w.player.level,
        hp: w.player.hp,
        kills: w.kills,
        gold: w.gold,
        enemies: w.aliveEnemies,
        weapons: w.player.weapons.map((x) => ({ id: x.def.id, lvl: x.level, cd: x.cd })),
        passives: [...w.player.passives],
        relics: w.player.relics,
        stats: { ...w.player.stats },
      };
    },
  },
});

applyOptions();
goTitle();
loop.start();
