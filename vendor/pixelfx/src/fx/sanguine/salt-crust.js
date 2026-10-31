import { crystal, cycle, fit, noise2, rng, sparkle, GROUND_SQUASH, TAU } from "../../core/index.js";

export const meta = {
  name: "Sanguine salt crust",
  desc: "A trail of consecrated salt seen from above: a pale crust on the ground, small crystals standing in it, cold glints running over them.",
  tags: ["sanguine", "ground", "zone", "salt", "top-down", "loop"],
  size: [44, 40],
  origin: [22, 24],
  duration: 1.2,
  loop: true,
  fps: 10,
  bg: "ground",
  options: { palette: ["#3a3644", "#6a6474", "#9a93a0", "#c4bcc0", "#e4dcd4", "#f7ede0", "#ffffff"], reach: 13, seed: 7 },
};

const S = GROUND_SQUASH;

export function draw(p, t, o) {
  const C = fit(o.palette, 7), R = o.reach, ramp = [C[0], C[1], C[2], C[3], C[4], C[5], C[6]];
  p.shade(-R, -R * S, R, R * S, (x, y, out) => {
    const q = Math.hypot(x, y / S) / R, grain = noise2(x * 0.5, y * 0.6, o.seed);
    if (q > 1 || grain < 0.34 + q * 0.3) return;
    out.c = grain > 0.72 ? C[4] : grain > 0.56 ? C[3] : C[2];
    out.a = 1 - q * 0.5;
  });
  const g = rng(o.seed, 3);
  for (let i = 0; i < 5; i++) {
    const a = g.range(0, TAU), q = Math.sqrt(g.next()) * 0.8 * R;
    crystal(p, Math.round(Math.cos(a) * q), Math.round(Math.sin(a) * q * S), g.range(3, 6), g.range(2, 3.4), g.range(-1, 1), ramp);
  }
  cycle(t, meta.duration, 3, o.seed + 1, 0.4, (age, L, r) => {
    const a = r.range(0, TAU), q = r.next() * 0.8 * R;
    sparkle(p, Math.cos(a) * q, Math.sin(a) * q * S - 3, 2.5 * Math.sin((age / L) * Math.PI), C[6], C[4], 0.3);
  });
}
