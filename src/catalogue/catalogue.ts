// src/catalogue/catalogue.ts
// Catalogue versionné par date d'effet et API de lecture.
//
//   getPrix(produitId, date)  → prix en vigueur à cette date
//   getProduit(produitId)     → fiche produit (jamais supprimée)
//   listerParCategorie(date)  → rayons, favoris rangés dans leur rayon réel
//
// Un nouveau tarif n'écrase jamais l'ancien : il ferme la version précédente
// (valideAu = veille de sa date d'effet) et s'ajoute à côté.

import { dateEnTexte, estDateISO, veille } from "./normaliser.ts";
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
  ResultatCatalogue,
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
  const bloque = (code: string, message: string, produitId?: string) =>
    signalements.push({ niveau: "bloquant", code, message, produitId });
  const refus = (): ResultatAjoutVersion => ({ ok: false, catalogue, signalements });

  if (!estDateISO(version.valideDu) || (version.valideAu !== null && !estDateISO(version.valideAu))) {
    bloque("ERR_DATE_EFFET_INVALIDE", `Version ${version.code} : dates d'effet invalides.`);
    return refus();
  }

  const existante = catalogue.versions.find((v) => v.code === version.code);
  if (existante) {
    if (existante.grille === version.grille && existante.valideDu === version.valideDu && memesLignes(existante.lignes, version.lignes)) {
      signalements.push({
        niveau: "information",
        code: "INFO_DEJA_IMPORTE",
        message: `Le tarif ${version.code} est déjà importé à l'identique : rien n'a changé.`,
      });
      return { ok: true, catalogue, signalements };
    }
    bloque(
      "ERR_VERSION_DEJA_IMPORTEE_DIFFERENTE",
      `Un tarif ${version.code} existe déjà avec un contenu différent. Un tarif importé ne se modifie pas : créer une nouvelle version datée.`,
    );
    return refus();
  }

  const memeGrille = catalogue.versions.filter((v) => v.grille === version.grille);
  const derniere = memeGrille[memeGrille.length - 1];
  if (derniere && version.valideDu <= derniere.valideDu) {
    // HYPOTHÈSE À VALIDER : un tarif rétroactif (antérieur au dernier importé)
    // est refusé — il réécrirait les prix de commandes et d'inventaires passés.
    bloque(
      "ERR_VERSION_ANTERIEURE",
      `Le tarif ${version.code} (au ${dateEnTexte(version.valideDu)}) n'est pas postérieur au tarif ${derniere.code} (au ${dateEnTexte(derniere.valideDu)}).`,
    );
    return refus();
  }
  if (derniere && derniere.valideAu !== null && derniere.valideAu >= version.valideDu) {
    bloque("ERR_CHEVAUCHEMENT_TARIFS", `Le tarif ${version.code} chevauche le tarif ${derniere.code}.`);
    return refus();
  }

  const nouveauxProduits = new Map(catalogue.produits);
  for (const p of produits) {
    if (!version.lignes.has(p.id)) {
      bloque("ERR_PRODUIT_SANS_PRIX", `« ${p.produit} » est fourni sans prix dans ${version.code}.`, p.id);
      continue;
    }
    const ancien = catalogue.produits.get(p.id);
    if (!ancien) {
      nouveauxProduits.set(p.id, p);
      continue;
    }
    if (ancien.grille !== p.grille) {
      bloque("ERR_IDENTIFIANT_DEJA_PRIS", `L'identifiant ${p.id} appartient déjà à la grille ${ancien.grille}.`, p.id);
      continue;
    }
    if (ancien.unite !== p.unite) {
      bloque(
        "ERR_CHANGEMENT_UNITE",
        `« ${p.produit} » passe de « ${ancien.unite} » à « ${p.unite} ». Un changement d'unité fausserait tous les comptages passés : à confirmer avec le gérant.`,
        p.id,
      );
      continue;
    }
    if (ancien.regimePrix !== p.regimePrix) {
      bloque("ERR_CHANGEMENT_REGIME", `« ${p.produit} » change de régime de prix (${ancien.regimePrix} → ${p.regimePrix}).`, p.id);
      continue;
    }
    if (ancien.produit !== p.produit || ancien.sousCategorie !== p.sousCategorie || ancien.categorie !== p.categorie) {
      signalements.push({
        niveau: "avertissement",
        code: "AVERT_LIBELLE_MODIFIE",
        message: `Libellé modifié : « ${ancien.produit} ${ancien.sousCategorie} » → « ${p.produit} ${p.sousCategorie} ». Même produit, historique conservé.`,
        produitId: p.id,
      });
    }
    nouveauxProduits.set(p.id, { ...p, tauxTva: ancien.tauxTva ?? p.tauxTva });
  }
  for (const id of version.lignes.keys()) {
    if (!nouveauxProduits.has(id)) bloque("ERR_PRIX_SANS_PRODUIT", `Prix sans fiche produit : ${id}.`, id);
  }
  if (signalements.some((s) => s.niveau === "bloquant")) return refus();

  const versions = catalogue.versions.map((v) =>
    v === derniere && v.valideAu === null ? { ...v, valideAu: veille(version.valideDu) } : v,
  );
  versions.push(version);
  return { ok: true, catalogue: { produits: nouveauxProduits, versions }, signalements };
}

// ------------------------------------------------------------------ Lecture

function erreur<T>(code: string, message: string, champ?: string): ResultatCatalogue<T> {
  return { ok: false, niveau: "bloquant", code, message, champ };
}

/** Version d'une grille en vigueur à une date (bornes incluses), ou undefined. */
export function versionEnVigueur(catalogue: Catalogue, grille: Grille, date: DateISO): VersionTarif | undefined {
  return catalogue.versions.find(
    (v) => v.grille === grille && v.valideDu <= date && (v.valideAu === null || date <= v.valideAu),
  );
}

export function getProduit(catalogue: Catalogue, produitId: string): ResultatCatalogue<Produit> {
  const p = catalogue.produits.get(produitId);
  if (!p) {
    return erreur("ERR_PRODUIT_INCONNU", "Ce produit est introuvable dans le catalogue — choisissez-le dans la liste ou prévenez le gérant.", "produitId");
  }
  return { ok: true, valeur: p };
}

export function getPrix(catalogue: Catalogue, produitId: string, date: DateISO): ResultatCatalogue<PrixEnVigueur> {
  if (!estDateISO(date)) {
    return erreur("ERR_DATE_INVALIDE", "Date illisible — choisissez la date dans le calendrier.", "date");
  }
  const produit = catalogue.produits.get(produitId);
  if (!produit) {
    return erreur("ERR_PRODUIT_INCONNU", "Ce produit est introuvable dans le catalogue — choisissez-le dans la liste ou prévenez le gérant.", "produitId");
  }
  const version = versionEnVigueur(catalogue, produit.grille, date);
  if (!version) {
    return erreur(
      "ERR_AUCUN_TARIF_A_CETTE_DATE",
      `Aucun tarif en vigueur le ${dateEnTexte(date)} — prévenez le gérant avant de continuer.`,
      "date",
    );
  }
  const ligne = version.lignes.get(produitId);
  if (!ligne) {
    return erreur(
      "ERR_PRODUIT_ABSENT_DU_TARIF",
      `« ${produit.produit} » ne figure pas au tarif du ${dateEnTexte(date)} — choisissez un autre produit ou prévenez le gérant.`,
      "produitId",
    );
  }
  return {
    ok: true,
    valeur: { ...ligne, produitId, versionCode: version.code, valideDu: version.valideDu, valideAu: version.valideAu },
  };
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
    liste.push({ produit, prix: prix.valeur });
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
  getPrix(produitId: string, date: DateISO): ResultatCatalogue<PrixEnVigueur>;
  getProduit(produitId: string): ResultatCatalogue<Produit>;
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
