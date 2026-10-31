import { hex, TAU } from "../../core/index.js";

export const meta = {
  name: "Sanguine mill sails",
  desc: "The four ragged sails of a dead windmill, turning slowly: a dark lattice of beams, torn canvas between them, an iron hub.",
  tags: ["sanguine", "prop", "windmill", "wood", "loop"],
  size: [240, 240],
  origin: [120, 120],
  duration: 4,
  loop: true,
  fps: 12,
  bg: "dark",
  options: { length: 104, seed: 2 },
};

const BEAM = hex("#2e2017"), BEAM_HI = hex("#664930"), CANVAS = hex("#b8aa8c"), TORN = hex("#7e7058"), IRON = hex("#70758c"), INK = hex("#0c0b14");

export function draw(p, t, o) {
  // Un quart de tour par boucle : les quatre ailes étant pareilles, la jonction ne se voit pas.
  const spin = (t / meta.duration) * (TAU / 4), L = o.length;
  for (let k = 0; k < 4; k++) {
    const a = spin + (k * TAU) / 4, c = Math.cos(a), s = Math.sin(a);
    const at = (d, e) => [c * d - s * e, s * d + c * e];
    // La toile, trouée d'autant plus qu'on s'éloigne du moyeu.
    for (let d = 16; d < L; d += 1) {
      const holes = (Math.floor(d / 9) + k) % 4 === 3;
      for (let e = 3; e < 21; e += 1) {
        if (holes && e > 11) continue;
        const [x, y] = at(d, e);
        p.px(x, y, (Math.floor(d / 3) + Math.floor(e / 3)) % 5 === 0 ? TORN : CANVAS);
      }
    }
    for (const e of [2, 21]) for (let d = 12; d < L; d += 0.5) { const [x, y] = at(d, e); p.px(x, y, e === 2 ? BEAM : INK); }
    for (let d = 20; d < L; d += 15) for (let e = 2; e <= 21; e += 0.5) { const [x, y] = at(d, e); p.px(x, y, BEAM); }
    for (let d = 0; d < L + 2; d += 0.5) {
      for (const e of [-1.5, -0.5, 0.5, 1.5]) { const [x, y] = at(d, e); p.px(x, y, e < 0 ? BEAM_HI : BEAM); }
    }
  }
  p.circle(0, 0, 9, INK);
  p.circle(0, 0, 7, IRON);
  p.circle(-1, -1, 3, BEAM_HI);
}
