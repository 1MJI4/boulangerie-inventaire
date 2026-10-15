// src/catalogue/ecarts.ts
// Rapport systématique des écarts entre les affiches (B/C) et l'Excel (A).
// Les régimes restent séparés dans les données ; ce contrôle ne fusionne rien,
// il signale seulement au gérant ce qui ne concorde pas.
// Textes : catalogue unique des messages, via ./rapport.ts.

import { getPrix } from "./catalogue.ts";
import { centimesEnTexte, cleStricte, dateEnTexte } from "./normaliser.ts";
import { entreeRapport } from "./rapport.ts";
import type { Catalogue, DateISO, Signalement } from "./types.ts";

export function controlerAffichesContreComptoir(catalogue: Catalogue, date: DateISO): Signalement[] {
  const signalements: Signalement[] = [];
  for (const p of catalogue.produits.values()) {
    if (p.grille !== "sur-commande") continue;
    const prix = getPrix(catalogue, p.id, date);
    if (!prix.ok) continue;
    const libAffiche = `${p.produit}${p.sousCategorie ? " — " + p.sousCategorie : ""}`;
    const ou = `Affiche « ${libAffiche} »`;
    for (const idComptoir of prix.donnees.rapprochementComptoir) {
      const comptoir = getPrix(catalogue, idComptoir, date);
      const fiche = catalogue.produits.get(idComptoir);
      if (!comptoir.ok || !fiche) {
        signalements.push(
          entreeRapport("AVERT_RAPPROCHEMENT_INTROUVABLE", { ou, precision: `« ${idComptoir} » au ${dateEnTexte(date)}` }, { produitId: p.id }),
        );
        continue;
      }
      const libComptoir = `${fiche.produit}${fiche.sousCategorie ? " — " + fiche.sousCategorie : ""}`;
      const precisionPrix =
        `affiche ${centimesEnTexte(prix.donnees.prixCentimes)}, ` +
        `tarif comptoir « ${libComptoir} » ${centimesEnTexte(comptoir.donnees.prixCentimes)}`;
      if (comptoir.donnees.prixCentimes !== prix.donnees.prixCentimes) {
        signalements.push(entreeRapport("AVERT_ECART_AFFICHE_EXCEL", { ou, precision: precisionPrix }, { produitId: p.id }));
      } else {
        signalements.push(entreeRapport("INFO_AFFICHE_EXCEL_COHERENTS", { ou, precision: precisionPrix }, { produitId: p.id }));
      }
      const motsAffiche = new Set(cleStricte(libAffiche).split(/[^\p{L}\p{N}]+/u));
      const motsAbsents = cleStricte(fiche.produit)
        .split(/[^\p{L}\p{N}]+/u)
        .filter((m) => m.length > 3 && !motsAffiche.has(m));
      if (motsAbsents.length > 0) {
        signalements.push(
          entreeRapport(
            "AVERT_LIBELLE_AFFICHE_EXCEL",
            { ou, precision: `tarif comptoir « ${fiche.produit} », affiche « ${p.produit} »` },
            { produitId: p.id },
          ),
        );
      }
    }
  }
  return signalements;
}
