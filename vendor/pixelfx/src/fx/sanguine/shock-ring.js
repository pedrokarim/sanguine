import { Particles, Lights, P, Rng, band, fit, smooth, GROUND_SQUASH, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Sanguine shock ring",
  desc: "A horn blast seen from above: two rings run out across the ground, thick then thin, throwing dust and grit outward and flattening the air around the wielder.",
  tags: ["sanguine", "shockwave", "ground", "top-down", "one-shot"],
  size: [172, 136],
  origin: [86, 74],
  duration: 0.55,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#2a1408", "#5a2c10", "#a0561c", "#e89a3c", "#f2c46b", "#fff0c4", "#ffffff"], dust: "#8a5a34", reach: 70, seed: 6 },
};

export function create(o) {
  const C = fit(o.palette, 7), R = new Rng(o.seed), S = GROUND_SQUASH, ramp = [C[1], C[2], C[3], C[4], C[5], C[6]], yaw = (r) => r.range(0, TAU);
  const ps = new Particles({ rng: R, ground: () => 0, yaw });
  const lights = new Lights();
  lights.add(0, -6, 34, C[4], 0.3, 0.2);
  for (let i = 0; i < 26; i++) ps.spawn(P.DUST, 8, -1, R.range(90, 220), R.range(-18, -2), R.range(0.26, 0.46), o.dust, R.range(2.4, 4.4));
  for (let i = 0; i < 14; i++) ps.spawn(P.GRIT, 6, -1, R.range(70, 180), R.range(-80, -20), R.range(0.3, 0.42), R.pick([C[2], C[3]]));
  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      ps.draw(p, "back");
    },
    draw(p) {
      const k = smooth(0, 0.34, t), k2 = smooth(0.07, 0.42, t), r = 8 + o.reach * k;
      if (t < 0.4) band(p, 0, 0, r, S, 5 * (1 - k) + 1.2, 1.1 - k, ramp, () => true, true);
      if (t > 0.07 && t < 0.46) band(p, 0, 0, 5 + o.reach * 0.7 * k2, S, 2.2 * (1 - k2) + 0.8, 0.9 * (1 - k2), ramp);
      ps.draw(p, "front");
      const pop = Math.exp(-t / 0.06);
      if (pop > 0.02) {
        p.glow(0, -6, 22, C[4], 0.3 * pop);
        p.glow(0, -6, 7, WHITE, 0.12 * pop);
      }
      lights.draw(p);
    },
  };
}
