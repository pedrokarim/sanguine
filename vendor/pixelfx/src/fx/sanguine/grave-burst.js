import { Lights, P, Particles, Rng, TAU, hex } from "../../core/index.js";

export const meta = {
  name: "Sanguine grave burst",
  desc: "The ground bursts open on a grave: clods of black earth and pale bone chips fly up and fall back, a low skirt of dust rolls out, a cold breath of light escapes from below.",
  tags: ["sanguine", "spawn", "earth", "grave", "top-down", "one-shot"],
  size: [96, 84],
  origin: [48, 60],
  duration: 0.7,
  loop: false,
  fps: 20,
  bg: "ground",
  options: { seed: 3 },
};

const EARTH = ["#1c1410", "#33261a", "#4c3a26"].map(hex);
const BONE = hex("#c8ba98");
const DUST = hex("#4c3f30");
const COLD = hex("#3cff9a");

export function create(o) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, yaw: (r) => r.range(0, TAU) });
  const lights = new Lights();
  lights.add(0, -4, 22, COLD, 0.32, 0.26);
  for (let i = 0; i < 16; i++) ps.spawn(P.GRIT, R.range(-5, 5), -1, R.range(40, 130), R.range(-150, -60), R.range(0.4, 0.62), R.pick(EARTH), R.chance(0.4) ? 2 : 1);
  for (let i = 0; i < 4; i++) ps.spawn(P.GRIT, R.range(-3, 3), -1, R.range(30, 90), R.range(-130, -70), R.range(0.4, 0.6), BONE, 1);
  for (let i = 0; i < 9; i++) ps.spawn(P.DUST, R.range(-6, 6), -1, R.range(30, 90), R.range(-14, -2), R.range(0.3, 0.55), DUST, R.range(2.4, 4.2));
  return {
    update(dt) {
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      ps.draw(p, "back");
    },
    draw(p) {
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
