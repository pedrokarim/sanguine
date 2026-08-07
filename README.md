<div align="center">

# SANGUINE

*« Tenez jusqu'à l'aube. Elle ne viendra pas. »*

**[▶ JOUER MAINTENANT](https://sanguine.ascencia.re)** · [Documentation](https://pedrokarim.github.io/sanguine/)

[![Jouer](https://img.shields.io/badge/jouer-sanguine.ascencia.re-c42639?style=for-the-badge)](https://sanguine.ascencia.re)
[![Licence MIT](https://img.shields.io/badge/licence-MIT-f2c46b?style=for-the-badge)](LICENSE)

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)
![Dépendances runtime](https://img.shields.io/badge/dépendances%20runtime-0-4ee88a)
![Assets binaires](https://img.shields.io/badge/assets%20binaires-0-4ee88a)
![Bundle](https://img.shields.io/badge/bundle-57%20ko%20gzip-4ea9e8)
![Docker](https://img.shields.io/badge/Docker-prêt-2496ed?logo=docker&logoColor=white)

![Sanguine en action](docs/screenshots/03-jeu.png)

</div>

---

## Le jeu

Un **survivor-like** (*bullet heaven*) jouable directement dans le navigateur. Vous ne tirez
jamais : vos armes se déclenchent seules. Toute la profondeur vient du choix des améliorations
entre deux vagues, et de la construction d'un build qui transforme un chasseur fragile en
machine à effacer l'écran.

Une partie dure **30 minutes**. Le temps est le seul véritable adversaire.

> **Aucune dépendance runtime. Aucun fichier binaire.**
> Sprites, animations, décor, biomes, illustration des menus, ornements d'interface, curseur
> et sons sont **générés par le code** au démarrage. Le jeu entier tient en 57 ko compressés
> et fonctionne hors ligne.

---

## Aperçu

|  |  |
|---|---|
| ![Écran titre](docs/screenshots/01-titre.png) | ![Sélection de personnage](docs/screenshots/02-personnages.png) |
| **Écran titre** – scène nocturne en six couches animées par parallaxe, entièrement dessinée par le code | **Six personnages**, chacun avec son arme de départ, son bonus et son défaut |
| ![Montée de niveau](docs/screenshots/04-amelioration.png) | ![Relique](docs/screenshots/05-relique.png) |
| **Un choix à chaque niveau** – trois cartes tirées par catégorie | **24 reliques**, dont quatre maudites : puissantes, mais elles se paient |
| ![Codex](docs/screenshots/07-codex.png) | ![Bestiaire](docs/screenshots/08-bestiaire.png) |
| **Codex de 75 entrées** à sprites animés, silhouettées tant qu'elles ne sont pas découvertes | **Bestiaire** – dix-huit créatures, leurs statistiques et leur comportement |
| ![Sanctuaire](docs/screenshots/09-sanctuaire.png) | ![Fin de partie](docs/screenshots/06-fin.png) |
| **Sanctuaire** – l'or survit à la mort et achète des améliorations permanentes | **Bilan de fin de partie**, graine comprise pour rejouer le même run |

---

## Contenu

| | |
|---|---|
| **18 armes** | + 15 évolutions, débloquées uniquement par les coffres |
| **12 passifs** | 6 emplacements d'armes, 6 de passifs – le plafond force les vrais choix |
| **24 reliques** | Objets uniques, hors emplacements, dont 4 **maudites** |
| **13 ennemis** | 9 comportements d'IA distincts |
| **5 boss** | Dont la Faucheuse, invulnérable, qui met fin à la partie |
| **6 personnages** | 4 à débloquer, avec progression affichée |
| **5 biomes** | Composition d'ennemis et effets passifs propres |
| **7 structures** | Autel, bûcher, obélisque, puits, ossuaire, chapelle, cairn |
| **11 améliorations** | Méta-progression permanente au Sanctuaire |

---

## Jouer

| Action | Clavier | Manette | Tactile |
|---|---|---|---|
| Déplacement | `ZQSD` / `WASD` / flèches | Stick gauche | Glisser (joystick virtuel) |
| Pause | `Échap` / `P` | Start | – |
| Valider | `Entrée` / `Espace` / clic | A | Tap |
| Minimap | `M` | – | – |
| Plein écran | `F` | – | – |

**Il n'y a pas de touche d'attaque.** C'est le genre qui veut ça.

AZERTY et QWERTY fonctionnent simultanément : les touches sont lues par **code physique**.

<details>
<summary>Outils de développement</summary>

| Touche | Effet |
|---|---|
| `~` | Compteurs de debug (FPS, entités, temps par système, stats du build) |
| `F1` | +10 niveaux · `F2` +1 minute · `F3` soins complets |
| `F4` | Tue tout à l'écran · `F5` +10 000 or |
| `F6` | Fait tomber une relique · `F7` fait tomber un coffre |

La console expose `window.sanguine` : `.snapshot()`, `.world`, `.startRun(id)`.

</details>

---

## Développement

```bash
pnpm install
pnpm dev        # serveur de développement → http://localhost:5180
pnpm build      # production → dist/
pnpm preview    # sert le build
```

`dist/index.html` fonctionne aussi en `file://` et hors ligne : rien n'est chargé depuis le
réseau.

### Docker

```bash
docker compose up -d --build     # → http://127.0.0.1:4020
```

Procédure de mise en production complète dans **[DEPLOY.md](DEPLOY.md)**.

---

## Architecture

```
src/
├── core/     boucle à pas fixe, RNG déterministe, grille spatiale, entrées, sauvegarde
├── gfx/      palette, primitives pixel, générateurs de sprites, caméra, particules, rendu
├── audio/    synthétiseur Web Audio + musique adaptative en couches
├── data/     tables de contenu pures (aucune dépendance)
├── game/     joueur, ennemis, armes, terrain, butin, director, améliorations
└── ui/       HUD, écrans, minimap, illustration des menus, ornements
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

Mesuré sous charge : **60 fps constants** avec 344 ennemis (`update` 0,9 ms, `render` 2,4 ms).

---

## Documentation

La documentation de conception est en français et sert de **source de vérité** : les tables de
`src/data/` doivent la refléter.

| Document | Contenu |
|---|---|
| [`docs/00-vision.md`](docs/00-vision.md) | Pitch, piliers, contraintes, critères de réussite |
| [`docs/01-game-design.md`](docs/01-game-design.md) | Boucles, statistiques, formules, accessibilité |
| [`docs/02-content-bible.md`](docs/02-content-bible.md) | Armes, passifs, reliques, ennemis, biomes, structures |
| [`docs/03-technical-architecture.md`](docs/03-technical-architecture.md) | Stack, modules, budget de performance |
| [`docs/04-art-direction.md`](docs/04-art-direction.md) | Palette, pipeline procédural, game feel, erreurs corrigées |
| [`docs/05-audio-design.md`](docs/05-audio-design.md) | Synthèse, catalogue d'effets, musique adaptative |
| [`docs/06-roadmap.md`](docs/06-roadmap.md) | Jalons, hors périmètre, dette technique assumée |

---

## Équilibrage mesuré, pas deviné

Les courbes ne sont pas réglées à l'intuition mais **mesurées par un bot** qui joue réellement :
il fuit la pression locale des ennemis, dérive vers les gemmes et choisit ses cartes.

Deux réglages de densité ont été mesurés puis rejetés avant celui retenu. Le second est le plus
instructif :

| Réglage | Résultat mesuré |
|---|---|
| `0.9 + min × 0.55` | ~20 ennemis à l'écran, niveau 8 seulement à 3 min 30 : trop vide |
| `1.6 + min × 1.05` | 474 ennemis à 6 min, **une seule arme au niveau 5**, mort à 6 min 48 |
| `1.1 + min × 0.70` | Niveau 14 à 4 min 30, 4 armes, 745 morts, 60 fps – **retenu** |

Au-delà d'un certain seuil, **augmenter la densité réduit la progression** : le joueur ne tue
plus assez vite, ne ramasse plus de gemmes, et la courbe d'XP s'effondre pendant que l'écran se
remplit.

---

## Licence

[MIT](LICENSE) – faites-en ce que vous voulez.

<div align="center">
<sub>© 2026 Ascencia</sub>
</div>
