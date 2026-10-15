// src/catalogue/importComptoir.ts
// Import du tarif comptoir (régime A) depuis le CSV du gérant.
//
// - Seule la colonne `prix_cents` fait foi ; `prix_ttc_eur` sert uniquement de
//   contrôle de cohérence (lu comme texte, jamais comme flottant).
// - Les lignes « Favoris » ne créent AUCUN produit : elles positionnent
//   `estFavori` sur leur jumeau. Un favori sans jumeau, ambigu ou au prix
//   différent bloque l'import (jamais de fusion silencieuse).
// - Le régime « A » vient de la SOURCE (grille comptoir), pas du libellé.
// - La famille (pâtisserie, salé…) vient du RAYON, via ./familles.ts.
// - Textes du rapport : catalogue unique des messages, via ./rapport.ts.

import { analyserCsv } from "./csv.ts";
import {
  CATEGORIE_FAVORIS,
  COLONNES_CSV,
  PRODUITS_AU_KG_ATTENDUS,
  SEUIL_ALERTE_KG_BAS_CENTS,
  SEUIL_ALERTE_PIECE_HAUT_CENTS,
} from "./controles.ts";
import { FAMILLE_PAR_DEFAUT, estSupplement, regleFamille } from "./familles.ts";
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
import { entreeRapport, libelleProduit, ouLigne, type CodeRapport, type ParametresRapport } from "./rapport.ts";
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

export function importerCsvComptoir(texte: string, options: OptionsImportComptoir): ResultatImport {
  const signalements: Signalement[] = [];
  // Niveau donné par le préfixe du code (ERR_ / AVERT_ / INFO_), texte par le catalogue des messages.
  const signale = (code: CodeRapport, params: ParametresRapport, ligne?: number, produitId?: string) =>
    signalements.push(entreeRapport(code, params, { ligne, produitId }));

  const echec = (): ResultatImport => ({ ok: false, version: null, produits: [], signalements });

  if (!estDateISO(options.valideDu)) {
    signale("ERR_DATE_EFFET_INVALIDE", { ou: `Tarif ${options.code}`, precision: `« ${options.valideDu} »` });
    return echec();
  }

  const enregistrements = analyserCsv(texte);
  const [entete, ...corps] = enregistrements;
  if (!entete || entete.champs.join(",") !== COLONNES_CSV.join(",")) {
    signale("ERR_ENTETE_CSV", { ou: ouLigne(1), precision: `colonnes attendues : ${COLONNES_CSV.join(", ")}` }, 1);
    return echec();
  }

  // ---------------------------------------------------------- 1. lecture
  const lues: LigneLue[] = [];
  for (const { ligne, champs } of corps) {
    if (champs.length !== COLONNES_CSV.length) {
      signale("ERR_LIGNE_MALFORMEE", { ou: ouLigne(ligne), precision: `${champs.length} colonnes au lieu de ${COLONNES_CSV.length}` }, ligne);
      continue;
    }
    const [categorie, produit, sousCategorie, prixEur, prixCentsTexte, uniteTexte, favoriTexte] = champs;
    const ou = ouLigne(ligne, { categorie, produit, sousCategorie });
    let valide = true;

    if (slug(produit) === "" || slug(categorie) === "") {
      signale("ERR_LIBELLE_VIDE", { ou: ouLigne(ligne) }, ligne);
      valide = false;
    }

    let prixCentimes: number | null = null;
    if (prixCentsTexte.trim() === "") {
      signale("ERR_PRIX_VIDE", { ou }, ligne);
      valide = false;
    } else {
      prixCentimes = lireCentimes(prixCentsTexte);
      if (prixCentimes === null) {
        signale("ERR_PRIX_NON_NUMERIQUE", { ou, precision: `« ${prixCentsTexte} »` }, ligne);
        valide = false;
      } else if (prixCentimes <= 0) {
        signale("ERR_PRIX_NUL_OU_NEGATIF", { ou }, ligne);
        valide = false;
      } else {
        const controle = eurosTexteEnCentimes(prixEur);
        if (controle !== prixCentimes) {
          signale(
            "ERR_PRIX_INCOHERENT",
            { ou, precision: `prix en euros « ${prixEur} », prix en centimes « ${prixCentsTexte} »` },
            ligne,
          );
          valide = false;
        }
      }
    }

    if (uniteTexte !== "piece" && uniteTexte !== "kg") {
      signale("ERR_UNITE_INCONNUE", { ou, precision: `« ${uniteTexte} »` }, ligne);
      valide = false;
    }
    if (favoriTexte !== "oui" && favoriTexte !== "non") {
      signale("ERR_FAVORI_ILLISIBLE", { ou, precision: `est_favori « ${favoriTexte} »` }, ligne);
      valide = false;
    }
    const estLigneFavoris = categorie === CATEGORIE_FAVORIS;
    if ((favoriTexte === "oui") !== estLigneFavoris) {
      signale("ERR_FAVORI_INCOHERENT", { ou, precision: `est_favori « ${favoriTexte} », rayon « ${categorie} »` }, ligne);
      valide = false;
    }

    // LOI 5 : on ne corrige pas, on signale.
    for (const champ of [categorie, produit, sousCategorie]) {
      if (contientInvisibles(champ)) {
        signale("AVERT_CARACTERE_INVISIBLE", { ou, precision: "conservé tel quel" }, ligne);
      }
      if (aDesEspacesSuspects(champ)) {
        signale("INFO_ESPACES_LIBELLE", { ou, precision: `« ${champ} »` }, ligne);
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
      signale("ERR_DOUBLON_IDENTIFIANT", { ou: ouLigne(l.ligne, l), precision: `même produit que la ligne ${deja.ligne}` }, l.ligne, id);
      continue;
    }
    ligneSource.set(id, l);
    // Supplément (liste explicite de familles.ts) : forfait, une fois par gâteau, jamais un gâteau.
    const supplement = estSupplement("comptoir", l.categorie, l.produit);
    produits.set(id, {
      id,
      grille: "comptoir",
      categorie: l.categorie,
      produit: l.produit,
      sousCategorie: l.sousCategorie,
      regimePrix: "A",
      unite: l.unite,
      estFavori: false,
      famille: supplement ? "supplement" : (regleFamille("comptoir", l.categorie)?.famille ?? FAMILLE_PAR_DEFAUT),
      tauxTva: null, // HYPOTHÈSE À VALIDER : TVA 6 % / 12 % à confirmer par le comptable
      variantes: [],
      variantesFermees: false,
    });
    lignes.set(id, {
      prixCentimes: l.prixCentimes,
      basePrix: supplement ? "forfait" : l.unite,
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
      signale("ERR_PRODUIT_KG_A_LA_PIECE", { ou: ouLigne(l.ligne, l), precision: `unité indiquée « ${l.unite} »` }, l.ligne, id);
    } else if (!attenduKg && l.unite === "kg") {
      // HYPOTHÈSE À VALIDER : un 5e produit au kilo bloque l'import tant que la
      // liste des produits au poids (LOI 2) n'a pas été confirmée par le gérant.
      signale("ERR_PRODUIT_KG_INATTENDU", { ou: ouLigne(l.ligne, l), precision: "absent de la liste des produits au poids" }, l.ligne, id);
    }
    if (l.unite === "kg" && l.prixCentimes < SEUIL_ALERTE_KG_BAS_CENTS) {
      signale("AVERT_PRIX_A_CONFIRMER", { ou: ouLigne(l.ligne, l), precision: `${centimesEnTexte(l.prixCentimes)} le kilo, prix bas` }, l.ligne, id);
    }
    if (l.unite === "piece" && l.prixCentimes > SEUIL_ALERTE_PIECE_HAUT_CENTS) {
      signale("AVERT_PRIX_A_CONFIRMER", { ou: ouLigne(l.ligne, l), precision: `${centimesEnTexte(l.prixCentimes)} la pièce, prix élevé` }, l.ligne, id);
    }
  }
  for (const p of PRODUITS_AU_KG_ATTENDUS) {
    if (!trouvesKg.has(cleStricte(p.categorie) + "|" + cleStricte(p.produit))) {
      signale("AVERT_PRODUIT_KG_ABSENT", { ou: `« ${p.produit} » (${p.categorie})` });
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
        signale(
          "ERR_FAVORI_JUMEAU_APPROXIMATIF",
          { ou: ouLigne(f.ligne, f), precision: `ressemble à ${approches.map((id) => libelleProduit(ligneSource.get(id)!)).join(", ")}` },
          f.ligne,
        );
      } else {
        signale("ERR_FAVORI_SANS_JUMEAU", { ou: ouLigne(f.ligne, f) }, f.ligne);
      }
      continue;
    }
    if (jumeaux.length > 1) {
      signale(
        "ERR_FAVORI_AMBIGU",
        { ou: ouLigne(f.ligne, f), precision: jumeaux.map((id) => libelleProduit(ligneSource.get(id)!)).join(", ") },
        f.ligne,
      );
      continue;
    }
    const id = jumeaux[0];
    const jumeau = ligneSource.get(id)!;
    if (jumeau.prixCentimes !== f.prixCentimes || jumeau.unite !== f.unite) {
      signale(
        "ERR_FAVORI_PRIX_DIFFERENT",
        {
          ou: ouLigne(f.ligne, f),
          precision: `favori ${centimesEnTexte(f.prixCentimes)} (${f.unite}), ligne ${jumeau.ligne} ${centimesEnTexte(jumeau.prixCentimes)} (${jumeau.unite})`,
        },
        f.ligne,
        id,
      );
      continue;
    }
    const dejaLigne = favorisPoses.get(id);
    if (dejaLigne !== undefined) {
      signale("AVERT_FAVORI_EN_DOUBLE", { ou: ouLigne(f.ligne, f), precision: `déjà favori ligne ${dejaLigne}` }, f.ligne, id);
      continue;
    }
    favorisPoses.set(id, f.ligne);
    produits.set(id, { ...produits.get(id)!, estFavori: true });
    lignes.set(id, { ...lignes.get(id)!, estFavori: true });
  }
  signale("INFO_FAVORIS", {
    precision: `${favoris.length} lignes « Favoris » rattachées à ${favorisPoses.size} produits, aucun produit créé`,
  });

  // ---------------------------------------------------------- 5. familles (LOI 11)
  // Rayon classé avec une hypothèse, ou inconnu de familles.ts : signalé une fois par rayon.
  const rayonsVus = new Set<string>();
  for (const l of ligneSource.values()) {
    if (rayonsVus.has(l.categorie)) continue;
    rayonsVus.add(l.categorie);
    const regle = regleFamille("comptoir", l.categorie);
    if (!regle) {
      // HYPOTHÈSE À VALIDER : rayon inconnu classé pâtisserie (horaires de retrait les plus stricts).
      signale("INFO_HYPOTHESE", { ou: `Rayon « ${l.categorie} »`, precision: `rayon inconnu, classé « ${FAMILLE_PAR_DEFAUT} »` });
    } else if (regle.hypothese) {
      signale("INFO_HYPOTHESE", { ou: `Rayon « ${l.categorie} »`, precision: regle.hypothese });
    }
  }

  const ok = !signalements.some((s) => s.niveau === "bloquant");
  if (!ok) return { ok: false, version: null, produits: [], signalements };

  signale("INFO_IMPORT", {
    precision: `${corps.length} lignes lues · ${produits.size} produits · ${[...lignes.values()].filter((l) => l.basePrix === "kg").length} au kilo`,
  });
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
