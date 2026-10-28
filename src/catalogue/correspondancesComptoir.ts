// src/catalogue/correspondancesComptoir.ts
// R60 — Gâteaux sur commande vendus au prix du COMPTOIR dans les tailles qui
// existent au comptoir (décision du propriétaire du 18/10/2026).
// Propriétaire de la donnée : `catalogue-prix` ; règle appliquée par
// `regles-metier` (src/domaine/prixComptoir.ts).
//
// DONNÉE EXPLICITE, jamais déduite du nom (LOI 6) : clé du gâteau sur commande
// + nombre de parts (+ goût, facultatif) → clé du produit du comptoir. Aucun prix ici (LOI 1) : le
// prix est lu au catalogue (getPrix) à la date de la commande.
//
// Volontairement dans le code et non dans data/tarifs-sur-commande_*.json :
// le catalogue de production est déjà importé et ces champs ne sont pas en
// base (cf. lectureBase.ts). Aucun réimport, aucune colonne nécessaires : les
// deux produits existent déjà en base avec leurs prix versionnés.
//
// Contrôlée par `controlerCorrespondancesComptoir` : dans les tests (sur les
// fichiers du catalogue) et côté serveur à chaque commande qui touche l'un de
// ces produits (src/app/api/commandes/contexteServeur.ts).

import type { CorrespondanceComptoir } from "../domaine/prixComptoir.ts";

export type { CorrespondanceComptoir };

export const CORRESPONDANCES_COMPTOIR: readonly CorrespondanceComptoir[] = [
  // Bavarois sur commande (toutes variantes) → « Bavarois » du rayon Gâteaux et tartes.
  { surCommande: "gateaux-sur-commande/bavarois", parts: 4, comptoir: "gateaux-et-tartes/bavarois/4p" },
  { surCommande: "gateaux-sur-commande/bavarois", parts: 6, comptoir: "gateaux-et-tartes/bavarois/6p" },
  { surCommande: "gateaux-sur-commande/bavarois", parts: 8, comptoir: "gateaux-et-tartes/bavarois/8p" },
  { surCommande: "gateaux-sur-commande/bavarois", parts: 10, comptoir: "gateaux-et-tartes/bavarois/10p" },
  // Le goût choisit le Bavarois du comptoir (propriétaire, 28/10/2026 :
  // « Matadi chocolat sur commande = Matadi du comptoir, même prix »). Goûts =
  // ceux de `goutsEnTete` (goutsSurCommande.ts), à la lettre. Le comptoir ne
  // les fait qu'en 4P/6P/8P : en 10 parts, Bavarois 10P (entrée sans goût).
  // Matadi chocolat 4P : refusé à la commande par R65 (TAILLES_INTERDITES),
  // avec « Passer en Matadi chocolat 6P » — jamais vendu en Bavarois 4P.
  { surCommande: "gateaux-sur-commande/bavarois", parts: 4, gout: "Framboise", comptoir: "gateaux-et-tartes/bavarois-framboise/4p" },
  { surCommande: "gateaux-sur-commande/bavarois", parts: 6, gout: "Framboise", comptoir: "gateaux-et-tartes/bavarois-framboise/6p" },
  { surCommande: "gateaux-sur-commande/bavarois", parts: 8, gout: "Framboise", comptoir: "gateaux-et-tartes/bavarois-framboise/8p" },
  { surCommande: "gateaux-sur-commande/bavarois", parts: 4, gout: "Fruits de la passion", comptoir: "gateaux-et-tartes/bavarois-fruits-de-la-passion/4p" },
  { surCommande: "gateaux-sur-commande/bavarois", parts: 6, gout: "Fruits de la passion", comptoir: "gateaux-et-tartes/bavarois-fruits-de-la-passion/6p" },
  { surCommande: "gateaux-sur-commande/bavarois", parts: 8, gout: "Fruits de la passion", comptoir: "gateaux-et-tartes/bavarois-fruits-de-la-passion/8p" },
  { surCommande: "gateaux-sur-commande/bavarois", parts: 4, gout: "Mangue", comptoir: "gateaux-et-tartes/bavarois-mangue/4p" },
  { surCommande: "gateaux-sur-commande/bavarois", parts: 6, gout: "Mangue", comptoir: "gateaux-et-tartes/bavarois-mangue/6p" },
  { surCommande: "gateaux-sur-commande/bavarois", parts: 8, gout: "Mangue", comptoir: "gateaux-et-tartes/bavarois-mangue/8p" },
  { surCommande: "gateaux-sur-commande/bavarois", parts: 4, gout: "Fraisier", comptoir: "gateaux-et-tartes/fraisier/4p" },
  { surCommande: "gateaux-sur-commande/bavarois", parts: 6, gout: "Fraisier", comptoir: "gateaux-et-tartes/fraisier/6p" },
  { surCommande: "gateaux-sur-commande/bavarois", parts: 8, gout: "Fraisier", comptoir: "gateaux-et-tartes/fraisier/8p" },
  { surCommande: "gateaux-sur-commande/bavarois", parts: 4, gout: "Matadi chocolat", comptoir: "gateaux-et-tartes/matadi-chocolat/4p" },
  { surCommande: "gateaux-sur-commande/bavarois", parts: 6, gout: "Matadi chocolat", comptoir: "gateaux-et-tartes/matadi-chocolat/6p" },
  { surCommande: "gateaux-sur-commande/bavarois", parts: 8, gout: "Matadi chocolat", comptoir: "gateaux-et-tartes/matadi-chocolat/8p" },
  { surCommande: "gateaux-sur-commande/bavarois", parts: 4, gout: "Mousse chocolat", comptoir: "gateaux-et-tartes/mousse-chocolat/4p" },
  { surCommande: "gateaux-sur-commande/bavarois", parts: 6, gout: "Mousse chocolat", comptoir: "gateaux-et-tartes/mousse-chocolat/6p" },
  { surCommande: "gateaux-sur-commande/bavarois", parts: 8, gout: "Mousse chocolat", comptoir: "gateaux-et-tartes/mousse-chocolat/8p" },
  // Crème fraîche : pas de 4P au comptoir → 4 parts reste au prix par personne.
  { surCommande: "gateaux-sur-commande/creme-fraiche", parts: 6, comptoir: "gateaux-et-tartes/creme-fraiche/6p" },
  { surCommande: "gateaux-sur-commande/creme-fraiche", parts: 8, comptoir: "gateaux-et-tartes/creme-fraiche/8p" },
];

/** Ce que le contrôle a besoin de savoir d'un produit (catalogue en mémoire ou en base). */
export interface FicheCorrespondance {
  produit: { produit: string; regimePrix: string | null; unite: string };
  /** null = pas de prix à la date contrôlée. */
  prix: { basePrix: string } | null;
}

/** Toutes les clés citées par la table (pour ne contrôler que ce qui sert). */
export function clesCorrespondances(table: readonly CorrespondanceComptoir[]): string[] {
  return [...new Set(table.flatMap((c) => [c.surCommande, c.comptoir]))];
}

/**
 * Contrôle de la table : renvoie la liste des erreurs, en français (vide = valide).
 *  - clé sur commande inconnue, ou pas un gâteau au prix par personne (régime C) ;
 *  - clé du comptoir inconnue, ou pas un produit du comptoir (régime A) à la pièce ;
 *  - nombre de parts hors des tailles standard (`tailles`, réglage LOI 11) ;
 *  - même (gâteau, taille, goût) ou même produit du comptoir cité deux fois ;
 *  - goût vide.
 * `lire(cle)` : fiche du produit à la date contrôlée, null si inconnu.
 */
export function controlerCorrespondancesComptoir(
  table: readonly CorrespondanceComptoir[],
  lire: (cle: string) => FicheCorrespondance | null,
  tailles: readonly number[],
): string[] {
  const erreurs: string[] = [];
  const vus = new Set<string>();
  const comptoirsVus = new Set<string>();
  for (const c of table) {
    const auGout = c.gout !== undefined ? ` goût « ${c.gout} »` : "";
    const ref = `Correspondance « ${c.surCommande} » ${c.parts} parts${auGout} → « ${c.comptoir} »`;
    if (c.gout !== undefined && c.gout.trim() === "") erreurs.push(`${ref} : le goût est vide (retirez le champ pour « tout autre goût »).`);
    const sc = lire(c.surCommande);
    if (!sc) erreurs.push(`${ref} : le gâteau sur commande est inconnu du catalogue.`);
    else if (sc.produit.regimePrix !== "C" || (sc.prix && sc.prix.basePrix !== "personne")) {
      erreurs.push(`${ref} : « ${sc.produit.produit} » n’est pas un gâteau sur commande au prix par personne (régime C).`);
    }
    const co = lire(c.comptoir);
    if (!co) erreurs.push(`${ref} : le produit du comptoir est inconnu du catalogue.`);
    else if (co.produit.regimePrix !== "A" || co.produit.unite !== "piece" || (co.prix && co.prix.basePrix !== "piece")) {
      erreurs.push(`${ref} : « ${co.produit.produit} » n’est pas un produit du comptoir vendu à la pièce (régime A).`);
    } else if (!co.prix) {
      erreurs.push(`${ref} : « ${co.produit.produit} » n’a pas de prix à cette date.`);
    }
    if (!Number.isSafeInteger(c.parts) || !tailles.includes(c.parts)) {
      erreurs.push(`${ref} : ${c.parts} parts n’est pas une taille standard (${tailles.join(", ")}).`);
    }
    const cle = `${c.surCommande}|${c.parts}|${(c.gout ?? "").trim().toLocaleLowerCase("fr")}`;
    if (vus.has(cle)) erreurs.push(`${ref} : cette taille${c.gout !== undefined ? " à ce goût" : ""} est déjà associée à un produit du comptoir.`);
    if (comptoirsVus.has(c.comptoir)) erreurs.push(`${ref} : ce produit du comptoir est déjà associé à une autre taille ou à un autre goût.`);
    vus.add(cle);
    comptoirsVus.add(c.comptoir);
  }
  return erreurs;
}
