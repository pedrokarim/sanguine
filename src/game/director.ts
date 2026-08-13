import { TAU } from '../core/math';
import { audio } from '../audio/audio';
import { ENEMIES } from '../data/enemies';
import {
  spawnRate, spawnCap, rangChances, RANG_BY_ID, WAVE_EVENTS, type WaveEvent, type Rang,
  RODEURS, RODEUR_DEBUT, RODEUR_ECART, RODEUR_CHANCE, RODEUR_MAX, BOSS_MAX_SIMULTANES,
  PLAFOND_DUR,
} from '../data/waves';
import type { World } from './world';

/**
 * Director : décide **quoi** faire apparaître et **quand**.
 *
 * Deux mécanismes cohabitent :
 *   – un flux continu, dont le débit suit une courbe et dont la composition dépend de la
 *     minute courante ;
 *   – des événements scriptés (nuées, meutes, boss) qui cassent la routine.
 */

/** Minute à laquelle la Faucheuse arrive si le boss final n'est pas tombé. */
const REAPER_MINUTE = 32;

/**
 * Secondes de saturation continue avant que la Faucheuse ne soit appelée.
 *
 * Assez long pour qu'une Déferlante ou un pic de vague ne la déclenche pas — ces moments
 * doivent pouvoir être encaissés —, assez court pour qu'un joueur définitivement débordé ne
 * reste pas une minute à tourner dans une mêlée qu'il ne peut plus réduire.
 */
const SATURATION_LIMITE = 26;

export class Director {
  private accum = 0;
  private firedEvents = new Set<number>();
  private reaperSpawned = false;
  /** Compte à rebours avant le prochain tirage de rôdeur. */
  private rodeurTimer = RODEUR_ECART;
  private rodeurs = 0;
  /** Temps passé au contact du plafond de population, en secondes. */
  private saturation = 0;
  private satAvertie = false;
  /** Poids d'apparition recalculés une fois par minute, pas à chaque spawn. */
  private weights: number[] = [];
  private weightsMinute = -1;

  /** État à conserver pour reprendre une partie interrompue. */
  serialize(): { events: number[]; reaper: boolean } {
    return { events: [...this.firedEvents], reaper: this.reaperSpawned };
  }

  /**
   * Restaure les événements déjà déclenchés. Sans cela, une reprise à la 20ᵉ minute
   * rejouerait d'un coup toutes les vagues scriptées et les quatre boss.
   */
  restore(data: { events: number[]; reaper: boolean }): void {
    this.firedEvents = new Set(data.events);
    this.reaperSpawned = data.reaper;
  }

  reset(): void {
    this.accum = 0;
    this.rodeurTimer = RODEUR_ECART;
    this.rodeurs = 0;
    this.saturation = 0;
    this.satAvertie = false;
    this.firedEvents.clear();
    this.reaperSpawned = false;
    this.weightsMinute = -1;
  }

  update(w: World, dt: number): void {
    const m = w.minute;

    this.runEvents(w, m);
    this.runRodeurs(w, m, dt);
    this.runReaper(w, m);

    const alive = w.aliveEnemies;
    this.runSaturation(w, alive, dt);
    if (alive >= spawnCap(m)) return;

    /*
     * Un village majore la pression de 40 % à son centre.
     *
     * C'est ce qui le rend **dangereux autant que désirable**. S'il n'offrait qu'un décor,
     * on le contournerait ; s'il n'offrait que du danger, on le fuirait.
     */
    const vil = 1 + w.terrain.villageForce(w.player.x, w.player.y) * 0.4;
    this.accum += spawnRate(m) * w.surgeMult * vil * dt;
    // Plafond par frame : évite un pic de 300 spawns après un ralenti ou un onglet en fond.
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
      // Le biome infléchit la composition : traverser le cimetière ou le marais ne
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
    const rang = this.tirerRang(w, m);

    if (def.cluster && def.cluster > 1) {
      // Les araignées arrivent en grappe serrée : une seule direction, plusieurs corps.
      // Le rang ne va qu'à la meneuse : une grappe entière de colosses ne se contourne plus.
      const a = w.rng.angle();
      for (let i = 0; i < def.cluster; i++) {
        const e = w.spawnOffscreen(def.id, a + w.rng.spread(0.25), false, i === 0 ? rang : null);
        if (e) {
          e.x += w.rng.spread(22);
          e.y += w.rng.spread(18);
        }
      }
    } else {
      w.spawnOffscreen(def.id, undefined, false, rang);
    }
  }

  /**
   * Tire un rang de résistance, du plus rare au plus commun.
   *
   * L'ordre compte : comparer un tirage unique aux trois seuils l'un après l'autre donnerait
   * au colosse la fréquence de l'endurci, puisque le premier seuil franchi l'emporterait.
   */
  private tirerRang(w: World, m: number): Rang | null {
    const c = rangChances(m);
    if (w.rng.chance(c.colosse)) return RANG_BY_ID.get('colosse') ?? null;
    if (w.rng.chance(c.elite)) return RANG_BY_ID.get('elite') ?? null;
    if (w.rng.chance(c.endurci)) return RANG_BY_ID.get('endurci') ?? null;
    return null;
  }

  /** Boss debout à cet instant, toutes provenances confondues. */
  private bossVivants(w: World): number {
    return w.bossGroup.filter((b) => b.active && b.dying <= 0).length;
  }

  // ------------------------------------------------------------------ événements

  private runEvents(w: World, m: number): void {
    for (let i = 0; i < WAVE_EVENTS.length; i++) {
      const ev = WAVE_EVENTS[i]!;
      if (this.firedEvents.has(i) || m < ev.at) continue;
      /*
       * L'événement n'est marqué comme joué que s'il a effectivement levé quelque chose.
       * Un palier de boss qui tombe alors que trois corps sont déjà debout serait sinon
       * consommé sans rien produire, et le joueur ne le verrait jamais de la partie.
       */
      if (this.runEvent(w, ev)) this.firedEvents.add(i);
    }
  }

  /**
   * Tirage périodique d'un boss errant.
   *
   * Le tirage se fait sur le générateur de la partie, donc deux parties de même graine
   * voient les mêmes rôdeurs aux mêmes instants — la rejouabilité à la graine ne se perd
   * pas au profit d'une surprise.
   */
  private runRodeurs(w: World, m: number, dt: number): void {
    if (m < RODEUR_DEBUT || this.rodeurs >= RODEUR_MAX) return;
    this.rodeurTimer -= dt;
    if (this.rodeurTimer > 0) return;
    this.rodeurTimer = RODEUR_ECART;

    if (w.rng.next() > RODEUR_CHANCE) return;

    /*
     * Un rôdeur peut désormais s'ajouter à un boss déjà présent, mais jamais au-delà du
     * plafond simultané. La règle précédente — aucun rôdeur tant qu'un boss est debout —
     * les rendait presque introuvables une fois les événements scriptés rapprochés.
     */
    if (this.bossVivants(w) >= BOSS_MAX_SIMULTANES) return;

    const eligibles = RODEURS.filter((r) => m >= r.from);
    if (eligibles.length === 0) return;
    const choix = eligibles[w.rng.int(0, eligibles.length - 1)]!;

    const e = w.spawnOffscreen(choix.enemy);
    if (!e) return;
    this.rodeurs++;

    audio.play('boss');
    audio.setBossMode(true);
    w.announce(choix.label, 'rôde');
    w.cam.shake(0.3, true);
  }

  /** Rend `true` si l'événement a produit quelque chose ; `false` s'il doit être réessayé. */
  private runEvent(w: World, ev: WaveEvent): boolean {
    switch (ev.kind) {
      case 'boss': {
        /*
         * Un événement peut lever plusieurs corps. Ils sont répartis sur l'anneau
         * d'apparition à angles réguliers : levés au même endroit, ils se superposeraient
         * et se liraient comme un seul boss aux contours confus.
         */
        const voulus = Math.max(1, ev.count);
        const place = Math.max(0, BOSS_MAX_SIMULTANES - this.bossVivants(w));
        const combien = Math.min(voulus, place);
        if (combien === 0) return false;

        const base = w.rng.angle();
        const leves: typeof w.boss[] = [];
        for (let i = 0; i < combien; i++) {
          const e = w.spawnOffscreen(ev.enemy, base + (i / combien) * TAU);
          if (e) leves.push(e);
        }
        if (leves.length === 0) return false;

        audio.play('boss');
        audio.setBossMode(true);
        w.announce(ev.label, combien > 1 ? `${combien} approchent` : 'approche');
        w.slowMo(0.35, 1.0);
        w.cam.shake(0.45, true);

        // Le Chœur de Cendres est trois corps liés : tous doivent tomber. Ses points de vie
        // se divisent d'autant, sinon un Chœur triple vaudrait neuf barres de vie.
        if (ev.enemy === 'ashchoir') {
          for (const e of leves) {
            if (!e) continue;
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
        }
        break;
      }

      case 'ring': {
        // Cercle fermé : le joueur doit percer un flanc pour sortir.
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
        // Mur perpendiculaire à une direction : une ligne dense qui traverse l'écran.
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
        // Salves espacées : cinq groupes qui arrivent l'un après l'autre.
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
    // Tout autre événement produit toujours quelque chose.
    return true;
  }

  // ------------------------------------------------------------------ Faucheuse

  /**
   * Saturation de la horde.
   *
   * Le plafond de population protège l'appareil, et il n'est pas négociable. Mais s'y
   * cogner en silence est la pire des sanctions : le joueur voit le flux se tarir sans
   * comprendre pourquoi, et rien ne lui dit qu'il vient d'atteindre une limite. Un jeu ne
   * doit pas s'arrêter, il doit répondre.
   *
   * Le plafond en question est `PLAFOND_DUR`, la charge maximale de l'appareil — jamais la
   * courbe de rythme `spawnCap`, qui ne vaut que 268 à la troisième minute. La confusion
   * entre les deux envoyait la Faucheuse exécuter un débutant en difficulté dès la
   * troisième minute, mesuré au bot : une sanction pour avoir mal joué une ouverture.
   *
   * Tenir ce plafond pendant `SATURATION_LIMITE` secondes signifie une chose et une seule :
   * la horde arrive plus vite qu'elle n'est fauchée, et l'écart ne se refermera pas. La
   * Faucheuse vient alors le dire. Elle est invincible et tue au contact — elle n'existe
   * que pour cela. La contrainte technique devient la règle du monde, et le joueur reçoit
   * un adversaire là où il n'aurait eu qu'un plafond invisible.
   *
   * L'avertissement à mi-course n'est pas une politesse : sans lui, la sanction tomberait
   * sur une faute qu'on ne pouvait pas voir venir. Il laisse le temps de percer, de fuir,
   * ou de lâcher une bombe.
   */
  private runSaturation(w: World, alive: number, dt: number): void {
    if (this.reaperSpawned || w.state !== 'playing') return;

    if (alive >= PLAFOND_DUR * 0.96) {
      this.saturation += dt;
      if (!this.satAvertie && this.saturation > SATURATION_LIMITE * 0.45) {
        this.satAvertie = true;
        w.announce('LA HORDE DÉBORDE', 'quelque chose s\u2019approche');
        w.cam.shake(0.25, true);
        audio.play('boss');
      }
      if (this.saturation > SATURATION_LIMITE) this.leverFaucheuse(w, 'vous n\u2019avancez plus');
    } else {
      // On redescend deux fois plus lentement qu'on ne monte : une accalmie d'une seconde
      // ne doit pas effacer vingt secondes d'étranglement.
      this.saturation = Math.max(0, this.saturation - dt * 0.5);
      if (this.saturation === 0) this.satAvertie = false;
    }
  }

  // ------------------------------------------------------------------ Faucheuse

  private runReaper(w: World, m: number): void {
    if (m < REAPER_MINUTE) return;
    this.leverFaucheuse(w, 'le rideau tombe');
  }

  private leverFaucheuse(w: World, sous: string): void {
    if (this.reaperSpawned) return;
    // Si le joueur a déjà gagné, la Faucheuse n'a plus de raison d'être.
    if (w.state !== 'playing') return;
    this.reaperSpawned = true;
    w.spawnOffscreen('reaper');
    audio.play('boss');
    audio.setBossMode(true);
    w.announce('LA FAUCHEUSE', sous);
    w.cam.shake(0.5, true);
    w.slowMo(0.3, 1.2);
  }
}
