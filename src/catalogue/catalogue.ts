// src/catalogue/catalogue.ts
// Catalogue versionné par date d'effet et API de lecture.
//
//   getPrix(produitId, date)  → prix en vigueur à cette date
//   getProduit(produitId)     → fiche produit (jamais supprimée)
//   listerParCategorie(date)  → rayons, favoris rangés dans leur rayon réel
//
// Un nouveau tarif n'écrase jamais l'ancien : il ferme la version précédente
// (valideAu = veille de sa date d'effet) et s'ajoute à côté.

import { signaler } from "../domaine/messages.ts";
import { succes, type Resultat } from "../domaine/resultat.ts";
import { dateEnTexte, estDateISO, veille } from "./normaliser.ts";
import { entreeRapport, libelleProduit, type CodeRapport, type ParametresRapport } from "./rapport.ts";
import type {
  Catalogue,
  DateISO,
  Grille,
  LignePrix,
  PrixEnVigueur,
  Produit,
  ProduitAuTarif,
  RayonAuTarif,
  RegimePrix,
  Signalement,
  VersionTarif,
} from "./types.ts";

export function catalogueVide(): Catalogue {
  return { produits: new Map(), versions: [] };
}

function memesLignes(a: ReadonlyMap<string, LignePrix>, b: ReadonlyMap<string, LignePrix>): boolean {
  if (a.size !== b.size) return false;
  for (const [id, la] of a) {
    const lb = b.get(id);
    if (!lb || JSON.stringify(la) !== JSON.stringify(lb)) return false;
  }
  return true;
}

export interface ResultatAjoutVersion {
  ok: boolean;
  catalogue: Catalogue;
  signalements: Signalement[];
}

/**
 * Ajoute une version de tarif. Idempotent : ré-importer exactement la même
 * version ne change rien. Retourne le catalogue d'origine en cas de blocage.
 */
export function ajouterVersion(
  catalogue: Catalogue,
  version: VersionTarif,
  produits: readonly Produit[],
): ResultatAjoutVersion {
  const signalements: Signalement[] = [];
  // Textes : catalogue unique des messages (via ./rapport.ts).
  const signale = (code: CodeRapport, params: ParametresRapport, produitId?: string) =>
    signalements.push(entreeRapport(code, params, { produitId }));
  const tarif = `Tarif ${version.code}`;
  const refus = (): ResultatAjoutVersion => ({ ok: false, catalogue, signalements });

  if (!estDateISO(version.valideDu) || (version.valideAu !== null && !estDateISO(version.valideAu))) {
    signale("ERR_DATE_EFFET_INVALIDE", { ou: tarif, precision: `du « ${version.valideDu} » au « ${version.valideAu ?? ""} »` });
    return refus();
  }

  const existante = catalogue.versions.find((v) => v.code === version.code);
  if (existante) {
    if (existante.grille === version.grille && existante.valideDu === version.valideDu && memesLignes(existante.lignes, version.lignes)) {
      signale("INFO_DEJA_IMPORTE", { ou: tarif });
      return { ok: true, catalogue, signalements };
    }
    signale("ERR_VERSION_DEJA_IMPORTEE_DIFFERENTE", { ou: tarif });
    return refus();
  }

  const memeGrille = catalogue.versions.filter((v) => v.grille === version.grille);
  const derniere = memeGrille[memeGrille.length - 1];
  if (derniere && version.valideDu <= derniere.valideDu) {
    // HYPOTHÈSE À VALIDER : un tarif rétroactif (antérieur au dernier importé)
    // est refusé — il réécrirait les prix de commandes et d'inventaires passés.
    signale("ERR_VERSION_ANTERIEURE", {
      ou: tarif,
      precision: `au ${dateEnTexte(version.valideDu)}, dernier tarif ${derniere.code} au ${dateEnTexte(derniere.valideDu)}`,
    });
    return refus();
  }
  if (derniere && derniere.valideAu !== null && derniere.valideAu >= version.valideDu) {
    signale("ERR_CHEVAUCHEMENT_TARIFS", { ou: tarif, precision: `tarif ${derniere.code}` });
    return refus();
  }

  const nouveauxProduits = new Map(catalogue.produits);
  for (const p of produits) {
    if (!version.lignes.has(p.id)) {
      signale("ERR_PRODUIT_SANS_PRIX", { ou: `${tarif}, ${libelleProduit(p)}` }, p.id);
      continue;
    }
    const ancien = catalogue.produits.get(p.id);
    if (!ancien) {
      nouveauxProduits.set(p.id, p);
      continue;
    }
    if (ancien.grille !== p.grille) {
      signale("ERR_IDENTIFIANT_DEJA_PRIS", { ou: `${tarif}, ${libelleProduit(p)}`, precision: `« ${p.id} », grille ${ancien.grille}` }, p.id);
      continue;
    }
    if (ancien.unite !== p.unite) {
      signale("ERR_CHANGEMENT_UNITE", { ou: `${tarif}, ${libelleProduit(p)}`, precision: `« ${ancien.unite} » → « ${p.unite} »` }, p.id);
      continue;
    }
    if (ancien.regimePrix !== p.regimePrix) {
      signale("ERR_CHANGEMENT_REGIME", { ou: `${tarif}, ${libelleProduit(p)}`, precision: `${ancien.regimePrix} → ${p.regimePrix}` }, p.id);
      continue;
    }
    if (ancien.produit !== p.produit || ancien.sousCategorie !== p.sousCategorie || ancien.categorie !== p.categorie) {
      signale("AVERT_LIBELLE_MODIFIE", { ou: tarif, precision: `${libelleProduit(ancien)} → ${libelleProduit(p)}` }, p.id);
    }
    nouveauxProduits.set(p.id, { ...p, tauxTva: ancien.tauxTva ?? p.tauxTva });
  }
  for (const id of version.lignes.keys()) {
    if (!nouveauxProduits.has(id)) signale("ERR_PRIX_SANS_PRODUIT", { ou: tarif, precision: `« ${id} »` }, id);
  }
  if (signalements.some((s) => s.niveau === "bloquant")) return refus();

  const versions = catalogue.versions.map((v) =>
    v === derniere && v.valideAu === null ? { ...v, valideAu: veille(version.valideDu) } : v,
  );
  versions.push(version);
  return { ok: true, catalogue: { produits: nouveauxProduits, versions }, signalements };
}

// ------------------------------------------------------------------ Lecture

// Messages : catalogue unique de `gestion-erreurs` (src/domaine/messages.ts).
// Ce module décide QUAND la lecture échoue, jamais COMMENT c'est dit.

/** Date illisible (pas au format AAAA-MM-JJ ou jour inexistant). */
export function echecDateIllisible() {
  return signaler("ERR_SAISIE_INVALIDE", { champLibelle: "date" }, { champ: "date" });
}

/** Identifiant absent du catalogue. */
export function echecProduitInconnu() {
  return signaler("ERR_PRODUIT_INCONNU", {}, { champ: "produitId" });
}

/** Aucun prix pour ce produit à cette date (aucun tarif, ou produit retiré du tarif). */
export function echecTarifAbsent(libelleProduit: string, date: DateISO, champ: "date" | "produitId") {
  return signaler("ERR_TARIF_ABSENT", { produit: libelleProduit, date: dateEnTexte(date) }, { champ });
}

/** Version d'une grille en vigueur à une date (bornes incluses), ou undefined. */
export function versionEnVigueur(catalogue: Catalogue, grille: Grille, date: DateISO): VersionTarif | undefined {
  return catalogue.versions.find(
    (v) => v.grille === grille && v.valideDu <= date && (v.valideAu === null || date <= v.valideAu),
  );
}

export function getProduit(catalogue: Catalogue, produitId: string): Resultat<Produit> {
  const p = catalogue.produits.get(produitId);
  if (!p) return echecProduitInconnu();
  return succes(p);
}

/**
 * Prix en vigueur à une date. Échecs (tous ERR_*, bloquants) :
 *   ERR_SAISIE_INVALIDE (date illisible) · ERR_PRODUIT_INCONNU ·
 *   ERR_TARIF_ABSENT (aucun tarif à cette date, ou produit retiré du tarif).
 */
export function getPrix(catalogue: Catalogue, produitId: string, date: DateISO): Resultat<PrixEnVigueur> {
  if (!estDateISO(date)) return echecDateIllisible();
  const produit = catalogue.produits.get(produitId);
  if (!produit) return echecProduitInconnu();
  const version = versionEnVigueur(catalogue, produit.grille, date);
  if (!version) return echecTarifAbsent(produit.produit, date, "date");
  const ligne = version.lignes.get(produitId);
  if (!ligne) return echecTarifAbsent(produit.produit, date, "produitId");
  return succes({ ...ligne, produitId, versionCode: version.code, valideDu: version.valideDu, valideAu: version.valideAu });
}

export interface OptionsListe {
  grille?: Grille;
  regime?: RegimePrix;
}

/**
 * Produits au tarif à une date, groupés par rayon dans l'ordre du fichier.
 * Les favoris apparaissent UNE fois, dans leur rayon réel (LOI 4) ; il n'y a
 * pas de rayon « Favoris ». Les produits absents du tarif à cette date
 * (archivés) ne sont pas listés.
 */
export function listerParCategorie(catalogue: Catalogue, date: DateISO, options: OptionsListe = {}): RayonAuTarif[] {
  const rayons = new Map<string, ProduitAuTarif[]>();
  for (const produit of catalogue.produits.values()) {
    if (options.grille && produit.grille !== options.grille) continue;
    if (options.regime && produit.regimePrix !== options.regime) continue;
    const prix = getPrix(catalogue, produit.id, date);
    if (!prix.ok) continue;
    const liste = rayons.get(produit.categorie) ?? [];
    liste.push({ produit, prix: prix.donnees });
    rayons.set(produit.categorie, liste);
  }
  return [...rayons].map(([categorie, produits]) => ({ categorie, produits }));
}

/** Liste d'accès rapide : les favoris au tarif à cette date, chacun une seule fois. */
export function listerFavoris(catalogue: Catalogue, date: DateISO): ProduitAuTarif[] {
  return listerParCategorie(catalogue, date)
    .flatMap((r) => r.produits)
    .filter((p) => p.prix.estFavori);
}

export interface ApiCatalogue {
  getPrix(produitId: string, date: DateISO): Resultat<PrixEnVigueur>;
  getProduit(produitId: string): Resultat<Produit>;
  listerParCategorie(date: DateISO, options?: OptionsListe): RayonAuTarif[];
  listerFavoris(date: DateISO): ProduitAuTarif[];
}

/** Lie l'API à un catalogue chargé : c'est la seule porte d'accès aux prix. */
export function creerApiCatalogue(catalogue: Catalogue): ApiCatalogue {
  return {
    getPrix: (id, date) => getPrix(catalogue, id, date),
    getProduit: (id) => getProduit(catalogue, id),
    listerParCategorie: (date, options) => listerParCategorie(catalogue, date, options),
    listerFavoris: (date) => listerFavoris(catalogue, date),
  };
}
