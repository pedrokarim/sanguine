import { localiseById, t } from '../i18n';
import { EN_SURPASSMENTS } from './en';

/**
 * Modificateurs de statistiques, partagés par les passifs, les reliques, les personnages
 * et le Sanctuaire. Un seul type pour tout : la fonction de recalcul du joueur n'a qu'un
 * cas à traiter, et ajouter une source de bonus ne demande aucun code supplémentaire.
 *
 * Conventions :
 *   – `maxHp`, `regen`, `armor`, `amount`, `pierce`, `crit`, `revives`, `rerolls` sont **plats** ;
 *   – tout le reste est une **fraction** additionnée à un multiplicateur basé sur 1.0
 *     (`might: 0.1` = +10 % de dégâts) ;
 *   – `cooldown` est une **réduction** (`cooldown: 0.08` = −8 % de temps de recharge).
 */
export interface Mods {
  maxHp?: number;
  regen?: number;
  armor?: number;
  moveSpeed?: number;
  might?: number;
  area?: number;
  cooldown?: number;
  projSpeed?: number;
  duration?: number;
  amount?: number;
  pickup?: number;
  luck?: number;
  growth?: number;
  greed?: number;
  crit?: number;
  lifesteal?: number;
  pierce?: number;
  revives?: number;
  rerolls?: number;
}

const KEYS: (keyof Mods)[] = [
  'maxHp', 'regen', 'armor', 'moveSpeed', 'might', 'area', 'cooldown', 'projSpeed',
  'duration', 'amount', 'pickup', 'luck', 'growth', 'greed', 'crit', 'lifesteal',
  'pierce', 'revives', 'rerolls',
];

/** Additionne `src × scale` dans `dst`. Toutes les sources s'accumulent additivement. */
export function addMods(dst: Mods, src: Mods | undefined, scale = 1): void {
  if (!src) return;
  for (const k of KEYS) {
    const v = src[k];
    if (v !== undefined) dst[k] = (dst[k] ?? 0) + v * scale;
  }
}

/** Description lisible d'un jeu de modificateurs, pour les cartes et infobulles. */
export function describeMods(m: Mods): string {
  const out: string[] = [];
  const pct = (v: number): string => `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)} %`;
  const flat = (v: number): string => `${v > 0 ? '+' : '−'}${Math.abs(v)}`;

  if (m.maxHp) out.push(t(`${flat(m.maxHp)} PV max`, `${flat(m.maxHp)} max HP`));
  if (m.regen) out.push(`${m.regen > 0 ? '+' : '−'}${Math.abs(m.regen).toFixed(1)} ${t('PV/s', 'HP/s')}`);
  if (m.armor) out.push(t(`${flat(m.armor)} armure`, `${flat(m.armor)} armour`));
  if (m.moveSpeed) out.push(t(`${pct(m.moveSpeed)} de vitesse`, `${pct(m.moveSpeed)} speed`));
  if (m.might) out.push(t(`${pct(m.might)} de dégâts`, `${pct(m.might)} damage`));
  if (m.area) out.push(t(`${pct(m.area)} de zone`, `${pct(m.area)} area`));
  if (m.cooldown) out.push(t(`${m.cooldown > 0 ? '−' : '+'}${Math.round(Math.abs(m.cooldown) * 100)} % de recharge`, `${m.cooldown > 0 ? '−' : '+'}${Math.round(Math.abs(m.cooldown) * 100)}% cooldown`));
  if (m.projSpeed) out.push(t(`${pct(m.projSpeed)} de vitesse de projectile`, `${pct(m.projSpeed)} projectile speed`));
  if (m.duration) out.push(t(`${pct(m.duration)} de durée`, `${pct(m.duration)} duration`));
  if (m.amount) out.push(`${flat(m.amount)} projectile${Math.abs(m.amount) > 1 ? 's' : ''}`);
  if (m.pickup) out.push(t(`${pct(m.pickup)} de ramassage`, `${pct(m.pickup)} pickup range`));
  if (m.luck) out.push(t(`${pct(m.luck)} de chance`, `${pct(m.luck)} luck`));
  if (m.growth) out.push(`${pct(m.growth)} ${t("d'XP", 'XP')}`);
  if (m.greed) out.push(t(`${pct(m.greed)} d'or`, `${pct(m.greed)} gold`));
  if (m.crit) out.push(t(`${pct(m.crit)} de critique`, `${pct(m.crit)} critical chance`));
  if (m.lifesteal) out.push(t(`${pct(m.lifesteal)} de vol de vie`, `${pct(m.lifesteal)} life steal`));
  if (m.pierce) out.push(t(`${flat(m.pierce)} perforation`, `${flat(m.pierce)} pierce`));
  if (m.revives) out.push(t(`${flat(m.revives)} résurrection`, `${flat(m.revives)} resurrection`));
  if (m.rerolls) out.push(`${flat(m.rerolls)} reroll`);

  return out.join(', ');
}

/**
 * Surpassements.
 *
 * Passé un certain point, un joueur a ses six armes au maximum, ses six objets au maximum,
 * et rien de ce que le jeu sait offrir ne lui manque. Les montées de niveau continuaient
 * pourtant d'arriver, et ne proposaient plus que les trois mêmes lots de secours — la même
 * main, indéfiniment. Mesuré : au-delà du build complet, **quarante montées de niveau
 * d'affilée** proposaient « Bourse, Repas chaud, Parchemin », et une fois sur trois la
 * quatrième carte doublait la première.
 *
 * Ces bonus-là ne s'épuisent pas. Ils sont volontairement petits : la résistance des
 * ennemis croît avec le niveau du joueur (voir `hpScale`), ils servent donc à **tenir le
 * rythme**, pas à reprendre l'avantage. Un surpassement qui rendrait plus fort que la
 * taxe qu'il déclenche relancerait exactement l'emballement qu'on cherche à contenir.
 */
export interface Surpassement {
  id: string;
  nom: string;
  mods: Mods;
}

export const SURPASSEMENTS: Surpassement[] = [
  { id: 'sur-might', nom: 'Rage tenace', mods: { might: 0.07 } },
  { id: 'sur-area', nom: 'Emprise', mods: { area: 0.06 } },
  { id: 'sur-cooldown', nom: 'Cadence', mods: { cooldown: 0.035 } },
  { id: 'sur-hp', nom: 'Endurance', mods: { maxHp: 12 } },
  { id: 'sur-speed', nom: 'Foulée', mods: { moveSpeed: 0.03 } },
  { id: 'sur-pickup', nom: 'Convoitise', mods: { pickup: 0.09 } },
  { id: 'sur-armor', nom: 'Cuir tanné', mods: { armor: 0.6 } },
  { id: 'sur-crit', nom: 'Œil sûr', mods: { crit: 0.02 } },
];

localiseById(SURPASSEMENTS, EN_SURPASSMENTS);

export const SURPASSEMENT_BY_ID = new Map<string, Surpassement>(
  SURPASSEMENTS.map((s) => [s.id, s]),
);

/** Chiffre romain, pour numéroter les surpassements empilés sans allonger la carte. */
export function romain(n: number): string {
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let reste = Math.max(1, Math.min(3999, Math.round(n)));
  let out = '';
  for (const [v, s] of table) {
    while (reste >= v) { out += s; reste -= v; }
  }
  return out;
}
