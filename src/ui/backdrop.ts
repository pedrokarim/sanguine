import { Rng } from '../core/rng';
import { valueNoise2, TAU } from '../core/math';
import { P, rgba, shade } from '../gfx/palette';
import { drawAmbience, type AmbienceStyle } from '../gfx/cosmeticfx';
import { MENU_ART } from '../data/menuart';

/**
 * Décor illustré des menus : une scène nocturne dessinée par le code, dans la même grammaire
 * pixel que le jeu.
 *
 * Le fond est composé en **couches pré-rendues** une fois au démarrage, puis animé par
 * parallaxe. C'est ce qui permet d'avoir une illustration riche pour un coût de rendu proche
 * de zéro : cinq `drawImage` par frame, quel que soit le détail de la scène.
 *
 * La scène raconte le pitch sans une ligne de texte : une chapelle en ruine, un cimetière,
 * une lune rouge trop basse, et des choses qui volent.
 */

const W = 480;
const H = 270;

interface Bat {
  x: number;
  y: number;
  speed: number;
  amp: number;
  phase: number;
  scale: number;
}

function layer(w = W, h = H): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Ligne d'horizon irrégulière générée par bruit, remplie jusqu'en bas.
 *
 * `rim` dessine un liseré clair sur la crête. C'est ce liseré qui fait exister le relief :
 * sans lui, des masses sombres empilées sur un ciel sombre se fondent en une seule tache et
 * la scène paraît vide, quelle que soit la richesse de ce qu'on y a mis.
 */
function hills(
  ctx: CanvasRenderingContext2D,
  baseY: number,
  amplitude: number,
  scale: number,
  color: string,
  seed: number,
  rim?: string,
): void {
  const crest: [number, number][] = [];
  for (let x = 0; x <= W; x += 2) {
    const n = valueNoise2(x / scale, seed * 0.37, seed) * 0.65
      + valueNoise2(x / (scale * 0.36), seed * 1.7, seed + 9) * 0.35;
    crest.push([x, Math.round(baseY - n * amplitude)]);
  }

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (const [x, y] of crest) ctx.lineTo(x, y);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  if (rim) {
    ctx.fillStyle = rim;
    for (let i = 0; i < crest.length; i++) {
      // Le liseré est volontairement **discontinu**. Tracé plein, il se lit comme une courbe
      // de niveau sur une carte topographique et trahit immédiatement le procédé ; troué,
      // il redevient de la lumière accrochée par une crête irrégulière.
      const n = valueNoise2(i * 0.34, seed * 3.1, seed + 77);
      if (n < 0.34) continue;
      const [x, y] = crest[i]!;
      ctx.fillRect(x, y, 2, 1);
    }
  }
}

/** Silhouette de chapelle en ruine : nef éventrée et clocher penché. */
function chapel(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  ctx.fillStyle = color;
  const px = (a: number, b: number, w: number, h: number): void =>
    ctx.fillRect(Math.round(x + a * s), Math.round(y + b * s), Math.ceil(w * s), Math.ceil(h * s));

  px(-14, -16, 28, 16); // nef
  // Toiture effondrée : une crête irrégulière vaut mieux qu'un triangle propre.
  for (let i = 0; i < 14; i++) px(-14 + i * 2, -17 - (i % 3) - (i > 8 ? 1 : 0), 2, 2);
  px(8, -30, 9, 15); // clocher
  px(9, -34, 7, 4);
  px(12, -40, 1, 6); // croix
  px(10, -38, 5, 1);

  // Ouvertures : c'est le vide qui fait lire la ruine, pas la masse.
  ctx.clearRect(Math.round(x - 4 * s), Math.round(y - 12 * s), Math.ceil(7 * s), Math.ceil(12 * s));
  ctx.clearRect(Math.round(x + 10 * s), Math.round(y - 27 * s), Math.ceil(4 * s), Math.ceil(6 * s));
  ctx.clearRect(Math.round(x - 12 * s), Math.round(y - 14 * s), Math.ceil(3 * s), Math.ceil(4 * s));
}

/** Arbre mort : tronc + branches récursives. */
function deadTree(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, rng: Rng, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';

  const branch = (bx: number, by: number, angle: number, len: number, width: number, depth: number): void => {
    if (depth > 4 || len < 2) return;
    const ex = bx + Math.cos(angle) * len;
    const ey = by + Math.sin(angle) * len;
    ctx.lineWidth = Math.max(1, width);
    ctx.beginPath();
    ctx.moveTo(Math.round(bx), Math.round(by));
    ctx.lineTo(Math.round(ex), Math.round(ey));
    ctx.stroke();
    const n = depth < 2 ? 2 : rng.chance(0.65) ? 2 : 1;
    for (let i = 0; i < n; i++) {
      branch(ex, ey, angle + rng.spread(0.75) - 0.05, len * rng.range(0.55, 0.75), width * 0.62, depth + 1);
    }
  };

  branch(x, y, -Math.PI / 2 + rng.spread(0.12), h * 0.45, 3.2, 0);
}

/** Stèle penchée, avec sa tranche éclairée côté lune (la lune est à droite de la scène). */
function grave(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, s: number,
  rng: Rng,
  color: string,
  lit?: string,
): void {
  const tilt = rng.spread(0.16);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(tilt);

  ctx.fillStyle = color;
  ctx.fillRect(Math.round(-2.5 * s), Math.round(-8 * s), Math.ceil(5 * s), Math.ceil(8 * s));
  ctx.beginPath();
  ctx.arc(0, Math.round(-8 * s), 2.5 * s, Math.PI, 0);
  ctx.fill();

  if (lit) {
    // Une bande claire sur le flanc droit suffit à faire lire la pierre comme un volume.
    ctx.fillStyle = lit;
    ctx.fillRect(Math.round(1.4 * s), Math.round(-8 * s), Math.max(1, Math.ceil(1.1 * s)), Math.ceil(8 * s));
    ctx.beginPath();
    ctx.arc(0, Math.round(-8 * s), 2.5 * s, -Math.PI * 0.42, 0);
    ctx.lineWidth = Math.max(1, s * 0.9);
    ctx.strokeStyle = lit;
    ctx.stroke();
  }
  ctx.restore();
}

/** Ligne d'eau de la scène illustrée, en fraction de sa hauteur. */
const ART_HORIZON = 0.735;
/** Durée, en secondes, de la boucle des mouvements de la scène illustrée. */
const ART_LOOP = 4;
const ART_PETAL = '#961c2c';

/** Bruit déterministe dans [0, 1[. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

/** Décode les pixels indexés de `MENU_ART` – une lettre par plage, suivie de sa longueur. */
function decodeArt(): HTMLCanvasElement {
  const { w, h, palette, rle } = MENU_ART;
  const c = layer(w, h);
  const g = c.getContext('2d')!;
  let i = 0;
  for (const [, letter, count] of rle.matchAll(/([a-zA-Z])(\d*)/g)) {
    const code = letter!.charCodeAt(0);
    const index = code >= 97 ? code - 97 : code - 65 + 26;
    const run = Number(count || 1);
    g.fillStyle = palette[index] ?? '#000000';
    // Une plage peut déborder d'une ligne sur la suivante : on la découpe ligne par ligne.
    let left = run;
    while (left > 0) {
      const x = i % w;
      const span = Math.min(left, w - x);
      g.fillRect(x, Math.floor(i / w), span, 1);
      i += span;
      left -= span;
    }
  }
  return c;
}

export class Backdrop {
  private sky = layer();
  private far = layer();
  private mid = layer();
  private near = layer();
  private fore = layer();
  private fog = layer();

  private bats: Bat[] = [];
  private t = 0;

  /**
   * Scène illustrée du menu, décodée une fois depuis `data/menuart.ts`.
   *
   * Elle n'est pas générée par une formule, contrairement au reste : c'est une image fixe,
   * conçue comme une illustration, puis stockée en pixels indexés dans le code – aucun
   * fichier binaire n'est embarqué pour autant. Ce qui bouge, lui, est calculé ici à chaque
   * image : les pétales, les étoiles, le reflet.
   */
  private readonly art = decodeArt();
  private readonly work = layer(MENU_ART.w, MENU_ART.h);
  /** `false` rend l'ancienne lande procédurale, conservée pour comparaison. */
  illustrated = true;
  /** Ambiance du thème d'interface équipé, `null` pour la scène nue. */
  ambience: { style: AmbienceStyle; color: string } | null = null;

  constructor(seed = 0x5a9) {
    const rng = new Rng(seed);
    this.buildSky(rng);
    this.buildHorizonGlow();
    this.buildFar(rng);
    this.buildMid(rng);
    this.buildNear(rng);
    this.buildFore(rng);
    this.buildFog();

    for (let i = 0; i < 7; i++) {
      this.bats.push({
        x: rng.range(0, W),
        y: rng.range(30, 120),
        speed: rng.range(9, 22),
        amp: rng.range(4, 14),
        phase: rng.angle(),
        scale: rng.range(1, 2),
      });
    }
  }

  private buildSky(rng: Rng): void {
    const ctx = this.sky.getContext('2d')!;
    /*
     * Ciel de nuit **claire**, pas de nuit d'encre.
     *
     * La première version descendait à #04050a : correct sur le papier, illisible à l'écran –
     * on ne distinguait plus rien de la scène. Une vraie nuit dégagée sous la lune est
     * nettement plus lumineuse qu'on ne le croit, et un décor de menu doit se voir.
     */
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#141a38');
    g.addColorStop(0.38, '#1e2650');
    g.addColorStop(0.66, '#33305e');
    g.addColorStop(0.85, '#4e3357');
    g.addColorStop(1, '#5c3450');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Étoiles, plus denses en haut et plus franches qu'avant.
    for (let i = 0; i < 170; i++) {
      const x = rng.int(0, W - 1);
      const y = Math.floor(Math.pow(rng.next(), 1.7) * H * 0.62);
      const b = rng.range(0.3, 1);
      ctx.fillStyle = rgba('#e6ecff', b);
      ctx.fillRect(x, y, 1, 1);
      // Quelques étoiles doubles, à peine plus grosses : ça densifie sans faire du bruit.
      if (rng.chance(0.12)) ctx.fillRect(x + 1, y, 1, 1);
    }

    // Lune basse, cernée d'un halo sanglant : l'image de marque du jeu.
    const mx = 406;
    const my = 60;
    // Halo double : un cœur lumineux froid qui éclaire réellement, cerné de rouge sourd
    // pour garder l'identité « lune de sang » sans assombrir la scène.
    const halo = ctx.createRadialGradient(mx, my, 4, mx, my, 120);
    halo.addColorStop(0, rgba('#f0dcc0', 0.34));
    halo.addColorStop(0.22, rgba('#b7a9d8', 0.20));
    halo.addColorStop(0.48, rgba(P.bloodHi, 0.16));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - 130, my - 130, 260, 260);

    /*
     * Le croissant est découpé dans un **canvas dédié** avant d'être composité.
     * Un `destination-out` appliqué directement sur le ciel percerait aussi le halo et le
     * dégradé, laissant un trou transparent parfaitement visible à l'écran.
     */
    const R = 21;
    const moon = document.createElement('canvas');
    moon.width = R * 2 + 4;
    moon.height = R * 2 + 4;
    const mctx = moon.getContext('2d')!;
    const cx = R + 2;
    const cy = R + 2;

    mctx.fillStyle = '#f0dcc0';
    mctx.beginPath();
    mctx.arc(cx, cy, R, 0, TAU);
    mctx.fill();
    // Mers lunaires : quelques taches suffisent à éviter le disque plat.
    mctx.fillStyle = '#d8bfa0';
    for (let i = 0; i < 7; i++) {
      const a = rng.angle();
      const d = rng.range(0, 15);
      mctx.beginPath();
      mctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rng.range(1.5, 4.5), 0, TAU);
      mctx.fill();
    }
    mctx.globalCompositeOperation = 'destination-out';
    mctx.beginPath();
    mctx.arc(cx + 9, cy - 6, R - 2, 0, TAU);
    mctx.fill();

    ctx.drawImage(moon, mx - cx, my - cy);

    // Bandes nuageuses devant la lune : éclairées par-dessous plutôt que noires, sinon
    // elles creusent des trous sombres au milieu de la partie la plus lumineuse du ciel.
    for (let i = 0; i < 5; i++) {
      const y = 34 + i * 15 + rng.spread(6);
      const cw = rng.range(50, 120);
      const cx2 = rng.range(250, 470);
      ctx.fillStyle = rgba('#2a2448', rng.range(0.45, 0.75));
      ctx.beginPath();
      ctx.ellipse(cx2, y, cw, rng.range(2.5, 5), 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba('#6b5f96', 0.35);
      ctx.beginPath();
      ctx.ellipse(cx2, y - 1.5, cw * 0.85, 1.2, 0, 0, TAU);
      ctx.fill();
    }
  }

  /**
   * Les couches s'éclaircissent avec la distance (perspective atmosphérique), et non
   * l'inverse : une silhouette de premier plan quasi noire sur un ciel sombre ne se lit
   * pas du tout. Chaque plan garde donc une valeur distincte, même très basse.
   */
  private buildFar(rng: Rng): void {
    const ctx = this.far.getContext('2d')!;
    hills(ctx, 168, 26, 120, '#3b3560', 3, '#736a9c');
    hills(ctx, 182, 18, 70, '#332e55', 11, '#615889');
    for (let i = 0; i < 11; i++) {
      deadTree(ctx, rng.range(0, W), rng.range(168, 180), rng.range(9, 16), rng, '#2c2749');
    }
  }

  private buildMid(rng: Rng): void {
    const ctx = this.mid.getContext('2d')!;
    hills(ctx, 196, 14, 95, '#2a2648', 7, '#453f6b');
    chapel(ctx, 118, 196, 1.05, '#221e3c');
    for (let i = 0; i < 6; i++) {
      deadTree(ctx, 244 + i * 42 + rng.spread(14), 196 + rng.spread(4), rng.range(20, 34), rng, '#221e3c');
    }
  }

  private buildNear(rng: Rng): void {
    const ctx = this.near.getContext('2d')!;
    hills(ctx, 224, 10, 80, '#1c1930', 21, '#332e52');
    // Cimetière au premier plan moyen : le cœur thématique de la scène.
    for (let i = 0; i < 20; i++) {
      grave(ctx, rng.range(8, W - 8), rng.range(216, 236), rng.range(1.1, 1.9), rng, '#262240', '#4b446e');
    }
    for (let i = 0; i < 4; i++) {
      deadTree(ctx, rng.range(20, W - 20), rng.range(220, 232), rng.range(34, 52), rng, '#201c36');
    }
  }

  private buildFore(rng: Rng): void {
    const ctx = this.fore.getContext('2d')!;
    hills(ctx, 258, 8, 60, '#12101f', 33, '#221f38');
    for (let i = 0; i < 8; i++) {
      grave(ctx, rng.range(-10, W + 10), rng.range(252, 268), rng.range(2.2, 3.4), rng, '#181529', '#332e50');
    }
    // Herbes hautes en découpe sur le bord bas.
    ctx.lineWidth = 1;
    for (let i = 0; i < 110; i++) {
      const x = rng.range(0, W);
      const h = rng.range(3, 12);
      // Une herbe sur trois attrape la lumière : le contraste interne empêche la bande du
      // bas de se réduire à une masse noire.
      ctx.strokeStyle = rng.chance(0.34) ? '#2e2947' : '#181529';
      ctx.beginPath();
      ctx.moveTo(Math.round(x), H);
      ctx.lineTo(Math.round(x + rng.spread(2.5)), Math.round(H - h));
      ctx.stroke();
    }
  }

  /** Lueur rasante sur l'horizon : détache les silhouettes du ciel. */
  private buildHorizonGlow(): void {
    const ctx = this.sky.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 140, 0, 220);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.55, rgba('#8a5a7a', 0.26));
    g.addColorStop(0.8, rgba(P.bloodDark, 0.20));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 140, W, 80);
  }

  private buildFog(): void {
    const ctx = this.fog.getContext('2d')!;
    // Brume **claire** : sous la lune, le brouillard diffuse la lumière au lieu de l'absorber.
    // Une brume sombre serait un simple voile noir de plus, exactement ce qu'on cherche à
    // éviter ici.
    for (let i = 0; i < 4; i++) {
      const y = 146 + i * 32;
      const g = ctx.createLinearGradient(0, y - 18, 0, y + 18);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, rgba('#9c91c4', 0.20 - i * 0.035));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 18, W, 36);
    }
  }

  /**
   * Passe de lumière lunaire, appliquée **par-dessus** les silhouettes.
   *
   * C'est elle qui unifie la scène : sans source de lumière commune, les couches restent
   * quatre découpes juxtaposées. En `screen`, elle éclaircit sans jamais délaver les noirs.
   */
  private drawMoonlight(ctx: CanvasRenderingContext2D): void {
    const mx = 406;
    const my = 60;
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(mx, my, 20, mx, my, 340);
    g.addColorStop(0, rgba('#6d6494', 0.42));
    g.addColorStop(0.35, rgba('#4a4470', 0.22));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Rend la scène illustrée et ce qui l'anime.
   *
   * Trois mouvements, tous discrets : la scène est faite de vide et de silence, et une
   * animation insistante la contredirait. Le reflet ondule ligne par ligne, d'un pixel ou
   * deux ; des pétales tombent de l'arbre jusqu'à l'eau, avec leur reflet ; quelques étoiles
   * clignotent, chacune à son rythme.
   */
  private renderArt(ctx: CanvasRenderingContext2D, t: number, outW: number, outH: number): void {
    const { w, h } = MENU_ART;
    const g = this.work.getContext('2d')!;
    const horizon = Math.floor(h * ART_HORIZON);
    const phase = t / ART_LOOP;

    g.globalAlpha = 1;
    g.drawImage(this.art, 0, 0);

    for (let y = horizon + 1; y < h; y++) {
      const depth = (y - horizon) / (h - horizon);
      const shift = Math.round(Math.sin(phase * TAU + y * 0.55) * (0.6 + depth * 2.2));
      if (shift !== 0) g.drawImage(this.art, 0, y, w, 1, shift, y, w, 1);
    }

    g.fillStyle = '#e8e8f5';
    for (let k = 0; k < 9; k++) {
      const blink = 0.5 + 0.5 * Math.sin(phase * TAU * (1 + (k % 3)) + k * 2.4);
      g.globalAlpha = 0.25 + 0.75 * blink;
      g.fillRect(Math.round(hash(11 + k * 3.1) * w), Math.round(hash(11 + k * 7.7) * horizon * 0.55), 1, 1);
    }

    g.fillStyle = ART_PETAL;
    for (let k = 0; k < 22; k++) {
      const life = (phase * (1 + (k % 2)) + hash(k * 5.3)) % 1;
      const y0 = h * (0.3 + hash(k * 9.1) * 0.22);
      const x = Math.round(w * (0.04 + hash(k * 2.9) * 0.3) + life * w * 0.1 + Math.sin(life * TAU * 2 + k) * 3);
      const y = y0 + life * (horizon - y0);
      const fade = Math.min(1, life * 6) * Math.min(1, (1 - life) * 5);
      g.globalAlpha = fade;
      g.fillRect(x, Math.round(y), k % 3 === 0 ? 2 : 1, 1);
      g.globalAlpha = fade * 0.35;
      g.fillRect(x, Math.round(2 * horizon - y), 1, 1);
    }
    g.globalAlpha = 1;

    // On couvre par le plus grand des deux rapports, comme pour l'ancienne scène.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const k = Math.max(outW / w, outH / h);
    ctx.setTransform(k, 0, 0, k, (outW - w * k) / 2, (outH - h * k) / 2);
    ctx.drawImage(this.work, 0, 0);

    if (this.ambience) {
      const ka = Math.max(outW / W, outH / H);
      ctx.setTransform(ka, 0, 0, ka, (outW - W * ka) / 2, (outH - H * ka) / 2);
      ctx.imageSmoothingEnabled = true;
      drawAmbience(ctx, this.ambience.style, this.ambience.color, t, W, H);
      ctx.imageSmoothingEnabled = false;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /**
   * Dessine la scène animée. `dt` en secondes.
   *
   * Les couches sont peintes en 480 × 270 puis mises à l'échelle pour couvrir le canvas,
   * dont la taille varie désormais avec la fenêtre. Le lissage reste désactivé : la scène
   * garde son grain pixel plutôt que de se ramollir sur les grands écrans.
   */
  render(ctx: CanvasRenderingContext2D, dt: number, outW = W, outH = H): void {
    this.t += dt;
    const t = this.t;

    if (this.illustrated) {
      this.renderArt(ctx, t, outW, outH);
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    // On couvre par le plus grand des deux rapports pour ne jamais laisser de bord vide,
    // quitte à rogner légèrement la scène.
    const k = Math.max(outW / W, outH / H);
    ctx.setTransform(k, 0, 0, k, (outW - W * k) / 2, (outH - H * k) / 2);

    // Parallaxe : chaque couche dérive un peu plus vite que la précédente.
    const drift = (speed: number): number => -((t * speed) % W);

    ctx.drawImage(this.sky, 0, 0);

    const layers: [HTMLCanvasElement, number][] = [
      [this.far, 1.6],
      [this.mid, 3.2],
      [this.near, 5.5],
      [this.fore, 8.5],
    ];
    for (const [img, speed] of layers) {
      const x = drift(speed);
      ctx.drawImage(img, Math.round(x), 0);
      ctx.drawImage(img, Math.round(x + W), 0);
    }

    this.drawMoonlight(ctx);

    // Brume : deux passes à vitesses opposées, ce qui évite tout motif perceptible.
    for (const [speed, alpha] of [[11, 0.9], [-7, 0.6]] as const) {
      const x = -((t * speed) % W) - (speed < 0 ? W : 0);
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.fog, Math.round(x), Math.round(Math.sin(t * 0.3) * 3));
      ctx.drawImage(this.fog, Math.round(x + W), Math.round(Math.sin(t * 0.3) * 3));
      ctx.globalAlpha = 1;
    }

    // Chauves-souris : de simples chevrons qui battent, très lisibles en silhouette.
    // Elles restent le seul élément franchement sombre, donc les plus lisibles de la scène.
    ctx.fillStyle = '#100c1c';
    for (const b of this.bats) {
      const bx = (b.x + t * b.speed) % (W + 40) - 20;
      const by = b.y + Math.sin(t * 1.6 + b.phase) * b.amp;
      const flap = Math.sin(t * 9 + b.phase) * 2;
      const s = b.scale;
      ctx.fillRect(Math.round(bx), Math.round(by), Math.ceil(s), Math.ceil(s));
      ctx.fillRect(Math.round(bx - 2 * s), Math.round(by - flap * 0.5), Math.ceil(2 * s), Math.ceil(s));
      ctx.fillRect(Math.round(bx + s), Math.round(by - flap * 0.5), Math.ceil(2 * s), Math.ceil(s));
    }

    // Vignette très discrète : elle recentre l'œil sans reprendre d'une main la luminosité
    // gagnée de l'autre. C'était l'erreur de la version précédente – un ciel déjà sombre,
    // plus une vignette lourde, plus le voile du menu par-dessus.
    if (this.ambience) {
      ctx.imageSmoothingEnabled = true;
      drawAmbience(ctx, this.ambience.style, this.ambience.color, t, W, H);
      ctx.imageSmoothingEnabled = false;
    }

    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 1.15);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, rgba(shade(P.bloodDark, -0.55), 0.34));
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
