import { Rng, makeSeed, fxRng } from '../core/rng';
import { SpatialGrid } from '../core/spatial';
import { clamp, dist2, TAU } from '../core/math';
import { Camera } from '../gfx/camera';
import { Particles } from '../gfx/particles';
import { P } from '../gfx/palette';
import { audio } from '../audio/audio';
import {
  makeBody, makeDeath, makeGem, makeCoin, makeHeart, makeChest, makeRelic, makeItem,
  makeSplat, type SpriteSet,
} from '../gfx/sprites';
import { enemyById, type EnemyDef, type BossDef } from '../data/enemies';
import { RELICS, RARITY_WEIGHT, RARITY_LABEL, type RelicDef } from '../data/relics';
import { DROP_TABLE, hpScale, damageScale } from '../data/waves';
import { Player } from './player';
import { Terrain, type Poi } from './terrain';
import {
  makeEnemy, makeProjectile, makeZone, makePickup, resetImmunity, claimHit,
  type Enemy, type Projectile, type Zone, type Pickup, type PickupKind, type ProjBehavior,
} from './types';

/**
 * Résolution logique **de référence**. La résolution réelle s'en écarte légèrement pour
 * remplir exactement la fenêtre : voir `VIEW` et `resize()` dans `main.ts`.
 */
export const BASE_W = 480;
export const BASE_H = 270;

/**
 * Résolution logique courante, en pixels de jeu.
 *
 * Elle est **variable** : le facteur d'agrandissement reste entier (indispensable au pixel
 * art), mais la taille du canvas s'ajuste pour couvrir toute la fenêtre. Sans cela, tout
 * écran dont les dimensions ne sont pas un multiple exact de 480 × 270 affiche des bandes
 * noires — ce qui était le cas de la quasi-totalité des écrans.
 *
 * La surface visible est bornée à 1,5× la référence pour qu'un écran très large ne confère
 * pas un avantage de jeu disproportionné.
 */
export const VIEW = { w: BASE_W, h: BASE_H };

/** Conservés pour compatibilité : la référence, pas la taille courante. */
export const VIEW_W = BASE_W;
export const VIEW_H = BASE_H;

const MAX_ENEMIES = 1500;
const MAX_PROJECTILES = 900;
const MAX_ZONES = 220;
const MAX_PICKUPS = 2200;
const MAX_SPLATS = 500;
/** Au-delà de ce nombre de gemmes au sol, les plus anciennes fusionnent. */
const GEM_MERGE_THRESHOLD = 400;
/** Distance au-delà de laquelle un ennemi ordinaire est recyclé de l'autre côté. */
const RECYCLE_DIST = 700;

export type RunState = 'playing' | 'levelup' | 'chest' | 'dead' | 'won';

export interface Announcement {
  text: string;
  sub: string;
  time: number;
}

interface Splat {
  x: number;
  y: number;
  sprite: HTMLCanvasElement;
}

export class World {
  readonly seed: number;
  readonly rng: Rng;
  readonly cam = new Camera(VIEW.w, VIEW.h);
  readonly particles = new Particles();
  readonly player: Player;
  readonly grid = new SpatialGrid(64, 40000, MAX_ENEMIES);
  readonly terrain: Terrain;

  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  zones: Zone[] = [];
  pickups: Pickup[] = [];
  splats: Splat[] = [];
  private splatCursor = 0;
  private splatSprites: HTMLCanvasElement[] = [];

  time = 0;
  state: RunState = 'playing';
  gold = 0;
  kills = 0;
  gemsCollected = 0;
  /** Niveaux gagnés en attente de choix de carte. */
  pendingLevelUps = 0;
  /** Coffres ramassés en attente d'ouverture. */
  pendingChests = 0;

  /** Ralenti temporaire (montée de niveau, boss, critique). */
  timeScale = 1;
  private slowMoTimer = 0;
  /**
   * Gel complet de quelques frames. Réservé aux instants majeurs (chute d'un boss) : un
   * micro-gel déclenché sur un événement fréquent produirait un jeu qui bégaie en continu.
   */
  private hitStop = 0;

  boss: Enemy | null = null;
  bossGroup: Enemy[] = [];
  bossName = '';
  announcement: Announcement | null = null;

  /** Fige tous les ennemis (objet Sablier). */
  freezeTimer = 0;
  /** Multiplicateur temporaire du taux d'apparition (événement Déferlante). */
  surgeMult = 1;
  surgeTimer = 0;

  private pidCounter = 1;
  private enemyCursor = 0;
  private projCursor = 0;
  private zoneCursor = 0;
  private pickupCursor = 0;

  private spriteCache = new Map<string, SpriteSet>();
  private deathCache = new Map<string, SpriteSet>();
  private pickupSprites = new Map<string, SpriteSet>();

  /** Reliques déjà obtenues – une relique ne peut pas tomber deux fois. */
  ownedRelics = new Set<string>();
  /** Types d'ennemis croisés pendant le run, reversés au bestiaire à la fin. */
  seenEnemies = new Set<string>();

  constructor(charId: string, seed?: number) {
    this.seed = seed ?? makeSeed();
    this.rng = new Rng(this.seed);
    this.player = new Player(charId);
    this.terrain = new Terrain(this.seed);

    for (let i = 0; i < MAX_ENEMIES; i++) this.enemies.push(makeEnemy(i));
    for (let i = 0; i < MAX_PROJECTILES; i++) this.projectiles.push(makeProjectile());
    for (let i = 0; i < MAX_ZONES; i++) this.zones.push(makeZone());
    for (let i = 0; i < MAX_PICKUPS; i++) this.pickups.push(makePickup());
    for (let i = 0; i < 6; i++) this.splatSprites.push(makeSplat(i * 7919 + 13));

    this.cam.snapTo(0, 0);
  }

  // -------------------------------------------------------------- accesseurs

  get minute(): number {
    return this.time / 60;
  }

  get aliveEnemies(): number {
    let n = 0;
    for (const e of this.enemies) if (e.active && e.dying <= 0) n++;
    return n;
  }

  /** Intensité perçue, pilote la musique adaptative. */
  get intensity(): number {
    const density = clamp(this.aliveEnemies / 260, 0, 1);
    const progress = clamp(this.minute / 30, 0, 1);
    const peril = 1 - this.player.hpRatio;
    return clamp(density * 0.4 + progress * 0.4 + peril * 0.2, 0, 1);
  }

  // ------------------------------------------------------------------ sprites

  private enemySprite(def: EnemyDef): SpriteSet {
    let s = this.spriteCache.get(def.id);
    if (!s) {
      s = makeBody(`enemy:${def.id}`, def.art);
      this.spriteCache.set(def.id, s);
    }
    return s;
  }

  private deathSprite(def: EnemyDef): SpriteSet {
    let s = this.deathCache.get(def.id);
    if (!s) {
      s = makeDeath(`death:${def.id}`, this.enemySprite(def), def.id.length * 7717);
      this.deathCache.set(def.id, s);
    }
    return s;
  }

  private pickupSprite(kind: PickupKind, rank: number): SpriteSet {
    const key = `${kind}:${rank}`;
    let s = this.pickupSprites.get(key);
    if (s) return s;
    switch (kind) {
      case 'gem': s = makeGem(clamp(rank, 0, 3) as 0 | 1 | 2 | 3); break;
      case 'gold': s = makeCoin(); break;
      case 'heart': s = makeHeart(); break;
      case 'chest': s = makeChest(); break;
      case 'relic': s = makeRelic((['common', 'rare', 'epic', 'cursed'] as const)[clamp(rank, 0, 3)]!); break;
      case 'magnet': s = makeItem('magnet'); break;
      case 'bomb': s = makeItem('bomb'); break;
      case 'hourglass': s = makeItem('hourglass'); break;
      case 'scroll': s = makeItem('scroll'); break;
      case 'censer': s = makeItem('censer'); break;
    }
    this.pickupSprites.set(key, s);
    return s;
  }

  /** Pré-génère tous les sprites – évite un à-coup au premier spawn de chaque type. */
  warmup(): void {
    for (const id of ['bat', 'ghoul', 'crow', 'wolf', 'skeleton', 'spider', 'zombie', 'wraith', 'spitter', 'leech', 'rider', 'golem', 'damned']) {
      const def = enemyById(id);
      this.enemySprite(def);
      this.deathSprite(def);
    }
    for (let r = 0; r < 4; r++) this.pickupSprite('gem', r);
    for (const k of ['gold', 'heart', 'chest', 'magnet', 'bomb', 'hourglass', 'scroll', 'censer'] as PickupKind[]) {
      this.pickupSprite(k, 0);
    }
    for (let r = 0; r < 4; r++) this.pickupSprite('relic', r);
  }

  // --------------------------------------------------------------- allocation

  private allocEnemy(): Enemy | null {
    for (let i = 0; i < MAX_ENEMIES; i++) {
      const e = this.enemies[this.enemyCursor]!;
      this.enemyCursor = (this.enemyCursor + 1) % MAX_ENEMIES;
      if (!e.active) return e;
    }
    return null;
  }

  private allocProjectile(): Projectile | null {
    // Les projectiles sont volatils : si le pool sature, écraser le plus ancien est
    // préférable à ne rien tirer du tout.
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      const p = this.projectiles[this.projCursor]!;
      this.projCursor = (this.projCursor + 1) % MAX_PROJECTILES;
      if (!p.active) return p;
    }
    const p = this.projectiles[this.projCursor]!;
    this.projCursor = (this.projCursor + 1) % MAX_PROJECTILES;
    return p;
  }

  private allocZone(): Zone | null {
    for (let i = 0; i < MAX_ZONES; i++) {
      const z = this.zones[this.zoneCursor]!;
      this.zoneCursor = (this.zoneCursor + 1) % MAX_ZONES;
      if (!z.active) return z;
    }
    return null;
  }

  private allocPickup(): Pickup | null {
    for (let i = 0; i < MAX_PICKUPS; i++) {
      const p = this.pickups[this.pickupCursor]!;
      this.pickupCursor = (this.pickupCursor + 1) % MAX_PICKUPS;
      if (!p.active) return p;
    }
    return null;
  }

  // ------------------------------------------------------------------ spawns

  spawnEnemy(defId: string, x: number, y: number, elite = false): Enemy | null {
    const def = enemyById(defId);
    const e = this.allocEnemy();
    if (!e) return null;

    const m = this.minute;
    const isBoss = !!def.boss;
    const hpMul = hpScale(isBoss ? Math.min(m, 30) : m) * (1 + this.player.flag('enemyHp'));

    e.active = true;
    e.x = x;
    e.y = y;
    e.px = x;
    e.py = y;
    e.vx = 0;
    e.vy = 0;
    e.kx = 0;
    e.ky = 0;
    e.def = def;
    e.boss = isBoss;
    e.elite = elite && !isBoss;
    e.maxHp = Math.max(1, Math.round(def.hp * (isBoss ? 1 : hpMul) * (e.elite ? 6 : 1)));
    e.hp = e.maxHp;
    e.damage = def.damage * damageScale(m);
    e.speed = def.speed;
    e.radius = def.radius * (e.elite ? 1.4 : 1);
    e.sprite = this.enemySprite(def);
    e.anim = fxRng.next() * 4;
    e.flash = 0;
    e.facing = 1;
    e.touchCd = 0;
    e.slow = 0;
    e.stun = 0;
    e.poison = 0;
    e.poisonDps = 0;
    e.lastPid = -1;
    e.state = 0;
    e.timer = 0;
    e.phase = 0;
    e.mechTimer = 0;
    e.dying = 0;
    resetImmunity(e);
    this.seenEnemies.add(def.id);

    if (isBoss) {
      this.boss = e;
      this.bossGroup.push(e);
      this.bossName = def.name;
    }
    return e;
  }

  /** Fait apparaître un ennemi sur un anneau hors écran autour du joueur. */
  spawnOffscreen(defId: string, angle?: number, elite = false): Enemy | null {
    const a = angle ?? this.rng.angle();
    // Juste au-delà du coin de l'écran, quelle que soit la taille réelle de la vue.
    const r = Math.hypot(this.cam.viewW, this.cam.viewH) * 0.55 + this.rng.range(0, 60);
    return this.spawnEnemy(
      defId,
      this.player.x + Math.cos(a) * r,
      this.player.y + Math.sin(a) * r * 0.75,
      elite,
    );
  }

  spawnProjectile(
    behavior: ProjBehavior,
    x: number, y: number, vx: number, vy: number,
    damage: number, radius: number, life: number, pierce: number,
    sprite: SpriteSet, color: string, weaponId: string, tags: string[],
    knockback: number, srcId: number,
  ): Projectile | null {
    const p = this.allocProjectile();
    if (!p) return null;
    p.active = true;
    p.pid = this.pidCounter++;
    p.x = x;
    p.y = y;
    p.px = x;
    p.py = y;
    p.vx = vx;
    p.vy = vy;
    p.damage = damage;
    p.radius = radius;
    p.life = life;
    p.maxLife = life;
    p.pierce = pierce;
    p.knockback = knockback;
    p.behavior = behavior;
    p.sprite = sprite;
    p.color = color;
    p.weaponId = weaponId;
    p.tags = tags;
    p.angle = Math.atan2(vy, vx);
    p.rot = 0;
    p.spin = 0;
    p.anim = fxRng.next() * 4;
    p.a = 0;
    p.b = 0;
    p.c = 0;
    p.tick = 0.35;
    p.zoneRadius = 0;
    p.zoneDamage = 0;
    p.zoneLife = 0;
    p.srcId = srcId;
    p.hostile = false;
    p.anchored = false;
    return p;
  }

  spawnZone(
    x: number, y: number, radius: number, damage: number, life: number,
    color: string, srcId: number, tickRate = 0.35, grow = false,
  ): Zone | null {
    const z = this.allocZone();
    if (!z) return null;
    z.active = true;
    z.x = x;
    z.y = y;
    z.radius = grow ? radius * 0.3 : radius;
    z.targetRadius = radius;
    z.damage = damage;
    z.life = life;
    z.maxLife = life;
    z.tickTimer = 0;
    z.tickRate = tickRate;
    z.color = color;
    z.srcId = srcId;
    z.anim = 0;
    z.grow = grow;
    return z;
  }

  spawnPickup(kind: PickupKind, x: number, y: number, value: number, rank = 0, relicId = ''): Pickup | null {
    const p = this.allocPickup();
    if (!p) return null;
    p.active = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.px = x;
    p.py = y;
    const a = fxRng.angle();
    const eject = kind === 'gem' ? 18 : 42;
    p.vx = Math.cos(a) * fxRng.range(0, eject);
    p.vy = Math.sin(a) * fxRng.range(0, eject);
    p.value = value;
    p.rank = rank;
    p.anim = fxRng.next() * 4;
    p.drawn = false;
    p.armTime = kind === 'gem' ? 0 : 0.35;
    p.relicId = relicId;
    p.sprite = this.pickupSprite(kind, rank);
    return p;
  }

  // ------------------------------------------------------------------- dégâts

  /**
   * Applique des dégâts à un ennemi. Centralise le critique, le vol de vie, les reliques
   * conditionnelles et tout le retour visuel/sonore – aucune arme ne duplique cette logique.
   */
  damageEnemy(e: Enemy, raw: number, kbx = 0, kby = 0, knockback = 0, silent = false): void {
    if (!e.active || e.dying > 0) return;

    const pl = this.player;
    // Bonus temporaires (obélisque) et effet passif du biome courant (les Cendres attisent).
    let dmg = raw * (1 + pl.buffMight) * this.terrain.currentBiome.mightMul;

    if (e.hp / e.maxHp < 0.3) dmg *= 1 + pl.flag('lowHpBonus');
    if (e.boss) dmg *= 1 + pl.flag('bossDamage');

    const crit = this.rng.next() < pl.stats.crit;
    if (crit) dmg *= 2;

    // Faux Miniature : exécution nette, mais jamais sur un boss.
    const exec = pl.flag('execute');
    if (exec > 0 && !e.boss && this.rng.next() < exec) dmg = e.hp;

    const final = Math.max(1, Math.round(dmg));
    e.hp -= final;
    e.flash = 0.09;
    pl.damageDealt += final;

    if (pl.stats.lifesteal > 0) pl.heal(final * pl.stats.lifesteal);

    // Chapelet Brisé : étourdissement périodique.
    const stunEvery = pl.flag('stunEvery');
    if (stunEvery > 0) {
      pl.hitCount++;
      if (pl.hitCount % Math.round(stunEvery) === 0) e.stun = Math.max(e.stun, 1);
    }

    if (knockback > 0 && e.def.kbResist < 1) {
      const k = knockback * (1 - e.def.kbResist);
      const len = Math.hypot(kbx, kby) || 1;
      e.kx += (kbx / len) * k;
      e.ky += (kby / len) * k;
    }

    if (!silent) {
      this.particles.number(e.x, e.y - e.radius - 2, final, crit);
      this.particles.sparks(e.x, e.y, Math.atan2(kby, kbx), crit ? 6 : 3, crit ? P.gold : P.spark);
      audio.play(crit ? 'crit' : 'hit');
      // Ni secousse ni micro-gel sur un critique : à 5 % de chance et plusieurs dizaines de
      // coups par seconde, l'écran tremblerait sans interruption et le jeu perdrait des
      // frames en continu. Le critique reste signalé par le chiffre doré et le son.
    }

    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e: Enemy): void {
    if (!e.active || e.dying > 0) return;
    const def = e.def as BossDef;
    if (def.invincible) {
      e.hp = e.maxHp; // la Faucheuse ne meurt pas
      return;
    }

    e.dying = 0.28;
    e.hp = 0;
    this.kills++;
    this.player.killStreak++;

    const heavy = e.boss || e.elite || e.radius > 9;
    audio.play(heavy ? 'killHeavy' : 'kill');
    this.particles.blood(e.x, e.y, e.boss ? 26 : e.elite ? 12 : 5);
    this.particles.shards(e.x, e.y, e.boss ? 18 : 4, P.bloodDark);
    if (heavy) this.cam.shake(e.boss ? 0.3 : 0.05);

    this.addSplat(e.x, e.y);

    // Ambre : les voisins du mort sont ralentis.
    const slowDur = this.player.flag('slowOnKill');
    if (slowDur > 0) {
      const n = this.grid.query(e.x, e.y, 46);
      for (let i = 0; i < n; i++) {
        const other = this.enemies[this.grid.result[i]!];
        if (other?.active && other.dying <= 0) other.slow = Math.max(other.slow, slowDur);
      }
    }

    this.dropLoot(e);

    if (e.def.ai === 'split') {
      for (let i = 0; i < 2; i++) {
        const a = this.rng.angle();
        this.spawnEnemy('ghoul', e.x + Math.cos(a) * 8, e.y + Math.sin(a) * 8);
      }
    }

    if (e.boss) this.onBossKilled(e);
  }

  private addSplat(x: number, y: number): void {
    const sprite = this.splatSprites[this.rng.int(0, this.splatSprites.length - 1)]!;
    if (this.splats.length < MAX_SPLATS) {
      this.splats.push({ x, y, sprite });
    } else {
      // Tampon circulaire : la trace du carnage reste visible sans coût qui dérive.
      this.splats[this.splatCursor] = { x, y, sprite };
      this.splatCursor = (this.splatCursor + 1) % MAX_SPLATS;
    }
  }

  // -------------------------------------------------------------------- butin

  private dropLoot(e: Enemy): void {
    const pl = this.player;
    const luck = pl.stats.luck;
    const r = this.rng;

    // Gemme d'XP – toujours, sauf pour les scissions déjà comptées.
    const rank = e.boss ? 3 : e.elite ? 2 : e.def.gemRank;
    const xpValue = [2, 9, 35, 140][rank]!;
    const gems = e.boss ? 14 : e.elite ? 3 : 1;
    for (let i = 0; i < gems; i++) {
      this.spawnPickup('gem', e.x + r.spread(6), e.y + r.spread(6), xpValue, rank);
    }

    const D = DROP_TABLE;
    const chance = (p: number): boolean => r.next() < p * luck;

    if (chance((e.def.goldChance ?? D.goldCoin) * (e.boss ? 8 : 1))) {
      this.spawnPickup('gold', e.x, e.y, r.int(1, 10), 0);
    }
    if (chance(D.goldBag)) this.spawnPickup('gold', e.x, e.y, r.int(25, 80), 0);
    if (chance(D.heart)) this.spawnPickup('heart', e.x, e.y, 0, 0);
    if (chance(D.magnet)) this.spawnPickup('magnet', e.x, e.y, 0, 0);
    if (chance(D.censer)) this.spawnPickup('censer', e.x, e.y, 0, 0);
    if (chance(D.bomb)) this.spawnPickup('bomb', e.x, e.y, 0, 0);
    if (chance(D.hourglass)) this.spawnPickup('hourglass', e.x, e.y, 0, 0);
    if (chance(D.scroll)) this.spawnPickup('scroll', e.x, e.y, 0, 0);

    // Coffres et reliques : élites et boss uniquement.
    if (e.elite || e.boss) {
      const chests = 1 + pl.flag('eliteChests') + (e.boss ? 2 : 0);
      for (let i = 0; i < chests; i++) {
        this.spawnPickup('chest', e.x + r.spread(14), e.y + r.spread(10), 0, 0);
      }
      if (e.boss || r.chance(0.35 * luck)) this.dropRelic(e.x, e.y);
    }
  }

  /** Tire une relique encore non possédée, pondérée par rareté et modulée par la chance. */
  dropRelic(x: number, y: number): void {
    const pool = RELICS.filter((r) => !this.ownedRelics.has(r.id));
    if (pool.length === 0) {
      this.spawnPickup('gold', x, y, 150, 0);
      return;
    }
    const luck = this.player.stats.luck;
    const weights = pool.map((r) => {
      const w = RARITY_WEIGHT[r.rarity];
      // La chance déplace la distribution vers le haut sans jamais l'inverser.
      return r.rarity === 'common' ? w / luck : w * luck;
    });
    const idx = this.rng.weighted(weights);
    const relic = pool[idx < 0 ? 0 : idx]!;
    const rank = (['common', 'rare', 'epic', 'cursed'] as const).indexOf(relic.rarity);
    this.spawnPickup('relic', x, y, 0, rank, relic.id);
  }

  private collectRelic(relic: RelicDef): void {
    this.ownedRelics.add(relic.id);
    this.player.addRelic(relic.id);
    audio.play(relic.rarity === 'cursed' ? 'relicCursed' : 'relic');
    this.announce(relic.name, RARITY_LABEL[relic.rarity]);
    this.slowMo(0.8, 0.35);
    this.particles.beam(this.player.x, this.player.y, this.relicColor(relic), 1.1);
    this.particles.ring(this.player.x, this.player.y, 40, this.relicColor(relic), 0.6, 2);
    this.cam.shake(0.15, true);
  }

  /**
   * Applique l'effet d'une structure atteinte. Chaque structure ne se déclenche qu'une fois,
   * et récompense l'exploration : s'éloigner du troupeau pour atteindre un obélisque est un
   * pari, puisque le joueur traverse la horde dans les deux sens.
   */
  private activatePoi(poi: Poi): void {
    const pl = this.player;
    const { x, y } = poi;

    this.particles.beam(x, y, poi.def.color, 1.1);
    this.particles.ring(x, y, poi.def.radius * 2.4, poi.def.color, 0.6, 2);
    this.cam.shake(0.12);

    switch (poi.type) {
      case 'altar':
        this.dropRelic(x, y - 6);
        this.announce(poi.def.name, 'une relique se libère');
        audio.play('relic');
        break;

      case 'pyre': {
        pl.heal(pl.stats.maxHp * 0.3);
        this.announce(poi.def.name, 'la flamme purifie');
        audio.play('explode');
        this.explodeAt(x, y, 150, 140 * pl.stats.might);
        // Laisse un foyer qui continue de brûler : le lieu reste tactiquement utile.
        this.spawnZone(x, y, 60, 22 * pl.stats.might, 12, P.fire, poi.key.length + 5000, 0.4);
        break;
      }

      case 'obelisk':
        pl.addBuff('might', 0.3, 45);
        this.announce(poi.def.name, '+30 % de dégâts pendant 45 s');
        audio.play('unlock');
        break;

      case 'well': {
        const amount = Math.round(this.rng.int(150, 400) * pl.stats.greed);
        this.gold += amount;
        this.particles.label(x, y - 12, `+${amount}`, P.gold);
        this.announce(poi.def.name, `${amount} pièces`);
        audio.play('gold');
        break;
      }

      case 'ossuary': {
        // Piège volontaire : la récompense est bonne, mais il faut survivre à ce qui sort.
        this.announce(poi.def.name, 'quelque chose se réveille');
        audio.play('boss');
        const e = this.spawnEnemy('golem', x + 24, y, true);
        if (e) this.particles.ring(e.x, e.y, 30, P.bloodHi, 0.5, 2);
        for (let i = 0; i < 2; i++) {
          this.spawnPickup('chest', x + this.rng.spread(20), y + this.rng.spread(14), 0, 0);
        }
        break;
      }

      case 'chapel':
        pl.heal(pl.stats.maxHp);
        pl.rerolls++;
        this.announce(poi.def.name, 'soins complets, +1 reroll');
        audio.play('heal');
        break;

      case 'cairn':
        this.announce(poi.def.name, 'des offrandes');
        audio.play('chest');
        for (let i = 0; i < 10; i++) {
          this.spawnPickup('gem', x + this.rng.spread(16), y + this.rng.spread(12), 9, 1);
        }
        break;
    }
  }

  private relicColor(r: RelicDef): string {
    return { common: '#ffffff', rare: '#5b9df5', epic: '#a855f7', cursed: '#dc2626' }[r.rarity];
  }

  // ---------------------------------------------------------------- effets UX

  announce(text: string, sub = ''): void {
    this.announcement = { text, sub, time: 2.2 };
  }

  slowMo(scale: number, duration: number): void {
    this.timeScale = scale;
    this.slowMoTimer = duration;
  }

  /** Gèle la simulation quelques dizièmes de seconde – impact maximal, à utiliser rarement. */
  freezeFrames(seconds: number): void {
    this.hitStop = Math.max(this.hitStop, seconds);
  }

  /** Détruit tous les ennemis à l'écran (Encensoir). */
  purge(): void {
    audio.play('explode');
    this.cam.shake(0.3, true);
    this.particles.ring(this.player.x, this.player.y, 260, '#ffffff', 0.6, 4);
    for (const e of this.enemies) {
      if (!e.active || e.dying > 0 || e.boss) continue;
      if (this.cam.visible(e.x, e.y, 60)) this.damageEnemy(e, 99999, 0, 0, 0, true);
    }
  }

  /** Attire toutes les gemmes de la carte (objet Aimant). */
  magnetAll(): void {
    audio.play('gold');
    for (const p of this.pickups) {
      if (p.active && p.kind === 'gem') p.drawn = true;
    }
  }

  explodeAt(x: number, y: number, radius: number, damage: number): void {
    audio.play('explode');
    this.cam.shake(0.18);
    this.particles.ring(x, y, radius, P.fire, 0.45, 3);
    for (let i = 0; i < 18; i++) this.particles.ember(x, y, P.fire, 1);
    const n = this.grid.query(x, y, radius);
    for (let i = 0; i < n; i++) {
      const e = this.enemies[this.grid.result[i]!];
      if (!e?.active || e.dying > 0) continue;
      if (dist2(x, y, e.x, e.y) > radius * radius) continue;
      this.damageEnemy(e, damage, e.x - x, e.y - y, 80, true);
    }
  }

  // ------------------------------------------------------------------- boss

  private onBossKilled(e: Enemy): void {
    this.bossGroup = this.bossGroup.filter((b) => b !== e && b.active && b.dying <= 0);
    if (this.bossGroup.length > 0) return; // Chœur de Cendres : les trois corps doivent tomber

    this.boss = null;
    audio.play('bossDie');
    audio.setBossMode(false);
    this.freezeFrames(0.12);
    this.slowMo(0.25, 1.4);
    this.cam.shake(0.5, true);
    this.announce('TERRASSÉ', this.bossName);

    if (e.def.id === 'sanguine') {
      this.state = 'won';
    }
  }

  // ------------------------------------------------------------------ update

  update(dt: number): void {
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return; // micro-gel : la frame est simplement sautée
    }

    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= dt;
      if (this.slowMoTimer <= 0) this.timeScale = 1;
    }
    const sdt = dt * this.timeScale;

    this.time += sdt;
    if (this.announcement) {
      this.announcement.time -= dt;
      if (this.announcement.time <= 0) this.announcement = null;
    }
    if (this.freezeTimer > 0) this.freezeTimer -= sdt;
    if (this.surgeTimer > 0) {
      this.surgeTimer -= sdt;
      if (this.surgeTimer <= 0) this.surgeMult = 1;
    }

    const poi = this.terrain.update(this.player.x, this.player.y, sdt);
    if (poi) this.activatePoi(poi);
    if (this.terrain.biomeChanged) {
      this.announce(this.terrain.currentBiome.name, this.terrain.currentBiome.flavor);
    }

    this.rebuildGrid();
    this.updateEnemies(sdt);
    this.updateProjectiles(sdt);
    this.updateZones(sdt);
    this.updatePickups(sdt);
    this.particles.update(sdt);
    this.cam.update(dt);

    audio.intensity = this.intensity;

    if (this.player.dead && this.state === 'playing') {
      if (!this.player.tryRevive()) {
        this.state = 'dead';
        audio.play('death');
      } else {
        this.announce('SURSIS', 'une fois de plus');
        this.purge();
      }
    }

  }

  private rebuildGrid(): void {
    this.grid.clear();
    for (const e of this.enemies) {
      if (e.active && e.dying <= 0) this.grid.insert(e.id, e.x, e.y);
    }
  }

  // ----------------------------------------------------------- IA des ennemis

  private updateEnemies(dt: number): void {
    const pl = this.player;
    const frozen = this.freezeTimer > 0;
    const now = this.time;

    for (const e of this.enemies) {
      if (!e.active) continue;

      if (e.dying > 0) {
        e.dying -= dt;
        if (e.dying <= 0) e.active = false;
        continue;
      }

      e.px = e.x;
      e.py = e.y;
      e.anim += dt * (2 + e.speed / 30);
      if (e.flash > 0) e.flash -= dt;
      if (e.touchCd > 0) e.touchCd -= dt;
      if (e.slow > 0) e.slow -= dt;
      if (e.stun > 0) e.stun -= dt;

      if (e.poison > 0) {
        e.poison -= dt;
        e.hp -= e.poisonDps * dt;
        if (fxRng.chance(dt * 6)) this.particles.ember(e.x, e.y, P.poison, 1);
        if (e.hp <= 0) {
          this.killEnemy(e);
          continue;
        }
      }

      // Recul : amorti indépendamment du déplacement propre de l'ennemi.
      if (e.kx !== 0 || e.ky !== 0) {
        e.x += e.kx * dt;
        e.y += e.ky * dt;
        const damp = Math.pow(0.001, dt);
        e.kx *= damp;
        e.ky *= damp;
        if (Math.abs(e.kx) < 1) e.kx = 0;
        if (Math.abs(e.ky) < 1) e.ky = 0;
      }

      if (frozen || e.stun > 0) continue;

      const dx = pl.x - e.x;
      const dy = pl.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const speed = e.speed * (e.slow > 0 ? 0.45 : 1);

      this.runAI(e, dx / d, dy / d, d, speed, dt);

      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.facing = e.vx < -1 ? -1 : e.vx > 1 ? 1 : e.facing;

      if (e.def.ai !== 'phase' && !e.boss) this.separate(e, dt);

      // Contact avec le joueur
      const touchDist = e.radius + 5;
      if (d < touchDist && e.touchCd <= 0) {
        if (pl.takeDamage(e.damage)) {
          e.touchCd = 0.5;
          this.onPlayerHit(e);
        }
      }

      // Recyclage des ennemis trop lointains : on les remet de l'autre côté plutôt que de
      // les détruire, ce qui garde la pression constante sans re-payer un spawn.
      if (!e.boss && d > RECYCLE_DIST) {
        const a = Math.atan2(pl.y - e.y, pl.x - e.x) + this.rng.spread(0.9);
        e.x = pl.x - Math.cos(a) * 330;
        e.y = pl.y - Math.sin(a) * 260;
        e.px = e.x;
        e.py = e.y;
      }

      if (e.boss) this.runBoss(e, dt, now);
    }
  }

  private runAI(e: Enemy, nx: number, ny: number, d: number, speed: number, dt: number): void {
    switch (e.def.ai) {
      case 'chase':
      case 'phase':
      case 'split':
        e.vx = nx * speed;
        e.vy = ny * speed;
        break;

      case 'wave': {
        // Poursuite + oscillation perpendiculaire : lisible, et rend le kiting moins trivial.
        e.timer += dt;
        const s = Math.sin(e.timer * 5 + e.id) * 0.55;
        e.vx = (nx - ny * s) * speed;
        e.vy = (ny + nx * s) * speed;
        break;
      }

      case 'erratic': {
        e.timer -= dt;
        if (e.timer <= 0) {
          e.timer = this.rng.range(0.25, 0.7);
          e.state = Math.atan2(ny, nx) + this.rng.spread(1.1);
        }
        e.vx = Math.cos(e.state) * speed;
        e.vy = Math.sin(e.state) * speed;
        break;
      }

      case 'charger': {
        // Alternance élan / pause : le joueur peut lire l'attaque et l'esquiver.
        e.timer -= dt;
        if (e.timer <= 0) {
          e.state = e.state === 0 ? 1 : 0;
          e.timer = e.state === 1 ? 0.55 : 0.9;
        }
        const mul = e.state === 1 ? 2.1 : 0.35;
        e.vx = nx * speed * mul;
        e.vy = ny * speed * mul;
        break;
      }

      case 'ranged': {
        // S'arrête à distance et crache. Le seul ennemi à portée du jeu.
        const want = 120;
        const approach = d > want + 20 ? 1 : d < want - 30 ? -0.8 : 0;
        e.vx = nx * speed * approach;
        e.vy = ny * speed * approach;
        e.timer -= dt;
        if (e.timer <= 0 && d < 260) {
          e.timer = 2.6;
          this.spawnEnemyShot(e, nx, ny);
        }
        break;
      }

      case 'leech':
        e.vx = nx * speed;
        e.vy = ny * speed;
        break;

      case 'dasher': {
        // Ruée rectiligne : verrouille sa direction, traverse, puis re-vise.
        e.timer -= dt;
        if (e.state === 0) {
          e.state = 1;
          e.timer = 0.7;
          e.dirX = nx;
          e.dirY = ny;
        }
        if (e.timer <= 0) {
          e.timer = 1.8;
          e.dirX = nx;
          e.dirY = ny;
        }
        e.vx = e.dirX * speed;
        e.vy = e.dirY * speed;
        break;
      }
    }
  }

  private spawnEnemyShot(e: Enemy, nx: number, ny: number): void {
    const sprite = this.pickupSprite('gem', 1); // réutilise un petit sprite existant
    const p = this.spawnProjectile(
      'enemyShot', e.x, e.y, nx * 105, ny * 105,
      e.damage, 4, 3.2, 1, sprite, P.poison, 'enemy', [], 0, -1,
    );
    if (p) p.hostile = true;
    audio.play('shoot', 0.6);
  }

  private separate(e: Enemy, dt: number): void {
    // Séparation approximative : seuls quelques voisins de la même cellule sont testés.
    // Une séparation exacte serait en O(n²) et le résultat visuel est indiscernable.
    let other = this.grid.cellHead(e.x, e.y);
    let checked = 0;
    while (other !== -1 && checked < 4) {
      if (other !== e.id) {
        const o = this.enemies[other]!;
        if (o.active && o.dying <= 0) {
          const dx = e.x - o.x;
          const dy = e.y - o.y;
          const minD = e.radius + o.radius;
          const d2 = dx * dx + dy * dy;
          if (d2 < minD * minD && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const push = ((minD - d) / d) * 26 * dt;
            e.x += dx * push;
            e.y += dy * push;
          }
        }
        checked++;
      }
      other = this.grid.nextIn(other);
    }
  }

  private onPlayerHit(e: Enemy): void {
    const pl = this.player;
    audio.play('hurt');
    this.cam.shake(0.16);
    this.particles.blood(pl.x, pl.y, 8, P.bloodHi);

    if (e.def.ai === 'leech') e.hp = Math.min(e.maxHp, e.hp + e.damage * 2);

    // Miroir de Poche : renvoi des dégâts.
    const reflect = pl.flag('reflect');
    if (reflect > 0 && this.rng.next() < reflect) {
      this.damageEnemy(e, e.damage * 3, e.x - pl.x, e.y - pl.y, 60);
    }

    // Sang Corrompu : l'arme réactive se déclenche ici.
    const tainted = pl.weapon('tainted');
    if (tainted) {
      const w = tainted.def;
      const radius = w.area * pl.stats.area;
      const dmg = w.damage * (1 + (tainted.level - 1) * w.dmgPerLevel) * pl.stats.might;
      this.explodeAt(pl.x, pl.y, radius, dmg);
    }
  }

  private runBoss(e: Enemy, dt: number, now: number): void {
    const def = e.def as BossDef;
    e.mechTimer -= dt;

    switch (def.mechanic) {
      case 'summon':
        if (e.mechTimer <= 0) {
          e.mechTimer = 4;
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU + now;
            this.spawnEnemy('spider', e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30);
          }
          this.particles.ring(e.x, e.y, 40, P.poison, 0.5, 2);
        }
        break;

      case 'charge':
        // Déjà géré par l'IA `charger` ; on ajoute seulement le télégraphe visuel.
        if (e.state === 1 && fxRng.chance(dt * 12)) {
          this.particles.ember(e.x, e.y, P.bloodHi, 1);
        }
        break;

      case 'triad':
        if (e.mechTimer <= 0) {
          e.mechTimer = 3.5;
          const a = this.rng.angle();
          for (let i = 0; i < 8; i++) {
            const ang = a + (i / 8) * TAU;
            const p = this.spawnProjectile(
              'enemyShot', e.x, e.y, Math.cos(ang) * 90, Math.sin(ang) * 90,
              e.damage * 0.6, 4, 4, 1, this.pickupSprite('gem', 2), P.fire, 'enemy', [], 0, -1,
            );
            if (p) p.hostile = true;
          }
        }
        break;

      case 'phases': {
        const ratio = e.hp / e.maxHp;
        const wanted = ratio > 0.66 ? 0 : ratio > 0.33 ? 1 : 2;
        if (wanted !== e.phase) {
          e.phase = wanted;
          e.mechTimer = 0;
          this.cam.shake(0.3, true);
          audio.play('boss');
          this.announce('LE SANGUINAIRE', `phase ${wanted + 1}`);
        }
        if (e.mechTimer <= 0) {
          if (e.phase === 0) {
            e.mechTimer = 3;
            for (let i = 0; i < 10; i++) {
              const a = (i / 10) * TAU;
              this.spawnEnemy('damned', e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40);
            }
          } else if (e.phase === 1) {
            e.mechTimer = 2.2;
            const base = this.rng.angle();
            for (let i = 0; i < 20; i++) {
              const ang = base + (i / 20) * TAU;
              const p = this.spawnProjectile(
                'enemyShot', e.x, e.y, Math.cos(ang) * 110, Math.sin(ang) * 110,
                e.damage * 0.5, 4, 4.5, 1, this.pickupSprite('gem', 2), P.bloodHi, 'enemy', [], 0, -1,
              );
              if (p) p.hostile = true;
            }
          } else {
            e.mechTimer = 1.2;
            e.speed = e.def.speed * 1.9; // frénésie
            for (let i = 0; i < 4; i++) {
              const a = this.rng.angle();
              this.spawnEnemy('wolf', e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40);
            }
          }
        }
        break;
      }

      case 'reaper':
        if (fxRng.chance(dt * 20)) this.particles.ember(e.x, e.y, P.bloodHi, 1);
        break;
    }
  }

  // -------------------------------------------------------- projectiles

  private updateProjectiles(dt: number): void {
    const pl = this.player;
    const now = this.time;

    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.px = p.x;
      p.py = p.y;
      p.life -= dt;
      p.anim += dt * 10;
      p.rot += p.spin * dt;
      if (p.life <= 0) {
        p.active = false;
        // Une fiole qui retombe se transforme en flaque persistante.
        if (p.zoneLife > 0) {
          this.spawnZone(p.x, p.y, p.zoneRadius, p.zoneDamage, p.zoneLife, p.color, p.srcId, 0.35, p.tags.includes('grow'));
          this.particles.ring(p.x, p.y, p.zoneRadius, p.color, 0.35, 2);
          audio.play('fire');
        }
        continue;
      }

      switch (p.behavior) {
        case 'linear':
        case 'enemyShot':
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          break;

        case 'boomerang': {
          // `a` mémorise l'instant de demi-tour : la croix ralentit, s'arrête, puis revient.
          const t = 1 - p.life / p.maxLife;
          const curve = 1 - t * 2; // +1 → −1
          p.x += p.vx * curve * dt;
          p.y += p.vy * curve * dt;
          break;
        }

        case 'orbit': {
          // `a` = rayon, `b` = vitesse angulaire, `c` = phase
          p.c += p.b * dt;
          p.x = pl.x + Math.cos(p.c) * p.a;
          p.y = pl.y + Math.sin(p.c) * p.a * 0.8;
          break;
        }

        case 'flail': {
          p.c += p.b * dt;
          p.x = pl.x + Math.cos(p.c) * p.a;
          p.y = pl.y + Math.sin(p.c) * p.a * 0.7;
          break;
        }

        case 'pet': {
          // Familier : cherche la cible la plus proche et fonce dessus.
          const target = this.nearestEnemy(p.x, p.y, 240);
          if (target) {
            const dx = target.x - p.x;
            const dy = target.y - p.y;
            const d = Math.hypot(dx, dy) || 1;
            p.vx += ((dx / d) * p.a - p.vx) * Math.min(1, dt * 6);
            p.vy += ((dy / d) * p.a - p.vy) * Math.min(1, dt * 6);
          } else {
            // Sans cible, il revient tourner autour du joueur.
            const dx = pl.x - p.x;
            const dy = pl.y - p.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d > 60) {
              p.vx += ((dx / d) * p.a - p.vx) * Math.min(1, dt * 4);
              p.vy += ((dy / d) * p.a - p.vy) * Math.min(1, dt * 4);
            }
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.angle = Math.atan2(p.vy, p.vx);
          break;
        }

        case 'lob': {
          // Trajectoire en cloche : `a` = distance totale, `b` = progression.
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          break;
        }

        case 'bounce': {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          break;
        }

        case 'melee':
        case 'wave':
        case 'spike':
        case 'strike':
          // Statiques : ils vivent le temps de leur animation et frappent une fois.
          if (p.anchored) {
            p.x = pl.x + p.a;
            p.y = pl.y + p.b;
          }
          break;
      }

      if (p.hostile) {
        // Projectile ennemi : ne teste que le joueur.
        if (dist2(p.x, p.y, pl.x, pl.y) < (p.radius + 5) ** 2) {
          if (pl.takeDamage(p.damage)) {
            audio.play('hurt');
            this.cam.shake(0.14);
            this.particles.blood(pl.x, pl.y, 6, P.bloodHi);
          }
          p.active = false;
        }
        continue;
      }

      this.projectileHits(p, now, dt);
    }
  }

  private projectileHits(p: Projectile, now: number, dt: number): void {
    const persistent =
      p.behavior === 'orbit' || p.behavior === 'flail' || p.behavior === 'pet' ||
      p.behavior === 'melee' || p.behavior === 'wave' || p.behavior === 'spike';

    const n = this.grid.query(p.x, p.y, p.radius + 14);
    for (let i = 0; i < n; i++) {
      const e = this.enemies[this.grid.result[i]!];
      if (!e?.active || e.dying > 0) continue;

      const rr = p.radius + e.radius;
      if (dist2(p.x, p.y, e.x, e.y) > rr * rr) continue;

      if (persistent) {
        if (!claimHit(e, p.srcId, now, p.tick)) continue;
      } else {
        if (e.lastPid === p.pid) continue;
        e.lastPid = p.pid;
      }

      const dmg = p.tags.includes('rampBounce') ? p.damage * (1 + p.c * 0.15) : p.damage;
      this.damageEnemy(e, dmg, e.x - p.x, e.y - p.y, p.knockback);

      if (p.tags.includes('poison')) {
        e.poison = Math.max(e.poison, 2.5);
        e.poisonDps = Math.max(e.poisonDps, p.damage * 0.35);
      }
      if (p.tags.includes('slow')) e.slow = Math.max(e.slow, 1.6);
      if (p.tags.includes('burn')) {
        this.spawnZone(e.x, e.y, 16, p.damage * 0.4, 1.6, P.fire, p.srcId, 0.4);
      }
      if (p.tags.includes('chain')) this.chainLightning(p, e);

      if (p.behavior === 'bounce') {
        this.redirectBounce(p, e);
        continue;
      }

      if (!persistent) {
        p.pierce--;
        if (p.pierce <= 0) {
          p.active = false;
          this.particles.sparks(p.x, p.y, p.angle + Math.PI, 3, p.color);
          return;
        }
      }
    }

    // Rebond sur les bords de l'écran (Kaléidoscope).
    if (p.tags.includes('screenBounce')) {
      const hw = this.cam.viewW / 2 - 6;
      const hh = this.cam.viewH / 2 - 6;
      const rx = p.x - this.cam.x;
      const ry = p.y - this.cam.y;
      if (rx < -hw || rx > hw) {
        p.vx = -p.vx;
        p.x += p.vx * dt * 2;
      }
      if (ry < -hh || ry > hh) {
        p.vy = -p.vy;
        p.y += p.vy * dt * 2;
      }
    }
  }

  private redirectBounce(p: Projectile, from: Enemy): void {
    p.c++; // nombre de rebonds effectués
    p.pierce--;
    if (p.pierce <= 0) {
      p.active = false;
      return;
    }
    const next = this.nearestEnemy(from.x, from.y, 160, from.id);
    const speed = Math.hypot(p.vx, p.vy) || 200;
    if (next) {
      const dx = next.x - p.x;
      const dy = next.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      p.vx = (dx / d) * speed;
      p.vy = (dy / d) * speed;
    } else {
      const a = this.rng.angle();
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
    }
    p.angle = Math.atan2(p.vy, p.vx);
    // Repousse légèrement le projectile pour qu'il ne re-touche pas la même cible.
    p.x += p.vx * 0.05;
    p.y += p.vy * 0.05;
  }

  private chainLightning(p: Projectile, from: Enemy): void {
    let src = from;
    for (let k = 0; k < 3; k++) {
      const next = this.nearestEnemy(src.x, src.y, 90, src.id);
      if (!next) break;
      this.damageEnemy(next, p.damage * 0.7, 0, 0, 0, true);
      this.particles.sparks(next.x, next.y, 0, 4, P.spark, 3);
      src = next;
    }
  }

  nearestEnemy(x: number, y: number, maxDist: number, excludeId = -1): Enemy | null {
    const n = this.grid.query(x, y, maxDist);
    let best: Enemy | null = null;
    let bestD = maxDist * maxDist;
    for (let i = 0; i < n; i++) {
      const e = this.enemies[this.grid.result[i]!];
      if (!e?.active || e.dying > 0 || e.id === excludeId) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  /** Cible aléatoire dans un rayon – utilisé par Jugement. */
  randomEnemy(x: number, y: number, maxDist: number): Enemy | null {
    const n = this.grid.query(x, y, maxDist);
    if (n === 0) return null;
    for (let tries = 0; tries < 6; tries++) {
      const e = this.enemies[this.grid.result[this.rng.int(0, n - 1)]!];
      if (e?.active && e.dying <= 0) return e;
    }
    return null;
  }

  // -------------------------------------------------------------- zones

  private updateZones(dt: number): void {
    const now = this.time;
    for (const z of this.zones) {
      if (!z.active) continue;
      z.life -= dt;
      z.anim += dt;
      if (z.life <= 0) {
        z.active = false;
        continue;
      }
      if (z.grow && z.radius < z.targetRadius) {
        z.radius = Math.min(z.targetRadius, z.radius + z.targetRadius * dt * 0.9);
      }

      if (fxRng.chance(dt * 8)) {
        const a = fxRng.angle();
        const r = fxRng.range(0, z.radius);
        this.particles.ember(z.x + Math.cos(a) * r, z.y + Math.sin(a) * r * 0.7, z.color, 1);
      }

      z.tickTimer -= dt;
      if (z.tickTimer > 0) continue;
      z.tickTimer = z.tickRate;

      const n = this.grid.query(z.x, z.y, z.radius);
      for (let i = 0; i < n; i++) {
        const e = this.enemies[this.grid.result[i]!];
        if (!e?.active || e.dying > 0) continue;
        const rr = z.radius + e.radius;
        if (dist2(z.x, z.y, e.x, e.y) > rr * rr) continue;
        if (!claimHit(e, z.srcId, now, z.tickRate * 0.9)) continue;
        this.damageEnemy(e, z.damage, 0, 0, 0, true);
      }
    }
  }

  // ------------------------------------------------------------ ramassages

  private updatePickups(dt: number): void {
    const pl = this.player;
    const radius = pl.stats.pickupRadius;
    const r2 = radius * radius;
    let gemCount = 0;

    for (const p of this.pickups) {
      if (!p.active) continue;
      p.px = p.x;
      p.py = p.y;
      p.anim += dt * 6;
      if (p.armTime > 0) p.armTime -= dt;
      if (p.kind === 'gem') gemCount++;

      // Éjection initiale, amortie
      if (p.vx !== 0 || p.vy !== 0) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const damp = Math.pow(0.002, dt);
        p.vx *= damp;
        p.vy *= damp;
        if (Math.abs(p.vx) < 1 && Math.abs(p.vy) < 1) {
          p.vx = 0;
          p.vy = 0;
        }
      }

      const d2 = dist2(p.x, p.y, pl.x, pl.y);
      const magnetic = p.kind === 'gem' || p.kind === 'gold';
      if (!p.drawn && magnetic && d2 < r2) p.drawn = true;

      if (p.drawn) {
        // Attraction accélérée : plus la gemme approche, plus elle va vite. C'est ce qui
        // rend le ramassage satisfaisant plutôt que mou.
        const d = Math.sqrt(d2) || 1;
        const pull = 120 + (1 - clamp(d / 200, 0, 1)) * 420;
        p.x += ((pl.x - p.x) / d) * pull * dt;
        p.y += ((pl.y - p.y) / d) * pull * dt;
      }

      const pickDist = p.kind === 'chest' || p.kind === 'relic' ? 12 : 8;
      if (p.armTime <= 0 && d2 < pickDist * pickDist) this.collect(p);
    }

    if (gemCount > GEM_MERGE_THRESHOLD) this.mergeGems(gemCount - GEM_MERGE_THRESHOLD);
  }

  /** Fusionne les gemmes excédentaires en gemmes de rang supérieur. Aucune XP n'est perdue. */
  private mergeGems(excess: number): void {
    let merged = 0;
    let carry = 0;
    for (const p of this.pickups) {
      if (merged >= excess) break;
      if (!p.active || p.kind !== 'gem' || p.drawn || p.rank >= 3) continue;
      carry += p.value;
      p.active = false;
      merged++;
      if (carry >= 25) {
        const host = this.spawnPickup('gem', p.x, p.y, carry, carry >= 100 ? 3 : 2);
        if (host) {
          host.vx = 0;
          host.vy = 0;
        }
        carry = 0;
      }
    }
    if (carry > 0) this.spawnPickup('gem', this.player.x + this.rng.spread(40), this.player.y + this.rng.spread(30), carry, 1);
  }

  private collect(p: Pickup): void {
    const pl = this.player;
    p.active = false;

    switch (p.kind) {
      case 'gem': {
        this.gemsCollected++;
        const bonus = 1 + pl.flag('gemBonus');
        const levels = pl.addXp(p.value * bonus);
        audio.play('gem', 1 + Math.min(this.gemsCollected % 12, 12) * 0.04);
        this.particles.sparks(p.x, p.y, 0, 2, P.xp1, 3);
        if (levels > 0) {
          this.pendingLevelUps += levels;
          this.onLevelUp();
        }
        break;
      }
      case 'gold': {
        const amount = Math.round(p.value * pl.stats.greed);
        this.gold += amount;
        audio.play('gold');
        this.particles.label(p.x, p.y - 4, `+${amount}`, P.gold);
        break;
      }
      case 'heart': {
        const mul = Math.max(1, pl.flag('heartBoost'));
        const healed = pl.heal(pl.stats.maxHp * 0.25 * mul);
        audio.play('heal');
        this.particles.label(pl.x, pl.y - 12, `+${Math.round(healed)}`, P.bloodHi);
        this.particles.ring(pl.x, pl.y, 24, P.bloodHi, 0.4, 2);
        break;
      }
      case 'magnet':
        this.magnetAll();
        this.particles.ring(pl.x, pl.y, 90, P.xp1, 0.6, 2);
        break;
      case 'censer':
        this.purge();
        break;
      case 'bomb':
        this.explodeAt(p.x, p.y, 130, 260);
        break;
      case 'hourglass':
        this.freezeTimer = 4;
        audio.play('nova');
        this.particles.ring(pl.x, pl.y, 200, P.ice, 0.7, 3);
        this.announce('TEMPS FIGÉ', '');
        break;
      case 'scroll':
        pl.rerolls++;
        audio.play('confirm');
        this.particles.label(pl.x, pl.y - 12, '+1', P.linen);
        break;
      case 'chest':
        this.pendingChests++;
        audio.play('chest');
        this.slowMo(0.4, 0.5);
        break;
      case 'relic': {
        const relic = RELICS.find((r) => r.id === p.relicId);
        if (relic) this.collectRelic(relic);
        break;
      }
    }
  }

  private onLevelUp(): void {
    audio.play('levelup');
    this.slowMo(0.3, 0.45);
    this.particles.ring(this.player.x, this.player.y, 46, P.gold, 0.6, 2);
    this.particles.beam(this.player.x, this.player.y, P.gold, 0.7);
    for (let i = 0; i < 10; i++) this.particles.ember(this.player.x, this.player.y, P.gold, 1);
  }
}
