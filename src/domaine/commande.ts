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
import { controlerSupplementEcriture, controlerSupplementPhoto, controlerSupplements, gateauxDeLigne } from './supplements.ts';
import { controlerUnGateauParLigne } from './unGateauParLigne.ts';
import { symbolesDuTexte, validerQuantiteMin, validerMaximum, validerTailleGateau } from './minimums.ts';
import { GOUT_AU_CHOIX, validerGouts, type ChoixGout } from './gouts.ts';
import { deverrouillageValide, prixLigne } from './regimes.ts';
import { gateauSurCommandeDe, validerComptoirSelonGout, validerPrixComptoir } from './prixComptoir.ts';
import type { CorrespondanceComptoir } from './prixComptoir.ts';
import { totalLigne, validerQuantite } from './unites.ts';
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
  /**
   * Ligne ouverte par « Autre demande » (audit du 28/10/2026) : sans libellé,
   * c'est une description à écrire (champ à remplir), pas une ligne « sans produit ».
   */
  ligneLibre?: boolean;
  /** Pièces, parts, ou GRAMMES pour un produit au kilo. */
  quantite: number;
  /**
   * Régime C (prix plancher) : prix par personne / par pièce saisi (absent → plancher).
   * A, B, supplément : prix vu à l'écran, CONTRÔLÉ contre le catalogue (jamais cru).
   * Ligne libre : prix fixé avec le gérant (obligatoire).
   */
  prixUnitaireCentimes?: number | null;
  /**
   * Number Cake : nombre de chiffres ou lettres DÉCLARÉ (boutons). Le texte
   * `formes` le remplace dès qu'il permet de compter (`symbolesDuTexte`) : le
   * nombre suit toujours ce qui est écrit (audit du 28/10/2026).
   */
  nbSymboles?: number | null;
  /** Number Cake : chiffres ou lettres à réaliser, tels que dits par le client (« 25 », « AM »). */
  formes?: string | null;
  /** Number Cake : « Autre forme » (cœur, étoile…) — le texte décrit une forme, il ne se compte pas. */
  formesLibres?: boolean;
  /**
   * Ligne libre (« Autre demande ») : réponse explicite à « C'est un gâteau ? »
   * (audit du 28/10/2026, décision n°8 du propriétaire). Jamais déduite du
   * libellé (LOI 6). null / absent = pas encore répondu → refusé.
   * true : la ligne est UN gâteau — quantité = PARTS, prix par part, goût exigé.
   */
  gateauLibre?: boolean | null;
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
  /**
   * Lot 2 (propriétaire, 28/10/2026 : « une écriture par gâteau ») : ce qui
   * s'écrit sur CE gâteau, orthographe comprise. Gardé seulement si la ligne
   * est un gâteau (`nbGateaux` > 0). Une saisie dont AUCUNE ligne ne porte
   * `texteGateau` / `sansEcriture` / `photoImprimee` est à l'ancien format :
   * l'écriture de la commande va alors au premier gâteau (`CommandeSaisie.texteGateau`).
   */
  texteGateau?: string | null;
  /** Lot 2 : « Pas d'écriture » coché pour CE gâteau (choix explicite). */
  sansEcriture?: boolean | null;
  /** Lot 2 : photo à imprimer SUR ce gâteau (supplément Photo, une fois par gâteau). */
  photoImprimee?: boolean | null;
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
  /**
   * Lot 2 (28/10/2026) : écriture de CE gâteau (null : aucune), « Pas
   * d'écriture », photo à imprimer. Présents seulement sur une ligne gâteau.
   */
  texteGateau?: string | null;
  sansEcriture?: boolean;
  photoImprimee?: boolean;
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
  /**
   * @deprecated lot 2 (28/10/2026) : l'écriture est une donnée de LIGNE
   * (`LigneSaisie.texteGateau`). Lu seulement pour une saisie à l'ancien
   * format (aucune ligne ne porte d'écriture : tablette pas encore à jour,
   * file hors ligne) : il devient l'écriture du PREMIER gâteau.
   */
  texteGateau?: string | null;
  /** @deprecated lot 2 : « Pas d'écriture » de l'ancien format, même repli que `texteGateau`. */
  sansEcriture?: boolean;
  /** @deprecated lot 2 : photo à imprimer de l'ancien format (niveau commande), même repli. */
  photoImprimee?: boolean;
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
  /**
   * Clé catalogue du supplément « Écriture » (SUPPLEMENT_ECRITURE de
   * constantes.ts). Donnée → une écriture sur un gâteau EXIGE ce supplément au
   * bon (décision du propriétaire, 28/10/2026). Absent → non contrôlé, comme R62.
   */
  supplementEcriture?: string | null;
  /**
   * Clé catalogue du supplément « Photo » (SUPPLEMENT_PHOTO de constantes.ts) :
   * une photo à imprimer sur un gâteau EXIGE ce supplément, une fois par
   * gâteau (28/10/2026). Absent → non contrôlé.
   */
  supplementPhoto?: string | null;
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
  return succes(surLeGateau(r.donnees, saisie), ...r.signalements.map((s) => prefixerSignalement(s, p)));
}

/**
 * Lot 2 (propriétaire, 28/10/2026) : écriture, « Pas d'écriture » et photo à
 * imprimer sont gardés sur une ligne qui EST un gâteau (`nbGateaux` > 0,
 * définition de supplements.ts), jamais ailleurs. « Pas d'écriture » vide le texte.
 */
function surLeGateau(
  l: LigneControlee,
  s: Pick<LigneSaisie, 'texteGateau' | 'sansEcriture' | 'photoImprimee'>,
): LigneControlee {
  if (!(l.nbGateaux > 0)) return l;
  const sans = s.sansEcriture === true;
  const texte = sans ? '' : (s.texteGateau ?? '').trim();
  return { ...l, texteGateau: texte === '' ? null : texte, sansEcriture: sans, photoImprimee: s.photoImprimee === true };
}

/** true : au moins une ligne dit son écriture ou sa photo (format « une écriture par gâteau », lot 2). */
export function saisieParGateau(c: Pick<CommandeSaisie, 'lignes'>): boolean {
  return c.lignes.some((l) => l.texteGateau != null || l.sansEcriture != null || l.photoImprimee != null);
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
    // « Autre demande » pas encore décrite : à remplir, discrètement (jamais « supprimez la ligne »).
    if (saisie.ligneLibre === true) {
      return signaler('ERR_CHAMP_OBLIGATOIRE', { champLibelle: CHAMP_DESCRIPTION_LIBRE }, { champ: 'libelle' });
    }
    return signaler('ERR_LIGNE_SANS_PRODUIT', {}, { champ: 'produitId', valeurProposee: index });
  }
  if (!produitId) return controlerLigneLibre(saisie, libelleLibre, ctx.delais);

  const resolu = ctx.resoudre(produitId, datePrise);
  if (!resolu.ok) return { ...resolu, champ: resolu.champ ?? 'produitId' };
  const fiche = resolu.donnees;
  const signalements: Signalement[] = [...resolu.signalements];

  const q = validerQuantite(fiche.produit.unite, saisie.quantite);
  if (!q.ok) return q;

  // Une ligne par gâteau (propriétaire, 28/10/2026) : « 2 × Bavarois 6P » est
  // refusé, sortie « Séparer en 2 gâteaux » (chacun son goût, son écriture…).
  const unGateau = controlerUnGateauParLigne(
    {
      regimePrix: fiche.produit.regimePrix,
      basePrix: fiche.prix.basePrix,
      famille: fiche.produit.famille,
      quantite: saisie.quantite,
      produit: libelleProduit(fiche),
    },
    ctx.reglement.famillesGateau ?? FAMILLES_GATEAU,
  );
  if (unGateau) return unGateau;

  // R65 : taille qui ne se fait pas (Matadi chocolat 4P) — avant le minimum.
  if (ctx.taillesInterdites) {
    const ficheDe = (id: string): FicheTarifee | null => {
      const r = ctx.resoudre(id, datePrise);
      return r.ok ? r.donnees : null;
    };
    const t = validerTailleAutorisee(fiche, saisie.quantite, ctx.taillesInterdites, ficheDe);
    if (!t.ok) return t;
  }

  // Number Cake : le nombre de chiffres ou lettres suit le TEXTE quand il se
  // compte (« 25 » = 2, même si « 1 » a été touché) ; sinon le nombre déclaré.
  const compte = fiche.prix.minParSymbole !== null ? symbolesDuTexte(saisie.formes, saisie.formesLibres === true) : null;
  const nbSymboles = compte ?? saisie.nbSymboles ?? undefined;
  const min = validerQuantiteMin(fiche, saisie.quantite, { nbSymboles });
  if (!min.ok) return min;

  // Tailles standard (LOI 11) : après le minimum, gâteaux simples seulement.
  const taille = validerTailleGateau(fiche, saisie.quantite, ctx.reglement.taillesGateau, saisie.deverrouillageTaille);
  if (!taille.ok) return taille;
  signalements.push(...taille.signalements);

  // R60 : taille qui existe au comptoir → la ligne doit être le gâteau du comptoir.
  // Le goût choisit le produit du comptoir (28/10/2026) : Bavarois goût
  // Framboise en 6 parts = « Bavarois framboise 6P ».
  const comptoir = validerPrixComptoir(fiche, saisie.quantite, ctx.correspondancesComptoir, saisie.gouts);
  if (!comptoir.ok) return comptoir;
  if (saisie.origineSurCommande) {
    const o = ctx.resoudre(saisie.origineSurCommande, datePrise);
    const libelleOrigine = o.ok ? o.donnees.produit.produit : fiche.produit.produit;
    const auGout = validerComptoirSelonGout(fiche.produit.id, saisie.origineSurCommande, saisie.gouts, ctx.correspondancesComptoir, libelleOrigine);
    if (!auGout.ok) return auGout;
  }

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

/** Libellé du champ « description » d'une ligne libre (messages : « Décrivez ce que veut le client. »). */
export const CHAMP_DESCRIPTION_LIBRE = 'Description de la demande';

/** Libellé du champ « C'est un gâteau ? » d'une ligne libre (messages, écran). */
export const CHAMP_GATEAU_LIBRE = 'C’est un gâteau ?';

/** Gâteaux apportés par une ligne libre : 1 si elle est déclarée gâteau (réponse explicite), sinon 0. */
export function gateauxDeLigneLibre(gateauLibre: boolean | null | undefined): number {
  return gateauLibre === true ? 1 : 0;
}

/**
 * Ligne libre (« Autre demande ? Merci de contacter le gérant » — affiche).
 * HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°3) : son prix n'est pas au
 * catalogue, il est donc fixé AVEC le gérant : déverrouillage obligatoire,
 * prix > 0, quantité en pièces entières, délai le plus long (le plus sûr).
 *
 * « C'est un gâteau ? » (audit du 28/10/2026, décision n°8 du propriétaire) :
 * réponse EXPLICITE obligatoire (`gateauLibre`), jamais déduite du libellé
 * (LOI 6). Un gâteau libre exige un nombre de PARTS (la quantité, prix par
 * part) et un goût (sortie « Au choix du pâtissier ») ; il compte pour un
 * gâteau (écriture, photo).
 * HYPOTHÈSE À VALIDER : aucun minimum de parts pour un gâteau libre (aucune
 * donnée ne le fixe) — seulement un nombre entier > 0.
 */
function controlerLigneLibre(saisie: LigneSaisie, libelle: string, delais: DelaisCommande): Resultat<LigneControlee> {
  if (saisie.gateauLibre !== true && saisie.gateauLibre !== false) {
    return signaler('ERR_CHAMP_OBLIGATOIRE', { champLibelle: CHAMP_GATEAU_LIBRE }, { champ: 'gateauLibre' });
  }
  const gateau = saisie.gateauLibre;
  const q = validerQuantite('piece', saisie.quantite);
  if (!q.ok) return q;
  if (gateau && !(saisie.gouts ?? []).some((g) => String(g ?? '').trim() !== '')) {
    return signaler(
      'ERR_GOUT_MANQUANT',
      { produit: libelle, objet: 'le goût', etage: null },
      { champ: 'gouts', valeurProposee: GOUT_AU_CHOIX },
    );
  }
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
    // Gâteau libre : UN gâteau (écriture, photo) ; autre demande : contenu
    // inconnu, ne porte pas de supplément (le plus sûr).
    nbGateaux: gateauxDeLigneLibre(gateau),
    autorisation: { par: saisie.deverrouillage.par.trim(), le: saisie.deverrouillage.le },
  });
}

// ---------------------------------------------------------------------------
// Total pendant la saisie (audit du 28/10/2026)
// ---------------------------------------------------------------------------

/**
 * Montant d'une ligne ENCORE REFUSÉE (forme à choisir, sous le minimum…) quand
 * il se calcule quand même : prix connu au catalogue × quantité connue, par les
 * helpers du domaine (`prixLigne` / `totalLigne`, centimes). null sinon (taille
 * pas choisie, quantité vide, prix sous le plancher, produit absent du tarif…).
 * Sert uniquement à l'AFFICHAGE d'un total provisoire, jamais à l'enregistrement.
 */
export function montantCalculableLigne(saisie: LigneSaisie, datePrise: DateISO, ctx: Pick<ContexteLigne, 'resoudre'>): number | null {
  const produitId = saisie.produitId?.trim() || null;
  if (!produitId) {
    const prix = saisie.prixUnitaireCentimes;
    if (prix == null) return null;
    const t = totalLigne('piece', saisie.quantite, prix);
    return t.ok ? t.donnees : null;
  }
  const resolu = ctx.resoudre(produitId, datePrise);
  if (!resolu.ok) return null;
  const fiche = resolu.donnees;
  const prixFixe = !(fiche.produit.regimePrix === 'C' && fiche.prix.prixEstPlancher);
  const prix = prixLigne(fiche, saisie.quantite, {
    prixParPersonneCentimes: prixFixe ? undefined : (saisie.prixUnitaireCentimes ?? undefined),
    deverrouillage: saisie.deverrouillage,
  });
  return prix.ok && prix.donnees.totalCentimes > 0 ? prix.donnees.totalCentimes : null;
}

export type TotalEnCours = {
  /** Somme des lignes admises ET des lignes refusées dont le montant se calcule. */
  totalCentimes: number;
  /** Montant par ligne (null = pas encore chiffrable), dans l'ordre des lignes. */
  montants: (number | null)[];
  /** true seulement si TOUTES les lignes sont admises : sinon le total est à compléter. */
  complet: boolean;
};

/**
 * Total à annoncer pendant la saisie. Une ligne incomplète n'est JAMAIS
 * présentée comme réglée : `complet` est faux dès qu'une ligne est refusée
 * (même chiffrée) ou pas chiffrable. Aucune ligne → complet (rien à annoncer).
 */
export function totalEnCours(lignes: readonly LigneSaisie[], datePrise: DateISO, ctx: ContexteLigne): TotalEnCours {
  let complet = true;
  const montants = lignes.map((l, i) => {
    const r = controlerLigne(l, i, datePrise, ctx);
    if (r.ok) return r.donnees.totalCentimes;
    complet = false;
    return montantCalculableLigne(l, datePrise, ctx);
  });
  return { totalCentimes: somme(montants.filter((m): m is number => m !== null)), montants, complet };
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
  // Ancien format (tablette pas à jour, file hors ligne) : l'écriture et la photo
  // de la COMMANDE deviennent celles de son premier gâteau (lot 2, 28/10/2026).
  if (!saisieParGateau(c) && (c.texteGateau || c.sansEcriture || c.photoImprimee)) {
    const k = resultatsLignes.findIndex((r) => r.ok && r.donnees.nbGateaux > 0);
    const r = resultatsLignes[k];
    if (r && r.ok) resultatsLignes[k] = { ...r, donnees: surLeGateau(r.donnees, c) };
  }

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
  // Écriture sur un gâteau = supplément « Écriture » au bon, toujours (28/10/2026).
  if (lignesOk && ctx.supplementEcriture) {
    const cle = ctx.supplementEcriture;
    const r = ctx.resoudre(cle, c.datePrise);
    blocages.push(
      ...controlerSupplementEcriture({
        lignes,
        supplementEcriture: cle,
        libelleSupplement: r.ok ? libelleProduit(r.donnees) : undefined,
      }),
    );
  }
  // Photo à imprimer sur un gâteau = supplément Photo, une fois par gâteau (28/10/2026).
  if (lignesOk && ctx.supplementPhoto) {
    const cle = ctx.supplementPhoto;
    const r = ctx.resoudre(cle, c.datePrise);
    blocages.push(
      ...controlerSupplementPhoto({
        lignes,
        supplementPhoto: cle,
        libelleSupplement: r.ok ? libelleProduit(r.donnees) : undefined,
      }),
    );
  }
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
  // Deux lignes du même gâteau = deux gâteaux (28/10/2026) : jamais « à fusionner ».
  signalements.push(...reperesDoublons(lignes.map((l) => ({ produitId: l.produitId, libelle: l.libelle, nbGateaux: l.nbGateaux }))));

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
  // L'écriture se demande PAR GÂTEAU (lot 2, 28/10/2026) : champ `lignes[i].texteGateau`.
  const estGateauSurCommande = (l: LigneControlee) =>
    (l.regimePrix === 'C' && l.basePrix === 'personne' && l.supplementParPersonne !== true) ||
    gateauSurCommandeDe(l.produitId, ctx.correspondancesComptoir) !== null ||
    // Ligne libre déclarée gâteau (« C'est un gâteau ? » : oui).
    (l.produitId === null && l.nbGateaux > 0);
  resultatsLignes.forEach((r, i) => {
    if (!r.ok || !estGateauSurCommande(r.donnees)) return;
    const l = r.donnees;
    signalements.push(
      ...controlerEcriture({ contientGateau: true, texteGateau: l.texteGateau, sansEcriture: l.sansEcriture }).map((s) =>
        prefixerSignalement(s, `lignes[${i}].`),
      ),
    );
  });
  signalements.push(
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
