// src/components/commande/modele.ts
//
// Modèle de l'écran de commande (propriétaire : `commandes-traiteur`).
// AUCUNE règle ici : on traduit l'état de l'écran en `CommandeSaisie` du
// domaine (src/domaine/commande.ts) et on branche le domaine sur le catalogue
// reçu de /api/tarifs. Toute décision (minimum, plancher, unité, date, acompte…)
// est prise par `controlerLigne` / `blocagesCommande` / `controlerCommande`,
// les mêmes fonctions que la route serveur rejoue (KO-3).
//
// Imports relatifs avec extension : module exécuté tel quel par `node --test`.

import type { Echec, Resultat } from '../../domaine/resultat.ts';
import type { DateISO, Deverrouillage, FicheTarifee, Forme, PrixRegle, ProduitRegle, RegimePrix, SortieRemplacement } from '../../domaine/types.ts';
import type { CommandeSaisie, LigneSaisie, ResoudreProduit } from '../../domaine/commande.ts';
import { gateauxDeLigneLibre, resoudreDepuisCatalogue } from '../../domaine/commande.ts';
import { signaler } from '../../domaine/messages.ts';
import { estGateauDuComptoir, gateauxDeLigne, porteUneEcriture, porteUnePhoto } from '../../domaine/supplements.ts';
import { estGateauSimpleSurCommande, symbolesDuTexte } from '../../domaine/minimums.ts';
import { gateauSurCommandeDe, goutDeLaLigne, produitComptoirPourTaille, type CorrespondanceComptoir } from '../../domaine/prixComptoir.ts';
import { libelleProduitFiche, libelleSelonGout, type LibelleSelonGout } from '../../domaine/libelles.ts';
import type { JourFerme } from '../../domaine/calendrier.ts';
import { decalerJours, estDateISO } from '../../domaine/calendrier.ts';
import { heureChamp, lireHeure } from '../../domaine/reglement.ts';
import type { DelaisCommande, PlageOuverture, RegleSupplementParPersonne, ReglementCommande } from '../../domaine/constantes.ts';
import { FAMILLE_SUPPLEMENT, FAMILLES_GATEAU, SUPPLEMENT_ECRITURE, SUPPLEMENT_PHOTO } from '../../domaine/constantes.ts';
import type { ChoixGout } from '../../domaine/gouts.ts';

// ---------------------------------------------------------------------------
// Données reçues du serveur
// ---------------------------------------------------------------------------

/** Un produit du catalogue de COMMANDE et son prix à la date de prise (GET /api/tarifs). */
export type FicheCatalogue = {
  produit: ProduitRegle & { regimePrix: RegimePrix; categorie: string; estFavori: boolean };
  prix: PrixRegle;
};

export type CatalogueCommande = { date: DateISO; fiches: FicheCatalogue[] };

/** GET /api/calendrier : de quoi rejouer le domaine sur la tablette. */
export type ContexteCalendrier = {
  aujourdhui: DateISO;
  joursFermes: JourFerme[];
  reglement: ReglementCommande;
  delais: DelaisCommande;
  /** Accès gérant ouvert sur cette tablette (cookie valide). */
  gerant: boolean;
};

// ---------------------------------------------------------------------------
// Grille unique de produits (retour du propriétaire, 15/10/2026)
// ---------------------------------------------------------------------------
// Plus d'onglets par régime : une seule grille, une recherche, des filtres
// légers par rayon (`categorie`, donnée du catalogue). Le régime reste LU sur
// chaque produit (LOI 6) — jamais déduit du nom ni de la place dans la grille.

/** « Crème fraîche » se cherche en tapant « creme ». */
export function normaliserRecherche(valeur: string): string {
  return valeur.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Rayons présents au catalogue de commande, dans l'ordre du catalogue (puces de filtre). */
export function rayonsDe(catalogue: CatalogueCommande): string[] {
  const vus: string[] = [];
  for (const f of catalogue.fiches) {
    if (f.produit.regimePrix !== null && !vus.includes(f.produit.categorie)) vus.push(f.produit.categorie);
  }
  return vus;
}

/**
 * Rayons du catalogue (noms à la lettre) RETIRÉS de la grille par défaut et des
 * boutons de famille : on n'y commande presque jamais (propriétaire, 26/10/2026 :
 * « très très rare qu'on commande quelque chose du frigo… le laisser dans la
 * recherche produit »). Leurs produits restent trouvables par la RECHERCHE.
 * Donnée d'affichage de l'écran de commande, pas une règle de vente : un produit
 * de ces rayons se commande normalement une fois trouvé.
 */
export const RAYONS_HORS_LISTE_PAR_DEFAUT: readonly string[] = ['Frigo-Boisson', 'Frigo-S'];

/**
 * Produits affichés dans la grille. Sans recherche ni rayon choisi : tout le
 * sur-commande (B, C) et, du comptoir (A), les seuls favoris — liste d'accès
 * rapide (LOI 4 : un produit = une fiche, un favori n'apparaît jamais deux fois) —
 * hors des rayons RAYONS_HORS_LISTE_PAR_DEFAUT (favoris compris), trouvables
 * par la recherche.
 * Produit sans régime : jamais proposé (il ne peut pas être vendu).
 */
export function fichesVisibles(catalogue: CatalogueCommande, recherche: string, rayon: string | null): FicheCatalogue[] {
  const mots = normaliserRecherche(recherche).split(/\s+/).filter(Boolean);
  const fiches = catalogue.fiches.filter((f) => {
    if (f.produit.regimePrix === null) return false;
    if (rayon !== null && f.produit.categorie !== rayon) return false;
    if (mots.length === 0 && rayon === null && RAYONS_HORS_LISTE_PAR_DEFAUT.includes(f.produit.categorie)) return false;
    if (mots.length === 0 && rayon === null && f.produit.regimePrix === 'A' && !f.produit.estFavori) return false;
    const texte = normaliserRecherche(`${f.produit.produit} ${f.produit.sousCategorie ?? ''} ${f.produit.categorie}`);
    return mots.every((m) => texte.includes(m));
  });
  return mots.length > 0 ? ordonnerResultatsRecherche(fiches, recherche) : fiches;
}

/**
 * Gâteau SUR COMMANDE au prix par personne (régime C, base « personne »), hors
 * supplément par personne (Pâte à sucre) : lu sur les données, jamais sur le nom (LOI 6).
 */
function estGateauParPersonne(f: FicheCatalogue): boolean {
  return f.produit.regimePrix === 'C' && f.prix.basePrix === 'personne' && f.produit.famille !== FAMILLE_SUPPLEMENT;
}

/**
 * Résultats d'une RECHERCHE (audit du 28/10/2026) : « bavarois » donnait 16
 * Bavarois du comptoir avant le Bavarois sur commande (prix par personne) ; un vendeur pressé
 * touchait « Bavarois 10P ». Le gâteau sur commande dont le LIBELLÉ contient
 * tous les mots cherchés passe en tête ; le reste garde l'ordre du catalogue
 * (tri stable). Sans recherche, l'ordre ne change pas.
 */
export function ordonnerResultatsRecherche(fiches: readonly FicheCatalogue[], recherche: string): FicheCatalogue[] {
  const mots = normaliserRecherche(recherche).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return [...fiches];
  const enTete = (f: FicheCatalogue) => {
    const libelle = normaliserRecherche(f.produit.produit);
    return estGateauParPersonne(f) && mots.every((m) => libelle.includes(m));
  };
  return [...fiches.filter(enTete), ...fiches.filter((f) => !enTete(f))];
}

/**
 * Un toucher sur une carte produit. 1 toucher = 1, 5 touchers = 5 (pièces ou
 * parts) : la ligne existante du produit est augmentée de 1, sinon une ligne
 * est créée à 1. AUCUN pré-remplissage au minimum : sous le seuil, le domaine
 * refuse la ligne à la saisie avec sa sortie « Passer à N » (LOI 7).
 * Produit au kilo (LOI 2) : jamais de « +1 » — la ligne est créée sans
 * quantité et le pavé du POIDS s'ouvre.
 * Gâteau simple sur commande (tailles standard, LOI 11 — données de la fiche,
 * jugées par le domaine) : pas de « +1 » non plus, la taille se choisit aux
 * boutons des tailles standard (champ « taille », sans pavé).
 * UNE LIGNE PAR GÂTEAU (propriétaire, 28/10/2026 : « 2 Bavarois comptent pour
 * 2 gâteaux différents ») : un gâteau déjà au bon ne passe jamais à « 2 ».
 *  - gâteau du comptoir (Bavarois 6P…) : chaque toucher ajoute un NOUVEAU
 *    gâteau, ligne de 1, sans pavé (champ « gateau ») ;
 *  - gâteau par personne (Layer, Bavarois sur commande…) : nouveau gâteau dès
 *    que le précédent a sa taille ; tant qu'elle n'est pas choisie, le toucher
 *    rouvre ce gâteau (un double toucher ne crée pas un gâteau vide de plus).
 * Les autres produits (viennoiserie, salé, minis) : un toucher = +1.
 * Retourne les lignes, la clé de la ligne touchée et le champ à ouvrir au pavé
 * (« gateau » / « taille » : aucun pavé).
 */
export function toucherProduit(
  lignes: readonly LigneEcran[],
  fiche: FicheCatalogue,
  famillesGateau: readonly string[] = FAMILLES_GATEAU,
): { lignes: LigneEcran[]; cle: string; champ: ChampTouche } {
  // Gâteau par personne à minimum (R61) : tailles proposées à partir du
  // minimum, pas de « +1 » (1 part de Layer Cake n'a pas de sens). Number
  // Cake : le nombre de symboles d'abord, il fixe le minimum.
  const aMinimumParPersonne =
    fiche.produit.regimePrix === 'C' &&
    fiche.prix.basePrix === 'personne' &&
    (fiche.prix.minQuantite !== null || fiche.prix.minParSymbole !== null);
  if (estGateauSimpleSurCommande(fiche) || aMinimumParPersonne) {
    // Number Cake : jamais de pavé au toucher (propriétaire, 22/10/2026) — la
    // ligne demande « Combien de formes ? » en gros boutons, puis la taille.
    let deja: LigneEcran | undefined;
    for (const l of lignes) if (l.produitId === fiche.produit.id || l.origineSurCommande === fiche.produit.id) deja = l;
    // Dernier gâteau de ce produit encore sans taille : on le rouvre (pas un 2e gâteau vide).
    if (deja && gateauSansTaille(deja)) return { lignes: [...lignes], cle: deja.cle, champ: 'taille' };
    const ligne = ligneVide(fiche.produit.id);
    return { lignes: [...lignes, ligne], cle: ligne.cle, champ: 'taille' };
  }
  // Gâteau du comptoir : un toucher = un gâteau de plus, sur SA ligne (quantité 1, sans pavé).
  if (estFicheGateauDuComptoir(fiche, famillesGateau)) {
    const ligne: LigneEcran = { ...ligneVide(fiche.produit.id), quantite: 1 };
    return { lignes: [...lignes, ligne], cle: ligne.cle, champ: 'gateau' };
  }
  const auKilo = fiche.produit.unite === 'kg';
  const symboles = fiche.prix.minParSymbole !== null;
  let existante: LigneEcran | undefined;
  for (const l of lignes) if (l.produitId === fiche.produit.id) existante = l;

  if (existante) {
    const cle = existante.cle;
    const champ = symboles && existante.nbSymboles === null ? 'symboles' : 'quantite';
    if (auKilo) return { lignes: [...lignes], cle, champ };
    const suivante = (existante.quantite ?? 0) + 1;
    return { lignes: lignes.map((l) => (l.cle === cle ? { ...l, quantite: suivante } : l)), cle, champ };
  }
  const ligne: LigneEcran = { ...ligneVide(fiche.produit.id), quantite: auKilo ? null : 1 };
  // Number Cake : le nombre de symboles d'abord (il fixe le minimum de parts).
  return { lignes: [...lignes, ligne], cle: ligne.cle, champ: symboles ? 'symboles' : 'quantite' };
}

/** Champ ouvert après un toucher : pavé de quantité / des formes, boutons de taille, ou rien (« gateau »). */
export type ChampTouche = 'quantite' | 'symboles' | 'taille' | 'gateau';

/** Gâteau par personne dont la taille (parts) n'est pas encore choisie. */
export function gateauSansTaille(l: LigneEcran): boolean {
  return l.quantite === null && !l.origineSurCommande;
}

/** Gâteau du comptoir (Bavarois 6P…) : une ligne = un gâteau, quantité 1 (domaine : `estGateauDuComptoir`). */
export function estFicheGateauDuComptoir(fiche: FicheTarifee, famillesGateau: readonly string[]): boolean {
  return estGateauDuComptoir(
    { regimePrix: fiche.produit.regimePrix, basePrix: fiche.prix.basePrix, famille: fiche.produit.famille },
    famillesGateau,
  );
}

/** Le produit de la fiche est un gâteau (une ligne = un gâteau) : même définition que le domaine (`gateauxDeLigne`). */
export function estFicheGateau(fiche: FicheTarifee, famillesGateau: readonly string[]): boolean {
  return (
    gateauxDeLigne(
      { regimePrix: fiche.produit.regimePrix, basePrix: fiche.prix.basePrix, quantite: 1, famille: fiche.produit.famille },
      famillesGateau,
    ) > 0
  );
}

/**
 * Sortie « Séparer en N gâteaux » (ligne ancienne « 2 × Bavarois 6P », refusée
 * par le domaine, `controlerUnGateauParLigne`) : la ligne devient N lignes de
 * 1 gâteau, à sa place dans le bon.
 *  - chaque gâteau reprend : produit, goût, forme, décorations, photo de
 *    modèle, précision (ce qui décrit le gâteau commandé) ;
 *  - l'écriture, « Pas d'écriture » et la photo à imprimer restent sur le
 *    PREMIER seulement : ce sont des choix par gâteau, à demander pour chacun
 *    (le domaine le rappelle : « écriture non précisée »). Rien n'est facturé
 *    en plus en silence : si le bon portait déjà un supplément par gâteau, le
 *    domaine propose « Passer à 1 », ou la vendeuse écrit le texte du 2e.
 * Ligne inconnue ou déjà à 1 : rien ne change.
 */
export function separerLigneGateau(lignes: readonly LigneEcran[], cle: string): LigneEcran[] {
  const i = lignes.findIndex((l) => l.cle === cle);
  const l = lignes[i];
  const n = l?.quantite ?? 0;
  if (!l || !Number.isSafeInteger(n) || n <= 1) return [...lignes];
  const premier: LigneEcran = { ...l, quantite: 1 };
  const copies: LigneEcran[] = Array.from({ length: n - 1 }, () => ({
    ...l,
    cle: nouvelleCle(),
    quantite: 1,
    gouts: [...l.gouts],
    decorations: [...l.decorations],
    texteGateau: '',
    sansEcriture: false,
    photoImprimee: false,
  }));
  return [...lignes.slice(0, i), premier, ...copies, ...lignes.slice(i + 1)];
}

/**
 * Supplément (Photo, Écriture au forfait ; Pâte à sucre par personne, R64) :
 * défini par la DONNÉE `famille = 'supplement'` du catalogue, comme le domaine
 * (src/domaine/supplements.ts, supplementsParPersonne.ts) — jamais par le nom
 * ni par la base de prix (la Pâte à sucre est « par personne », comme un gâteau).
 */
export function estSupplement(fiche: FicheTarifee): boolean {
  return fiche.produit.famille === FAMILLE_SUPPLEMENT;
}

/**
 * Nombre de gâteaux au bon, compté par le DOMAINE (`gateauxDeLigne`) sur les
 * données de chaque produit. Une ligne encore refusée (Layer Cake sous le
 * minimum) compte déjà : le gâteau est bien demandé, les suppléments s'offrent.
 * 0 → l'écran n'offre pas les suppléments (« Ajoutez d'abord un gâteau »).
 */
export function gateauxAuBon(
  lignes: readonly LigneEcran[],
  catalogue: CatalogueCommande | null,
  famillesGateau: readonly string[],
): number {
  let n = 0;
  for (const l of lignes) n += gateauxDeLigneEcran(l, catalogue, famillesGateau);
  return n;
}

/** Quantité déjà au bon pour un produit (pastille de la carte) : pièces/parts, ou grammes au kilo. */
export function quantiteAuBon(lignes: readonly LigneEcran[], produitId: string): number | null {
  let total: number | null = null;
  for (const l of lignes) {
    if (l.produitId === produitId && l.quantite !== null) total = (total ?? 0) + l.quantite;
  }
  return total;
}

/** `ResoudreProduit` du domaine branché sur le catalogue reçu (une seule date : celle de la prise). */
export function resoudreLocal(catalogue: CatalogueCommande): ResoudreProduit {
  const parId = new Map(catalogue.fiches.map((f) => [f.produit.id, f]));
  return resoudreDepuisCatalogue({
    getProduit: (id) => {
      const f = parId.get(id);
      return f ? { ok: true, valeur: f.produit } : { ok: false, code: 'ERR_PRODUIT_INCONNU' };
    },
    getPrix: (id, date) => {
      const f = parId.get(id);
      return f && date === catalogue.date ? { ok: true, valeur: f.prix } : { ok: false, code: 'ERR_TARIF_ABSENT' };
    },
  });
}

export function ficheDe(catalogue: CatalogueCommande | null, produitId: string | null): FicheTarifee | null {
  if (!catalogue || !produitId) return null;
  return catalogue.fiches.find((f) => f.produit.id === produitId) ?? null;
}

// ---------------------------------------------------------------------------
// État de l'écran → saisie du domaine
// ---------------------------------------------------------------------------

export type LigneEcran = {
  /** Clé locale stable (React). */
  cle: string;
  /** Identifiant catalogue, ou null pour une ligne libre (« Autre demande »). */
  produitId: string | null;
  /** Ligne libre uniquement. */
  libelleLibre: string;
  /** Pièces, parts, ou GRAMMES (produit au kilo). null = pas encore saisie. */
  quantite: number | null;
  /** Régime C : prix par personne / pièce saisi (null = plancher). Ligne libre : prix fixé avec le gérant. */
  prixUnitaireCentimes: number | null;
  /** Number Cake : nombre de chiffres ou lettres (suit le texte `formes` quand il se compte). */
  nbSymboles: number | null;
  /** Number Cake : chiffres ou lettres à réaliser (« 25 », « cœur + 1 »), imprimés en gras. */
  formes: string;
  /** Number Cake : « Autre forme » cochée (cœur, étoile…) — le texte ne se compte pas. */
  formesLibres?: boolean;
  /**
   * Ligne libre : réponse à « C'est un gâteau ? » (null = pas encore répondu,
   * refusé par le domaine). Jamais déduite du libellé (LOI 6).
   */
  gateauLibre?: boolean | null;
  /** R62 : goût (ou recette d'entremet) du gâteau, un par étage ('' = pas encore choisi). */
  gouts: string[];
  /** R62 : décorations facultatives (Oreo, Kinder…). */
  decorations: string[];
  nbObjets: number | null;
  /** Goût, garnitures, forme… (texte libre imprimé sur le bon). */
  precision: string;
  /** Accord du gérant (sous plancher ou ligne libre). */
  deverrouillage: Deverrouillage | null;
  /** Accord du gérant pour une taille de gâteau hors standard (LOI 11) — distinct du prix. */
  deverrouillageTaille: Deverrouillage | null;
  /**
   * R60 : gâteau sur commande d'origine quand la ligne a été remplacée par le
   * gâteau du comptoir à une taille standard (les boutons de taille restent
   * affichés pour revenir à une autre taille). Absent / null sinon.
   */
  origineSurCommande?: string | null;
  /**
   * R63 : forme choisie aux boutons « Carré » / « Rond » (null = pas encore
   * choisie ; au-dessus du seuil, le domaine retient carré d'office).
   */
  forme?: Forme | null;
  /**
   * Galerie (26/10/2026) : identifiant de la photo de modèle choisie (« G043 »),
   * imprimé sur le bon. Absent / null : pas de photo. Validé par la route.
   */
  photoModele?: string | null;
  /**
   * Lot 2 (propriétaire, 28/10/2026 : « une écriture par gâteau ») : écriture
   * de CE gâteau, saisie dans son bloc « Sur le gâteau ». Envoyée au domaine,
   * qui ne la garde que sur une ligne gâteau.
   */
  texteGateau?: string;
  /** Lot 2 : « Pas d'écriture » coché pour ce gâteau. */
  sansEcriture?: boolean;
  /** Lot 2 : « Photo à imprimer sur le gâteau » cochée pour ce gâteau. */
  photoImprimee?: boolean;
  /**
   * Ligne de supplément Écriture / Photo posée par l'écran (automatique) : elle
   * suit le nombre de gâteaux qui portent une écriture / une photo, et part
   * quand il n'y en a plus. Une ligne ajoutée à la main n'est jamais retirée
   * en silence (le domaine dit quoi faire).
   */
  supplementAuto?: boolean;
};

let compteur = 0;
export function nouvelleCle(): string {
  compteur += 1;
  return `l${Date.now().toString(36)}${compteur}`;
}

export function ligneVide(produitId: string | null): LigneEcran {
  return {
    cle: nouvelleCle(),
    produitId,
    libelleLibre: '',
    quantite: null,
    prixUnitaireCentimes: null,
    nbSymboles: null,
    formes: '',
    formesLibres: false,
    gouts: [],
    decorations: [],
    nbObjets: null,
    precision: '',
    deverrouillage: null,
    deverrouillageTaille: null,
    forme: null,
    photoModele: null,
    gateauLibre: null,
    texteGateau: '',
    sansEcriture: false,
    photoImprimee: false,
  };
}

/**
 * Ligne de l'écran → `LigneSaisie` du domaine.
 * A / B / supplément : on transmet le prix VU à l'écran ; le domaine (et le
 * serveur) le compare au catalogue (ERR_TARIF_INCOHERENT) — il n'est jamais cru.
 * Quantité non saisie → 0 : le domaine la refuse (ERR_QUANTITE_INVALIDE).
 */
export function versLigneSaisie(l: LigneEcran, fiche: FicheTarifee | null): LigneSaisie {
  const base: LigneSaisie = {
    produitId: l.produitId,
    quantite: l.quantite ?? 0,
    nbSymboles: l.nbSymboles,
    // Number Cake : le texte part au domaine (et au serveur), qui recompte (28/10/2026).
    formes: l.formes.trim() || null,
    formesLibres: l.formesLibres === true,
    nbObjets: l.nbObjets,
    gouts: l.gouts,
    origineSurCommande: l.origineSurCommande ?? null,
    forme: l.forme ?? null,
    deverrouillage: l.deverrouillage,
    deverrouillageTaille: l.deverrouillageTaille,
    // Lot 2 : toujours transmis (format « une écriture par gâteau ») ; le domaine
    // ne les garde que sur un gâteau. « Pas d'écriture » l'emporte sur le texte.
    texteGateau: l.sansEcriture === true ? null : (l.texteGateau ?? '').trim() || null,
    sansEcriture: l.sansEcriture === true,
    photoImprimee: l.photoImprimee === true,
  };
  if (!l.produitId) {
    return {
      ...base,
      libelle: l.libelleLibre,
      ligneLibre: true,
      prixUnitaireCentimes: l.prixUnitaireCentimes,
      gateauLibre: l.gateauLibre ?? null,
    };
  }
  if (!fiche) return base;
  const plancher = fiche.produit.regimePrix === 'C' && fiche.prix.prixEstPlancher;
  return { ...base, prixUnitaireCentimes: plancher ? (l.prixUnitaireCentimes ?? fiche.prix.prixCentimes) : fiche.prix.prixCentimes };
}

export type EtatFormulaire = {
  client: string;
  telephone: string;
  dateRetrait: string | null;
  heureRetrait: string;
  lignes: LigneEcran[];
  acompteCentimes: number | null;
  totalConvenuCentimes: number | null;
  remise: Deverrouillage | null;
  demandeInhabituelle: boolean;
};

/** État complet → `CommandeSaisie` (date et heure de prise : celles du serveur, R56). */
export function versCommandeSaisie(
  e: EtatFormulaire,
  catalogue: CatalogueCommande | null,
  prise: { datePrise: DateISO; heurePrise: string },
): CommandeSaisie {
  return {
    client: e.client,
    telephone: e.telephone,
    datePrise: prise.datePrise,
    heurePrise: prise.heurePrise,
    dateRetrait: e.dateRetrait ?? '',
    heureRetrait: e.heureRetrait || null,
    lignes: e.lignes.map((l) => versLigneSaisie(l, ficheDe(catalogue, l.produitId))),
    acompteCentimes: e.acompteCentimes ?? 0,
    totalConvenuCentimes: e.totalConvenuCentimes,
    remise: e.remise,
    // Écriture et photo à imprimer : sur chaque ligne gâteau (lot 2, 28/10/2026).
    demandeInhabituelle: e.demandeInhabituelle,
  };
}

/** Index de ligne d'un champ du domaine : « lignes[2].quantite » → 2. */
export function indexLigne(champ: string | undefined): number | null {
  const m = /^lignes\[(\d+)\]/.exec(champ ?? '');
  return m ? Number(m[1]) : null;
}

/** Nom du champ sans le préfixe de ligne : « lignes[2].quantite » → « quantite ». */
export function champLocal(champ: string | undefined): string {
  return (champ ?? '').replace(/^lignes\[\d+\]\./, '');
}

/** Lecture d'une réponse JSON d'API, sans jamais exposer un texte technique. */
export async function lireReponse<T>(reponse: Response): Promise<Resultat<T>> {
  let corps: unknown = null;
  try {
    corps = await reponse.json();
  } catch {
    corps = null;
  }
  const c = corps as {
    ok?: boolean;
    code?: string;
    message?: string;
    champ?: string;
    valeurProposee?: unknown;
    reference?: unknown;
  } | null;
  if (reponse.ok && !(c && c.ok === false)) {
    return { ok: true, donnees: corps as T, signalements: [] };
  }
  if (c && typeof c.code === 'string' && c.code.startsWith('ERR_') && typeof c.message === 'string') {
    const echec = { ok: false as const, niveau: 'bloquant' as const, code: c.code as `ERR_${string}`, message: c.message };
    return {
      ...echec,
      ...(c.champ !== undefined ? { champ: c.champ } : {}),
      ...(c.valeurProposee !== undefined ? { valeurProposee: c.valeurProposee } : {}),
    };
  }
  // Réponse illisible (coupure réseau, page d'erreur intermédiaire) : message du
  // catalogue. LOI 9 : jamais de code HTTP à l'écran ; seule une référence courte
  // posée par NOTRE serveur (journal) peut être citée au gérant.
  const reference = c && typeof c.reference === 'string' && /^[A-Za-z0-9-]{1,16}$/.test(c.reference) ? c.reference : null;
  return reference ? signaler('ERR_SERVEUR_INDISPONIBLE', { reference }) : serveurIndisponibleSansReference();
}

/** Réseau coupé avant toute réponse (fetch rejeté) : aucune référence serveur à citer. */
export function echecReseau(): Resultat<never> {
  return serveurIndisponibleSansReference();
}

/**
 * ERR_SERVEUR_INDISPONIBLE sans référence : le catalogue n'a pas (encore) de
 * variante sans référence (dépendance `gestion-erreurs`). En attendant, on garde
 * le texte du catalogue jusqu'au conseil « réessayez », sans la phrase qui cite
 * une référence — plutôt qu'une référence technique inventée côté écran.
 */
function serveurIndisponibleSansReference(): Resultat<never> {
  const echec = signaler('ERR_SERVEUR_INDISPONIBLE', { reference: '' });
  const coupe = echec.message.indexOf(' ; ');
  return coupe > 0 ? { ...echec, message: `${echec.message.slice(0, coupe)}.` } : echec;
}

// ---------------------------------------------------------------------------
// Commandes prises avec l'ancien tarif (avant le lot 2)
// ---------------------------------------------------------------------------

/** Ligne enregistrée, telle que lue en base (route) ou reçue de GET /api/commandes (écran). */
export type LigneEnregistree = {
  libelle: string;
  quantite: number;
  prixCentimes: number;
  produitCatalogueId?: number | null;
  produitCatalogue?: { cleCatalogue: string } | null;
  sousPlancherAutorisePar?: string | null;
  ligneLibreAutoriseePar?: string | null;
};

/**
 * Ligne antérieure au lot 2 : ni produit du catalogue, ni accord du gérant.
 * Son prix n'est pas vérifiable au catalogue : seule une modification SANS
 * effet sur les produits, la date ou les montants reste possible sans gérant.
 */
export function estLigneAncienTarif(l: LigneEnregistree): boolean {
  return l.produitCatalogueId == null && !l.produitCatalogue && !l.sousPlancherAutorisePar && !l.ligneLibreAutoriseePar;
}

/**
 * true si les lignes reçues sont EXACTEMENT les lignes enregistrées (même ordre,
 * même libellé, même quantité, même prix, aucune devenue produit du catalogue).
 * Lignes reçues : format du corps de POST/PATCH /api/commandes.
 */
export function lignesIdentiques(
  avant: readonly LigneEnregistree[],
  apres: readonly { produitId?: unknown; libelle?: unknown; quantite?: unknown; prixUnitaireCentimes?: unknown }[],
): boolean {
  if (avant.length !== apres.length) return false;
  return avant.every((a, i) => {
    const b = apres[i];
    const cle = a.produitCatalogue?.cleCatalogue ?? null;
    const produitRecu = typeof b.produitId === 'string' && b.produitId.trim() !== '' ? b.produitId.trim() : null;
    if (produitRecu !== cle) return false;
    if (cle === null && (typeof b.libelle !== 'string' || b.libelle.trim() !== a.libelle)) return false;
    return b.quantite === a.quantite && b.prixUnitaireCentimes === a.prixCentimes;
  });
}

/**
 * Refus UNIQUE d'une modification avec effet sur les prix d'une commande prise
 * avec l'ancien tarif, sans le gérant (route ET écran : même texte).
 */
export function refusAncienTarif(): Echec {
  return signaler(
    'ERR_DROIT_INSUFFISANT',
    { action: 'modifier les produits, la date ou les montants d’une commande prise avec l’ancien tarif', role: 'manager' },
    { champ: 'lignes' },
  );
}

// ---------------------------------------------------------------------------
// R60 — gâteau sur commande au prix du comptoir (décision du 18/10/2026)
// ---------------------------------------------------------------------------
// La règle est au domaine (src/domaine/prixComptoir.ts), la correspondance au
// catalogue (src/catalogue/correspondancesComptoir.ts) : l'écran ne fait que
// remplacer la ligne quand le domaine dit qu'un équivalent existe.

/** Gâteau sur commande dont la ligne montre les boutons de taille (la ligne elle-même, ou son origine). */
export function gateauDeLaLigne(l: LigneEcran): string | null {
  return l.origineSurCommande ?? l.produitId;
}

/** Taille (parts) affichée comme choisie : celle de l'équivalent comptoir, sinon la quantité. */
export function tailleChoisie(l: LigneEcran, table: readonly CorrespondanceComptoir[]): number | null {
  if (l.origineSurCommande) return gateauSurCommandeDe(l.produitId, table)?.parts ?? null;
  return l.quantite;
}

/**
 * Fiche du gâteau du comptoir qui remplace (gâteau, parts, goût), si elle est
 * au catalogue reçu. `gouts` : ceux de la ligne (Bavarois goût Framboise →
 * « Bavarois framboise NP »).
 */
export function ficheComptoirPourTaille(
  produitId: string | null,
  parts: number,
  catalogue: CatalogueCommande | null,
  table: readonly CorrespondanceComptoir[],
  gouts?: readonly string[] | null,
): FicheCatalogue | null {
  const cle = produitComptoirPourTaille(produitId, parts, table, goutDeLaLigne(gouts));
  return cle && catalogue ? (catalogue.fiches.find((f) => f.produit.id === cle) ?? null) : null;
}

/**
 * Toucher d'une taille : si le gâteau du comptoir existe à cette taille (et à
 * ce goût, 28/10/2026), la ligne DEVIENT ce produit (quantité 1, prix du
 * catalogue, accords retirés) ; sinon elle redevient le gâteau sur commande à
 * ce nombre de parts. Goût, photo, précision, décorations : gardés.
 */
export function choisirTaille(
  l: LigneEcran,
  parts: number,
  catalogue: CatalogueCommande | null,
  table: readonly CorrespondanceComptoir[],
): LigneEcran {
  const origine = gateauDeLaLigne(l);
  const comptoir = ficheComptoirPourTaille(origine, parts, catalogue, table, l.gouts);
  if (comptoir) {
    return {
      ...l,
      produitId: comptoir.produit.id,
      origineSurCommande: origine,
      quantite: 1,
      prixUnitaireCentimes: null,
      deverrouillage: null,
      deverrouillageTaille: null,
    };
  }
  if (l.origineSurCommande) {
    return { ...l, produitId: origine, origineSurCommande: null, quantite: parts, prixUnitaireCentimes: null, deverrouillage: null, deverrouillageTaille: null };
  }
  return majLigneEcran(l, { quantite: parts });
}

/**
 * Le goût choisit le gâteau du comptoir (propriétaire, 28/10/2026) : après un
 * changement de goût, la ligne d'un gâteau à correspondances passe au bon
 * produit pour la taille déjà choisie (« Bavarois 6P » → « Bavarois framboise
 * 6P », retour à « Bavarois 6P » pour un autre goût). Un gâteau resté au prix
 * par personne (15 parts…) n'est pas touché. Rien d'autre ne change (goût,
 * photo, précision, décorations, quantité 1). Retourne la même ligne sinon.
 */
export function suivreGout(
  l: LigneEcran,
  catalogue: CatalogueCommande | null,
  table: readonly CorrespondanceComptoir[],
): LigneEcran {
  const origine = gateauDeLaLigne(l);
  if (!origine || !table.some((c) => c.surCommande === origine)) return l;
  const parts = tailleChoisie(l, table);
  if (parts === null) return l;
  if (!l.origineSurCommande && !ficheComptoirPourTaille(origine, parts, catalogue, table, l.gouts)) return l;
  const suivante = choisirTaille(l, parts, catalogue, table);
  return suivante.produitId === l.produitId && suivante.origineSurCommande === l.origineSurCommande ? l : suivante;
}

/**
 * Nom de la ligne à l'écran : celui du catalogue (LOI 5), sauf quand le goût
 * change le nom (donnée LIBELLES_SELON_GOUT : Bavarois goût Fraisier → « Fraisier »).
 */
export function libelleLigneEcran(l: LigneEcran, fiche: FicheTarifee, table: readonly LibelleSelonGout[]): string {
  return libelleSelonGout(l.produitId, l.gouts, table) ?? libelleProduitFiche(fiche);
}

/**
 * Mise à jour d'une ligne de l'écran. Un accord de taille (LOI 11) porte sur
 * UNE quantité : si la quantité change sans nouvel accord, il tombe (le
 * domaine redemandera le code gérant pour une autre taille hors standard).
 */
export function majLigneEcran(l: LigneEcran, partiel: Partial<LigneEcran>): LigneEcran {
  const suivante = { ...l, ...partiel };
  if ('quantite' in partiel && partiel.quantite !== l.quantite && !('deverrouillageTaille' in partiel)) {
    suivante.deverrouillageTaille = null;
  }
  return suivante;
}

// ---------------------------------------------------------------------------
// Number Cake : le nombre de chiffres ou lettres suit le texte (audit du 28/10/2026)
// ---------------------------------------------------------------------------
// Le comptage est au domaine (`symbolesDuTexte`, rejoué par le serveur) ; ces
// fonctions gardent seulement l'écran d'accord avec lui, sans jamais laisser
// « 25 » affiché avec « 1 » coché.

/** Saisie du texte : le nombre suit ce qui est tapé (« 2 5 », « 2-5 », « 25 » → 2), sauf « Autre forme ». */
export function ecrireChiffresOuLettres(l: LigneEcran, texte: string): Partial<LigneEcran> {
  const n = symbolesDuTexte(texte, l.formesLibres === true);
  return n === null ? { formes: texte } : { formes: texte, nbSymboles: n };
}

/**
 * Toucher d'un nombre (1, 2, 3, 4, « Autre ») : un texte déjà tapé qui compte
 * AUTRE CHOSE est vidé (il est à retaper), jamais gardé à côté d'un nombre faux.
 */
export function choisirNombreSymboles(l: LigneEcran, n: number): Partial<LigneEcran> {
  const compte = symbolesDuTexte(l.formes, l.formesLibres === true);
  return compte !== null && compte !== n ? { nbSymboles: n, formes: '' } : { nbSymboles: n };
}

/** Case « Autre forme » : décochée, le texte se recompte aussitôt. */
export function basculerFormesLibres(l: LigneEcran, libres: boolean): Partial<LigneEcran> {
  if (libres) return { formesLibres: true };
  const n = symbolesDuTexte(l.formes, false);
  return n === null ? { formesLibres: false } : { formesLibres: false, nbSymboles: n };
}

/** Relecture d'une commande : « Autre forme » si le texte n'est pas fait que de chiffres ou lettres (cœur…). */
export function formesLibresEnregistrees(formes: string | null | undefined): boolean {
  const t = String(formes ?? '').trim();
  return t !== '' && !/^[\p{L}\p{N}\s\-.,/]+$/u.test(t);
}

// ---------------------------------------------------------------------------
// Bloc « Sur le gâteau » et suppléments automatiques (18/10 et 28/10/2026)
// ---------------------------------------------------------------------------
// Lot 2 (propriétaire, 28/10/2026 : « une écriture par gâteau, ça doit être
// clair quelle écriture pour quel gâteau ») : SOUS CHAQUE ligne gâteau, son
// bloc — écriture, « Pas d'écriture », photo à imprimer. « Gâteau » = notion
// du domaine (`gateauxDeLigne`, R7), y compris le gâteau du comptoir qui
// remplace un gâteau sur commande (R60). Les suppléments Écriture et Photo
// suivent : un par gâteau qui porte une écriture / une photo, posés et
// retirés par l'écran, jamais à la main (`synchroniserSupplementsGateau`).
// Le domaine reste juge (rejoué au serveur).

/**
 * Identifiants catalogue des suppléments ajoutés automatiquement : clés du
 * DOMAINE (constantes.ts, exigées par `controlerSupplementEcriture` /
 * `controlerSupplementPhoto`). Pas de prix : lu au catalogue reçu (LOI 1).
 */
export { SUPPLEMENT_ECRITURE, SUPPLEMENT_PHOTO };
/** R64 (26/10/2026) : supplément PAR PERSONNE, autant de parts que le gâteau qui le reçoit. */
export const SUPPLEMENT_PATE_A_SUCRE = 'gateaux-sur-commande/supplement-pate-a-sucre';

/** Gâteaux apportés par UNE ligne de l'écran (domaine : `gateauxDeLigne`). */
function gateauxDeLigneEcran(l: LigneEcran, catalogue: CatalogueCommande | null, famillesGateau: readonly string[]): number {
  // Ligne libre : gâteau seulement sur réponse explicite (« C'est un gâteau ? » : oui).
  if (l.produitId === null) return gateauxDeLigneLibre(l.gateauLibre);
  const f = ficheDe(catalogue, l.produitId);
  if (!f) return 0;
  return gateauxDeLigne(
    { regimePrix: f.produit.regimePrix, basePrix: f.prix.basePrix, quantite: l.quantite ?? 0, famille: f.produit.famille },
    famillesGateau,
  );
}

/** Index de la ligne sous laquelle s'affiche le bloc « Gâteau » (premier gâteau), null s'il n'y en a pas. */
export function indexPremierGateau(
  lignes: readonly LigneEcran[],
  catalogue: CatalogueCommande | null,
  famillesGateau: readonly string[],
): number | null {
  const i = lignes.findIndex((l) => gateauxDeLigneEcran(l, catalogue, famillesGateau) > 0);
  return i < 0 ? null : i;
}

/** true si la ligne apporte au moins un gâteau au bon (domaine : `gateauxDeLigne`). */
export function estLigneGateau(l: LigneEcran, catalogue: CatalogueCommande | null, famillesGateau: readonly string[]): boolean {
  return gateauxDeLigneEcran(l, catalogue, famillesGateau) > 0;
}

/** true si le bon porte une ligne de ce supplément. */
export function aSupplement(lignes: readonly LigneEcran[], produitId: string): boolean {
  return lignes.some((l) => l.produitId === produitId);
}

/**
 * Met (voulu = true) ou retire (voulu = false) le supplément au bon.
 * Ajout : une seule ligne, quantité 1 (« une fois par gâteau » : le vendeur
 * peut monter à la main s'il y a plusieurs gâteaux), seulement s'il y a un
 * gâteau au bon et si le supplément est au catalogue reçu — sinon rien (jamais
 * de supplément sans gâteau, R7). Ligne déjà présente : laissée telle quelle.
 * Retrait : toutes les lignes de ce supplément.
 */
export function basculerSupplement(
  lignes: readonly LigneEcran[],
  produitId: string,
  voulu: boolean,
  catalogue: CatalogueCommande | null,
  famillesGateau: readonly string[],
): LigneEcran[] {
  if (!voulu) return lignes.filter((l) => l.produitId !== produitId);
  if (aSupplement(lignes, produitId)) return [...lignes];
  if (!ficheDe(catalogue, produitId)) return [...lignes];
  if (gateauxAuBon(lignes, catalogue, famillesGateau) === 0) return [...lignes];
  return [...lignes, { ...ligneVide(produitId), quantite: 1 }];
}

/** Suppléments posés par l'écran, et ce qui les appelle sur un gâteau (règle : domaine, supplements.ts). */
const SUPPLEMENTS_AUTOMATIQUES: readonly { cle: string; porte: (l: LigneEcran) => boolean }[] = [
  { cle: SUPPLEMENT_ECRITURE, porte: (l) => porteUneEcriture(l) },
  { cle: SUPPLEMENT_PHOTO, porte: (l) => porteUnePhoto(l) },
];

/**
 * Suppléments dus pour ce que portent les gâteaux : un par GÂTEAU qui porte
 * une écriture (Écriture) / une photo à imprimer (Photo) — même compte que le
 * domaine (`ecrituresAttendues`, `photosAttendues`). Une ligne qui n'est pas
 * (ou plus) un gâteau ne compte pas : sa saisie reste en mémoire, sans effet.
 */
export function supplementsDus(
  lignes: readonly LigneEcran[],
  cle: string,
  catalogue: CatalogueCommande | null,
  famillesGateau: readonly string[],
): number {
  const s = SUPPLEMENTS_AUTOMATIQUES.find((x) => x.cle === cle);
  if (!s) return 0;
  return lignes.reduce((n, l) => n + (s.porte(l) ? gateauxDeLigneEcran(l, catalogue, famillesGateau) : 0), 0);
}

/**
 * Décision du propriétaire (28/10/2026, lot 2) : les suppléments Écriture et
 * Photo sont AUTOMATIQUES, un par gâteau qui porte une écriture / une photo à
 * imprimer, et ne se retirent pas à la main.
 *  - toujours : il en manque (gâteau remis, ligne retirée…) → UNE ligne du
 *    supplément, quantité = dû (ajoutée si absente, sinon montée ; les autres
 *    lignes du même supplément y sont fondues) ;
 *  - `reduire` (saisie DANS le bloc « Sur le gâteau » : texte vidé, « Pas
 *    d'écriture », photo décochée) : quantité ramenée à dû, et les lignes
 *    posées par l'écran partent à 0. Sinon (gâteau retiré du bon…) rien ne
 *    descend en silence : le domaine refuse le surplus avec sa sortie
 *    (ERR_SUPPLEMENT_EN_TROP « Passer à N », ERR_SUPPLEMENT_SANS_GATEAU). Une
 *    ligne ajoutée à la main n'est jamais retirée par l'écran.
 * Supplément absent du tarif reçu : rien n'est ajouté (le domaine refuse,
 * ERR_ECRITURE_SANS_SUPPLEMENT). Retourne le MÊME tableau si rien ne change
 * (aucune boucle de rendu).
 */
export function synchroniserSupplementsGateau(
  lignes: LigneEcran[],
  catalogue: CatalogueCommande | null,
  famillesGateau: readonly string[],
  reduire = false,
): LigneEcran[] {
  let suivantes = lignes;
  for (const { cle } of SUPPLEMENTS_AUTOMATIQUES) {
    const du = supplementsDus(suivantes, cle, catalogue, famillesGateau);
    const lignesSup = suivantes.filter((l) => l.produitId === cle);
    const present = lignesSup.reduce((n, l) => n + (l.quantite ?? 0), 0);
    if (du === 0) {
      if (reduire && lignesSup.some((l) => l.supplementAuto === true)) {
        suivantes = suivantes.filter((l) => !(l.produitId === cle && l.supplementAuto === true));
      }
      continue;
    }
    const [premiere] = lignesSup;
    if (!premiere) {
      if (!ficheDe(catalogue, cle)) continue;
      suivantes = [...suivantes, { ...ligneVide(cle), quantite: du, supplementAuto: true }];
      continue;
    }
    if (present === du && (lignesSup.length === 1 || !reduire)) continue;
    if (present > du && !reduire) continue;
    suivantes = suivantes
      .filter((l) => l.produitId !== cle || l === premiere)
      .map((l) => (l === premiere ? { ...l, quantite: du, supplementAuto: true } : l));
  }
  return suivantes;
}

/** true : la ligne est un supplément Écriture / Photo dû pour un gâteau — pas de × (non retirable à la main). */
export function supplementImpose(
  l: LigneEcran,
  lignes: readonly LigneEcran[],
  catalogue: CatalogueCommande | null,
  famillesGateau: readonly string[],
): boolean {
  if (l.produitId === null || !SUPPLEMENTS_AUTOMATIQUES.some((s) => s.cle === l.produitId)) return false;
  return supplementsDus(lignes, l.produitId, catalogue, famillesGateau) > 0;
}

/** Ce que l'on saisit dans le bloc « Sur le gâteau » d'UNE ligne. */
export type SaisieSurLeGateau = Partial<Pick<LigneEcran, 'texteGateau' | 'sansEcriture' | 'photoImprimee'>>;

/**
 * Saisie dans le bloc « Sur le gâteau » de la ligne `cle` : texte, « Pas
 * d'écriture » (vide le texte), photo à imprimer ; puis les suppléments
 * Écriture et Photo suivent aussitôt (`synchroniserSupplementsGateau`).
 */
export function saisirSurLeGateau(
  lignes: readonly LigneEcran[],
  cle: string,
  saisie: SaisieSurLeGateau,
  catalogue: CatalogueCommande | null,
  famillesGateau: readonly string[],
): LigneEcran[] {
  const partiel: SaisieSurLeGateau = saisie.sansEcriture === true ? { ...saisie, texteGateau: '' } : saisie;
  const majes = lignes.map((l) => (l.cle === cle ? { ...l, ...partiel } : l));
  return synchroniserSupplementsGateau(majes, catalogue, famillesGateau, true);
}

/**
 * Supplément au bon pour ce gâteau ? (texte d'aide du bloc). true si la ligne
 * porte une écriture / une photo et que le bon a le supplément en quantité
 * suffisante pour tous les gâteaux qui en portent.
 */
export function supplementCouvert(
  lignes: readonly LigneEcran[],
  cle: string,
  catalogue: CatalogueCommande | null,
  famillesGateau: readonly string[],
): boolean {
  const du = supplementsDus(lignes, cle, catalogue, famillesGateau);
  const present = lignes.reduce((n, l) => n + (l.produitId === cle ? (l.quantite ?? 0) : 0), 0);
  return du > 0 && present >= du;
}

/**
 * Index du gâteau sous lequel s'affiche la case « Pâte à sucre » (R64) : le
 * gâteau qui la reçoit — le premier gâteau porteur, sinon le premier gâteau du
 * bon (même choix que `basculerSupplementParPersonne`). null : aucun gâteau.
 */
export function indexGateauPateASucre(
  lignes: readonly LigneEcran[],
  produitId: string,
  catalogue: CatalogueCommande | null,
  famillesGateau: readonly string[],
  regles: Readonly<Record<string, RegleSupplementParPersonne>>,
): number | null {
  const regle = regles[produitId];
  const porteur = regle ? porteursParPersonne(lignes, regle, Object.keys(regles))[0] : undefined;
  return porteur ?? indexPremierGateau(lignes, catalogue, famillesGateau);
}

// ---------------------------------------------------------------------------
// R64 — supplément par personne (Pâte à sucre), décision du 26/10/2026
// ---------------------------------------------------------------------------
// La règle (quels gâteaux, à partir de combien de parts) est au domaine
// (`controlerSupplementsParPersonne`) ; ses DONNÉES (SUPPLEMENTS_PAR_PERSONNE)
// servent ici seulement à savoir QUELLE ligne suivre : la ligne du supplément
// porte les parts du gâteau, et les suit quand elles changent. Le domaine juge
// ensuite (minimum, gâteau admis, forme carrée).

/** Index des gâteaux qui peuvent porter ce supplément (gâteau commandé, y compris devenu gâteau du comptoir, R60). */
function porteursParPersonne(lignes: readonly LigneEcran[], regle: RegleSupplementParPersonne, supplements: readonly string[]): number[] {
  return lignes.flatMap((l, i) => {
    if (l.produitId !== null && supplements.includes(l.produitId)) return [];
    const g = gateauDeLaLigne(l);
    return g !== null && regle.gateaux.includes(g) ? [i] : [];
  });
}

/**
 * Chaque ligne de supplément par personne prend les parts du gâteau qu'elle
 * accompagne : la 1re ligne de supplément suit le 1er gâteau porteur du bon,
 * la 2e le 2e, etc. Un supplément sans gâteau porteur garde sa quantité (le
 * domaine le refuse avec sa sortie « Supprimer la ligne »). Taille du gâteau
 * pas encore choisie → parts du supplément vides aussi.
 * Retourne le MÊME tableau si rien ne change (aucune boucle de rendu).
 */
export function synchroniserSupplementsParPersonne(
  lignes: LigneEcran[],
  regles: Readonly<Record<string, RegleSupplementParPersonne>>,
  table: readonly CorrespondanceComptoir[],
): LigneEcran[] {
  const supplements = Object.keys(regles);
  let suivantes: LigneEcran[] | null = null;
  for (const cle of supplements) {
    const porteurs = porteursParPersonne(lignes, regles[cle], supplements);
    let rang = 0;
    for (const [i, l] of lignes.entries()) {
      if (l.produitId !== cle) continue;
      const g = porteurs[rang];
      rang += 1;
      if (g === undefined) continue;
      const parts = tailleChoisie(lignes[g], table);
      if (l.quantite === parts) continue;
      if (suivantes === null) suivantes = [...lignes];
      suivantes[i] = { ...l, quantite: parts };
    }
  }
  return suivantes ?? lignes;
}

/**
 * Case « Pâte à sucre » du bloc gâteau. Coché : UNE ligne, aux parts du premier
 * gâteau porteur (sinon du premier gâteau du bon : le domaine dira pourquoi il
 * ne la reçoit pas), seulement s'il y a un gâteau au bon et si le supplément
 * est au tarif reçu. Décoché : toutes les lignes de ce supplément retirées.
 */
export function basculerSupplementParPersonne(
  lignes: readonly LigneEcran[],
  produitId: string,
  voulu: boolean,
  catalogue: CatalogueCommande | null,
  famillesGateau: readonly string[],
  regles: Readonly<Record<string, RegleSupplementParPersonne>>,
  table: readonly CorrespondanceComptoir[],
): LigneEcran[] {
  if (!voulu) return lignes.filter((l) => l.produitId !== produitId);
  if (aSupplement(lignes, produitId)) return [...lignes];
  if (!ficheDe(catalogue, produitId)) return [...lignes];
  if (gateauxAuBon(lignes, catalogue, famillesGateau) === 0) return [...lignes];
  const regle = regles[produitId];
  const porteur = regle ? porteursParPersonne(lignes, regle, Object.keys(regles))[0] : undefined;
  const g = porteur ?? indexPremierGateau(lignes, catalogue, famillesGateau);
  const parts = g === null || g === undefined ? null : tailleChoisie(lignes[g], table);
  return [...lignes, { ...ligneVide(produitId), quantite: parts }];
}

// ---------------------------------------------------------------------------
// R63 / R65 — sorties « en un geste » qui changent de produit
// ---------------------------------------------------------------------------

/**
 * Applique un remplaçant proposé par le domaine (« Passer en Layer Cake (20
 * parts) », « Prendre Mousse chocolat 4P ») : nouveau produit à la quantité
 * proposée, forme à rechoisir, prix et accords retirés (ils portaient sur
 * l'autre produit), plus de gâteau du comptoir d'origine (R60). Les goûts
 * sont gardés seulement si les deux gâteaux demandent la même liste de goûts
 * (donnée GOUTS_SUR_COMMANDE, passée en `gouts`), sinon vidés.
 */
export function appliquerRemplacement(
  l: LigneEcran,
  r: Pick<SortieRemplacement, 'produitId' | 'quantite'>,
  gouts: Readonly<Record<string, ChoixGout>>,
  table: readonly CorrespondanceComptoir[] = [],
): LigneEcran {
  const avant = gateauDeLaLigne(l);
  // Remplaçant qui est lui-même un gâteau du comptoir du MÊME gâteau commandé
  // (Bavarois goût Matadi chocolat 4P → « Passer en Matadi chocolat 6P ») : la
  // ligne reste ce gâteau commandé, au goût de ce produit.
  const meme = l.origineSurCommande ? gateauSurCommandeDe(r.produitId, table) : null;
  if (meme && meme.surCommande === l.origineSurCommande) {
    return {
      ...l,
      produitId: r.produitId,
      quantite: r.quantite,
      prixUnitaireCentimes: null,
      deverrouillage: null,
      deverrouillageTaille: null,
      gouts: meme.gout ? [meme.gout] : [...l.gouts],
    };
  }
  const a = avant ? gouts[avant] : undefined;
  const b = gouts[r.produitId];
  const memeListe = !!a && !!b && a.liste === b.liste && a.parEtage === b.parEtage;
  return {
    ...l,
    produitId: r.produitId,
    origineSurCommande: null,
    quantite: r.quantite,
    prixUnitaireCentimes: null,
    deverrouillage: null,
    deverrouillageTaille: null,
    forme: null,
    gouts: memeListe ? [...l.gouts] : [],
  };
}

/** Remplaçants lus dans `valeurProposee` (R63 : `{ forme, remplacements }` ; R65 : le tableau). */
export function remplacementsProposes(v: unknown): SortieRemplacement[] {
  const liste = Array.isArray(v) ? v : v && typeof v === 'object' ? (v as { remplacements?: unknown }).remplacements : null;
  if (!Array.isArray(liste)) return [];
  return liste.filter(
    (r): r is SortieRemplacement =>
      !!r &&
      typeof r === 'object' &&
      typeof (r as SortieRemplacement).produitId === 'string' &&
      typeof (r as SortieRemplacement).bouton === 'string' &&
      Number.isSafeInteger((r as SortieRemplacement).quantite),
  );
}

// ---------------------------------------------------------------------------
// Familles mises en avant (demande du propriétaire, 18/10/2026)
// ---------------------------------------------------------------------------
// Les deux familles les plus utiles à la prise de commande passent EN PREMIER,
// en gros boutons, sous un libellé de BOUTON court. Ce n'est qu'un libellé
// d'affichage : la catégorie du catalogue et les noms de produits restent à la
// lettre (LOI 5). La catégorie est repérée par le RÉGIME de ses produits
// (donnée du catalogue, LOI 6), jamais par son nom : un rayon dont tous les
// produits vendables sont du régime B est le salé sur commande, du régime C
// les gâteaux sur commande.

/** Libellé de bouton de la famille dont tous les produits sont de ce régime. */
export const FAMILLES_EN_AVANT: ReadonlyArray<{ regime: RegimePrix; libelle: string }> = [
  { regime: 'B', libelle: 'Salé' },
  { regime: 'C', libelle: 'Gâteau' },
];

/** Un bouton de famille : `rayon` = catégorie du catalogue (filtre), `libelle` = texte du bouton. */
export type BoutonFamille = { rayon: string; libelle: string; enAvant: boolean };

/**
 * Boutons de famille, dans l'ordre d'affichage : d'abord les familles mises en
 * avant (ordre de FAMILLES_EN_AVANT), puis les autres dans l'ordre du catalogue,
 * sans les rayons RAYONS_HORS_LISTE_PAR_DEFAUT.
 * Si plusieurs rayons ont le même régime unique, ils restent en avant mais
 * gardent leur nom du catalogue (pas deux boutons « Salé » indiscernables).
 */
export function boutonsFamilles(catalogue: CatalogueCommande): BoutonFamille[] {
  // Rayons du frigo : pas de bouton (recherche seulement, 26/10/2026).
  const rayons = rayonsDe(catalogue).filter((r) => !RAYONS_HORS_LISTE_PAR_DEFAUT.includes(r));
  const regimeUnique = new Map<string, RegimePrix | null>();
  for (const r of rayons) {
    const regimes = new Set<RegimePrix>();
    for (const f of catalogue.fiches) {
      if (f.produit.categorie === r && f.produit.regimePrix !== null) regimes.add(f.produit.regimePrix);
    }
    regimeUnique.set(r, regimes.size === 1 ? [...regimes][0] : null);
  }
  const enAvant: BoutonFamille[] = [];
  for (const { regime, libelle } of FAMILLES_EN_AVANT) {
    const trouves = rayons.filter((r) => regimeUnique.get(r) === regime);
    for (const r of trouves) enAvant.push({ rayon: r, libelle: trouves.length === 1 ? libelle : r, enAvant: true });
  }
  const pris = new Set(enAvant.map((b) => b.rayon));
  return [...enAvant, ...rayons.filter((r) => !pris.has(r)).map((r) => ({ rayon: r, libelle: r, enAvant: false }))];
}

// ---------------------------------------------------------------------------
// Bande « jour et heure de retrait » (demande du propriétaire, 18/10/2026)
// ---------------------------------------------------------------------------
// Ce ne sont que des LISTES à proposer au doigt : savoir si un jour est fermé,
// trop tôt, ou si une heure tombe dans les heures d'ouverture reste au domaine
// (fermetureDuJour, horairesOuvertureDuJour, validerHeureRetrait).

/** Nombre de jours proposés dans la bande, à partir d'aujourd'hui. */
export const JOURS_PROPOSES_RETRAIT = 45;
/** Pas des créneaux d'heure proposés (minutes) — granularité d'affichage, pas une règle. */
export const PAS_CRENEAU_MINUTES = 15;

/**
 * Jours proposés : `nombre` jours consécutifs depuis `aujourdhui` (inclus).
 * Un jour déjà choisi hors de cette fenêtre (commande modifiée) est ajouté à
 * sa place chronologique : la sélection reste toujours visible.
 */
export function joursProposes(aujourdhui: DateISO, nombre: number, choisi: string | null): DateISO[] {
  const jours: DateISO[] = [];
  for (let i = 0; i < nombre; i++) jours.push(decalerJours(aujourdhui, i));
  if (choisi && estDateISO(choisi) && !jours.includes(choisi)) {
    jours.push(choisi);
    jours.sort();
  }
  return jours;
}

/**
 * Créneaux « HH:MM » entre l'ouverture et la fermeture du jour (bornes
 * incluses, comme `validerHeureRetrait`), par pas de `pas` minutes alignés sur
 * l'heure. Une heure déjà choisie hors grille est ajoutée à sa place (jamais
 * perdue ni corrigée en silence : le domaine la juge). Plage absente ou
 * illisible → aucun créneau (le domaine refusera avec son message).
 */
export function creneauxRetrait(plage: PlageOuverture | null, pas: number, choisie: string): string[] {
  const creneaux: string[] = [];
  const debut = plage ? lireHeure(plage.ouverture) : null;
  const fin = plage ? lireHeure(plage.fermeture) : null;
  if (debut !== null && fin !== null && debut <= fin && pas > 0) {
    creneaux.push(heureChamp(debut));
    for (let m = debut - (debut % pas) + pas; m < fin; m += pas) {
      if (m > debut) creneaux.push(heureChamp(m));
    }
    if (fin > debut) creneaux.push(heureChamp(fin));
  }
  const lue = lireHeure(choisie);
  if (lue !== null && !creneaux.includes(heureChamp(lue))) {
    creneaux.push(heureChamp(lue));
    creneaux.sort();
  }
  return creneaux;
}
