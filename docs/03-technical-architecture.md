# Sanguine – Architecture technique

## 1. Stack

| Couche | Choix | Justification |
|---|---|---|
| Langage | **TypeScript** (strict) | Le contenu est massivement piloté par des tables ; le typage empêche les erreurs de données silencieuses. |
| Build | **Vite 7** | Démarrage instantané, build en un fichier, aucune configuration. |
| Rendu | **Canvas 2D** | Suffisant pour 1500 sprites si l'on batche correctement. WebGL aurait ajouté une complexité (shaders, atlas, contexte perdu) sans bénéfice à cette échelle. |
| Audio | **Web Audio API** brute | Synthèse à la volée, zéro fichier. |
| Assets | **Générés au runtime** | Voir `04-art-direction.md`. |
| Persistance | **localStorage** | Une clé, un objet JSON versionné. |
| Dépendances runtime | **aucune** | Contrainte du projet. |

## 2. Arborescence

```
src/
├── main.ts                 Point d'entrée, machine à états d'écrans
├── core/
│   ├── loop.ts             Boucle à pas fixe + interpolation
│   ├── math.ts             Helpers vectoriels, clamp, lerp, easing
│   ├── rng.ts              PRNG déterministe (Mulberry32)
│   ├── pool.ts             Pools d'objets génériques
│   ├── spatial.ts          Grille de hachage spatial pour les collisions
│   ├── input.ts            Clavier / manette / tactile unifiés
│   └── save.ts             Sérialisation localStorage
├── gfx/
│   ├── palette.ts          Palette centrale
│   ├── sprites.ts          Générateur de sprites procéduraux
│   ├── camera.ts           Suivi, secousses, conversion monde↔écran
│   ├── particles.ts        Système de particules poolé
│   └── renderer.ts         Passe de rendu, tri en profondeur
├── audio/
│   └── audio.ts            Synthétiseur + musique adaptative
├── data/
│   ├── weapons.ts          Table des 12 armes + 9 évolutions
│   ├── passives.ts         Table des 12 passifs
│   ├── enemies.ts          Table des 13 ennemis + 4 boss
│   ├── characters.ts       Table des 6 personnages
│   ├── waves.ts            Director : courbes et événements
│   └── meta.ts             Table du Sanctuaire
├── game/
│   ├── world.ts            État de la partie, orchestration des systèmes
│   ├── player.ts           Entité joueur, stats dérivées, build
│   ├── enemies.ts          Spawn, IA, mise à l'échelle
│   ├── weapons.ts          Runtime des armes (une fonction par comportement)
│   ├── pickups.ts          Gemmes, or, objets
│   ├── damage.ts           Application des dégâts, crit, chiffres flottants
│   └── director.ts         Pilotage des vagues et des boss
└── ui/
    ├── screens.ts          Titre, sélection, Sanctuaire, options, fin
    ├── hud.ts              Barres, timer, icônes d'armes
    ├── levelup.ts          Écran de choix de carte
    └── style.css           Habillage DOM
```

**Règle de dépendance** : `data/` ne dépend de rien. `core/` et `gfx/` ne dépendent pas de `game/`.
`game/` peut tout utiliser. `ui/` lit `game/` mais ne le modifie que par des actions explicites.

## 3. Boucle de jeu

Pas fixe à **60 Hz** pour la simulation, rendu à la fréquence de l'écran.

```ts
const STEP = 1 / 60;
let accumulator = 0;

function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.25); // anti spiral-of-death
  accumulator += dt;
  let steps = 0;
  while (accumulator >= STEP && steps < 5) {   // max 5 rattrapages
    update(STEP);
    accumulator -= STEP;
    steps++;
  }
  render(accumulator / STEP);                   // alpha d'interpolation
  requestAnimationFrame(frame);
}
```

Le plafond de 5 pas empêche la spirale de la mort sur une machine lente : le jeu ralentit
plutôt que de se figer.

## 4. Modèle d'entités

Pas d'ECS générique. Un survivor-like a **peu de types d'entités mais énormément d'instances** :
des tableaux d'objets typés, pré-alloués et recyclés, sont plus rapides et bien plus simples
qu'un ECS complet.

```ts
interface Enemy {
  active: boolean;   // ← le pool ne supprime jamais, il désactive
  x, y, vx, vy: number;
  px, py: number;    // position précédente, pour l'interpolation de rendu
  hp, maxHp: number;
  typeId: number;
  ...
}
```

Quatre pools : `enemies` (1600), `projectiles` (900), `pickups` (2200), `particles` (2400).
Le compactage (`swap-remove`) se fait une fois par frame, pas à chaque suppression.

## 5. Collisions

Grille de hachage spatial, cellule de **64 px**.

- Reconstruite intégralement chaque frame (plus rapide qu'une mise à jour incrémentale à cette
  densité, et sans bug de désynchronisation).
- Requêtes : `queryCircle(x, y, r)` retourne les indices des ennemis candidats.
- Toutes les collisions sont **cercle-cercle**. Aucune rotation, aucun SAT.

Coût mesuré : ~0,35 ms pour 1200 ennemis + 400 projectiles.

### Séparation des ennemis
Sans séparation, tous les ennemis se superposent en une ligne. Avec une séparation complète,
c'est du O(n²). Compromis retenu : chaque ennemi ne teste que **4 voisins par frame**, choisis
en tourniquet dans sa cellule. Le résultat est visuellement suffisant pour un coût négligeable.

## 6. Budget de performance (cible 16,6 ms)

| Poste | Budget |
|---|---|
| IA + déplacement des ennemis | 2,5 ms |
| Grille spatiale | 0,5 ms |
| Collisions | 1,5 ms |
| Armes + projectiles | 1,5 ms |
| Particules | 1,0 ms |
| Rendu | 6,0 ms |
| HUD / DOM | 1,0 ms |
| Marge | 2,6 ms |

### Optimisations de rendu appliquées
1. **Culling** : rien hors de la vue + 64 px de marge n'est dessiné.
2. **Aucun `save()`/`restore()`** dans la boucle chaude – `setTransform` direct.
3. **Sprites pré-rendus** dans des `OffscreenCanvas`, teintes incluses (le flash rouge des dégâts
   est un sprite pré-teinté, pas un filtre appliqué en temps réel).
4. **Tri en profondeur par seau** (par tranche de 32 px de `y`) plutôt qu'un `sort()` complet.
5. Le canvas est en `alpha: false` et `desynchronized: true`.
6. Les chiffres de dégâts sont rendus dans un **atlas de glyphes** pré-généré, jamais avec
   `fillText` dans la boucle.

## 7. Rendu et résolution

Le jeu est rendu dans un **canvas hors écran** à sa résolution logique, puis recopié une fois
par frame sur le canvas visible avec un facteur **entier** et le lissage désactivé.

```
scene (hors écran)          display (visible)
  480 × 270 logique   ──×4──▶   1920 × 1080 pixels physiques
  tout le rendu à 1:1          1 pixel mémoire = 1 pixel écran
```

### Pourquoi deux canvas

Cette architecture n'est pas une élégance gratuite : elle rend le flou **structurellement
impossible**. Deux tentatives plus simples ont échoué avant elle.

| Tentative | Défaut |
|---|---|
| Canvas 480 × 270, taille CSS `480 × facteur` | Ignore `devicePixelRatio` : sous Windows à 125 %, la taille physique n'est plus un multiple entier de 480. Le navigateur rééchantillonne. |
| Même chose, facteur calculé en pixels physiques | La taille CSS devient fractionnaire (« 1539.2px »). Le compositeur l'arrondit à sa façon, et le rapport redevient non entier. |
| **Deux canvas** | Le canvas visible est dimensionné en pixels physiques et affiché à sa taille CSS exacte : **le navigateur n'a plus rien à redimensionner.** La seule mise à l'échelle est le `drawImage` final, à facteur entier et sans lissage. |

Le piège commun aux deux premières : le défaut est **invisible sur un écran à 100 %**, c'est-à-dire
sur la machine de développement. Il n'apparaît que sur les configurations à échelle
fractionnaire — soit la majorité des machines Windows.

Vérifié sur neuf configurations, y compris des tailles volontairement « sales » (1463 × 823
à 1,25 ; 1381 × 777 à 1,35) : rapport mémoire/écran de 1,0000 partout.

Le mode debug (`~`) affiche ce rapport en clair, seul moyen de diagnostiquer à distance un
problème qui dépend de l'écran et du réglage système.

### Résolution logique variable
Le facteur restant entier, la **résolution logique** s'ajuste pour couvrir la fenêtre : sans
cela, tout écran dont les dimensions ne sont pas un multiple exact de 480 × 270 afficherait
des bandes noires. Elle est bornée à 1,5× la référence pour qu'un écran très large ne confère
pas un avantage de jeu.

## 8. Déterminisme

Le PRNG (Mulberry32) est semé par run. Toute la génération (spawns, drops, cartes) passe par lui.
Conséquence : un run est rejouable à partir de sa graine, ce qui rend les bugs reproductibles.
La graine est affichée sur l'écran de fin.

## 9. Gestion d'état

Machine à états simple, exclusive :

```
BOOT → TITLE → CHARACTER_SELECT → PLAYING ⇄ LEVEL_UP
                     ↑                ⇄ PAUSED
                     │                ↓
                SANCTUARY ←──── GAME_OVER / VICTORY
```

`PLAYING` est le seul état qui fait avancer la simulation. `LEVEL_UP` et `PAUSED` continuent de
**rendre** la scène (figée) pour garder le contexte visuel.

## 10. Tests et vérification

Pas de framework de test – ce serait une dépendance et le jeu est essentiellement visuel.
À la place :

- `pnpm build` doit passer **sans erreur TypeScript en mode strict** ; c'est le filet principal.
- Un **mode debug** (`~`) affiche FPS, compte d'entités, temps par système, hitboxes.
- Des **triches de développement** (`F1`–`F5`) : +10 niveaux, +1 min, invincibilité, tuer tout,
  donner 10 000 or. Elles restent dans le build mais sont marquées et désactivent les records.

## 11. Build et distribution

```bash
pnpm install
pnpm dev      # serveur de développement, HMR
pnpm build    # → dist/, un seul HTML + un JS + un CSS
pnpm preview  # sert le build
```

`base: './'` dans la configuration Vite pour que `dist/index.html` fonctionne aussi en `file://`.

Poids mesuré : **161 ko** non compressé, **54 ko** en gzip, aucun asset binaire. Le budget
initial était de 150 ko ; les biomes, les structures, l'illustration des menus et les ornements
d'interface l'ont porté à 161 ko, ce qui reste très largement sous le seuil où le chargement
devient perceptible.
