# Sanguine — Bible de contenu

Ce document est la **source de vérité** du contenu. Les tables `src/data/*.ts` doivent le refléter.

---

## 1. Armes (18 + 15 évolutions)

Toutes les armes montent au **niveau 8**. `dmg/niv` est le gain de dégâts par niveau (multiplicatif
sur la base), `cd` la recharge de base en secondes.

| # | Nom | Comportement | Dégâts | cd | Passif requis | Évolution |
|---|---|---|---|---|---|---|
| 1 | **Pieu** | Tire vers l'ennemi le plus proche, perce 1 | 10 | 1.1 | Poudre | **Salve du Charpentier** |
| 2 | **Croix** | Boomerang qui part loin et revient, perce tout | 12 | 1.6 | Longue-vue | **Crucifixion** |
| 3 | **Ail** | Aura permanente autour du joueur, repousse | 4 | 0.55 | Calice | **Aïoli** |
| 4 | **Eau Bénite** | Fiole lobée, laisse une flaque qui brûle | 15 | 2.4 | Grimoire | **Déluge** |
| 5 | **Lanterne** | Orbes en orbite, dégâts au contact | 9 | 2.0 | Sablier | **Ronde des Âmes** |
| 6 | **Faux** | Arc de mêlée dans la direction du mouvement | 18 | 1.3 | Reliquaire | **Moisson** |
| 7 | **Jugement** | Éclairs sur des ennemis aléatoires | 22 | 2.8 | Trèfle | **Colère Divine** |
| 8 | **Miroir** | Nova d'éclats dans toutes les directions | 8 | 2.2 | Plume | **Kaléidoscope** |
| 9 | **Familier** | Chauve-souris autonome qui pourchasse | 11 | 0.9 | Bottes | **Nuée** |
| 10 | **Sel** | Traînée persistante derrière le joueur | 6 | 0.4 | Longue-vue | — |
| 11 | **Sang Corrompu** | Explose quand le joueur est touché | 30 | 0.0 | Talisman | — |
| 12 | **Encensoir** | Balayage lent d'une large zone conique | 14 | 3.0 | Cœur d'Argent | — |
| 13 | **Arbalète** | Rafale de 3 carreaux rapides, faible portée | 7 | 1.4 | Plume | **Balista** |
| 14 | **Fléau** | Boule au bout d'une chaîne, tourne vite au corps-à-corps | 16 | 0.8 | Cœur d'Argent | **Comète** |
| 15 | **Braséro** | Dépose des braises au sol qui brûlent longtemps | 9 | 1.8 | Grimoire | **Fournaise** |
| 16 | **Dague Ricochet** | Rebondit d'ennemi en ennemi (5 rebonds) | 13 | 1.5 | Trèfle | **Danse des Lames** |
| 17 | **Ronces** | Des pieux jaillissent du sol autour du joueur | 20 | 2.6 | Talisman | **Jardin de Fer** |
| 18 | **Cor de Chasse** | Onde de choc circulaire qui repousse violemment | 12 | 2.9 | Reliquaire | **Appel de la Meute** |

### Détail des évolutions

| Évolution | Ce qui change |
|---|---|
| **Salve du Charpentier** | 6 pieux en éventail, perce 5, dégâts ×2.4 |
| **Crucifixion** | La croix ne revient plus : elle orbite au loin en permanence, perce à l'infini |
| **Aïoli** | L'aura double de rayon, applique un poison qui empile |
| **Déluge** | 4 fioles à la fois, les flaques durent 3× plus longtemps |
| **Ronde des Âmes** | Deux anneaux d'orbes contrarotatifs, dégâts ×2 |
| **Moisson** | L'arc devient un 360°, soigne 1 PV tous les 15 ennemis tués |
| **Colère Divine** | Chaque éclair se ramifie sur 3 cibles proches |
| **Kaléidoscope** | La nova rebondit sur les bords de l'écran |
| **Nuée** | 4 familiers au lieu d'un, vitesse ×1.5 |
| **Balista** | Rafale de 8, les carreaux percent tout et clouent au sol (ralentissement) |
| **Comète** | La boule se détache et rebondit librement sur la carte, en feu |
| **Fournaise** | Les braises s'étendent en nappes qui se rejoignent |
| **Danse des Lames** | 20 rebonds, les dégâts augmentent de 15 % à chaque rebond |
| **Jardin de Fer** | Les ronces couvrent tout l'écran par ondes concentriques |
| **Appel de la Meute** | L'onde invoque 3 loups spectraux alliés qui combattent pour vous |

**Règle d'évolution** : arme au niveau 8 + passif requis au niveau 3 minimum + ouvrir un coffre.

---

## 2. Passifs (12)

Niveau max **5**. Le gain est linéaire par niveau.

| # | Nom | Effet par niveau | Total au max |
|---|---|---|---|
| 1 | **Reliquaire** | +10 % dégâts | +50 % |
| 2 | **Bottes de Voyage** | +8 % vitesse de déplacement | +40 % |
| 3 | **Cœur d'Argent** | +20 PV max | +100 PV |
| 4 | **Sablier** | −8 % recharge | −40 % |
| 5 | **Longue-vue** | +12 % zone d'effet | +60 % |
| 6 | **Poudre** | +1 projectile (tous les 2 niveaux) | +3 projectiles |
| 7 | **Plume** | +15 % vitesse des projectiles | +75 % |
| 8 | **Grimoire** | +15 % durée des effets | +75 % |
| 9 | **Aimant** | +25 % rayon de ramassage | +125 % |
| 10 | **Talisman** | +1 armure | +5 armure |
| 11 | **Trèfle** | +8 % chance, +3 % critique | +40 % / +15 % |
| 12 | **Calice** | +0.4 PV/s de régénération | +2 PV/s |

---

## 3. Personnages (6)

| Nom | Arme de départ | Bonus | Malus | Déblocage |
|---|---|---|---|---|
| **Ysolde la Chasseresse** | Pieu | +10 % dégâts | — | Départ |
| **Frère Anselme** | Eau Bénite | +25 % zone, +40 PV | −10 % vitesse | Départ |
| **Vasco le Braconnier** | Ail | +20 % vitesse, +1 projectile | −25 PV max | Atteindre 10 min |
| **Marguerite la Sourcière** | Lanterne | +60 % ramassage, +20 % chance | −10 % dégâts | Ramasser 3000 gemmes (cumul) |
| **Sœur Ombre** | Faux | −20 % recharge, +10 % critique | −30 PV max | Tuer 5000 ennemis (cumul) |
| **Le Comte Déchu** | Sang Corrompu | Vol de vie 3 %, +30 % dégâts | Aucune régénération, −40 PV | Gagner une partie |

---

## 4. Ennemis (13 communs + 4 boss)

`hp` / `dmg` / `vit` sont les valeurs de **base**, avant mise à l'échelle temporelle.

| Nom | hp | dmg | vit | Comportement | Apparition |
|---|---|---|---|---|---|
| **Chauve-souris** | 8 | 5 | 62 | Poursuite directe, ondule | 0 min |
| **Goule** | 14 | 8 | 44 | Poursuite directe | 0 min |
| **Corbeau** | 10 | 6 | 74 | Trajectoire erratique | 2 min |
| **Loup** | 22 | 12 | 88 | Charge, marque une pause après | 4 min |
| **Squelette** | 40 | 12 | 40 | Poursuite lente, résiste au recul | 5 min |
| **Araignée** | 16 | 9 | 70 | Apparaît par grappes de 8 | 7 min |
| **Zombie** | 90 | 16 | 26 | Très lent, très résistant | 8 min |
| **Spectre** | 30 | 14 | 96 | Traverse les autres ennemis | 10 min |
| **Nécrophage** | 55 | 10 | 34 | **Crache un projectile** à distance | 12 min |
| **Sangsue** | 45 | 18 | 52 | Se soigne en touchant le joueur | 14 min |
| **Cavalier** | 70 | 22 | 130 | Ruée en ligne droite, traverse l'écran | 16 min |
| **Golem de Chair** | 220 | 28 | 22 | Énorme, écrase, recul immunisé | 19 min |
| **Damné** | 130 | 24 | 60 | Se scinde en 2 Goules à la mort | 22 min |

### Élites
À partir de 6 min, 1 ennemi sur 60 apparaît en **élite** : ×6 PV, ×1.4 taille, halo rouge,
couronne, recul immunisé. Lâche systématiquement un **coffre**.

### Boss

| Minute | Nom | PV | Mécanique |
|---|---|---|---|
| 10 | **La Matrone** | 3 000 | Invoque 6 araignées toutes les 4 s |
| 18 | **Le Chevalier Exsangue** | 9 000 | Alterne poursuite lente et charges télégraphiées |
| 24 | **Chœur de Cendres** | 14 000 | Trois corps liés, tuer les trois |
| 30 | **Le Sanguinaire** | 40 000 | 3 phases : invocation → nova de projectiles → frénésie |
| 30:00+ | **La Faucheuse** | ∞ | Invulnérable, tue en un contact. Fin de partie. |

---

## 5. Table des vagues

Le *director* fait apparaître les ennemis **hors écran**, sur un anneau autour du joueur.

```
tauxApparition(min)   = 1.1 + min × 0.70      (ennemis par seconde)
plafondSimultané(min) = min(160 + min × 36, 1100)
```

**Valeurs calibrées au bot de test, pas à l'intuition.** Deux réglages ont été mesurés et
rejetés avant celui-ci :

| Réglage | Résultat mesuré |
|---|---|
| `0.9 + min × 0.55` | Population maintenue à ~20 ennemis, niveau 8 seulement à 3 min 30 : trop vide |
| `1.6 + min × 1.05` | 474 ennemis à 6 min, **une seule arme au niveau 5**, mort à 6 min 48 |
| `1.1 + min × 0.70` | Niveau 14 à 4 min 30, 4 armes, 745 morts, 60 fps — retenu |

L'enseignement : au-delà d'un certain seuil, **augmenter la densité réduit la progression**.
Le joueur ne tue plus assez vite, ne ramasse plus de gemmes, et la courbe d'XP s'effondre
pendant que l'écran se remplit.

Événements ponctuels :

| Minute | Événement |
|---|---|
| 3 | **Nuée** : 60 chauves-souris en cercle fermé |
| 6 | **Meute** : 20 loups sur un seul flanc |
| 9 | **Marée** : mur de goules qui traverse l'écran |
| 10 | **BOSS — La Matrone** |
| 13 | **Nid** : 12 grappes d'araignées |
| 15 | **Colonne** : 30 squelettes en formation |
| 18 | **BOSS — Le Chevalier Exsangue** |
| 21 | **Charge** : 25 cavaliers en salves successives |
| 24 | **BOSS — Chœur de Cendres** |
| 26 | **Écrasement** : 15 golems |
| 28 | **Déferlante** : taux d'apparition ×3 |
| 30 | **BOSS FINAL — Le Sanguinaire** |

---

## 6. Sanctuaire (méta-progression)

| Amélioration | Effet / niveau | Niveaux | Coût de base |
|---|---|---|---|
| **Puissance** | +5 % dégâts | 5 | 200 |
| **Vitalité** | +15 PV max | 5 | 150 |
| **Célérité** | +4 % vitesse | 5 | 180 |
| **Armure** | +1 armure | 3 | 400 |
| **Régénération** | +0.2 PV/s | 3 | 350 |
| **Aimantation** | +15 % ramassage | 3 | 120 |
| **Avarice** | +12 % or | 4 | 250 |
| **Croissance** | +6 % XP | 4 | 300 |
| **Fortune** | +8 % chance | 3 | 450 |
| **Reroll** | +1 reroll par run | 3 | 500 |
| **Résurrection** | +1 revive par run | 2 | 1 500 |

Coût réel : `base × 1.8^(niveauActuel)`.

---

## 7. Rareté et tirage des cartes

Poids de base dans le tirage de niveau :

```
Arme déjà possédée, améliorable   : 100
Passif déjà possédé, améliorable  :  85
Nouvelle arme (slot libre)        :  70
Nouveau passif (slot libre)       :  60
Lot de secours                    :   1   (uniquement si rien d'autre)
```

La `luck` multiplie le poids des nouveaux objets et donne
`probabilité(4e carte) = min(0.5, (luck − 1) × 0.6)`.

---

## 8. Récompenses de coffre

Le nombre d'améliorations dépend de la chance :

| Tirage | Contenu |
|---|---|
| 65 % | 1 amélioration + 15 or |
| 25 % | 3 améliorations + 40 or |
| 9 % | 5 améliorations + 100 or |
| 1 % | 5 améliorations + 300 or + 1 reroll |

**Si une évolution est disponible, elle remplace toujours la première amélioration du coffre.**
C'est le seul moyen d'obtenir une évolution.

---

## 9. Reliques (24)

Les **reliques** sont des objets uniques qui **n'apparaissent jamais dans le menu de niveau**.
On ne les trouve qu'au sol, lâchées par les élites et les boss, ou dans les coffres. Elles ne
prennent **aucun emplacement** — on peut toutes les cumuler. C'est la couche de butin « surprise »
qui rend chaque run différent.

Chaque relique a une **rareté** qui détermine sa couleur, son halo et son fracas sonore :
`Commune` (blanc) · `Rare` (bleu) · `Épique` (violet) · `Maudite` (rouge — puissante mais avec un coût).

| # | Nom | Rareté | Effet |
|---|---|---|---|
| 1 | **Dent de Loup** | Commune | +25 % de dégâts sur les ennemis sous 30 % de PV |
| 2 | **Œil de Verre** | Commune | +8 % de critique |
| 3 | **Semelles Clou­tées** | Commune | +12 % de vitesse |
| 4 | **Bourse Percée** | Commune | +25 % d'or ramassé |
| 5 | **Fiole Tiède** | Commune | Les cœurs soignent 2× plus |
| 6 | **Clé Rouillée** | Commune | +1 amélioration par coffre |
| 7 | **Chapelet Brisé** | Rare | Tous les 12 coups, l'ennemi touché est étourdi 1 s |
| 8 | **Plume de Corbeau** | Rare | Les projectiles traversent 1 ennemi de plus |
| 9 | **Sablier Fêlé** | Rare | −12 % de recharge, mais −8 % de vitesse de projectile |
| 10 | **Ambre** | Rare | Les ennemis tués ralentissent leurs voisins 2 s |
| 11 | **Miroir de Poche** | Rare | 10 % de chance de renvoyer les dégâts subis |
| 12 | **Cendre Bénite** | Rare | Les gemmes valent +20 % d'XP |
| 13 | **Griffe Fossile** | Rare | +1 projectile pour les armes qui en tirent |
| 14 | **Lanterne Sourde** | Rare | +35 % de rayon de ramassage, −5 % de zone |
| 15 | **Cœur Battant** | Épique | +15 % de PV max et régénère 1 % par seconde sous 30 % de PV |
| 16 | **Couronne de Fer** | Épique | Les élites lâchent 2 coffres |
| 17 | **Marque du Chasseur** | Épique | Les boss subissent +30 % de dégâts |
| 18 | **Faux Miniature** | Épique | 3 % de chance d'exécuter instantanément un ennemi non-boss |
| 19 | **Sceau de Fonte** | Épique | +3 armure, −6 % de vitesse |
| 20 | **Orbe Fracturé** | Épique | Toutes les 8 s, une nova gratuite autour du joueur |
| 21 | **Calice Renversé** | Maudite | Vol de vie 4 %, mais la régénération est annulée |
| 22 | **Pacte de Sang** | Maudite | +45 % de dégâts, PV max divisés par 2 |
| 23 | **Horloge Arrêtée** | Maudite | −30 % de recharge, les ennemis gagnent +15 % de PV |
| 24 | **Dernier Souffle** | Maudite | Une résurrection, mais à 1 PV et sans invulnérabilité |

Probabilité de rareté à la découverte, modulée par la `luck` :
`Commune 55 % · Rare 28 % · Épique 12 % · Maudite 5 %`

---

## 10. Table de butin complète

Chaque ennemi tué lance un jet. Les probabilités sont modulées par `luck`.

| Objet | Chance | Effet | Rendu |
|---|---|---|---|
| **Gemme bleue** | 74 % | 2 XP | Losange 4 pointes, oscillation lente |
| **Gemme verte** | 14 % | 9 XP | Losange 5 pointes, pulsation |
| **Gemme rouge** | 3 % | 35 XP | Losange 6 pointes, halo + étincelles |
| **Gemme violette** | 0,4 % | 140 XP | Losange 7 pointes, halo large |
| **Pièce d'or** | 12 % | 1–10 or | Rotation sur 6 frames |
| **Sac d'or** | 1 % | 25–80 or | Rebondit puis se pose |
| **Cœur** | 1,5 % | +25 % PV max | Pulsation cardiaque |
| **Aimant** | 0,5 % | Attire toutes les gemmes | Ondes concentriques |
| **Encensoir** | 0,3 % | Tue tout à l'écran | Explosion blanche + flash |
| **Bombe** | 0,4 % | Explosion massive à l'endroit | Mèche animée |
| **Sablier** | 0,3 % | Fige les ennemis 4 s | Teinte bleue plein écran |
| **Parchemin** | 0,25 % | +1 reroll | Se déroule |
| **Relique** | Élites/boss | Voir §9 | Colonne de lumière + fracas |
| **Coffre** | Élites/boss | Voir §8 | Ouverture en 8 frames + rayons |

**Fusion automatique** : au-delà de 400 gemmes au sol, les plus anciennes fusionnent en gemmes
de rang supérieur. Aucune valeur n'est perdue, et le nombre d'entités reste borné.

---

## 11. Catalogue d'animations

Tout ce qui bouge à l'écran est animé. Aucun sprite statique.

| Élément | Frames | Détail |
|---|---|---|
| Marche des ennemis | 4 | Cycle + inclinaison selon la direction |
| Mort des ennemis | 5 | Dislocation + gerbe de sang |
| Dégâts subis | 2 | Sprite pré-teinté blanc, 80 ms |
| Marche du joueur | 6 | Cycle + cape qui traîne |
| Joueur touché | — | Clignotement 0,7 s + flash écran + secousse |
| Idle du joueur | 4 | Respiration |
| Gemmes | 8 | Oscillation verticale + scintillement |
| Or | 6 | Rotation complète |
| Cœur | 6 | Battement à deux temps |
| Coffre | 8 | Ouverture + rayons + éjection du contenu |
| Relique au sol | ∞ | Rotation lente + colonne de lumière + particules montantes |
| Montée de niveau | 12 | Anneau qui s'étend + texte qui monte |
| Projectiles | 2–4 | Selon l'arme, plus une traînée |
| Impacts | 4 | Éclat orienté selon l'angle d'impact |
| Chiffres de dégâts | — | Montée + fondu, plus gros et jaunes si critique |
| Apparition de boss | — | Ralenti 1 s, bandeau de nom, vignette rouge |
| Herbe / décor | 3 | Ondulation au passage du joueur |

---

## 12. Biomes (5)

Le monde est infini et **déterministe à partir de la position** : aucune carte n'est stockée,
et un lieu donné est toujours le même. Les biomes sont découpés par deux octaves de bruit de
valeur, à une échelle d'environ 1 400 px (trois écrans de large).

| Biome | Ennemis favorisés | Effet passif | Décor |
|---|---|---|---|
| **La Lande** | — (répartition neutre) | — | Rochers |
| **Le Cimetière** | Squelettes ×3.2, Spectres ×2.4, Goules ×1.8 | — | Stèles penchées |
| **Le Marais** | Zombies ×3, Sangsues ×2.6, Nécrophages ×2.2 | **−14 % de vitesse** | Roseaux |
| **Les Cendres** | Damnés ×2.6, Golems ×2.2 | **+8 % de dégâts** | Ossements |
| **Les Bois Morts** | Loups ×3, Araignées ×2.4, Corbeaux ×2.2 | −4 % de vitesse | Souches |

La Lande domine (~40 % de la surface) : les biomes marqués doivent rester des événements de
traversée, pas la norme. Entrer dans un biome affiche son nom et sa phrase d'ambiance.

---

## 13. Structures et points d'intérêt (7)

Placés sur une grille déterministe de 600 px, avec 62 % de chance d'occupation par cellule —
soit une structure toutes les 8 à 10 secondes de marche. Chacune ne se déclenche **qu'une
fois**, au contact, et s'éteint visuellement ensuite.

| Structure | Effet | Intention |
|---|---|---|
| **Autel de Sang** | Libère une relique | La récompense la plus forte, donc la plus rare |
| **Bûcher** | Soigne 30 %, explosion de 150 px, laisse un foyer de 12 s | Point défensif réutilisable |
| **Obélisque** | +30 % de dégâts pendant 45 s | Récompense le détour offensif |
| **Puits** | 150 à 400 or | Alimente le Sanctuaire |
| **Ossuaire** | Réveille un golem élite + 2 coffres | Piège assumé : la récompense se mérite |
| **Chapelle Noyée** | Soins complets + 1 reroll | Le seul vrai répit de la carte |
| **Cairn** | 10 gemmes vertes | Coup d'accélérateur d'XP |

Le biome infléchit le tirage : ossuaires et chapelles au Cimetière, bûchers dans les Cendres,
puits au Marais, cairns dans les Bois Morts.

**Tension de design** : atteindre une structure oblige à quitter la zone dégagée que le joueur
s'est ménagée, et à traverser la horde deux fois — à l'aller et au retour.
