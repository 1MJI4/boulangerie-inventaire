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

/** Les trois entrées de saisie, jamais mélangées (LOI 6). Le régime est lu sur le produit. */
export const ENTREES: readonly { regime: RegimePrix; titre: string; detail: string }[] = [
  { regime: 'B', titre: 'Salé sur commande', detail: 'Prix fixe à la pièce, minimums bloquants' },
  { regime: 'C', titre: 'Gâteaux sur commande', detail: 'Prix par personne « à partir de »' },
  { regime: 'A', titre: 'Catalogue comptoir', detail: 'Prix du comptoir, à la pièce ou au kilo' },
];

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
  accordLendemain: Deverrouillage | null;
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
    accordLendemain: e.accordLendemain,
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
