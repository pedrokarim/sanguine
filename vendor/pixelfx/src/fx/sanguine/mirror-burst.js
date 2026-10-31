import { Particles, Bits, Lights, P, B, Rng, fit, band, sparkle, smooth, GROUND_SQUASH, WHITE, TAU } from "../../core/index.js";

export const meta = {
  name: "Sanguine mirror burst",
  desc: "The Mirror bursting from above: a pane of light snaps around the wielder, a ring of glass runs across the ground and splinters fall all round.",
  tags: ["sanguine", "ice", "glass", "nova", "top-down", "one-shot"],
  size: [132, 104],
  origin: [66, 62],
  duration: 0.5,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#0f1a3a", "#1f3a78", "#3a78b8", "#62c0ea", "#7de8ff", "#c4f5ff", "#ffffff"], reach: 44, height: 8, seed: 4 },
};

export function create(o) {
  const C = fit(o.palette, 7), R = new Rng(o.seed), Y = -o.height, ramp = [C[1], C[2], C[3], C[4], C[5], C[6]], around = (r) => r.range(0, TAU);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [C[6], C[5], C[4], C[2]], yaw: around });
  const bits = new Bits({ rng: R, ground: () => 0, yaw: around });
  const lights = new Lights();
  lights.add(0, Y, 26, C[4], 0.34, 0.22);
  lights.add(0, -1, 22, C[3], 0.18, 0.3);
  for (let i = 0; i < 10; i++) ps.spawn(P.STREAK, 4, Y, R.range(60, 130), R.range(-35, -5), R.range(0.16, 0.3), C[R.int(4, 5)]);
  for (let i = 0; i < 12; i++) bits.add({ kind: B.SHARD, x: 3, y: Y, vx: R.range(40, 150), vy: R.range(-110, -30), a: R.range(0, TAU), va: R.range(-16, 16), s: R.range(3, 6), c: C[R.int(3, 5)], g: 0.42, bounce: 0.2, life: R.range(0.34, 0.5) });

  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      bits.update(dt);
      lights.update(dt);
    },
    draw(p) {
      // La vitre au sol : un disque tramé que l'anneau pousse devant lui, plus clair près du bord.
      const k = smooth(0, 0.3, t), k2 = smooth(0.05, 0.36, t), r0 = 6 + o.reach * k, S = GROUND_SQUASH;
      if (t < 0.36) p.shade(-r0, -r0 * S, r0, r0 * S, (x, y, out) => {
        const q = Math.hypot(x, y / S) / r0;
        if (q > 1) return;
        out.c = q > 0.82 ? C[4] : q > 0.6 ? C[3] : C[2];
        out.a = q * q * (1 - k) * 0.85;
      });
      // Des fêlures rayonnent : c'est elles qui disent qu'il s'agit de verre et non d'une onde.
      if (t < 0.4) for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + o.seed, ca = Math.cos(a), sa = Math.sin(a) * S, fade = 1 - smooth(0.1, 0.3, t);
        // Partent loin du héros : à ses pieds, elles le barreraient.
        for (let d = r0 * 0.55; d <= r0 * 0.94; d += 0.5) p.dot(ca * d + Math.sin(d * 0.7 + i) * 0.7, sa * d, d > r0 * 0.75 ? C[6] : C[5], fade * 0.7);
      }
      if (t < 0.36) band(p, 0, 0, r0, S, 3.4 * (1 - k) + 1.1, 1.15 - k * k, ramp, () => true, true);
      if (t > 0.05 && t < 0.42) band(p, 0, 0, 3 + o.reach * 0.72 * k2, S, 1.5, (1 - k2) * 0.9, ramp);
      bits.draw(p);
      ps.draw(p);
      const star = 1 - smooth(0.03, 0.16, t);
      if (star > 0) sparkle(p, 0, Y, 12 * star, WHITE, C[5], 0.4);
      const pop = Math.exp(-t / 0.07);
      if (pop > 0.02) {
        p.glow(0, Y, 20, C[4], 0.3 * pop);
        p.glow(0, Y, 5, WHITE, 0.1 * pop);
      }
      lights.draw(p);
    },
  };
}
