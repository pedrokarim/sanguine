/**
 * Mesure d'audience — contrat d'ingestion Sarutobi, parlé directement.
 *
 * Le jeu ne télécharge rien et n'a aucune dépendance runtime ; la mesure ne fait pas
 * exception. Ni le paquet `@ascencia/sarutobi-js`, ni le `<script>` distant `s.js` : cent
 * lignes suffisent à poster sur `/api/collect`, et tout ce qui quitte la page est lisible
 * ici. Un fichier à relire vaut mieux qu'un blob minifié à qui l'on fait confiance.
 *
 * Trois règles, tenues par construction plutôt que par discipline :
 *
 * - **Aucune identité persistante.** Pas de second `localStorage` à côté de la sauvegarde,
 *   pas d'`anonymous_id` : la session naît avec l'onglet et meurt avec lui. On mesure des
 *   parties, pas des personnes — au prix assumé de ne jamais savoir si deux visites sont
 *   le même joueur.
 * - **Aucune donnée personnelle.** Les propriétés envoyées sont des identifiants de contenu
 *   du jeu — `ysolde`, `faux`, `victory`. Rien qui vienne du joueur, jamais de texte libre.
 * - **Silence intégral en cas d'échec.** Clé absente, réseau coupé, bloqueur, `file://`
 *   dont l'origine est refusée : le jeu se déroule à l'identique. Une mesure n'a pas le
 *   droit de coûter une partie, ni même une image.
 *
 * Sans `VITE_SARUTOBI_KEY` à la compilation, tout ce module est un no-op — c'est le cas par
 * défaut en développement, et rien n'oblige à posséder une instance pour travailler.
 */

/** Valeurs acceptées par le contrat : ni tableau, ni objet imbriqué, ils sont ignorés. */
type Valeur = string | number | boolean | null;
export type Props = Record<string, Valeur>;

/** Un événement du lot, aux noms de champs courts imposés par le contrat. */
interface Evenement {
  t: 'pageview' | 'pageleave' | 'custom' | 'error';
  u: string;
  ts: number;
  r?: string;
  w?: number;
  n?: string;
  p?: Props;
  d?: number;
  st?: string;
}

const CLE = import.meta.env.VITE_SARUTOBI_KEY ?? '';

/**
 * Adresse de collecte, construite **à l'intérieur** du test sur la clé et non à côté.
 *
 * Ce n'est pas un détail de style : la CI vérifie qu'aucune URL externe n'apparaît dans le
 * bundle livré, et une constante posée au niveau du module y figurerait même quand la mesure
 * est éteinte. Placée ici, la chaîne disparaît du build par défaut avec la branche morte, et
 * la promesse « rien n'est chargé depuis le réseau » reste vérifiable par la machine.
 */
const POINT = CLE
  ? `${import.meta.env.VITE_SARUTOBI_HOST ?? 'https://sarutobi.ascencia.re'}/api/collect`
  : '';

/**
 * Version envoyée avec chaque lot, pour rattacher une erreur à une livraison précise.
 * À garder alignée avec `package.json` et le pied de l'écran-titre.
 */
const RELEASE = '1.0.0';

/** Plafonds du contrat d'ingestion. Les dépasser fait rejeter le lot ou tronquer la valeur. */
const LOT_MAX = 20;
const CLES_MAX = 32;
const VALEUR_MAX = 512;

/**
 * Délai de regroupement. Une partie produit une trentaine d'événements en trente minutes :
 * les grouper par paquets de quelques secondes suffit à n'ouvrir qu'une poignée de requêtes,
 * sans jamais retarder la mesure au point de la perdre à la fermeture de l'onglet.
 */
const REGROUPEMENT = 4000;

const actif = POINT.length > 0;

/** Session en mémoire vive, recréée à chaque chargement. Rien n'en survit à l'onglet. */
const session = jeton();
const depart = Date.now();

let file: Evenement[] = [];
let minuteur: ReturnType<typeof setTimeout> | null = null;
let demarre = false;

function jeton(): string {
  // `randomUUID` n'existe qu'en contexte sécurisé ; le repli n'a pas à être imprévisible,
  // il doit seulement éviter que deux onglets ouverts en même temps se confondent.
  try {
    return crypto.randomUUID();
  } catch {
    return `s-${depart.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Ramène des propriétés arbitraires à ce que le contrat accepte : 32 clés, 512 caractères,
 * types simples. Le tri se fait ici et non chez l'appelant — un point d'appel qui doit se
 * souvenir des limites finit toujours par les oublier.
 */
function assainir(p: Props | undefined): Props | undefined {
  if (!p) return undefined;
  const out: Props = {};
  let n = 0;
  for (const [k, v] of Object.entries(p)) {
    if (n >= CLES_MAX) break;
    if (v === null || typeof v === 'boolean') {
      out[k] = v;
    } else if (typeof v === 'number') {
      // `NaN` et les infinis ne survivent pas à `JSON.stringify` : ils deviendraient `null`
      // en silence, ce qui ferait passer un bug de calcul pour une absence de valeur.
      if (!isFinite(v)) continue;
      out[k] = v;
    } else if (typeof v === 'string') {
      out[k] = v.length > VALEUR_MAX ? v.slice(0, VALEUR_MAX) : v;
    } else {
      continue;
    }
    n++;
  }
  return out;
}

/** Empile un événement, et déclenche l'envoi dès que le lot est plein. */
function empiler(ev: Evenement): void {
  if (!actif) return;
  file.push(ev);
  if (file.length >= LOT_MAX) {
    vider();
    return;
  }
  // Enveloppé plutôt que passé directement : `setTimeout` transmet un argument dans certains
  // environnements, qui deviendrait ici un `sortie` vrai — et couperait l'écoulement du lot.
  if (minuteur === null) minuteur = setTimeout(() => vider(), REGROUPEMENT);
}

/**
 * Envoie le lot en attente.
 *
 * `sendBeacon` d'abord : c'est le seul transport qui survit à une page en train de se
 * fermer, et c'est précisément à ce moment-là qu'une fin de partie part. Le `text/plain`
 * n'est pas un détail de forme — il évite le pré-vol CORS, donc une requête sur deux.
 */
function vider(sortie = false): void {
  if (minuteur !== null) {
    clearTimeout(minuteur);
    minuteur = null;
  }
  if (!actif || file.length === 0) return;

  const lot = file.splice(0, LOT_MAX);
  const corps = JSON.stringify({
    k: CLE,
    b: lot,
    s: session,
    rel: RELEASE,
    env: import.meta.env.DEV ? 'development' : 'production',
  });

  try {
    const blob = new Blob([corps], { type: 'text/plain;charset=UTF-8' });
    if (navigator.sendBeacon?.(POINT, blob)) {
      if (file.length > 0 && !sortie) vider();
      return;
    }
    void fetch(POINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: corps,
      keepalive: true,
      mode: 'cors',
    }).catch(() => {
      /* réseau, origine refusée, quota : la mesure se perd, le jeu ne le remarque pas */
    });
  } catch {
    /* `Blob`, `fetch` ou `sendBeacon` indisponibles : on renonce à ce lot */
  }

  // Un lot de plus de vingt événements ne peut pas partir d'un coup ; on enchaîne, sauf en
  // sortie de page où la boucle n'aurait pas le temps de se dérouler.
  if (file.length > 0 && !sortie) vider();
}

function evenement(t: Evenement['t'], reste: Partial<Evenement> = {}): Evenement {
  return {
    t,
    u: location.href,
    ts: Date.now(),
    ...reste,
  };
}

/** Tronque un message d'erreur à quelque chose d'agrégeable, sans la variable qui l'a causé. */
function texte(v: unknown, max: number): string {
  const s = typeof v === 'string' ? v : String(v);
  return s.length > max ? s.slice(0, max) : s;
}

export const analytics = {
  /**
   * Démarre la mesure : vue de page, remontée des erreurs, et envoi garanti à la fermeture.
   * Appelée une seule fois au démarrage ; sans clé de site, elle ne fait rien du tout.
   */
  start(): void {
    if (!actif || demarre) return;
    demarre = true;

    empiler(evenement('pageview', {
      r: document.referrer || undefined,
      w: window.innerWidth,
    }));

    // Une erreur JavaScript dans un survivor-like ne se voit pas dans les chiffres de
    // rétention : elle fige la partie et le joueur ferme l'onglet. La remonter est le seul
    // moyen d'apprendre qu'une build est cassée sur un navigateur qu'on ne possède pas.
    window.addEventListener('error', (e: ErrorEvent) => {
      empiler(evenement('error', {
        n: texte(e.message || 'error', 200),
        st: e.error instanceof Error && e.error.stack ? texte(e.error.stack, 2000) : undefined,
      }));
    });

    window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
      const r: unknown = e.reason;
      empiler(evenement('error', {
        n: texte(r instanceof Error ? r.message : r, 200),
        st: r instanceof Error && r.stack ? texte(r.stack, 2000) : undefined,
      }));
    });

    // `pagehide` plutôt que `beforeunload`, pour la même raison qu'au-dessus dans `main.ts` :
    // sur mobile, c'est le seul des deux qui soit réellement émis.
    window.addEventListener('pagehide', () => {
      empiler(evenement('pageleave', { d: Math.round((Date.now() - depart) / 1000) }));
      vider(true);
    });

    // Un onglet masqué sur mobile peut ne jamais être réveillé : ce qui est en attente part
    // maintenant ou ne partira pas.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) vider(true);
    });
  },

  /**
   * Enregistre un événement métier. Le nom suit les conventions Sarutobi : verbe au passé,
   * `snake_case`, en anglais, sans identifiant dans le nom — ce qui distingue deux parties
   * appartient aux propriétés, jamais au nom.
   */
  capture(nom: string, props?: Props): void {
    empiler(evenement('custom', { n: nom, p: assainir(props) }));
  },

  /** Vrai si une clé de site a été fournie à la compilation. Sert au bandeau de debug. */
  get enabled(): boolean {
    return actif;
  },
};
