# Sanguine

> *« Tenez jusqu'à l'aube. Elle ne viendra pas. »*

Un **survivor-like** (bullet heaven) jouable directement dans le navigateur. Vous ne tirez
jamais : vos armes se déclenchent seules. Toute la profondeur vient du choix des améliorations
entre deux vagues, et de la construction d'un build qui transforme un chasseur fragile en
machine à effacer l'écran.

**Aucune dépendance runtime. Aucun asset binaire.** Sprites, animations, décor, illustration des
menus, ornements d'interface et sons sont **générés par le code** au démarrage.

---

## Démarrer

```bash
pnpm install
pnpm dev        # serveur de développement  → http://localhost:5180
pnpm build      # production → dist/
pnpm preview    # sert le build
```

`dist/index.html` fonctionne aussi en `file://` et hors ligne : rien n'est chargé depuis le
réseau. Poids du build : **168 ko** non compressé, 56 ko en gzip.

## Jouer

| Action | Clavier | Manette | Tactile |
|---|---|---|---|
| Déplacement | `ZQSD` / `WASD` / flèches | Stick gauche | Glisser (joystick virtuel) |
| Pause | `Échap` / `P` | Start | — |
| Valider | `Entrée` / `Espace` / clic | A | Tap |
| Minimap | `M` (afficher/masquer) | — | — |
| Plein écran | `F` | — | — |

AZERTY et QWERTY fonctionnent simultanément : les touches sont lues par **code physique**.

### Outils de développement

| Touche | Effet |
|---|---|
| `~` | Compteurs de debug (FPS, entités, temps par système, stats du build) |
| `F1` | +10 niveaux · `F2` +1 minute · `F3` soins complets |
| `F4` | Tue tout à l'écran · `F5` +10 000 or |
| `F6` | Fait tomber une relique · `F7` fait tomber un coffre |

La console expose `window.sanguine` : `.snapshot()`, `.world`, `.startRun(id)`.

---

## Contenu

| | |
|---|---|
| **18 armes** | + 15 évolutions, débloquées uniquement par les coffres |
| **12 passifs** | 6 emplacements d'armes, 6 de passifs — le plafond force les vrais choix |
| **24 reliques** | Objets uniques, hors emplacements, dont 4 **maudites** |
| **13 ennemis** | 9 comportements d'IA distincts |
| **5 boss** | Dont la Faucheuse, invulnérable, qui met fin à la partie |
| **6 personnages** | 4 à débloquer |
| **5 biomes** | Composition d'ennemis et effets passifs propres |
| **7 structures** | Autel, bûcher, obélisque, puits, ossuaire, chapelle, cairn |
| **11 améliorations** | Méta-progression permanente au Sanctuaire |
| **Codex** | 75 entrées à sprites animés — armes, évolutions, bestiaire, reliques |
| **Curseur** | Pixel art généré, 3 états, effacement auto en partie |

Une partie dure **30 minutes**. Le temps est le seul véritable adversaire.

---

## Architecture

```
src/
├── core/     boucle à pas fixe, RNG déterministe, grille spatiale, entrées, sauvegarde
├── gfx/      palette, primitives pixel, générateurs de sprites, caméra, particules, rendu
├── audio/    synthétiseur Web Audio + musique adaptative en couches
├── data/     tables de contenu pures (aucune dépendance)
├── game/     joueur, ennemis, armes, terrain, butin, director, améliorations
└── ui/       HUD, écrans, illustration des menus, ornements
```

| Choix | Raison |
|---|---|
| **Canvas 2D** plutôt que WebGL | Suffisant jusqu'à ~2000 sprites, sans la complexité des shaders |
| **Pools pré-alloués** plutôt qu'un ECS | Peu de types d'entités, énormément d'instances |
| **Grille de hachage** reconstruite chaque frame | Plus rapide qu'une mise à jour incrémentale, impossible à désynchroniser |
| **HUD en DOM** | Texte net à toute résolution, accessible, gratuit dans la boucle de rendu |
| **Monde déterministe par position** | Monde infini à coût mémoire nul, runs rejouables à la graine |

Résolution logique fixe **480 × 270**, mise à l'échelle par facteur entier : pixel art net et
coût de rendu indépendant de la taille de l'écran.

Mesures sous charge (portable milieu de gamme) : **60 fps constants** avec 344 ennemis,
`update` 0,9 ms, `render` 2,4 ms.

---

## Documentation

| Document | Contenu |
|---|---|
| [`docs/00-vision.md`](docs/00-vision.md) | Pitch, piliers, contraintes, critères de réussite |
| [`docs/01-game-design.md`](docs/01-game-design.md) | Boucles, statistiques, formules, accessibilité |
| [`docs/02-content-bible.md`](docs/02-content-bible.md) | Armes, passifs, reliques, ennemis, biomes, structures |
| [`docs/03-technical-architecture.md`](docs/03-technical-architecture.md) | Stack, modules, budget de performance |
| [`docs/04-art-direction.md`](docs/04-art-direction.md) | Palette, pipeline procédural, game feel, leçons |
| [`docs/05-audio-design.md`](docs/05-audio-design.md) | Synthèse, catalogue d'effets, musique adaptative |
| [`docs/06-roadmap.md`](docs/06-roadmap.md) | Jalons, hors périmètre, dette technique assumée |

La bible de contenu est la **source de vérité** : les tables de `src/data/` doivent la refléter.

---

## Équilibrage

Les courbes ne sont pas réglées à l'intuition mais **mesurées par un bot** qui joue réellement
(fuite pondérée par la pression locale des ennemis, dérive vers les gemmes, choix de cartes).

Deux réglages ont été mesurés et rejetés avant celui retenu — notamment une densité trop élevée
qui produisait l'effet inverse de celui recherché : le joueur ne tue plus assez vite, ne ramasse
plus de gemmes, et reste bloqué au niveau 5 pendant que l'écran se remplit. Détail dans
`docs/02-content-bible.md` §5.
