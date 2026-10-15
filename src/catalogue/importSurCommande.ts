// src/catalogue/importSurCommande.ts
// Import des affiches du gérant (régimes B et C) depuis
// data/tarifs-sur-commande_AAAA-MM.json. Le régime de chaque produit est LU
// dans le fichier, jamais déduit du nom (LOI 6). Tout minimum est bloquant
// (LOI 7) : un `typeMin` autre que « bloquant » refuse l'import.
// La famille (pâtisserie / salé) vient du TITRE de l'affiche, via ./familles.ts.
// Textes du rapport : catalogue unique des messages, via ./rapport.ts.

import { FAMILLE_PAR_DEFAUT, estSupplement, regleFamille } from "./familles.ts";
import { estDateISO, slug } from "./normaliser.ts";
import { entreeRapport, type CodeRapport } from "./rapport.ts";
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
  const signale = (code: CodeRapport, ou: string, precision?: string, produitId?: string) =>
    signalements.push(entreeRapport(code, { ou, precision }, { produitId }));

  if (!estDateISO(options.valideDu)) {
    signale("ERR_DATE_EFFET_INVALIDE", `Tarif ${options.code}`, `« ${options.valideDu} »`);
  }
  if (!estObjet(donnees) || !Array.isArray(donnees.affiches)) {
    signale("ERR_FICHIER_SUR_COMMANDE", options.source, "liste « affiches » absente");
    return { ok: false, version: null, produits: [], signalements };
  }

  const produits: Produit[] = [];
  const lignes = new Map<string, LignePrix>();

  for (const affiche of donnees.affiches as unknown[]) {
    if (!estObjet(affiche) || typeof affiche.titre !== "string" || !Array.isArray(affiche.produits)) {
      signale("ERR_FICHIER_SUR_COMMANDE", options.source, "affiche sans titre ou sans liste de produits");
      continue;
    }
    const categorie = affiche.titre;
    const regle = regleFamille("sur-commande", categorie);
    if (!regle) {
      // HYPOTHÈSE À VALIDER : affiche inconnue classée pâtisserie (horaires de retrait les plus stricts).
      signale("INFO_HYPOTHESE", `Affiche « ${categorie} »`, `affiche inconnue, classée « ${FAMILLE_PAR_DEFAUT} »`);
    } else if (regle.hypothese) {
      signale("INFO_HYPOTHESE", `Affiche « ${categorie} »`, regle.hypothese);
    }
    const famille = regle?.famille ?? FAMILLE_PAR_DEFAUT;
    for (const brut of affiche.produits as unknown[]) {
      if (!estObjet(brut)) {
        signale("ERR_FICHIER_SUR_COMMANDE", `Affiche « ${categorie} »`, "produit illisible");
        continue;
      }
      const id = brut.id;
      const nom = typeof brut.produit === "string" ? brut.produit : "";
      const ref = `« ${nom || String(id)} » (${categorie})`;
      const erreursAvant = signalements.length;
      const err = (code: CodeRapport, precision?: string) => signale(code, ref, precision, typeof id === "string" ? id : undefined);

      if (typeof id !== "string" || id.split("/").some((part) => part === "" || slug(part) !== part)) {
        err("ERR_IDENTIFIANT_INVALIDE", typeof id === "string" ? `« ${id} »` : undefined);
      } else if (lignes.has(id)) {
        err("ERR_DOUBLON_IDENTIFIANT", `« ${id} »`);
      }
      if (nom.trim() === "") err("ERR_LIBELLE_VIDE");

      const regime = brut.regimePrix;
      if (regime !== "B" && regime !== "C") {
        err("ERR_REGIME_ABSENT", "B ou C attendu");
      }
      const basePrix = brut.basePrix as BasePrix;
      if (!BASES.includes(basePrix)) err("ERR_BASE_PRIX_INVALIDE", `« ${String(brut.basePrix)} »`);
      if (!estEntierPositif(brut.prixCentimes)) err("ERR_PRIX_NON_NUMERIQUE", "entier en centimes attendu");
      if (typeof brut.prixEstPlancher !== "boolean") err("ERR_PLANCHER_NON_PRECISE");

      if (regime === "B" && brut.prixEstPlancher === true) {
        err("ERR_REGIME_INCOHERENT", "le régime B est un prix fixe, pas un plancher");
      }
      if (regime === "C" && (basePrix === "personne" || basePrix === "piece") && brut.prixEstPlancher !== true) {
        err("ERR_REGIME_INCOHERENT", "en régime C, le prix par personne ou par mini-pièce est un plancher « à partir de »");
      }
      if (regime === "B" && basePrix === "personne") {
        err("ERR_REGIME_INCOHERENT", "le régime B ne se vend pas par personne");
      }
      // Supplément = liste explicite de familles.ts, et lui seul est au forfait (relu
      // tel quel depuis la base : la famille y est reconstruite par le nom).
      const supplement = estSupplement("sur-commande", categorie, nom);
      if (supplement && basePrix !== "forfait") {
        err("ERR_REGIME_INCOHERENT", "un supplément se compte au forfait, une fois par gâteau");
      }
      if (!supplement && basePrix === "forfait") {
        err("ERR_REGIME_INCOHERENT", "prix au forfait réservé aux suppléments déclarés dans le catalogue");
      }

      const minQuantite = brut.minQuantite ?? null;
      const minParSymbole = brut.minParSymbole ?? null;
      if (minQuantite !== null && !estEntierPositif(minQuantite)) err("ERR_MINIMUM_INVALIDE", "minimum");
      if (minParSymbole !== null && !estEntierPositif(minParSymbole)) err("ERR_MINIMUM_INVALIDE", "minimum par symbole");
      const aUnMinimum = minQuantite !== null || minParSymbole !== null;
      const typeMin = brut.typeMin ?? null;
      if (aUnMinimum && typeMin !== "bloquant") {
        err("ERR_TYPE_MINIMUM", `« ${String(typeMin)} »`);
      }
      if (!aUnMinimum && typeMin !== null) err("ERR_TYPE_MINIMUM", "type de minimum sans minimum");

      let maxParUnite: MaximumParUnite | null = null;
      if (brut.maxParUnite !== undefined && brut.maxParUnite !== null) {
        const m = brut.maxParUnite;
        if (!estObjet(m) || !estEntierPositif(m.valeur) || typeof m.objet !== "string") {
          err("ERR_MAXIMUM_INVALIDE");
        } else maxParUnite = { valeur: m.valeur, objet: m.objet };
      }
      const etages = brut.etages ?? null;
      if (etages !== null && !estEntierPositif(etages)) err("ERR_ETAGES_INVALIDE");

      const variantes = listeDeTextes(brut.variantes);
      const rapprochement = listeDeTextes(brut.rapprochementComptoir);
      if (variantes === null) err("ERR_VARIANTES_INVALIDES");
      if (rapprochement === null) err("ERR_RAPPROCHEMENT_INVALIDE");
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
        famille: supplement ? "supplement" : famille,
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
  signale(
    "INFO_IMPORT",
    `Tarif ${options.code}`,
    `${produits.length} produits sur commande lus, ${produits.filter((p) => p.regimePrix === "B").length} en régime B, ${produits.filter((p) => p.regimePrix === "C").length} en régime C`,
  );
  return {
    ok: true,
    version: { code: options.code, grille: "sur-commande", valideDu: options.valideDu, valideAu: null, source: options.source, lignes },
    produits,
    signalements,
  };
}
