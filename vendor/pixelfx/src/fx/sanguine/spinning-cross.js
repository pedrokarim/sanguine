import { fit, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Sanguine spinning cross",
  desc: "A thrown holy cross spinning flat out: four gilded arms with a bright leading edge, a pale ring of motion behind them, a warm halo.",
  tags: ["sanguine", "projectile", "holy", "cross", "spin", "loop"],
  size: [48, 44],
  origin: [24, 22],
  duration: 0.4,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: ["#3a2412", "#7a4a1c", "#b87a2a", "#e0a848", "#f2c46b", "#ffe59a", "#ffffff"], size: 10, seed: 1 },
};

const S = 0.82;

export function draw(p, t, o) {
  const C = fit(o.palette, 7), L = o.size, spin = (t / meta.duration) * TAU * 0.5;
  // Le sillage circulaire : c'est lui qui donne la vitesse de rotation à trois images par quart de tour.
  for (let i = 0; i < 28; i++) {
    const a = spin + (i / 28) * TAU;
    p.dot(Math.cos(a) * (L + 1), Math.sin(a) * (L + 1) * S, C[3], 0.3 * (0.5 + 0.5 * Math.sin(a * 2)));
  }
  for (let k = 0; k < 4; k++) {
    const a = spin + (k * TAU) / 4, c = Math.cos(a), s = Math.sin(a), long = k === 0 ? 1.3 : 1;
    // Une branche : flanc éclairé, flanc d'ombre, pointe plus chaude.
    for (let d = 0; d <= L * long; d += 0.5) {
      const hw = d < L * long - 2 ? 1.4 : 2.2;
      for (let e = -hw; e <= hw; e += 0.5) p.px(c * d - s * e, (s * d + c * e) * S, e < -0.5 ? C[5] : e > 0.6 ? C[2] : C[4]);
    }
    p.px(c * L * long, s * L * long * S, WHITE);
  }
  p.circle(0, 0, 2, C[5]);
  p.px(0, 0, WHITE);
  p.glow(0, 0, L * 1.3, C[4], 0.3);
}
