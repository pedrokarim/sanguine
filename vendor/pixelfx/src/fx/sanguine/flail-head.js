import { fit, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Sanguine flail head",
  desc: "The head of a flail in full swing: a shaded iron ball studded with spikes that turn with it, one cold glint on the top left.",
  tags: ["sanguine", "projectile", "melee", "flail", "spin", "loop"],
  size: [36, 36],
  origin: [18, 18],
  duration: 0.3,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: ["#0e0c14", "#232b40", "#2d3654", "#4a5470", "#7a86a0", "#b0bccc", "#ffffff"], size: 6, seed: 1 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 7), R = o.size, spin = (t / meta.duration) * (TAU / 6);
  for (let i = 0; i < 6; i++) {
    const a = spin + (i * TAU) / 6, c = Math.cos(a), s = Math.sin(a);
    for (let d = R - 1; d <= R + 3; d += 0.5) p.px(c * d, s * d, d > R + 1.5 ? C[5] : C[3]);
  }
  p.circle(0, 0, R, (d, a) => {
    const lit = Math.cos(a + 2.4) * d;
    return d > 0.86 ? C[1] : lit > 0.3 ? C[4] : lit > -0.1 ? C[3] : C[2];
  });
  p.px(-2, -2, WHITE);
  p.px(-1, -3, C[5]);
  p.glow(0, 0, R * 1.6, C[4], 0.14);
}
