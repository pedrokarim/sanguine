# Monde et décor

> Document de conception. Décrit ce qu’il manque au terrain pour qu’il cesse d’être un fond
> et devienne un lieu : végétation variée, ruines à l’échelle de bâtiments, routes, villages
> abandonnés, sols à motifs, props destructibles, et les ornements d’interface qui vont avec.
>
> **Les sept points sont réalisés.** Ce document reste la référence de conception ; la
> section 12 relève ce qui a été mesuré à la livraison, y compris là où la mesure a
> contredit la prévision.

---

## 1. Où en est le terrain aujourd’hui

| Élément | État |
|---|---|
| Biomes | **5** – La Lande, Le Cimetière, Le Marais, Les Cendres, Les Bois Morts |
| Types de décor | **5** – rocher, tombe, roseau, souche, ossement. **Un seul dominant par biome** |
| Points d’intérêt | **7**, tous de 26 × 26 px |
| Tuiles de sol | 128 px, **4 variantes** par biome, différant par les cailloux et les touffes |
| Collision | **aucune** – rien n’arrête le joueur ni les ennemis |

Le défaut principal n’est pas la quantité mais la **monotonie de silhouette**. Chaque biome
tire son décor dans un seul sac : parcourir Le Marais, c’est croiser mille fois le même
roseau. Et rien ne dépasse 26 pixels, donc rien ne fait repère à distance.

---

## 2. Végétation – des arbres, et plusieurs

Le manque le plus criant. Aujourd’hui l’unique élément arboré est la souche, haute de
14 pixels.

### Ce qu’il faut

**Quatre familles d’arbres**, chacune en **3 à 4 variantes** de silhouette, et chaque variante
déclinée en 2 tailles. Soit une trentaine de sprites, ce qui suffit à ce qu’on ne reconnaisse
plus le motif en traversant.

| Famille | Biomes | Silhouette | Hauteur |
|---|---|---|---|
| **Pin mort** | Bois Morts, Cendres | Tronc droit, branches tombantes, cime cassée | 40 – 70 px |
| **Chêne noueux** | Lande, Cimetière | Tronc épais, houppier large et bas | 50 – 80 px |
| **Saule noyé** | Marais | Tronc penché, ramure retombant jusqu’au sol | 45 – 65 px |
| **Tronc calciné** | Cendres | Fût nu, noirci, souvent fendu | 30 – 55 px |

### Règles de dessin

- **La silhouette avant le détail.** Un arbre est vu de haut et à distance ; c’est son contour
  qui doit le distinguer, pas son écorce.
- **Le houppier est plus clair que le tronc**, et son bord opposé à la lumière porte la
  rasante froide déjà en place sur les créatures. La cohérence d’éclairage compte plus que la
  justesse botanique.
- **Aucun arbre ne dépasse 80 px.** Au-delà, il masque le joueur, ce qui est intolérable dans
  un jeu où l’on esquive.
- **Densité par couche.** Les arbres se sèment sur une cellule plus large que les props
  actuels – 300 px plutôt que 150 – pour qu’ils forment des bosquets et non un semis régulier.

### Bosquets

Un tirage indépendant, sur une cellule de 900 px, décide si la zone est un **bosquet** :
densité d’arbres multipliée par 3 sur un disque de 250 px. C’est ce qui crée des zones
denses et des clairières, là où un semis uniforme donne un papier peint.

---

## 3. Ruines – des bâtiments, pas des bornes

C’est la demande qui change le plus le jeu, et la plus coûteuse.

### Le principe

Des structures de **80 à 220 pixels**, à l’échelle de bâtiments, qui **arrêtent le joueur et
les ennemis**. Elles transforment le terrain en géographie : on contourne, on s’y adosse, on
s’y fait piéger.

| Ruine | Taille | Forme | Biomes |
|---|---|---|---|
| **Pan de mur** | 120 × 40 | Mur droit percé d’une brèche | tous |
| **Angle de maison** | 90 × 90 | Deux murs en L, un coin encore debout | Lande, Cimetière |
| **Nef effondrée** | 220 × 120 | Rangées de colonnes brisées, dallage | Cimetière |
| **Tour tronquée** | 80 × 110 | Cylindre éventré, escalier visible | Bois Morts |
| **Ferme brûlée** | 160 × 100 | Quatre murs bas, charpente tombée | Cendres |
| **Pontons rompus** | 180 × 70 | Planches sur pilotis, moitié immergées | Marais |

### Collision – le vrai chantier

**Rien n’existe aujourd’hui.** Il faut donc :

1. **Une forme de collision par ruine**, décrite comme une liste de rectangles alignés sur les
   axes – jamais la silhouette du sprite. Trois à six rectangles par ruine suffisent, et le
   test reste trivial.
2. **Un index spatial**, réutilisant la grille de hachage déjà en place pour les entités. Les
   ruines étant statiques, leur insertion se fait une fois par cellule de terrain découverte.
3. **Une résolution par glissement** : une entité qui entre dans un rectangle en est repoussée
   selon l’axe de moindre pénétration. C’est ce qui fait qu’on longe un mur au lieu de s’y
   coller.

#### Le risque, nommé

Le jeu tient **60 fps avec 750 ennemis**. Tester chaque ennemi contre chaque rectangle à
chaque frame le tuerait. Trois précautions :

- **Seules les entités proches d’une ruine sont testées**, via la grille. En pratique moins de
  5 % des ennemis à un instant donné.
- **Les ennemis volants ignorent les ruines.** Chauve-souris, corbeau, spectre passent
  au‑dessus. Cela réduit la charge et donne une raison d’exister aux volants.
- **Un plafond de sécurité** : au‑delà d’un certain nombre d’ennemis vivants, les ennemis
  terrestres cessent d’être bloqués et traversent. Un ralentissement se voit ; un ennemi qui
  traverse un mur au plus fort d’une déferlante, non.

#### Ce qu’il faudra vérifier avant de livrer

- Le joueur ne doit **jamais** pouvoir être coincé entre une ruine et la horde sans issue :
  toute ruine doit avoir au moins deux ouvertures.
- Le pathfinding des ennemis est inexistant – ils foncent en ligne droite. Contre un mur, ils
  s’agglutinent. C’est acceptable, voire tactique, mais il faut le mesurer avant de conclure.

---

## 4. Routes et places

Des **traits de sol**, sans collision, qui traversent le monde.

- **Chemins de terre.** Une bande de 40 à 70 px, plus claire que le sol, aux bords rongés.
  Tracée par une fonction du bruit : les routes suivent des lignes de niveau du terrain,
  jamais des droites parfaites.
- **Voies pavées.** Dans les zones de ruines : un dallage régulier, quelques dalles
  manquantes. C’est la texture qui dit qu’il y a eu une ville.
- **Places.** Une route qui croise une autre élargit en un disque pavé de 150 px, souvent avec
  un puits ou une croix au centre – un POI existant qui sert enfin d’ancrage.

Une route est un **repère de navigation** : dans un monde infini et sans carte, savoir qu’on
suit une route donne un sens à la marche.

---

## 5. Villages abandonnés

Un tirage sur une cellule de 2 000 px décide qu’une zone est un **village** :

- 4 à 9 ruines de type maison, disposées le long d’un tronçon de route pavée ;
- densité d’arbres divisée par 3 à l’intérieur, ce qui dégage la vue ;
- un POI garanti au centre – puits ou chapelle ;
- densité d’ennemis **augmentée de 40 %**, et un coffre garanti.

Un village doit être **désirable et dangereux**. S’il n’offrait qu’un décor, on le
contournerait ; s’il n’offrait que du danger, on le fuirait.

---

## 6. Sols – motifs et variété

Aujourd’hui, quatre variantes qui ne diffèrent que par les cailloux. Les captures de
Vampire Survivors montrent tout autre chose : des sols à **motifs répétés reconnaissables**,
qui changent complètement la lecture d’une zone.

### À ajouter

| Motif | Où | Description |
|---|---|---|
| **Dallage** | ruines, villages | Carreaux de 16 px, joints sombres, un quart d’entre eux fêlés |
| **Pavé** | routes | Galets irréguliers, appareil en arc de cercle |
| **Labour** | Lande | Sillons parallèles, légèrement obliques |
| **Vase** | Marais | Flaques sombres, reflets, herbes couchées |
| **Cendre battue** | Cendres | Croûte craquelée, réseau de fissures claires |
| **Terre remuée** | Cimetière | Monticules, terre retournée en damier irrégulier |

Le motif est choisi par la **fonction de terrain**, pas par le biome seul : une même lande
peut porter du labour, puis du dallage à l’approche d’un village. C’est ce changement sous
les pieds qui annonce qu’on arrive quelque part.

### Contrainte technique

La tuile fait 128 px et il en existe 4 variantes par biome. Ajouter 6 motifs porte le total à
5 × 4 × 6 = 120 tuiles de 128 px, soit environ 8 Mo en mémoire vive une fois rastérisées.
**C’est trop.** Deux options :

1. **Génération paresseuse** – seules les tuiles réellement affichées sont construites, avec
   une cache bornée à 40 entrées et éviction. C’est l’option retenue.
2. Réduire la tuile à 96 px, ce qui augmente le nombre d’appels de dessin. À écarter.

---

## 7. Props destructibles

Vampire Survivors sème des chandeliers qu’on brise pour en tirer du butin. C’est un mécanisme
simple qui donne une **raison d’attaquer le décor**, donc de s’en approcher.

| Prop | Contenu | Densité |
|---|---|---|
| **Brasero** | 1 pièce d’or, parfois un cœur | fréquent |
| **Jarre** | 2 à 5 gemmes | fréquent |
| **Reliquaire brisé** | 1 objet à effet immédiat | rare |
| **Sarcophage** | libère 3 à 5 ennemis, puis un coffre | rare, Cimetière |

Le sarcophage est le seul à **coûter** quelque chose. Sans lui, briser le décor serait un
gain gratuit, et le joueur le ferait machinalement.

---

## 8. Ornements d’interface

La référence montre des **cadres ouvragés autour des objets**, différenciés par rareté. Le jeu
a déjà un cadre 9-slice générique ; il lui manque la déclinaison.

### Cadres d’objet

| Rareté | Cadre | Traitement |
|---|---|---|
| Commune | Fer simple | Filet d’un pixel, coins carrés |
| Rare | Bronze | Filet double, coins à équerre |
| Épique | Argent gravé | Coins à volute, arête claire en haut à gauche |
| Maudite | Os et sang | Contour irrégulier, goutte qui perle en bas |

Le cadre s’applique aux **cartes d’amélioration, aux vignettes du Codex, aux cases de la
boutique et à celles de l’Archive**. Une rareté doit se lire à la monture avant même la
couleur du texte – c’est ce qui rend le tri instantané.

### Fond de vignette

Un dégradé radial très sombre, teinté de la couleur de rareté à 8 % d’opacité. Assez pour
que l’objet se détache, assez peu pour ne pas concurrencer sa propre couleur.

---

## 9. Ce que Vampire Survivors fait d’autre, et qui manque ici

Relevé après examen, au-delà de ce qui a été demandé.

| Mécanisme | Ce que ça apporte | Coût |
|---|---|---|
| **Obstacles infranchissables à grande échelle** | Des couloirs, donc des points d’étranglement où la horde se concentre. Change la tactique, pas seulement le décor | élevé – dépend de la collision |
| **Objets fixes posés à des positions connues** | Une raison d’explorer dans une direction plutôt qu’une autre | faible |
| **Zones à densité propre** | Une carte qui n’est pas uniformément dangereuse : on choisit son risque | moyen |
| **Musique par zone** | Le changement de biome s’entend avant de se voir | moyen |
| **Éclairage local** | Un brasero qui éclaire son voisinage. Le jeu a déjà les halos, ils ne servent qu’au feu | faible |
| **Météo légère** | Pluie sur le Marais, cendres qui tombent sur les Cendres. Une couche de particules par biome | faible |
| **Bords de biome francs** | Aujourd’hui la transition est diffuse. Une lisière nette – une haie, un muret, une berge – rend le passage lisible | moyen |

Les deux qui rapportent le plus pour le moins d’effort : **la météo par biome** et
**l’éclairage local**. Toutes deux réutilisent des systèmes déjà écrits.

---

## 10. Ordre proposé

1. **Végétation** – aucun risque, gain immédiat, ne touche à aucun système.
2. **Sols à motifs** – contenu pur, avec la cache paresseuse à mettre en place.
3. **Props destructibles** – réutilise le butin existant.
4. **Ornements d’interface** – indépendant du reste, peut se faire en parallèle.
5. **Routes et places** – première brique de géographie.
6. **Collision et ruines** – en dernier, parce que c’est le seul point qui peut coûter des
   images par seconde et déséquilibrer le jeu.
7. **Villages** – ne vaut qu’une fois 5 et 6 en place.

Rien avant 6 ne met le jeu en danger. Le point 6 doit être mesuré à 700 ennemis avant d’être
considéré comme acquis, exactement comme l’a été la mise à l’échelle des sprites.

---

## 11. Ce qu’il faudra vérifier

- **Lisibilité.** Le décor ne doit jamais masquer un ennemi ni un objet au sol. Test : une
  capture à la vingtième minute, décor dense, et compter ce qu’on distingue.
- **Performance.** 60 fps à 700 ennemis, avec ruines et collision actives.
- **Mémoire.** La cache de tuiles doit rester bornée ; le tas était mesuré stable à 7 Mo, il
  ne doit pas dériver.
- **Lecture du sol.** Une route doit se voir à un écran de distance, sinon elle ne sert à rien
  comme repère.


---

## 12. Ce qui a été mesuré à la livraison

| Point | Prévu | Mesuré |
|---|---|---|
| Végétation | 4 essences, 3 à 4 variantes | 4 essences, 4 variantes, 2 tailles – **16 silhouettes** |
| Sols | 6 motifs, cache bornée | 6 motifs, cache à 40 entrées, **+1 ms** de rendu |
| Destructibles | 4 props | 4 props, implémentés en ennemis immobiles |
| Ornements | 4 montures | 4 montures – posées au Codex et sur les pastilles du HUD |
| Routes | un réseau | **4,3 %** des tuiles |
| Collision | risque de chute d’images | **aucun coût mesurable** |
| Villages | 4 à 9 maisons | 4 à 9 maisons, pression **+40 %** |

### Là où la mesure a corrigé la prévision

**La collision ne coûte rien.** Le document la présentait comme le seul point risqué, à
mesurer avant de conclure. Relevé : **60 images par seconde avec 993 ennemis** sur une nef à
huit rectangles, `update` à 0,5 ms. Les trois précautions écrites – rassemblement des murs
quatre fois par seconde, volants exemptés, plafond à 420 ennemis – étaient probablement
excessives. Elles restent en place : le coût d’une précaution inutile est nul, celui d’une
précaution manquante ne l’est pas.

**Le seuil des routes était dix fois trop large.** À la valeur choisie sur le papier, **11 %**
des tuiles portaient une route – un quadrillage, pas un chemin. Il a fallu descendre à 4,3 %
pour qu’une route redevienne un événement.

**La densité d’arbres était trois fois trop faible.** À 0,3 dans le Cimetière, on croisait
deux arbres par écran et l’ajout ne se remarquait pas. Montée entre 0,42 et 0,92 selon le
biome.

### Ce que le document annonçait et qui n’avait pas lieu d’être

Les ornements devaient s’appliquer « aux cartes d’amélioration, aux cases de la boutique et à
celles de l’Archive ». Ni la boutique ni l’Archive n’ont de notion de rareté, et les reliques
ne sont pas proposées en cartes – elles tombent au sol. La monture n’est donc posée qu’au
Codex et sur les pastilles du HUD, seuls endroits où une rareté existe.
