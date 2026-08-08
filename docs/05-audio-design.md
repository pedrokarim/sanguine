# Sanguine – Design audio

## 1. Principe

Comme les sprites, **tout le son est synthétisé au runtime** via la Web Audio API. Aucun fichier
audio n’est expédié. Le module `audio/audio.ts` expose une petite bibliothèque de synthèse et un
catalogue d’effets nommés.

Justification identique à celle des sprites : licence, poids, et surtout **variation**. Chaque
tir peut avoir une hauteur légèrement différente, ce qui évite la fatigue auditive quand une arme
se déclenche 8 fois par seconde.

## 2. Contraintes techniques

- Le contexte audio ne peut démarrer qu’après une **interaction utilisateur** (politique des
  navigateurs). On l’initialise au premier appui de touche, sur l’écran titre.
- **Plafond de voix** : 24 voix simultanées. Au-delà, les nouvelles demandes volent la voix la
  plus ancienne de même priorité. Sans cela, 300 morts simultanées saturent le contexte et
  provoquent du craquement.
- **Anti-empilement** : un même effet ne peut se déclencher que toutes les 30 ms. Les 40 impacts
  d’une même frame produisent un seul son, légèrement plus fort.
- Tout passe par un `GainNode` maître, plus un bus SFX et un bus musique, chacun réglable.
- Un `DynamicsCompressorNode` en sortie évite l’écrêtage quand l’action est dense.

## 3. Bibliothèque de synthèse

| Primitive | Usage |
|---|---|
| `blip(freq, dur, type)` | Oscillateur simple avec enveloppe ADSR – sons d’interface |
| `noise(dur, filter)` | Bruit blanc filtré – impacts, explosions, vent |
| `sweep(f0, f1, dur)` | Balayage de fréquence – tirs, lasers, montée de niveau |
| `pluck(freq, dur)` | Karplus-Strong simplifié – cordes, harpe |
| `thump(freq, dur)` | Sinus descendant + clic – grosse caisse, explosions |
| `chord(freqs, dur)` | Empilement d’oscillateurs – accords, fanfares |

Chaque appel accepte un paramètre `detune` aléatoire (±40 cents par défaut) pour la variation.

## 4. Catalogue d’effets

| Événement | Recette | Priorité |
|---|---|---|
| Tir (pieu, arbalète) | `sweep(900→380, 60 ms)` + clic de bruit | basse |
| Tir (croix) | `blip(520, 120 ms, triangle)` + léger flanger | basse |
| Aura (ail) | Bourdon continu, volume proportionnel aux ennemis touchés | basse |
| Impact | `noise(45 ms, passe-haut 2 kHz)` | basse |
| Critique | Impact + `blip(1400, 80 ms)` en surcouche | moyenne |
| Mort d’ennemi | `thump(160→60, 90 ms)` + bruit court | basse |
| Mort d’ennemi lourd | `thump(90→40, 200 ms)` + gravier | moyenne |
| Joueur touché | `noise(180 ms, passe-bas 600 Hz)` + `thump(70, 250 ms)` | **haute** |
| Ramassage de gemme | `blip(880 + n×30, 45 ms, carré)` – la hauteur monte avec la série | basse |
| Ramassage d’or | `pluck(1200, 90 ms)` × 2, léger décalage | basse |
| Cœur | `chord([523, 659, 784], 400 ms)` doux | moyenne |
| Montée de niveau | Arpège ascendant 5 notes + `sweep` + réverbération | **haute** |
| Ouverture de coffre | Grincement (bruit filtré modulé) puis fanfare | **haute** |
| Relique commune/rare | `chord` cristallin, hauteur selon la rareté | **haute** |
| Relique maudite | Accord mineur dissonant + sub-basse | **haute** |
| Apparition de boss | Sub-basse 40 Hz sur 2 s + cluster de cuivres | **haute** |
| Mort de boss | Descente chromatique + explosion + silence de 500 ms | **haute** |
| Mort du joueur | Tout se coupe, un seul accord mineur long, filtre passe-bas qui se ferme | **haute** |
| Choix de carte (survol) | `blip(660, 30 ms)` | basse |
| Validation | `blip(880, 60 ms)` + octave | basse |

## 5. Musique adaptative

Pas de piste enregistrée : un **séquenceur** joue une progression en boucle, avec des couches
qui s’activent selon l’intensité de la partie.

```
intensité = clamp(0..1) calculée à partir de :
    nombre d'ennemis à l'écran (40 %)
    minute écoulée (40 %)
    PV manquants du joueur (20 %)
```

| Couche | S’active à | Contenu |
|---|---|---|
| **Bourdon** | toujours | Note tenue à la fondamentale + quinte, très filtrée |
| **Pouls** | 0.15 | Grosse caisse à la noire, tempo 84 → 132 BPM selon l’intensité |
| **Arpège** | 0.35 | Motif de 8 notes en ré mineur naturel |
| **Contrechant** | 0.60 | Ligne mélodique lente à la tierce |
| **Cuivres** | 0.80 | Accords tenus, dissonants |
| **Chœur** | boss | Cluster de voix synthétiques (oscillateurs désaccordés) |

Progression harmonique (ré mineur, 4 mesures) : `Dm – Bb – F – A7`.
Le `A7` en fin de boucle crée une tension non résolue, adaptée à un jeu où l’on ne gagne jamais
vraiment de répit.

Le tempo est asservi à l’intensité, ce qui donne l’impression que la musique accélère avec
le danger – sans transition de piste, sans coupure.

## 6. Mixage

| Bus | Niveau par défaut |
|---|---|
| Maître | 0.8 |
| SFX | 0.7 |
| Musique | 0.45 |

Un **ducking** léger : la musique baisse de 3 dB pendant 200 ms sur les événements de priorité
haute (montée de niveau, boss, mort). Ça garantit que l’information importante passe toujours.

Les trois niveaux sont réglables dans les options et sauvegardés.

## 7. Accessibilité audio

- Le jeu est **intégralement jouable sans son**. Aucune information n’est exclusivement sonore :
  chaque signal audio a un pendant visuel.
- Option « son mono » pour les personnes n’entendant que d’une oreille.
- Option de coupure globale, et coupure automatique quand l’onglet perd le focus.
