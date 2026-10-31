import { hex, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Sanguine painted flight",
  desc: "A hand-painted item thrown across the field: the same drawing as its card, black-outlined, spinning or pointing where it flies, with a thin wake of cut air.",
  tags: ["sanguine", "projectile", "item", "spin", "loop"],
  size: [60, 60],
  origin: [30, 30],
  duration: 0.4,
  loop: true,
  fps: 20,
  bg: "dark",
  options: { rows: [], colors: {}, scale: 0.8, heading: 0, spin: 0, base: 0, wake: "#ffffff", glow: "", seed: 1 },
};

const SIZE = 24;
const OUTLINE = hex("#08060c");
const REACH = 28;

/** Chaque pixel d'arrivée va chercher sa couleur dans le dessin : une rotation ne laisse aucun trou. */
function raster(rows, colors, angle, scale) {
  const c = Math.cos(angle), s = Math.sin(angle), W = REACH * 2 + 1, grid = new Int32Array(W * W);
  for (let y = -REACH; y <= REACH; y++)
    for (let x = -REACH; x <= REACH; x++) {
      const u = Math.floor((c * x + s * y) / scale + SIZE / 2), v = Math.floor((-s * x + c * y) / scale + SIZE / 2);
      const ch = rows[v]?.[u] ?? ".";
      if (ch !== ".") grid[(y + REACH) * W + x + REACH] = hex(colors[ch]);
    }
  return { grid, W };
}

export function draw(p, t, o) {
  const turn = (t / meta.duration) * TAU * o.spin, angle = o.heading + turn - o.base;
  const { grid, W } = raster(o.rows, o.colors, angle, o.scale), wake = hex(o.wake);
  if (o.spin) {
    // Le sillage d'un objet qui tournoie : un arc qui le suit, sinon la rotation se lit mal à huit images.
    for (let i = 1; i < 14; i++) {
      const b = turn + o.base - i * 0.2 * Math.sign(o.spin);
      p.dot(Math.cos(b) * 11 * o.scale * 1.3, Math.sin(b) * 11 * o.scale * 1.3, wake, 0.55 - i * 0.035);
    }
  } else {
    const c = Math.cos(o.heading), s = Math.sin(o.heading);
    // Un seul filet d'air fendu : trois traits égaux dessinaient un balai derrière l'objet.
    const from = -10 * o.scale - 2, to = from - 7 - (t / meta.duration) * 3;
    p.line(c * from, s * from, c * to, s * to, wake, 0.6);
  }
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const v = grid[y * W + x];
      if (v) p.px(x - REACH, y - REACH, v);
      else if (grid[y * W + x + 1] || grid[y * W + x - 1] || grid[(y + 1) * W + x] || grid[(y - 1) * W + x]) p.px(x - REACH, y - REACH, OUTLINE);
    }
  if (o.glow) p.glow(0, 0, 13, hex(o.glow), 0.32);
  if (Math.round((t / meta.duration) * 8) % 8 === 0) p.px(0, 0, WHITE);
}
