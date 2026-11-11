// src/catalogue/goutsSurCommande.ts
//
// R62 — ce que chaque gâteau sur commande demande comme goût (propriétaire,
// 22/10/2026). DONNÉE explicite par identifiant, jamais déduite du nom (LOI 6).
// Les gâteaux du comptoir ont déjà leur goût : absents d'ici — SAUF les bûches
// et les Cœurs du rayon « Special fin d'année » (propriétaire, 11/11/2026) :
// le tarif comptoir écrit leurs goûts dans la colonne `sous_categorie`. Ce
// n'est pas une sous-catégorie : on choisit d'abord la bûche (« Bûches 6P »),
// puis son goût, dans SA liste (`liste: 'propre'`).
//   - Goûts DU TARIF, à la lettre (LOI 5), dans l'ordre du tarif ; seuls les
//     espaces en bord sont retirés (« Pistache  » → « Pistache »).
//   - L'import comptoir (importComptoir.ts) lit cette table : pour ces
//     produits la colonne ne fait plus partie ni de l'identifiant ni du
//     libellé, et un tarif dont les goûts diffèrent de cette table est BLOQUÉ.
// Propriétaire : agent `catalogue-prix`.
//
// HYPOTHÈSE À VALIDER (QUESTIONS-GERANT) : les minis (tartelette, bavarois,
// éclair / mille-feuille) sont des assortiments, sans goût obligatoire.

import type { ChoixGout } from '../domaine/gouts.ts';

// Tarif tarif_2026-09, lignes 270-273 (Bûches 4P, 6P, 8P, 10P) : 12 goûts.
const GOUTS_BUCHES = [
  'Noisette', 'Exotique coco', 'Mousse au chocolat', 'Pistache', 'Framboise', 'Passion', 'Citron',
  'Chocolat blanc spéculos', 'Crème au beurre moka', 'Crème au beurre chocolat', 'crème fraîche', 'Matadi',
] as const;
// Ligne 274 (Bûchette) : 10 goûts — ni « crème fraîche » ni « Matadi » au tarif.
const GOUTS_BUCHETTE = [
  'Noisette', 'Exotique coco', 'Mousse au chocolat', 'Pistache', 'Framboise', 'Passion', 'Citron',
  'Chocolat blanc spéculos', 'Crème au beurre moka', 'Crème au beurre chocolat',
] as const;
// Ligne 275 (Petit Cœurs) : 9 goûts.
const GOUTS_PETIT_COEURS = [
  'Noisette', 'Exotique coco', 'Mousse au chocolat', 'Pistache', 'Framboise', 'Passion', 'Mangue', 'Fraise',
  'Chocolat blanc spéculos',
] as const;
// Lignes 276-278 (Cœurs 5P, 7P, 9P) : 11 goûts.
const GOUTS_COEURS = [
  'Noisette', 'Exotique coco', 'Mousse au chocolat', 'Pistache', 'Framboise', 'Passion', 'Mangue', 'Fraise',
  'Chocolat blanc spéculos', 'Crème fraîche', 'Matadi',
] as const;

export const GOUTS_SUR_COMMANDE: Readonly<Record<string, ChoixGout>> = {
  'gateaux-sur-commande/cake-nature': { liste: 'parfum', parEtage: false },
  'gateaux-sur-commande/creme-fraiche': { liste: 'parfum', parEtage: false },
  // Bavarois : d'abord les goûts que le magasin fait déjà au comptoir (rayon
  // Gâteaux et tartes, libellés du catalogue à la lettre), puis la liste du
  // manager (propriétaire, 28/10/2026).
  'gateaux-sur-commande/bavarois': {
    liste: 'parfum',
    parEtage: false,
    goutsEnTete: ['Mangue', 'Fruits de la passion', 'Framboise', 'Fraisier', 'Matadi chocolat', 'Mousse chocolat'],
  },
  'gateaux-sur-commande/layer-cake': { liste: 'parfum', parEtage: false },
  'gateaux-sur-commande/number-cake': { liste: 'parfum', parEtage: false },
  'gateaux-sur-commande/gateau-de-mariage': { liste: 'parfum', parEtage: true },
  'gateaux-sur-commande/piece-montee': { liste: 'parfum', parEtage: true },
  'gateaux-sur-commande/entremet': { liste: 'entremet', parEtage: false },

  // --- Special fin d'année (tarif comptoir, régime A) : liste propre au produit.
  'special-fin-dannee/buches-4p': { liste: 'propre', parEtage: false, gouts: GOUTS_BUCHES },
  'special-fin-dannee/buches-6p': { liste: 'propre', parEtage: false, gouts: GOUTS_BUCHES },
  'special-fin-dannee/buches-8p': { liste: 'propre', parEtage: false, gouts: GOUTS_BUCHES },
  'special-fin-dannee/buches-10p': { liste: 'propre', parEtage: false, gouts: GOUTS_BUCHES },
  'special-fin-dannee/buchette': { liste: 'propre', parEtage: false, gouts: GOUTS_BUCHETTE },
  'special-fin-dannee/petit-coeurs': { liste: 'propre', parEtage: false, gouts: GOUTS_PETIT_COEURS },
  'special-fin-dannee/coeurs-5p': { liste: 'propre', parEtage: false, gouts: GOUTS_COEURS },
  'special-fin-dannee/coeurs-7p': { liste: 'propre', parEtage: false, gouts: GOUTS_COEURS },
  'special-fin-dannee/coeurs-9p': { liste: 'propre', parEtage: false, gouts: GOUTS_COEURS },
};

/**
 * Colonne `sous_categorie` du tarif comptoir, lue comme une liste de goûts
 * (séparés par « , » ou « / » selon la ligne), espaces en bord retirés. Sert
 * UNIQUEMENT à comparer le tarif à la table ci-dessus, pour les produits qui y
 * figurent : jamais à fabriquer une liste à la volée.
 */
export function goutsDeLaColonne(colonne: string): string[] {
  return colonne.split(/[,/]/).map((g) => g.trim()).filter((g) => g !== '');
}

/** Liste propre d'un produit (bûche, Cœur), ou null s'il n'en a pas. */
export function goutsPropres(produitId: string): readonly string[] | null {
  const choix = GOUTS_SUR_COMMANDE[produitId];
  return choix && choix.liste === 'propre' ? choix.gouts : null;
}
