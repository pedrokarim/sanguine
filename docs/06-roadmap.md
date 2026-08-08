# Sanguine – Roadmap

## Jalons

### M0 – Squelette *(fondations)*
- [x] Vite + TypeScript strict, zéro dépendance runtime
- [x] Canvas à résolution logique fixe, mise à l’échelle entière
- [x] Boucle à pas fixe 60 Hz avec interpolation de rendu
- [x] Input unifié clavier (AZERTY + QWERTY) / manette / tactile

### M1 – Noyau jouable
- [x] Joueur déplaçable, caméra qui suit
- [x] Sol infini tuilé, décalques de sang persistants
- [x] Pool d’ennemis, IA de poursuite, séparation partielle
- [x] Grille de hachage spatial, collisions cercle-cercle
- [x] Première arme (Pieu), dégâts, mort d’ennemi

### M2 – Boucle de progression
- [x] Gemmes d’XP, aimantation, courbe de niveaux
- [x] Écran de montée de niveau avec 3 cartes pondérées
- [x] 18 armes, 12 passifs, recalcul des stats dérivées
- [x] Évolutions d’armes via coffres

### M3 – Contenu et butin
- [x] 13 ennemis, élites, 4 boss avec mécaniques distinctes
- [x] Director de vagues, événements scriptés par minute
- [x] Table de butin complète, coffres, 24 reliques
- [x] 6 personnages avec bonus/malus

### M4 – Présentation
- [x] Générateur de sprites procéduraux + animations
- [x] Système de particules, secousses, flashs, ralentis
- [x] Moteur audio synthétisé + musique adaptative en couches
- [x] HUD DOM, police bitmap générée

### M5 – Méta et finition
- [x] Sanctuaire, or persistant, déblocages
- [x] Sauvegarde localStorage versionnée
- [x] Options (volumes, réduction des flashs, taille du HUD)
- [x] Écrans titre / sélection / pause / défaite / victoire

### M6 – Vérification
- [x] `pnpm build` sans erreur TypeScript stricte
- [x] Test navigateur automatisé (Chrome headless piloté en CDP brut, sans dépendance)
- [x] Bot de jeu qui kite réellement, pour un équilibrage mesuré et non deviné
- [x] Mesure des FPS sous charge : 60 fps constants à 344 ennemis

### M7 – Retours de test *(post-première jouabilité)*
- [x] **Caméra** : secousse ramenée de « irregardable » à un accent discret, réglable à zéro
- [x] **Équilibrage** : deux réglages de densité mesurés et rejetés avant le bon
- [x] **Tirage des cartes** pondéré par catégorie – corrigeait un build complet dès la 2ᵉ minute
- [x] **Biomes** : 5 régions procédurales avec composition d’ennemis et effets passifs
- [x] **Structures** : 7 points d’intérêt déterministes, à effet unique
- [x] **Interface décorée** : cadres 9-slice, fleurons, équerres, bandeau de titre, grain
- [x] **Illustration des menus** : scène nocturne en 6 couches animées par parallaxe

## Au-delà (non prévu pour la v1)

Ces idées sont volontairement **hors périmètre**. Elles sont notées pour ne pas être oubliées,
pas pour être faites maintenant.

- **Arcanes** – modificateurs de run choisis au départ, qui changent les règles.
- **Cartes multiples** – une seconde zone avec ses propres ennemis et son propre boss.
- **Mode sans fin** – au-delà de 30 minutes, difficulté exponentielle, classement local.
- **Défis** – objectifs spécifiques (« gagner sans passif », « ne jamais monter Reliquaire »).
- **Graine partageable** – coller une graine pour rejouer exactement le même run.
- **Manette : vibration** via la Gamepad Haptics API.
- **Export/import de sauvegarde** en base64, pour changer de navigateur.

## Dette technique connue et assumée

| Sujet | Décision | Quand y revenir |
|---|---|---|
| Séparation des ennemis approximative (4 voisins/frame) | Acceptable visuellement, indispensable à la performance | Si la superposition devient gênante à 1500 ennemis |
| Canvas 2D plutôt que WebGL | Suffisant jusqu’à ~2000 sprites | Si l’on vise 5000+ entités |
| Pas de tests unitaires | Le jeu est visuel, `tsc --strict` est le filet | Si la logique de build devient un vrai domaine métier |
| HUD en DOM | Texte net, gratuit en rendu | Jamais – c’est le bon choix |
| Une seule carte | Périmètre v1 | Après retours joueurs |
