import { TAU, hex, rand, smooth } from "../../core/index.js";

export const meta = {
  name: "Sanguine incense cloud",
  desc: "A slow cloud of blessed incense seen from above: thick rolling puffs lit on their top side, drifting low over the ground, shot through with rising gold motes.",
  tags: ["sanguine", "smoke", "holy", "cloud", "top-down", "loop"],
  size: [96, 84],
  origin: [48, 46],
  duration: 0.9,
  loop: true,
  fps: 15,
  bg: "ground",
  options: { reach: 30, seed: 3 },
};

const SHADOW = hex("#54463e"), BODY = hex("#a48e6c"), LIT = hex("#f0e0b0"), MOTE = hex("#ffe85c"), HOT = hex("#fffdf4");
const SQUASH = 0.72;
const PUFFS = 12, MOTES = 10;

export function draw(p, t, o) {
  const u = t / meta.duration, life = smooth(0, 0.2, u) * (1 - smooth(0.68, 1, u)), R = o.reach;
  for (let i = 0; i < PUFFS; i++) {
    const a = rand(o.seed, i, 1) * TAU, d = Math.sqrt(rand(o.seed, i, 2)) * R * 0.78;
    const r = (5 + rand(o.seed, i, 3) * 6) * (0.75 + u * 0.55);
    const x = Math.cos(a + u * 0.5) * d, y = Math.sin(a + u * 0.5) * d * SQUASH - u * 7;
    p.disc(x + 1, y + 2, r, SHADOW, 0.5 * life);
    p.disc(x, y, r * 0.86, BODY, 0.62 * life);
    p.disc(x - r * 0.22, y - r * 0.3, r * 0.48, LIT, 0.6 * life);
  }
  for (let i = 0; i < MOTES; i++) {
    const v = (u * 2 + rand(o.seed, i, 5)) % 1, a = rand(o.seed, i, 6) * TAU, d = rand(o.seed, i, 7) * R;
    if (v < 0.8 && life > 0.2) p.px(Math.cos(a) * d, Math.sin(a) * d * SQUASH - v * 16, v < 0.3 ? HOT : MOTE);
  }
  p.glow(0, -2, R * 1.1, MOTE, 0.12 * life);
}
