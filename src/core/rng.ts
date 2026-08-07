import { TAU } from './math';

/**
 * PRNG déterministe (Mulberry32). Rapide, sans état global, et surtout **reproductible** :
 * un run entier peut être rejoué depuis sa graine, ce qui rend les bugs déterministes.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** Flottant dans [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Flottant dans [lo, hi). */
  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  /** Entier dans [lo, hi]. */
  int(lo: number, hi: number): number {
    return Math.floor(lo + this.next() * (hi - lo + 1));
  }

  /** `true` avec la probabilité `p`. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Élément aléatoire (le tableau ne doit pas être vide). */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }

  /** Tirage pondéré : retourne l'index. `-1` si tous les poids sont nuls. */
  weighted(weights: readonly number[]): number {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i]!;
    if (total <= 0) return -1;
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i]!;
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }

  /** Mélange en place (Fisher-Yates). */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = t;
    }
    return arr;
  }

  /** Angle aléatoire en radians. */
  angle(): number {
    return this.next() * TAU;
  }

  /** Valeur signée dans [-m, m]. */
  spread(m: number): number {
    return (this.next() * 2 - 1) * m;
  }

  /** Fork déterministe : utile pour générer un sprite sans perturber le flux principal. */
  fork(salt: number): Rng {
    return new Rng((this.s ^ Math.imul(salt, 0x9e3779b9)) >>> 0);
  }
}

/** Instance partagée pour tout ce qui est purement cosmétique (particules, décor). */
export const fxRng = new Rng(0xc0ffee);

/** Génère une graine à partir de l'horloge — utilisé au lancement d'un run. */
export const makeSeed = (): number => (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
