/**
 * Fragments — collection secondaire, quarante-deux pièces.
 *
 * Ces textes sont du **contenu de jeu** : le joueur doit les lire, ils sont donc en clair.
 * Ils avaient d'abord été encodés en base64 « pour éviter les spoilers » — une protection
 * théâtrale, puisque trois lignes de console suffisaient à tout décoder, et qui ne rendait
 * le fichier illisible que pour ceux qui doivent le maintenir.
 *
 * Ce qui reste réellement confidentiel, c'est la **bible narrative** : le canevas, les
 * révélations et les règles d'écriture nécessaires pour produire du contenu cohérent. Elle
 * vit dans `lore/`, exclu du dépôt.
 */

export type FragmentType = 'parchemin' | 'sceau' | 'hieroglyphe' | 'pierre';

export interface FragmentDef {
  /** Numéro, de 1 à 42. Affiché en chiffres romains. */
  n: number;
  /** Cycle d'appartenance, 0 à 5. */
  cycle: number;
  type: FragmentType;
  /** Titre. */
  t: string;
  /** Corps. */
  b: string;
}

/**
 * Condition d'apparition d'un cycle. Tant qu'elle n'est pas remplie, les fragments du cycle
 * n'existent pas dans le monde — inutile de les chercher.
 */
export interface CycleDef {
  /** Nom du cycle. */
  name: string;
  /** Biome requis, chaîne vide si indifférent. */
  biome: string;
  fromMin: number;
  toMin: number;
  minLevel: number;
  needBoss: boolean;
  /** Nombre de fragments déjà trouvés exigé. */
  minFound: number;
  /** Indice affiché dans l'Archive, formulé à la manière de l'Ordre. */
  hint: string;
}

export const TYPE_LABEL: Record<FragmentType, string> = {
  parchemin: 'Parchemin',
  sceau: 'Sceau',
  hieroglyphe: 'Hiéroglyphe',
  pierre: 'Pierre gravée',
};

export const CYCLES: CycleDef[] = [
  { name: "Le Domaine", biome: 'moor', fromMin: 0, toMin: 10, minLevel: 0, needBoss: false, minFound: 0, hint: "Une borne dort là où rien ne pousse, dès la première mesure." },
  { name: "Les Arpenteurs", biome: 'graveyard', fromMin: 3, toMin: 15, minLevel: 0, needBoss: false, minFound: 0, hint: "Une tablette dort là où l’on compte les admis, après la troisième mesure." },
  { name: "La Chair Réécrite", biome: 'mire', fromMin: 6, toMin: 20, minLevel: 10, needBoss: false, minFound: 0, hint: "Une tablette dort là où la boue retient, après la sixième mesure, quand vous pèserez assez." },
  { name: "L'Ordre Muet", biome: 'thicket', fromMin: 8, toMin: 22, minLevel: 15, needBoss: false, minFound: 0, hint: "Une tablette dort là où les troncs ne parlent plus, après la huitième mesure, quand vous pèserez beaucoup." },
  { name: "La Mesure", biome: 'ashes', fromMin: 12, toMin: 26, minLevel: 0, needBoss: true, minFound: 0, hint: "Une tablette dort là où le feu a tout pris. Il faudra d’abord en abattre un qui a franchi le seuil." },
  { name: "L'Ascension", biome: '', fromMin: 20, toMin: 99, minLevel: 0, needBoss: false, minFound: 30, hint: "Les sept dernières ne se cachent plus. Elles attendent, passé la vingtième mesure, celui qui en porte déjà trente." },
];

export const FRAGMENTS: FragmentDef[] = [
  { n: 1, cycle: 0, type: 'parchemin', t: "Relevé d’arrivée",
    b: "Nous avons marché onze jours vers un mur que la carte ne porte pas. Il n’y a pas de mur. Il y a un endroit où la carte cesse d’être vraie, et de l’autre côté, la même lande, refaite." },
  { n: 2, cycle: 0, type: 'pierre', t: "Borne, face nord",
    b: "PARCELLE 7. Sous le mot, une rangée de traits que je ne sais pas lire. Sous les traits, une main humaine a gravé plus tard, plus profond : ne comptez pas les jours." },
  { n: 3, cycle: 0, type: 'parchemin', t: "Lettre non postée",
    b: "Ma sœur, les stèles du cimetière ne portent pas de noms. J’en ai frotté quarante. Ce sont des numéros, et ils ne se suivent pas dans l’ordre où l’on meurt. Ils se suivent dans l’ordre où l’on est admis." },
  { n: 4, cycle: 0, type: 'sceau', t: "Sceau du bornage",
    b: "Un cercle divisé en cinq secteurs inégaux. Chaque secteur porte un pictogramme : eau stagnante, cendre, bois sec, pierre, herbe rase. Aucun n’est un lieu. Ce sont des conditions." },
  { n: 5, cycle: 0, type: 'pierre', t: "Pierre du seuil",
    b: "Ce qui entre est pesé. Ce qui pèse assez est gardé. Ce qui ne pèse pas assez est rendu. Le verbe rendu est gravé deux fois, la seconde d’une main tremblante." },
  { n: 6, cycle: 0, type: 'parchemin', t: "Carnet d’un géomètre",
    b: "J’ai mesuré la chapelle. Sa tour n’a jamais porté de cloche : l’ouverture du haut n’est pas faite pour laisser sortir le son, elle est faite pour laisser entrer le ciel. C’est un mât. Un mât de quoi, je l’ignore." },
  { n: 7, cycle: 0, type: 'hieroglyphe', t: "Colonne de relevés",
    b: "Quatre colonnes de signes. La troisième varie d’un tiers à chaque ligne, les autres non. Un copiste a noté en marge, en langue humaine : celle-là, c’est nous." },
  { n: 8, cycle: 1, type: 'parchemin', t: "Note de l’Ordre, an inconnu",
    b: "Ils ne sont pas venus prendre. C’est ce qui nous a le plus longtemps trompés. On guette une armée, on ne guette pas un jardinier." },
  { n: 9, cycle: 1, type: 'sceau', t: "Sceau de saison",
    b: "Deux arcs concentriques, un point décentré. L’Ordre l’a longtemps lu comme un œil. Frère Aldric a proposé une autre lecture, qui a fini par s’imposer : c’est une serre, vue de dessus." },
  { n: 10, cycle: 1, type: 'pierre', t: "Pierre des mots empruntés",
    b: "Nous avons retenu sept de leurs mots. Aucun ne dit conquérir, tuer, régner. Ils disent : parcelle, saison, rendement, jachère, greffe, récolte, rebut." },
  { n: 11, cycle: 1, type: 'parchemin', t: "Fragment de rapport",
    b: "Ils ne parlent pas. Ils notent. J’ai vu une surface se couvrir de signes sans qu’aucune main ne bouge, et j’ai compris que je n’assistais pas à une conversation. J’assistais à une prise de mesure, et j’en étais l’objet." },
  { n: 12, cycle: 1, type: 'hieroglyphe', t: "Plaque de calendrier",
    b: "Une année de leur calendrier vaut, selon la meilleure reconstruction, quatre cent onze des nôtres. Le domaine est inscrit sur cette plaque à la saison neuf." },
  { n: 13, cycle: 1, type: 'parchemin', t: "Lettre de Frère Aldric",
    b: "J’ai cessé de me demander s’ils sont bons. On ne demande pas cela d’une saison. La question utile est autre : depuis combien de temps la serre tourne-t-elle sans jardinier ?" },
  { n: 14, cycle: 1, type: 'sceau', t: "Sceau de jachère",
    b: "Un rectangle barré. Sur les six sceaux connus, celui-ci est le seul qui ait été rayé après coup, profondément, par un outil qui n’est pas des leurs." },
  { n: 15, cycle: 2, type: 'parchemin', t: "Registre d’admission, page arrachée",
    b: "Entrée 1104 : femme, trente et un ans, du village bas. Entrée 1105 : la même, deux jours plus tard. La seconde ligne porte une observation : dentition modifiée, ne parle plus." },
  { n: 16, cycle: 2, type: 'pierre', t: "Pierre du bourbier",
    b: "Nous les appelions démons parce que le mot existait. Le mot juste n’existait pas encore, et quand nous l’avons trouvé, personne n’a voulu l’écrire. Alors je l’écris : brouillons." },
  { n: 17, cycle: 2, type: 'parchemin', t: "Note d’un chirurgien",
    b: "J’ai ouvert la chose. Sous la chair il y a un squelette humain, complet, correct, plus ancien que la chair qui le couvre. Quelqu’un a rebâti un corps autour d’un os qui avait déjà servi." },
  { n: 18, cycle: 2, type: 'hieroglyphe', t: "Planche de comparaison",
    b: "Trois silhouettes alignées. La première est un homme. La troisième est ce qui traverse le marais la nuit. La deuxième n’a jamais été observée vivante : c’est une étape." },
  { n: 19, cycle: 2, type: 'parchemin', t: "Ce que dit la sangsue",
    b: "Elle se nourrit et elle se répare. Nous voyons un monstre qui vole la vie. Je vois un mécanisme qui corrige une erreur – et qui n’a jamais reçu l’ordre de s’arrêter." },
  { n: 20, cycle: 2, type: 'pierre', t: "Pierre du Damné",
    b: "Il se fend en deux et les deux marchent. Ce n’est pas de la magie. C’est une lignée qu’on a poussée à se répliquer et qui ne sait plus s’arrêter à un exemplaire." },
  { n: 21, cycle: 2, type: 'sceau', t: "Sceau du rebut",
    b: "Le pictogramme du rebut, agrandi. En dessous, un chiffre : la proportion de rebut jugée acceptable pour une parcelle en bonne santé. Quatre-vingt-treize pour cent." },
  { n: 22, cycle: 3, type: 'parchemin', t: "Règle de l’Ordre, article premier",
    b: "Nous ne parlons pas. Non par humilité : la parole propage l’agent plus vite que le sang, et nommer la chose la fait venir. Celui qui doit transmettre, grave." },
  { n: 23, cycle: 3, type: 'pierre', t: "Pierre de fondation",
    b: "Nous étions douze. Nous avions trouvé une tablette. Nous avons mis quarante ans à comprendre qu’elle n’était pas la première, et soixante à admettre qu’elle n’était pas la dernière." },
  { n: 24, cycle: 3, type: 'parchemin', t: "Décision du conclave",
    b: "Le texte complet sera détruit. Il sera d’abord recopié en quarante-deux tablettes, dispersées si loin les unes des autres qu’aucun homme pressé ne les réunira. Nous ne cachons pas la vérité. Nous la rendons lente." },
  { n: 25, cycle: 3, type: 'sceau', t: "Sceau de l’Ordre",
    b: "Une bouche fermée par un trait horizontal. Le trait dépasse de part et d’autre, comme une règle de mesure – les deux lectures sont volontaires." },
  { n: 26, cycle: 3, type: 'parchemin', t: "Lettre à un ordre rival",
    b: "Vos frères prient pour que cela cesse. Priez si cela vous soulage. Mais sachez que vous priez dans la direction d’un instrument, et que l’instrument ne vous entend pas plus qu’une balance n’entend ce qu’elle pèse." },
  { n: 27, cycle: 3, type: 'parchemin', t: "Dernière consigne",
    b: "Quand nous ne serons plus que deux, la survivante cessera d’écrire et se contentera d’aller. Elle ne doit rien transmettre. Elle doit seulement être là quand quelqu’un trouvera la première tablette." },
  { n: 28, cycle: 3, type: 'hieroglyphe', t: "Plaque des quarante-deux",
    b: "Quarante-deux cases. Chacune porte un signe des Arpenteurs et, en dessous, sa reconstruction humaine. Onze cases sont vides. En marge : nous n’avons jamais su ce que mesuraient les onze dernières." },
  { n: 29, cycle: 4, type: 'pierre', t: "Pierre du compte",
    b: "La mesure dure une demi-heure. Ce n’est pas une durée choisie pour nous. C’est la durée au bout de laquelle un échantillon cesse de fournir des données nouvelles." },
  { n: 30, cycle: 4, type: 'parchemin', t: "Observation d’un veilleur",
    b: "J’ai tenu vingt-neuf minutes. À la trentième, ce qui est venu n’était pas un ennemi de plus. C’était la fin de la séance. On ne combat pas la fin d’une séance." },
  { n: 31, cycle: 4, type: 'sceau', t: "Sceau de réinitialisation",
    b: "Un sablier renversé, traversé d’une barre. L’Ordre l’a nommé la Faucheuse faute de mieux. Ce n’est pas une figure de la mort. C’est un bouton." },
  { n: 32, cycle: 4, type: 'parchemin', t: "Note en marge d’un registre",
    b: "Le même homme, admis quatre cent douze fois. Chaque fois plus loin. Chaque fois rendu. Il ne se souvient de rien, et pourtant, à la quatre cent douzième, il a hésité au bon endroit." },
  { n: 33, cycle: 4, type: 'pierre', t: "Pierre des gemmes",
    b: "Ce qui brille sur les corps ouverts n’est pas un trésor. C’est l’agent qui se cristallise en sortant. Les ramasser, c’est s’en imprégner. Monter n’est pas apprendre. Monter, c’est avancer vers le seuil." },
  { n: 34, cycle: 4, type: 'hieroglyphe', t: "Courbe de rendement",
    b: "Une courbe qui monte, marque un palier, puis chute. Le palier porte un signe traduit par seuil. La chute porte un signe traduit par ce qui vient après, et l’Ordre n’a jamais su si c’était une promesse ou une perte." },
  { n: 35, cycle: 4, type: 'parchemin', t: "Lettre inachevée",
    b: "Si tu lis ceci, tu as compris que tu n’es pas le premier. Il me reste à te dire la seule chose utile, et je ne sais pas comment l’écrire sans que tu croies que je délire. Nous ne sommes pas enfermés dedans. Nous sommes ce qui pousse" },
  { n: 36, cycle: 5, type: 'parchemin', t: "Ce que dit le Sanguinaire",
    b: "Il ne parle pas non plus. Mais il est le seul, dans tout le domaine, à porter un numéro inférieur à mille. Il n’est pas le maître du lieu. Il est le premier échantillon conservé." },
  { n: 37, cycle: 5, type: 'pierre', t: "Pierre du seuil franchi",
    b: "Franchir le seuil ne délivre pas. Cela change ce que l’on est en train de mesurer. Rien de plus. Rien de moins. Ceux qui l’ont franchi sont toujours ici, et nous les appelons boss." },
  { n: 38, cycle: 5, type: 'sceau', t: "Sceau de conservation",
    b: "Un contour de corps, cerné d’un double trait. La légende reconstruite : spécimen retenu pour comparaison. Le domaine ne garde pas ses meilleurs sujets par cruauté. Il les garde comme étalons." },
  { n: 39, cycle: 5, type: 'hieroglyphe', t: "Dernier relevé complet",
    b: "Quarante-deux colonnes remplies. C’est le seul document intact du recueil. Il ne conclut rien. Il ne recommande rien. C’est une fiche, et elle est correctement remplie." },
  { n: 40, cycle: 5, type: 'parchemin', t: "Confession de Sœur Ombre",
    b: "Je n’ai pas fait vœu de silence. J’ai essayé de parler, une fois, il y a très longtemps, et j’ai vu ce que la parole appelle. Depuis, je marche et je regarde. Quelqu’un finira par ramasser les quarante-deux." },
  { n: 41, cycle: 5, type: 'pierre', t: "Pierre de l’aube",
    b: "On nous a promis l’aube pour tenir jusqu’au bout de la mesure. Il n’y a pas d’aube. Il n’y a que la fin de la séance et le début de la suivante. Tenez quand même : c’est la seule chose qu’ils ne mesurent pas." },
  { n: 42, cycle: 5, type: 'parchemin', t: "La théorie perdue",
    b: "Nous l’avons cherchée pendant six siècles, et nous l’avons trouvée en réunissant nos propres tablettes. Il n’y a pas de théorie. Il n’y a jamais eu de théorie.\\n\\nQuarante-deux paramètres relevés par échantillon. Une colonne par paramètre. Nos ancêtres ont recopié avec une dévotion admirable, sur des tablettes de pierre, en y consacrant leur vie entière, le formulaire d’entrée." },
];

/** Épilogue, hors numérotation, débloqué à 42/42. */
export const EPILOGUE = "Vous avez le formulaire complet.\\n\\nCela ne rouvre aucune porte, n’éteint aucune lumière, ne fait pas venir l’aube. Le domaine tourne exactement comme avant, parce qu’il n’a jamais eu besoin que vous compreniez quoi que ce soit pour tourner.\\n\\nUne seule chose a changé, et elle est petite : la prochaine fois que vous entrerez, vous saurez ce que vous êtes en train de remplir. Ils n’ont pas prévu de colonne pour cela.\\n\\nTenez jusqu’à l’aube. Elle ne viendra pas.\\nNous le savons tous les deux, maintenant.";

export const TOTAL = FRAGMENTS.length;

/** Chiffres romains, pour la numérotation de l'Archive. */
export function roman(n: number): string {
  const table: [number, string][] = [
    [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  let v = n;
  for (const [val, sym] of table) {
    while (v >= val) {
      out += sym;
      v -= val;
    }
  }
  return out;
}
