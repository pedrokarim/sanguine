import { Particles, Lights, P, Rng, fit, band, sparkle, smooth, GROUND_SQUASH, WHITE, TAU } from "../../core/index.js";

export const meta = {
  name: "Sanguine crit",
  desc: "A critical hit seen from above: a gold star snaps open, a thin ring runs across the ground and sparks spray all round, with most of them along the blow.",
  tags: ["sanguine", "impact", "crit", "gold", "top-down", "one-shot"],
  size: [104, 80],
  origin: [52, 54],
  duration: 0.42,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#4a2412", "#a4561c", "#e89a3c", "#f2c46b", "#ffe59a", "#fff3c4", "#ffffff"], height: 7, aim: 0, reach: 26, seed: 4 },
};

export function create(o) {
  const C = fit(o.palette, 7), R = new Rng(o.seed), Y = -o.height, aim = o.aim, ramp = [C[1], C[2], C[3], C[4], C[5], C[6]];
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [C[6], C[5], C[4], C[2]], yaw: (r) => (r.chance(0.6) ? aim + r.range(-0.6, 0.6) : r.range(0, TAU)) });
  const lights = new Lights();
  lights.add(0, Y, 24, C[4], 0.42, 0.2);
  lights.add(0, -1, 18, C[3], 0.2, 0.26);
  for (let i = 0; i < 12; i++) ps.spawn(P.SPARK, 1, Y, R.range(80, 210), R.range(-85, -20), R.range(0.18, 0.34), WHITE);
  for (let i = 0; i < 5; i++) ps.spawn(P.STAR, 1, Y, R.range(30, 80), R.range(-60, -10), R.range(0.2, 0.36), C[5], R.range(0.6, 1.4));

  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      ps.draw(p);
      // L'anneau court au sol : c'est lui qui ancre le coup sur le terrain.
      const k = smooth(0, 0.22, t);
      if (t < 0.26) band(p, 0, 0, 5 + o.reach * k, GROUND_SQUASH, 2.2 * (1 - k) + 0.6, 1 - k, ramp);
      const star = 1 - smooth(0.02, 0.14, t);
      if (star > 0) sparkle(p, 0, Y, 18 * Math.min(1, t / 0.03 + 0.5) * star, WHITE, C[4], 0.55);
      const pop = Math.exp(-t / 0.06);
      if (pop > 0.02) {
        p.glow(0, Y, 16, C[4], 0.34 * pop);
        p.glow(0, Y, 6, WHITE, 0.2 * pop);
      }
      lights.draw(p);
    },
  };
}
