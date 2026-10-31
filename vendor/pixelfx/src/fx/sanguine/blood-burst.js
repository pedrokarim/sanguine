import { burst, fit, seg, TAU } from "../../core/index.js";

export const meta = {
  name: "Sanguine blood burst",
  desc: "Top-down death spatter: a dark star of blood, a soft red mist, droplets arcing out all round to land and soak away. No white, so piled-up deaths stay red.",
  tags: ["sanguine", "death", "blood", "gore", "top-down", "one-shot"],
  size: [112, 80],
  origin: [56, 50],
  duration: 0.7,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#14040a", "#3a0a14", "#6a101c", "#8b1a2b", "#c42639", "#f0405a", "#ff9a8a"], height: 9, squash: 0.72, scale: 1, seed: 6 },
};

const G = 420; // gravité des gouttes, plus faible que `GRAVITY` : la scène est vue de haut
const DROPS = 30;
const RAYS = 9;

export function draw(p, t, o) {
  const C = fit(o.palette, 7), Y = -o.height, S = o.squash, k0 = o.scale;

  // La brume : translucide, elle donne le volume que les gouttes seules n'ont pas.
  if (t < 0.32) {
    const k = seg(t, 0, 0.32), r0 = (5 + 11 * Math.sqrt(k)) * k0, a0 = 0.5 * (1 - k) * (1 - k);
    burst(4, o.seed + 2, (r, i) => {
      const a = (i / 4) * TAU + r.range(-0.5, 0.5), d = r.range(2, 6) * (0.4 + k) * k0;
      p.disc(Math.cos(a) * d, Y + Math.sin(a) * d * S, r0 * r.range(0.6, 0.9), C[2], a0);
    });
  }

  // L'éclatement : une étoile irrégulière et sombre, sans cœur blanc.
  if (t < 0.1) {
    const k = t / 0.1;
    burst(RAYS, o.seed + 1, (r, i) => {
      const a = (i / RAYS) * TAU + r.range(-0.3, 0.3), L = r.range(7, 14) * k0, c = Math.cos(a), s = Math.sin(a) * S;
      for (let d = k * L * 0.7; d <= L * (0.55 + 0.6 * k); d += 0.5) p.px(c * d, Y + s * d, d < L * 0.5 ? C[4] : C[3]);
    });
    p.circle(0, Y, (3.5 * (1 - k) + 0.5) * k0, C[4]);
  }

  // Les gouttes : position au sol et hauteur séparées, pour retomber tout autour du corps.
  const n = Math.round(DROPS * k0);
  burst(n, o.seed, (r, i) => {
    const a = (i / n) * TAU + r.range(-0.2, 0.2), v = r.range(20, 96) * k0, vz = r.range(20, 70), big = r.chance(0.4);
    const c = r.pick([C[3], C[3], C[4], C[5]]), land = (vz + Math.sqrt(vz * vz + 2 * G * o.height)) / G;
    const tt = Math.min(t, land), x = Math.cos(a) * v * tt, y = Math.sin(a) * v * tt * S;
    if (t < land) {
      const z = o.height + vz * tt - 0.5 * G * tt * tt;
      p.px(x, y - z, c);
      if (big) { p.px(x + 1, y - z, c); p.px(x, y - z + 1, C[3]); p.px(x + 1, y - z + 1, C[3]); }
      // Une traînée d'un pixel, dans le sens du mouvement à l'écran.
      p.px(x - Math.cos(a) * 1.5, y - z + (vz - G * tt) * 0.02, C[2]);
    } else {
      // Posée, elle s'étale puis s'efface : la tache durable reste celle du jeu.
      const fade = 1 - seg(t, land + 0.06, meta.duration - 0.02);
      p.dot(x, y, C[2], fade);
      if (big) { p.dot(x + 1, y, C[2], fade); p.dot(x - 1, y, C[1], fade); }
    }
  });

  p.glow(0, Y, 16 * k0, C[4], 0.26 * (1 - seg(t, 0, 0.16)));
}
