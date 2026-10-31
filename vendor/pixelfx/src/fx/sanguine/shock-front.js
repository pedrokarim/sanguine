import { fit, GROUND_SQUASH, hex } from "../../core/index.js";

export const meta = {
  name: "Sanguine shock front",
  desc: "The travelling front of a horn blast: three thick black-inked arcs lying on the ground, one behind the other, the shape everyone reads as a sound.",
  tags: ["sanguine", "shockwave", "projectile", "ground", "top-down", "directional", "loop"],
  size: [100, 88],
  origin: [50, 48],
  duration: 0.2,
  loop: true,
  fps: 15,
  bg: "ground",
  options: { palette: ["#2a1408", "#5a2c10", "#a0561c", "#e89a3c", "#f2c46b", "#fff0c4", "#ffffff"], reach: 26, aim: 0, seed: 2 },
};

const INK = hex("#08060c");
const C2 = (C, c) => C[Math.min(C.length - 1, c)];

export function draw(p, t, o) {
  const C = fit(o.palette, 7), R = o.reach, aim = o.aim, S = GROUND_SQUASH;
  // Les arcs sont centrés derrière le point de frappe : le premier passe par l'origine du projectile.
  const cx = -Math.cos(aim) * R * 0.8, cy = -Math.sin(aim) * R * 0.8 * S;
  const pulse = t / meta.duration;
  [[1, 0.85, 5, 6], [0.72, 0.7, 4, 4], [0.46, 0.55, 3, 3]].forEach(([k, span, thick, c]) => {
    const r = R * k * (1 + pulse * 0.08);
    for (let g = -span; g <= span; g += 1 / r) {
      const taper = Math.ceil(thick * (1 - (Math.abs(g) / span) ** 3));
      for (let e = -1; e <= taper; e++) {
        const q = r - e, x = cx + Math.cos(aim + g) * q, y = cy + Math.sin(aim + g) * q * S;
        p.px(x, y, e === -1 || e === taper ? INK : e === 0 ? C2(C, c) : C[c - 1]);
      }
    }
  });
  p.glowLine(cx + Math.cos(aim - 0.7) * R, cy + Math.sin(aim - 0.7) * R * S, cx + Math.cos(aim + 0.7) * R, cy + Math.sin(aim + 0.7) * R * S, 8, C[4], 0.2);
}
