// src/catalogue/clesRemplacees.ts
//
// Identifiants de produit CORRIGÉS : nouvelle clé → ancienne clé.
// Propriétaire : agent `catalogue-prix`.
//
// Un identifiant ne change jamais quand un prix change. Il n'est corrigé que
// sur décision du propriétaire, et la correction est une DONNÉE explicite :
// c'est elle qui permet à l'écriture en base (ecritureBase.ts) de RENOMMER la
// fiche existante — même ligne ProduitCatalogue, mêmes prix, mêmes commandes
// passées — au lieu de créer un second produit à côté de l'ancien.
//
// 11/11/2026 (propriétaire) : bûches et Cœurs du rayon « Special fin d'année ».
// L'ancien identifiant portait la liste des goûts (colonne `sous_categorie`
// du tarif) ; les goûts vivent désormais dans goutsSurCommande.ts.

const GOUTS_BUCHES =
  'noisette-exotique-coco-mousse-au-chocolat-pistache-framboise-passion-citron-chocolat-blanc-speculos-creme-au-beurre-moka-creme-au-beurre-chocolat-creme-fraiche-matadi';
const GOUTS_BUCHETTE =
  'noisette-exotique-coco-mousse-au-chocolat-pistache-framboise-passion-citron-chocolat-blanc-speculos-creme-au-beurre-moka-creme-au-beurre-chocolat';
const GOUTS_PETIT_COEURS =
  'noisette-exotique-coco-mousse-au-chocolat-pistache-framboise-passion-mangue-fraise-chocolat-blanc-speculos';
const GOUTS_COEURS =
  'noisette-exotique-coco-mousse-au-chocolat-pistache-framboise-passion-mangue-fraise-chocolat-blanc-speculos-creme-fraiche-matadi';

/** Nouvelle clé → clé qu'elle remplace (telle qu'écrite en base par les imports précédents). */
export const CLES_REMPLACEES: Readonly<Record<string, string>> = {
  'special-fin-dannee/buches-4p': `special-fin-dannee/buches-4p/${GOUTS_BUCHES}`,
  'special-fin-dannee/buches-6p': `special-fin-dannee/buches-6p/${GOUTS_BUCHES}`,
  'special-fin-dannee/buches-8p': `special-fin-dannee/buches-8p/${GOUTS_BUCHES}`,
  'special-fin-dannee/buches-10p': `special-fin-dannee/buches-10p/${GOUTS_BUCHES}`,
  'special-fin-dannee/buchette': `special-fin-dannee/buchette/${GOUTS_BUCHETTE}`,
  'special-fin-dannee/petit-coeurs': `special-fin-dannee/petit-coeurs/${GOUTS_PETIT_COEURS}`,
  'special-fin-dannee/coeurs-5p': `special-fin-dannee/coeurs-5p/${GOUTS_COEURS}`,
  'special-fin-dannee/coeurs-7p': `special-fin-dannee/coeurs-7p/${GOUTS_COEURS}`,
  'special-fin-dannee/coeurs-9p': `special-fin-dannee/coeurs-9p/${GOUTS_COEURS}`,
};
