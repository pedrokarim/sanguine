import { TAU } from '../core/math';
import { audio } from '../audio/audio';
import { ENEMIES } from '../data/enemies';
import {
  spawnRate, spawnCap, eliteChance, WAVE_EVENTS, type WaveEvent,
} from '../data/waves';
import type { World } from './world';

/**
 * Director : décide **quoi** faire apparaître et **quand**.
 *
 * Deux mécanismes cohabitent :
 *   — un flux continu, dont le débit suit une courbe et dont la composition dépend de la
 *     minute courante ;
 *   — des événements scriptés (nuées, meutes, boss) qui cassent la routine.
 */

/** Minute à laquelle la Faucheuse arrive si le boss final n'est pas tombé. */
const REAPER_MINUTE = 32;

export class Director {
  private accum = 0;
  private firedEvents = new Set<number>();
  private reaperSpawned = false;
  /** Poids d'apparition recalculés une fois par minute, pas à chaque spawn. */
  private weights: number[] = [];
  private weightsMinute = -1;

  reset(): void {
    this.accum = 0;
    this.firedEvents.clear();
    this.reaperSpawned = false;
    this.weightsMinute = -1;
  }

  update(w: World, dt: number): void {
    const m = w.minute;

    this.runEvents(w, m);
    this.runReaper(w, m);

    const alive = w.aliveEnemies;
    if (alive >= spawnCap(m)) return;

    this.accum += spawnRate(m) * w.surgeMult * dt;
    // Plafond par frame : évite un pic de 300 spawns après un ralenti ou un onglet en fond.
    let budget = 24;
    while (this.accum >= 1 && budget-- > 0) {
      this.accum -= 1;
      this.spawnOne(w, m);
    }
    if (this.accum > 40) this.accum = 40;
  }

  // --------------------------------------------------------------- flux continu

  /** Biome pris en compte lors du dernier recalcul, pour invalider le cache au changement. */
  private weightsBiome = '';

  private refreshWeights(w: World, m: number): void {
    const minute = Math.floor(m);
    const biome = w.terrain.currentBiome;
    if (minute === this.weightsMinute && biome.id === this.weightsBiome) return;
    this.weightsMinute = minute;
    this.weightsBiome = biome.id;

    this.weights = ENEMIES.map((e) => {
      if (m < e.from) return 0;
      // Un ennemi devient plus fréquent pendant ~8 minutes après son introduction,
      // puis s'efface progressivement au profit des suivants.
      const age = m - e.from;
      const ramp = Math.min(1, age / 1.5);
      const decay = age > 10 ? Math.max(0.25, 1 - (age - 10) / 22) : 1;
      // Le biome infléchit la composition : traverser le cimetière ou le marais ne
      // ressemble pas à traverser la lande, même à la même minute.
      const biomeMul = biome.weights[e.id] ?? 1;
      return e.weight * ramp * decay * biomeMul;
    });
  }

  private spawnOne(w: World, m: number): void {
    this.refreshWeights(w, m);
    const idx = w.rng.weighted(this.weights);
    if (idx < 0) return;
    const def = ENEMIES[idx]!;
    const elite = w.rng.chance(eliteChance(m));

    if (def.cluster && def.cluster > 1) {
      // Les araignées arrivent en grappe serrée : une seule direction, plusieurs corps.
      const a = w.rng.angle();
      for (let i = 0; i < def.cluster; i++) {
        const e = w.spawnOffscreen(def.id, a + w.rng.spread(0.25), elite && i === 0);
        if (e) {
          e.x += w.rng.spread(22);
          e.y += w.rng.spread(18);
        }
      }
    } else {
      w.spawnOffscreen(def.id, undefined, elite);
    }
  }

  // ------------------------------------------------------------------ événements

  private runEvents(w: World, m: number): void {
    for (let i = 0; i < WAVE_EVENTS.length; i++) {
      const ev = WAVE_EVENTS[i]!;
      if (this.firedEvents.has(i) || m < ev.at) continue;
      this.firedEvents.add(i);
      this.runEvent(w, ev);
    }
  }

  private runEvent(w: World, ev: WaveEvent): void {
    switch (ev.kind) {
      case 'boss': {
        const e = w.spawnOffscreen(ev.enemy);
        if (!e) break;
        audio.play('boss');
        audio.setBossMode(true);
        w.announce(ev.label, 'approche');
        w.slowMo(0.35, 1.0);
        w.cam.shake(0.45, true);

        // Le Chœur de Cendres est trois corps liés : tous doivent tomber.
        if (ev.enemy === 'ashchoir') {
          e.maxHp = Math.round(e.maxHp / 3);
          e.hp = e.maxHp;
          for (let k = 0; k < 2; k++) {
            const extra = w.spawnEnemy('ashchoir', e.x + (k === 0 ? -40 : 40), e.y + 24);
            if (extra) {
              extra.maxHp = e.maxHp;
              extra.hp = e.maxHp;
            }
          }
        }
        break;
      }

      case 'ring': {
        // Cercle fermé : le joueur doit percer un flanc pour sortir.
        for (let i = 0; i < ev.count; i++) {
          w.spawnOffscreen(ev.enemy, (i / ev.count) * TAU);
        }
        w.announce(ev.label, '');
        break;
      }

      case 'flank': {
        const a = w.rng.angle();
        for (let i = 0; i < ev.count; i++) {
          w.spawnOffscreen(ev.enemy, a + w.rng.spread(0.5));
        }
        w.announce(ev.label, '');
        break;
      }

      case 'wall': {
        // Mur perpendiculaire à une direction : une ligne dense qui traverse l'écran.
        const a = w.rng.angle();
        const perp = a + Math.PI / 2;
        for (let i = 0; i < ev.count; i++) {
          const t = (i / (ev.count - 1) - 0.5) * 520;
          const e = w.spawnEnemy(
            ev.enemy,
            w.player.x + Math.cos(a) * 330 + Math.cos(perp) * t,
            w.player.y + Math.sin(a) * 260 + Math.sin(perp) * t * 0.75,
          );
          if (e) e.speed *= 1.25;
        }
        w.announce(ev.label, '');
        break;
      }

      case 'clusters': {
        for (let c = 0; c < ev.count; c++) {
          const a = w.rng.angle();
          for (let i = 0; i < 8; i++) {
            const e = w.spawnOffscreen(ev.enemy, a);
            if (e) {
              e.x += w.rng.spread(26);
              e.y += w.rng.spread(20);
            }
          }
        }
        w.announce(ev.label, '');
        break;
      }

      case 'column': {
        const a = w.rng.angle();
        for (let i = 0; i < ev.count; i++) {
          const r = 300 + i * 16;
          w.spawnEnemy(
            ev.enemy,
            w.player.x + Math.cos(a) * r,
            w.player.y + Math.sin(a) * r * 0.75,
          );
        }
        w.announce(ev.label, '');
        break;
      }

      case 'volleys': {
        // Salves espacées : cinq groupes qui arrivent l'un après l'autre.
        const groups = 5;
        for (let g = 0; g < groups; g++) {
          window.setTimeout(() => {
            if (w.state !== 'playing') return;
            const a = w.rng.angle();
            for (let i = 0; i < Math.ceil(ev.count / groups); i++) {
              w.spawnOffscreen(ev.enemy, a + w.rng.spread(0.35));
            }
          }, g * 900);
        }
        w.announce(ev.label, '');
        break;
      }

      case 'surge': {
        w.surgeMult = ev.mult ?? 3;
        w.surgeTimer = ev.duration ?? 60;
        w.announce(ev.label, 'tenez bon');
        w.cam.shake(0.3, true);
        break;
      }
    }
  }

  // ------------------------------------------------------------------ Faucheuse

  private runReaper(w: World, m: number): void {
    if (this.reaperSpawned || m < REAPER_MINUTE) return;
    // Si le joueur a déjà gagné, la Faucheuse n'a plus de raison d'être.
    if (w.state !== 'playing') return;
    this.reaperSpawned = true;
    w.spawnOffscreen('reaper');
    audio.play('boss');
    audio.setBossMode(true);
    w.announce('LA FAUCHEUSE', 'le rideau tombe');
    w.cam.shake(0.5, true);
    w.slowMo(0.3, 1.2);
  }
}
