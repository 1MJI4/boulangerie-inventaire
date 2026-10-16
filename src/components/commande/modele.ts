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
import type { DateISO, Deverrouillage, FicheTarifee, PrixRegle, ProduitRegle, RegimePrix } from '../../domaine/types.ts';
import type { CommandeSaisie, LigneSaisie, ResoudreProduit } from '../../domaine/commande.ts';
import { resoudreDepuisCatalogue } from '../../domaine/commande.ts';
import { signaler } from '../../domaine/messages.ts';
import { gateauxDeLigne } from '../../domaine/supplements.ts';
import { estGateauSimpleSurCommande } from '../../domaine/minimums.ts';
import type { JourFerme } from '../../domaine/calendrier.ts';
import type { DelaisCommande, ReglementCommande } from '../../domaine/constantes.ts';

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
 * Produits affichés dans la grille. Sans recherche ni rayon choisi : tout le
 * sur-commande (B, C) et, du comptoir (A), les seuls favoris — liste d'accès
 * rapide (LOI 4 : un produit = une fiche, un favori n'apparaît jamais deux fois).
 * Produit sans régime : jamais proposé (il ne peut pas être vendu).
 */
export function fichesVisibles(catalogue: CatalogueCommande, recherche: string, rayon: string | null): FicheCatalogue[] {
  const mots = normaliserRecherche(recherche).split(/\s+/).filter(Boolean);
  return catalogue.fiches.filter((f) => {
    if (f.produit.regimePrix === null) return false;
    if (rayon !== null && f.produit.categorie !== rayon) return false;
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
  if (estGateauSimpleSurCommande(fiche)) {
    let deja: LigneEcran | undefined;
    for (const l of lignes) if (l.produitId === fiche.produit.id) deja = l;
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
 * Supplément au forfait (Photo, Écriture…) : défini par la DONNÉE `basePrix =
 * 'forfait'`, comme le domaine (src/domaine/supplements.ts) — jamais par le nom.
 */
export function estSupplement(fiche: FicheTarifee): boolean {
  return fiche.prix.basePrix === 'forfait';
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
  for (const l of lignes) {
    const f = ficheDe(catalogue, l.produitId);
    if (!f) continue;
    n += gateauxDeLigne(
      { regimePrix: f.produit.regimePrix, basePrix: f.prix.basePrix, quantite: l.quantite ?? 0, famille: f.produit.famille },
      famillesGateau,
    );
  }
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
  nbObjets: number | null;
  /** Goût, garnitures, forme… (texte libre imprimé sur le bon). */
  precision: string;
  /** Accord du gérant (sous plancher ou ligne libre). */
  deverrouillage: Deverrouillage | null;
  /** Accord du gérant pour une taille de gâteau hors standard (LOI 11) — distinct du prix. */
  deverrouillageTaille: Deverrouillage | null;
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
    nbObjets: null,
    precision: '',
    deverrouillage: null,
    deverrouillageTaille: null,
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
