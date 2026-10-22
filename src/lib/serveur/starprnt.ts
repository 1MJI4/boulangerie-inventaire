// src/lib/serveur/starprnt.ts
//
// Ticket PNG noir et blanc → commandes natives de l'imprimante (StarPRNT,
// « raster »), pour aller plus vite (22/10/2026).
//
// Pourquoi : servi en PNG, chaque ticket prend 6 à 10 s entre le
// téléchargement et la confirmation — l'imprimante décompresse et décode
// l'image elle-même. En StarPRNT, elle reçoit directement les points à
// imprimer : plus rien à décoder.
//
// Sans risque de casse : le serveur PROPOSE ce format en premier et garde le
// PNG en second (voir cloudprnt.ts) ; une imprimante qui ne le connaît pas
// prend le PNG. Si la conversion échoue (PNG inattendu), on sert le PNG.
//
// Le PNG converti est toujours celui de l'aperçu (src/lib/pngMonochrome.ts) :
// niveaux de gris 1 bit, bit à 1 = blanc. En StarPRNT, bit à 1 = point noir.

import { inflateSync } from 'node:zlib';

export const MEDIA_STARPRNT = 'application/vnd.star.starprnt';

/** Lignes de points par commande raster (bandes : une seule commande géante n'est pas garantie). */
const LIGNES_PAR_BANDE = 256;

const ESC = 0x1b;
const GS = 0x1d;

/** Image 1 bit décodée : `largeur` points, `octetsParLigne` octets par ligne, bit à 1 = noir. */
export type Raster = { largeur: number; hauteur: number; octetsParLigne: number; points: Uint8Array };

/** Décode un PNG niveaux de gris 1 bit non entrelacé ; null pour tout autre PNG. */
export function decoderPngMonochrome(png: Uint8Array): Raster | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.length < 8 || signature.some((o, i) => png[i] !== o)) return null;
  const vue = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let largeur = 0;
  let hauteur = 0;
  const idat: Uint8Array[] = [];
  for (let p = 8; p + 8 <= png.length; ) {
    const longueur = vue.getUint32(p);
    const type = String.fromCharCode(png[p + 4], png[p + 5], png[p + 6], png[p + 7]);
    const donnees = png.subarray(p + 8, p + 8 + longueur);
    if (type === 'IHDR') {
      largeur = vue.getUint32(p + 8);
      hauteur = vue.getUint32(p + 12);
      const [profondeur, couleur, , , entrelace] = donnees.subarray(8, 13);
      if (profondeur !== 1 || couleur !== 0 || entrelace !== 0) return null;
    } else if (type === 'IDAT') {
      idat.push(donnees);
    } else if (type === 'IEND') {
      break;
    }
    p += 12 + longueur;
  }
  if (largeur <= 0 || hauteur <= 0 || idat.length === 0) return null;

  const octetsParLigne = Math.ceil(largeur / 8);
  let brut: Buffer;
  try {
    brut = inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }
  if (brut.length < hauteur * (octetsParLigne + 1)) return null;

  const points = new Uint8Array(hauteur * octetsParLigne);
  const precedente = new Uint8Array(octetsParLigne);
  const ligne = new Uint8Array(octetsParLigne);
  // Les bits au-delà de la largeur restent blancs (0 une fois inversés).
  const reste = largeur % 8;
  const masqueFin = reste === 0 ? 0xff : (0xff << (8 - reste)) & 0xff;
  for (let y = 0; y < hauteur; y++) {
    const debut = y * (octetsParLigne + 1);
    const filtre = brut[debut];
    for (let x = 0; x < octetsParLigne; x++) {
      const v = brut[debut + 1 + x];
      const a = x > 0 ? ligne[x - 1] : 0; // 1 bit par point : « bpp » = 1 octet
      const b = precedente[x];
      const c = x > 0 ? precedente[x - 1] : 0;
      let r: number;
      if (filtre === 0) r = v;
      else if (filtre === 1) r = v + a;
      else if (filtre === 2) r = v + b;
      else if (filtre === 3) r = v + ((a + b) >> 1);
      else if (filtre === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else return null;
      ligne[x] = r & 0xff;
    }
    for (let x = 0; x < octetsParLigne; x++) {
      // PNG : 1 = blanc → StarPRNT : 1 = noir.
      let noir = ~ligne[x] & 0xff;
      if (x === octetsParLigne - 1) noir &= masqueFin;
      points[y * octetsParLigne + x] = noir;
    }
    precedente.set(ligne);
  }
  return { largeur, hauteur, octetsParLigne, points };
}

/**
 * Commandes StarPRNT d'un ticket : initialisation, image raster par bandes
 * (ESC GS S 1 xL xH yL yH 0 …), puis avance et coupe partielle (ESC d 3).
 */
export function rasterVersStarPrnt(r: Raster): Uint8Array {
  const parties: Uint8Array[] = [Uint8Array.from([ESC, 0x40])]; // ESC @ : imprimante remise à zéro
  for (let y0 = 0; y0 < r.hauteur; y0 += LIGNES_PAR_BANDE) {
    const lignes = Math.min(LIGNES_PAR_BANDE, r.hauteur - y0);
    const x = r.octetsParLigne;
    parties.push(Uint8Array.from([ESC, GS, 0x53, 0x01, x & 0xff, x >> 8, lignes & 0xff, lignes >> 8, 0x00]));
    parties.push(r.points.subarray(y0 * x, (y0 + lignes) * x));
  }
  parties.push(Uint8Array.from([ESC, 0x64, 0x03])); // ESC d 3 : avance au couteau, coupe partielle
  const total = parties.reduce((n, p) => n + p.length, 0);
  const sortie = new Uint8Array(total);
  let p = 0;
  for (const partie of parties) {
    sortie.set(partie, p);
    p += partie.length;
  }
  return sortie;
}

/** PNG du ticket → StarPRNT ; null si le PNG n'est pas celui attendu (on servira le PNG). */
export function pngVersStarPrnt(png: Uint8Array): Uint8Array | null {
  const r = decoderPngMonochrome(png);
  return r ? rasterVersStarPrnt(r) : null;
}
