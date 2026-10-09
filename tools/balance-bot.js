/**
 * Bot de mesure de l'équilibrage.
 *
 * Le jeu expose `window.sanguine.fastForward(seconds, pilot)`, qui avance la simulation à
 * pas fixes en résolvant montées de niveau et coffres. Le pilote, lui, n'a rien à faire
 * dans le code du jeu : il vit ici.
 *
 * Usage, serveur de développement lancé, dans la console du navigateur :
 *
 *   await import('/tools/balance-bot.js');
 *   balance.report(await balance.runs(4));          // quatre parties complètes
 *   balance.report(await balance.runs(8, { mode: 'kite', minutes: 12 }));   // l'ouverture
 *
 * Le rapport donne aussi `by` : les dégâts subis par type d'ennemi, pour savoir qui tue.
 *
 * Le pilote court en rond autour de son point de départ et s'écarte de ce qui l'approche :
 * c'est la manœuvre de base du genre, celle qu'adopte un joueur au bout de deux parties.
 * Il monte d'abord ce qu'il possède (`policy: 'first'` : la première carte venue).
 * Il ne vise donc pas la meilleure partie possible, mais une partie **ordinaire** : si
 * lui ne risque plus rien, personne ne risque plus rien.
 */

const STEP = 1 / 60;

const KITE_DIRECTIONS = 16;
const KITE_SIGHT = 90;
/** Distance en deçà de laquelle un ennemi compte comme une menace, après son avance. */
const KITE_FEAR = 30;
const KITE_LOOKAHEAD = 0.45;

/**
 * Pilote « esquive » : parmi seize directions, prend celle qui mène à l'endroit le moins
 * menacé une demi-seconde plus tard, en comptant où seront les ennemis qui le poursuivent.
 *
 * Le pilote en rond suffit pour la fin de partie, où tout meurt avant le contact, mais il
 * se jette sur les loups de l'ouverture. Celui-ci fait ce que fait un joueur : il regarde
 * d'où ça vient, s'écarte, et revient chercher ses gemmes quand la voie est libre.
 */
function kite(w, memory) {
  const pl = w.player;
  const speed = pl.stats.moveSpeed;
  const threats = [];
  const found = w.grid.query(pl.x, pl.y, KITE_SIGHT);
  for (let i = 0; i < found; i++) {
    const e = w.enemies[w.grid.result[i]];
    if (!e || !e.active || e.dying > 0 || e.def.decor) continue;
    threats.push(e);
  }

  // Gemme la plus proche : ce qui attire quand rien ne menace.
  let gem = null;
  let gemD = 220 * 220;
  for (const p of w.pickups) {
    if (!p.active) continue;
    const d = (p.x - pl.x) ** 2 + (p.y - pl.y) ** 2;
    if (d < gemD) { gemD = d; gem = p; }
  }

  let best = { x: 0, y: 0 };
  let bestScore = Infinity;
  for (let k = 0; k <= KITE_DIRECTIONS; k++) {
    // La dernière option est de rester sur place.
    const moving = k < KITE_DIRECTIONS;
    const a = (k / KITE_DIRECTIONS) * Math.PI * 2;
    const dx = moving ? Math.cos(a) : 0;
    const dy = moving ? Math.sin(a) : 0;
    const fx = pl.x + dx * speed * KITE_LOOKAHEAD;
    const fy = pl.y + dy * speed * KITE_LOOKAHEAD;

    let danger = 0;
    for (const e of threats) {
      // L'ennemi avance vers la position visée pendant le même laps de temps.
      const d = Math.hypot(fx - e.x, fy - e.y) || 1;
      const closed = Math.max(4, d - e.speed * KITE_LOOKAHEAD);
      const fear = KITE_FEAR * (e.boss ? 2.2 : 1);
      if (closed < fear) danger += e.def.damage * (1 - closed / fear);
    }
    let score = danger;
    if (gem) score += Math.hypot(gem.x - fx, gem.y - fy) * 0.02;
    // Un peu d'inertie : sans elle, le bot tremble entre deux directions équivalentes.
    score -= (dx * memory.x + dy * memory.y) * 0.25;
    if (score < bestScore) { bestScore = score; best = { x: dx, y: dy }; }
  }
  memory.x = best.x;
  memory.y = best.y;
  return best;
}

function makePilot(options, tally) {
  const avoid = options.avoid ?? 40;
  const push = options.push ?? 30;
  const radius = options.radius ?? 130;
  let origin = null;
  let angle = 0;
  let lastHp = null;
  const memory = { x: 0, y: 0 };

  return (w) => {
    const pl = w.player;
    if (lastHp !== null && pl.hp < lastHp - 0.5) {
      tally.taken += lastHp - pl.hp;
      // Qui a frappé ? Le plus proche au moment du coup : assez juste pour un relevé.
      const culprit = w.nearestEnemy(pl.x, pl.y, 60);
      const id = culprit ? culprit.def.id : 'projectile';
      tally.by[id] = (tally.by[id] ?? 0) + Math.round(lastHp - pl.hp);
    }
    lastHp = pl.hp;
    if (options.mode === 'still') return { x: 0, y: 0 };
    if (options.mode === 'kite') return kite(w, memory);

    origin ??= { x: pl.x, y: pl.y };
    angle += (pl.stats.moveSpeed / radius) * STEP * 0.92;
    let fx = origin.x + Math.cos(angle) * radius - pl.x;
    let fy = origin.y + Math.sin(angle) * radius * 0.8 - pl.y;
    const toTarget = Math.hypot(fx, fy) || 1;
    fx /= toTarget;
    fy /= toTarget;

    const found = w.grid.query(pl.x, pl.y, avoid);
    for (let i = 0; i < found; i++) {
      const e = w.enemies[w.grid.result[i]];
      if (!e || !e.active || e.dying > 0 || e.def.decor) continue;
      const dx = pl.x - e.x;
      const dy = pl.y - e.y;
      const d = Math.hypot(dx, dy) + 0.5;
      if (d > avoid) continue;
      fx += (dx * push) / (d * d);
      fy += (dy * push) / (d * d);
    }
    const m = Math.hypot(fx, fy);
    return m > 1e-6 ? { x: fx / m, y: fy / m } : { x: 0, y: 0 };
  };
}

/**
 * Politique de choix « concentrée » : monter ce qu'on possède avant d'ajouter autre chose.
 * C'est ce que fait un joueur dès qu'il a compris que les évolutions demandent une arme au
 * niveau maximal. `policy: 'first'` rétablit la première carte venue.
 */
const PICK_ORDER = ['weapon-up', 'passive-up', 'weapon-new', 'passive-new', 'surpassement', 'consolation'];

function pickFocused(offers) {
  let best = offers[0];
  for (const offer of offers) {
    if (PICK_ORDER.indexOf(offer.kind) < PICK_ORDER.indexOf(best.kind)) best = offer;
  }
  return best;
}

/** Build de référence d'un joueur arrivé au milieu de partie : six armes et leurs six objets. */
const MID_WEAPONS = ['stake', 'cross', 'garlic', 'water', 'lantern', 'scythe'];
const MID_PASSIVES = ['powder', 'scope', 'chalice', 'grimoire', 'hourglass', 'reliquary'];

/**
 * Place la partie à la minute `from.minute`, build de référence monté.
 *
 * L'ouverture se mesure mal au bot : il court en rond, se fait rattraper par les loups et
 * meurt là où un joueur passe sans y penser. Pour juger la **suite**, on part donc d'un
 * état connu plutôt que de ne mesurer que les rares parties où le bot a survécu.
 */
function startMidRun(game, w, from) {
  const pl = w.player;
  pl.weapons.length = 0;
  for (const id of MID_WEAPONS) {
    const inst = pl.addWeapon(id);
    inst.level = inst.def.maxLevel;
  }
  for (const id of MID_PASSIVES) for (let i = 0; i < 5; i++) pl.addPassive(id);
  pl.level = from.level;
  pl.xp = 0;
  pl.xpNext = from.xpNext ?? pl.xpNext;
  pl.recompute();
  pl.hp = pl.stats.maxHp;
  w.time = from.minute * 60;
  // Les événements antérieurs sont réputés joués : sinon tous se déclencheraient d'un coup.
  const fired = [];
  from.events.forEach((at, i) => { if (at <= from.minute) fired.push(i); });
  game.director.restore({ events: fired, reaper: false });
}

/** Joue une partie et rend un relevé par minute. */
function run(options = {}) {
  const game = window.sanguine;
  game.startRun(options.character ?? 'ysolde');
  const w = game.world;
  if (options.from) startMidRun(game, w, options.from);
  const tally = { taken: 0, by: {} };
  const pilot = makePilot(options, tally);
  const rows = [];
  let lastKills = 0;

  for (let minute = (options.from?.minute ?? 0) + 1; minute <= (options.minutes ?? 30); minute++) {
    tally.taken = 0;
    game.fastForward(60, pilot, options.policy === 'first' ? undefined : pickFocused);
    const pl = w.player;
    rows.push({
      minute,
      level: pl.level,
      maxHp: Math.round(pl.stats.maxHp),
      taken: Math.round(tally.taken),
      alive: w.aliveEnemies,
      kills: w.kills - lastKills,
      maxed: pl.weapons.filter((x) => x.level >= x.def.maxLevel || x.def.isEvolution).length,
      evolved: pl.weapons.filter((x) => x.def.isEvolution).length,
      overflow: [...pl.surpassements.values()].reduce((a, b) => a + b, 0),
      gold: w.gold,
      state: w.state,
    });
    lastKills = w.kills;
    if (w.state !== 'playing') break;
  }
  rows.by = tally.by;
  return rows;
}

/** Joue `count` parties, en rendant la main au navigateur entre deux. */
async function runs(count, options = {}) {
  const all = [];
  for (let i = 0; i < count; i++) {
    all.push(run(options));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return all;
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : 0;
};

/**
 * Résume des parties par tranche de trois minutes.
 *
 * `hurt` est la part des PV max perdue dans la tranche, en pourcentage : c'est le chiffre
 * qui dit si la partie se joue encore. Zéro pendant dix minutes, et il n'y a plus de jeu.
 */
function report(all) {
  const out = { ends: all.map((rows) => `${rows.at(-1).state}@${rows.at(-1).minute}`), buckets: [] };
  // Dégâts subis par type d'ennemi, toutes parties confondues, du plus coûteux au moins.
  const by = {};
  for (const rows of all) for (const [id, v] of Object.entries(rows.by ?? {})) by[id] = (by[id] ?? 0) + v;
  out.by = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, v]) => `${id}=${v}`).join(' ');
  const first = Math.min(...all.map((rows) => rows[0].minute));
  for (let from = first; from <= 30; from += 3) {
    const alive = all.filter((rows) => rows.at(-1).minute >= from);
    if (alive.length === 0) break;
    const slice = alive.map((rows) => rows.filter((r) => r.minute >= from && r.minute < from + 3));
    const last = slice.map((rows) => rows.at(-1));
    out.buckets.push(
      `${String(from).padStart(2)}-${String(from + 2).padStart(2)}` +
      ` n=${alive.length}` +
      ` lvl=${median(last.map((r) => r.level))}` +
      ` hurt=${median(slice.map((rows) => Math.round((100 * rows.reduce((a, r) => a + r.taken, 0)) / rows.at(-1).maxHp)))}%` +
      ` alive=${median(last.map((r) => r.alive))}` +
      ` kills/min=${median(last.map((r) => r.kills))}` +
      ` maxed=${median(last.map((r) => r.maxed))}` +
      ` evolved=${median(last.map((r) => r.evolved))}` +
      ` overflow=${median(last.map((r) => r.overflow))}` +
      ` gold=${median(last.map((r) => r.gold))}`,
    );
  }
  return out;
}

window.balance = { run, runs, report };
