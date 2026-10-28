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
import { resoudreDepuisCatalogue } from '../../domaine/commande.ts';
import { signaler } from '../../domaine/messages.ts';
import { gateauxDeLigne } from '../../domaine/supplements.ts';
import { estGateauSimpleSurCommande } from '../../domaine/minimums.ts';
import { gateauSurCommandeDe, produitComptoirPourTaille, type CorrespondanceComptoir } from '../../domaine/prixComptoir.ts';
import type { JourFerme } from '../../domaine/calendrier.ts';
import { decalerJours, estDateISO } from '../../domaine/calendrier.ts';
import { heureChamp, lireHeure } from '../../domaine/reglement.ts';
import type { DelaisCommande, PlageOuverture, RegleSupplementParPersonne, ReglementCommande } from '../../domaine/constantes.ts';
import { FAMILLE_SUPPLEMENT } from '../../domaine/constantes.ts';
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
  return catalogue.fiches.filter((f) => {
    if (f.produit.regimePrix === null) return false;
    if (rayon !== null && f.produit.categorie !== rayon) return false;
    if (mots.length === 0 && rayon === null && RAYONS_HORS_LISTE_PAR_DEFAUT.includes(f.produit.categorie)) return false;
    if (mots.length === 0 && rayon === null && f.produit.regimePrix === 'A' && !f.produit.estFavori) return false;
    const texte = normaliserRecherche(`${f.produit.produit} ${f.produit.sousCategorie ?? ''} ${f.produit.categorie}`);
    return mots.every((m) => texte.includes(m));
  });
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
 * Retourne les lignes, la clé de la ligne touchée et le champ à ouvrir au pavé.
 */
export function toucherProduit(
  lignes: readonly LigneEcran[],
  fiche: FicheCatalogue,
): { lignes: LigneEcran[]; cle: string; champ: 'quantite' | 'symboles' | 'taille' } {
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
    if (deja) return { lignes: [...lignes], cle: deja.cle, champ: 'taille' };
    const ligne = ligneVide(fiche.produit.id);
    return { lignes: [...lignes, ligne], cle: ligne.cle, champ: 'taille' };
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
  nbSymboles: number | null;
  /** Number Cake : formes à réaliser (« 25 », « cœur + 1 »), imprimées en gras. */
  formes: string;
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
    gouts: [],
    decorations: [],
    nbObjets: null,
    precision: '',
    deverrouillage: null,
    deverrouillageTaille: null,
    forme: null,
    photoModele: null,
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
    nbObjets: l.nbObjets,
    gouts: l.gouts,
    origineSurCommande: l.origineSurCommande ?? null,
    forme: l.forme ?? null,
    deverrouillage: l.deverrouillage,
    deverrouillageTaille: l.deverrouillageTaille,
  };
  if (!l.produitId) return { ...base, libelle: l.libelleLibre, prixUnitaireCentimes: l.prixUnitaireCentimes };
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
  texteGateau: string;
  sansEcriture: boolean;
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
    texteGateau: e.texteGateau || null,
    sansEcriture: e.sansEcriture,
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
    { action: 'modifier les produits, la date ou les montants d’une commande prise avec l’ancien tarif', role: 'gérant' },
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

/** Fiche du gâteau du comptoir qui remplace (gâteau, parts), si elle est au catalogue reçu. */
export function ficheComptoirPourTaille(
  produitId: string | null,
  parts: number,
  catalogue: CatalogueCommande | null,
  table: readonly CorrespondanceComptoir[],
): FicheCatalogue | null {
  const cle = produitComptoirPourTaille(produitId, parts, table);
  return cle && catalogue ? (catalogue.fiches.find((f) => f.produit.id === cle) ?? null) : null;
}

/**
 * Toucher d'une taille : si le gâteau du comptoir existe à cette taille, la
 * ligne DEVIENT ce produit (quantité 1, prix du catalogue, accords retirés) ;
 * sinon elle redevient le gâteau sur commande à ce nombre de parts.
 */
export function choisirTaille(
  l: LigneEcran,
  parts: number,
  catalogue: CatalogueCommande | null,
  table: readonly CorrespondanceComptoir[],
): LigneEcran {
  const origine = gateauDeLaLigne(l);
  const comptoir = ficheComptoirPourTaille(origine, parts, catalogue, table);
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
// Bloc « Gâteau » et suppléments automatiques (demande du propriétaire, 18/10/2026)
// ---------------------------------------------------------------------------
// Écriture, photo WhatsApp et photo à imprimer s'affichent SOUS LA LIGNE du
// premier gâteau du bon (champs au niveau de la commande en base : un seul
// bloc, même avec plusieurs gâteaux). « Gâteau » = notion du domaine
// (`gateauxDeLigne`, R7), y compris le gâteau du comptoir qui remplace un
// gâteau sur commande (R60). Cocher « photo à imprimer » / écrire un texte
// ajoute le supplément correspondant au bon ; le décocher / vider le texte le
// retire. Le domaine reste juge (R7 : une fois par gâteau, jamais sans gâteau).

/**
 * Identifiants catalogue des suppléments ajoutés automatiquement. Clés de
 * produit (pas de prix : le prix est lu au catalogue reçu, LOI 1).
 */
export const SUPPLEMENT_PHOTO = 'gateaux-sur-commande/supplement-photo';
export const SUPPLEMENT_ECRITURE = 'gateaux-sur-commande/supplement-ecriture-simple';
/** R64 (26/10/2026) : supplément PAR PERSONNE, autant de parts que le gâteau qui le reçoit. */
export const SUPPLEMENT_PATE_A_SUCRE = 'gateaux-sur-commande/supplement-pate-a-sucre';

/** Gâteaux apportés par UNE ligne de l'écran (domaine : `gateauxDeLigne`). */
function gateauxDeLigneEcran(l: LigneEcran, catalogue: CatalogueCommande | null, famillesGateau: readonly string[]): number {
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

/**
 * Ligne sous laquelle s'affiche le bloc « Sur le gâteau » (écriture, photos).
 * Le gâteau choisi sur PHOTO d'abord : c'est sur lui que le client montre ce
 * qu'il veut, et un Cake nature ajouté avant ne doit pas lui voler l'écriture
 * (bug du 28/10/2026 : bloc invisible sous la photo G106). Sinon le premier
 * gâteau. null : aucun gâteau au bon.
 */
export function indexBlocGateau(
  lignes: readonly LigneEcran[],
  catalogue: CatalogueCommande | null,
  famillesGateau: readonly string[],
): number | null {
  const i = lignes.findIndex((l) => l.photoModele && gateauxDeLigneEcran(l, catalogue, famillesGateau) > 0);
  return i < 0 ? indexPremierGateau(lignes, catalogue, famillesGateau) : i;
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

/**
 * Saisie du texte d'écriture. Texte non vide → supplément « Écriture » au bon
 * (s'il n'y est pas : un vendeur qui l'a retiré le voit revenir seulement
 * quand il MODIFIE le texte — jamais de boucle sur un simple rendu) ; texte
 * vidé → supplément retiré.
 */
export function saisirEcriture(
  lignes: readonly LigneEcran[],
  texte: string,
  catalogue: CatalogueCommande | null,
  famillesGateau: readonly string[],
): LigneEcran[] {
  return basculerSupplement(lignes, SUPPLEMENT_ECRITURE, texte.trim() !== '', catalogue, famillesGateau);
}

export type PrecisionsGateau = {
  texteGateau: string;
  sansEcriture: boolean;
  photoWhatsapp: boolean;
  photoImprimee: boolean;
};

/**
 * Précisions « gâteau » réellement enregistrées. Sans gâteau au bon (dernier
 * gâteau retiré), le bloc n'existe plus : rien ne part en base (texte null,
 * cases à false) — la saisie reste en mémoire sur l'écran et réapparaît si un
 * gâteau est remis au bon. Les lignes de supplément ne sont PAS retirées en
 * silence : le domaine les refuse (ERR_SUPPLEMENT_SANS_GATEAU) avec le bouton
 * « Retirer la ligne », visible du vendeur.
 */
export function precisionsAEnregistrer(p: PrecisionsGateau, nbGateaux: number): PrecisionsGateau {
  if (nbGateaux > 0) return { ...p, texteGateau: p.sansEcriture ? '' : p.texteGateau };
  return { texteGateau: '', sansEcriture: false, photoWhatsapp: false, photoImprimee: false };
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
): LigneEcran {
  const avant = gateauDeLaLigne(l);
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
