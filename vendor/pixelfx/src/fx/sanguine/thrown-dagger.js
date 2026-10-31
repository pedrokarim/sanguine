import { fit, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Sanguine thrown dagger",
  desc: "A thrown dagger tumbling end over end: a bright blade, a dark grip and guard, a thin arc of cut air trailing its point.",
  tags: ["sanguine", "projectile", "blade", "dagger", "spin", "loop"],
  size: [40, 40],
  origin: [20, 20],
  duration: 0.24,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: ["#1c1a28", "#33323f", "#6b7a92", "#a8c5d6", "#e4f4fa", "#fff3c4", "#ffffff"], length: 8, seed: 1 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 7), L = o.length, a = (t / meta.duration) * TAU, c = Math.cos(a), s = Math.sin(a);
  for (let i = 1; i < 10; i++) {
    const b = a - i * 0.2;
    p.dot(Math.cos(b) * L, Math.sin(b) * L, i < 4 ? C[3] : C[2], 0.8 - i * 0.08);
  }
  // La lame, large à la garde, nulle à la pointe.
  for (let d = 0; d <= L; d += 0.5) {
    const hw = 1.3 * (1 - d / L);
    for (let e = -hw; e <= hw; e += 0.5) p.px(c * d - s * e, s * d + c * e, e < 0 ? C[4] : C[3]);
  }
  p.px(c * L, s * L, WHITE);
  // La garde et la poignée, de l'autre côté : assez sombres pour que le sens du vol se lise à la pointe.
  for (let e = -2.5; e <= 2.5; e += 0.5) p.px(-s * e, c * e, C[5]);
  for (let d = -4; d < 0; d += 0.5) p.px(c * d, s * d, C[1]);
  p.glow(c * L * 0.5, s * L * 0.5, 7, C[4], 0.22);
}
