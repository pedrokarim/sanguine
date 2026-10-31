import { hex, mix, rand, rng, TAU, WHITE } from "../../core/index.js";
import { crackle, zigzag } from "../lightning/_lib.js";

export const meta = {
  name: "Sanguine skill life",
  desc: "A hand-painted item comes alive on its card: a gleam sweeps the steel, arcs jump off a bolt, painted flames dance and throw embers, blood drips, poison bubbles, incense rises, souls circle.",
  tags: ["sanguine", "ui", "icon", "item", "loop"],
  size: [44, 44],
  origin: [22, 22],
  duration: 1.6,
  loop: true,
  fps: 15,
  bg: "dark",
  options: { rows: [], colors: {}, life: "gleam", aura: "", seed: 1 },
};

const SIZE = 24;
const OUTLINE = hex("#08060c");
const FRAMES = Math.round(meta.duration * meta.fps);
const VOLT = ["#120a33", "#2a1b78", "#4630c0", "#5a62f0", "#58a6ff", "#9ed8ff", "#e4f6ff", "#ffffff"].map(hex);
const AMETHYST = ["#1c0a33", "#3c1a78", "#6a30c0", "#9a62f0", "#c08aff", "#dcbcff", "#f4e8ff", "#ffffff"].map(hex);
const EMBER = ["#ffe85c", "#ff8e20", "#dc1f36", "#7e0e24"].map(hex);
const SOUL = ["#c8fff2", "#8cf6e4", "#2ecab6", "#106272"].map(hex);
const VENOM = ["#eaffd0", "#caf894", "#50c448", "#1f7236"].map(hex);
const BLOOD = ["#ff6e60", "#dc1f36", "#7e0e24"].map(hex);
const HOLY = ["#ffffff", "#fff2a8", "#f6c63e", "#c97f1c"].map(hex);
const NIGHT = ["#e0b0ff", "#9846e0", "#4c2288"].map(hex);
const FROST = ["#ffffff", "#c8f4ff", "#5ab8f6"].map(hex);
const INCENSE = hex("#b8b4c4");

/** Les lettres que les flammes et les âmes font danser, de la plus chaude à la plus froide. */
const DANCING = { flame: "FfrE", soul: "TsS" };

const decoded = new WeakMap();

/** La carte de lettres, centrée sur l'origine, avec ce dont les effets ont besoin de partir. */
function decode(rows, colors) {
  let art = decoded.get(rows);
  if (art) return art;
  const at = (x, y) => rows[y]?.[x] ?? ".";
  const filled = (x, y) => at(x, y) !== ".";
  const body = [], outline = [], top = [], bottom = [], edge = [];
  for (let y = -1; y <= SIZE; y++)
    for (let x = -1; x <= SIZE; x++) {
      const px = x - SIZE / 2, py = y - SIZE / 2;
      if (filled(x, y)) {
        const ch = at(x, y);
        body.push({ x: px, y: py, ch, c: hex(colors[ch]) });
        if (!filled(x, y - 1)) top.push([px, py]);
        if (!filled(x, y + 1)) bottom.push([px, py]);
        if (!filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1)) edge.push([px, py]);
      } else if (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1)) {
        outline.push([px, py]);
      }
    }
  art = { body, outline, top, bottom, edge };
  decoded.set(rows, art);
  return art;
}

const pick = (list, seed, i) => list[Math.floor(rand(seed, i, 3) * list.length)];

/** Une particule qui revient à sa place à chaque tour de boucle : `u` va de 0 à 1 sans couture. */
const cycleOf = (t, seed, i, turns = 1) => ((t / meta.duration) * turns + rand(seed, i, 7)) % 1;

function star(p, x, y, s, c) {
  p.px(x, y, WHITE);
  for (let d = 1; d <= s; d++) {
    p.px(x + d, y, c);
    p.px(x - d, y, c);
    p.px(x, y + d, c);
    p.px(x, y - d, c);
  }
}

/** Un reflet qui balaie l'objet en diagonale, une fois par tour, puis laisse l'œil au repos. */
function gleam(p, art, t) {
  const at = -14 + (t / meta.duration) * 90;
  for (const q of art.body) {
    const d = Math.abs(q.x + q.y * 0.6 - at);
    if (d < 2.5) p.blend(q.x, q.y, WHITE, d < 1.2 ? 0.75 : 0.35);
  }
}

function embers(p, art, t, seed, count, ramp, height, turns = 2) {
  for (let i = 0; i < count; i++) {
    const u = cycleOf(t, seed, i, turns);
    const [x, y] = pick(art.top, seed, i);
    const sway = Math.sin(u * TAU + i) * 2;
    if (u < 0.85) p.px(x + sway, y - u * height, ramp[Math.min(ramp.length - 1, Math.floor(u * ramp.length))]);
  }
}

function drips(p, art, t, seed, count) {
  for (let i = 0; i < count; i++) {
    const u = cycleOf(t, seed, i + 40);
    const [x, y] = pick(art.bottom, seed, i + 40);
    const fall = u < 0.35 ? 0 : ((u - 0.35) / 0.65) ** 2 * 14;
    p.px(x, y + 1 + fall, BLOOD[1]);
    p.px(x, y + 2 + fall, BLOOD[u < 0.35 ? 2 : 0]);
  }
}

function vapour(p, art, t, seed, count, c, rise, alpha) {
  for (let i = 0; i < count; i++) {
    const u = cycleOf(t, seed, i + 80);
    const [x, y] = pick(art.top, seed, i + 80);
    const fade = Math.min(1, u * 5) * (1 - u);
    p.disc(x + Math.sin(u * TAU + i) * 3, y - u * rise, 1.5 + u * 2.5, c, alpha * fade);
  }
}

function orbit(p, t, seed, count, ramp, radius) {
  for (let i = 0; i < count; i++) {
    const a = (t / meta.duration) * TAU + (i * TAU) / count;
    const x = Math.cos(a) * radius, y = Math.sin(a) * radius * 0.7;
    for (let k = 3; k >= 0; k--) {
      const b = a - k * 0.16;
      p.px(Math.cos(b) * radius, Math.sin(b) * radius * 0.7, ramp[Math.min(ramp.length - 1, k)]);
    }
    p.glow(x, y, 5, ramp[1], 0.3);
  }
}

function arcs(p, art, t, seed, ramp) {
  const f = Math.round((t / meta.duration) * FRAMES) % FRAMES, r = rng(seed, 61, f);
  // Trois temps : une décharge franche, un répit, une réplique plus faible.
  const surge = f % 8 < 2 ? 1 : f % 8 === 4 ? 0.55 : 0;
  if (surge === 0) return;
  for (let i = 0; i < 3; i++) {
    const [x, y] = art.edge[r.int(0, art.edge.length - 1)];
    const a = Math.atan2(y, x) + r.range(-0.5, 0.5), l = r.range(6, 11);
    crackle(p, zigzag(r, x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, 0.38, 0.5), surge, ramp, 0.5);
  }
  p.glow(0, 0, 20, ramp[4], 0.34 * surge);
}

export function drawBack(p, t, o) {
  const art = decode(o.rows, o.colors), pulse = 0.5 + 0.5 * Math.sin((t / meta.duration) * TAU);
  if (o.aura) p.glow(0, 0, 21, hex(o.aura), 0.14 + 0.1 * pulse);
  if (o.life === "holy") {
    for (let i = 0; i < 8; i++) {
      const a = (t / meta.duration) * (TAU / 8) + (i * TAU) / 8, long = i % 2 ? 20 : 17;
      p.line(Math.cos(a) * 15, Math.sin(a) * 15, Math.cos(a) * long, Math.sin(a) * long, HOLY[i % 2 ? 2 : 1]);
    }
    p.glow(0, 0, 21, HOLY[2], 0.2 + 0.1 * pulse);
  }
  if (o.life === "dark") orbit(p, t, o.seed, 3, NIGHT, 18);
  if (o.life === "soul") orbit(p, t, o.seed, 2, SOUL, 19);
  if (o.life === "flame") p.glow(0, 2, 20, EMBER[1], 0.26 + 0.12 * pulse);
  if (o.life === "poison") p.glow(0, 2, 19, VENOM[2], 0.16 + 0.1 * pulse);
  for (const [x, y] of art.outline) p.px(x, y, OUTLINE);
}

export function draw(p, t, o) {
  const art = decode(o.rows, o.colors), dancing = DANCING[o.life] ?? "", phase = (t / meta.duration) * TAU;
  for (const q of art.body) {
    let c = q.c;
    const step = dancing.indexOf(q.ch);
    if (step >= 0) {
      // Les tons peints glissent d'un rang : le dessin reste le même, c'est lui qui bouge.
      const wave = Math.sin(q.x * 1.1 + q.y * 0.8 - phase * 3) + Math.sin(q.x * 0.5 - q.y * 1.3 - phase * 2);
      const shift = wave > 0.9 ? -1 : wave < -0.9 ? 1 : 0;
      c = hex(o.colors[dancing[Math.max(0, Math.min(dancing.length - 1, step + shift))] ?? q.ch] ?? "#7e0e24");
    }
    p.px(q.x, q.y, c);
  }
  switch (o.life) {
    case "gleam":
      gleam(p, art, t);
      break;
    case "volt":
      arcs(p, art, t, o.seed, o.ramp === "amethyst" ? AMETHYST : VOLT);
      break;
    case "flame":
      embers(p, art, t, o.seed, 9, EMBER, 15);
      break;
    case "soul":
      embers(p, art, t, o.seed, 6, SOUL, 12);
      break;
    case "holy":
      gleam(p, art, t);
      for (let i = 0; i < 3; i++) {
        const u = cycleOf(t, o.seed, i + 120), [x, y] = pick(art.edge, o.seed, i + 120);
        if (u < 0.4) star(p, x, y, u < 0.14 || u > 0.28 ? 1 : 2, HOLY[1]);
      }
      break;
    case "frost":
      gleam(p, art, t);
      for (let i = 0; i < 4; i++) {
        const u = cycleOf(t, o.seed, i + 150), [x, y] = pick(art.edge, o.seed, i + 150);
        if (u < 0.3) star(p, x, y, 1, FROST[1]);
      }
      p.glow(0, 0, 16, FROST[2], 0.1);
      break;
    case "blood":
      drips(p, art, t, o.seed, 3);
      p.glow(0, 0, 18, BLOOD[1], 0.12 + 0.1 * Math.sin(phase * 2));
      break;
    case "poison":
      vapour(p, art, t, o.seed, 5, VENOM[2], 12, 0.5);
      embers(p, art, t, o.seed, 5, VENOM, 13);
      break;
    case "smoke":
      vapour(p, art, t, o.seed, 7, INCENSE, 16, 0.55);
      break;
    case "dark":
      p.glow(0, 0, 16, mix(NIGHT[1], NIGHT[2], 0.5), 0.2);
      break;
  }
}
