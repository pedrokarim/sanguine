import { defineConfig } from 'vite';

/**
 * Construction séparée de la planche des sprites.
 *
 * Elle ne partage pas la configuration du jeu, et c'est délibéré : déclarer deux points
 * d'entrée dans une même construction fait extraire les modules communs dans un morceau
 * partagé. `dist/index.html` importerait alors un second fichier en module ES — ce que les
 * navigateurs refusent en `file://`, et le jeu cesserait de fonctionner hors ligne, qui est
 * l'une de ses promesses.
 *
 * Deux constructions indépendantes coûtent quelques kilo-octets dupliqués et préservent
 * cette propriété.
 */
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist-planche',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: {
      input: { planche: 'planche.html', og: 'og.html' },
      output: {
        entryFileNames: '[name].[hash].js',
        assetFileNames: '[name].[hash].[ext]',
      },
    },
  },
});
