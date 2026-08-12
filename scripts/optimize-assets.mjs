/**
 * Pré-génération des assets statiques (`pnpm assets:build`).
 *
 * Pourquoi un script plutôt que l'optimiseur de `next/image` :
 * l'app tourne derrière PM2 en un seul process plafonné à 512 Mo
 * (`ecosystem.config.cjs`). L'optimiseur d'images de Next vit dans CE process,
 * et ré-encoder une photo 1920×1080 à chaque déploiement (le cache
 * `.next/cache/images` est vidé à chaque build) coûte du CPU et de la mémoire
 * native au pire moment. On ramène donc les sources à une taille et un format
 * que l'optimiseur traite pour trois fois rien, une fois pour toutes, en amont.
 *
 * Les sources vivent dans `assets-src/` (hors `public/`, jamais servies) ;
 * les sorties sont commitées dans `public/assets/`. Le script est idempotent :
 * relancer sans changer les sources réécrit des fichiers identiques.
 */
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { optimize } from 'svgo';

const ROOT = new URL('..', import.meta.url).pathname;
const src = (p) => join(ROOT, 'assets-src', p);
const out = (p) => join(ROOT, 'public/assets', p);

/**
 * Les logos sont déclarés en boîte carrée par leurs consommateurs
 * (`width={60} height={60}` dans la navbar, 48 dans le footer, 36 dans la
 * sidebar) alors que leurs viewBox ne sont pas carrées. Un SVG se contente de
 * se centrer dans la boîte (`preserveAspectRatio` par défaut) ; un raster, lui,
 * serait étiré. On rasterise donc sur un canevas carré transparent pour
 * reproduire exactement le rendu actuel, sans toucher aux composants.
 */
const LOGOS = [
  { from: 'logos/eba_n.svg', to: 'logos/eba_n.webp', box: 256 },
  { from: 'logos/eba_white_n.svg', to: 'logos/eba_white_n.webp', box: 256 },
];

/**
 * Photos : `next/image` ne sur-échantillonne jamais, donc la largeur de source
 * plafonne ce qui peut être servi. 1920 couvre la plus grande variante utile
 * (`deviceSizes` s'arrête à 3840, mais aucune source du site ne va au-delà de
 * 1920). Qualité 85 : au-dessus du 75 par défaut de Next, pour que la source
 * ne soit pas le maillon faible des ré-encodages successifs.
 */
const PHOTOS = [
  {
    from: 'examples/accueil/eba-hero-2.png',
    to: 'examples/accueil/eba-hero-2.webp',
    width: 1920,
    quality: 85,
  },
];

/**
 * `eba.svg` reste vectoriel : c'est le seul logo affiché hors boîte carrée
 * (page `/offline`, 96 px) et il est pré-caché par le service worker
 * (`public/sw.js`). On se contente donc de le nettoyer.
 *
 * `floatPrecision: 2` est délibéré. À 1 décimale le fichier tombe à 7 Ko gzip
 * au lieu de 15,5, mais 4,5 % des pixels bougent à la taille d'affichage :
 * trop pour un logo de marque, et l'économie porte sur une page que
 * personne ne voit. À 2 décimales le rendu est identique (0,4 % d'écart,
 * 0,07/255 en moyenne — de l'anticrénelage, pas de la géométrie).
 */
const SVGS = [{ from: 'logos/eba.svg', to: 'logos/eba.svg' }];

const kb = (n) => `${(n / 1024).toFixed(1)} Ko`;

async function sizeOf(path) {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

async function emit(path, buffer, beforeSize) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buffer);
  const rel = path.slice(ROOT.length);
  const delta = beforeSize ? ` (source : ${kb(beforeSize)})` : '';
  console.log(`  ✓ ${rel} — ${kb(buffer.length)}${delta}`);
}

async function buildLogos() {
  console.log('Logos (canevas carré transparent) :');
  for (const { from, to, box } of LOGOS) {
    const source = await readFile(src(from));
    // `density` élevée : librsvg rasterise à partir du DPI, pas de la largeur
    // cible. Trop bas, les courbes du logo sortent crénelées.
    const buffer = await sharp(source, { density: 384 })
      .resize(box, box, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 90, alphaQuality: 90, effort: 6 })
      .toBuffer();
    await emit(out(to), buffer, source.length);
  }
}

async function buildPhotos() {
  console.log('Photos :');
  for (const { from, to, width, quality } of PHOTOS) {
    const before = await sizeOf(src(from));
    const buffer = await sharp(src(from))
      .resize({ width, withoutEnlargement: true })
      .webp({ quality, effort: 6 })
      .toBuffer();
    await emit(out(to), buffer, before);
  }
}

async function buildSvgs() {
  console.log('SVG (nettoyage, vectoriel conservé) :');
  for (const { from, to } of SVGS) {
    const source = await readFile(src(from), 'utf8');
    const { data } = optimize(source, {
      path: src(from),
      multipass: true,
      floatPrecision: 2,
    });
    await emit(out(to), Buffer.from(data), Buffer.byteLength(source));
  }
}

await buildLogos();
await buildPhotos();
await buildSvgs();
console.log('\nTerminé. Pense à committer les fichiers générés.');
