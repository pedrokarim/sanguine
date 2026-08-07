/**
 * Grille de hachage spatial pour les requêtes de proximité.
 *
 * Reconstruite intégralement à chaque frame. À cette densité (~1500 entités), tout reconstruire
 * est plus rapide qu'une mise à jour incrémentale, et surtout impossible à désynchroniser.
 *
 * L'implémentation utilise des `Int32Array` en listes chaînées plutôt que des tableaux de
 * tableaux : zéro allocation par frame, donc zéro pression sur le GC.
 */
export class SpatialGrid {
  private readonly cellSize: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly originX: number;
  private readonly originY: number;

  /** `heads[cell]` = index de la première entité de la cellule, ou -1. */
  private readonly heads: Int32Array;
  /** `next[i]` = entité suivante dans la même cellule, ou -1. */
  private next: Int32Array;

  /** Tampon réutilisé par `query` — ne jamais conserver la référence retournée. */
  readonly result: Int32Array;
  resultCount = 0;

  constructor(cellSize: number, worldSize: number, maxEntities: number) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(worldSize / cellSize);
    this.rows = this.cols;
    this.originX = -worldSize / 2;
    this.originY = -worldSize / 2;
    this.heads = new Int32Array(this.cols * this.rows).fill(-1);
    this.next = new Int32Array(maxEntities).fill(-1);
    this.result = new Int32Array(maxEntities);
  }

  clear(): void {
    this.heads.fill(-1);
  }

  private cellIndex(x: number, y: number): number {
    const cx = Math.floor((x - this.originX) / this.cellSize);
    const cy = Math.floor((y - this.originY) / this.cellSize);
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return -1;
    return cy * this.cols + cx;
  }

  /** Insère l'entité `id` positionnée en (x, y). */
  insert(id: number, x: number, y: number): void {
    const c = this.cellIndex(x, y);
    if (c < 0) return;
    if (id >= this.next.length) {
      const bigger = new Int32Array(id * 2 + 8).fill(-1);
      bigger.set(this.next);
      this.next = bigger;
    }
    this.next[id] = this.heads[c]!;
    this.heads[c] = id;
  }

  /**
   * Remplit `result` avec les entités des cellules chevauchant le cercle (x, y, r).
   * Le filtrage exact reste à la charge de l'appelant — c'est un test large.
   */
  query(x: number, y: number, r: number): number {
    this.resultCount = 0;
    const cs = this.cellSize;
    let cx0 = Math.floor((x - r - this.originX) / cs);
    let cy0 = Math.floor((y - r - this.originY) / cs);
    let cx1 = Math.floor((x + r - this.originX) / cs);
    let cy1 = Math.floor((y + r - this.originY) / cs);
    if (cx0 < 0) cx0 = 0;
    if (cy0 < 0) cy0 = 0;
    if (cx1 >= this.cols) cx1 = this.cols - 1;
    if (cy1 >= this.rows) cy1 = this.rows - 1;

    const res = this.result;
    let n = 0;
    for (let cy = cy0; cy <= cy1; cy++) {
      const row = cy * this.cols;
      for (let cx = cx0; cx <= cx1; cx++) {
        let id = this.heads[row + cx]!;
        while (id !== -1) {
          res[n++] = id;
          id = this.next[id]!;
        }
      }
    }
    this.resultCount = n;
    return n;
  }

  /** Première entité de la cellule contenant (x, y) — utilisé pour la séparation approximative. */
  cellHead(x: number, y: number): number {
    const c = this.cellIndex(x, y);
    return c < 0 ? -1 : this.heads[c]!;
  }

  nextIn(id: number): number {
    return id < this.next.length ? this.next[id]! : -1;
  }
}
