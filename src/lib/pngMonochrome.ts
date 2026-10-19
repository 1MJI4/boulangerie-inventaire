// src/lib/pngMonochrome.ts — PNG noir et blanc (1 bit par point) pour l'imprimante.
//
// Pourquoi (19/10/2026) : `canvas.toDataURL('image/png')` produit un PNG
// couleur 32 bits. Décodé par la TSP100IV, un ticket de 576 × 1283 points
// pèse ~3 Mo et dépasse sa mémoire : « 511 Media Decoding Error » sur les
// exemplaires BUREAU / MAGASIN / ATELIER (le CLIENT, plus court, passait).
// Une imprimante thermique n'imprime que du noir : en 1 bit, le même ticket
// décodé pèse ~90 Ko, pour un rendu identique sur le papier.
//
// Pur : la compression zlib est fournie par l'appelant (CompressionStream
// dans le navigateur, node:zlib dans les tests).

/** Compression zlib (RFC 1950), format exigé par le bloc IDAT d'un PNG. */
export type Zlib = (donnees: Uint8Array) => Promise<Uint8Array>;

/** Seuil de luminance (0-255) : en dessous, le point est imprimé en noir. */
export const SEUIL_NOIR = 160;

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

let tableCrc: Uint32Array | null = null;
function crc32(octets: Uint8Array): number {
  if (!tableCrc) {
    tableCrc = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tableCrc[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const o of octets) c = tableCrc[(c ^ o) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloc(type: string, donnees: Uint8Array): Uint8Array {
  const sortie = new Uint8Array(12 + donnees.length);
  const vue = new DataView(sortie.buffer);
  vue.setUint32(0, donnees.length);
  for (let i = 0; i < 4; i++) sortie[4 + i] = type.charCodeAt(i);
  sortie.set(donnees, 8);
  vue.setUint32(8 + donnees.length, crc32(sortie.subarray(4, 8 + donnees.length)));
  return sortie;
}

/**
 * Points RGBA (comme `ImageData.data`) → PNG 1 bit, niveaux de gris
 * (0 = noir, 1 = blanc). La transparence est posée sur du blanc.
 */
export async function pngMonochrome(
  rgba: Uint8ClampedArray | Uint8Array,
  largeur: number,
  hauteur: number,
  zlib: Zlib,
): Promise<Uint8Array> {
  if (!Number.isInteger(largeur) || !Number.isInteger(hauteur) || largeur <= 0 || hauteur <= 0) {
    throw new RangeError('pngMonochrome : dimensions invalides.');
  }
  if (rgba.length !== largeur * hauteur * 4) throw new RangeError('pngMonochrome : taille des points incohérente.');

  const octetsParLigne = Math.ceil(largeur / 8);
  // Chaque ligne commence par l'octet de filtre (0 = aucun).
  const brut = new Uint8Array(hauteur * (1 + octetsParLigne));
  for (let y = 0; y < hauteur; y++) {
    const debut = y * (1 + octetsParLigne);
    brut[debut] = 0;
    for (let x = 0; x < largeur; x++) {
      const i = (y * largeur + x) * 4;
      const a = rgba[i + 3] / 255;
      // Luminance perçue, composée sur fond blanc.
      const l = (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) * a + 255 * (1 - a);
      if (l >= SEUIL_NOIR) brut[debut + 1 + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }

  const entete = new Uint8Array(13);
  const vue = new DataView(entete.buffer);
  vue.setUint32(0, largeur);
  vue.setUint32(4, hauteur);
  entete[8] = 1; // 1 bit par point
  entete[9] = 0; // niveaux de gris
  entete[10] = 0; // compression deflate
  entete[11] = 0; // filtrage standard
  entete[12] = 0; // non entrelacé

  const morceaux = [
    new Uint8Array(SIGNATURE),
    bloc('IHDR', entete),
    bloc('IDAT', await zlib(brut)),
    bloc('IEND', new Uint8Array(0)),
  ];
  const total = morceaux.reduce((s, m) => s + m.length, 0);
  const png = new Uint8Array(total);
  let pos = 0;
  for (const m of morceaux) {
    png.set(m, pos);
    pos += m.length;
  }
  return png;
}

/** Compression zlib du navigateur (CompressionStream « deflate » = zlib). */
export const zlibNavigateur: Zlib = async (donnees) => {
  const flux = new Blob([donnees as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(flux).arrayBuffer());
};

/** Base64 d'octets, sans dépendance (navigateur). */
export function enBase64(octets: Uint8Array): string {
  let binaire = '';
  for (let i = 0; i < octets.length; i += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  }
  return btoa(binaire);
}
