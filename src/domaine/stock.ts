// src/domaine/stock.ts
//
// Comptage du STOCK de la feuille de commande (farines, congelé, sacs,
// emballages, entretien) — propriétaire, 22/11/2026. Liste PROPRE, séparée de
// l'inventaire des invendus (LOI 10) : aucun lien avec « Produit » ni avec le
// catalogue de commande. On compte ce qu'il RESTE ; une case vide = « pas
// encore compté », à ne pas confondre avec 0.
//
// HYPOTHÈSE À VALIDER : quantités entières (sacs, paquets, cartons) ; les
// articles au poids (sucre, sel…) se comptent en sacs/paquets entiers.

import { signaler } from './messages.ts';
import { succes, type Resultat } from './resultat.ts';

export const QUANTITE_STOCK_MAX = 100_000;

/** Quantité saisie : entier ≥ 0, ou `null` (pas encore compté). Texte vide = null. */
export function validerQuantiteStock(valeur: unknown, champ: string): Resultat<number | null> {
  if (valeur === null || valeur === undefined || valeur === '') return succes(null);
  const n = typeof valeur === 'string' && /^\d+$/.test(valeur.trim()) ? Number(valeur) : valeur;
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0 || n > QUANTITE_STOCK_MAX) {
    return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'quantité en stock' }, { champ });
  }
  return succes(n);
}

// ---------------------------------------------------------------------------
// Feuille à envoyer (PDF pour WhatsApp) : mise en page pure, deux colonnes par
// page comme la feuille papier. Une catégorie = une barre titre ; un titre
// n'est jamais la dernière ligne d'une colonne (pas de titre orphelin).
// ---------------------------------------------------------------------------

export type LigneFeuilleStock =
  | { genre: 'titre'; texte: string }
  | { genre: 'article'; texte: string; quantite: number | null };

export type ArticleAImprimer = { nom: string; categorie: string; quantite: number | null };

/** pages → colonnes (2 par page) → lignes. `parColonne` ≥ 2. */
export function mettreEnPageStock(articles: readonly ArticleAImprimer[], parColonne: number): LigneFeuilleStock[][][] {
  const max = Math.max(2, Math.floor(parColonne));
  const lignes: LigneFeuilleStock[] = [];
  let derniere: string | null = null;
  for (const a of articles) {
    if (a.categorie !== derniere) {
      lignes.push({ genre: 'titre', texte: a.categorie });
      derniere = a.categorie;
    }
    lignes.push({ genre: 'article', texte: a.nom, quantite: a.quantite });
  }

  const pages: LigneFeuilleStock[][][] = [];
  let colonnes: LigneFeuilleStock[][] = [];
  let courante: LigneFeuilleStock[] = [];
  const fermerColonne = () => {
    if (courante.length === 0) return;
    colonnes.push(courante);
    courante = [];
    if (colonnes.length === 2) {
      pages.push(colonnes);
      colonnes = [];
    }
  };
  for (const l of lignes) {
    if (l.genre === 'titre' && courante.length >= max - 1) fermerColonne();
    courante.push(l);
    if (courante.length >= max) fermerColonne();
  }
  fermerColonne();
  if (colonnes.length > 0) pages.push(colonnes);
  return pages;
}
