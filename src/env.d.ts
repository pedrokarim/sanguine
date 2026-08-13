/**
 * Variables d'environnement injectées par Vite à la compilation.
 *
 * Déclarées à la main plutôt qu'en activant `vite/client` : `tsconfig.json` pose
 * `"types": []` pour qu'aucun type ambiant n'entre sans être demandé, et trois champs ne
 * justifient pas de lever cette règle.
 */
interface ImportMetaEnv {
  /** Clé publique du site Sarutobi (`st_live_…`). Absente ⇒ aucune mesure n'est envoyée. */
  readonly VITE_SARUTOBI_KEY?: string;
  /** Instance de collecte, si elle n'est pas celle par défaut. */
  readonly VITE_SARUTOBI_HOST?: string;
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
