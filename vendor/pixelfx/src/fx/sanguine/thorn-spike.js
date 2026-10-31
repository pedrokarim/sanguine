import { Particles, P, Rng, crystal, fit, smooth, ease, GROUND_SQUASH, TAU } from "../../core/index.js";

export const meta = {
  name: "Sanguine thorn spike",
  desc: "A cluster of thorns bursts out of the ground around its point of impact, seen from above: the soil splits, the spikes ram up, hold, sink back in a spray of grit.",
  tags: ["sanguine", "ground", "thorn", "spike", "top-down", "one-shot"],
  size: [60, 62],
  origin: [30, 46],
  duration: 0.6,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#1a0e16", "#3a2b46", "#4d3557", "#654166", "#7c5175", "#9a6b86", "#d8b0c0", "#ffffff"], dust: "#654166", height: 26, width: 7, seed: 5 },
};

const UP = 0.09, HOLD = 0.34;

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), S = GROUND_SQUASH, ramp = [C[0], C[1], C[2], C[3], C[4], C[5], C[6], C[7]];
  const ps = new Particles({ rng: R, ground: () => 0, yaw: (r) => r.range(0, TAU) });
  const spikes = [
    { x: -6, y: -2, h: 0.62, w: 0.72, lean: -2.4 },
    { x: 7, y: -1, h: 0.7, w: 0.74, lean: 2.6 },
    { x: 0, y: 0, h: 1, w: 1, lean: R.range(-1.2, 1.2) },
    { x: -4, y: 4, h: 0.42, w: 0.6, lean: -1.4 },
    { x: 5, y: 5, h: 0.46, w: 0.62, lean: 1.8 },
  ];
  for (let i = 0; i < 9; i++) ps.spawn(P.GRIT, 2, -1, R.range(30, 90), R.range(-120, -50), R.range(0.3, 0.44), o.dust, R.chance(0.3) ? 2 : 1);
  for (let i = 0; i < 4; i++) ps.spawn(P.DUST, 2, -1, R.range(10, 34), R.range(-16, -4), R.range(0.24, 0.4), o.dust, R.range(2, 3.4));
  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
    },
    drawBack(p) {
      // La fente au sol, ouverte par le choc, qui se referme avec les pointes.
      const k = 1 - smooth(HOLD, meta.duration, t), r = 13 * ease.outCubic(Math.min(1, t / UP));
      p.shade(-r, -r * S, r, r * S, (x, y, out) => {
        const q = Math.hypot(x, y / S) / r;
        if (q > 1) return;
        out.c = q > 0.74 ? C[3] : q > 0.4 ? C[1] : C[0];
        out.a = k * (1.2 - q * 0.6);
      });
      ps.draw(p, "back");
    },
    draw(p) {
      const up = t < UP ? ease.outBack(t / UP) : 1 - smooth(HOLD, meta.duration - 0.04, t);
      if (up > 0.02) for (const s of spikes) crystal(p, s.x, s.y, o.height * s.h * up, o.width * s.w, s.lean * up, ramp);
      ps.draw(p, "front");
      if (t < 0.1) p.glow(0, -6, 14, C[6], 0.3 * (1 - t / 0.1));
    },
  };
}
