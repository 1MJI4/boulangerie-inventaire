// src/catalogue/chargerFichiers.ts
// Chargement du catalogue depuis le dossier data/ — CÔTÉ SERVEUR / SCRIPTS
// SEULEMENT (node:fs). Ne jamais importer ce fichier depuis un composant
// navigateur : utiliser l'API pure (index.ts) sur un catalogue déjà chargé.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ajouterVersion, catalogueVide } from "./catalogue.ts";
import { controlerAffichesContreComptoir } from "./ecarts.ts";
import { importerCsvComptoir } from "./importComptoir.ts";
import { importerTarifsSurCommande } from "./importSurCommande.ts";
import { estDateISO } from "./normaliser.ts";
import type { Catalogue, DateISO, Grille, ResultatImport, Signalement } from "./types.ts";

export const DOSSIER_DATA_PAR_DEFAUT = fileURLToPath(new URL("../../data/", import.meta.url));

export interface EntreeRegistre {
  grille: Grille;
  code: string;
  fichier: string;
  valideDu: DateISO;
  hypothese?: string;
}

export interface ResultatChargement {
  ok: boolean;
  catalogue: Catalogue;
  /** Rapport complet, par version, pour le gérant. */
  rapports: { code: string; signalements: Signalement[] }[];
  ecarts: Signalement[];
}

export function lireRegistre(dossier: string): EntreeRegistre[] {
  const brut = JSON.parse(readFileSync(join(dossier, "versions-tarifs.json"), "utf8")) as { versions?: unknown };
  if (!Array.isArray(brut.versions)) throw new Error("versions-tarifs.json : liste « versions » absente.");
  return brut.versions.map((v: Record<string, unknown>) => {
    if ((v.grille !== "comptoir" && v.grille !== "sur-commande") || typeof v.code !== "string" || typeof v.fichier !== "string" || !estDateISO(v.valideDu)) {
      throw new Error(`versions-tarifs.json : entrée invalide ${JSON.stringify(v)}.`);
    }
    return v as unknown as EntreeRegistre;
  });
}

export function importerEntree(dossier: string, entree: EntreeRegistre): ResultatImport {
  const contenu = readFileSync(join(dossier, entree.fichier), "utf8");
  const options = { code: entree.code, valideDu: entree.valideDu, source: entree.fichier };
  return entree.grille === "comptoir"
    ? importerCsvComptoir(contenu, options)
    : importerTarifsSurCommande(JSON.parse(contenu), options);
}

/**
 * Charge toutes les versions du registre, dans l'ordre des dates d'effet.
 * `ok` est faux si une seule version est bloquée : on ne sert pas un catalogue
 * partiellement chargé sans le dire.
 */
export function chargerCatalogueDepuisDossier(
  dossier: string = DOSSIER_DATA_PAR_DEFAUT,
  dateControleEcarts?: DateISO,
): ResultatChargement {
  const registre = [...lireRegistre(dossier)].sort((a, b) => (a.valideDu < b.valideDu ? -1 : a.valideDu > b.valideDu ? 1 : 0));
  let catalogue = catalogueVide();
  let ok = true;
  const rapports: ResultatChargement["rapports"] = [];
  for (const entree of registre) {
    const imp = importerEntree(dossier, entree);
    const signalements = [...imp.signalements];
    if (entree.hypothese) signalements.push({ niveau: "information", code: "INFO_HYPOTHESE", message: entree.hypothese });
    if (!imp.ok || !imp.version) {
      ok = false;
    } else {
      const ajout = ajouterVersion(catalogue, imp.version, imp.produits);
      signalements.push(...ajout.signalements);
      if (ajout.ok) catalogue = ajout.catalogue;
      else ok = false;
    }
    rapports.push({ code: entree.code, signalements });
  }
  const derniere = registre.length ? registre[registre.length - 1].valideDu : undefined;
  const date = dateControleEcarts ?? derniere;
  const ecarts = date ? controlerAffichesContreComptoir(catalogue, date) : [];
  return { ok, catalogue, rapports, ecarts };
}
