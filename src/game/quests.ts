import { audio } from '../audio/audio';
import { PURGE_QUEST, QUESTS, type QuestDef, type QuestReward, type QuestStep } from '../data/quests';
import { RANG_BY_ID } from '../data/waves';
import { t } from '../i18n';
import { P } from '../gfx/palette';
import type { SiteInfo } from './sites';
import type { Enemy } from './types';
import type { World } from './world';

/** Le héros est arrivé : assez large pour qu'un point dans une foule se valide sans danse. */
const ARRIVAL = 56;
/** Rayon de recherche des lieux : le premier anneau de villages et le château y tiennent toujours. */
const SEARCH = 9000;
/** Le phare n'a d'intérêt qu'à portée d'yeux. */
const BEACON_RANGE = 560;
const BEACON_EVERY = 3;
const QUEST_GOLD = 250;
/** Part des PV max rendue par une récompense de soin. */
const QUEST_HEAL = 0.5;

export interface QuestSave {
  index: number;
  step: number;
  progress: number;
  sites: Partial<Record<QuestDef['place'], string>>;
  visited: string[];
}

export interface QuestView {
  title: string;
  goal: string;
  /** Vide tant qu'il n'y a rien à compter. */
  count: string;
  /** Distance au but, en mètres ; 0 une fois sur place. */
  metres: number;
}

/** Le suivi de la trame pendant une partie. `data/quests.ts` dit quoi, cette classe dit quand. */
export class QuestLog {
  private index = 0;
  private step = 0;
  private progress = 0;
  private sites: QuestSave['sites'] = {};
  private readonly visited = new Set<string>();
  private guardian: Enemy | null = null;
  private beacon = 0;
  private started = false;
  /** Le but courant, lu par le rendu et la minimap. */
  target: { x: number; y: number } | null = null;

  private get quest(): QuestDef {
    return QUESTS[this.index] ?? PURGE_QUEST;
  }

  private get current(): QuestStep {
    return this.quest.steps[this.step]!;
  }

  private siteOf(w: World): SiteInfo | null {
    const place = this.quest.place;
    const known = this.sites[place];
    if (known) {
      const info = w.terrain.sites.byId(known);
      if (info) return info;
    }
    const { x, y } = w.player;
    const free = (s: SiteInfo): boolean => s.kind === place && !this.visited.has(s.id);
    // Autour du héros d'abord, puis autour du départ : c'est là que la trame pose ses premiers lieux,
    // et le héros a pu s'en éloigner de bien plus que ce rayon.
    const found = w.terrain.sites.list(x, y, SEARCH).find(free) ?? w.terrain.sites.list(0, 0, SEARCH * 2).find(free);
    if (found) this.sites[place] = found.id;
    return found ?? null;
  }

  private pointOf(site: SiteInfo): { x: number; y: number } {
    return site.points.find((p) => p.id === this.current.point) ?? site.entrance;
  }

  update(w: World, dt: number): void {
    const site = this.siteOf(w);
    if (!site) {
      this.target = null;
      // Un lieu introuvable ne doit pas bloquer la trame : la quête suivante prend le relais.
      if (QUESTS[this.index]) {
        this.index++;
        this.step = 0;
        this.progress = 0;
      }
      return;
    }
    if (!this.started) {
      this.started = true;
      w.announce(this.quest.title(site.name), this.quest.intro, 4, true);
    }
    const step = this.current;
    const point = this.pointOf(site);
    this.target = point;

    const pl = w.player;
    const here = Math.hypot(point.x - pl.x, point.y - pl.y) < ARRIVAL;
    this.beacon -= dt;
    if (this.beacon <= 0 && Math.hypot(point.x - pl.x, point.y - pl.y) < BEACON_RANGE) {
      this.beacon = BEACON_EVERY;
      w.vfx.beam(point.x, point.y, P.gold);
    }

    if (step.guardian) {
      if (!this.guardian) {
        if (!here) return;
        const rank = RANG_BY_ID.get(step.guardian.rank) ?? null;
        this.guardian = w.spawnEnemy(step.guardian.enemy, point.x, point.y - ARRIVAL, false, rank);
        audio.play('boss');
      } else if (!this.guardian.active || this.guardian.dying > 0) {
        this.guardian = null;
        this.advance(w, site);
      }
      return;
    }
    if (step.slay) {
      if (this.progress >= step.slay) this.advance(w, site);
      return;
    }
    if (here) this.advance(w, site);
  }

  /** Seules comptent les morts dans le lieu : la quête attire vers lui, pas n'importe où. */
  onKill(w: World, e: Enemy): void {
    const step = this.current;
    if (!step.slay || e.def.decor) return;
    const site = this.sites[this.quest.place];
    const info = site ? w.terrain.sites.byId(site) : null;
    if (!info) return;
    const b = info.bounds;
    if (e.x >= b.x && e.y >= b.y && e.x <= b.x + b.w && e.y <= b.y + b.h) this.progress++;
  }

  private advance(w: World, site: SiteInfo): void {
    this.progress = 0;
    this.step++;
    this.beacon = 0;
    if (this.step < this.quest.steps.length) {
      audio.play('confirm');
      return;
    }

    const done = this.quest;
    w.announce(t('Quête accomplie', 'Quest complete'), done.title(site.name), 3, true);
    audio.play('relic');
    w.vfx.beam(0, 0, P.gold, w.player);
    for (const reward of done.rewards) this.grant(w, reward);

    if (done === PURGE_QUEST || done.id === 'church') this.visited.add(site.id);
    this.step = 0;
    this.index++;
    // Un même village porte toute sa trame ; une purge en cherche un autre, encore debout.
    if (this.quest === PURGE_QUEST) delete this.sites.village;
    this.started = false;
  }

  private grant(w: World, reward: QuestReward): void {
    const { x, y } = w.player;
    switch (reward) {
      case 'chest': w.spawnPickup('chest', x + 18, y + 6, 0); break;
      case 'relic': w.dropRelic(x - 18, y + 6); break;
      case 'gold': w.spawnPickup('gold', x, y + 18, QUEST_GOLD); break;
      case 'heal': w.player.hp = Math.min(w.player.stats.maxHp, w.player.hp + w.player.stats.maxHp * QUEST_HEAL); break;
    }
  }

  /** Ce que le HUD affiche. `null` tant qu'aucun lieu n'est connu. */
  view(w: World): QuestView | null {
    const site = this.siteOf(w);
    if (!site || !this.target) return null;
    const step = this.current;
    const pl = w.player;
    const metres = Math.round(Math.hypot(this.target.x - pl.x, this.target.y - pl.y) / 10);
    return {
      title: this.quest.title(site.name),
      goal: step.goal(site.name),
      count: step.slay ? `${Math.min(this.progress, step.slay)} / ${step.slay}` : '',
      metres: metres * 10 < ARRIVAL ? 0 : metres,
    };
  }

  serialize(): QuestSave {
    return { index: this.index, step: this.step, progress: this.progress, sites: { ...this.sites }, visited: [...this.visited] };
  }

  restore(d: QuestSave): void {
    this.index = d.index;
    this.step = d.step;
    this.progress = d.progress;
    this.sites = { ...d.sites };
    this.visited.clear();
    for (const id of d.visited) this.visited.add(id);
    this.started = true;
  }
}
