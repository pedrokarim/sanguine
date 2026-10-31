import { fit, WHITE } from "../../core/index.js";

export const meta = {
  name: "Sanguine mirror shard",
  desc: "One flying glass shard: a faceted splinter pointing along its flight, a glint that runs up it, a short dotted wake.",
  tags: ["sanguine", "projectile", "ice", "glass", "directional", "loop"],
  size: [44, 44],
  origin: [22, 22],
  duration: 0.3,
  loop: true,
  fps: 10,
  bg: "dark",
  options: { palette: ["#0f1a3a", "#1f3a78", "#3a78b8", "#62c0ea", "#7de8ff", "#c4f5ff", "#ffffff"], aim: 0, seed: 1 },
};

const LENGTH = 5;
const WIDTH = 1.6;
const WAKE = 11;

export function draw(p, t, o) {
  const C = fit(o.palette, 7), c = Math.cos(o.aim), s = Math.sin(o.aim), glint = Math.floor((t / meta.duration) * 3);
  // Le sillage d'abord : la pointe doit recouvrir son départ.
  for (let d = 2; d <= WAKE; d += 0.5) {
    const u = d / WAKE;
    p.dot(-c * d, -s * d, u < 0.45 ? C[4] : u < 0.75 ? C[3] : C[2], 1 - u);
  }
  // Le losange : flanc éclairé d'un côté, flanc sombre de l'autre.
  for (let d = -LENGTH * 0.6; d <= LENGTH; d += 0.5) {
    const hw = WIDTH * (d < 0 ? 1 + d / (LENGTH * 0.6) : 1 - d / LENGTH);
    for (let e = -hw; e <= hw; e += 0.5) p.px(c * d - s * e, s * d + c * e, e < -0.3 ? C[5] : e > 0.3 ? C[2] : C[3]);
    p.px(c * d, s * d, Math.floor(((d + LENGTH * 0.6) / (LENGTH * 1.6)) * 3) === glint ? WHITE : C[5]);
  }
  p.glow(0, 0, 6, C[4], 0.3);
  p.glowLine(0, 0, -c * WAKE * 0.7, -s * WAKE * 0.7, 2.5, C[3], 0.2);
}
