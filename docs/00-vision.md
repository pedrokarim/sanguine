# Sanguine — Vision

> *« Tenez jusqu'à l'aube. Elle ne viendra pas. »*

## Pitch

**Sanguine** est un *survivor-like* (aussi appelé *bullet heaven*) jouable directement dans le
navigateur. Le joueur incarne un chasseur pris au piège dans un domaine maudit et doit survivre
30 minutes à des hordes de créatures de plus en plus denses. Il ne tire jamais manuellement : ses
armes se déclenchent seules. Toute la profondeur du jeu vient du **choix des améliorations** entre
deux vagues, et de la construction progressive d'un build qui transforme un personnage fragile en
machine à broyer l'écran.

## Les trois piliers

### 1. La montée en puissance doit être *obscène*
La première minute, on tue un ennemi à la fois. La vingt-cinquième, on efface 300 ennemis par
seconde sans réfléchir. Ce contraste est le cœur du plaisir. Chaque système (dégâts, zone,
projectiles, cadence) est conçu pour se **multiplier** avec les autres plutôt que s'additionner,
afin que la courbe soit exponentielle et non linéaire.

### 2. Zéro friction d'entrée
Pas de compte, pas d'installation, pas de chargement. On ouvre l'onglet, on appuie sur une touche,
on joue. Les commandes tiennent en quatre directions. Une partie dure 30 minutes maximum et peut
être abandonnée à tout moment sans culpabilité — la monnaie méta est conservée.

### 3. Lisibilité malgré le chaos
Un survivor-like échoue le jour où le joueur ne distingue plus son personnage de la bouillie.
La direction artistique (voir `04-art-direction.md`) est construite autour d'une règle unique :
**le joueur et les dangers sont les seuls éléments saturés de l'écran.** Le décor est désaturé,
les ennemis sont sombres, les dégâts subis provoquent un flash plein écran. On doit pouvoir jouer
en regardant uniquement le centre de l'écran.

## Ce que le jeu n'est pas

- Ce n'est **pas** un jeu de tir manuel. L'auto-attaque est non négociable, c'est le genre.
- Ce n'est **pas** un roguelike punitif. Mourir est normal, fréquent, et fait progresser le méta.
- Ce n'est **pas** un jeu multijoueur. Aucun backend, aucune sauvegarde serveur, aucun compte.
- Ce n'est **pas** un jeu narratif. Le lore existe dans les noms d'objets, nulle part ailleurs.

## Références assumées

| Référence | Ce qu'on lui emprunte | Ce qu'on rejette |
|---|---|---|
| *Vampire Survivors* | Structure de run 30 min, évolutions d'armes, coffres | L'illisibilité passé 20 min |
| *Brotato* | Densité de stats, clarté des chiffres | La structure par vagues discrètes |
| *Halls of Torment* | Direction artistique lisible, qualité du feedback | La lenteur du début de partie |
| *20 Minutes Till Dawn* | Contrainte de temps dans l'identité même du jeu | La visée manuelle |

## Contraintes non négociables

1. **100 % navigateur.** Aucun serveur, aucune API externe, aucun asset distant. Le jeu doit
   fonctionner depuis un `file://` après build, et hors ligne.
2. **Zéro dépendance runtime.** Le `package.json` ne contient que des `devDependencies`
   (Vite + TypeScript). Rien de tiers n'est expédié au joueur.
3. **Aucun asset binaire.** Sprites, animations et sons sont **générés par le code** au démarrage.
   Cela résout d'un coup les questions de licence, de poids du bundle et de temps de chargement.
   Voir `04-art-direction.md` et `05-audio-design.md`.
4. **60 FPS avec 1500 entités actives** sur un laptop intégré de milieu de gamme.

## Critère de réussite

Le jeu est terminé quand un joueur peut :

- lancer une partie en moins de 3 secondes après ouverture de l'onglet ;
- survivre 30 minutes, battre le boss final et voir un écran de victoire ;
- mourir, dépenser son or dans le Sanctuaire, et sentir la différence au run suivant ;
- fermer l'onglet et retrouver sa progression le lendemain.

## Documents liés

- `01-game-design.md` — boucle de jeu, systèmes, formules
- `02-content-bible.md` — armes, passifs, ennemis, personnages, vagues
- `03-technical-architecture.md` — stack, modules, budget de performance
- `04-art-direction.md` — palette et pipeline de sprites procéduraux
- `05-audio-design.md` — synthèse sonore et musique adaptative
- `06-roadmap.md` — jalons de développement
