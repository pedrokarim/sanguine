# Sanguine – Direction artistique

## 1. Principe fondateur

**Tous les assets sont générés par le code au démarrage.** Aucun PNG, aucun atlas, aucun
téléchargement. Un module `gfx/sprites.ts` dessine chaque sprite dans un `OffscreenCanvas` au
boot (~30 ms au total), et le reste du jeu ne manipule plus que des `CanvasImageSource`.

Pourquoi ce choix plutôt que des assets dessinés à la main :

1. **Licence** – aucun asset tiers, donc aucune ambiguïté sur la redistribution.
2. **Poids** – 164 ko de bundle (55 ko en gzip), chargement instantané.
3. **Variation** – un même générateur produit 6 variantes d'une goule en changeant une graine.
   Une horde générée procéduralement paraît beaucoup moins répétitive.
4. **Itération** – changer la palette du jeu entier est un changement d'une ligne.
5. **Teintes pré-calculées** – chaque sprite est généré en 3 versions (normale, flash blanc de
   dégâts, silhouette rouge d'élite). Aucun filtre coûteux à l'exécution.

La contrepartie assumée : le style est nécessairement **pixel art géométrique**. C'est cohérent
avec le genre et avec la résolution logique de 480 × 270.

## 2. Palette

Palette fermée de 32 teintes, dérivée d'une base « nuit froide + sang chaud ».

```
Décor (froid, désaturé – doit disparaître)
  #0b0d14  nuit         #131725  terre        #1b2133  terre claire
  #232b40  pierre       #2d3654  pierre haute #38425f  brume

Ennemis (sombres, violacés – lisibles sur le décor sans attirer l'œil)
  #3a2b46  chair morte  #4d3557  chair        #654166  chair claire
  #7c5175  os           #9a6b86  os clair

Joueur & alliés (chaud, saturé – le seul point chaud de l'écran)
  #f2c46b  or           #e89a3c  cuivre       #c96f2a  cuir
  #f7ede0  lin          #a8c5d6  acier

Sang & danger (rouge pur, réservé exclusivement aux dégâts)
  #8b1a2b  sang sombre  #c42639  sang         #f0405a  sang vif

Butin (chaque rareté a UNE teinte, jamais réutilisée ailleurs)
  #4ea9e8  XP commune   #4ee88a  XP moyenne   #f0405a  XP haute
  #b968f0  XP rare      #f2c46b  or           #ffffff  relique commune
  #5b9df5  relique rare #a855f7  relique épique #dc2626 relique maudite

Effets
  #ffffff  flash        #fff3c4  éclair       #7de8ff  glace
  #ff9c3c  feu          #8ef07a  poison
```

**Règle de saturation** : plus un élément est important pour la survie, plus il est saturé.
Le décor est à ~15 % de saturation, les ennemis à ~35 %, le joueur à ~75 %, les dégâts à 100 %.

## 3. Grille et échelles

| Élément | Taille |
|---|---|
| Joueur | 12 × 14 px |
| Ennemi commun | 10 × 12 px |
| Ennemi lourd | 16 × 18 px |
| Golem | 24 × 26 px |
| Boss | 40 × 44 px à 64 × 64 px |
| Gemme | 6 × 6 px |
| Pièce | 6 × 6 px |
| Coffre | 14 × 12 px |
| Relique | 10 × 12 px |
| Projectile | 4 × 4 px à 10 × 10 px |
| Tuile de sol | 64 × 64 px |
| Décor secondaire | 16 × 18 px |
| Structure | 18 × 34 px à 40 × 38 px |

Toutes les positions sont arrondies au pixel au moment du rendu (`Math.round`), jamais avant :
la simulation reste en flottant, seule la présentation est quantifiée.

## 4. Pipeline de génération

```
palette.ts  →  primitives de dessin (blob, symétrie, contour, dithering)
            →  générateurs par famille (humanoïde, bestial, volant, amorphe)
            →  frames d'animation (déformation du sprite de base)
            →  variantes de teinte (normal / flash / élite)
            →  cache Map<string, HTMLCanvasElement[]>
```

### Primitives
- `blob(rng, w, h, density)` – masse organique symétrique verticalement.
- `outline(canvas, color)` – contour 1 px sombre, indispensable à la lisibilité sur fond sombre.
- `shade(canvas, dir)` – éclaircit le haut, assombrit le bas (lumière zénithale implicite).
- `dither(canvas, a, b)` – transition en damier entre deux teintes, très « 16-bit ».

### Animation
Les frames ne sont pas dessinées séparément. Chaque frame est une **déformation** du sprite de
base : décalage vertical, étirement, inclinaison, balancement des membres. Un générateur
produit donc `N` frames pour le prix d'un dessin.

```ts
// squash & stretch : la base de tout le « game feel » 2D
frame(i) => transform(base, {
  scaleY: 1 + Math.sin(i / frames * TAU) * 0.08,
  scaleX: 1 - Math.sin(i / frames * TAU) * 0.06,
  offsetY: Math.abs(Math.sin(i / frames * PI)) * -1.5,
})
```

## 5. Le décor

Un sol infini rendu en tuiles de 64 px, dont la texture vient d'un bruit de valeur **périodique**
évalué par pixel. Le sol est dessiné tuile par tuile plutôt qu'avec un `createPattern` global :
une soixantaine de `drawImage` par frame est un prix négligeable pour un monde qui change
visiblement de nature quand on le traverse (voir §9 pour les écueils rencontrés).

Le décor **s'assombrit progressivement** au fil des 30 minutes : la luminosité globale du sol
passe de 100 % à 55 %, et une vignette rouge s'intensifie. Le joueur ressent le temps qui passe
sans regarder le chronomètre.

## 6. Feedback visuel (« game feel »)

C'est ici que se joue la différence entre un prototype et un jeu.

| Événement | Réponse visuelle |
|---|---|
| Coup porté | Recul du sprite ennemi (4 px, 90 ms), flash blanc, 3 particules de sang |
| Coup critique | Chiffre doré 2× plus gros, gerbe de 6 particules, son distinct – **ni secousse ni micro-gel** |
| Ennemi tué | Dislocation en 5 frames + 6 particules + décalque de sang persistant au sol |
| Joueur touché | Flash rouge plein écran (18 %), secousse 6 px, clignotement 0,7 s |
| Ramassage de gemme | Attraction accélérée (easing quadratique) + étincelle + montée de la barre |
| Montée de niveau | Ralenti 250 ms, anneau doré qui s'étend, colonne de lumière |
| Ouverture de coffre | Ralenti, rayons rotatifs, éjection des objets en arc |
| Relique trouvée | Colonne de lumière colorée par la rareté, bandeau de nom, temps figé 800 ms |
| Apparition de boss | Vignette rouge, bandeau, ralenti 1 s, secousse continue |
| Bas PV (< 25 %) | Pulsation rouge sur les bords de l'écran, synchronisée au battement cardiaque |

### Secousse de caméra

Le premier réglage était **inutilisable** – un testeur l'a décrit comme « irregardable, ça fait
mal aux yeux ». Quatre causes cumulées, toutes corrigées :

| Cause | Correction |
|---|---|
| Secousse déclenchée à chaque coup critique (5 % × ~50 coups/s) | Aucune secousse sur critique |
| Micro-gel de 40 ms sur critique → ~100 ms perdues par seconde | Micro-gel réservé à la mort d'un boss |
| Amplitude de 9 px logiques, soit 36 px réels en ×4 | Ramenée à 3 px logiques |
| Décalage tiré au bruit blanc → scintillement | Oscillation sinusoïdale à deux fréquences |

Modèle actuel : traumatisme `t ∈ [0,1]`, décroissance de 3,2/s, amplitude `= t² × 3 px`,
plafonnée à 0,6 hors événements majeurs pour empêcher l'accumulation. Le tout multiplié par un
réglage joueur, **à 40 % par défaut**, descendable à zéro.

La leçon générale : dans un jeu où l'événement se produit des dizaines de fois par seconde, un
effet acceptable en isolation devient intolérable par accumulation. Tout retour visuel doit
être budgété par sa **fréquence**, pas par son intensité unitaire.

### Décalques de sang
Chaque mort laisse une tache au sol dans un canvas persistant, jusqu'à 600 taches en tampon
circulaire. C'est gratuit en rendu (une seule image) et donne une trace visible du carnage –
un retour très fort sur la puissance du build.

## 7. Lisibilité – les garde-fous

Un survivor-like devient injouable quand l'écran sature. Trois protections :

1. **Le joueur est toujours dessiné en dernier**, avec un contour clair de 1 px.
   Il n'est jamais recouvert.
2. **Plafond de particules** : au-delà de 1200, les nouvelles demandes sont ignorées par ordre
   de priorité croissante (le sang du joueur passe toujours avant la poussière).
3. **Opacité des ennemis** : quand plus de 40 ennemis se superposent dans un rayon de 40 px
   autour du joueur, la teinte des ennemis s'assombrit légèrement pour préserver le contraste.

## 8. Interface

Le HUD est en **DOM** superposé au canvas, pas dessiné dans le canvas. Raisons : texte net à
toutes les résolutions, accessibilité (lecteurs d'écran), et zéro coût dans la boucle de rendu.

- Barre d'XP : bande fine en haut, pleine largeur.
- Barre de PV : sous le personnage, uniquement quand elle n'est pas pleine.
- Chronomètre : centré en haut, gros chiffres, devient rouge après 25:00.
- Icônes d'armes et de passifs : coin supérieur gauche, avec pastille de niveau.
- Reliques : bandeau vertical à droite, survol pour le détail.
- Or et niveau : coin supérieur droit.

Police : **une police bitmap générée par le code** (5 × 7 px), rendue dans un atlas de glyphes.
Aucune dépendance à une police système, aucun `fillText` dans la boucle chaude.

---

## 9. Décor du monde – leçons de terrain

Deux erreurs ont été commises puis corrigées en regardant le résultat à l'écran. Elles sont
notées ici parce qu'elles se reproduiraient sans cela.

### Le sol ne doit pas être une information
La première version peignait une soixantaine de rectangles semi-transparents par tuile, plus
douze touffes d'herbe contrastées. Résultat : un bruit permanent qui **concurrençait les
ennemis**. Le sol est désormais un champ de bruit de valeur évalué par pixel, très doux, avec
cinq cailloux et trois touffes à peine marquées. Le décor est une texture, jamais un signal.

### Un bruit périodique se raccorde avec lui-même, pas avec ses voisins
Pour casser la répétition, quatre variantes de tuile ont été générées avec des graines
différentes. Le résultat a été **l'inverse de l'effet recherché** : chaque tuile ayant sa
propre luminosité moyenne, la grille de 64 px est devenue franchement visible, chaque arête
marquant une rupture nette.

Le champ de bruit ne dépend donc plus que du biome. Les variantes ne portent que les cailloux
et les touffes, dont l'absence de raccord passe inaperçue. La variété à grande échelle vient
des **biomes** et du **décor secondaire**, pas de la tuile.

## 10. Illustration des menus

L'écran titre affiche une scène nocturne **entièrement dessinée par le code** (`ui/backdrop.ts`) :
ciel dégradé, étoiles, lune en croissant cernée d'un halo sanglant, collines par bruit de
valeur, chapelle en ruine, arbres morts générés récursivement, cimetière, brume et
chauves-souris animées.

La scène est composée en **six couches pré-rendues**, puis animée par parallaxe : cinq
`drawImage` par frame quel que soit le détail. Les couches s'éclaircissent avec la distance
(perspective atmosphérique) – une silhouette de premier plan quasi noire sur ciel sombre ne se
lit pas.

Piège rencontré : découper le croissant par `destination-out` directement sur le ciel perçait
aussi le halo et le dégradé, laissant un trou transparent visible. La lune est désormais
composée dans un canvas dédié puis reportée.

### L'ambiance sombre n'est pas l'obscurité

La première version poussait l'atmosphère jusqu'au noir : ciel à `#04050a`, silhouettes à
`#040409`, vignette lourde, plus le voile du menu par-dessus. Cohérent sur le papier,
**illisible à l'écran** – le retour du testeur a été « on ne voit presque rien ».

Quatre corrections, toutes dans le même sens :

| Correction | Détail |
|---|---|
| **Ciel éclairci** | `#141a38` → `#5c3450`. Une nuit dégagée sous la lune est bien plus lumineuse qu'on ne le croit |
| **Perspective atmosphérique** | Les plans **lointains** sont les plus **clairs** (`#3b3560`), les proches les plus sombres (`#12101f`). C'est ce qui sépare les couches |
| **Liserés de crête** | Un trait clair sur chaque ligne d'horizon. Sans lui, des masses sombres sur un ciel sombre fusionnent en une seule tache |
| **Passe de lumière lunaire** | Un dégradé radial en mode `screen` centré sur la lune, appliqué par-dessus toutes les couches. Il unifie la scène autour d'une source unique |

Deux pièges évités au passage :

- **Le liseré doit être discontinu.** Tracé plein, il se lit comme une courbe de niveau sur une
  carte topographique et trahit le procédé. Troué par du bruit, il redevient de la lumière
  accrochée par une crête irrégulière.
- **La brume doit être claire.** Sous la lune, le brouillard *diffuse* la lumière ; une brume
  sombre n'est qu'un voile noir de plus, exactement ce qu'on cherchait à supprimer.

Conséquence en cascade : les textes secondaires des menus, réglés contre l'ancien fond noir,
sont devenus illisibles sur le nouveau et ont dû être éclaircis. **La lisibilité d'un texte se
juge contre son fond réel, jamais dans l'absolu.**

## 11. Ornements d'interface

Les cadres, fleurons, équerres d'angle, bandeau de titre et grain de parchemin sont générés
par le code (`ui/decor.ts`) et publiés en variables CSS sous forme de `data:` URI.

Les cadres sont des images **9-slice** appliquées via `border-image` : quatre coins ornés fixes,
quatre bords répétés. Cela décore n'importe quelle boîte, à n'importe quelle taille, sans
ajouter un seul élément au DOM. Quatre teintes existent – pierre, or, sang, épique – ce qui
suffit à signaler l'état d'un élément (normal, survolé, dangereux, évolution).

Motif des bords : deux filets continus et **un seul** cran discret. Un motif plus marqué se
répète tous les 8 px et transforme le cadre en pointillés, ce qui parasite la lecture.

Les menus ouverts pendant une partie restent volontairement translucides : voir la horde figée
derrière ses cartes fait partie de la tension du choix.

## 12. Minimap

Ajoutée **après** les structures, et à cause d'elles : tant que le monde n'était qu'un fond
défilant, une carte n'aurait rien montré. Depuis qu'il contient des objectifs, l'absence de
carte supprimait purement et simplement une décision – un autel ne se découvrait qu'en marchant
dessus, donc le pari « je traverse la horde pour aller le chercher » n'existait pas.

Couverture : un rayon de 880 px monde, soit environ quatre écrans de large. Assez pour décider,
trop peu pour planifier – ce qui est exactement le bon dosage dans un jeu où l'on ne s'arrête
jamais.

### Ce que la carte montre, par ordre de priorité visuelle

| Élément | Rendu |
|---|---|
| Structures non activées | Carré 4 px à la couleur du type, clignotant |
| Structures épuisées | Point gris – elles restent des repères |
| Boss | Cercle rouge pulsé, ramené au bord s'il sort du cadre |
| Coffres, reliques, cœurs | Point 2 px, couleur de rareté |
| Élites | Carré 3 px rouge vif |
| Ennemis ordinaires | Point 1 px sombre – une densité, pas des individus |
| Cadre de vue | Rectangle fin : rappelle ce que l'écran couvre réellement |

### Séparation du coût
Le **fond de biomes** demande un échantillon de bruit par cellule (2 700 au total) : il n'est
régénéré que si le joueur s'est déplacé de plus de 55 px, et au plus deux fois par seconde.
Entre deux régénérations, il est simplement redessiné décalé du déplacement effectué, ce qui
le fait glisser continûment au lieu de sauter.

Les **marqueurs**, eux, sont recalculés à chaque frame : quelques dizaines de `fillRect`, coût
négligeable.

Le fond est écrit en `ImageData` plutôt qu'en `fillRect` : à cette densité, l'écriture directe
des octets est nettement plus rapide que 2 700 appels de dessin.

## 13. Codex

Un codex de texte n'a aucun intérêt dans un jeu dont tout le vocabulaire est visuel : le joueur
reconnaît une arme à la forme de son projectile, pas à son nom. Le codex affiche donc **75
vignettes à sprites animés** – 18 armes, 15 évolutions, 18 créatures, 24 reliques – avec, pour
chaque entrée découverte, ses chiffres réels tirés des tables de contenu.

### Animation en CSS pur
Les frames d'un sprite sont aplaties en une planche horizontale exportée en `data:` URI, puis
défilées par `steps()` sur `background-position`. Soixante-quinze sprites s'animent donc
simultanément **sans qu'une seule ligne de JavaScript ne tourne** – ce qui compte pour un écran
purement contemplatif, où une boucle d'animation par vignette serait absurde.

### Trois précautions
- **Échelle adaptative** : le codex mélange des sprites de 5 px (un éclat) à 60 px (le
  Sanguinaire). Le facteur d'agrandissement est calculé pour tenir dans la vignette, et reste
  **entier** afin de préserver la netteté.
- **Silhouettes** : une entrée non découverte n'est pas masquée mais réduite à une silhouette
  noire. On devine la forme sans rien apprendre – ce qui donne envie de la trouver.
- **Fondu aux extrémités du défilement** : sans lui, les vignettes sont tranchées net au bord
  de la zone, ce qui se lit comme un bug plutôt que comme une liste qui continue.

Les évolutions affichent leur **recette** (`Dague Ricochet + Trèfle`), qui est l'information
la plus difficile à découvrir seul dans le genre.

## 14. Curseur

Le curseur est lui aussi généré par le code : un masque 16×16 (`#` corps, `X` contour) agrandi
×2 et exporté en `data:` URI, décliné en trois teintes.

| Curseur | Où |
|---|---|
| **Lin, gemme acier** | Partout par défaut |
| **Or, gemme claire** | Boutons, cartes, personnages – tout ce qui se clique |
| **Rouge, gemme blanche** | Actions destructrices (réinitialisation de la sauvegarde) |

Trois points qui font la différence entre un curseur personnalisé réussi et un curseur pénible :

- **Contour sombre obligatoire.** Sans liseré, le curseur disparaît dès qu'il passe sur une
  zone claire de l'interface – et un curseur qu'on perd est pire qu'un curseur système.
- **Repli `auto` dans la déclaration.** `cursor: url(…) 1 1, auto` : si le navigateur refuse
  l'image, sans ce repli la propriété entière devient invalide et le curseur disparaît.
- **Point chaud au centre du bloc agrandi**, pas à son coin. Avec un facteur ×2, viser le coin
  fait atterrir le clic un pixel logique sous et à droite de la pointe – imperceptible sur une
  capture, très sensible à l'usage.

### Effacement automatique
Le jeu vise seul : en partie, la souris ne sert à rien. Le curseur s'efface après 1,6 s
d'immobilité et revient au moindre mouvement. Il n'est **jamais** masqué dans les menus, où il
reste le principal moyen d'interaction.

## 15. Typographie

Deux familles, deux rôles, **aucune téléchargée** — le jeu ne fait aucune requête réseau, une
webfont romprait cette garantie et ajouterait un flash de texte non stylé au chargement.

| Rôle | Famille | Usage |
|---|---|---|
| **Nommer** | Serif de labeur (`Iowan Old Style`, `Palatino`, `Georgia`, `serif`) | Titres, noms de personnages, d'armes et de reliques, phrases d'ambiance |
| **Informer** | Monospace (`ui-monospace`, `SF Mono`, `Cascadia Mono`, `Consolas`) | Boutons, libellés, chiffres, HUD, infobulles |

Le serif apporte le registre de manuscrit que le monospace seul ne donne pas : un nom de
relique en chasse fixe se lit comme une clé de configuration, pas comme un objet.

Le monospace, lui, est **obligatoire pour tout chiffre**. Une valeur en police
proportionnelle change de largeur à chaque incrément, et un compteur qui sautille attire
l'œil en permanence pour aucune information. Tous les nombres portent en plus
`font-variant-numeric: tabular-nums`.

Option d'accessibilité **« Police uniforme »** : une seule famille sans empattement, plus
espacée, pour les lecteurs que les empattements gênent.

## 16. Sprites dans le texte

Écrire « 900 OR » quand la pièce existe déjà en sprite oblige à lire là où l'on pourrait
reconnaître. Les valeurs de jeu portent donc leur sprite : l'or dans le HUD, dans la boutique,
au Sanctuaire et sur les cartes ; les morts dans le HUD. L'icône étant la même partout, elle
finit par se lire seule.

Les icônes sont dimensionnées en **em**, donc elles suivent l'échelle d'interface choisie dans
les options.

### Un piège de `background-position`
L'animation des planches doit défiler en **longueurs**, jamais en pourcentages. Un
`background-position` en pourcentage se résout contre `taille de l'élément − taille de
l'image` : sur une planche plus large que sa boîte, cette différence est négative, le sens
s'inverse et l'image sort du cadre. L'icône disparaissait cinq frames sur six — et restait
invisible sur une capture prise au mauvais moment.

## 17. Bulles de proximité

Un objet précieux hors champ est signalé par une **pastille plaquée au bord de l'écran**,
portant son propre sprite, un chevron vers sa direction et sa distance arrondie à la dizaine.

C'est ce qui rend l'exploration décidable. Sans elles, le joueur ne quitte jamais la zone
dégagée qu'il s'est ménagée, faute de savoir ce qu'il gagnerait à le faire — et tout le travail
sur les structures, les coffres et les reliques ne sert à rien.

### Priorité et plafond
Six pastilles au maximum, triées par importance puis par distance :
boss → pièce de collection → relique → coffre → cœur → structure. Elles s'estompent avec la
distance, et rien n'est affiché pour un objet déjà visible : une pastille ne doit jamais
doubler ce que le joueur a sous les yeux.

### Deux détails de géométrie qui font tout
- **Projection sur le rectangle de l'écran, pas sur un cercle.** Une pastille posée sur un
  cercle flotte au milieu des bords longs au lieu de les épouser — elle a l'air d'être perdue
  dans le décor plutôt que d'être un élément d'interface.
- **La base du chevron se construit perpendiculairement à la direction.** Avec un décalage
  angulaire de ±2,5 rad, les deux points de base repassent *derrière* la pointe : le résultat
  n'est pas une flèche mais un immense triangle qui recouvre entièrement la pastille.

La distance se place du côté **intérieur** de la pastille, faute de quoi elle sort de l'écran
sur les bords inférieurs.
