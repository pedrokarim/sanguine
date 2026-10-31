import { audio } from '../audio/audio';
import { cemeteryWarning } from '../data/sites';
import { RANG_BY_ID } from '../data/waves';
import type { Site } from './siteplan';
import type { World } from './world';

/** À cette distance, une garnison se lève : juste hors de l'écran, quelle que soit la fenêtre. */
const WAKE_RANGE = 760;
/** Durée de la sortie de terre. */
export const RISE_TIME = 0.9;

/**
 * Habitants des lieux.
 *
 * Un château vide serait un décor. Chaque salle, chaque cour porte sa garnison, posée à la main
 * sur le plan ; elle se lève une seule fois, quand le héros approche, et jamais sous ses yeux :
 * une créature qui apparaît à l'écran se lit comme un bug.
 */
export function updateGarrisons(w: World, dt: number): void {
  const sites = w.terrain.sites;
  if (sites.entered) w.announce(sites.entered.name, sites.entered.subtitle);
  const site = sites.active;
  if (!site) return;
  // Tableau vide : ce cimetière s'est déjà réveillé, à cette partie-ci ou avant une reprise.
  if (site.risers?.length) wakeTheDead(w, site, dt);

  const pl = w.player;
  for (const g of site.garrison) {
    if (g.done) continue;
    const dx = g.x - pl.x, dy = g.y - pl.y;
    if (dx * dx + dy * dy > WAKE_RANGE * WAKE_RANGE) continue;
    if (w.cam.visible(g.x, g.y, g.spread + 16)) continue;
    g.done = true;
    const rank = g.rank ? RANG_BY_ID.get(g.rank) ?? null : null;
    for (let i = 0; i < g.count; i++) {
      // Quelques tirages suffisent : une place libre se trouve vite, et un corps de moins ne se voit pas.
      for (let k = 0; k < 6; k++) {
        const x = g.x + w.rng.spread(g.spread), y = g.y + w.rng.spread(g.spread * 0.7);
        if (sites.isSolid(x, y)) continue;
        w.spawnEnemy(g.enemy, x, y, false, rank);
        break;
      }
    }
  }
}

/**
 * Le cimetière, à la première entrée : les morts sortent de leur tombe sous les yeux du joueur.
 *
 * C'est la seule apparition à l'écran du jeu, et elle n'a rien d'un bug : la terre s'ouvre d'abord,
 * le corps monte ensuite. Il ne bouge qu'une fois debout, pour laisser au joueur le temps de rire.
 */
function wakeTheDead(w: World, site: Site, dt: number): void {
  const pl = w.player, b = site.bounds;
  if (site.riseClock < 0) {
    if (pl.x < b.x || pl.y < b.y || pl.x > b.x + b.w || pl.y > b.y + b.h) return;
    site.riseClock = 0;
    w.terrain.sites.risen.add(site.id);
    w.announce(cemeteryWarning(), site.name, 3.5, true);
    audio.play('boss');
    w.cam.shake(0.2);
  }
  site.riseClock += dt;
  const risers = site.risers!;
  for (let i = risers.length - 1; i >= 0; i--) {
    const r = risers[i]!;
    if (r.delay > site.riseClock) continue;
    risers.splice(i, 1);
    w.vfx.graveBurst(r.x, r.y);
    const e = w.spawnEnemy(r.enemy, r.x, r.y);
    if (e) {
      e.rise = RISE_TIME;
      e.stun = RISE_TIME;
    }
  }
}
