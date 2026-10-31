// Seule porte d'entrée du jeu dans pixelfx : ce fichier fixe ce qui entre dans le bundle.
export { createFrame, clearFrame, createFx, composite } from "./core/index.js";

import * as hit from "./fx/sanguine/hit.js";
import * as crit from "./fx/sanguine/crit.js";
import * as bloodBurst from "./fx/sanguine/blood-burst.js";
import * as scytheArc from "./fx/sanguine/scythe-arc.js";
import * as mirrorBurst from "./fx/sanguine/mirror-burst.js";
import * as mirrorShard from "./fx/sanguine/mirror-shard.js";
import * as emberPatch from "./fx/sanguine/ember-patch.js";
import * as saltCrust from "./fx/sanguine/salt-crust.js";
import * as spinningCross from "./fx/sanguine/spinning-cross.js";
import * as thrownDagger from "./fx/sanguine/thrown-dagger.js";
import * as flailHead from "./fx/sanguine/flail-head.js";
import * as thornSpike from "./fx/sanguine/thorn-spike.js";
import * as shockRing from "./fx/sanguine/shock-ring.js";
import * as shockFront from "./fx/sanguine/shock-front.js";
import * as heroAura from "./fx/sanguine/hero-aura.js";
import * as trailStep from "./fx/sanguine/trail-step.js";
import * as skillLife from "./fx/sanguine/skill-life.js";
import * as judgementBolt from "./fx/sanguine/judgement-bolt.js";
import * as paintedFlight from "./fx/sanguine/painted-flight.js";
import * as incenseCloud from "./fx/sanguine/incense-cloud.js";
import * as graveBurst from "./fx/sanguine/grave-burst.js";
import * as millSails from "./fx/sanguine/mill-sails.js";
import * as campfire from "./fx/fire/campfire.js";
import * as spiritFlame from "./fx/fire/spirit-flame.js";

import * as arrow from "./fx/projectiles/arrow.js";
import * as fireball from "./fx/fire/fireball.js";
import * as sunburst from "./fx/holy/sunburst.js";
import * as holyPillar from "./fx/holy/holy-pillar.js";
import * as arcaneOrb from "./fx/arcane/arcane-orb.js";
import * as ghost from "./fx/critters/ghost.js";
import * as waterOrb from "./fx/water/water-orb.js";
import * as whirlpool from "./fx/water/whirlpool.js";
import * as splash from "./fx/water/splash.js";
import * as lightningStrike from "./fx/lightning/lightning-strike.js";
import * as zapHit from "./fx/lightning/zap-hit.js";
import * as smite from "./fx/holy/smite.js";
import * as darkExplosion from "./fx/shadow/dark-explosion.js";
import * as smallExplosion from "./fx/explosions/small-explosion.js";
import * as manaBurst from "./fx/arcane/mana-burst.js";
import * as runeCircle from "./fx/arcane/rune-circle.js";
import * as frostBreath from "./fx/ice/frost-breath.js";
import * as bat from "./fx/critters/bat.js";
import * as bird from "./fx/critters/bird.js";
import * as eyeball from "./fx/critters/eyeball.js";
import * as flyingSkull from "./fx/critters/flying-skull.js";
import * as frog from "./fx/critters/frog.js";
import * as jellyfish from "./fx/critters/jellyfish.js";
import * as slime from "./fx/critters/slime.js";
import * as snake from "./fx/critters/snake.js";
import * as wisp from "./fx/critters/wisp.js";

export const effects = {
  hit, crit, bloodBurst, scytheArc, mirrorBurst, mirrorShard, emberPatch, saltCrust, spinningCross, thrownDagger,
  flailHead, thornSpike, shockRing, shockFront, arrow, fireball, sunburst, holyPillar, arcaneOrb, ghost, waterOrb, whirlpool, splash,
  lightningStrike, zapHit, smite, darkExplosion, smallExplosion, manaBurst, runeCircle, frostBreath, bat,
  heroAura, trailStep, skillLife, judgementBolt, paintedFlight, incenseCloud, graveBurst, millSails, campfire, spiritFlame, bird, eyeball, flyingSkull, frog, jellyfish, slime, snake, wisp,
};
