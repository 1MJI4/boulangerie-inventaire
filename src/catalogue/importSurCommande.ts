// src/catalogue/importSurCommande.ts
// Import des affiches du gérant (régimes B et C) depuis
// data/tarifs-sur-commande_AAAA-MM.json. Le régime de chaque produit est LU
// dans le fichier, jamais déduit du nom (LOI 6). Tout minimum est bloquant
// (LOI 7) : un `typeMin` autre que « bloquant » refuse l'import.

import { estDateISO, slug } from "./normaliser.ts";
import type {
  BasePrix,
  DateISO,
  LignePrix,
  MaximumParUnite,
  Produit,
  RegimePrix,
  ResultatImport,
  Signalement,
} from "./types.ts";

export interface OptionsImportSurCommande {
  code: string;
  valideDu: DateISO;
  source: string;
}

const BASES: readonly BasePrix[] = ["piece", "personne", "forfait"];

function estEntierPositif(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function listeDeTextes(v: unknown): string[] | null {
  if (v === undefined) return [];
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) return null;
  return v as string[];
}

export function importerTarifsSurCommande(donnees: unknown, options: OptionsImportSurCommande): ResultatImport {
  const signalements: Signalement[] = [];
  const bloque = (code: string, message: string, produitId?: string) =>
    signalements.push({ niveau: "bloquant", code, message, produitId });

  if (!estDateISO(options.valideDu)) {
    bloque("ERR_DATE_EFFET_INVALIDE", `Date d'effet « ${options.valideDu} » invalide — format attendu AAAA-MM-JJ.`);
  }
  if (!estObjet(donnees) || !Array.isArray(donnees.affiches)) {
    bloque("ERR_FICHIER_SUR_COMMANDE", "Fichier des tarifs sur commande illisible : liste « affiches » absente.");
    return { ok: false, version: null, produits: [], signalements };
  }

  const produits: Produit[] = [];
  const lignes = new Map<string, LignePrix>();

  for (const affiche of donnees.affiches as unknown[]) {
    if (!estObjet(affiche) || typeof affiche.titre !== "string" || !Array.isArray(affiche.produits)) {
      bloque("ERR_FICHIER_SUR_COMMANDE", "Une affiche n'a pas de titre ou de liste de produits.");
      continue;
    }
    const categorie = affiche.titre;
    for (const brut of affiche.produits as unknown[]) {
      if (!estObjet(brut)) {
        bloque("ERR_FICHIER_SUR_COMMANDE", `Affiche « ${categorie} » : produit illisible.`);
        continue;
      }
      const id = brut.id;
      const nom = typeof brut.produit === "string" ? brut.produit : "";
      const ref = `« ${nom || String(id)} » (${categorie})`;
      const erreursAvant = signalements.length;
      const err = (code: string, message: string) => bloque(code, `${ref} : ${message}`, typeof id === "string" ? id : undefined);

      if (typeof id !== "string" || id.split("/").some((part) => part === "" || slug(part) !== part)) {
        err("ERR_IDENTIFIANT_INVALIDE", "identifiant absent ou mal formé (minuscules, chiffres et tirets séparés par « / »).");
      } else if (lignes.has(id)) {
        err("ERR_DOUBLON_IDENTIFIANT", "identifiant en double.");
      }
      if (nom.trim() === "") err("ERR_LIBELLE_VIDE", "libellé vide.");

      const regime = brut.regimePrix;
      if (regime !== "B" && regime !== "C") {
        err("ERR_REGIME_ABSENT", "régime de prix absent ou invalide (B ou C attendu, jamais déduit du nom).");
      }
      const basePrix = brut.basePrix as BasePrix;
      if (!BASES.includes(basePrix)) err("ERR_BASE_PRIX_INVALIDE", `base de prix « ${String(brut.basePrix)} » inconnue.`);
      if (!estEntierPositif(brut.prixCentimes)) err("ERR_PRIX_NON_NUMERIQUE", "prix absent, nul ou non entier (centimes attendus).");
      if (typeof brut.prixEstPlancher !== "boolean") err("ERR_PLANCHER_NON_PRECISE", "préciser si le prix est un plancher.");

      if (regime === "B" && brut.prixEstPlancher === true) {
        err("ERR_REGIME_INCOHERENT", "le régime B est un prix fixe, pas un plancher.");
      }
      if (regime === "C" && (basePrix === "personne" || basePrix === "piece") && brut.prixEstPlancher !== true) {
        err("ERR_REGIME_INCOHERENT", "en régime C, le prix par personne ou par mini-pièce est un plancher « à partir de ».");
      }
      if (regime === "B" && basePrix === "personne") {
        err("ERR_REGIME_INCOHERENT", "le régime B ne se vend pas par personne.");
      }

      const minQuantite = brut.minQuantite ?? null;
      const minParSymbole = brut.minParSymbole ?? null;
      if (minQuantite !== null && !estEntierPositif(minQuantite)) err("ERR_MINIMUM_INVALIDE", "minimum non entier.");
      if (minParSymbole !== null && !estEntierPositif(minParSymbole)) err("ERR_MINIMUM_INVALIDE", "minimum par symbole non entier.");
      const aUnMinimum = minQuantite !== null || minParSymbole !== null;
      const typeMin = brut.typeMin ?? null;
      if (aUnMinimum && typeMin !== "bloquant") {
        err("ERR_TYPE_MINIMUM", "tout minimum est bloquant (décision du gérant du 15/10/2026) — pas de majoration.");
      }
      if (!aUnMinimum && typeMin !== null) err("ERR_TYPE_MINIMUM", "type de minimum sans minimum.");

      let maxParUnite: MaximumParUnite | null = null;
      if (brut.maxParUnite !== undefined && brut.maxParUnite !== null) {
        const m = brut.maxParUnite;
        if (!estObjet(m) || !estEntierPositif(m.valeur) || typeof m.objet !== "string") {
          err("ERR_MAXIMUM_INVALIDE", "maximum mal décrit.");
        } else maxParUnite = { valeur: m.valeur, objet: m.objet };
      }
      const etages = brut.etages ?? null;
      if (etages !== null && !estEntierPositif(etages)) err("ERR_ETAGES_INVALIDE", "nombre d'étages invalide.");

      const variantes = listeDeTextes(brut.variantes);
      const rapprochement = listeDeTextes(brut.rapprochementComptoir);
      if (variantes === null) err("ERR_VARIANTES_INVALIDES", "variantes mal décrites.");
      if (rapprochement === null) err("ERR_RAPPROCHEMENT_INVALIDE", "rapprochement comptoir mal décrit.");
      const sousCategorie = typeof brut.sousCategorie === "string" ? brut.sousCategorie : "";

      if (signalements.length > erreursAvant) continue;

      produits.push({
        id: id as string,
        grille: "sur-commande",
        categorie,
        produit: nom,
        sousCategorie,
        regimePrix: regime as RegimePrix,
        unite: "piece", // quantités entières : pièces ou parts. Aucun produit au kilo sur commande.
        estFavori: false,
        tauxTva: null, // HYPOTHÈSE À VALIDER : TVA à confirmer par le comptable
        variantes: variantes ?? [],
        variantesFermees: brut.variantesFermees === true,
      });
      lignes.set(id as string, {
        prixCentimes: brut.prixCentimes as number,
        basePrix,
        prixEstPlancher: brut.prixEstPlancher as boolean,
        estFavori: false,
        minQuantite: minQuantite as number | null,
        minParSymbole: minParSymbole as number | null,
        typeMin: aUnMinimum ? "bloquant" : null,
        maxParUnite,
        etages: etages as number | null,
        rapprochementComptoir: rapprochement ?? [],
      });
    }
  }

  const ok = !signalements.some((s) => s.niveau === "bloquant");
  if (!ok) return { ok: false, version: null, produits: [], signalements };
  signalements.push({
    niveau: "information",
    code: "INFO_IMPORT",
    message: `${produits.length} produits sur commande lus (${produits.filter((p) => p.regimePrix === "B").length} régime B, ${produits.filter((p) => p.regimePrix === "C").length} régime C).`,
  });
  return {
    ok: true,
    version: { code: options.code, grille: "sur-commande", valideDu: options.valideDu, valideAu: null, source: options.source, lignes },
    produits,
    signalements,
  };
}
