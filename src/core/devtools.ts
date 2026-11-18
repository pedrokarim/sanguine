/**
 * Les outils de développement : laboratoire d'effets, triches, panneau de débogage, héros de
 * comparaison et poignée `window.sanguine`.
 *
 * Ils n'existent que sur le serveur de développement et dans le build d'essai
 * (`pnpm build:devtools`), qui sert à les vérifier une fois compilés. Le build public ne les
 * cache pas : Vite remplace ces deux valeurs à la compilation et le code disparaît du bundle.
 * La CI le contrôle sur l'artefact.
 */
export const DEV_TOOLS = import.meta.env.DEV || import.meta.env.MODE === 'devtools';
