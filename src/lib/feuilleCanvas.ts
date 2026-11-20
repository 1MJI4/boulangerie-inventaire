// src/lib/feuilleCanvas.ts
//
// La feuille de prévisions sur le ticket de l'imprimante Star (même chemin que
// les bons de commande : canvas 576 points → PNG noir et blanc → file
// /api/impression → l'imprimante vient le chercher). Le contenu vient de
// `domaine/feuillePrevisions.ts` ; ici, seulement le dessin.
//
// Une ligne sur deux est un aplat noir à texte blanc (propriétaire,
// 20/11/2026) : on suit la ligne de l'œil, et la case à cocher se voit.
// Hauteur variable : le papier s'allonge, rien ne déborde.

import type { FeuillePrevisions, LigneFeuille } from '../domaine/feuillePrevisions.ts';
import { enBase64, pngMonochrome, zlibNavigateur } from './pngMonochrome.ts';

export const LARGEUR_FEUILLE = 576;
const MARGE = 12;
const SANS = 'Arial, Helvetica, sans-serif';

/** Hauteur d'une ligne sans précision, et supplément quand une précision est imprimée dessous. */
const HAUTEUR_LIGNE = 58;
const HAUTEUR_PRECISION = 22; // par ligne de précision (une ou deux)
const CASE = 30;
const X_NOM = MARGE + CASE + 16;

type Contexte = CanvasRenderingContext2D;

function texte(ctx: Contexte, s: string, x: number, y: number, taille: number, gras: boolean, couleur: string, align: 'left' | 'right' | 'center' = 'left') {
  ctx.font = `${gras ? '700 ' : ''}${taille}px ${SANS}`;
  ctx.fillStyle = couleur;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

/** Réduit la police jusqu'à ce que le texte tienne ; au pire, ellipse. */
function tenir(ctx: Contexte, s: string, largeur: number, taille: number, minimum: number, gras: boolean): { s: string; taille: number } {
  let t = taille;
  const mesure = (v: string, tt: number) => {
    ctx.font = `${gras ? '700 ' : ''}${tt}px ${SANS}`;
    return ctx.measureText(v).width;
  };
  while (t > minimum && mesure(s, t) > largeur) t -= 1;
  let v = s;
  while (v.length > 1 && mesure(v, t) > largeur) v = v.slice(0, -1);
  return { s: v === s ? s : `${v.trimEnd()}…`, taille: t };
}

/** La précision sur une ou deux lignes : on coupe entre deux morceaux (« · »), jamais au milieu. */
function lignesDePrecision(ctx: Contexte, precision: string | null, largeur: number): string[] {
  if (!precision) return [];
  ctx.font = `15px ${SANS}`;
  if (ctx.measureText(precision).width <= largeur) return [precision];
  const morceaux = precision.split(' · ');
  const lignes: string[] = [];
  let courante = '';
  for (const m of morceaux) {
    const essai = courante ? `${courante} · ${m}` : m;
    if (courante && ctx.measureText(essai).width > largeur) {
      lignes.push(courante);
      courante = m;
    } else {
      courante = essai;
    }
  }
  if (courante) lignes.push(courante);
  return lignes.slice(0, 3);
}

function ligne(ctx: Contexte, l: LigneFeuille, y: number): number {
  const precisions = lignesDePrecision(ctx, l.precision, LARGEUR_FEUILLE - MARGE - X_NOM);
  const haut = HAUTEUR_LIGNE + precisions.length * HAUTEUR_PRECISION;
  const encre = l.inverse ? '#fff' : '#000';
  if (l.inverse) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, y, LARGEUR_FEUILLE, haut);
  }
  const milieuNom = precisions.length > 0 ? y + 28 : y + haut / 2;

  // La case à cocher : assez grande pour un crayon, contour épais, du côté de la ligne.
  ctx.strokeStyle = encre;
  ctx.lineWidth = 3;
  ctx.strokeRect(MARGE + 1.5, y + (haut - CASE) / 2 + 1.5, CASE - 3, CASE - 3);

  // Le gros chiffre à droite, puis le nom dans la place qui reste.
  ctx.font = `700 36px ${SANS}`;
  const largeurQuantite = ctx.measureText(l.quantite).width;
  texte(ctx, l.quantite, LARGEUR_FEUILLE - MARGE, milieuNom, 36, true, encre, 'right');
  const place = LARGEUR_FEUILLE - MARGE - largeurQuantite - 14 - X_NOM;
  const nom = tenir(ctx, l.nom, place, 28, 20, true);
  texte(ctx, nom.s, X_NOM, milieuNom, nom.taille, true, encre);
  precisions.forEach((p, i) => {
    const t = tenir(ctx, p, LARGEUR_FEUILLE - MARGE - X_NOM, 17, 13, false);
    texte(ctx, t.s, X_NOM, y + 52 + i * HAUTEUR_PRECISION, t.taille, false, encre);
  });
  if (!l.inverse) {
    // Fin trait entre deux lignes blanches : la ligne se lit jusqu'au bout.
    ctx.fillStyle = '#000';
    ctx.fillRect(MARGE, y + haut - 1, LARGEUR_FEUILLE - 2 * MARGE, 1);
  }
  return haut;
}

/** Dessine toute la feuille sur `ctx` et renvoie la hauteur utilisée (sert aux deux passes). */
export function tracerFeuille(ctx: Contexte, f: FeuillePrevisions, imprimeA: string): number {
  let y = MARGE;
  texte(ctx, 'PAin PAtisserie', LARGEUR_FEUILLE / 2, y + 22, 36, true, '#000', 'center');
  y += 50;
  texte(ctx, f.titre.toUpperCase(), LARGEUR_FEUILLE / 2, y + 16, 28, true, '#000', 'center');
  y += 38;
  texte(ctx, f.sousTitre, LARGEUR_FEUILLE / 2, y + 12, 21, true, '#000', 'center');
  y += 30;
  texte(ctx, `${f.references} références · ${f.totalPieces} pièces`, LARGEUR_FEUILLE / 2, y + 10, 19, false, '#000', 'center');
  y += 28;
  ctx.fillStyle = '#000';
  ctx.fillRect(MARGE, y, LARGEUR_FEUILLE - 2 * MARGE, 3);
  y += 3 + 8;

  for (const section of f.sections) {
    texte(ctx, section.titre, MARGE, y + 18, 24, true, '#000');
    y += 38;
    ctx.fillStyle = '#000';
    ctx.fillRect(MARGE, y, LARGEUR_FEUILLE - 2 * MARGE, 2);
    y += 2;
    for (const l of section.lignes) y += ligne(ctx, l, y);
    y += 16;
  }

  texte(ctx, `Imprimé le ${imprimeA}`, LARGEUR_FEUILLE / 2, y + 8, 16, false, '#000', 'center');
  y += 24 + MARGE;
  return Math.ceil(y);
}

export function dessinerFeuille(f: FeuillePrevisions, imprimeA: string): HTMLCanvasElement {
  // Deux passes, comme les bons : la première mesure, la seconde dessine.
  const mesure = document.createElement('canvas');
  mesure.width = LARGEUR_FEUILLE;
  mesure.height = 10;
  const ctxMesure = mesure.getContext('2d');
  const hauteur = ctxMesure ? tracerFeuille(ctxMesure, f, imprimeA) : 200;

  const canvas = document.createElement('canvas');
  canvas.width = LARGEUR_FEUILLE;
  canvas.height = hauteur;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, LARGEUR_FEUILLE, hauteur);
    tracerFeuille(ctx, f, imprimeA);
  }
  return canvas;
}

/** Le PNG 1 bit à déposer dans la file de l'imprimante (base64, sans préfixe). */
export async function feuilleEnPng(f: FeuillePrevisions, imprimeA: string): Promise<{ png: string; hauteur: number }> {
  const canvas = dessinerFeuille(f, imprimeA);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponible');
  const points = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const png = await pngMonochrome(points, canvas.width, canvas.height, zlibNavigateur);
  return { png: enBase64(png), hauteur: canvas.height };
}
