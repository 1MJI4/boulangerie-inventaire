// src/catalogue/ecarts.ts
// Rapport systématique des écarts entre les affiches (B/C) et l'Excel (A).
// Les régimes restent séparés dans les données ; ce contrôle ne fusionne rien,
// il signale seulement au gérant ce qui ne concorde pas.

import { getPrix } from "./catalogue.ts";
import { centimesEnTexte, cleStricte, dateEnTexte } from "./normaliser.ts";
import type { Catalogue, DateISO, Signalement } from "./types.ts";

export function controlerAffichesContreComptoir(catalogue: Catalogue, date: DateISO): Signalement[] {
  const signalements: Signalement[] = [];
  for (const p of catalogue.produits.values()) {
    if (p.grille !== "sur-commande") continue;
    const prix = getPrix(catalogue, p.id, date);
    if (!prix.ok) continue;
    const libAffiche = `${p.produit}${p.sousCategorie ? " — " + p.sousCategorie : ""}`;
    for (const idComptoir of prix.valeur.rapprochementComptoir) {
      const comptoir = getPrix(catalogue, idComptoir, date);
      const fiche = catalogue.produits.get(idComptoir);
      if (!comptoir.ok || !fiche) {
        signalements.push({
          niveau: "avertissement",
          code: "AVERT_RAPPROCHEMENT_INTROUVABLE",
          message: `Affiche « ${libAffiche} » : le produit comptoir ${idComptoir} est introuvable au ${dateEnTexte(date)}.`,
          produitId: p.id,
        });
        continue;
      }
      const libComptoir = `${fiche.produit}${fiche.sousCategorie ? " — " + fiche.sousCategorie : ""}`;
      if (comptoir.valeur.prixCentimes !== prix.valeur.prixCentimes) {
        signalements.push({
          niveau: "avertissement",
          code: "AVERT_ECART_AFFICHE_EXCEL",
          message: `Écart de prix : affiche « ${libAffiche} » ${centimesEnTexte(prix.valeur.prixCentimes)} / Excel « ${libComptoir} » ${centimesEnTexte(comptoir.valeur.prixCentimes)}. Lequel fait foi ?`,
          produitId: p.id,
        });
      } else {
        signalements.push({
          niveau: "information",
          code: "INFO_AFFICHE_EXCEL_COHERENTS",
          message: `Affiche « ${libAffiche} » et Excel « ${libComptoir} » : même prix (${centimesEnTexte(prix.valeur.prixCentimes)}).`,
          produitId: p.id,
        });
      }
      const motsAffiche = new Set(cleStricte(libAffiche).split(/[^\p{L}\p{N}]+/u));
      const motsAbsents = cleStricte(fiche.produit)
        .split(/[^\p{L}\p{N}]+/u)
        .filter((m) => m.length > 3 && !motsAffiche.has(m));
      if (motsAbsents.length > 0) {
        signalements.push({
          niveau: "avertissement",
          code: "AVERT_LIBELLE_AFFICHE_EXCEL",
          message: `Libellés différents pour un même produit : Excel « ${fiche.produit} » / affiche « ${p.produit} ». Orthographe à trancher par le gérant (aucune correction faite).`,
          produitId: p.id,
        });
      }
    }
  }
  return signalements;
}
