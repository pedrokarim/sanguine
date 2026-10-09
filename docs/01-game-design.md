# Sanguine – Game Design

## 1. Boucle de jeu

### Boucle seconde (moment-to-moment)
```
Se déplacer  →  les armes tirent seules  →  les ennemis meurent  →
ils lâchent des gemmes  →  on se déplace pour les ramasser  →  on s'expose  →  …
```
La tension centrale : **ramasser de l’XP oblige à aller vers le danger.** Le joueur qui fuit
en permanence ne monte pas de niveau et se fait rattraper par la courbe de difficulté.

### Boucle minute (run)
```
Niveau gagné  →  3 cartes proposées  →  choix  →  le build change  →
la vague suivante est plus dense  →  …
```

### Boucle méta (session)
```
Mort ou victoire  →  l'or est converti  →  achat d'améliorations permanentes
au Sanctuaire  →  déblocage de personnages/armes  →  nouveau run
```

## 2. Structure d’une partie

Une partie dure **30 minutes**. Le temps est le seul véritable adversaire.

| Minute | Phase | Intention de design |
|---|---|---|
| 0–3 | **Découverte** | Peu d’ennemis. Le joueur teste son arme de départ, monte 4-5 niveaux. |
| 3–8 | **Densification** | Les premiers groupes serrés. Le joueur doit commencer à kiter. |
| 8–12 | **Premier mur** | Boss *La Matrone*. Un build mal orienté cale ici. |
| 12–18 | **Explosion** | Les évolutions arrivent. Le joueur devient très fort d’un coup. |
| 18–24 | **Rattrapage** | La densité rattrape la puissance. Élites fréquents. |
| 24–29 | **Survie pure** | L’écran est plein. Seuls les builds aboutis tiennent. |
| 29–30 | **Le Sanguinaire** | Boss final. Le tuer = victoire. |

Si le joueur atteint 30:00 sans tuer le boss, la **Faucheuse** apparaît : invulnérable,
un seul contact tue. C’est le rideau. Elle règle son pas sur celui du joueur à chaque
instant – une vitesse fixe la rendait triviale à semer dès qu’on montait ses bottes.

Elle vient aussi **quand la horde déborde**. Le nombre d’ennemis simultanés est plafonné pour
protéger l’appareil ; s’y cogner en silence serait la pire des réponses, puisque le joueur
verrait le flux se tarir sans comprendre pourquoi. Tenir ce plafond pendant vingt-six secondes
signifie que l’écart ne se refermera plus : la Faucheuse vient le dire, après un avertissement
qui laisse le temps de percer ou de fuir. La contrainte technique devient une règle du monde.

### Rangs de résistance

La résistance de fond monte avec le temps **et avec le niveau du joueur**. Par-dessus, une
minorité d’ennemis est nettement plus dure, et le signale par un calque coloré :

| Rang | PV | Taille | Vitesse | Apparaît | Marque |
|---|---|---|---|---|---|
| Endurci | ×2,4 | ×1,12 | ×0,96 | 5ᵉ min | halo bleu |
| Élite | ×6 | ×1,4 | ×0,9 | 9ᵉ min | halo doré + cerne |
| Colosse | ×18 | ×1,85 | ×0,74 | 14ᵉ min | halo violet + cerne + barre permanente |

Un ennemi dix-huit fois plus résistant que son voisin sans marque visible n’est pas une
difficulté : le joueur en conclut que son arme ne fonctionne plus et s’obstine, au lieu de
contourner. Ce qui encaisse avance aussi moins vite – sinon un colosse serait une punition
qu’on ne peut ni tuer ni distancer.

### Surpassements

Passé six armes et six objets au maximum, plus rien ne peut être amélioré. Les montées de
niveau proposaient alors indéfiniment les trois mêmes lots de secours. Les **surpassements**
prennent le relais : de petits bonus permanents qui ne s’épuisent jamais, numérotés en
chiffres romains. Ils sont volontairement modestes, la résistance des ennemis croissant avec
le niveau du joueur – ils servent à tenir le rythme, pas à reprendre l’avantage.

## 3. Contrôles

| Action | Clavier | Manette | Tactile |
|---|---|---|---|
| Déplacement | `ZQSD` / `WASD` / flèches | Stick gauche | Joystick virtuel (glisser) |
| Pause | `Échap` / `P` | Start | Bouton HUD |
| Valider | `Entrée` / `Espace` / clic | A | Tap |
| Naviguer menus | Flèches / `ZQSD` | D-pad | Tap |
| Minimap | `M` | – | – |
| Plein écran | `F` | – | Bouton HUD |

**Aucune touche d’attaque.** C’est intentionnel et central au genre.

Le clavier gère `ZQSD` **et** `WASD` simultanément par code physique (`KeyW`/`KeyZ`), donc les
dispositions AZERTY et QWERTY fonctionnent sans configuration.

## 4. Statistiques du joueur

Les stats sont calculées à chaque changement de build, jamais dans la boucle de rendu.

| Stat | Base | Effet | Cap |
|---|---|---|---|
| `maxHp` | 100 | Points de vie | – |
| `regen` | 0 | PV rendus par seconde | – |
| `armor` | 0 | Dégâts plats retirés (35 % du coup passent toujours) | – |
| `moveSpeed` | 100 | Pixels/seconde | – |
| `might` | 1.0 | Multiplicateur de dégâts | – |
| `area` | 1.0 | Multiplicateur de taille des effets | – |
| `cooldown` | 1.0 | Multiplicateur de temps de recharge (plus bas = mieux) | 0.4 |
| `speedMul` | 1.0 | Vitesse des projectiles | – |
| `duration` | 1.0 | Durée des effets persistants | – |
| `amount` | 0 | Projectiles supplémentaires (additif) | – |
| `pickupRadius` | 60 | Rayon d’aimantation des gemmes | – |
| `luck` | 1.0 | Influence coffres, crit, drops rares | – |
| `growth` | 1.0 | Multiplicateur d’XP gagnée | – |
| `greed` | 1.0 | Multiplicateur d’or gagné | – |
| `revives` | 0 | Résurrections automatiques | – |
| `crit` | 0.05 | Probabilité de coup critique (×2 dégâts) | 1.0 |

### Formule de dégâts
```
brut     = arme.damage × (1 + arme.level × arme.damagePerLevel) × player.might
critique = aléatoire < player.crit  →  brut × 2
final    = max(1, arrondi(brut × critique) − cible.armor)
```

### Formule de recharge
```
cooldownRéel = max(arme.cooldown × player.cooldown × arme.cooldownPerLevel^level, 0.05s)
```
Le plancher à 0,05 s évite qu’une arme sur-optimisée sature la boucle de mise à jour.

## 5. Progression d’XP

```
xpRequis(niveau) = arrondi(4 + niveau × 5.5 + niveau^1.5 + 2.2 × max(0, niveau − 45)²)
```
Le premier palier doit être bas : les premières cartes sont ce qui donne au joueur le
sentiment d’exister, et les faire attendre une minute tue l’ouverture.

Le terme carré ne joue qu’à partir du niveau 45, atteint vers la neuvième minute. Sans lui,
la partie s’emballait : mesuré au bot (`tools/balance-bot.js`), le joueur finissait au
niveau 199 et ne risquait plus rien de la treizième à la trentième minute.

Mesuré au bot de test : ~6 niveaux la première minute, ~23 à la sixième, de l’ordre de
115 sur un run complet.

## 6. Système d’améliorations

À chaque niveau, **3 cartes** (4 avec beaucoup de chance) sont tirées parmi :

- une **nouvelle arme** (si moins de 6 armes équipées) ;
- une **montée de niveau** d’arme existante (max niveau 8) ;
- un **nouveau passif** (si moins de 6 passifs) ;
- une **montée de niveau** de passif (max niveau 5) ;
- un **lot de secours** (soin, or, ou petit bonus) si plus rien n’est disponible.

Le tirage est **pondéré** : les objets déjà possédés apparaissent plus souvent (pour permettre
d’aboutir un build), les objets rares moins. La `luck` du joueur augmente la chance de voir une
quatrième carte et de tirer un objet rare.

Un bouton **Reroll** (limité, gagné dans les coffres) permet de retirer les trois cartes.
Un bouton **Passer** échange le choix contre de l’or.

### Évolutions
Une arme au **niveau max (8)** combinée à un **passif requis au niveau 3+** devient éligible.
L’évolution n’apparaît **jamais** dans le menu de niveau : elle ne peut sortir que d’un **coffre**.
C’est ce qui rend les coffres excitants plutôt qu’anecdotiques.

Une arme évoluée occupe le même emplacement, part au niveau 1 avec des statistiques largement
supérieures, et ne peut plus monter de niveau (elle est déjà l’aboutissement).

## 7. Slots

- **6 emplacements d’armes**, **6 emplacements de passifs.**
- Une fois les 6 armes prises, plus aucune nouvelle arme n’est proposée.
- Ce plafond est ce qui force les vrais choix. Il ne bouge jamais, même au méta.

## 8. Ennemis et danger

Les ennemis **n’ont pas d’attaque à distance** sauf le Nécrophage. Le danger vient du **contact** :
un ennemi qui touche le joueur inflige ses dégâts puis subit un court délai avant de pouvoir
retoucher (`0.5 s`), ce qui rend la traversée d’un groupe survivable mais coûteuse.

Le joueur possède **0,7 s d’invulnérabilité** après un coup reçu, matérialisée par un
clignotement. Sans cela, entrer dans une masse d’ennemis tue instantanément.

### Mise à l’échelle
```
hp     = base × (1 + minute × 0.22 + (minute/7.6)²) × (1 + max(0, minute − 20) × 0.12)
              × (1 + max(0, niveau − 8) × 0.05 + (max(0, niveau − 30)/22)²)
damage = base × (1 + minute × 0.032)
vitesse: inchangée (sinon le kiting devient impossible)
```

#### Réglage après retour d’un testeur

Le retour : « bien trop facile, passé les premières minutes il ne reste qu’à garder Espace
enfoncé ». Mesuré au bot, à partir d’un build de référence posé à la douzième minute, en
part des PV max perdue par tranche de trois minutes (médiane) :

| Tranche | Avant | Après |
|---|---|---|
| 13–15 | 16 % | 258 % |
| 16–18 | 27 % | 210 % |
| 19–21 | 4 % | 292 % |
| 22–24 | 4 % | 297 % |
| 25–27 | 0 % | 352 % |
| 28–30 | 1 % | 228 % |

La colonne « avant » vient de parties jouées depuis le début (les trois survivantes sur
six), la colonne « après » de six parties lancées à la douzième minute : l’ordre de grandeur
se compare, pas la décimale.

Trois causes, trois corrections :

- **les coffres suivaient le débit de mise à mort.** Chaque ennemi de rang « élite » ou
  « colosse » en lâchait un : une vingtaine par minute en fin de partie, plus de trente
  surpassements, et un écran de coffre à valider toutes les trois secondes. Une élite ne
  lâche plus qu’un coffre toutes les 22 secondes, et de l’or le reste du temps ;
- **l’armure pouvait annuler un coup entier.** Elle se soustrait, et les surpassements
  l’empilaient sans plafond. 35 % d’un coup passent désormais toujours ;
- **les niveaux s’emballaient** (voir §5), et le dernier tiers reçoit un surcroît de
  résistance.

Avec ces réglages, le même bot atteint la trentième minute quatre fois sur six. L’ouverture
n’est pas concernée : rien de ce qui précède n’agit avant le niveau 45 ou la neuvième
minute. Le bot la joue d’ailleurs mal – il meurt le plus souvent vers la septième minute,
avant comme après – et n’est donc pas un bon juge des dix premières minutes.
La vitesse **ne monte jamais**. C’est la règle qui garde le jeu jouable à 28 minutes.

Le second facteur des PV suit le **niveau du joueur**, et pas seulement l’horloge. L’horloge
seule ne suffisait pas : la puissance monte par paliers – niveaux d’arme, passifs, reliques,
évolutions – bien plus vite qu’une courbe de temps. Mesuré avant correction, avec un build
solide de douze minutes, on tenait **74 secondes sans bouger d’un pixel**. Le principe est
repris de Vampire Survivors, où les PV d’un ennemi sont multipliés par le niveau du joueur au
moment de son apparition.

Les huit premiers niveaux en sont exemptés : le début de partie sert à se mettre en jambes.
Le niveau est lu **à l’apparition** et n’est plus mis à jour ensuite – un ennemi déjà sur le
terrain ne durcit pas parce que le joueur vient de monter d’un niveau.

Mesuré après correction, même build, médiane sur trois parties :

| Minute | Immobile, avant | Immobile, après | En fuite, après |
|---|---|---|---|
| 8 | survit 180 s | survit 180 s | survit 180 s |
| 12 | 74 s | **18 s** | survit 180 s |
| 16 | 12 s | 9 s | 30 s |
| 20 | 7 s | 5 s | 13 s |

La passivité est punie dès la douzième minute, sans que jouer correctement le soit.

### Boss errants

Les quatre boss scriptés tombent toujours aux mêmes minutes : au troisième run, on sait ce
qui arrive et quand. Trois **rôdeurs** s’y ajoutent au hasard – une Matrone à partir de la
7ᵉ minute, un Chevalier Exsangue à partir de la 12ᵉ, un Chœur de Cendres à partir de la 17ᵉ.

| Réglage | Valeur |
|---|---|
| Écart minimal entre deux tirages | 52 s |
| Probabilité par tirage | 45 % |
| Plafond par partie | 11 |
| Boss vivants en même temps | 3 |

Le tirage se fait sur le générateur de la partie : deux parties de même graine voient les
mêmes rôdeurs aux mêmes instants, la rejouabilité à la graine n’est pas sacrifiée. Un rôdeur
peut désormais s’ajouter à un boss déjà présent, mais jamais au-delà de **trois boss
simultanés** – au-delà, ni les barres de vie ni les thèmes sonores ne se lisent, et l’appareil
du joueur n’a pas à encaisser un nombre non borné de gros corps.

Les paliers scriptés lèvent eux-mêmes **plusieurs corps** passé la seizième minute : deux
Matrones, deux puis trois Chevaliers Exsangues, deux Chœurs. Un boss unique ne pesait plus
rien face à un build de fin de partie. Le Sanguinaire, lui, reste seul : c’est un duel.

Ce sont de **vrais boss**, pas des ennemis gonflés en points de vie : ils ont leur barre,
leur musique, et laissent à leur chute trois coffres et une relique garantie. Un sac à PV
sans récompense se lirait comme une punition, pas comme un événement.

## 9. Objets au sol

| Objet | Effet | Provenance |
|---|---|---|
| Gemme bleue | 1 XP | Ennemi commun |
| Gemme verte | 5 XP | Ennemi moyen |
| Gemme rouge | 25 XP | Ennemi lourd / élite |
| Pièce d’or | 1–10 or (méta) | 12 % des ennemis |
| Cœur | Soigne 25 % des PV max | 1,5 % des ennemis |
| Encensoir | Tue tous les ennemis à l’écran | Rare, coffres |
| Aimant | Attire toutes les gemmes de la carte | Rare |
| Coffre | 1 à 5 améliorations + or | Boss toujours ; élites au plus un toutes les 22 s, de l’or sinon |

Les gemmes ont une **durée de vie infinie** mais fusionnent au-delà de 400 gemmes au sol
(les plus anciennes se combinent en gemmes de valeur supérieure) pour protéger les performances.

## 10. Méta-progression – le Sanctuaire

L’or gagné est conservé **même en cas de mort**. Il achète des améliorations permanentes qui
s’appliquent à tous les futurs runs. Le coût suit `coût(n) = base × 1.8^n`.

Le Sanctuaire est volontairement **modeste** : au maximum, il donne environ +35 % de puissance
globale. Il doit adoucir la courbe d’apprentissage, pas remplacer l’habileté.

Liste complète dans `02-content-bible.md`.

## 11. Sauvegarde

`localStorage`, une seule clé (`sanguine.save.v1`), un objet JSON versionné et fusionné avec
la structure par défaut au chargement – ajouter un champ ne casse donc jamais une ancienne
sauvegarde.

### Ce qui persiste toujours
Or, niveaux du Sanctuaire, personnages débloqués, codex (armes, reliques, bestiaire),
statistiques cumulées, options. C’est la norme du genre : la méta survit à la mort, le run non.

### Reprise d’une partie interrompue
Le genre ne sauvegarde traditionnellement pas les parties en cours. **Le navigateur change ce
calcul** : un onglet fermé par mégarde, une mise en veille ou un plantage effacent la même
demi-heure d’engagement qu’un jeu de bureau protégerait par sa simple présence à l’écran.

La sauvegarde est donc **partielle et assumée**. On enregistre ce que le joueur a *acquis* :

| Enregistré | Non enregistré |
|---|---|
| Personnage, graine, temps, position | Ennemis vivants |
| Niveau, XP, PV | Projectiles et zones |
| Armes et niveaux, passifs, reliques | Gemmes et butin au sol |
| Rerolls, résurrections, or, compteurs | Particules, décalques de sang |
| Structures déjà activées, vagues déclenchées | – |

Sérialiser quinze cents entités serait volumineux, fragile et casserait au moindre changement
de structure. À la reprise, le director repeuple le terrain : le joueur perd la vague en cours
et les gemmes non ramassées. C’est un prix compréhensible pour une interruption, et cela rend
la reprise robuste **par construction** plutôt que par vigilance.

### Garde-fous
- Écriture toutes les 10 s, à chaque choix de carte ou de coffre, et sur `pagehide` /
  `visibilitychange` – c’est-à-dire précisément au moment où l’onglet se ferme.
- La sauvegarde est écrite **après** l’application d’un choix : recharger ne permet pas de
  revenir sur une carte déjà prise (pas de *save-scumming*).
- Elle est effacée à la mort, à la victoire et à l’abandon : une partie terminée ne peut
  jamais être reprise.
- Deux secondes d’invulnérabilité à la reprise, le joueur n’ayant pas les mains sur le clavier
  à la première frame.

## 12. Boutique cosmétique

L’or n’avait qu’un seul débouché : le Sanctuaire, c’est-à-dire de la puissance. Un joueur
ayant tout acheté n’avait plus rien à faire de sa monnaie, et un joueur qui hésitait n’avait
aucun arbitrage à rendre. La boutique met les deux en concurrence sur la même bourse :
**progresser ou avoir de l’allure**.

| Catégorie | Contenu | Prix |
|---|---|---|
| **Teintes** | 8 apparences alternatives, chacune avec son aura : halo, puis anneau, puis cercle magique selon le prix | 5 000 à 36 000 |
| **Traînées** | Cendres qui retombent, givre au sol, braises, flaques d’or fondu, failles du vide : un effet propre à chacune | 1 500 à 28 000 |
| **Interface** | Teinte des cadres et ambiance des menus : poussière d’or, pluie de sang, lucioles et aurore | 4 500 à 20 000 |
| **Curseurs** | Lin, or, sang, givre | 600 à 1 200 |

### Revenu et grille de prix

L’or des ennemis ordinaires est payé **par l’horloge** : un budget se remplit de
`2,5 + 0,35 × minute` pièces par seconde, et un ennemi ne lâche de l’or que si le budget le
couvre. Tuer plus vite ne rapporte donc pas plus ; survivre plus longtemps, si. Les boss,
les coffres et les puits paient hors budget.

Avant ce réglage, l’or suivait le débit de mise à mort. Mesuré au bot : 1 200 pièces pour
une partie perdue à la septième minute, 37 000 pour une partie menée au bout – de quoi
acheter deux fois toute la boutique d’alors (17 900 pièces) en une seule soirée.

| Durée de la partie | Or rapporté (mesuré) |
|---|---|
| Perdue vers 7 min | ~1 100 |
| Menée au bout | ~10 000 |

| Palier | Prix | Objets | Effort |
|---|---|---|---|
| Facile | 600 à 1 500 | Curseurs, traînée Cendres | Une ou deux parties courtes |
| Intermédiaire | 3 500 à 5 000 | Traînées Givre et Braises, thème Reliquaire, teintes d’Ysolde et d’Anselme | Une poignée de parties |
| Difficile | 8 000 à 14 000 | Thème Sang, teintes de Vasco, Marguerite et Sœur Ombre, traînée Or Fondu | Une partie complète, parfois deux |
| Prestige | 20 000 à 36 000 | Thème Améthyste, traînée Vide, teinte du Comte | Plusieurs parties menées au bout |

Total : environ 172 000 pièces, soit dix-sept parties complètes, auxquelles s’ajoutent les
33 600 du Sanctuaire, payé sur la même bourse.

**Règle absolue : aucun cosmétique n’influence le jeu.** Ni statistique, ni lisibilité. Les
teintes de personnage restent chaudes et saturées (le joueur doit rester le point chaud de
l’écran), les traînées sont émises à cadence fixe et uniquement en mouvement, et aucune ne
touche aux couleurs réservées aux gemmes ou au sang.

Le thème d’interface ne réassigne que le cadre **par défaut**. Les cadres or, sang et épique
gardent leur sens – survol, danger, évolution – et ne sont jamais repeints : un thème ne doit
pas rendre un avertissement indistinct du reste.

---

## 13. Accessibilité

Tous les réglages s’appliquent **immédiatement**, sans validation ni redémarrage, et chaque
curseur affiche sa valeur chiffrée : un réglage sans retour se règle à l’aveugle.

### Affichage
- **Taille de l’interface** : 70 % à 200 %, par défaut **115 %**. La valeur par défaut n’est
  pas 100 % : la taille d’origine était lisible sur un grand écran de développement, beaucoup
  moins sur un portable – et un réglage de confort doit partir d’une valeur confortable, pas
  d’un minimum.
- **Secousse de caméra** : 0 % à 100 %, par défaut 40 %. Voir `04-art-direction.md` §6 pour
  l’historique de ce réglage.
- **Contraste renforcé** : textes d’interface plus clairs et mieux détourés, sans toucher aux
  couleurs de jeu qui portent du sens.

### Confort visuel
- **Réduire les flashs** : supprime les flashs plein écran et les vignettes pulsées.
- **Réduire les animations** : coulures du logo, sprites du codex, transitions d’écran. Le
  réglage est explicite et indépendant de `prefers-reduced-motion` : certains joueurs ne
  l’ont pas activé au niveau du système mais le souhaitent ici.
- **Chiffres de dégâts** : les couper réduit considérablement le bruit à l’écran en fin de
  partie, quand plusieurs centaines de nombres se superposent.

### Jeu
- **Repère sous le joueur** : anneau permanent au sol. Dans une horde de trois cents
  créatures, retrouver son personnage est le premier obstacle du genre.
- **Vitesse du jeu** : 60 % à 100 %. Ce n’est pas un réglage de difficulté déguisé – le
  contenu est identique, il se déroule simplement moins vite, ce qui rend le kiting
  accessible à des joueurs que la cadence d’origine exclut.

### Acquis par construction
- Le jeu est **intégralement jouable sans son** : aucune information n’est exclusivement
  sonore.
- Les gemmes se distinguent par leur **forme** autant que par leur couleur (nombre de
  pointes croissant), ce qui les garde lisibles en cas de daltonisme.
- Pause à tout moment, y compris pendant un boss, et mise en pause automatique quand
  l’onglet perd le focus.
- Navigation complète au clavier et à la manette sur tous les écrans.
- Une partie interrompue se reprend (voir §11).
