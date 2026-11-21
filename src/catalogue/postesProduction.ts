// src/catalogue/postesProduction.ts
//
// R74 — QUI PRODUIT QUOI (décision du propriétaire du 19/11/2026) : pâtissier,
// atelier (salé), boulanger. Une commande peut concerner un, deux ou trois
// postes ; il sort un papier par poste concerné.
// Propriétaire de la donnée : `catalogue-prix` ; règle : `regles-metier`
// (src/domaine/postes.ts).
//
// DONNÉE EXPLICITE, jamais déduite du nom (LOI 6) :
//   - `parRayon`  : le poste de tout un rayon du catalogue de commande ;
//   - `parProduit`: ce qu'un produit a de particulier (il REMPLACE son rayon).
// `role` : ce que le poste fait pour ce produit, imprimé sous la ligne.
// `auDela` : le poste n'est concerné qu'au-delà d'une quantité, comptée sur
// TOUTE la commande pour le groupe nommé (crêpes farcies : plus de 5).
// Rayon sans rien à produire (revente) : liste vide, dit ici une fois.
//
// Contrôlée par src/domaine/postes.test.ts sur le vrai catalogue : un rayon
// absent d'ici fait échouer le test — plus aucun produit « à personne ».
//
// Réponses du propriétaire (19/11/2026) : viennoiseries et minis sucrés au
// pâtissier ; pain du burger, pâte du msemen et du meloui (cuits), batbout au
// boulanger ; crêpes farcies : boulanger prévenu au-delà de 5 sur la commande.
//
// HYPOTHÈSES À VALIDER (QUESTIONS-GERANT) :
//   - pains du rayon Boulangerie au boulanger (non dit, supposé) ;
//   - reste du rayon Oriental (pâtisseries au kilo) au
//     pâtissier, comme dans la liste d'inventaire ;
//   - Grand pain surprise et mini-sandwichs garnis : atelier seul pour
//     l'instant (qui fait le pain ?).

import type { DonneesPostes, TachePoste } from '../domaine/postes.ts';

const PATISSIER: readonly TachePoste[] = [{ poste: 'patissier' }];
const ATELIER: readonly TachePoste[] = [{ poste: 'atelier' }];
const BOULANGER: readonly TachePoste[] = [{ poste: 'boulanger' }];
const AUCUN: readonly TachePoste[] = [];

/** L'atelier monte, le boulanger fait le pain (burgers). */
const ATELIER_ET_PAIN: readonly TachePoste[] = [{ poste: 'atelier' }, { poste: 'boulanger', role: 'le pain' }];
/**
 * Batbout, msemen, meloui, makla (propriétaire, 20/11/2026) : le boulanger fait la PÂTE, l'atelier la CUIT
 * (et la garnit quand il est farci ou healthy).
 */
const PATE_ET_CUISSON: readonly TachePoste[] = [
  { poste: 'atelier', role: 'la cuisson' },
  { poste: 'boulanger', role: 'la pâte' },
];
/** Même chose, garni : l'atelier cuit puis garnit (batbout farci / healthy). */
const PATE_CUISSON_GARNIE: readonly TachePoste[] = [
  { poste: 'atelier', role: 'la cuisson et la garniture' },
  { poste: 'boulanger', role: 'la pâte' },
];
/** Avec confiture (msemen, meloui, baghrir…) : l'atelier cuit puis tartine. */
const PATE_CUISSON_CONFITURE: readonly TachePoste[] = [
  { poste: 'atelier', role: 'la cuisson et la confiture' },
  { poste: 'boulanger', role: 'la pâte' },
];
/** Beignet (propriétaire, 21/11/2026) : l'atelier le fait, mais la pâte vient du boulanger. */
const ATELIER_ET_PATE: readonly TachePoste[] = [{ poste: 'atelier' }, { poste: 'boulanger', role: 'la pâte' }];
/** Crêpes farcies : atelier ; le boulanger est prévenu au-delà de 5 sur la commande. */
const CREPES: readonly TachePoste[] = [
  { poste: 'atelier' },
  { poste: 'boulanger', role: 'à prévenir : plus de 5 crêpes', auDela: { groupe: 'crepes-farcies', quantite: 5 } },
];

export const POSTES_PRODUCTION: DonneesPostes = {
  parRayon: {
    // Tarif comptoir (catégorie du CSV, à la lettre).
    'Gâteaux et tartes': PATISSIER,
    Individuelle: PATISSIER,
    "Special fin d'année": PATISSIER,
    Viennoiserie: PATISSIER,
    Oriental: PATISSIER,
    Boulangerie: BOULANGER,
    Salés: ATELIER,
    'Sandwichs Froids': ATELIER,
    'Frigo-S': ATELIER,
    'Frigo-Boisson': AUCUN,
    Café: AUCUN,
    // Affiches sur commande (titre de l'affiche, à la lettre).
    'Sur commande': ATELIER,
    'Tarifs (minimum) pour les Gâteaux SIMPLES sur commande': PATISSIER,
  },
  parProduit: {
    // Burgers : atelier + pain du boulanger.
    'sales/burger': ATELIER_ET_PAIN,
    'sales/mini-burger': ATELIER_ET_PAIN,
    'sur-commande/mini-burger': ATELIER_ET_PAIN,
    // Batbout : pâte du boulanger, cuisson à l'atelier (garniture comprise s'il est garni).
    // HYPOTHÈSE À VALIDER : le Healthy se prépare comme le farci.
    'oriental/petit-batbout': PATE_ET_CUISSON,
    'sales/batbout-farci': PATE_CUISSON_GARNIE,
    'sales/batbout-healthy': PATE_CUISSON_GARNIE,
    'sur-commande/mini-batbout-farci': PATE_CUISSON_GARNIE,
    // Msemen, Meloui, Makla : pâte du boulanger, cuisson à l'atelier (propriétaire, 20/11/2026).
    'oriental/msemen/semoule': PATE_ET_CUISSON,
    'oriental/msemen/grise': PATE_ET_CUISSON,
    'oriental/meloui': PATE_ET_CUISSON,
    'oriental/grand-makla': PATE_ET_CUISSON,
    'oriental/petit-makla': PATE_ET_CUISSON,
    'oriental/msemen-semoule-confiture': PATE_CUISSON_CONFITURE,
    'oriental/msemen-grise-confiture': PATE_CUISSON_CONFITURE,
    'oriental/meloui-confiture': PATE_CUISSON_CONFITURE,
    // Harcha, Baghrir (avec ou sans confiture) : l'atelier fait tout (propriétaire, 20/11/2026).
    'oriental/harcha/cereales': ATELIER,
    'oriental/harcha/semoule': ATELIER,
    'oriental/harcha/grise': ATELIER,
    'oriental/baghrer': ATELIER,
    'oriental/harcha-cereales-confiture': ATELIER,
    'oriental/harcha-semoule-confiture': ATELIER,
    'oriental/harcha-grise-confiture': ATELIER,
    'oriental/baghrer-confiture': ATELIER,
    // Beignet : à l'atelier (pas au pâtissier, malgré son rayon Viennoiserie), pâte du boulanger.
    'viennoiserie/beignet': ATELIER_ET_PATE,
    // Crêpes farcies : boulanger prévenu au-delà de 5.
    'sales/crepe-facie/fromage': CREPES,
    'sales/crepe-facie/poulet': CREPES,
    'sales/crepe-facie/viande-hachee': CREPES,
    'sales/crepe-facie/legumes-fromage': CREPES,
    'sales/crepe-facie/epinards-fromage': CREPES,
    'sales/crepe-facie/poulet-epinards': CREPES,
    'sales/crepe-facie/hache-de-poulet': CREPES,
    'sur-commande/mini-cepe-farcie-classique': CREPES,
  },
};
