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
//   - reste du rayon Oriental (harcha, baghrir, makla, pâtisseries au kilo) au
//     pâtissier, comme dans la liste d'inventaire ;
//   - Grand pain surprise et mini-sandwichs garnis : atelier seul pour
//     l'instant (qui fait le pain ?).

import type { DonneesPostes, TachePoste } from '../domaine/postes.ts';

const PATISSIER: readonly TachePoste[] = [{ poste: 'patissier' }];
const ATELIER: readonly TachePoste[] = [{ poste: 'atelier' }];
const BOULANGER: readonly TachePoste[] = [{ poste: 'boulanger' }];
const AUCUN: readonly TachePoste[] = [];

/** L'atelier monte, le boulanger fait le pain (burgers, batbout farci). */
const ATELIER_ET_PAIN: readonly TachePoste[] = [{ poste: 'atelier' }, { poste: 'boulanger', role: 'le pain' }];
/** Msemen, Meloui : le boulanger fait la pâte, et ils sortent cuits. */
const PATE_CUITE: readonly TachePoste[] = [{ poste: 'boulanger', role: 'la pâte, cuits' }];
/** Batbout nature : c'est un pain. */
const PAIN: readonly TachePoste[] = [{ poste: 'boulanger', role: 'le pain' }];
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
    // Batbout : un pain ; farci, l'atelier le garnit.
    'oriental/petit-batbout': PAIN,
    'sales/batbout-farci': ATELIER_ET_PAIN,
    'sales/batbout-healthy': ATELIER_ET_PAIN,
    'sur-commande/mini-batbout-farci': ATELIER_ET_PAIN,
    // Msemen, Meloui : pâte du boulanger, cuits.
    'oriental/msemen/semoule': PATE_CUITE,
    'oriental/msemen/grise': PATE_CUITE,
    'oriental/meloui': PATE_CUITE,
    'oriental/msemen-semoule-confiture': PATE_CUITE,
    'oriental/msemen-grise-confiture': PATE_CUITE,
    'oriental/meloui-confiture': PATE_CUITE,
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
