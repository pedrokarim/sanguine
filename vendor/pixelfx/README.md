# pixelfx, version Sanguine

Copie adaptée de [patch-gg/pixelfx](https://github.com/patch-gg/pixelfx), prise au commit `fe7103c`. C'est du code
embarqué, pas une dépendance : le jeu reste sans dépendance à l'exécution, et tout effet reste généré par le code.

## Ce qui a changé par rapport à l'original

- `src/core/painter.js` : `place` accepte `zoom`, repris de l'option `zoom` d'un effet. Les formes sont recalculées sur
  la grille de l'écran : un effet de la lib se repeint à l'échelle des sprites sans être réduit comme une image.
- `src/core/sim.js` : `Particles` et `Bits` acceptent `yaw`, `axis` et `squash`. Chaque particule tourne autour de
  l'axe vertical à l'affichage : sa physique reste celle du profil, et elle se pose tout autour de son origine sur
  un sol écrasé de `GROUND_SQUASH` (0,72, comme les zones du jeu). Sans `yaw`, rien ne change.
- `src/fx/arcane/rune-circle.js` : le cercle passe à l'écrasement du jeu (`SY = 0.72`) et son cadre s'agrandit.
- `src/fx/arcane/arcane-orb.js` : l'option `hover` retire la lueur au sol.
- `src/fx/critters/_lib.js` : `shadow` ne dessine plus rien, le jeu pose lui-même l'ombre de ses créatures.
- `src/fx/sanguine/` : les effets recréés pour le jeu, à l'échelle de ses sprites et vus de biais.
- `src/sanguine.js` et `src/sanguine.d.ts` : seule porte d'entrée du jeu, qui fixe ce qui entre dans le bundle.
- Retirés : la galerie, sa police, et les effets du catalogue que le jeu n'utilise pas. Le catalogue complet reste
  dans le dépôt d'origine.
- Licence : `LICENSE` et `NOTICE.md` restent ceux de l'original.

## Ajouter le visuel d'une compétence

Chercher d'abord un équivalent dans le catalogue d'origine. S'il existe, copier le fichier au même chemin, le déclarer
dans `src/sanguine.js` et `src/sanguine.d.ts`, puis régler `zoom`, `speed`, `skip` et la palette dans
`src/gfx/vfxrecipes.ts`. S'il n'existe pas, le recréer dans `src/fx/sanguine/` avec les mêmes briques.

La méthode est celle du skill (`skills/pixelfx/SKILL.md`) : écrire, rendre, regarder, corriger. `check.mjs` ne remplace
pas le regard : il a déjà validé un effet dont les gouttes ne s'affichaient pas.

```sh
node vendor/pixelfx/tools/new.mjs sanguine/mon-effet
node vendor/pixelfx/tools/render.mjs sanguine/mon-effet   # écrit records/…/contact.png
node vendor/pixelfx/tools/render.mjs fire/fireball --opts '{"zoom":0.5}'
node vendor/pixelfx/tools/check.mjs sanguine/mon-effet
```

Les règles propres à Sanguine :

- L'origine est au sol. La hauteur se soustrait de `y`, la profondeur s'écrase de `GROUND_SQUASH`.
- Rien ne se pose sur une ligne : ce qui touche le sol se répartit autour de l'origine (`yaw`, `band`, `squash`).
- L'échelle est celle du héros (19×23), pas celle de l'acteur de pixelfx (24×38) : d'où `zoom`.
- Une action du héros dure moins d'une demi-seconde, et la tache durable reste celle du jeu.
- Pas de blanc sur ce qui s'empile en horde : les morts restent rouges.
- Un effet qui appartient au héros passe par une ancre de `Vfx` : il le suit au lieu de rester sur place.
