import { TAU, dist2 } from '../core/math';
import { fxRng } from '../core/rng';
import { P } from '../gfx/palette';
import { makeProjectile as makeProjSprite, type SpriteSet } from '../gfx/sprites';
import { audio } from '../audio/audio';
import type { WeaponDef } from '../data/weapons';
import type { Player } from './player';
import type { World } from './world';
import type { WeaponInstance, Projectile } from './types';

/**
 * Runtime des armes. Chaque `behavior` de la table `data/weapons.ts` correspond à une
 * fonction de tir ici. Ajouter une arme qui réutilise un comportement existant ne demande
 * aucune ligne de code – seulement une entrée dans la table.
 */

const spriteCache = new Map<string, SpriteSet>();

function sprite(def: WeaponDef): SpriteSet {
  const key = `${def.sprite}:${def.color}`;
  let s = spriteCache.get(key);
  if (!s) {
    s = makeProjSprite(def.sprite, def.color);
    spriteCache.set(key, s);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Statistiques effectives d'une arme
// ---------------------------------------------------------------------------

const upTo = (levels: number[], level: number): number => {
  let n = 0;
  for (const l of levels) if (l <= level) n++;
  return n;
};

export function damageOf(inst: WeaponInstance, pl: Player): number {
  const d = inst.def;
  return d.damage * (1 + (inst.level - 1) * d.dmgPerLevel) * pl.stats.might;
}

export function cooldownOf(inst: WeaponInstance, pl: Player): number {
  const d = inst.def;
  return Math.max(0.05, d.cooldown * Math.pow(d.cdPerLevel, inst.level - 1) * pl.stats.cooldown);
}

/** `globalAmount` : les armes de zone (aura, mêlée, traînée) ignorent le bonus de projectiles. */
export function countOf(inst: WeaponInstance, pl: Player, globalAmount = true): number {
  const d = inst.def;
  const n = d.count + upTo(d.countAt, inst.level) + (globalAmount ? pl.stats.amount : 0);
  return Math.max(1, Math.round(n));
}

export function areaOf(inst: WeaponInstance, pl: Player): number {
  const d = inst.def;
  return d.area * (1 + upTo(d.areaAt, inst.level) * 0.15) * pl.stats.area;
}

export function pierceOf(inst: WeaponInstance, pl: Player): number {
  const d = inst.def;
  return d.pierce + upTo(d.pierceAt, inst.level) + pl.stats.pierce;
}

export function durationOf(inst: WeaponInstance, pl: Player): number {
  return inst.def.duration * pl.stats.duration;
}

export function speedOf(inst: WeaponInstance, pl: Player): number {
  return inst.def.speed * pl.stats.projSpeed;
}

// ---------------------------------------------------------------------------
// Boucle principale des armes
// ---------------------------------------------------------------------------

export function updateWeapons(w: World, dt: number): void {
  const pl = w.player;

  for (const inst of pl.weapons) {
    // Les rafales en cours ont priorité sur la recharge principale.
    if (inst.burstLeft > 0) {
      inst.burst -= dt;
      if (inst.burst <= 0) {
        fireBurstShot(w, inst);
        inst.burstLeft--;
        inst.burst = 0.07;
      }
      continue;
    }

    inst.cd -= dt;
    if (inst.cd > 0) continue;
    inst.cd = cooldownOf(inst, pl);
    fire(w, inst);
  }

  // Orbe Fracturé : nova gratuite périodique, indépendante des armes équipées.
  const novaEvery = pl.flag('freeNova');
  if (novaEvery > 0) {
    pl.novaTimer -= dt;
    if (pl.novaTimer <= 0) {
      pl.novaTimer = novaEvery;
      freeNova(w);
    }
  }
}

function freeNova(w: World): void {
  const pl = w.player;
  const dmg = 30 * pl.stats.might;
  const radius = 70 * pl.stats.area;
  audio.play('nova');
  w.particles.ring(pl.x, pl.y, radius, '#a855f7', 0.5, 2);
  const n = w.grid.query(pl.x, pl.y, radius);
  for (let i = 0; i < n; i++) {
    const e = w.enemies[w.grid.result[i]!];
    if (!e?.active || e.dying > 0) continue;
    if (dist2(pl.x, pl.y, e.x, e.y) > radius * radius) continue;
    w.damageEnemy(e, dmg, e.x - pl.x, e.y - pl.y, 60, true);
  }
}

// ---------------------------------------------------------------------------
// Distribution par comportement
// ---------------------------------------------------------------------------

function fire(w: World, inst: WeaponInstance): void {
  switch (inst.def.behavior) {
    case 'projectile': fireProjectile(w, inst); break;
    case 'boomerang': fireBoomerang(w, inst); break;
    case 'orbitFar': maintainOrbit(w, inst, true); break;
    case 'aura': fireAura(w, inst); break;
    case 'lob': fireLob(w, inst); break;
    case 'orbit': maintainOrbit(w, inst, false); break;
    case 'melee': fireMelee(w, inst); break;
    case 'strike': fireStrike(w, inst); break;
    case 'nova': fireNova(w, inst); break;
    case 'pet': maintainPets(w, inst); break;
    case 'trail': fireTrail(w, inst); break;
    case 'reactive': break; // déclenché depuis `World.onPlayerHit`
    case 'cone': fireCone(w, inst); break;
    case 'burst': startBurst(w, inst); break;
    case 'flail': maintainFlail(w, inst); break;
    case 'ground': fireGround(w, inst); break;
    case 'bounce': fireBounce(w, inst); break;
    case 'spikes': fireSpikes(w, inst); break;
    case 'shockwave': fireShockwave(w, inst); break;
  }
}

/** Angle vers l'ennemi le plus proche, ou direction du regard à défaut. */
function aimAngle(w: World, x: number, y: number): number {
  const target = w.nearestEnemy(x, y, 400);
  if (target) return Math.atan2(target.y - y, target.x - x);
  const pl = w.player;
  return pl.facingX === 0 && pl.facingY === 0 ? fxRng.angle() : pl.facingAngle;
}

/** Compte les projectiles persistants encore vivants pour cette arme. */
function countActive(w: World, srcId: number): number {
  let n = 0;
  for (const p of w.projectiles) if (p.active && p.srcId === srcId) n++;
  return n;
}

// ------------------------------------------------------------------ tir direct

function fireProjectile(w: World, inst: WeaponInstance): void {
  const pl = w.player;
  const d = inst.def;
  const n = countOf(inst, pl);
  const base = aimAngle(w, pl.x, pl.y);
  const speed = speedOf(inst, pl);
  const dmg = damageOf(inst, pl);
  const pierce = pierceOf(inst, pl);
  const spread = d.tags?.includes('spread') ? 0.16 : 0.1;

  for (let i = 0; i < n; i++) {
    // Éventail centré : (i - (n-1)/2) donne un décalage symétrique autour de la visée.
    const a = base + (i - (n - 1) / 2) * spread;
    const p = w.spawnProjectile(
      'linear', pl.x, pl.y, Math.cos(a) * speed, Math.sin(a) * speed,
      dmg, d.area * pl.stats.area, durationOf(inst, pl), pierce,
      sprite(d), d.color, d.id, d.tags ?? [], d.knockback, inst.srcId,
    );
    if (p) p.angle = a;
  }
  audio.play(d.sfx);
}

function startBurst(w: World, inst: WeaponInstance): void {
  inst.burstLeft = countOf(inst, w.player);
  inst.burst = 0;
}

function fireBurstShot(w: World, inst: WeaponInstance): void {
  const pl = w.player;
  const d = inst.def;
  const a = aimAngle(w, pl.x, pl.y) + fxRng.spread(0.09);
  const speed = speedOf(inst, pl);
  const p = w.spawnProjectile(
    'linear', pl.x, pl.y, Math.cos(a) * speed, Math.sin(a) * speed,
    damageOf(inst, pl), d.area * pl.stats.area, durationOf(inst, pl), pierceOf(inst, pl),
    sprite(d), d.color, d.id, d.tags ?? [], d.knockback, inst.srcId,
  );
  if (p) p.angle = a;
  audio.play(d.sfx, 1 + fxRng.spread(0.08));
}

function fireBoomerang(w: World, inst: WeaponInstance): void {
  const pl = w.player;
  const d = inst.def;
  const n = countOf(inst, pl);
  const base = aimAngle(w, pl.x, pl.y);
  const speed = speedOf(inst, pl);

  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * 0.5;
    const p = w.spawnProjectile(
      'boomerang', pl.x, pl.y, Math.cos(a) * speed, Math.sin(a) * speed,
      damageOf(inst, pl), areaOf(inst, pl), durationOf(inst, pl), 99,
      sprite(d), d.color, d.id, d.tags ?? [], d.knockback, inst.srcId,
    );
    if (p) {
      p.spin = 9;
      p.tick = 0.4;
    }
  }
  audio.play(d.sfx);
}

function fireNova(w: World, inst: WeaponInstance): void {
  const pl = w.player;
  const d = inst.def;
  const n = countOf(inst, pl);
  const speed = speedOf(inst, pl);
  const offset = fxRng.angle();

  for (let i = 0; i < n; i++) {
    const a = offset + (i / n) * TAU;
    const p = w.spawnProjectile(
      'linear', pl.x, pl.y, Math.cos(a) * speed, Math.sin(a) * speed,
      damageOf(inst, pl), d.area * pl.stats.area, durationOf(inst, pl), pierceOf(inst, pl),
      sprite(d), d.color, d.id, d.tags ?? [], d.knockback, inst.srcId,
    );
    if (p) {
      p.angle = a;
      p.spin = 12;
    }
  }
  audio.play(d.sfx);
  w.particles.ring(pl.x, pl.y, 20, d.color, 0.25, 1);
}

function fireBounce(w: World, inst: WeaponInstance): void {
  const pl = w.player;
  const d = inst.def;
  const n = countOf(inst, pl);
  const speed = speedOf(inst, pl);
  const base = aimAngle(w, pl.x, pl.y);

  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * 0.7;
    const p = w.spawnProjectile(
      'bounce', pl.x, pl.y, Math.cos(a) * speed, Math.sin(a) * speed,
      damageOf(inst, pl), d.area * pl.stats.area, durationOf(inst, pl), pierceOf(inst, pl),
      sprite(d), d.color, d.id, d.tags ?? [], d.knockback, inst.srcId,
    );
    if (p) {
      p.angle = a;
      p.spin = 16;
    }
  }
  audio.play(d.sfx);
}

// ------------------------------------------------------------------- zones

function fireAura(w: World, inst: WeaponInstance): void {
  const pl = w.player;
  const d = inst.def;
  const radius = areaOf(inst, pl);
  const dmg = damageOf(inst, pl);
  const poison = d.tags?.includes('poison');

  const n = w.grid.query(pl.x, pl.y, radius);
  let touched = 0;
  for (let i = 0; i < n; i++) {
    const e = w.enemies[w.grid.result[i]!];
    if (!e?.active || e.dying > 0) continue;
    const rr = radius + e.radius;
    if (dist2(pl.x, pl.y, e.x, e.y) > rr * rr) continue;
    touched++;
    w.damageEnemy(e, dmg, e.x - pl.x, e.y - pl.y, d.knockback, touched > 3);
    if (poison) {
      e.poison = Math.max(e.poison, 3);
      e.poisonDps = Math.max(e.poisonDps, dmg * 0.4);
    }
  }
  if (touched > 0) audio.play(d.sfx);
}

function fireLob(w: World, inst: WeaponInstance): void {
  const pl = w.player;
  const d = inst.def;
  const n = countOf(inst, pl);
  const radius = areaOf(inst, pl);
  const dmg = damageOf(inst, pl);
  const life = durationOf(inst, pl);

  for (let i = 0; i < n; i++) {
    // Vise un ennemi au hasard s'il y en a, sinon un point autour du joueur.
    const target = w.randomEnemy(pl.x, pl.y, 200);
    const tx = target ? target.x : pl.x + fxRng.spread(90);
    const ty = target ? target.y : pl.y + fxRng.spread(70);
    const dx = tx - pl.x;
    const dy = ty - pl.y;
    const dist = Math.hypot(dx, dy) || 1;
    const flight = Math.min(1.1, dist / (d.speed * pl.stats.projSpeed));

    const p = w.spawnProjectile(
      'lob', pl.x, pl.y, dx / flight, dy / flight,
      0, 4, flight, 99,
      sprite(d), d.color, d.id, d.tags ?? [], 0, inst.srcId,
    );
    if (p) {
      p.spin = 7;
      p.zoneRadius = radius;
      p.zoneDamage = dmg;
      p.zoneLife = life;
    }
  }
  audio.play(d.sfx);
}

function fireGround(w: World, inst: WeaponInstance): void {
  const pl = w.player;
  const d = inst.def;
  const n = countOf(inst, pl);
  const radius = areaOf(inst, pl);

  for (let i = 0; i < n; i++) {
    const a = fxRng.angle();
    const r = fxRng.range(20, 70);
    w.spawnZone(
      pl.x + Math.cos(a) * r, pl.y + Math.sin(a) * r * 0.75,
      radius, damageOf(inst, pl), durationOf(inst, pl),
      d.color, inst.srcId, 0.4, d.tags?.includes('grow') ?? false,
    );
  }
  audio.play(d.sfx);
}

function fireTrail(w: World, inst: WeaponInstance): void {
  const pl = w.player;
  const d = inst.def;
  // Ne dépose que si le joueur bouge – sinon on empile des zones au même endroit.
  if (!pl.moving) return;
  w.spawnZone(
    pl.x, pl.y, areaOf(inst, pl), damageOf(inst, pl), durationOf(inst, pl),
    d.color, inst.srcId, 0.3, false,
  );
}

// ------------------------------------------------------------- persistants

function maintainOrbit(w: World, inst: WeaponInstance, far: boolean): void {
  const pl = w.player;
  const d = inst.def;
  const want = countOf(inst, pl);
  const have = countActive(w, inst.srcId);
  if (have >= want) return;

  const radius = far ? areaOf(inst, pl) : areaOf(inst, pl);
  const dual = d.tags?.includes('dualRing') ?? false;

  for (let i = have; i < want; i++) {
    const ring = dual && i % 2 === 1 ? -1 : 1;
    const p = w.spawnProjectile(
      far ? 'orbit' : 'orbit', pl.x, pl.y, 0, 0,
      damageOf(inst, pl), d.area * pl.stats.area + 2, 999, 99,
      sprite(d), d.color, d.id, d.tags ?? [], d.knockback, inst.srcId,
    );
    if (!p) break;
    p.a = radius * (dual && ring < 0 ? 0.62 : 1);
    p.b = d.speed * ring; // vitesse angulaire signée : anneaux contrarotatifs
    p.c = (i / want) * TAU;
    p.spin = 6;
    p.tick = 0.5;
  }
}

function maintainFlail(w: World, inst: WeaponInstance): void {
  const pl = w.player;
  const d = inst.def;
  const want = countOf(inst, pl);
  const have = countActive(w, inst.srcId);
  if (have >= want) return;

  for (let i = have; i < want; i++) {
    const p = w.spawnProjectile(
      'flail', pl.x, pl.y, 0, 0,
      damageOf(inst, pl), d.area * pl.stats.area * 0.35, 999, 99,
      sprite(d), d.color, d.id, d.tags ?? [], d.knockback, inst.srcId,
    );
    if (!p) break;
    p.a = areaOf(inst, pl);
    p.b = d.speed;
    p.c = (i / want) * TAU;
    p.spin = 14;
    p.tick = 0.3;
  }
}

function maintainPets(w: World, inst: WeaponInstance): void {
  const pl = w.player;
  const d = inst.def;
  const want = countOf(inst, pl);
  const have = countActive(w, inst.srcId);
  if (have >= want) return;

  for (let i = have; i < want; i++) {
    const a = fxRng.angle();
    const p = w.spawnProjectile(
      'pet', pl.x + Math.cos(a) * 20, pl.y + Math.sin(a) * 20, 0, 0,
      damageOf(inst, pl), areaOf(inst, pl), 999, 99,
      sprite(d), d.color, d.id, d.tags ?? [], d.knockback, inst.srcId,
    );
    if (!p) break;
    p.a = speedOf(inst, pl); // vitesse de croisière du familier
    p.tick = 0.4;
  }
}

// ------------------------------------------------------------------ mêlée

function fireMelee(w: World, inst: WeaponInstance): void {
  const pl = w.player;
  const d = inst.def;
  const radius = areaOf(inst, pl);
  const full = d.tags?.includes('full360') ?? false;

  const spawnArc = (angle: number): void => {
    const off = full ? 0 : radius * 0.55;
    const p = w.spawnProjectile(
      'melee', pl.x, pl.y, 0, 0,
      damageOf(inst, pl), full ? radius : radius * 0.75, durationOf(inst, pl), 99,
      sprite(d), d.color, d.id, d.tags ?? [], d.knockback, inst.srcId,
    );
    if (!p) return;
    p.anchored = true;
    p.a = Math.cos(angle) * off;
    p.b = Math.sin(angle) * off * 0.8;
    p.angle = angle;
    p.tick = 0.2;
  };

  const n = countOf(inst, pl, false);
  const base = pl.facingX === 0 && pl.facingY === 0 ? 0 : pl.facingAngle;
  if (full) {
    spawnArc(0);
  } else {
    for (let i = 0; i < n; i++) spawnArc(base + (i * TAU) / n);
  }

  audio.play(d.sfx);
  w.particles.ring(pl.x, pl.y, radius * 0.8, d.color, 0.2, 1);

  // Moisson : soigne tous les 15 ennemis abattus.
  if (d.tags?.includes('lifeOnKill') && pl.killStreak >= 15) {
    pl.killStreak -= 15;
    const healed = pl.heal(1);
    if (healed > 0) w.particles.label(pl.x, pl.y - 14, '+1', P.bloodHi);
  }
}

function fireCone(w: World, inst: WeaponInstance): void {
  const pl = w.player;
  const d = inst.def;
  const n = countOf(inst, pl, false);
  const base = pl.facingX === 0 && pl.facingY === 0 ? fxRng.angle() : pl.facingAngle;

  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * 1.2;
    const p = w.spawnProjectile(
      'wave', pl.x, pl.y, Math.cos(a) * 55, Math.sin(a) * 45,
      damageOf(inst, pl), areaOf(inst, pl) * 0.5, durationOf(inst, pl), 99,
      sprite(d), d.color, d.id, d.tags ?? [], d.knockback, inst.srcId,
    );
    if (p) p.tick = 0.3;
  }
  audio.play(d.sfx);
}

function fireShockwave(w: World, inst: WeaponInstance): void {
  const pl = w.player;
  const d = inst.def;
  const n = countOf(inst, pl, false);
  const radius = areaOf(inst, pl);

  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + fxRng.spread(0.3);
    const p = w.spawnProjectile(
      'wave', pl.x, pl.y, Math.cos(a) * speedOf(inst, pl), Math.sin(a) * speedOf(inst, pl) * 0.8,
      damageOf(inst, pl), radius * 0.45, durationOf(inst, pl), 99,
      sprite(d), d.color, d.id, d.tags ?? [], d.knockback, inst.srcId,
    );
    if (p) p.tick = 0.25;
  }
  w.particles.ring(pl.x, pl.y, radius, d.color, 0.4, 2);
  audio.play(d.sfx);

  // Appel de la Meute : trois loups spectraux qui chassent pour vous.
  if (d.tags?.includes('summonWolves')) {
    for (let i = 0; i < 3; i++) {
      const a = fxRng.angle();
      const p = w.spawnProjectile(
        'pet', pl.x + Math.cos(a) * 24, pl.y + Math.sin(a) * 24, 0, 0,
        damageOf(inst, pl) * 0.8, 8, 6, 99,
        sprite(d), P.copper, d.id, [], d.knockback, inst.srcId,
      );
      if (p) {
        p.a = 200;
        p.tick = 0.35;
      }
    }
  }
}

function fireSpikes(w: World, inst: WeaponInstance): void {
  const pl = w.player;
  const d = inst.def;
  const n = countOf(inst, pl);
  const radius = areaOf(inst, pl);
  const waves = d.tags?.includes('waves') ? 3 : 1;

  for (let wv = 0; wv < waves; wv++) {
    const ringR = radius * (waves === 1 ? 1 : 0.45 + wv * 0.35);
    const offset = fxRng.angle();
    for (let i = 0; i < n; i++) {
      const a = offset + (i / n) * TAU;
      const p = w.spawnProjectile(
        'spike',
        pl.x + Math.cos(a) * ringR, pl.y + Math.sin(a) * ringR * 0.75, 0, 0,
        damageOf(inst, pl), d.area * pl.stats.area * 0.22 + 5,
        durationOf(inst, pl) + wv * 0.12, 99,
        sprite(d), d.color, d.id, d.tags ?? [], d.knockback, inst.srcId,
      );
      if (p) p.tick = 0.3;
    }
  }
  audio.play(d.sfx);
}

function fireStrike(w: World, inst: WeaponInstance): void {
  const pl = w.player;
  const d = inst.def;
  const n = countOf(inst, pl);
  const radius = areaOf(inst, pl);
  let struck = 0;

  for (let i = 0; i < n; i++) {
    const target = w.randomEnemy(pl.x, pl.y, 260);
    const x = target ? target.x : pl.x + fxRng.spread(120);
    const y = target ? target.y : pl.y + fxRng.spread(90);
    const p = w.spawnProjectile(
      'strike', x, y, 0, 0,
      damageOf(inst, pl), radius, durationOf(inst, pl), 99,
      sprite(d), d.color, d.id, d.tags ?? [], d.knockback, inst.srcId,
    );
    if (p) p.tick = 0.5;
    w.particles.sparks(x, y, -Math.PI / 2, 5, P.spark, 0.6);
    w.particles.beam(x, y, d.color, 0.28);
    struck++;
  }
  if (struck > 0) audio.play(d.sfx);
}

/** Utilisé par le rendu : un projectile de mêlée doit s'orienter selon son angle. */
export function isOriented(p: Projectile): boolean {
  return p.behavior === 'linear' || p.behavior === 'pet' || p.behavior === 'bounce' || p.behavior === 'melee';
}
