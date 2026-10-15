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
import { entreeRapport, ErreurImport } from "./rapport.ts";
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

const REGISTRE = "versions-tarifs.json";
const CHAMPS_REGISTRE = "champs attendus : grille (comptoir ou sur-commande), code, fichier, valideDu";

/**
 * Registre des versions de tarif. Registre inutilisable → ErreurImport, dont le
 * texte vient du catalogue des messages.
 * HYPOTHÈSE À VALIDER : faute de code dédié au registre, une entrée mal formée
 * est signalée en ERR_ENTETE_CSV (« champs attendus ») — code
 * ERR_REGISTRE_TARIFS demandé à `gestion-erreurs`.
 */
export function lireRegistre(dossier: string): EntreeRegistre[] {
  const brut = JSON.parse(readFileSync(join(dossier, REGISTRE), "utf8")) as { versions?: unknown };
  if (!Array.isArray(brut.versions)) {
    throw new ErreurImport(entreeRapport("ERR_ENTETE_CSV", { ou: REGISTRE, precision: "liste « versions » absente" }));
  }
  return brut.versions.map((v: Record<string, unknown>, i: number) => {
    const ou = `${REGISTRE}, entrée ${i + 1}`;
    if ((v.grille !== "comptoir" && v.grille !== "sur-commande") || typeof v.code !== "string" || typeof v.fichier !== "string") {
      throw new ErreurImport(entreeRapport("ERR_ENTETE_CSV", { ou, precision: CHAMPS_REGISTRE }));
    }
    if (!estDateISO(v.valideDu)) {
      throw new ErreurImport(entreeRapport("ERR_DATE_EFFET_INVALIDE", { ou: `${ou} (${v.code})`, precision: `« ${String(v.valideDu)} »` }));
    }
    return v as unknown as EntreeRegistre;
  });
}

/** Texte de l'hypothèse du registre, sans le préfixe déjà porté par le message. */
function texteHypothese(h: string): string {
  return h.replace(/^\s*HYPOTHÈSE À VALIDER\s*:\s*/i, "").replace(/\.\s*$/, "");
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
    if (entree.hypothese) {
      signalements.push(entreeRapport("INFO_HYPOTHESE", { ou: `Tarif ${entree.code}`, precision: texteHypothese(entree.hypothese) }));
    }
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
