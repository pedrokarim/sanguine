#!/usr/bin/env node
/**
 * Contrôle de typographie française sur les textes destinés à être lus.
 *
 * Le jeu est écrit en français, et la typographie française n'est pas l'anglaise. Deux
 * fautes revenaient à chaque session d'écriture :
 *
 *   1. le **tiret cadratin** (—), qui est anglais. En français, l'incise se marque au
 *      demi-cadratin (–) entouré d'espaces ;
 *   2. l'**apostrophe droite** ('), qui est un caractère de machine à écrire. La française
 *      est l'apostrophe courbe (’).
 *
 * Les corriger à la main ne tenait pas : elles revenaient au texte suivant. D'où ce
 * contrôle, exécuté par la chaîne d'audit.
 *
 * Ce qu'il ne regarde pas, délibérément :
 *   - les commentaires de code, qui ne sont pas lus par les joueurs ;
 *   - le code, les sélecteurs, les URL et les blocs de code des documents ;
 *   - les **éléments d'interface** — un tiret seul marque une case vide de l'Archive, un
 *     point médian sépare deux statistiques. Ce sont des signes, pas du texte.
 */

import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RACINE = new URL('..', import.meta.url).pathname;

// --- Ce qui distingue une phrase française d'un identifiant ------------------

const MOT = /[a-zà-ÿ]{3,}/;
const FRANCAIS =
  /[àâäéèêëîïôöùûüçœ]|\b(le|la|les|un|une|des|de|du|et|ou|qui|que|vous|pour|dans|sur|ne|se|il|elle|son|sa)\b/;

/**
 * Le garde-fou décisif est l'exigence d'un mot en **minuscules**.
 *
 * Les grilles de pixels du logo et du curseur (« XX...XX », « X#X..... ») n'en contiennent
 * aucun. Une première version du correcteur s'en passait et a transformé les points de ces
 * grilles en points de suspension, rendant le logo illisible. Le garde-fou vient de là.
 */
function estProse(s) {
  const t = s.trim();
  if (t === '—' || t === '–' || t === '·' || t === '') return false;
  return MOT.test(s) && FRANCAIS.test(s);
}

const REGLES = [
  {
    nom: 'tiret cadratin — (anglais) au lieu du demi-cadratin –',
    test: (s) => s.includes('—'),
    conseil: 'remplacer « — » par « – » entouré d’espaces',
  },
  {
    nom: 'apostrophe droite \' au lieu de l’apostrophe française ’',
    test: (s) => /[A-Za-zÀ-ÿ]'[A-Za-zÀ-ÿ]/.test(s),
    conseil: 'remplacer « \' » par « ’ »',
  },
];

// --- Extraction des chaînes d'un fichier TypeScript --------------------------

/** Littéraux de chaîne, commentaires et interpolations exclus. */
function chainesTs(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      const j = src.indexOf('\n', i);
      i = j < 0 ? src.length : j;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const j = src.indexOf('*/', i + 2);
      i = j < 0 ? src.length : j + 2;
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') {
      const delim = c;
      let j = i + 1;
      let buf = '';
      while (j < src.length) {
        if (src[j] === '\\') { buf += src[j + 1] ?? ''; j += 2; continue; }
        if (src[j] === delim) break;
        if (delim === '`' && src[j] === '$' && src[j + 1] === '{') {
          let prof = 0;
          let k = j + 1;
          while (k < src.length) {
            if (src[k] === '{') prof++;
            else if (src[k] === '}') { prof--; if (prof === 0) break; }
            k++;
          }
          j = k + 1;
          continue;
        }
        buf += src[j];
        j++;
      }
      out.push({ texte: buf, ligne: src.slice(0, i).split('\n').length });
      i = j + 1;
      continue;
    }
    i++;
  }
  return out;
}

/** Prose d'un document, code et balises retirés. */
function chainesDoc(src, html) {
  let t = src
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ');
  if (html) t = t.replace(/<[^>]+>/g, ' ').replace(/&[a-zA-Z#0-9]+;/g, ' ');
  else t = t.replace(/!?\[[^\]]*\]\([^)]*\)/g, ' ');
  return t.split('\n').map((l, n) => ({ texte: l, ligne: n + 1 }));
}

// --- Parcours ----------------------------------------------------------------

function fichiers(dir, ext, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fichiers(p, ext, acc);
    else if (p.endsWith(ext)) acc.push(p);
  }
  return acc;
}

const cibles = [
  ...fichiers(join(RACINE, 'src'), '.ts').map((f) => ({ f, type: 'ts' })),
  { f: join(RACINE, 'site/index.html'), type: 'html' },
  { f: join(RACINE, 'README.md'), type: 'md' },
  ...fichiers(join(RACINE, 'docs'), '.md').map((f) => ({ f, type: 'md' })),
];

const fautes = [];
for (const { f, type } of cibles) {
  let src;
  try { src = readFileSync(f, 'utf8'); } catch { continue; }
  const morceaux = type === 'ts' ? chainesTs(src) : chainesDoc(src, type === 'html');
  for (const { texte, ligne } of morceaux) {
    if (!estProse(texte)) continue;
    for (const r of REGLES) {
      if (r.test(texte)) {
        fautes.push({ f: relative(RACINE, f), ligne, regle: r, extrait: texte.trim().slice(0, 90) });
      }
    }
  }
}

if (fautes.length === 0) {
  console.log(`Typographie française : ${cibles.length} fichiers vérifiés, aucune faute.`);
  process.exit(0);
}

const parRegle = new Map();
for (const x of fautes) {
  if (!parRegle.has(x.regle.nom)) parRegle.set(x.regle.nom, []);
  parRegle.get(x.regle.nom).push(x);
}
for (const [nom, cas] of parRegle) {
  console.error(`\n${nom} — ${cas.length} cas`);
  console.error(`  → ${cas[0].regle.conseil}`);
  for (const c of cas.slice(0, 8)) console.error(`    ${c.f}:${c.ligne}  «${c.extrait}»`);
  if (cas.length > 8) console.error(`    … et ${cas.length - 8} autres`);
}
console.error(`\n${fautes.length} faute(s) de typographie.`);
process.exit(1);
