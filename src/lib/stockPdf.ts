// src/lib/stockPdf.ts  (navigateur uniquement)
//
// Feuille de stock propre à envoyer par WhatsApp : PDF A4, deux colonnes comme
// la feuille papier (barre noire par catégorie, une ligne sur deux grisée,
// quantité à droite). Dessinée sur canvas puis assemblée en PDF (pdfImages.ts).
// Sur téléphone/tablette, le menu de partage s'ouvre avec le PDF joint ; sinon
// (ordinateur) le fichier se télécharge.

import { mettreEnPageStock, type ArticleAImprimer } from '../domaine/stock.ts';
import { pdfDepuisJpegs, type PageJpeg } from './pdfImages.ts';

const L = 1240;
const H = 1754;
const MARGE = 60;
const ESPACE = 40;
const COL = (L - 2 * MARGE - ESPACE) / 2;
const LIGNE = 44;
const HAUT = 190;
const PAR_COLONNE = Math.floor((H - HAUT - MARGE) / LIGNE);
const POLICE = 'Arial, Helvetica, sans-serif';

function dessiner(ctx: CanvasRenderingContext2D, colonnes: ReturnType<typeof mettreEnPageStock>[number], titre: string, sousTitre: string, numero: number, total: number) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, L, H);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  ctx.textAlign = 'left';
  ctx.font = `700 46px ${POLICE}`;
  ctx.fillText(titre, MARGE, 80);
  ctx.font = `400 28px ${POLICE}`;
  ctx.fillStyle = '#444';
  ctx.fillText(sousTitre, MARGE, 130);
  if (total > 1) {
    ctx.textAlign = 'right';
    ctx.fillText(`Page ${numero}/${total}`, L - MARGE, 130);
  }

  colonnes.forEach((lignes, c) => {
    const x = MARGE + c * (COL + ESPACE);
    let y = HAUT;
    let gris = false;
    for (const l of lignes) {
      if (l.genre === 'titre') {
        ctx.fillStyle = '#000';
        ctx.fillRect(x, y, COL, LIGNE - 4);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.font = `700 24px ${POLICE}`;
        ctx.fillText(l.texte.toUpperCase(), x + 12, y + LIGNE / 2 - 2);
        ctx.textAlign = 'right';
        ctx.fillText('QTT', x + COL - 12, y + LIGNE / 2 - 2);
        gris = false;
      } else {
        if (gris) {
          ctx.fillStyle = '#e6e6e6';
          ctx.fillRect(x, y, COL, LIGNE);
        }
        ctx.strokeStyle = '#bbb';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, COL - 1, LIGNE - 1);
        ctx.fillStyle = '#000';
        ctx.textAlign = 'left';
        ctx.font = `400 24px ${POLICE}`;
        let nom = l.texte;
        while (nom.length > 1 && ctx.measureText(nom).width > COL - 150) nom = nom.slice(0, -1);
        ctx.fillText(nom === l.texte ? nom : `${nom}…`, x + 12, y + LIGNE / 2);
        ctx.textAlign = 'right';
        ctx.font = `700 28px ${POLICE}`;
        if (l.quantite !== null) ctx.fillText(String(l.quantite), x + COL - 16, y + LIGNE / 2);
        gris = !gris;
      }
      y += LIGNE;
    }
  });
}

export async function creerPdfStock(articles: readonly ArticleAImprimer[], dateLisible: string): Promise<Blob> {
  const pages = mettreEnPageStock(articles, PAR_COLONNE);
  const jpegs: PageJpeg[] = [];
  for (let i = 0; i < pages.length; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = L;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    dessiner(ctx, pages[i], 'Pain Pâtisserie — Stock restant', dateLisible, i + 1, pages.length);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
    if (!blob) throw new Error('jpeg');
    jpegs.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), largeur: L, hauteur: H });
  }
  return new Blob([pdfDepuisJpegs(jpegs) as BlobPart], { type: 'application/pdf' });
}

/** Ouvre le partage (WhatsApp…) avec le PDF ; à défaut, le télécharge. Renvoie ce qui s'est passé. */
export async function partagerPdfStock(articles: readonly ArticleAImprimer[], dateISO: string, dateLisible: string): Promise<'partage' | 'telecharge' | 'annule'> {
  const blob = await creerPdfStock(articles, dateLisible);
  const nom = `stock-${dateISO}.pdf`;
  const fichier = new File([blob], nom, { type: 'application/pdf' });
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: 'Stock restant' });
      return 'partage';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'annule';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'telecharge';
}
