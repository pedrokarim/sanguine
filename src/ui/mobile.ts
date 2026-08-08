import { Pix, toCanvas } from '../gfx/pix';
import { P } from '../gfx/palette';

/**
 * Adaptation aux appareils tactiles — téléphone comme tablette.
 *
 * Le jeu était jouable au doigt depuis le début — le joystick virtuel existe — mais rien
 * ne tenait compte de l'appareil lui-même : ni l'orientation, ni l'encoche, ni la mise en
 * veille de l'écran, et aucun moyen de mettre en pause sans clavier.
 *
 * Le cadrage est pensé pour le paysage : la vue logique fait 480×270, soit 16∶9. En
 * portrait, le facteur d'échelle entier — celui qui garantit un pixel net, et qu'on ne
 * sacrifiera pas — ne peut plus remplir la hauteur, et deux bandes noires occupent la
 * majeure partie de l'écran. D'où la proposition de tourner l'appareil : ce n'est pas une
 * préférence esthétique, c'est la différence entre voir le jeu et voir du vide.
 *
 * La proposition reste une proposition. Qui veut jouer en portrait le peut.
 */

// ---------------------------------------------------------------------------
// Détection
// ---------------------------------------------------------------------------

/**
 * Appareil piloté au doigt.
 *
 * On interroge les capacités du pointeur, pas la chaîne d'agent utilisateur : celle-ci ment
 * depuis toujours, et une tablette qui se déclare « Macintosh » est le cas courant, pas
 * l'exception. `hover: none` écarte l'écran tactile posé devant un clavier et une souris,
 * où l'interface tactile ne servirait à rien.
 */
export function isTouch(): boolean {
  return matchMedia('(pointer: coarse)').matches && matchMedia('(hover: none)').matches;
}

/**
 * Téléphone plutôt que tablette.
 *
 * Ne sert qu'à formuler le libellé de l'écran de rotation — « votre téléphone » ou « votre
 * écran ». Rien d'autre n'en dépend, et surtout pas la décision de proposer une rotation :
 * celle-ci se prend sur l'écran réellement perdu, voir `doitProposer`.
 */
export function isPhone(): boolean {
  return isTouch() && Math.min(window.innerWidth, window.innerHeight) < 500;
}

function isPortrait(): boolean {
  return window.innerHeight > window.innerWidth;
}

// ---------------------------------------------------------------------------
// Le téléphone dessiné
// ---------------------------------------------------------------------------

/** Silhouette de téléphone, dessinée comme le reste : une grille indexée, pas une image. */
function phoneSprite(): HTMLCanvasElement {
  const p = new Pix(11, 19);
  const BORD = 1;
  const ECRAN = 2;
  const LUEUR = 3;

  p.rect(0, 0, 11, 19, BORD);
  p.rect(1, 2, 9, 15, ECRAN);
  // Un reflet en diagonale : sans lui, l'écran est une tache uniforme et l'objet ne se
  // lit plus comme du verre.
  p.line(2, 14, 8, 5, LUEUR);
  p.line(3, 15, 9, 6, LUEUR);
  // Écouteur et bouton, ce qui donne le haut et le bas.
  p.rect(4, 1, 3, 1, LUEUR);
  p.rect(4, 17, 3, 1, LUEUR);

  return toCanvas(p, ['transparent', P.stoneHi, '#0b0d14', P.steel]);
}

// ---------------------------------------------------------------------------
// Plein écran, orientation, veille
// ---------------------------------------------------------------------------

/**
 * Plein écran seul, sans toucher à l'orientation.
 *
 * Échoue silencieusement sur iPhone, où Safari ne l'expose pas. Ce n'est pas un cas dégradé
 * à corriger : c'est précisément pourquoi l'écran de rotation propose de tourner l'appareil
 * à la main plutôt que de compter sur l'API.
 */
async function plainEcran(): Promise<void> {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    }
  } catch {
    /* refusé ou non pris en charge : on continue, ce n'est pas bloquant */
  }
}

/** Plein écran **et** verrou paysage. Réservé au bouton qui le propose explicitement. */
async function plainEcranPaysage(): Promise<void> {
  await plainEcran();
  try {
    const o = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
    };
    await o?.lock?.('landscape');
  } catch {
    /* iOS, ou fenêtre non plein écran : l'utilisateur tournera lui-même */
  }
}

/**
 * Empêche l'écran de s'éteindre pendant une partie.
 *
 * Sanguine se joue sans toucher l'écran pendant de longues secondes — les armes tirent
 * seules. Sur téléphone, le délai de veille se déclenche donc en pleine partie. Le verrou
 * se perd à chaque passage en arrière-plan : il faut le reprendre au retour.
 */
class VerrouVeille {
  private sentinel: WakeLockSentinel | null = null;
  private voulu = false;

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (this.voulu && document.visibilityState === 'visible') void this.prendre();
    });
  }

  async prendre(): Promise<void> {
    this.voulu = true;
    try {
      this.sentinel = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      /* non pris en charge, ou batterie faible : sans effet, jamais bloquant */
    }
  }

  relacher(): void {
    this.voulu = false;
    void this.sentinel?.release();
    this.sentinel = null;
  }
}

// ---------------------------------------------------------------------------
// L'écran de rotation
// ---------------------------------------------------------------------------

export interface CrochetsMobile {
  /** Une partie est-elle en cours ? */
  enPartie: () => boolean;
  /** Interrompre la partie — l'écran couvre le jeu, on ne meurt pas en lisant. */
  interrompre: () => void;
  /**
   * Part de la hauteur d'écran perdue en bandes noires, entre 0 et 1.
   *
   * C'est la seule mesure qui décide s'il faut proposer une rotation. Le critère précédent
   * — « est-ce un téléphone ? » — se trompait dans les deux sens : il épargnait une
   * tablette en portrait qui perd pourtant près de la moitié de son écran, et il aurait
   * sermonné un téléphone dont le format se serait trouvé convenir.
   */
  perteVerticale: () => number;
}

export class Mobile {
  private overlay: HTMLElement | null = null;
  private readonly veille = new VerrouVeille();
  /** L'utilisateur a choisi de rester en portrait : on n'insiste plus de la session. */
  private accepteLePortrait = false;
  private gestePris = false;

  constructor(
    private readonly couche: HTMLElement,
    private readonly crochets: CrochetsMobile,
  ) {}

  installer(): void {
    if (!isTouch()) return;
    document.body.classList.add('is-touch');

    // `orientationchange` n'est pas fiable partout et arrive parfois avant que les
    // dimensions ne soient à jour ; `resize` couvre les deux cas.
    addEventListener('resize', () => this.reevaluer());
    addEventListener('orientationchange', () => setTimeout(() => this.reevaluer(), 120));

    /*
     * Le plein écran exige un geste utilisateur : le premier contact sert de déclencheur.
     *
     * Il ne verrouille **pas** l'orientation. La première version le faisait, et retournait
     * donc une tablette dont le propriétaire avait délibérément choisi le portrait, sans
     * rien lui proposer. Le verrou n'est posé que depuis le bouton de l'écran de rotation,
     * là où il a été demandé.
     */
    const premierGeste = (): void => {
      if (this.gestePris) return;
      this.gestePris = true;
      void plainEcran();
    };
    addEventListener('pointerdown', premierGeste, { once: true, passive: true });

    this.reevaluer();
  }

  /** À appeler quand une partie démarre ou se termine. */
  partieEnCours(oui: boolean): void {
    if (!isTouch()) return;
    if (oui) void this.veille.prendre();
    else this.veille.relacher();
  }

  /**
   * Seuil de perte à partir duquel la rotation vaut d'être proposée.
   *
   * En deçà, les bandes se lisent comme un cadre et personne ne s'en plaint. Au-delà, elles
   * dominent l'écran et le jeu devient une vignette au milieu du noir.
   */
  private static readonly PERTE_MAX = 0.22;

  private doitProposer(): boolean {
    if (!isTouch() || this.accepteLePortrait) return false;
    // L'orientation seule ne suffit pas : ce qui gêne, c'est l'écran perdu, pas le sens de
    // l'appareil. Un format inhabituel en paysage mérite la même proposition.
    return isPortrait() && this.crochets.perteVerticale() > Mobile.PERTE_MAX;
  }

  private reevaluer(): void {
    if (this.doitProposer()) this.montrer();
    else this.cacher();
  }

  private montrer(): void {
    if (this.overlay) return;
    if (this.crochets.enPartie()) this.crochets.interrompre();

    const el = document.createElement('div');
    el.className = 'rotate-screen';

    const scene = document.createElement('div');
    scene.className = 'rotate-phone';
    const sprite = phoneSprite();
    sprite.className = 'rotate-phone-img';
    scene.appendChild(sprite);
    el.appendChild(scene);

    const titre = document.createElement('h2');
    titre.className = 'title-font';
    titre.textContent = isPhone() ? 'Tournez votre téléphone' : 'Tournez votre écran';
    el.appendChild(titre);

    const texte = document.createElement('p');
    texte.className = 'rotate-text';
    texte.textContent =
      'Le domaine est plus large que haut. En paysage, vous voyez venir ce qui vous '
      + 'entoure – et l’écran entier sert au jeu.';
    el.appendChild(texte);

    const actions = document.createElement('div');
    actions.className = 'rotate-actions';

    const btnPlein = document.createElement('button');
    btnPlein.className = 'btn primary';
    btnPlein.textContent = 'Plein écran';
    btnPlein.addEventListener('click', () => void plainEcranPaysage());
    actions.appendChild(btnPlein);

    const btnRester = document.createElement('button');
    btnRester.className = 'btn';
    btnRester.textContent = 'Rester ainsi';
    btnRester.addEventListener('click', () => {
      this.accepteLePortrait = true;
      this.cacher();
    });
    actions.appendChild(btnRester);

    el.appendChild(actions);
    this.couche.appendChild(el);
    this.overlay = el;
  }

  private cacher(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}
