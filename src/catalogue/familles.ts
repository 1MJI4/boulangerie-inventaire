// src/catalogue/familles.ts
// Famille de vente de chaque produit du catalogue de COMMANDE. Propriétaire :
// `catalogue-prix`. Donnée explicite, jamais déduite du NOM du produit :
// elle vient du RAYON du fichier source (catégorie du CSV comptoir, titre de
// l'affiche sur commande), selon la table ci-dessous.
//
// Usage : `regles-metier` (LOI 11) — les commandes de PÂTISSERIE sont
// disponibles à partir de 9h en semaine / 12h le week-end. Ce module dit
// seulement QUELLE famille ; la règle horaire vit dans src/domaine/.
//
// Comparaison des rayons : clé stricte (majuscules et espaces multiples
// ignorés, accents comptés), comme pour les favoris.
//
// Rayon absent de la table (nouveau tarif) : famille « patisserie », le choix
// le plus prudent pour les horaires de retrait (règle de doute : refuser
// plutôt qu'accepter à tort), signalé dans le rapport d'import.

import { cleStricte } from "./normaliser.ts";
import type { Famille, Grille } from "./types.ts";

export interface RegleFamille {
  famille: Famille;
  /** Texte de l'hypothèse quand le classement du rayon n'est pas certain, sinon null. */
  hypothese: string | null;
}

/** Tarif comptoir : catégorie du CSV, à la lettre. « Favoris » n'est pas un rayon (LOI 4). */
const FAMILLES_COMPTOIR: ReadonlyArray<readonly [string, RegleFamille]> = [
  ["Gâteaux et tartes", { famille: "patisserie", hypothese: null }],
  [
    "Individuelle",
    {
      famille: "patisserie",
      // HYPOTHÈSE À VALIDER : rayon de pâtisseries individuelles (tartelettes, éclairs,
      // macarons…) ; il contient aussi « Boule de Berlin », « Donuts », « Croissant et
      // couque a la crème », classés pâtisserie avec le rayon.
      hypothese:
        "rayon « Individuelle » classé pâtisserie en entier (il contient aussi Boule de Berlin, Donuts, Croissant et couque a la crème)",
    },
  ],
  [
    "Special fin d'année",
    {
      famille: "patisserie",
      // HYPOTHÈSE À VALIDER : bûches, galettes des rois, cœurs = pâtisserie.
      hypothese: "rayon « Special fin d'année » (bûches, galettes, cœurs) classé pâtisserie",
    },
  ],
  [
    "Oriental",
    {
      famille: "patisserie",
      // HYPOTHÈSE À VALIDER : rayon mixte — pâtisseries orientales (corne de gazelle,
      // sellou, halwa, sablés) et galettes/pains (harcha, msemen, meloui, batbout,
      // makla). Classé pâtisserie en entier : choix le plus prudent pour les horaires.
      hypothese:
        "rayon « Oriental » mixte (corne de gazelle, sellou… mais aussi harcha, msemen, batbout, makla) classé pâtisserie en entier, choix le plus prudent",
    },
  ],
  [
    "Viennoiserie",
    {
      famille: "viennoiserie",
      // HYPOTHÈSE À VALIDER : le règlement (point 40) distingue « pâtisseries et
      // viennoiseries » ; l'horaire de retrait pâtisserie s'applique-t-il aussi ?
      hypothese: "rayon « Viennoiserie » classé viennoiserie, distinct de la pâtisserie : l'horaire de retrait pâtisserie s'applique-t-il aussi ?",
    },
  ],
  ["Boulangerie", { famille: "boulangerie", hypothese: null }],
  [
    "Salés",
    {
      famille: "sale",
      // HYPOTHÈSE À VALIDER : contient « Demi-crêpe au miel + amandes » (sucré).
      hypothese: "rayon « Salés » classé salé en entier (il contient aussi la Demi-crêpe au miel + amandes)",
    },
  ],
  ["Sandwichs Froids", { famille: "sale", hypothese: null }],
  ["Frigo-S", { famille: "sale", hypothese: null }],
  ["Frigo-Boisson", { famille: "boisson", hypothese: null }],
  ["Café", { famille: "boisson", hypothese: null }],
];

/** Tarifs sur commande : titre de l'affiche du gérant, à la lettre. */
const FAMILLES_SUR_COMMANDE: ReadonlyArray<readonly [string, RegleFamille]> = [
  // Affiche « traiteur salé » (régime B).
  ["Sur commande", { famille: "sale", hypothese: null }],
  // Affiche des gâteaux (régime C), mini-pâtisseries et suppléments compris.
  ["Tarifs (minimum) pour les Gâteaux SIMPLES sur commande", { famille: "patisserie", hypothese: null }],
];

function index(table: ReadonlyArray<readonly [string, RegleFamille]>): Map<string, RegleFamille> {
  return new Map(table.map(([rayon, regle]) => [cleStricte(rayon), regle]));
}

const PAR_GRILLE: Record<Grille, Map<string, RegleFamille>> = {
  comptoir: index(FAMILLES_COMPTOIR),
  "sur-commande": index(FAMILLES_SUR_COMMANDE),
};

/** Famille retenue quand le rayon est inconnu : la plus prudente (horaires pâtisserie). */
export const FAMILLE_PAR_DEFAUT: Famille = "patisserie";

/** Règle de la table pour ce rayon, ou null si le rayon est inconnu. */
export function regleFamille(grille: Grille, rayon: string): RegleFamille | null {
  return PAR_GRILLE[grille].get(cleStricte(rayon)) ?? null;
}

/** Famille d'un rayon ; rayon inconnu → FAMILLE_PAR_DEFAUT (à signaler par l'appelant). */
export function familleDuRayon(grille: Grille, rayon: string): Famille {
  return regleFamille(grille, rayon)?.famille ?? FAMILLE_PAR_DEFAUT;
}

// ------------------------------------------------------------ Suppléments
// Décision catalogue-prix (15/10/2026), donnée explicite, PAS une recherche
// sur le nom : un supplément est un produit dont (grille, rayon, colonne
// « produit ») figure À LA LETTRE (clé stricte) dans la table ci-dessous.
// Un supplément est vendu AU FORFAIT (`basePrix = "forfait"` : une fois par
// gâteau, règle R7 de `regles-metier`) et porte la famille « supplement » :
// il n'est jamais compté comme un gâteau ni comme une pâtisserie.
// Lignes concernées (tarif comptoir 09/2026 + affiche gâteaux 10/2026) :
//   comptoir     « Gâteaux et tartes » / « Supplément » / « Photo »     → gateaux-et-tartes/supplement/photo
//   comptoir     « Gâteaux et tartes » / « Supplément » / « Ecriture »  → gateaux-et-tartes/supplement/ecriture
//   sur-commande affiche gâteaux / « Supplément » / « Photo »           → gateaux-sur-commande/supplement-photo
//   sur-commande affiche gâteaux / « Supplément » / « Écriture simple » → gateaux-sur-commande/supplement-ecriture-simple
// NON concerné : « Supplément (oeuf) » (Sandwichs Froids) — autre libellé,
// ajout payant PAR sandwich, reste à la pièce.
// HYPOTHÈSE À VALIDER : le supplément œuf est bien un prix par sandwich (et non un forfait).
const PRODUITS_SUPPLEMENT: ReadonlyArray<{ grille: Grille; rayon: string; produit: string }> = [
  { grille: "comptoir", rayon: "Gâteaux et tartes", produit: "Supplément" },
  { grille: "sur-commande", rayon: "Tarifs (minimum) pour les Gâteaux SIMPLES sur commande", produit: "Supplément" },
];

const CLES_SUPPLEMENT = new Set(PRODUITS_SUPPLEMENT.map((s) => `${s.grille}|${cleStricte(s.rayon)}|${cleStricte(s.produit)}`));

/** true si (grille, rayon, produit) est un supplément au forfait déclaré dans PRODUITS_SUPPLEMENT. */
export function estSupplement(grille: Grille, rayon: string, produit: string): boolean {
  return CLES_SUPPLEMENT.has(`${grille}|${cleStricte(rayon)}|${cleStricte(produit)}`);
}

/** Famille d'un produit : « supplement » pour un supplément déclaré, sinon celle du rayon. */
export function familleDuProduit(grille: Grille, rayon: string, produit: string): Famille {
  return estSupplement(grille, rayon, produit) ? "supplement" : familleDuRayon(grille, rayon);
}

/** Hypothèses de classement en cours, pour le rapport et QUESTIONS-GERANT. */
export function hypothesesFamilles(): string[] {
  return [...FAMILLES_COMPTOIR, ...FAMILLES_SUR_COMMANDE].flatMap(([, r]) => (r.hypothese ? [r.hypothese] : []));
}
