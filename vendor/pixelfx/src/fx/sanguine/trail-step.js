import { burst, crystal, fit, seg, sparkle, GROUND_SQUASH, TAU, WHITE } from "../../core/index.js";

export const meta = {
  name: "Sanguine trail step",
  desc: "One footprint of a cosmetic trail: ash that settles, frost that crystallises, embers that rise, molten gold that cools, or a rift in the void that closes.",
  tags: ["sanguine", "cosmetic", "trail", "ground", "top-down", "one-shot"],
  size: [60, 56],
  origin: [30, 38],
  duration: 0.9,
  loop: false,
  fps: 15,
  bg: "ground",
  options: { palette: ["#160a2c", "#3a1a6a", "#6a2cb0", "#a855f7", "#c88cff", "#e4c4ff", "#ffffff"], style: 0, seed: 3 },
};

const S = GROUND_SQUASH;

export function draw(p, t, o) {
  const C = fit(o.palette, 7), k = t / meta.duration, fade = 1 - k, seed = o.seed;
  switch (o.style) {
    case 0: // cendre : une fumée qui s'étale, des flocons qui retombent
      burst(4, seed, (r) => {
        const a = r.range(0, TAU), d = r.range(1, 6) * (0.5 + k);
        p.disc(Math.cos(a) * d, Math.sin(a) * d * S - k * 7, 2 + k * 4, C[3], 0.4 * fade);
      });
      burst(7, seed + 1, (r) => {
        const x = r.range(-8, 8), y0 = r.range(-14, -5);
        p.dot(x + Math.sin(k * 6 + x) * 1.5, y0 + k * 15, r.chance(0.5) ? C[5] : C[4], fade * 1.4);
      });
      break;
    case 1: { // givre : le sol gèle, des cristaux poussent puis fondent
      const up = Math.min(1, t / 0.14) * (1 - seg(t, 0.55, 0.9));
      p.shade(-7, -7 * S, 7, 7 * S, (x, y, out) => {
        const q = Math.hypot(x, y / S) / 7;
        if (q > 1) return;
        out.c = q > 0.72 ? C[5] : C[3];
        out.a = fade * (1.1 - q * 0.5);
      });
      burst(3, seed, (r) => {
        const a = r.range(0, TAU), d = r.range(1, 5);
        crystal(p, Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d * S), r.range(4, 8) * up, r.range(2, 3), r.range(-1, 1), [C[0], C[1], C[2], C[3], C[4], C[5], C[6]]);
      });
      if (t < 0.4) sparkle(p, 2, -5, 3 * (1 - t / 0.4), WHITE, C[5], 0.3);
      break;
    }
    case 2: // braises : le sol rougeoie sous le pas, des étincelles montent
      p.glow(0, 0, 8, C[4], 0.3 * fade);
      p.shade(-5, -5 * S, 5, 5 * S, (x, y, out) => {
        const q = Math.hypot(x, y / S) / 5;
        if (q > 1) return;
        out.c = q < 0.4 ? C[5] : C[3];
        out.a = fade * 0.9;
      });
      burst(7, seed, (r) => {
        const x = r.range(-6, 6), v = r.range(14, 30), s = r.range(0, 7);
        const c = k < 0.35 ? C[6] : k < 0.7 ? C[5] : C[3];
        p.dot(x + Math.sin(k * 7 + s) * 2, -k * v, c, fade * 1.5);
        p.glow(x, -k * v, 2.5, C[4], 0.14 * fade);
      });
      break;
    case 3: // or fondu : une flaque qui refroidit, des éclats qui retombent
      p.shade(-7, -7 * S, 7, 7 * S, (x, y, out) => {
        const q = Math.hypot(x, y / S) / 7;
        if (q > 1) return;
        const lit = x + y < -2 ? 6 : q > 0.66 ? 3 : 5 - Math.round(k * 2);
        out.c = C[lit];
        out.a = 1.3 - k * 1.2;
      });
      burst(4, seed, (r) => {
        const a = r.range(0, TAU), d = r.range(2, 8), z = Math.sin(k * Math.PI) * r.range(5, 12);
        p.dot(Math.cos(a) * d, Math.sin(a) * d * S - z, C[6], fade * 1.4);
      });
      if (t < 0.3) sparkle(p, -2, -3, 3 * (1 - t / 0.3), WHITE, C[5], 0.3);
      break;
    default: { // vide : une faille s'ouvre, tourne et se referme
      const open = Math.sin(k * Math.PI), r0 = 8 * open;
      if (r0 > 0.8) {
        p.shade(-r0, -r0 * S, r0, r0 * S, (x, y, out) => {
          const q = Math.hypot(x, y / S) / r0;
          if (q > 1) return;
          const spiral = Math.sin(Math.atan2(y / S, x) * 2 + q * 7 - k * 9);
          out.c = q < 0.5 ? C[0] : spiral > 0.2 ? C[4] : C[1];
        });
      }
      burst(6, seed, (r) => {
        const a = r.range(0, TAU) + k * 3, d = r.range(4, 11) * fade;
        p.dot(Math.cos(a) * d, Math.sin(a) * d * S - k * 6, C[5], fade * 1.4);
      });
    }
  }
}
