import { defineConfig } from 'vite';

// `base: './'` permet d'ouvrir dist/index.html directement en file:// — le jeu n'a besoin
// d'aucun serveur puisqu'il ne charge aucun asset externe.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 100_000_000, // tout inliner : on veut un dossier dist minimal
    cssCodeSplit: false,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        entryFileNames: 'sanguine.[hash].js',
        assetFileNames: 'sanguine.[hash].[ext]',
      },
    },
  },
  server: {
    port: 5180,
    open: false,
  },
});
