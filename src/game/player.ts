import { clamp, TAU } from '../core/math';
import { load } from '../core/save';
import { makeHero, type SpriteSet } from '../gfx/sprites';
import { addMods, type Mods } from '../data/mods';
import { characterById, NO_REGEN_CHARS, type CharacterDef } from '../data/characters';
import { passiveById } from '../data/passives';
import { weaponById } from '../data/weapons';
import { RELIC_BY_ID, HALVES_HP, type RelicFlag } from '../data/relics';
import { META_BY_ID } from '../data/meta';
import { xpForLevel } from '../data/waves';
import type { Stats, WeaponInstance } from './types';

export const MAX_WEAPONS = 6;
export const MAX_PASSIVES = 6;

const BASE: Stats = {
  maxHp: 100,
  regen: 0,
  armor: 0,
  moveSpeed: 100,
  might: 1,
  area: 1,
  cooldown: 1,
  projSpeed: 1,
  duration: 1,
  amount: 0,
  pickupRadius: 60,
  luck: 1,
  growth: 1,
  greed: 1,
  crit: 0.05,
  lifesteal: 0,
  pierce: 0,
  revives: 0,
  rerolls: 0,
};

/** Durée d'invulnérabilité après un coup. Sans elle, entrer dans une masse tue instantanément. */
const IFRAME_TIME = 0.7;

export class Player {
  x = 0;
  y = 0;
  px = 0;
  py = 0;
  vx = 0;
  vy = 0;

  hp = 100;
  stats: Stats = { ...BASE };

  level = 1;
  xp = 0;
  xpNext = xpForLevel(1);

  weapons: WeaponInstance[] = [];
  /** `id de passif` → niveau. */
  passives = new Map<string, number>();
  relics: string[] = [];
  /** Effets spéciaux cumulés des reliques. */
  flags: Partial<Record<RelicFlag, number>> = {};

  char: CharacterDef;
  walkSprite: SpriteSet;
  idleSprite: SpriteSet;

  /** Invulnérabilité restante. */
  iframes = 0;
  hurtFlash = 0;
  anim = 0;
  facingX = 1;
  facingY = 0;
  moving = false;

  rerolls = 0;
  revivesLeft = 0;
  /** Cumul de morts pour Moisson (soin tous les 15 ennemis). */
  killStreak = 0;
  /** Nombre de coups portés, pour le Chapelet Brisé. */
  hitCount = 0;
  /** Minuterie de la nova gratuite de l'Orbe Fracturé. */
  novaTimer = 0;

  /**
   * Bonus temporaires accordés par les structures du monde (obélisque, bûcher…).
   * Ils vivent hors du recalcul de statistiques : ce sont des effets à durée, pas du build.
   */
  buffMight = 0;
  buffMightTimer = 0;
  buffSpeed = 0;
  buffSpeedTimer = 0;
  /** Cumul, seulement pour l'affichage de fin. */
  damageDealt = 0;

  private srcCounter = 100;

  constructor(charId: string) {
    this.char = characterById(charId);
    this.walkSprite = makeHero(`hero:${this.char.id}`, this.char.art, true);
    this.idleSprite = makeHero(`hero:${this.char.id}`, this.char.art, false);
    this.addWeapon(this.char.startWeapon);
    this.recompute();
    this.hp = this.stats.maxHp;
    this.rerolls = this.stats.rerolls;
    this.revivesLeft = this.stats.revives;
  }

  // ------------------------------------------------------------------ build

  get weaponIds(): string[] {
    return this.weapons.map((w) => w.def.id);
  }

  hasWeapon(id: string): boolean {
    return this.weapons.some((w) => w.def.id === id);
  }

  weapon(id: string): WeaponInstance | undefined {
    return this.weapons.find((w) => w.def.id === id);
  }

  passiveLevel(id: string): number {
    return this.passives.get(id) ?? 0;
  }

  addWeapon(id: string): WeaponInstance {
    const def = weaponById(id);
    const inst: WeaponInstance = {
      def,
      level: 1,
      cd: 0.25, // léger délai : évite que toutes les armes tirent à la même frame
      angle: 0,
      srcId: this.srcCounter++,
      counter: 0,
      burst: 0,
      burstLeft: 0,
    };
    this.weapons.push(inst);
    this.recompute();
    return inst;
  }

  levelUpWeapon(id: string): void {
    const w = this.weapon(id);
    if (w && w.level < w.def.maxLevel) w.level++;
    this.recompute();
  }

  /**
   * Remplace une arme par son évolution. L'emplacement est conservé, et l'identifiant de
   * source est renouvelé pour que les immunités persistantes repartent de zéro.
   */
  evolveWeapon(fromId: string, toId: string): void {
    const idx = this.weapons.findIndex((w) => w.def.id === fromId);
    if (idx < 0) return;
    this.weapons[idx] = {
      def: weaponById(toId),
      level: 1,
      cd: 0,
      angle: this.weapons[idx]!.angle,
      srcId: this.srcCounter++,
      counter: 0,
      burst: 0,
      burstLeft: 0,
    };
    this.recompute();
  }

  addPassive(id: string): void {
    const cur = this.passives.get(id) ?? 0;
    const def = passiveById(id);
    this.passives.set(id, Math.min(def.maxLevel, cur + 1));
    this.recompute();
  }

  addRelic(id: string): void {
    this.relics.push(id);
    this.recompute();
  }

  flag(f: RelicFlag): number {
    return this.flags[f] ?? 0;
  }

  // ------------------------------------------------------------ statistiques

  /**
   * Recalcule toutes les statistiques dérivées. Appelé uniquement lors d'un changement de
   * build — jamais dans la boucle de jeu.
   */
  recompute(): void {
    const m: Mods = {};

    addMods(m, this.char.mods);

    // Sanctuaire (méta-progression permanente)
    const sv = load();
    for (const [upId, lvl] of Object.entries(sv.sanctuary)) {
      const up = META_BY_ID.get(upId);
      if (up) addMods(m, up.perLevel, Math.min(lvl, up.levels));
    }

    for (const [pid, lvl] of this.passives) {
      addMods(m, passiveById(pid).perLevel, lvl);
    }

    this.flags = {};
    for (const rid of this.relics) {
      const r = RELIC_BY_ID.get(rid);
      if (!r) continue;
      addMods(m, r.mods);
      if (r.flags) {
        for (const [k, v] of Object.entries(r.flags)) {
          const key = k as RelicFlag;
          this.flags[key] = (this.flags[key] ?? 0) + (v as number);
        }
      }
    }

    const prevMax = this.stats.maxHp;
    const s = this.stats;

    s.maxHp = Math.max(1, BASE.maxHp + (m.maxHp ?? 0));
    if (this.relics.includes(HALVES_HP)) s.maxHp = Math.max(1, Math.round(s.maxHp / 2));

    s.regen = NO_REGEN_CHARS.has(this.char.id) || this.flag('noRegen') > 0 ? 0 : BASE.regen + (m.regen ?? 0);
    s.armor = BASE.armor + (m.armor ?? 0);
    s.moveSpeed = BASE.moveSpeed * (1 + (m.moveSpeed ?? 0));
    s.might = BASE.might + (m.might ?? 0);
    s.area = BASE.area + (m.area ?? 0);
    // Plancher à 0.4 : une arme sur-optimisée ne doit pas saturer la boucle de mise à jour.
    s.cooldown = clamp(BASE.cooldown - (m.cooldown ?? 0), 0.4, 2);
    s.projSpeed = Math.max(0.2, BASE.projSpeed + (m.projSpeed ?? 0));
    s.duration = Math.max(0.2, BASE.duration + (m.duration ?? 0));
    s.amount = BASE.amount + Math.floor(m.amount ?? 0);
    s.pickupRadius = BASE.pickupRadius * (1 + (m.pickup ?? 0));
    s.luck = BASE.luck + (m.luck ?? 0);
    s.growth = BASE.growth + (m.growth ?? 0);
    s.greed = BASE.greed + (m.greed ?? 0);
    s.crit = clamp(BASE.crit + (m.crit ?? 0), 0, 1);
    s.lifesteal = BASE.lifesteal + (m.lifesteal ?? 0);
    s.pierce = BASE.pierce + (m.pierce ?? 0) + this.flag('extraPierce');
    s.revives = BASE.revives + Math.floor(m.revives ?? 0) + (this.flag('lastBreath') > 0 ? 1 : 0);
    s.rerolls = BASE.rerolls + Math.floor(m.rerolls ?? 0);

    // Gagner des PV max soigne du même montant — sinon monter Cœur d'Argent en urgence
    // ne servirait à rien dans le feu de l'action.
    if (s.maxHp > prevMax) this.hp += s.maxHp - prevMax;
    this.hp = clamp(this.hp, 0, s.maxHp);
  }

  // ------------------------------------------------------------------ actions

  /** Retourne `true` si le joueur a réellement subi des dégâts. */
  takeDamage(raw: number): boolean {
    if (this.iframes > 0 || this.hp <= 0) return false;
    const dmg = Math.max(1, Math.round(raw) - this.stats.armor);
    this.hp -= dmg;
    this.iframes = IFRAME_TIME;
    this.hurtFlash = 0.35;
    return true;
  }

  heal(amount: number): number {
    const before = this.hp;
    this.hp = Math.min(this.stats.maxHp, this.hp + amount);
    return this.hp - before;
  }

  /** Retourne le nombre de niveaux gagnés (plusieurs sont possibles d'un coup). */
  addXp(amount: number): number {
    this.xp += amount * this.stats.growth;
    let gained = 0;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = xpForLevel(this.level);
      gained++;
      if (gained > 40) break; // garde-fou contre un gain absurde
    }
    return gained;
  }

  get xpRatio(): number {
    return clamp(this.xp / this.xpNext, 0, 1);
  }

  get hpRatio(): number {
    return clamp(this.hp / this.stats.maxHp, 0, 1);
  }

  get dead(): boolean {
    return this.hp <= 0;
  }

  /** Consomme une résurrection. Retourne `false` s'il n'en reste plus. */
  tryRevive(): boolean {
    if (this.revivesLeft <= 0) return false;
    this.revivesLeft--;
    // « Dernier Souffle » ressuscite à 1 PV sans invulnérabilité — c'est la malédiction.
    const cursed = this.flag('lastBreath') > 0 && this.revivesLeft < this.stats.revives - 0;
    this.hp = cursed ? 1 : Math.round(this.stats.maxHp * 0.5);
    this.iframes = cursed ? 0 : 2.5;
    return true;
  }

  /** Accorde un bonus temporaire. Un nouvel octroi remplace le précédent s'il est meilleur. */
  addBuff(kind: 'might' | 'speed', amount: number, seconds: number): void {
    if (kind === 'might') {
      this.buffMight = Math.max(this.buffMight, amount);
      this.buffMightTimer = Math.max(this.buffMightTimer, seconds);
    } else {
      this.buffSpeed = Math.max(this.buffSpeed, amount);
      this.buffSpeedTimer = Math.max(this.buffSpeedTimer, seconds);
    }
  }

  /** `speedMul` porte l'effet passif du biome courant (le marais ralentit). */
  update(dt: number, inputX: number, inputY: number, speedMul = 1): void {
    this.px = this.x;
    this.py = this.y;

    if (this.buffMightTimer > 0) {
      this.buffMightTimer -= dt;
      if (this.buffMightTimer <= 0) this.buffMight = 0;
    }
    if (this.buffSpeedTimer > 0) {
      this.buffSpeedTimer -= dt;
      if (this.buffSpeedTimer <= 0) this.buffSpeed = 0;
    }

    const sp = this.stats.moveSpeed * speedMul * (1 + this.buffSpeed);
    this.vx = inputX * sp;
    this.vy = inputY * sp;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.moving = inputX !== 0 || inputY !== 0;
    if (this.moving) {
      this.facingX = inputX;
      this.facingY = inputY;
      this.anim += dt * 9;
    } else {
      this.anim += dt * 3;
    }
    if (this.anim > 1e6) this.anim = 0;

    if (this.iframes > 0) this.iframes -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;

    if (this.stats.regen > 0 && this.hp < this.stats.maxHp) {
      this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.regen * dt);
    }
    // Cœur Battant : régénération accélérée quand la situation est critique.
    const lowRegen = this.flag('lowHpRegen');
    if (lowRegen > 0 && this.hpRatio < 0.3) {
      this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * lowRegen * dt);
    }
  }

  /** Angle de la direction regardée, utilisé par les armes de mêlée. */
  get facingAngle(): number {
    if (this.facingX === 0 && this.facingY === 0) return 0;
    return Math.atan2(this.facingY, this.facingX);
  }

  get sprite(): SpriteSet {
    return this.moving ? this.walkSprite : this.idleSprite;
  }

  get frameIndex(): number {
    const set = this.sprite;
    return Math.floor(this.anim % set.frames.length);
  }

  /** Angle aléatoire de repli quand aucune cible n'existe (armes qui doivent tirer). */
  static randomAngle(seed: number): number {
    return (seed * 2.399963) % TAU;
  }
}
