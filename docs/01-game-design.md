# Sanguine – Game Design

## 1. Boucle de jeu

### Boucle seconde (moment-to-moment)
```
Se déplacer  →  les armes tirent seules  →  les ennemis meurent  →
ils lâchent des gemmes  →  on se déplace pour les ramasser  →  on s'expose  →  …
```
La tension centrale : **ramasser de l'XP oblige à aller vers le danger.** Le joueur qui fuit
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

## 2. Structure d'une partie

Une partie dure **30 minutes**. Le temps est le seul véritable adversaire.

| Minute | Phase | Intention de design |
|---|---|---|
| 0–3 | **Découverte** | Peu d'ennemis. Le joueur teste son arme de départ, monte 4-5 niveaux. |
| 3–8 | **Densification** | Les premiers groupes serrés. Le joueur doit commencer à kiter. |
| 8–12 | **Premier mur** | Boss *La Matrone*. Un build mal orienté cale ici. |
| 12–18 | **Explosion** | Les évolutions arrivent. Le joueur devient très fort d'un coup. |
| 18–24 | **Rattrapage** | La densité rattrape la puissance. Élites fréquents. |
| 24–29 | **Survie pure** | L'écran est plein. Seuls les builds aboutis tiennent. |
| 29–30 | **Le Sanguinaire** | Boss final. Le tuer = victoire. |

Si le joueur atteint 30:00 sans tuer le boss, la **Faucheuse** apparaît : invulnérable, rapide,
un seul contact tue. C'est le rideau.

## 3. Contrôles

| Action | Clavier | Manette | Tactile |
|---|---|---|---|
| Déplacement | `ZQSD` / `WASD` / flèches | Stick gauche | Joystick virtuel (glisser) |
| Pause | `Échap` / `P` | Start | Bouton HUD |
| Valider | `Entrée` / `Espace` / clic | A | Tap |
| Naviguer menus | Flèches / `ZQSD` | D-pad | Tap |
| Minimap | `M` | – | – |
| Plein écran | `F` | – | Bouton HUD |

**Aucune touche d'attaque.** C'est intentionnel et central au genre.

Le clavier gère `ZQSD` **et** `WASD` simultanément par code physique (`KeyW`/`KeyZ`), donc les
dispositions AZERTY et QWERTY fonctionnent sans configuration.

## 4. Statistiques du joueur

Les stats sont calculées à chaque changement de build, jamais dans la boucle de rendu.

| Stat | Base | Effet | Cap |
|---|---|---|---|
| `maxHp` | 100 | Points de vie | – |
| `regen` | 0 | PV rendus par seconde | – |
| `armor` | 0 | Dégâts plats retirés (min. 1 dégât passe) | – |
| `moveSpeed` | 100 | Pixels/seconde | – |
| `might` | 1.0 | Multiplicateur de dégâts | – |
| `area` | 1.0 | Multiplicateur de taille des effets | – |
| `cooldown` | 1.0 | Multiplicateur de temps de recharge (plus bas = mieux) | 0.4 |
| `speedMul` | 1.0 | Vitesse des projectiles | – |
| `duration` | 1.0 | Durée des effets persistants | – |
| `amount` | 0 | Projectiles supplémentaires (additif) | – |
| `pickupRadius` | 60 | Rayon d'aimantation des gemmes | – |
| `luck` | 1.0 | Influence coffres, crit, drops rares | – |
| `growth` | 1.0 | Multiplicateur d'XP gagnée | – |
| `greed` | 1.0 | Multiplicateur d'or gagné | – |
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
Le plancher à 0,05 s évite qu'une arme sur-optimisée sature la boucle de mise à jour.

## 5. Progression d'XP

```
xpRequis(niveau) = arrondi(4 + niveau × 5.5 + niveau^1.5)
```
Le premier palier doit être bas : les premières cartes sont ce qui donne au joueur le
sentiment d'exister, et les faire attendre une minute tue l'ouverture.

Mesuré au bot de test : ~6 niveaux la première minute, **14 à la cinquième**, de l'ordre de
65 sur un run complet.

## 6. Système d'améliorations

À chaque niveau, **3 cartes** (4 avec beaucoup de chance) sont tirées parmi :

- une **nouvelle arme** (si moins de 6 armes équipées) ;
- une **montée de niveau** d'arme existante (max niveau 8) ;
- un **nouveau passif** (si moins de 6 passifs) ;
- une **montée de niveau** de passif (max niveau 5) ;
- un **lot de secours** (soin, or, ou petit bonus) si plus rien n'est disponible.

Le tirage est **pondéré** : les objets déjà possédés apparaissent plus souvent (pour permettre
d'aboutir un build), les objets rares moins. La `luck` du joueur augmente la chance de voir une
quatrième carte et de tirer un objet rare.

Un bouton **Reroll** (limité, gagné dans les coffres) permet de retirer les trois cartes.
Un bouton **Passer** échange le choix contre de l'or.

### Évolutions
Une arme au **niveau max (8)** combinée à un **passif requis au niveau 3+** devient éligible.
L'évolution n'apparaît **jamais** dans le menu de niveau : elle ne peut sortir que d'un **coffre**.
C'est ce qui rend les coffres excitants plutôt qu'anecdotiques.

Une arme évoluée occupe le même emplacement, part au niveau 1 avec des statistiques largement
supérieures, et ne peut plus monter de niveau (elle est déjà l'aboutissement).

## 7. Slots

- **6 emplacements d'armes**, **6 emplacements de passifs.**
- Une fois les 6 armes prises, plus aucune nouvelle arme n'est proposée.
- Ce plafond est ce qui force les vrais choix. Il ne bouge jamais, même au méta.

## 8. Ennemis et danger

Les ennemis **n'ont pas d'attaque à distance** sauf le Nécrophage. Le danger vient du **contact** :
un ennemi qui touche le joueur inflige ses dégâts puis subit un court délai avant de pouvoir
retoucher (`0.5 s`), ce qui rend la traversée d'un groupe survivable mais coûteuse.

Le joueur possède **0,7 s d'invulnérabilité** après un coup reçu, matérialisée par un
clignotement. Sans cela, entrer dans une masse d'ennemis tue instantanément.

### Mise à l'échelle
```
hp     = base × (1 + minute × 0.16 + (minute/9)^2)
damage = base × (1 + minute × 0.05)
vitesse: inchangée (sinon le kiting devient impossible)
```
La vitesse **ne monte jamais**. C'est la règle qui garde le jeu jouable à 28 minutes.

## 9. Objets au sol

| Objet | Effet | Provenance |
|---|---|---|
| Gemme bleue | 1 XP | Ennemi commun |
| Gemme verte | 5 XP | Ennemi moyen |
| Gemme rouge | 25 XP | Ennemi lourd / élite |
| Pièce d'or | 1–10 or (méta) | 12 % des ennemis |
| Cœur | Soigne 25 % des PV max | 1,5 % des ennemis |
| Encensoir | Tue tous les ennemis à l'écran | Rare, coffres |
| Aimant | Attire toutes les gemmes de la carte | Rare |
| Coffre | 1 à 5 améliorations + or | Élites et boss |

Les gemmes ont une **durée de vie infinie** mais fusionnent au-delà de 400 gemmes au sol
(les plus anciennes se combinent en gemmes de valeur supérieure) pour protéger les performances.

## 10. Méta-progression – le Sanctuaire

L'or gagné est conservé **même en cas de mort**. Il achète des améliorations permanentes qui
s'appliquent à tous les futurs runs. Le coût suit `coût(n) = base × 1.8^n`.

Le Sanctuaire est volontairement **modeste** : au maximum, il donne environ +35 % de puissance
globale. Il doit adoucir la courbe d'apprentissage, pas remplacer l'habileté.

Liste complète dans `02-content-bible.md`.

## 11. Sauvegarde

`localStorage`, une seule clé (`sanguine.save.v1`), un objet JSON versionné et fusionné avec
la structure par défaut au chargement — ajouter un champ ne casse donc jamais une ancienne
sauvegarde.

### Ce qui persiste toujours
Or, niveaux du Sanctuaire, personnages débloqués, codex (armes, reliques, bestiaire),
statistiques cumulées, options. C'est la norme du genre : la méta survit à la mort, le run non.

### Reprise d'une partie interrompue
Le genre ne sauvegarde traditionnellement pas les parties en cours. **Le navigateur change ce
calcul** : un onglet fermé par mégarde, une mise en veille ou un plantage effacent la même
demi-heure d'engagement qu'un jeu de bureau protégerait par sa simple présence à l'écran.

La sauvegarde est donc **partielle et assumée**. On enregistre ce que le joueur a *acquis* :

| Enregistré | Non enregistré |
|---|---|
| Personnage, graine, temps, position | Ennemis vivants |
| Niveau, XP, PV | Projectiles et zones |
| Armes et niveaux, passifs, reliques | Gemmes et butin au sol |
| Rerolls, résurrections, or, compteurs | Particules, décalques de sang |
| Structures déjà activées, vagues déclenchées | — |

Sérialiser quinze cents entités serait volumineux, fragile et casserait au moindre changement
de structure. À la reprise, le director repeuple le terrain : le joueur perd la vague en cours
et les gemmes non ramassées. C'est un prix compréhensible pour une interruption, et cela rend
la reprise robuste **par construction** plutôt que par vigilance.

### Garde-fous
- Écriture toutes les 10 s, à chaque choix de carte ou de coffre, et sur `pagehide` /
  `visibilitychange` — c'est-à-dire précisément au moment où l'onglet se ferme.
- La sauvegarde est écrite **après** l'application d'un choix : recharger ne permet pas de
  revenir sur une carte déjà prise (pas de *save-scumming*).
- Elle est effacée à la mort, à la victoire et à l'abandon : une partie terminée ne peut
  jamais être reprise.
- Deux secondes d'invulnérabilité à la reprise, le joueur n'ayant pas les mains sur le clavier
  à la première frame.

## 12. Accessibilité

- **Secousse de caméra réglable de 0 à 100 %**, par défaut à **40 %**. Ce n'est pas un réglage
  cosmétique : un survivor-like enchaîne des dizaines d'impacts par seconde, et une secousse
  mal dosée devient physiquement pénible à regarder. Trois décisions en découlent – aucune
  secousse sur coup critique, plafond d'accumulation hors événements majeurs, et oscillation
  sinusoïdale plutôt que bruit blanc (un mouvement continu se lit, un scintillement non).
- **Réduction des flashs** : option qui supprime les flashs plein écran et les tremblements.
- **Taille du HUD** : trois crans.
- **Daltonisme** : les gemmes se distinguent par la **forme** autant que par la couleur.
- **Pause à tout moment**, y compris pendant un boss.
- Aucun contenu ne dépend du son.
- Le jeu se met automatiquement en pause quand l'onglet perd le focus.
