import './ui/style.css';

import { Loop } from './core/loop';
import { Input } from './core/input';
import { load, save, update } from './core/save';
import { formatTime } from './core/math';
import { audio } from './audio/audio';
import { Renderer } from './gfx/renderer';
import {
  spriteSheet, makeProjectile, makeBody, makeRelic, makeHero, makePassiveSprite,
  setHeroDetaille, getHeroDetaille,
  makeGem, makeCoin, makeHeart, makeChest, type SpriteSet,
} from './gfx/sprites';
import { WEAPONS } from './data/weapons';
import { ENEMIES, BOSSES } from './data/enemies';
import { PASSIVES } from './data/passives';
import { POI_DEFS, poiSprite } from './game/terrain';
import { World, VIEW, BASE_W, BASE_H } from './game/world';
import { Director } from './game/director';
import { updateWeapons } from './game/weapons';
import { rollOffers, openChest, applyChest, type Offer, type ChestResult } from './game/upgrades';
import { characterById, CHARACTERS } from './data/characters';
import { Hud } from './ui/hud';
import { Screens, type RunSummary } from './ui/screens';
import { Backdrop } from './ui/backdrop';
import { installDecor, applyTheme, applyCursor } from './ui/decor';
import { COSMETIC_BY_ID } from './data/cosmetics';
import { Mobile } from './ui/mobile';

/**
 * Point d'entrée et machine à états d'écrans.
 *
 * `PLAYING` est le seul état qui fait avancer la simulation ; tous les autres continuent de
 * **rendre** la scène figée, ce qui garde le contexte visuel derrière les menus.
 */

type State =
  | 'title' | 'charselect' | 'playing' | 'levelup' | 'chest'
  | 'paused' | 'sanctuary' | 'shop' | 'codex' | 'archive' | 'reading'
  | 'options' | 'gameover' | 'victory';

/**
 * Deux canvas, et c'est la clé de la netteté.
 *
 * `display` est le canvas visible. Sa mémoire est dimensionnée en **pixels physiques** et sa
 * taille CSS en pixels CSS correspondants : un pixel de sa mémoire vaut exactement un pixel
 * de l'écran, donc le navigateur ne le rééchantillonne jamais.
 *
 * `scene` est un canvas hors écran à la résolution logique du jeu. Tout le rendu s'y fait à
 * l'échelle 1, puis il est recopié une fois par frame sur `display` avec un facteur **entier**
 * et le lissage désactivé.
 *
 * La version précédente donnait au canvas visible une taille CSS calculée, souvent
 * fractionnaire (« 1539.2px »). Le compositeur l'arrondissait à sa façon, le rapport
 * redevenait non entier, et le pixel art était rééchantillonné — invisible sur un écran à
 * 100 %, très net sur une machine Windows à 125 %. Avec deux canvas, le problème ne peut
 * plus se poser : aucun redimensionnement n'est laissé au navigateur.
 */
const display = document.getElementById('game') as HTMLCanvasElement;
const uiLayer = document.getElementById('ui') as HTMLDivElement;
const displayCtx = display.getContext('2d', { alpha: false })!;

const scene = document.createElement('canvas');
const ctx = scene.getContext('2d', { alpha: false, desynchronized: true })!;

/** Facteur entier et décalage de la recopie `scene` → `display`, en pixels physiques. */
let blitScale = 1;
let blitX = 0;
let blitY = 0;



const input = new Input(display, document.body);
const screens = new Screens(uiLayer);

/*
 * Adaptation au téléphone. Les crochets évitent que le module d'interface connaisse la
 * machine à états : il sait seulement demander « sommes-nous en partie ? » et « arrêtez ».
 */
const mobile = new Mobile(uiLayer, {
  enPartie: () => state === 'playing',
  interrompre: () => { if (state === 'playing') togglePause(); },
  // Deux bandes, en haut et en bas, rapportées à la hauteur réelle de l'écran.
  perteVerticale: () => (display.height > 0 ? (2 * blitY) / display.height : 0),
});
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

/** Intervalle d'auto-sauvegarde de la partie en cours, en secondes. */
const RUN_SAVE_INTERVAL = 10;
let runSaveTimer = 0;

// ---------------------------------------------------------------------------
// Mise à l'échelle : facteur entier, jamais d'interpolation
// ---------------------------------------------------------------------------

/**
 * Ajuste le canvas à la fenêtre.
 *
 * Deux exigences, longtemps mal conciliées ici :
 *
 * 1. **Un pixel de jeu doit valoir un nombre entier de pixels physiques.** L'ancienne version
 *    calculait le facteur en pixels CSS et ignorait `devicePixelRatio` : sous Windows à 125 %
 *    ou 150 % d'échelle, la taille physique devenait un multiple non entier de 480, le
 *    navigateur rééchantillonnait, et tout le jeu apparaissait flou. Le facteur est donc
 *    désormais calculé en **pixels physiques**, et la taille CSS en est déduite.
 *
 * 2. **Le jeu doit remplir l'écran.** Avec une résolution logique figée à 480 × 270, tout
 *    écran dont les dimensions n'en sont pas un multiple exact affichait des bandes noires.
 *    La résolution logique s'étend donc jusqu'à couvrir la fenêtre, en conservant le facteur
 *    entier. Le joueur voit simplement un peu plus de terrain.
 */
function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  const physW = Math.max(1, Math.round(window.innerWidth * dpr));
  const physH = Math.max(1, Math.round(window.innerHeight * dpr));

  // Le canvas visible épouse exactement la grille de pixels de l'écran.
  display.width = physW;
  display.height = physH;
  display.style.width = `${window.innerWidth}px`;
  display.style.height = `${window.innerHeight}px`;

  // Facteur entier, choisi sur la dimension la plus contraignante.
  blitScale = Math.max(1, Math.floor(Math.min(physW / BASE_W, physH / BASE_H)));

  // Surface visible bornée : un écran très large ne doit pas offrir un avantage de jeu.
  const maxW = Math.round(BASE_W * 1.5);
  const maxH = Math.round(BASE_H * 1.5);
  const lw = Math.min(maxW, Math.max(BASE_W, Math.floor(physW / blitScale)));

  /*
   * En portrait, plafonner la hauteur à 1,5 × la base laissait la moitié de l'écran en
   * bandes noires. Ce qu'il faut borner n'est pas chaque dimension prise à part mais la
   * **surface** : c'est elle qui décide de ce qu'on voit venir. À budget égal, un écran
   * étroit a donc droit à davantage de hauteur, sans rien gagner sur un écran large.
   *
   * Le facteur d'échelle reste entier : la netteté n'est pas négociée ici.
   */
  const budget = maxW * maxH;
  const hautMax = Math.max(maxH, Math.floor(budget / lw));
  const lh = Math.min(hautMax, Math.max(BASE_H, Math.floor(physH / blitScale)));

  VIEW.w = lw;
  VIEW.h = lh;
  scene.width = lw;
  scene.height = lh;
  if (world) world.cam.resize(lw, lh);

  // Centrage de la recopie, en pixels physiques entiers.
  blitX = Math.floor((physW - lw * blitScale) / 2);
  blitY = Math.floor((physH - lh * blitScale) / 2);

  // La couche UI recouvre la zone de jeu, exprimée en pixels CSS.
  uiLayer.style.width = `${(lw * blitScale) / dpr}px`;
  uiLayer.style.height = `${(lh * blitScale) / dpr}px`;
  uiLayer.style.left = `${blitX / dpr}px`;
  uiLayer.style.top = `${blitY / dpr}px`;
}

/**
 * Recopie la scène sur le canvas visible. Facteur entier, lissage désactivé : chaque pixel
 * de jeu devient un bloc carré de `blitScale` pixels physiques, sans aucune interpolation.
 */
function present(): void {
  displayCtx.imageSmoothingEnabled = false;
  if (blitX > 0 || blitY > 0) {
    displayCtx.fillStyle = '#05060a';
    displayCtx.fillRect(0, 0, display.width, display.height);
  }
  displayCtx.drawImage(
    scene, blitX, blitY, scene.width * blitScale, scene.height * blitScale,
  );
}

window.addEventListener('resize', resize);
// Le zoom du navigateur change `devicePixelRatio` sans toujours émettre `resize` : on
// s'abonne à la media query correspondante, ré-armée à chaque changement de ratio.
function watchDpr(): void {
  matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener(
    'change',
    () => { resize(); watchDpr(); },
    { once: true },
  );
}
watchDpr();
resize();
mobile.installer();

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
  const sv = load();
  const o = sv.options;
  audio.masterVol = o.master;
  audio.sfxVol = o.sfx;
  audio.musicVol = o.music;
  audio.applyVolumes();

  document.documentElement.style.setProperty('--hud-scale', String(o.hudScale));
  document.body.classList.toggle('reduce-motion', o.reduceMotion);
  document.body.classList.toggle('high-contrast', o.highContrast);
  document.body.classList.toggle('plain-font', o.plainFont);

  if (world) {
    world.cam.intensity = o.reduceFlash ? 0 : o.shake;
    world.showDamage = o.showDamage;
    world.highlightPlayer = o.highlightPlayer;
    world.speedScale = o.gameSpeed;
    world.trailColor = trailColor(sv);
  }

  // Thème d'interface et curseur cosmétiques.
  const eq = sv.cosmetics.equipped;
  const theme = COSMETIC_BY_ID.get(eq.theme ?? '');
  if (theme?.color && theme.accent) applyTheme(theme.color, theme.accent);
  const cur = COSMETIC_BY_ID.get(eq.cursor ?? '');
  if (cur?.color && cur.accent) applyCursor(cur.color, cur.accent);
}

/** Couleur de traînée équipée, `null` si aucune ou non possédée. */
function trailColor(sv: ReturnType<typeof load>): string | null {
  const id = sv.cosmetics.equipped.trail;
  if (!id || id === 'trail-none') return null;
  if (!sv.cosmetics.owned.includes(id)) return null;
  return COSMETIC_BY_ID.get(id)?.color ?? null;
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
  screens.title(goCharSelect, goSanctuary, goOptions, goCodex, goShop, goArchive, load().run, () => startRun('', true));
}

function goCharSelect(): void {
  state = 'charselect';
  screens.characterSelect(startRun, goTitle);
}

function goSanctuary(): void {
  state = 'sanctuary';
  screens.sanctuary(goTitle);
}

function goShop(): void {
  state = 'shop';
  screens.shop(goTitle, applyOptions);
}

function goArchive(): void {
  state = 'archive';
  screens.archive(goTitle);
}

function goCodex(): void {
  state = 'codex';
  screens.codex(goTitle);
}

function goOptions(): void {
  state = 'options';
  // `applyOptions` est rappelé à chaque changement : les réglages se voient immédiatement,
  // sans validation ni redémarrage.
  screens.options(goTitle, applyOptions);
}

function startRun(charId: string, resume = false): void {
  const saved = resume ? load().run : null;
  lastCharId = saved ? saved.charId : charId;
  screens.close();

  world = new World(lastCharId, saved?.seed);
  world.warmup();
  director.reset();
  applyOptions();

  hud?.destroy();
  hud = new Hud(uiLayer, () => togglePause());
  hud.show();

  if (saved) {
    world.restoreRun(saved);
    director.restore({ events: saved.events, reaper: saved.reaper });
  } else {
    clearRun();
  }

  state = 'playing';
  audio.init();
  audio.startMusic();
  runSaveTimer = 0;
  mobile.partieEnCours(true);

  world.setKnownFragments(load().fragments);

  // Enregistre l'arme de départ dans le codex.
  markWeaponSeen(world.player.weaponIds[0]!);
}

/**
 * Enregistre la partie en cours.
 *
 * Appelée périodiquement et à chaque événement décisif (choix de carte, coffre, perte de
 * focus). Sauvegarder **après** l'application d'un choix, et non avant, évite le
 * « save-scumming » : recharger ne permet pas de revenir sur une carte déjà prise.
 */
function saveRun(): void {
  const w = world;
  if (!w || w.state !== 'playing') return;
  update((sv) => {
    sv.run = w.serializeRun(director.serialize());
  });
}

/** Efface la partie sauvegardée. Une partie terminée ne doit jamais pouvoir être reprise. */
function clearRun(): void {
  update((sv) => {
    sv.run = null;
  });
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
      saveRun();
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
    saveRun();
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
  mobile.partieEnCours(false);
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

  clearRun();
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

      runSaveTimer += dt;
      if (runSaveTimer >= RUN_SAVE_INTERVAL) {
        runSaveTimer = 0;
        saveRun();
      }

      // Une pièce ramassée se lit tout de suite : c'est la récompense, la faire attendre
      // la fin du run la viderait de son effet.
      if (w.pendingFragment) {
        const f = w.pendingFragment;
        w.pendingFragment = null;
        update((sv) => { if (!sv.fragments.includes(f.n)) sv.fragments.push(f.n); });
        state = 'reading';
        // La vue de lecture se referme d'elle-même ; on reprend alors la partie là où elle
        // s'est figée.
        screens.readFragment(f, () => {
          state = 'playing';
        });
      }

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
      backdrop.render(ctx, rdt, scene.width, scene.height);
    }
    present();
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

  // Bascule entre le héros détaillé et le classique, pour trancher en comparant.
  if (input.wasPressed('F8')) {
    setHeroDetaille(!getHeroDetaille());
    world?.player.refreshSprites();
    if (world) world.announce(getHeroDetaille() ? 'Héros détaillé' : 'Héros classique', '19×23 / 13×15');
    audio.play('select');
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
  // Rapport d'échelle affiché en clair : si le ratio n'est pas un entier, l'image est
  // rééchantillonnée par le navigateur et le pixel art paraît flou. C'est le seul moyen de
  // diagnostiquer à distance, la valeur dépendant de l'écran et du réglage système.
  const dpr = window.devicePixelRatio || 1;
  const rect = display.getBoundingClientRect();
  // Le canvas visible doit valoir 1 pixel mémoire pour 1 pixel écran, et la recopie doit se
  // faire à facteur entier. Si les deux sont vrais, aucun rééchantillonnage n'est possible.
  const backing = (rect.width * dpr) / display.width;
  const exact = Math.abs(backing - 1) < 0.002 && Number.isInteger(blitScale);

  const lines = [
    `${loop.fps.toFixed(0)} fps  upd ${loop.updateMs.toFixed(2)}ms  ren ${loop.renderMs.toFixed(2)}ms`,
    `scène ${scene.width}×${scene.height}  ·  ×${blitScale}  ·  écran ${display.width}×${display.height}  ·  dpr ${dpr}`,
    `mémoire/écran ${backing.toFixed(4)}  ·  ${exact ? 'NET (aucun rééchantillonnage)' : 'RÉÉCHANTILLONNÉ'}`,
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

// Un onglet fermé ou masqué est le cas d'usage principal de la reprise : c'est précisément
// là qu'une partie de trente minutes se perd. `pagehide` est plus fiable que `beforeunload`,
// notamment sur mobile où ce dernier n'est pas toujours émis.
window.addEventListener('pagehide', saveRun);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    saveRun();
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
    /** Vue logique et cadrage physique — ce qu'il faut pour vérifier la netteté et les bandes. */
    get view(): { w: number; h: number } { return { w: VIEW.w, h: VIEW.h }; },
    get blit(): { scale: number; x: number; y: number } {
      return { scale: blitScale, x: blitX, y: blitY };
    },
    /**
     * Avance la simulation de `seconds` en exécutant de **vrais pas fixes**.
     *
     * Sert à mesurer l'équilibrage sans jouer trente minutes en temps réel. Multiplier
     * `speedScale` aurait été plus court à écrire, mais allongerait chaque pas et ferait
     * traverser les collisions : on mesurerait alors une autre physique que celle du jeu.
     * Ici, seul le nombre de pas par image change.
     */
    fastForward(seconds: number, pilote?: (w: World) => { x: number; y: number }): void {
      if (state !== 'playing' || !world) return;
      const w = world;
      const dt = 1 / 60;
      const pas = Math.round(seconds * 60);
      for (let i = 0; i < pas; i++) {
        // Le pilote est fourni par l'appelant : l'intelligence du bot de mesure n'a rien
        // à faire dans le code du jeu, seul le point d'entrée y est.
        const cmd = pilote ? pilote(w) : { x: 0, y: 0 };
        w.player.update(dt * w.timeScale, cmd.x, cmd.y, w.terrain.currentBiome.moveMul);
        w.cam.follow(w.player.x, w.player.y, dt);
        updateWeapons(w, dt * w.timeScale);
        director.update(w, dt * w.timeScale);
        w.update(dt);

        /*
         * Les montées de niveau et les coffres sont résolus ici, en appelant les mêmes
         * fonctions que l'interface. Sans cela, l'avance rapide produirait un joueur resté
         * au niveau 3 sans passif ni relique — on mesurerait alors l'équilibrage d'une
         * partie que personne ne joue.
         */
        while (w.pendingLevelUps > 0) {
          const offres = rollOffers(w);
          const choix = offres[0];
          if (choix) choix.apply(w);
          w.pendingLevelUps--;
        }
        while (w.pendingChests > 0) {
          const c = openChest(w);
          applyChest(w, c);
          w.pendingChests--;
        }
        if (w.pendingFragment) w.pendingFragment = null;

        if (w.state === 'dead' || w.state === 'won') break;
      }
    },
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
