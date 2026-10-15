// src/catalogue/importComptoir.ts
// Import du tarif comptoir (régime A) depuis le CSV du gérant.
//
// - Seule la colonne `prix_cents` fait foi ; `prix_ttc_eur` sert uniquement de
//   contrôle de cohérence (lu comme texte, jamais comme flottant).
// - Les lignes « Favoris » ne créent AUCUN produit : elles positionnent
//   `estFavori` sur leur jumeau. Un favori sans jumeau, ambigu ou au prix
//   différent bloque l'import (jamais de fusion silencieuse).
// - Le régime « A » vient de la SOURCE (grille comptoir), pas du libellé.

import { analyserCsv } from "./csv.ts";
import {
  CATEGORIE_FAVORIS,
  COLONNES_CSV,
  PRODUITS_AU_KG_ATTENDUS,
  SEUIL_ALERTE_KG_BAS_CENTS,
  SEUIL_ALERTE_PIECE_HAUT_CENTS,
} from "./controles.ts";
import {
  aDesEspacesSuspects,
  centimesEnTexte,
  cleStricte,
  contientInvisibles,
  estDateISO,
  eurosTexteEnCentimes,
  identifiantProduit,
  lireCentimes,
  slug,
} from "./normaliser.ts";
import type {
  DateISO,
  LignePrix,
  Produit,
  ResultatImport,
  Signalement,
  Unite,
} from "./types.ts";

export interface OptionsImportComptoir {
  /** ex. « tarif_2026-09 » */
  code: string;
  valideDu: DateISO;
  /** Nom du fichier, pour la traçabilité. */
  source: string;
}

interface LigneLue {
  ligne: number;
  categorie: string;
  produit: string;
  sousCategorie: string;
  prixCentimes: number;
  unite: Unite;
  estFavori: boolean;
}

function libelleLigne(l: { categorie: string; produit: string; sousCategorie: string }): string {
  return `« ${l.produit}${l.sousCategorie ? " — " + l.sousCategorie : ""} » (${l.categorie})`;
}

export function importerCsvComptoir(texte: string, options: OptionsImportComptoir): ResultatImport {
  const signalements: Signalement[] = [];
  const bloque = (code: string, message: string, ligne?: number, produitId?: string) =>
    signalements.push({ niveau: "bloquant", code, message, ligne, produitId });
  const avertit = (code: string, message: string, ligne?: number, produitId?: string) =>
    signalements.push({ niveau: "avertissement", code, message, ligne, produitId });
  const informe = (code: string, message: string, ligne?: number, produitId?: string) =>
    signalements.push({ niveau: "information", code, message, ligne, produitId });

  const echec = (): ResultatImport => ({ ok: false, version: null, produits: [], signalements });

  if (!estDateISO(options.valideDu)) {
    bloque("ERR_DATE_EFFET_INVALIDE", `Date d'effet « ${options.valideDu} » invalide — format attendu AAAA-MM-JJ.`);
    return echec();
  }

  const enregistrements = analyserCsv(texte);
  const [entete, ...corps] = enregistrements;
  if (!entete || entete.champs.join(",") !== COLONNES_CSV.join(",")) {
    bloque(
      "ERR_ENTETE_CSV",
      `En-tête du fichier inattendu. Colonnes attendues : ${COLONNES_CSV.join(", ")}.`,
      1,
    );
    return echec();
  }

  // ---------------------------------------------------------- 1. lecture
  const lues: LigneLue[] = [];
  for (const { ligne, champs } of corps) {
    if (champs.length !== COLONNES_CSV.length) {
      bloque("ERR_LIGNE_MALFORMEE", `Ligne ${ligne} : ${champs.length} colonnes au lieu de ${COLONNES_CSV.length}.`, ligne);
      continue;
    }
    const [categorie, produit, sousCategorie, prixEur, prixCentsTexte, uniteTexte, favoriTexte] = champs;
    const lib = libelleLigne({ categorie, produit, sousCategorie });
    let valide = true;

    if (slug(produit) === "" || slug(categorie) === "") {
      bloque("ERR_LIBELLE_VIDE", `Ligne ${ligne} : produit ou catégorie vide.`, ligne);
      valide = false;
    }

    let prixCentimes: number | null = null;
    if (prixCentsTexte.trim() === "") {
      bloque("ERR_PRIX_VIDE", `Ligne ${ligne} ${lib} : prix vide.`, ligne);
      valide = false;
    } else {
      prixCentimes = lireCentimes(prixCentsTexte);
      if (prixCentimes === null) {
        bloque("ERR_PRIX_NON_NUMERIQUE", `Ligne ${ligne} ${lib} : prix « ${prixCentsTexte} » illisible.`, ligne);
        valide = false;
      } else if (prixCentimes <= 0) {
        bloque("ERR_PRIX_NUL_OU_NEGATIF", `Ligne ${ligne} ${lib} : prix nul.`, ligne);
        valide = false;
      } else {
        const controle = eurosTexteEnCentimes(prixEur);
        if (controle !== prixCentimes) {
          bloque(
            "ERR_PRIX_INCOHERENT",
            `Ligne ${ligne} ${lib} : prix en euros « ${prixEur} » et prix en centimes « ${prixCentsTexte} » ne concordent pas.`,
            ligne,
          );
          valide = false;
        }
      }
    }

    if (uniteTexte !== "piece" && uniteTexte !== "kg") {
      bloque("ERR_UNITE_INCONNUE", `Ligne ${ligne} ${lib} : unité « ${uniteTexte} » inconnue (piece ou kg).`, ligne);
      valide = false;
    }
    if (favoriTexte !== "oui" && favoriTexte !== "non") {
      bloque("ERR_FAVORI_ILLISIBLE", `Ligne ${ligne} ${lib} : est_favori « ${favoriTexte} » (oui ou non).`, ligne);
      valide = false;
    }
    const estLigneFavoris = categorie === CATEGORIE_FAVORIS;
    if ((favoriTexte === "oui") !== estLigneFavoris) {
      bloque(
        "ERR_FAVORI_INCOHERENT",
        `Ligne ${ligne} ${lib} : est_favori=${favoriTexte} incohérent avec la catégorie.`,
        ligne,
      );
      valide = false;
    }

    // LOI 5 : on ne corrige pas, on signale.
    for (const champ of [categorie, produit, sousCategorie]) {
      if (contientInvisibles(champ)) {
        avertit(
          "AVERT_CARACTERE_INVISIBLE",
          `Ligne ${ligne} ${lib} : le libellé contient des caractères invisibles (copier-coller ?). Conservé tel quel.`,
          ligne,
        );
      }
      if (aDesEspacesSuspects(champ)) {
        informe("INFO_ESPACES_LIBELLE", `Ligne ${ligne} ${lib} : espaces en trop dans « ${champ} ». Conservé tel quel.`, ligne);
      }
    }

    if (valide && prixCentimes !== null) {
      lues.push({
        ligne,
        categorie,
        produit,
        sousCategorie,
        prixCentimes,
        unite: uniteTexte as Unite,
        estFavori: estLigneFavoris,
      });
    }
  }

  // ---------------------------------------------------------- 2. produits
  const produits = new Map<string, Produit>();
  const lignes = new Map<string, LignePrix>();
  const ligneSource = new Map<string, LigneLue>();
  const reels = lues.filter((l) => !l.estFavori);
  const favoris = lues.filter((l) => l.estFavori);

  for (const l of reels) {
    const id = identifiantProduit(l.categorie, l.produit, l.sousCategorie);
    const deja = ligneSource.get(id);
    if (deja) {
      bloque(
        "ERR_DOUBLON_IDENTIFIANT",
        `Ligne ${l.ligne} ${libelleLigne(l)} : même produit que la ligne ${deja.ligne}. Un produit ne peut figurer qu'une fois par tarif.`,
        l.ligne,
        id,
      );
      continue;
    }
    ligneSource.set(id, l);
    produits.set(id, {
      id,
      grille: "comptoir",
      categorie: l.categorie,
      produit: l.produit,
      sousCategorie: l.sousCategorie,
      regimePrix: "A",
      unite: l.unite,
      estFavori: false,
      tauxTva: null, // HYPOTHÈSE À VALIDER : TVA 6 % / 12 % à confirmer par le comptable
      variantes: [],
      variantesFermees: false,
    });
    lignes.set(id, {
      prixCentimes: l.prixCentimes,
      basePrix: l.unite,
      prixEstPlancher: false,
      estFavori: false,
      minQuantite: null,
      minParSymbole: null,
      typeMin: null,
      maxParUnite: null,
      etages: null,
      rapprochementComptoir: [],
    });
  }

  // ---------------------------------------------------------- 3. unités (LOI 2)
  const attendus = new Set(PRODUITS_AU_KG_ATTENDUS.map((p) => cleStricte(p.categorie) + "|" + cleStricte(p.produit)));
  const trouvesKg = new Set<string>();
  for (const [id, l] of ligneSource) {
    const cle = cleStricte(l.categorie) + "|" + cleStricte(l.produit);
    const attenduKg = attendus.has(cle);
    if (attenduKg) trouvesKg.add(cle);
    if (attenduKg && l.unite !== "kg") {
      bloque(
        "ERR_PRODUIT_KG_A_LA_PIECE",
        `Ligne ${l.ligne} ${libelleLigne(l)} : ce produit se vend au kilo, le fichier indique « ${l.unite} ».`,
        l.ligne,
        id,
      );
    } else if (!attenduKg && l.unite === "kg") {
      // HYPOTHÈSE À VALIDER : un 5e produit au kilo bloque l'import tant que la
      // liste des produits au poids (LOI 2) n'a pas été confirmée par le gérant.
      bloque(
        "ERR_PRODUIT_KG_INATTENDU",
        `Ligne ${l.ligne} ${libelleLigne(l)} : vendu au kilo, mais absent de la liste des 4 produits au poids. À confirmer avec le gérant.`,
        l.ligne,
        id,
      );
    }
    if (l.unite === "kg" && l.prixCentimes < SEUIL_ALERTE_KG_BAS_CENTS) {
      avertit("AVERT_PRIX_A_CONFIRMER", `Ligne ${l.ligne} ${libelleLigne(l)} : ${centimesEnTexte(l.prixCentimes)}/kg paraît bas.`, l.ligne, id);
    }
    if (l.unite === "piece" && l.prixCentimes > SEUIL_ALERTE_PIECE_HAUT_CENTS) {
      avertit("AVERT_PRIX_A_CONFIRMER", `Ligne ${l.ligne} ${libelleLigne(l)} : ${centimesEnTexte(l.prixCentimes)} la pièce, à confirmer.`, l.ligne, id);
    }
  }
  for (const p of PRODUITS_AU_KG_ATTENDUS) {
    if (!trouvesKg.has(cleStricte(p.categorie) + "|" + cleStricte(p.produit))) {
      avertit("AVERT_PRODUIT_KG_ABSENT", `« ${p.produit} » (${p.categorie}), vendu au kilo, est absent de ce tarif.`);
    }
  }

  // ---------------------------------------------------------- 4. favoris (LOI 4)
  const parCleStricte = new Map<string, string[]>();
  const parSlug = new Map<string, string[]>();
  for (const [id, l] of ligneSource) {
    const cs = cleStricte(l.produit) + "|" + cleStricte(l.sousCategorie);
    const sl = slug(l.produit) + "|" + slug(l.sousCategorie);
    parCleStricte.set(cs, [...(parCleStricte.get(cs) ?? []), id]);
    parSlug.set(sl, [...(parSlug.get(sl) ?? []), id]);
  }
  const favorisPoses = new Map<string, number>();
  for (const f of favoris) {
    const jumeaux = parCleStricte.get(cleStricte(f.produit) + "|" + cleStricte(f.sousCategorie)) ?? [];
    if (jumeaux.length === 0) {
      const approches = parSlug.get(slug(f.produit) + "|" + slug(f.sousCategorie)) ?? [];
      if (approches.length > 0) {
        bloque(
          "ERR_FAVORI_JUMEAU_APPROXIMATIF",
          `Ligne ${f.ligne} favori ${libelleLigne(f)} : ressemble à ${approches.map((id) => libelleLigne(ligneSource.get(id)!)).join(", ")} mais l'orthographe diffère. Corriger le fichier pour que les deux lignes soient identiques.`,
          f.ligne,
        );
      } else {
        bloque(
          "ERR_FAVORI_SANS_JUMEAU",
          `Ligne ${f.ligne} favori ${libelleLigne(f)} : aucun produit correspondant dans un rayon. Un favori doit pointer vers un produit existant.`,
          f.ligne,
        );
      }
      continue;
    }
    if (jumeaux.length > 1) {
      bloque(
        "ERR_FAVORI_AMBIGU",
        `Ligne ${f.ligne} favori ${libelleLigne(f)} : correspond à plusieurs produits (${jumeaux.map((id) => libelleLigne(ligneSource.get(id)!)).join(", ")}). Préciser lequel.`,
        f.ligne,
      );
      continue;
    }
    const id = jumeaux[0];
    const jumeau = ligneSource.get(id)!;
    if (jumeau.prixCentimes !== f.prixCentimes || jumeau.unite !== f.unite) {
      bloque(
        "ERR_FAVORI_PRIX_DIFFERENT",
        `Ligne ${f.ligne} favori ${libelleLigne(f)} : ${centimesEnTexte(f.prixCentimes)} (${f.unite}) alors que le produit ligne ${jumeau.ligne} est à ${centimesEnTexte(jumeau.prixCentimes)} (${jumeau.unite}). Quel est le bon prix ?`,
        f.ligne,
        id,
      );
      continue;
    }
    const dejaLigne = favorisPoses.get(id);
    if (dejaLigne !== undefined) {
      avertit(
        "AVERT_FAVORI_EN_DOUBLE",
        `Ligne ${f.ligne} favori ${libelleLigne(f)} : déjà marqué favori ligne ${dejaLigne}. Compté une seule fois.`,
        f.ligne,
        id,
      );
      continue;
    }
    favorisPoses.set(id, f.ligne);
    produits.set(id, { ...produits.get(id)!, estFavori: true });
    lignes.set(id, { ...lignes.get(id)!, estFavori: true });
  }
  informe(
    "INFO_FAVORIS",
    `${favoris.length} lignes « Favoris » rattachées à ${favorisPoses.size} produits existants (aucun produit créé).`,
  );

  const ok = !signalements.some((s) => s.niveau === "bloquant");
  if (!ok) return { ok: false, version: null, produits: [], signalements };

  informe(
    "INFO_IMPORT",
    `${corps.length} lignes lues · ${produits.size} produits · ${[...lignes.values()].filter((l) => l.basePrix === "kg").length} au kilo.`,
  );
  return {
    ok: true,
    version: {
      code: options.code,
      grille: "comptoir",
      valideDu: options.valideDu,
      valideAu: null,
      source: options.source,
      lignes,
    },
    produits: [...produits.values()],
    signalements,
  };
}
