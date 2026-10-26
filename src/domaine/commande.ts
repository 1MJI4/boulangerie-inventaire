// src/domaine/commande.ts
//
// Orchestrateur des règles d'une commande sur mesure. C'est CE code que la
// route serveur rejoue à la création, à la modification et à la
// synchronisation hors ligne (KO-3 du lot 1) : le serveur ne croit ni le prix
// unitaire ni le total envoyés par la tablette, il les RECALCULE depuis le
// catalogue à la date de prise de commande (R4).
// Propriétaire : agent `regles-metier`.
//
// Ordre des contrôles = ordre des champs à l'écran : statut/modification,
// client, téléphone, date et heure de prise (automatiques), date de retrait,
// heure de retrait, lignes (une par une : quantité, minimum, taille standard, prix du comptoir, prix), délai, jour même /
// lendemain (informations), prix convenu,
// acompte, puis les signalements non bloquants (écriture, commande inhabituelle).

import type { Echec, Resultat, Signalement } from './resultat.ts';
import { succes } from './resultat.ts';
import { signaler } from './messages.ts';
import { multiplier, resteDu, somme } from './argent.ts';
import { dateProduction, estDateISO, formaterDate, validerDateRetrait, validerDelai } from './calendrier.ts';
import type { JourFerme } from './calendrier.ts';
import { FAMILLES_GATEAU, SUPPLEMENTS_PAR_PERSONNE } from './constantes.ts';
import type {
  DelaisCommande,
  RegleSupplementParPersonne,
  ReglementCommande,
  ReglesForme,
  TailleInterdite,
} from './constantes.ts';
import { validerForme } from './formes.ts';
import { validerTailleAutorisee } from './taillesInterdites.ts';
import { controlerSupplementsParPersonne, estSupplementParPersonne } from './supplementsParPersonne.ts';
import { libelleProduitFiche } from './libelles.ts';
import { controlerSupplements, gateauxDeLigne } from './supplements.ts';
import { validerQuantiteMin, validerMaximum, validerTailleGateau } from './minimums.ts';
import { validerGouts, type ChoixGout } from './gouts.ts';
import { deverrouillageValide, prixLigne } from './regimes.ts';
import { gateauSurCommandeDe, validerPrixComptoir } from './prixComptoir.ts';
import type { CorrespondanceComptoir } from './prixComptoir.ts';
import { validerQuantite } from './unites.ts';
import {
  controlerCommandeInhabituelle,
  heureChamp,
  lireHeure,
  validerHeureRetrait,
  validerJourMeme,
  validerLendemain,
} from './reglement.ts';
import {
  controlerEcriture,
  reperesDoublons,
  validerAcompte,
  validerChampObligatoire,
  validerModification,
  validerPrixConvenu,
  validerTelephone,
} from './coherence.ts';
import type { EtatCommandeExistante } from './coherence.ts';
import type {
  BasePrix,
  DateISO,
  Deverrouillage,
  FicheTarifee,
  Forme,
  PrixRegle,
  ProduitRegle,
  RegimePrix,
  Unite,
} from './types.ts';

// ---------------------------------------------------------------------------
// Entrées / sorties
// ---------------------------------------------------------------------------

/** Accès au catalogue de COMMANDE : produit + prix en vigueur à une date. */
export type ResoudreProduit = (produitId: string, date: DateISO) => Resultat<FicheTarifee>;

export type LigneSaisie = {
  /** Produit du catalogue. Absent + `libelle` rempli = ligne libre (« Autre demande »). */
  produitId?: string | null;
  /** Ligne libre uniquement : le libellé d'une ligne catalogue vient du catalogue (LOI 5). */
  libelle?: string | null;
  /** Pièces, parts, ou GRAMMES pour un produit au kilo. */
  quantite: number;
  /**
   * Régime C (prix plancher) : prix par personne / par pièce saisi (absent → plancher).
   * A, B, supplément : prix vu à l'écran, CONTRÔLÉ contre le catalogue (jamais cru).
   * Ligne libre : prix fixé avec le gérant (obligatoire).
   */
  prixUnitaireCentimes?: number | null;
  /** Number Cake : nombre de chiffres/lettres (cf. compterSymboles). */
  nbSymboles?: number | null;
  /** Pain surprise : nombre de sandwichs demandés au total. */
  nbObjets?: number | null;
  /** R62 : goût (ou recette d'entremet) du gâteau, un par étage. */
  gouts?: readonly string[] | null;
  /**
   * R60 + R62 : gâteau sur commande d'origine quand la ligne est devenue le
   * gâteau du comptoir (Bavarois 6 parts → Bavarois 6P). Retenu seulement s'il
   * correspond au produit du comptoir dans la table R60 : son goût reste exigé.
   */
  origineSurCommande?: string | null;
  /**
   * R63 : forme du gâteau (« carre » / « rond »). Exigée de 4 à 8 parts pour les
   * gâteaux de `ContexteCommande.formes` ; au-dessus, carré d'office.
   */
  forme?: string | null;
  /** Accord du gérant : prix sous plancher (C) ou prix d'une ligne libre. */
  deverrouillage?: Deverrouillage | null;
  /**
   * Accord du gérant pour une taille de gâteau hors des tailles standard (LOI 11).
   * Distinct de `deverrouillage` : autoriser un prix n'autorise pas une taille.
   */
  deverrouillageTaille?: Deverrouillage | null;
};

export type LigneControlee = {
  produitId: string | null;
  /** Libellé du catalogue à la lettre, ou libellé libre. */
  libelle: string;
  unite: Unite;
  regimePrix: RegimePrix | null;
  basePrix: BasePrix | null;
  quantite: number;
  /** Prix unitaire APPLIQUÉ (pièce, KILO, personne), à figer sur la ligne (R4). */
  prixUnitaireCentimes: number;
  totalCentimes: number;
  nbSymboles: number | null;
  /** Délai de cette ligne, en jours ouvrés. */
  delaiJoursOuvres: number;
  /** Gâteaux apportés par la ligne, pour les suppléments au forfait (R7, supplements.ts). */
  nbGateaux: number;
  versionCode?: string;
  /** Prix sous plancher ou ligne libre : qui a autorisé, quand (à tracer en base). */
  autorisation?: Deverrouillage;  /** Taille hors standard : qui a autorisé, quand (à tracer en base). */
  autorisationTaille?: Deverrouillage;
  /** R63 : forme retenue (carré d'office au-dessus du seuil), seulement pour un gâteau concerné. */
  forme?: Forme;
  /** R64 : la ligne est un supplément par personne (Pâte à sucre), pas un gâteau. */
  supplementParPersonne?: true;
};

export type CommandeSaisie = {
  client: string;
  telephone: string;
  /**
   * Date de prise de commande : date des PRIX (R4). Enregistrée
   * AUTOMATIQUEMENT par l'appelant (horloge de la tablette), jamais saisie (R56).
   */
  datePrise: DateISO;
  /** Heure locale de prise de commande « HH:MM », automatique comme datePrise (R56). */
  heurePrise: string;
  dateRetrait: DateISO;
  /** Heure de retrait « HH:MM », FACULTATIVE ; si donnée, dans les heures d'ouverture du jour (R54). */
  heureRetrait?: string | null;
  /**
   * @deprecated R53 : le lendemain est accepté sans accord depuis le 15/10/2026.
   * Champ IGNORÉ par le domaine, gardé le temps que l'écran et la route le retirent.
   */
  accordLendemain?: Deverrouillage | null;
  lignes: readonly LigneSaisie[];
  acompteCentimes?: number | null;
  /** Total convenu avec le client, s'il diffère du tarif (remise). */
  totalConvenuCentimes?: number | null;
  /** Accord du gérant pour une remise sur le total. */
  remise?: Deverrouillage | null;
  texteGateau?: string | null;
  sansEcriture?: boolean;
  /** Case « demande inhabituelle » (ingrédients, moules spéciaux…) — R55. */
  demandeInhabituelle?: boolean;
  /** @deprecated ancien nom de `demandeInhabituelle` (données existantes), même effet. */
  gateauComplexe?: boolean;
};

export type ContexteCommande = {
  resoudre: ResoudreProduit;
  /** Lignes de la table JourFerme (dates « AAAA-MM-JJ »). */
  joursFermes: readonly JourFerme[];
  /** Délais en jours ouvrés (DELAIS_PAR_DEFAUT + délai « gâteau à étages » réglé par le gérant). */
  delais: DelaisCommande;
  /** Date de la saisie (création ou modification). Défaut : datePrise. */
  aujourdhui?: DateISO;
  /** Commande en cours de modification, le cas échéant. */
  existante?: EtatCommandeExistante | null;
  /** Donnée (aujourd'hui 2, src/lib/commandes.ts). Requis si `existante`. */
  joursAvantArchivage?: number;
  /** Chiffres du règlement intérieur (REGLEMENT_COMMANDE) : acompte minimum, heures d'ouverture, tailles. */
  reglement: ReglementCommande;
  /**
   * R60 : gâteaux sur commande vendus au prix du comptoir dans certaines tailles
   * (donnée du catalogue, CORRESPONDANCES_COMPTOIR de src/catalogue). Liste vide =
   * règle sans objet.
   */
  correspondancesComptoir: readonly CorrespondanceComptoir[];
  /** R62 : goût demandé par gâteau sur commande (donnée du catalogue). Absent → non contrôlé. */
  goutsSurCommande?: Readonly<Record<string, ChoixGout>>;
  /**
   * R63 : gâteaux qui demandent une forme, seuil du rond, gâteau d'un grand rond
   * (REGLES_FORME). Absent → non contrôlé, comme R62 : à passer dès que l'écran
   * propose les boutons Carré / Rond.
   */
  formes?: ReglesForme;
  /**
   * R64 : suppléments par personne et gâteaux qui les reçoivent. Absent →
   * SUPPLEMENTS_PAR_PERSONNE (toujours contrôlé : la Pâte à sucre est au tarif
   * depuis le 26/10/2026 et les sorties fonctionnent avec l'écran actuel).
   */
  supplementsParPersonne?: Readonly<Record<string, RegleSupplementParPersonne>>;
  /** R65 : tailles qui ne se font pas (TAILLES_INTERDITES). Absent → non contrôlé, comme R62. */
  taillesInterdites?: readonly TailleInterdite[];
};

export type CommandeControlee = {
  /** Date et heure de prise, à enregistrer telles quelles (R56). */
  datePrise: DateISO;
  heurePrise: string;
  lignes: LigneControlee[];
  /** Somme des lignes recalculées depuis le catalogue. */
  totalTarifCentimes: number;
  /** Total à facturer : le tarif, ou le prix convenu autorisé par le gérant. */
  totalCentimes: number;
  acompteCentimes: number;
  resteDuCentimes: number;
  dateRetrait: DateISO;
  /** « HH:MM », ou null si non précisée (facultative). */
  heureRetrait: string | null;
  /**
   * @deprecated R53 : plus jamais renseigné (lendemain accepté sans accord,
   * 15/10/2026). Gardé le temps que la route et la base retirent le champ.
   */
  accordLendemain?: Deverrouillage;
  /** Veille ouvrée du retrait, jamais avant le jour de la saisie (fiche de production, R2d). */
  dateProduction: DateISO | null;
  delaiJoursOuvres: number;
  remise?: Deverrouillage;
};

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------

function prefixerEchec(e: Echec, prefixe: string): Echec {
  return { ...e, champ: prefixe + (e.champ ?? '') };
}

function prefixerSignalement(s: Signalement, prefixe: string): Signalement {
  return { ...s, champ: prefixe + (s.champ ?? '') };
}

/** Libellé affiché : produit + sous-catégorie, chacun à la lettre (LOI 5) : « Bavarois 6P ». */
export function libelleProduit(fiche: FicheTarifee): string {
  return libelleProduitFiche(fiche);
}

/** Délai requis par une fiche : gâteau à étages, sinon selon le régime. */
export function delaiPourFiche(fiche: FicheTarifee, delais: DelaisCommande): number {
  if (typeof fiche.prix.etages === 'number' && fiche.prix.etages > 0) return delais.gateauAEtages;
  const regime = fiche.produit.regimePrix;
  // Régime inconnu : le plus long délai (le plus sûr).
  return regime ? delais.parRegime[regime] : delaiMaximal(delais);
}

function delaiMaximal(delais: DelaisCommande): number {
  return Math.max(delais.gateauAEtages, ...Object.values(delais.parRegime));
}

// ---------------------------------------------------------------------------
// Une ligne
// ---------------------------------------------------------------------------

/** Ce dont le contrôle d'une ligne a besoin. */
export type ContexteLigne = Pick<
  ContexteCommande,
  'resoudre' | 'delais' | 'reglement' | 'correspondancesComptoir' | 'goutsSurCommande' | 'formes' | 'taillesInterdites'
>;

/**
 * Contrôle et RECALCULE une ligne : produit, unité, quantité, minimum,
 * prix selon le régime, maximum (pain surprise).
 * `index` sert à nommer le champ fautif (« lignes[2].quantite »).
 */
export function controlerLigne(
  saisie: LigneSaisie,
  index: number,
  datePrise: DateISO,
  ctx: ContexteLigne,
): Resultat<LigneControlee> {
  const p = `lignes[${index}].`;
  const r = controlerLigneSansPrefixe(saisie, index, datePrise, ctx);
  if (!r.ok) return prefixerEchec(r, p);
  return succes(r.donnees, ...r.signalements.map((s) => prefixerSignalement(s, p)));
}

function controlerLigneSansPrefixe(
  saisie: LigneSaisie,
  index: number,
  datePrise: DateISO,
  ctx: ContexteLigne,
): Resultat<LigneControlee> {
  const produitId = saisie.produitId?.trim() || null;
  const libelleLibre = saisie.libelle?.trim() || '';

  if (!produitId && !libelleLibre) {
    return signaler('ERR_LIGNE_SANS_PRODUIT', {}, { champ: 'produitId', valeurProposee: index });
  }
  if (!produitId) return controlerLigneLibre(saisie, libelleLibre, ctx.delais);

  const resolu = ctx.resoudre(produitId, datePrise);
  if (!resolu.ok) return { ...resolu, champ: resolu.champ ?? 'produitId' };
  const fiche = resolu.donnees;
  const signalements: Signalement[] = [...resolu.signalements];

  const q = validerQuantite(fiche.produit.unite, saisie.quantite);
  if (!q.ok) return q;

  // R65 : taille qui ne se fait pas (Matadi chocolat 4P) — avant le minimum.
  if (ctx.taillesInterdites) {
    const ficheDe = (id: string): FicheTarifee | null => {
      const r = ctx.resoudre(id, datePrise);
      return r.ok ? r.donnees : null;
    };
    const t = validerTailleAutorisee(fiche, saisie.quantite, ctx.taillesInterdites, ficheDe);
    if (!t.ok) return t;
  }

  const nbSymboles = saisie.nbSymboles ?? undefined;
  const min = validerQuantiteMin(fiche, saisie.quantite, { nbSymboles });
  if (!min.ok) return min;

  // Tailles standard (LOI 11) : après le minimum, gâteaux simples seulement.
  const taille = validerTailleGateau(fiche, saisie.quantite, ctx.reglement.taillesGateau, saisie.deverrouillageTaille);
  if (!taille.ok) return taille;
  signalements.push(...taille.signalements);

  // R60 : taille qui existe au comptoir → la ligne doit être le gâteau du comptoir.
  const comptoir = validerPrixComptoir(fiche, saisie.quantite, ctx.correspondancesComptoir);
  if (!comptoir.ok) return comptoir;

  // R62 : goût du gâteau sur commande (un par étage), après la taille. Une
  // ligne devenue gâteau du comptoir (R60) garde le goût du gâteau commandé.
  const origine = gateauSurCommandeDe(fiche.produit.id, ctx.correspondancesComptoir)?.surCommande ?? null;
  const cleGout = saisie.origineSurCommande && saisie.origineSurCommande === origine ? origine : fiche.produit.id;
  const gouts = validerGouts(ctx.goutsSurCommande?.[cleGout], fiche, saisie.gouts);
  if (!gouts.ok) return gouts;

  // R63 : forme du gâteau, après le goût. Ligne devenue gâteau du comptoir (R60) :
  // la forme est celle du gâteau commandé, à ses parts (pas la quantité 1).
  let forme: Forme | null = null;
  if (ctx.formes) {
    const parts = cleGout === fiche.produit.id
      ? saisie.quantite
      : (gateauSurCommandeDe(fiche.produit.id, ctx.correspondancesComptoir)?.parts ?? saisie.quantite);
    const cleRond = ctx.formes.gateauRondGrand;
    const rond = cleRond ? ctx.resoudre(cleRond, datePrise) : null;
    const fo = validerForme(cleGout, libelleProduit(fiche), parts, saisie.forme, ctx.formes, rond?.ok ? rond.donnees : null);
    if (!fo.ok) return fo;
    forme = fo.donnees;
  }

  const prixFixe = !(fiche.produit.regimePrix === 'C' && fiche.prix.prixEstPlancher);
  if (prixFixe && saisie.prixUnitaireCentimes != null && saisie.prixUnitaireCentimes !== fiche.prix.prixCentimes) {
    // L'écran affichait un autre prix que le catalogue à cette date : tablette
    // pas à jour, ou saisie altérée. Jamais corrigé en silence (LOI 1).
    return signaler('ERR_TARIF_INCOHERENT', {}, { champ: 'prixCentimes', valeurProposee: fiche.prix.prixCentimes });
  }

  const prix = prixLigne(fiche, saisie.quantite, {
    prixParPersonneCentimes: prixFixe ? undefined : (saisie.prixUnitaireCentimes ?? undefined),
    deverrouillage: saisie.deverrouillage,
  });
  if (!prix.ok) return prix;
  signalements.push(...prix.signalements);

  if (prix.donnees.totalCentimes <= 0) {
    return signaler('ERR_MONTANT_NUL', { objet: `la ligne « ${fiche.produit.produit} »` }, { champ: 'quantite' });
  }

  if (saisie.nbObjets != null) {
    const max = validerMaximum(fiche, saisie.quantite, saisie.nbObjets);
    if (!max.ok) return max;
    signalements.push(...max.signalements);
  }

  const ligne: LigneControlee = {
    produitId,
    libelle: libelleProduit(fiche),
    unite: fiche.produit.unite,
    regimePrix: prix.donnees.regimePrix,
    basePrix: fiche.prix.basePrix,
    quantite: saisie.quantite,
    prixUnitaireCentimes: prix.donnees.prixUnitaireCentimes,
    totalCentimes: prix.donnees.totalCentimes,
    nbSymboles: nbSymboles ?? null,
    delaiJoursOuvres: delaiPourFiche(fiche, ctx.delais),
    nbGateaux: gateauxDeLigne(
      {
        regimePrix: prix.donnees.regimePrix,
        basePrix: fiche.prix.basePrix,
        quantite: saisie.quantite,
        famille: fiche.produit.famille,
      },
      ctx.reglement.famillesGateau ?? FAMILLES_GATEAU,
    ),
  };
  if (forme) ligne.forme = forme;
  if (estSupplementParPersonne({ famille: fiche.produit.famille, basePrix: fiche.prix.basePrix })) {
    ligne.supplementParPersonne = true;
  }
  if (fiche.prix.versionCode) ligne.versionCode = fiche.prix.versionCode;
  if (prix.donnees.sousPlancher) ligne.autorisation = prix.donnees.sousPlancher;
  if (taille.signalements.length > 0 && saisie.deverrouillageTaille) {
    ligne.autorisationTaille = { par: saisie.deverrouillageTaille.par.trim(), le: saisie.deverrouillageTaille.le };
  }
  return succes(ligne, ...signalements);
}

/**
 * Ligne libre (« Autre demande ? Merci de contacter le gérant » — affiche).
 * HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°3) : son prix n'est pas au
 * catalogue, il est donc fixé AVEC le gérant : déverrouillage obligatoire,
 * prix > 0, quantité en pièces entières, délai le plus long (le plus sûr).
 */
function controlerLigneLibre(saisie: LigneSaisie, libelle: string, delais: DelaisCommande): Resultat<LigneControlee> {
  const q = validerQuantite('piece', saisie.quantite);
  if (!q.ok) return q;
  const prixSaisi = saisie.prixUnitaireCentimes;
  if (prixSaisi == null || !Number.isSafeInteger(prixSaisi) || prixSaisi <= 0) {
    return signaler('ERR_MONTANT_NUL', { objet: `la ligne « ${libelle} »` }, { champ: 'prixCentimes' });
  }
  if (!deverrouillageValide(saisie.deverrouillage)) {
    return signaler(
      'ERR_DROIT_INSUFFISANT',
      { action: 'fixer le prix d’une ligne libre', role: 'gérant' },
      { champ: 'prixCentimes' },
    );
  }
  return succes({
    produitId: null,
    libelle,
    unite: 'piece',
    regimePrix: null,
    basePrix: null,
    quantite: saisie.quantite,
    prixUnitaireCentimes: prixSaisi,
    totalCentimes: multiplier(saisie.quantite, prixSaisi),
    nbSymboles: null,
    delaiJoursOuvres: delaiMaximal(delais),
    // Ligne libre : contenu inconnu, ne porte pas de supplément (le plus sûr).
    nbGateaux: 0,
    autorisation: { par: saisie.deverrouillage.par.trim(), le: saisie.deverrouillage.le },
  });
}

// ---------------------------------------------------------------------------
// La commande
// ---------------------------------------------------------------------------

type Analyse = { blocages: Echec[]; signalements: Signalement[]; donnees: CommandeControlee | null };

function analyser(c: CommandeSaisie, ctx: ContexteCommande): Analyse {
  const blocages: Echec[] = [];
  const signalements: Signalement[] = [];
  const garder = <T>(r: Resultat<T>): T | undefined => {
    if (!r.ok) {
      blocages.push(r);
      return undefined;
    }
    signalements.push(...r.signalements);
    return r.donnees;
  };

  const aujourdhui = ctx.aujourdhui ?? c.datePrise;
  if (!estDateISO(c.datePrise)) {
    blocages.push(signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'date de prise de commande' }, { champ: 'datePrise' }));
    return { blocages, signalements, donnees: null };
  }
  // Heure de prise : automatique (R56). Illisible = horloge ou appelant défaillant.
  const minutesPrise = lireHeure(c.heurePrise);
  if (minutesPrise === null) {
    blocages.push(
      signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'heure de prise de commande' }, { champ: 'heurePrise' }),
    );
    return { blocages, signalements, donnees: null };
  }

  if (ctx.existante) {
    garder(validerModification(ctx.existante, aujourdhui, ctx.joursAvantArchivage ?? 0));
  }
  garder(validerChampObligatoire(c.client, 'nom du client', 'client'));
  garder(validerTelephone(c.telephone));
  const dateRetrait = garder(validerDateRetrait(c.dateRetrait, ctx.joursFermes, aujourdhui));

  // Heure de retrait (R54) : OBLIGATOIRE (propriétaire, 22/10/2026 — elle était
  // facultative depuis le 18/10), dans les heures d'ouverture du jour.
  let heureRetrait: string | null = null;
  garder(validerChampObligatoire(c.heureRetrait ?? '', 'heure de retrait', 'heureRetrait'));
  if (dateRetrait) {
    const h = garder(validerHeureRetrait(dateRetrait, c.heureRetrait, ctx.reglement.horairesOuverture));
    if (h !== undefined) heureRetrait = h;
  }

  const resultatsLignes = c.lignes.map((l, i) => controlerLigne(l, i, c.datePrise, ctx));

  if (c.lignes.length === 0) {
    blocages.push(signaler('ERR_COMMANDE_VIDE', {}, { champ: 'lignes' }));
  }
  const lignes: LigneControlee[] = [];
  let lignesOk = true;
  resultatsLignes.forEach((r) => {
    const l = garder(r);
    if (l) lignes.push(l);
    else lignesOk = false;
  });
  // R7 : suppléments au forfait, une fois par gâteau. Contrôlé seulement si
  // toutes les lignes passent (un gâteau refusé ferait croire à « sans gâteau »).
  if (lignesOk) blocages.push(...controlerSupplements(lignes));
  // R64 : supplément par personne (Pâte à sucre) rattaché à un gâteau admis, aux mêmes parts.
  if (lignesOk) {
    const libelleDe = (cle: string): string => {
      const r = ctx.resoudre(cle, c.datePrise);
      return r.ok ? libelleProduit(r.donnees) : cle;
    };
    blocages.push(
      ...controlerSupplementsParPersonne(
        lignes.map((l) => ({
          produitId: l.produitId,
          libelle: l.libelle,
          quantite: l.quantite,
          forme: l.forme ?? null,
          nbGateaux: l.nbGateaux,
          supplementParPersonne: l.supplementParPersonne === true,
        })),
        ctx.supplementsParPersonne ?? SUPPLEMENTS_PAR_PERSONNE,
        ctx.formes ?? { produits: [], partsMaxRond: 0, gateauRondGrand: null },
        libelleDe,
      ),
    );
  }
  signalements.push(...reperesDoublons(lignes.map((l) => ({ produitId: l.produitId, libelle: l.libelle }))));

  // Délai (n°17) puis jour même / lendemain (R53b, R53). Délai 0 par défaut
  // (jour même autorisé, décision du propriétaire du 18/10/2026) ; seul un
  // gâteau à étages peut être refusé, si le gérant a réglé un délai. Jour même
  // et lendemain ACCEPTÉS avec une simple information (15/10 et 18/10/2026).
  const delai = lignes.length > 0 ? Math.max(...lignes.map((l) => l.delaiJoursOuvres)) : 0;
  let delaiOk = true;
  if (dateRetrait && lignes.length > 0) {
    delaiOk = garder(validerDelai(dateRetrait, aujourdhui, delai, ctx.joursFermes)) !== undefined;
  }
  if (dateRetrait && delaiOk) {
    garder(validerJourMeme(dateRetrait, aujourdhui, ctx.joursFermes));
    garder(validerLendemain(dateRetrait, aujourdhui, ctx.joursFermes));
  }

  const totalTarif = somme(lignes.map((l) => l.totalCentimes));
  let total = totalTarif;
  let acompte = 0;
  if (lignesOk && lignes.length > 0) {
    const convenu = garder(validerPrixConvenu(totalTarif, c.totalConvenuCentimes, c.remise));
    if (convenu !== undefined) total = convenu;
    const a = garder(validerAcompte(c.acompteCentimes ?? 0, total, ctx.reglement.acomptePourcentageMin));
    if (a !== undefined) acompte = a;
  }

  // Gâteau sur commande = ligne vendue par personne (régime C), ou gâteau du
  // comptoir qui le remplace (R60) : lu dans les données, jamais dans le libellé.
  const contientGateau = lignes.some(
    (l) =>
      (l.regimePrix === 'C' && l.basePrix === 'personne' && l.supplementParPersonne !== true) ||
      gateauSurCommandeDe(l.produitId, ctx.correspondancesComptoir) !== null,
  );
  signalements.push(
    ...controlerEcriture({ contientGateau, texteGateau: c.texteGateau, sansEcriture: c.sansEcriture }),
    ...controlerCommandeInhabituelle({
      demandeInhabituelle: c.demandeInhabituelle === true || c.gateauComplexe === true,
      contientLigneLibre: lignes.some((l) => l.produitId === null),
    }),
  );

  if (blocages.length > 0 || !dateRetrait) return { blocages, signalements, donnees: null };

  const donnees: CommandeControlee = {
    datePrise: c.datePrise,
    heurePrise: heureChamp(minutesPrise),
    lignes,
    totalTarifCentimes: totalTarif,
    totalCentimes: total,
    acompteCentimes: acompte,
    resteDuCentimes: resteDu(total, acompte),
    dateRetrait,
    heureRetrait,
    dateProduction: dateProduction(dateRetrait, aujourdhui, ctx.joursFermes),
    delaiJoursOuvres: delai,
  };
  if (total < totalTarif && c.remise) donnees.remise = { par: c.remise.par.trim(), le: c.remise.le };
  return { blocages, signalements, donnees };
}

/**
 * Contrôle complet d'une commande, rejoué tel quel côté serveur.
 * Succès : lignes et totaux RECALCULÉS + tous les avertissements/informations.
 * Échec : le PREMIER blocage dans l'ordre de l'écran (`blocagesCommande` donne
 * la liste complète, pour marquer tous les champs d'un coup).
 */
export function controlerCommande(c: CommandeSaisie, ctx: ContexteCommande): Resultat<CommandeControlee> {
  const a = analyser(c, ctx);
  if (a.blocages.length > 0 || !a.donnees) {
    return a.blocages[0] ?? signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'commande' });
  }
  return succes(a.donnees, ...a.signalements);
}

/** Tous les blocages d'une commande, dans l'ordre de l'écran. */
export function blocagesCommande(c: CommandeSaisie, ctx: ContexteCommande): Echec[] {
  return analyser(c, ctx).blocages;
}

// ---------------------------------------------------------------------------
// Adaptateur catalogue
// ---------------------------------------------------------------------------

type ReponseCatalogue<T> = { ok: true; valeur?: T; donnees?: T } | { ok: false; code: string };

/**
 * Forme STRUCTURELLE de l'API du catalogue (src/catalogue : `creerApiCatalogue`).
 * Le domaine n'importe pas le catalogue : cette interface suffit, et accepte
 * `valeur` (forme actuelle) comme `donnees` (forme `Resultat`).
 */
export type ApiCatalogueMinimale = {
  getProduit(produitId: string): ReponseCatalogue<ProduitRegle>;
  getPrix(produitId: string, date: DateISO): ReponseCatalogue<PrixRegle>;
};

/**
 * Fabrique le `ResoudreProduit` depuis l'API catalogue. Les refus du catalogue
 * sont redits avec les codes du contrat : produit inconnu → ERR_PRODUIT_INCONNU,
 * tout autre refus (pas de tarif à cette date, produit retiré) → ERR_TARIF_ABSENT.
 */
export function resoudreDepuisCatalogue(api: ApiCatalogueMinimale): ResoudreProduit {
  return (produitId, date) => {
    const p = api.getProduit(produitId);
    const produit = p.ok ? (p.valeur ?? p.donnees) : undefined;
    if (!produit) return signaler('ERR_PRODUIT_INCONNU', {}, { champ: 'produitId' });
    const x = api.getPrix(produitId, date);
    const prix = x.ok ? (x.valeur ?? x.donnees) : undefined;
    if (!prix) {
      const dateTexte = estDateISO(date) ? formaterDate(date) : String(date);
      return signaler('ERR_TARIF_ABSENT', { produit: produit.produit, date: dateTexte }, { champ: 'produitId' });
    }
    return succes({ produit, prix });
  };
}
