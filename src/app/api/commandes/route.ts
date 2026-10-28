// src/app/api/commandes/route.ts
//
// Une commande n'est jamais effacée : l'annuler pose un statut, la modifier
// ajoute une ligne d'historique (avec l'ancienne version des lignes, R31).
//
// KO-3 (lot 2) : le serveur ne croit JAMAIS un prix ni un total venus de la
// tablette. Chaque ligne est résolue au catalogue de commande à la date de
// prise (R4), puis le domaine (`controlerCommande`) est REJOUÉ tel quel avec
// les jours fermés et le règlement lus en base ; seuls les montants qu'il
// recalcule sont enregistrés. La base rejoue encore une partie de ces règles
// (déclencheurs) : elle est le filet, le domaine refuse d'abord.
//
// Déverrouillages (prix sous plancher, ligne libre, remise) :
// acceptés SEULEMENT si l'accès gérant est ouvert sur cette tablette (cookie
// vérifié par `gerantActif`), sinon ERR_DROIT_INSUFFISANT — mais seulement si
// le domaine en a besoin : un accord devenu inutile (taille standard, prix au
// plancher ou au-dessus, total = tarif) est ignoré et non enregistré (réserve
// m3, `accordManquant`). L'heure de
// l'accord est celle du serveur. Exception : en modification, un accord DÉJÀ
// enregistré est conservé tel quel s'il couvre encore ce qui est demandé
// (src/components/commande/accords.ts) : ligne → même produit, même prix,
// quantité égale ou inférieure ; remise → même total convenu ET même total
// au tarif. Retrait le JOUR MÊME ou le LENDEMAIN : accepté sans le gérant
// (décisions du 15/10/2026 et du 18/10/2026, LOI 11) — plus aucun accord lu ni
// enregistré pour cela. Sinon : code gérant redemandé.
// Commande prise avant le lot 2 (lignes sans produit du catalogue) : sans le
// gérant, seuls les champs sans effet sur les prix se modifient (réserve 4).
// HYPOTHÈSE À VALIDER : identité déclarée (nom saisi), pas de compte individuel.
//
// File hors ligne de la tablette (28/10/2026, src/lib/serveur/envoiUnique.ts) :
// `idClient` (corps) = `Idempotency-Key` (en-tête), UUID. Une création ou une
// modification déjà reçue sous cet identifiant renvoie la commande telle
// qu'elle est en base (200), sans rien refaire (numéro, lignes, événement) ;
// deux envois simultanés : l'index UNIQUE tranche, le perdant reçoit aussi la
// commande existante. Création : l'heure de prise de la tablette (`priseLe`)
// est retenue si plausible (lirePriseTablette) — tarif, R56 et règles du jour
// de la saisie suivent CETTE date (LOI 1, R4).

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { reponseEchec, traiterErreur } from '@/lib/erreurBase';
import { JOURS_AVANT_ANONYMISATION, MENTION_ANONYME, STATUTS, formaterNumero, lignesSurLeGateau, resumeEcritures } from '@/lib/commandes';
import { dateDuJour } from '@/lib/dateProduction';
import { exigerRole, gerantActif } from '@/lib/auth/garde';
import { nomDeclare } from '@/lib/auth/identite';
import { controlerCommande, type CommandeSaisie, type LigneSaisie } from '@/domaine/commande';
import {
  validerChampObligatoire,
  validerModification,
  validerTelephone,
  validerTransitionStatut,
  type StatutCommande,
} from '@/domaine/coherence';
import { validerHeureRetrait } from '@/domaine/reglement';
import { estLigneAncienTarif, lignesIdentiques, refusAncienTarif } from '@/components/commande/modele';
import {
  accordManquant,
  ligneCouverte,
  memeAccord,
  remiseCouverte,
  tailleCouverte,
  type AccordEnregistre,
  type AccordRecu,
  type AccordsNonConfirmes,
} from '@/components/commande/accords';
import { decalerJours, estDateISO, validerDateRetrait } from '@/domaine/calendrier';
import { JOURS_AVANT_ARCHIVAGE, REGLES_FORME, SUPPLEMENT_ECRITURE, SUPPLEMENT_PHOTO, TAILLES_INTERDITES } from '@/domaine/constantes';
import { signaler } from '@/domaine/messages';
import { changementsLisibles, detailModification, type Apres, type LigneTexte } from '@/components/commande/historique';
import type { Echec } from '@/domaine/resultat';
import type { Deverrouillage } from '@/domaine/types';
import { chargerContexte, correspondancesServeur, priseBruxelles, resoudreServeur } from './contexteServeur';
import { GOUTS_SUR_COMMANDE } from '@/catalogue/goutsSurCommande';
import { getPhotoModele } from '@/catalogue/serveur';
import type { PhotoModele } from '@/catalogue/photosModeles';
import { idsPhotosCites, lirePhotoDeLigne } from '@/components/commande/photosGestion';
import { ecrireUneFois, lireIdClient, lirePriseTablette, TOLERANCE_HORLOGE_MS } from '@/lib/serveur/envoiUnique';
import { journaliser } from '@/lib/journal';

// Base de prix de chaque ligne (pièce / personne / kilo / forfait) : le bon imprime
// « 1 gâteau — 20 PARTS » d'après la DONNÉE, jamais d'après le régime seul (LOI 6).
const inclusions = {
  lignes: { orderBy: { ordre: 'asc' } as const, include: { produitCatalogue: { select: { cleCatalogue: true, categorie: true, nom: true, regimePrix: true } }, prixProduit: { select: { basePrix: true } } } },
  evenements: { orderBy: { quand: 'desc' } as const, take: 20 },
};

function texte(valeur: unknown, max = 200): string {
  return typeof valeur === 'string' ? valeur.trim().slice(0, max) : '';
}

function refus(echec: Echec, route: string) {
  const { corps, statut } = reponseEchec(echec, route);
  return NextResponse.json(corps, { status: statut });
}

function introuvable(route: string) {
  return refus(signaler('ERR_DONNEE_INTROUVABLE', { reference: 'commande' }, { champ: 'id' }), route);
}

/**
 * Lot 2 : écriture, « Pas d'écriture », photo à imprimer d'UNE ligne reçue.
 * Champ absent → non transmis (ancien format) ; le domaine ne les garde que
 * sur une ligne gâteau.
 */
function surLeGateauRecu(l: Record<string, unknown>): Pick<LigneSaisie, 'texteGateau' | 'sansEcriture' | 'photoImprimee'> {
  const r: Pick<LigneSaisie, 'texteGateau' | 'sansEcriture' | 'photoImprimee'> = {};
  if (typeof l.texteGateau === 'string') r.texteGateau = texte(l.texteGateau, 200) || null;
  if (typeof l.sansEcriture === 'boolean') r.sansEcriture = l.sansEcriture;
  if (typeof l.photoImprimee === 'boolean') r.photoImprimee = l.photoImprimee;
  return r;
}

/** Nombre entier tel quel, sinon null (le domaine refuse ce qui n'est pas un entier). */
function entierOuNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : v === null || v === undefined || v === '' ? null : Number.NaN;
}

function jourIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Champs imprimés lus dans le corps reçu (identiques dans les deux chemins de modification). */
function imprimesRecus(corps: Record<string, unknown>) {
  return {
    remarques: texte(corps.remarques, 500) || null,
    photoImprimee: corps.photoImprimee === true,
    photoWhatsapp: corps.photoWhatsapp === true,
    demandeInhabituelle: corps.demandeInhabituelle === true,
    modePaiement: corps.modePaiement === 'virement' ? 'virement' : 'especes',
    zoneDessin: corps.zoneDessin === true,
  };
}

/** Photos de modèle citées par les lignes, lues en base (masquées comprises). */
type PhotosCitees = { connues: Map<string, Pick<PhotoModele, 'id' | 'masquee'>>; dejaSurLaCommande: ReadonlySet<string> };

/**
 * Lit en base les photos citées par les lignes reçues (une lecture par photo
 * distincte, aucune s'il n'y en a pas). Photo inconnue : absente de la carte,
 * refusée ensuite par `lirePhotoDeLigne` ; panne : échec technique typé.
 * `dejaSurLaCommande` : photos que la commande portait déjà (modification) —
 * elles restent permises même masquées depuis.
 */
async function chargerPhotosCitees(
  lignes: unknown,
  dejaSurLaCommande: ReadonlySet<string> = new Set(),
): Promise<{ ok: true; photos: PhotosCitees } | { ok: false; echec: Echec }> {
  const connues: PhotosCitees['connues'] = new Map();
  for (const id of idsPhotosCites(lignes)) {
    const r = await getPhotoModele(id);
    if (r.ok) connues.set(id, r.donnees);
    else if (r.code !== 'ERR_SAISIE_INVALIDE') return { ok: false, echec: r };
  }
  return { ok: true, photos: { connues, dejaSurLaCommande } };
}

/** Réponse d'un envoi déjà reçu : la commande telle qu'elle est, rien n'a été refait. */
function dejaRecue(commande: unknown) {
  return NextResponse.json(commande, { status: 200, headers: { 'Idempotent-Replayed': 'true' } });
}

/** Commande déjà créée sous cet identifiant d'envoi (création), ou null. */
function commandeParIdClient(idClient: string) {
  return prisma.commande.findUnique({ where: { idClient }, include: inclusions });
}

/** Détail de l'événement de création : origine, et arrivée tardive d'une commande gardée sur la tablette. */
function detailCreation(origine: string, priseLe: Date, maintenant: Date): string | null {
  const morceaux: string[] = [];
  if (origine === 'telephone') morceaux.push('Prise par téléphone');
  if (maintenant.getTime() - priseLe.getTime() > TOLERANCE_HORLOGE_MS) {
    const arrivee = priseBruxelles(maintenant);
    morceaux.push(`Gardée sur la tablette (coupure réseau), arrivée au magasin le ${arrivee.datePrise} à ${arrivee.heurePrise}`);
  }
  return morceaux.length > 0 ? morceaux.join(' · ') : null;
}

/* -------------------------------------------------------------------- GET */

export async function GET(request: Request) {
  const garde = exigerRole(request, 'tablette', 'consulter les commandes');
  if (!garde.ok) return garde.reponse;
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    const numero = searchParams.get('numero');
    const statut = searchParams.get('statut');
    const du = searchParams.get('du');
    const au = searchParams.get('au');
    const recherche = texte(searchParams.get('q'), 60);

    if (Number.isSafeInteger(id) && id > 0) {
      const commande = await prisma.commande.findUnique({ where: { id }, include: inclusions });
      if (!commande) return introuvable('GET /api/commandes');
      return NextResponse.json(commande);
    }

    if (numero) {
      const commande = await prisma.commande.findUnique({ where: { numero }, include: inclusions });
      if (!commande) return introuvable('GET /api/commandes');
      return NextResponse.json(commande);
    }

    const where: Prisma.CommandeWhereInput = {};
    if (statut && (STATUTS as readonly string[]).includes(statut)) where.statut = statut;
    if (statut === 'en_cours') where.statut = { in: ['a_imprimer', 'imprimee'] };
    if (du && estDateISO(du)) where.retraitLe = { gte: new Date(`${du}T00:00:00Z`) };
    if (au && estDateISO(au)) {
      where.retraitLe = { ...(where.retraitLe as object), lte: new Date(`${au}T00:00:00Z`) };
    }
    if (recherche) {
      where.OR = [
        { client: { contains: recherche, mode: 'insensitive' } },
        { telephone: { contains: recherche } },
        { numero: { contains: recherche, mode: 'insensitive' } },
      ];
    }

    const commandes = await prisma.commande.findMany({
      where,
      include: inclusions,
      orderBy: [{ retraitLe: 'asc' }, { retraitHeure: 'asc' }],
      take: 200,
    });

    return NextResponse.json(commandes);
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'GET /api/commandes');
    return NextResponse.json(corps, { status: statut });
  }
}

/* ------------------------------------------------- Contrôle d'une saisie */

type LigneEntrante = Record<string, unknown>;

/** Liste de mots reçue (goûts, décorations) : au plus 6, 60 caractères chacun. */
function listeDeMots(v: unknown): string[] {
  return Array.isArray(v) ? v.slice(0, 6).map((m) => texte(m, 60)) : [];
}

/** Accord reçu de la tablette : seul le NOM est lu, l'heure est celle du serveur. */
function lireAccord(brut: unknown): { par: string; le: string } | null {
  if (!brut || typeof brut !== 'object') return null;
  const b = brut as Record<string, unknown>;
  const par = nomDeclare(b.par);
  const le = typeof b.le === 'string' ? b.le : '';
  return par || le ? { par: par || 'manager', le } : null;
}

type Preparation =
  | { ok: false; echec: Echec }
  | {
      ok: true;
      saisie: CommandeSaisie;
      precisions: (string | null)[];
      /** Number Cake : formes à réaliser (« 25 »), par ligne. */
      formes: (string | null)[];
      /** R62 : décorations facultatives, par ligne. */
      decorations: string[][];
      /** Galerie (26/10/2026) : photo de modèle, par ligne (format et existence en base vérifiés). */
      photos: (string | null)[];
      /** Accords confirmés : date serveur, ou date d'origine d'un accord conservé. */
      quand: Map<object, Date>;
      /**
       * Remise conservée SANS le gérant : à revérifier contre les totaux
       * recalculés par le domaine (`remiseCouverte`), connus seulement après.
       */
      remiseConservee: Extract<AccordEnregistre, { type: 'remise' }> | null;
      /**
       * Accords reçus sans gérant et sans accord enregistré qui les couvre.
       * Réserve m3 : refusés seulement si le domaine en a besoin (`accordManquant`),
       * sinon ignorés et non enregistrés.
       */
      nonConfirmes: AccordsNonConfirmes;
    };

/**
 * Lit le corps, vérifie le droit pour chaque déverrouillage, et construit la
 * `CommandeSaisie` du domaine. Les prix envoyés ne servent qu'au contrôle
 * ERR_TARIF_INCOHERENT (tablette pas à jour) : le domaine les recalcule.
 */
function preparer(
  corps: Record<string, unknown>,
  prise: { datePrise: string; heurePrise: string },
  gerant: boolean,
  maintenant: Date,
  accordsExistants: AccordEnregistre[],
  photosCitees: PhotosCitees,
): Preparation {
  const quand = new Map<object, Date>();
  const lignesBrutes = Array.isArray(corps.lignes) ? (corps.lignes as LigneEntrante[]) : [];
  let remiseConservee: Extract<AccordEnregistre, { type: 'remise' }> | null = null;

  // Un accord est confirmé si le gérant est là, ou s'il est déjà enregistré et
  // couvre encore ce qui est demandé (src/components/commande/accords.ts).
  // Sinon il est marqué NON CONFIRMÉ (`enAttente`) : le refus n'est décidé
  // qu'après le domaine, et seulement s'il a servi (réserve m3).
  let enAttente = false;
  const confirmer = (
    accord: AccordRecu | null,
    couvert: (a: AccordEnregistre) => boolean,
  ): Deverrouillage | null => {
    enAttente = false;
    if (!accord) return null;
    const existant = accordsExistants.find((a) => memeAccord(a, accord) && couvert(a));
    if (existant) {
      const d = { par: existant.par, le: existant.le.toISOString() };
      quand.set(d, existant.le);
      if (existant.type === 'remise') remiseConservee = existant;
      return d;
    }
    if (!gerant) enAttente = true;
    const d = { par: accord.par, le: maintenant.toISOString() };
    quand.set(d, maintenant);
    return d;
  };

  const lignes: LigneSaisie[] = [];
  const precisions: (string | null)[] = [];
  const formes: (string | null)[] = [];
  const decorations: string[][] = [];
  const photos: (string | null)[] = [];
  const nonConfirmes: AccordsNonConfirmes = { lignes: [], remise: false };
  for (const [i, l] of lignesBrutes.entries()) {
    // Photo de modèle : format ET présence en base (table PhotoModele), refusée avec
    // un message humain AVANT l'écriture (la clé étrangère n'est que le filet, LOI 9).
    // Masquée par le gérant : refusée sur une nouvelle ligne, gardée si la commande l'avait.
    const v = l.photoModele;
    const photo = lirePhotoDeLigne(
      v,
      typeof v === 'string' ? (photosCitees.connues.get(v) ?? null) : null,
      typeof v === 'string' && photosCitees.dejaSurLaCommande.has(v),
      `lignes[${i}].photoModele`,
    );
    if (!photo.ok) return { ok: false, echec: photo };
    photos.push(photo.valeur);
    const produitId = texte(l.produitId, 200) || null;
    const libelle = produitId ? null : texte(l.libelle, 120);
    const prix = entierOuNull(l.prixUnitaireCentimes);
    const quantite = entierOuNull(l.quantite);
    const cle = `${produitId ?? `libre:${libelle}`}|${prix}`;
    const accord = confirmer(lireAccord(l.deverrouillage), (a) => ligneCouverte(a, { cle, quantite }));
    const prixEnAttente = enAttente;
    // Taille de gâteau hors standard (LOI 11) : accord DISTINCT de l'accord de
    // prix. Confirmé si le gérant est là, ou s'il est déjà enregistré pour ce
    // produit à cette quantité exacte. Le domaine (`validerTailleGateau`, rejoué
    // par `controler`) décide s'il sert.
    const deverrouillageTaille = confirmer(
      lireAccord(l.deverrouillageTaille),
      (a) => tailleCouverte(a, { produitId, quantite }),
    );
    nonConfirmes.lignes[i] = { prix: prixEnAttente, taille: enAttente };
    lignes.push({
      produitId,
      libelle,
      quantite: quantite ?? 0,
      prixUnitaireCentimes: prix,
      nbSymboles: entierOuNull(l.nbSymboles),
      // Number Cake : le texte des chiffres ou lettres est RECOMPTÉ par le domaine
      // (« 25 » = 2, quoi que dise nbSymboles), sauf « Autre forme » (28/10/2026).
      formes: texte(l.formes, 60) || null,
      formesLibres: l.formesLibres === true,
      // Ligne libre : « C'est un gâteau ? » (réponse explicite, jamais déduite du libellé).
      gateauLibre: typeof l.gateauLibre === 'boolean' ? l.gateauLibre : null,
      // Ligne « Autre demande » (sans produit) : « Décrivez la demande » plutôt que « sans produit ».
      ligneLibre: !produitId,
      nbObjets: entierOuNull(l.nbObjets),
      gouts: listeDeMots(l.gouts),
      origineSurCommande: texte(l.origineSurCommande, 200) || null,
      // R63 : transmise telle quelle (texte court) ; le domaine refuse une forme inconnue.
      forme: texte(l.forme, 20) || null,
      deverrouillage: accord,
      deverrouillageTaille,
      // Lot 2 (28/10/2026) : écriture et photo à imprimer PAR GÂTEAU. Absents
      // (tablette pas à jour, file hors ligne) → ancien format : le domaine
      // reporte l'écriture de la commande sur son premier gâteau.
      ...surLeGateauRecu(l),
    });
    precisions.push(texte(l.precision, 200) || null);
    formes.push(texte(l.formes, 60) || null);
    decorations.push(listeDeMots(l.decorations).filter(Boolean));
  }

  // Remise : seul le type est vérifié ici ; les totaux le sont après le domaine.
  const remise = confirmer(lireAccord(corps.remise), (a) => a.type === 'remise');
  nonConfirmes.remise = enAttente;

  const saisie: CommandeSaisie = {
    client: texte(corps.client, 80),
    telephone: texte(corps.telephone, 30),
    // R56 : date et heure de prise (Bruxelles) choisies par la route : heure du serveur,
    // ou heure de la tablette si plausible (lirePriseTablette) — jamais lues ici du corps.
    datePrise: prise.datePrise,
    heurePrise: prise.heurePrise,
    dateRetrait: texte(corps.dateRetrait, 10),
    heureRetrait: texte(corps.heureRetrait, 5) || null,
    lignes,
    acompteCentimes: entierOuNull(corps.acompteCentimes) ?? 0,
    totalConvenuCentimes: entierOuNull(corps.totalConvenuCentimes),
    remise,
    // Ancien format seulement (aucune ligne ne porte son écriture) : repli du domaine.
    texteGateau: texte(corps.texteGateau, 200) || null,
    sansEcriture: corps.sansEcriture === true,
    photoImprimee: corps.photoImprimee === true,
    demandeInhabituelle: corps.demandeInhabituelle === true,
  };
  return { ok: true, saisie, precisions, formes, decorations, photos, quand, remiseConservee, nonConfirmes };
}

/**
 * Réserve m3 : un accord non confirmé n'est refusé que si le domaine a dû
 * s'en servir (taille hors liste, prix sous le plancher, ligne libre, total
 * remisé). Un accord devenu inutile est ignoré : le domaine ne l'a pas tracé,
 * il n'est donc pas enregistré.
 */
function refusAccordManquant(prep: Extract<Preparation, { ok: true }>, r: Ok): Echec | null {
  const manque = accordManquant(prep.nonConfirmes, r.donnees);
  if (!manque) return null;
  if (manque.type === 'remise') {
    return signaler('ERR_DROIT_INSUFFISANT', { action: 'accorder une réduction sur le total', role: 'gérant' }, { champ: 'total' });
  }
  const i = manque.ligne;
  if (manque.type === 'taille') {
    return signaler(
      'ERR_DROIT_INSUFFISANT',
      { action: 'accepter une taille de gâteau hors standard', role: 'gérant' },
      { champ: `lignes[${i}].quantite` },
    );
  }
  const libre = prep.saisie.lignes[i]?.produitId === null;
  return signaler(
    'ERR_DROIT_INSUFFISANT',
    { action: libre ? 'fixer le prix d’une ligne libre' : 'accepter un prix sous le prix « à partir de »', role: 'gérant' },
    { champ: `lignes[${i}].prixCentimes` },
  );
}

/** Rejoue le domaine sur le catalogue en base et les données du jour. */
async function controler(
  saisie: CommandeSaisie,
  route: string,
  aujourdhui: string,
  existante: { statut: StatutCommande; retraitLe: string; anonymiseeLe: string | null } | null,
) {
  const contexte = await chargerContexte(route);
  const ids = saisie.lignes.flatMap((l) => (l.produitId ? [l.produitId] : []));
  const { resoudre, fiches } = await resoudreServeur(ids, saisie.datePrise);
  // R60 : gâteau sur commande au prix du comptoir (correspondances contrôlées en base).
  const correspondances = await correspondancesServeur(ids, saisie.datePrise, contexte.reglement.taillesGateau, route);
  if (!correspondances.ok) return { resultat: correspondances, fiches, contexte };
  const resultat = controlerCommande(saisie, {
    resoudre,
    joursFermes: contexte.joursFermes,
    delais: contexte.delais,
    reglement: contexte.reglement,
    correspondancesComptoir: correspondances.donnees,
    goutsSurCommande: GOUTS_SUR_COMMANDE,
    // R63 (forme carré / rond) et R65 (tailles qui ne se font pas), décisions du 26/10/2026.
    formes: REGLES_FORME,
    taillesInterdites: TAILLES_INTERDITES,
    // Écriture sur un gâteau = supplément Écriture au bon, toujours (28/10/2026).
    supplementEcriture: SUPPLEMENT_ECRITURE,
    // Photo à imprimer sur un gâteau = supplément Photo, une fois par gâteau (28/10/2026).
    supplementPhoto: SUPPLEMENT_PHOTO,
    aujourdhui,
    existante,
    joursAvantArchivage: JOURS_AVANT_ARCHIVAGE,
  });
  return { resultat, fiches, contexte };
}

type Controle = Awaited<ReturnType<typeof controler>>;
type Ok = Extract<Controle['resultat'], { ok: true }>;

/** Lignes à créer, aux prix RECALCULÉS par le domaine, avec la version de tarif appliquée. */
function lignesAEnregistrer(r: Ok, fiches: Controle['fiches'], prep: Extract<Preparation, { ok: true }>) {
  return r.donnees.lignes.map((l, ordre) => {
    const fiche = l.produitId ? fiches.get(l.produitId) : undefined;
    const accord = prep.saisie.lignes[ordre].deverrouillage;
    const accordLe = l.autorisation ? ((accord && prep.quand.get(accord)) ?? new Date(l.autorisation.le)) : null;
    // Taille hors standard (LOI 11) : accord distinct, tracé dans ses propres colonnes.
    const accordTaille = prep.saisie.lignes[ordre].deverrouillageTaille;
    const tailleLe = l.autorisationTaille
      ? ((accordTaille && prep.quand.get(accordTaille)) ?? new Date(l.autorisationTaille.le))
      : null;
    const libre = l.produitId === null;
    return {
      libelle: l.libelle,
      quantite: l.quantite,
      prixCentimes: l.prixUnitaireCentimes,
      unite: l.unite,
      precision: prep.precisions[ordre],
      ordre,
      nbSymboles: l.nbSymboles,
      formes: prep.formes[ordre],
      // R63 : forme RETENUE par le domaine (carré d'office au-dessus du seuil), null si non concerné.
      forme: l.forme ?? null,
      gouts: [...(prep.saisie.lignes[ordre].gouts ?? [])],
      decorations: prep.decorations[ordre],
      photoModele: prep.photos[ordre] ?? null,
      nbObjets: prep.saisie.lignes[ordre].nbObjets ?? null,
      // Lot 2 : écriture et photo à imprimer de CE gâteau (domaine), NULL hors gâteau.
      texteGateau: l.nbGateaux > 0 ? (l.texteGateau ?? null) : null,
      sansEcriture: l.nbGateaux > 0 ? l.sansEcriture === true : null,
      photoImprimee: l.nbGateaux > 0 ? l.photoImprimee === true : null,
      produitCatalogueId: fiche ? fiche.produit.idBase : null,
      prixProduitId: fiche ? fiche.prix.prixProduitId : null,
      sousPlancherAutorisePar: !libre && l.autorisation ? l.autorisation.par : null,
      sousPlancherAutoriseLe: !libre && l.autorisation ? accordLe : null,
      ligneLibreAutoriseePar: libre && l.autorisation ? l.autorisation.par : null,
      ligneLibreAutoriseeLe: libre && l.autorisation ? accordLe : null,
      tailleAutoriseePar: l.autorisationTaille ? l.autorisationTaille.par : null,
      tailleAutoriseeLe: tailleLe,
    };
  });
}

/**
 * Champs « gâteau » de la COMMANDE, déduits des lignes contrôlées (lot 2) :
 * `texteGateau` = résumé des écritures (« A · B »), encore lu par la liste des
 * commandes ; `sansEcriture` = tous les gâteaux sans écriture ; `photoImprimee`
 * = au moins un gâteau porte une photo à imprimer.
 */
function surLeGateauCommande(r: Ok) {
  const gateaux = r.donnees.lignes.filter((l) => l.nbGateaux > 0);
  return {
    texteGateau: resumeEcritures(gateaux.map((l) => l.texteGateau)),
    sansEcriture: gateaux.length > 0 && gateaux.every((l) => l.sansEcriture === true),
    photoImprimee: gateaux.some((l) => l.photoImprimee === true),
  };
}

/** Champs de la commande issus du contrôle (jamais des montants reçus). */
function champsCommande(r: Ok, prep: Extract<Preparation, { ok: true }>) {
  const d = r.donnees;
  // Heure de l'accord : celle fixée par le serveur (ou celle d'un accord conservé).
  const quand = (x: Deverrouillage) => prep.quand.get(x) ?? new Date(x.le);
  const remise = d.remise ? prep.saisie.remise : null;
  return {
    retraitLe: new Date(`${d.dateRetrait}T00:00:00Z`),
    retraitHeure: d.heureRetrait,
    acompteCentimes: d.acompteCentimes,
    totalCentimes: d.totalCentimes,
    totalTarifCentimes: d.totalTarifCentimes,
    remiseAutoriseePar: remise ? d.remise!.par : null,
    remiseAutoriseeLe: remise ? quand(remise) : null,
    // Avertissements affichés puis passés outre : ceux recalculés par le serveur.
    avertissements: r.signalements.length > 0 ? JSON.stringify(r.signalements.map(({ code, message, champ }) => ({ code, message, champ }))) : null,
  };
}

/* ------------------------------------------------------------------- POST */

export async function POST(request: Request) {
  const garde = exigerRole(request, 'tablette', 'prendre une commande');
  if (!garde.ok) return garde.reponse;
  const route = 'POST /api/commandes';
  try {
    const corps = (await request.json()) as Record<string, unknown>;
    // File hors ligne : déjà créée sous cet identifiant → renvoyée telle quelle,
    // AVANT tout contrôle (le renvoi ne doit pas échouer sur une règle ou un
    // réglage qui a changé depuis la première réception).
    const id = lireIdClient(corps.idClient, request.headers.get('Idempotency-Key'));
    if (!id.ok) return refus(id, route);
    const idClient = id.idClient;
    if (idClient) {
      const existante = await commandeParIdClient(idClient);
      if (existante) return dejaRecue(existante);
    }

    // HYPOTHÈSE À VALIDER : identité déclarée par la tablette, pas de compte individuel (décision 15/10/2026)
    const vendeur = nomDeclare(corps.vendeur);
    if (!vendeur) {
      return refus(signaler('ERR_CHAMP_OBLIGATOIRE', { champLibelle: 'nom du vendeur' }, { champ: 'vendeur' }), route);
    }

    const maintenant = new Date();
    // Heure de prise : celle de la tablette si plausible, sinon celle du serveur.
    const priseLue = lirePriseTablette(corps.priseLe, maintenant);
    if (!priseLue.ok) return refus(priseLue, route);
    if (priseLue.source === 'futur') {
      journaliser({
        niveau: 'avertissement',
        code: 'INFO_HYPOTHESE',
        route,
        piste: 'Heure de prise de la tablette dans le futur (horloge en avance) : heure du serveur retenue. Vérifier l’horloge de la tablette.',
      });
    }
    const priseLe = priseLue.instant;
    // Tarif (R4), date/heure de prise (R56) et « jour de la saisie » : date de PRISE.
    const prise = priseBruxelles(priseLe);
    const photos = await chargerPhotosCitees(corps.lignes);
    if (!photos.ok) return refus(photos.echec, route);
    const prep = preparer(corps, prise, gerantActif(request, garde.tablette), maintenant, [], photos.photos);
    if (!prep.ok) return refus(prep.echec, route);

    const { resultat, fiches, contexte } = await controler(prep.saisie, route, prise.datePrise, null);
    if (!resultat.ok) return refus(resultat, route);
    const manque = refusAccordManquant(prep, resultat);
    if (manque) return refus(manque, route);
    // Commande gardée sur la tablette : son jour de retrait a pu passer pendant
    // la coupure. R53 rejoué au jour d'ARRIVÉE : elle reste « à reprendre » sur la
    // tablette plutôt que d'arriver déjà en retard sans que personne ne l'ait produite.
    // HYPOTHÈSE À VALIDER (docs/QUESTIONS-GERANT.md, question 91).
    const jourArrivee = priseBruxelles(maintenant).datePrise;
    if (jourArrivee !== prise.datePrise) {
      const encore = validerDateRetrait(resultat.donnees.dateRetrait, contexte.joursFermes, jourArrivee);
      if (!encore.ok) return refus(encore, route);
    }

    const origine = corps.origine === 'telephone' ? 'telephone' : 'comptoir';
    const modePaiement = corps.modePaiement === 'virement' ? 'virement' : 'especes';
    const annee = Number(resultat.donnees.dateRetrait.slice(0, 4));

    // Numérotation dans la transaction : deux vendeurs qui valident en même
    // temps n'obtiennent jamais le même numéro (communication du virement).
    // Une seule fois par identifiant : course entre deux envois jumeaux → l'index
    // UNIQUE "Commande_idClient_key" fait échouer le perdant, qui relit le gagnant.
    const { resultat: commande, rejoue } = await ecrireUneFois(idClient, commandeParIdClient, () => prisma.$transaction(async (tx) => {
      const derniere = await tx.commande.findFirst({
        where: { annee },
        orderBy: { sequence: 'desc' },
        select: { sequence: true },
      });
      const sequence = (derniere?.sequence ?? 0) + 1;

      return tx.commande.create({
        data: {
          numero: formaterNumero(annee, sequence),
          annee,
          sequence,
          client: prep.saisie.client,
          telephone: prep.saisie.telephone,
          vendeur,
          origine,
          priseLe,
          idClient,
          modePaiement,
          // Au comptoir l'argent est là (reçu à la prise) ; au téléphone il arrive par virement.
          acompteRecuLe: modePaiement === 'especes' && resultat.donnees.acompteCentimes > 0 ? priseLe : null,
          ...surLeGateauCommande(resultat),
          photoWhatsapp: corps.photoWhatsapp === true,
          demandeInhabituelle: prep.saisie.demandeInhabituelle === true,
          // Zone « dessin, précisions » sur les exemplaires internes : seulement si demandée (21/10/2026).
          zoneDessin: corps.zoneDessin === true,
          remarques: texte(corps.remarques, 500) || null,
          ...champsCommande(resultat, prep),
          lignes: { create: lignesAEnregistrer(resultat, fiches, prep) },
          evenements: {
            create: {
              auteur: vendeur,
              action: 'creation',
              // Prise hors ligne : l'événement date de la prise, l'arrivée est notée.
              quand: priseLe,
              detail: detailCreation(origine, priseLe, maintenant),
            },
          },
        },
        include: inclusions,
      });
    }));

    return rejoue ? dejaRecue(commande) : NextResponse.json(commande, { status: 201 });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, route);
    return NextResponse.json(corps, { status: statut });
  }
}

/* ------------------------------------------------------------------ PATCH */

// Historique et réimpression : src/components/commande/historique.ts (testé).
// Tout champ imprimé sur le bon compte (audit du 28/10/2026).

export async function PATCH(request: Request) {
  const garde = exigerRole(request, 'tablette', 'modifier une commande');
  if (!garde.ok) return garde.reponse;
  const route = 'PATCH /api/commandes';
  try {
    const corps = (await request.json()) as Record<string, unknown>;
    const id = Number(corps.id);
    // HYPOTHÈSE À VALIDER : identité déclarée par la tablette, pas de compte individuel (décision 15/10/2026)
    const auteur = nomDeclare(corps.auteur) || 'inconnu';
    const action = texte(corps.action, 30);

    if (!Number.isSafeInteger(id) || id <= 0) return introuvable(route);
    // File hors ligne : modification déjà appliquée sous cet identifiant → la
    // commande telle qu'elle est, rien n'est refait (lignes, événement, statut).
    const lu = lireIdClient(corps.idClient, request.headers.get('Idempotency-Key'));
    if (!lu.ok) return refus(lu, route);
    const idClient = lu.idClient;
    const modificationParIdClient = async (cle: string) => {
      const ev = await prisma.evenementCommande.findUnique({ where: { idClient: cle }, select: { commandeId: true } });
      return ev && ev.commandeId === id ? prisma.commande.findUnique({ where: { id }, include: inclusions }) : null;
    };
    if (idClient) {
      const ev = await prisma.evenementCommande.findUnique({ where: { idClient }, select: { commandeId: true } });
      // Même identifiant sur une AUTRE commande : jamais appliqué à l'aveugle.
      if (ev && ev.commandeId !== id) {
        return refus(signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'identifiant d’envoi de la tablette' }, { champ: 'idClient' }), route);
      }
      if (ev) {
        const deja = await prisma.commande.findUnique({ where: { id }, include: inclusions });
        if (deja) return dejaRecue(deja);
      }
    }
    const existante = await prisma.commande.findUnique({
      where: { id },
      include: { lignes: { orderBy: { ordre: 'asc' }, include: { produitCatalogue: { select: { cleCatalogue: true, categorie: true, nom: true, regimePrix: true } }, prixProduit: { select: { basePrix: true } } } } },
    });
    if (!existante) return introuvable(route);

    const maintenant = new Date();
    const statut = existante.statut as StatutCommande;
    const donnees: Prisma.CommandeUpdateInput = {};
    let detail: string | null = null;
    let nouvellesLignes: ReturnType<typeof lignesAEnregistrer> | null = null;
    // Commande à l'ancien tarif : seule l'écriture des gâteaux change sur les lignes (lot 2).
    let majEcritures: { id: number; texteGateau: string | null; sansEcriture: boolean | null; photoImprimee: boolean | null }[] | null = null;

    const transition = (vers: StatutCommande, articles?: { id: string; remis: boolean }[]) => {
      const r = validerTransitionStatut(statut, vers, { articles });
      return r.ok ? null : r;
    };

    switch (action) {
      case 'impression': {
        // Réimprimer une commande remise ou annulée ne change pas son statut.
        if (statut === 'a_imprimer' || statut === 'imprimee') {
          const r = transition('imprimee');
          if (r) return refus(r, route);
          donnees.statut = 'imprimee';
          donnees.imprimeeLe = maintenant;
        }
        detail = 'Feuillets sortis';
        break;
      }

      case 'remise': {
        // R58 : décompte des articles devant le client. On part des lignes EN BASE :
        // un article absent de la liste envoyée compte comme non remis.
        const recus = Array.isArray(corps.articles) ? (corps.articles as { id?: unknown; remis?: unknown }[]) : [];
        const articles = existante.lignes.map((l) => ({
          id: String(l.id),
          remis: recus.some((a) => String(a.id) === String(l.id) && a.remis === true),
        }));
        const r = transition('remise', articles);
        if (r) return refus(r, route);
        donnees.statut = 'remise';
        donnees.remiseLe = maintenant;
        // Le solde est encaissé au moment où la commande part.
        if (!existante.acompteRecuLe) donnees.acompteRecuLe = maintenant;
        detail = `Décompte fait devant le client : ${articles.length} article${articles.length > 1 ? 's' : ''}`;
        break;
      }

      case 'acompte':
        donnees.acompteRecuLe = maintenant;
        detail = 'Virement constaté';
        break;

      case 'annulation': {
        const r = transition('annulee');
        if (r) return refus(r, route);
        donnees.statut = 'annulee';
        donnees.annuleeLe = maintenant;
        donnees.motif = texte(corps.motif, 200) || 'Sans motif';
        detail = donnees.motif as string;
        break;
      }

      case 'modification': {
        // Prix au tarif de la date de PRISE d'origine (R4) ; « aujourd'hui » = jour de la modification.
        const prise = priseBruxelles(existante.priseLe);
        const aujourdhui = priseBruxelles(maintenant).datePrise;
        const etatExistant = {
          statut,
          retraitLe: jourIso(existante.retraitLe),
          anonymiseeLe: existante.anonymiseeLe ? existante.anonymiseeLe.toISOString() : null,
        };
        const gerant = gerantActif(request, garde.tablette);
        const lignesRecues = Array.isArray(corps.lignes) ? (corps.lignes as LigneEntrante[]) : [];
        let apres: Apres;
        let lignesApres: LigneTexte[];

        if (!gerant && existante.lignes.some(estLigneAncienTarif)) {
          // Réserve 4 : commande prise avec l'ancien tarif. Ses lignes ne sont pas
          // au catalogue (prix invérifiable) : sans le gérant, UN seul refus clair
          // plutôt qu'un refus par ligne. Les changements sans effet sur les prix
          // (client, téléphone, heure, écriture, remarques) restent possibles :
          // lignes, date et montants sont repris de la base, rien n'est recalculé.
          const figee = validerModification(etatExistant, aujourdhui, JOURS_AVANT_ARCHIVAGE);
          if (!figee.ok) return refus(figee, route);
          const convenu = entierOuNull(corps.totalConvenuCentimes);
          const sansEffetPrix =
            lignesIdentiques(existante.lignes, lignesRecues) &&
            texte(corps.dateRetrait, 10) === etatExistant.retraitLe &&
            (entierOuNull(corps.acompteCentimes) ?? 0) === existante.acompteCentimes &&
            (convenu === null || convenu === existante.totalCentimes);
          if (!sansEffetPrix) return refus(refusAncienTarif(), route);
          const client = validerChampObligatoire(texte(corps.client, 80), 'nom du client', 'client');
          if (!client.ok) return refus(client, route);
          const telephone = validerTelephone(texte(corps.telephone, 30));
          if (!telephone.ok) return refus(telephone, route);
          const contexte = await chargerContexte(route);
          // Heure facultative, dans les heures d'ouverture du jour (R54, 18/10/2026).
          const heure = validerHeureRetrait(
            etatExistant.retraitLe,
            texte(corps.heureRetrait, 5) || null,
            contexte.reglement.horairesOuverture,
          );
          if (!heure.ok) return refus(heure, route);
          // Lot 2 : écriture par gâteau reçue → mise sur les lignes en base (mêmes
          // lignes, même ordre : `lignesIdentiques`). La photo à imprimer change
          // le prix (supplément) : reprise de la base. Ancien format : champ de la commande.
          const recues = lignesRecues.map((l) => surLeGateauRecu(l));
          const parGateau = recues.some((l) => l.texteGateau != null || l.sansEcriture != null);
          const avant = lignesSurLeGateau(existante);
          const ecrites = existante.lignes.map((l, i) => {
            if (!parGateau) return l;
            const sans = recues[i]?.sansEcriture === true;
            return { ...l, texteGateau: sans ? null : (recues[i]?.texteGateau ?? null), sansEcriture: sans, photoImprimee: avant[i]?.photoImprimee === true };
          });
          lignesApres = ecrites;
          if (parGateau) {
            majEcritures = ecrites.map((l) => ({ id: l.id, texteGateau: l.texteGateau, sansEcriture: l.sansEcriture, photoImprimee: l.photoImprimee }));
          }
          const texteGateau = parGateau ? resumeEcritures(ecrites.map((l) => l.texteGateau)) : texte(corps.texteGateau, 200) || null;
          Object.assign(donnees, {
            client: client.donnees,
            telephone: telephone.donnees,
            retraitHeure: heure.donnees,
            texteGateau,
            sansEcriture: parGateau ? existante.sansEcriture : corps.sansEcriture === true,
            demandeInhabituelle: corps.demandeInhabituelle === true,
            photoWhatsapp: corps.photoWhatsapp === true,
            photoImprimee: parGateau ? existante.photoImprimee : corps.photoImprimee === true,
            zoneDessin: corps.zoneDessin === true,
            remarques: texte(corps.remarques, 500) || null,
            modePaiement: corps.modePaiement === 'virement' ? 'virement' : 'especes',
          });
          apres = {
            ...imprimesRecus(corps),
            client: client.donnees,
            telephone: telephone.donnees,
            dateRetrait: etatExistant.retraitLe,
            heureRetrait: heure.donnees,
            texteGateau,
            photoImprimee: parGateau ? existante.photoImprimee : corps.photoImprimee === true,
            totalCentimes: existante.totalCentimes,
            acompteCentimes: existante.acompteCentimes,
          };
        } else {
          const accords: AccordEnregistre[] = [
            ...existante.lignes.flatMap((l): AccordEnregistre[] => {
              const par = l.sousPlancherAutorisePar ?? l.ligneLibreAutoriseePar;
              const le = l.sousPlancherAutoriseLe ?? l.ligneLibreAutoriseeLe;
              if (!par || !le) return [];
              const cleProduit = l.produitCatalogueId !== null ? l.produitCatalogue?.cleCatalogue : `libre:${l.libelle}`;
              return cleProduit ? [{ type: 'ligne', cle: `${cleProduit}|${l.prixCentimes}`, par, le, quantite: l.quantite }] : [];
            }),
            ...existante.lignes.flatMap((l): AccordEnregistre[] => {
              const cle = l.produitCatalogue?.cleCatalogue;
              if (!cle || !l.tailleAutoriseePar || !l.tailleAutoriseeLe) return [];
              return [{ type: 'taille', cle, par: l.tailleAutoriseePar, le: l.tailleAutoriseeLe, quantite: l.quantite }];
            }),
            ...(existante.remiseAutoriseePar && existante.remiseAutoriseeLe
              ? [
                  {
                    type: 'remise' as const,
                    par: existante.remiseAutoriseePar,
                    le: existante.remiseAutoriseeLe,
                    totalCentimes: existante.totalCentimes,
                    totalTarifCentimes: existante.totalTarifCentimes,
                  },
                ]
              : []),
          ];

          const photos = await chargerPhotosCitees(
            corps.lignes,
            new Set(existante.lignes.flatMap((l) => (l.photoModele ? [l.photoModele] : []))),
          );
          if (!photos.ok) return refus(photos.echec, route);
          const prep = preparer(corps, prise, gerant, maintenant, accords, photos.photos);
          if (!prep.ok) return refus(prep.echec, route);
          const { resultat, fiches } = await controler(prep.saisie, route, aujourdhui, etatExistant);
          if (!resultat.ok) return refus(resultat, route);
          const manque = refusAccordManquant(prep, resultat);
          if (manque) return refus(manque, route);
          // Remise déjà enregistrée : elle ne couvre que les totaux que le gérant a vus.
          // Totaux changés → gérant présent : nouvel accord à l'heure du serveur ;
          // gérant absent : refus, code redemandé.
          if (
            prep.remiseConservee &&
            resultat.donnees.remise &&
            !remiseCouverte(prep.remiseConservee, resultat.donnees)
          ) {
            if (gerant && prep.saisie.remise) prep.quand.set(prep.saisie.remise, maintenant);
            else return refus(
              signaler('ERR_DROIT_INSUFFISANT', { action: 'accorder une réduction sur le total', role: 'gérant' }, { champ: 'total' }),
              route,
            );
          }

          nouvellesLignes = lignesAEnregistrer(resultat, fiches, prep);
          Object.assign(donnees, champsCommande(resultat, prep), {
            client: prep.saisie.client,
            telephone: prep.saisie.telephone,
            ...surLeGateauCommande(resultat),
            demandeInhabituelle: prep.saisie.demandeInhabituelle === true,
            photoWhatsapp: corps.photoWhatsapp === true,
            zoneDessin: corps.zoneDessin === true,
            remarques: texte(corps.remarques, 500) || null,
            modePaiement: corps.modePaiement === 'virement' ? 'virement' : 'especes',
          });
          apres = {
            ...imprimesRecus(corps),
            client: prep.saisie.client,
            telephone: prep.saisie.telephone,
            dateRetrait: resultat.donnees.dateRetrait,
            heureRetrait: resultat.donnees.heureRetrait,
            texteGateau: surLeGateauCommande(resultat).texteGateau,
            photoImprimee: surLeGateauCommande(resultat).photoImprimee,
            demandeInhabituelle: prep.saisie.demandeInhabituelle === true,
            totalCentimes: resultat.donnees.totalCentimes,
            acompteCentimes: resultat.donnees.acompteCentimes,
          };
          lignesApres = nouvellesLignes;
        }

        // Commande ancienne : son écriture se lit sur son premier gâteau (même
        // lecture que l'écran et le bon) — sinon tout passerait pour « changé ».
        const changements = changementsLisibles({ ...existante, lignes: lignesSurLeGateau(existante) }, apres, lignesApres);

        // Une commande modifiée repasse par l'imprimante : le feuillet accroché ne dit plus la vérité.
        const aReimprimer = changements.length > 0 && statut === 'imprimee';
        if (aReimprimer) {
          const r = transition('a_imprimer');
          if (r) return refus(r, route);
          donnees.statut = 'a_imprimer';
          donnees.imprimeeLe = null;
        }
        // Marqueur « à réimprimer » EN TÊTE, jamais coupé (bandeau « MODIFIÉE » du bon).
        detail = detailModification(changements, aReimprimer);
        break;
      }

      default:
        return refus(signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'action' }, { champ: 'action' }), route);
    }

    const lignes = nouvellesLignes;
    // Une seule fois par identifiant : l'événement porte l'idClient (index UNIQUE) ;
    // un envoi jumeau perd au COMMIT, sa transaction (lignes comprises) est annulée.
    const { resultat: commande, rejoue } = await ecrireUneFois(idClient, modificationParIdClient, () => prisma.$transaction(async (tx) => {
      if (lignes) {
        await tx.ligneCommande.deleteMany({ where: { commandeId: id } });
        await tx.ligneCommande.createMany({ data: lignes.map((l) => ({ ...l, commandeId: id })) });
      }
      if (majEcritures) {
        for (const { id: ligneId, ...ecriture } of majEcritures) {
          await tx.ligneCommande.update({ where: { id: ligneId }, data: ecriture });
        }
      }
      return tx.commande.update({
        where: { id },
        data: { ...donnees, evenements: { create: { auteur, action, detail, idClient } } },
        include: inclusions,
      });
    }));

    return rejoue ? dejaRecue(commande) : NextResponse.json(commande);
  } catch (error) {
    const { corps, statut } = traiterErreur(error, route);
    return NextResponse.json(corps, { status: statut });
  }
}

/* -------------------------------------------------------------- Entretien */

/**
 * Archivage à J+2, anonymisation à 30 jours. Appelée par l'application au
 * chargement de la liste : pas de tâche planifiée à surveiller.
 */
export async function PUT(request: Request) {
  const garde = exigerRole(request, 'tablette', 'ranger les commandes passées');
  if (!garde.ok) return garde.reponse;
  try {
    const aujourdhui = dateDuJour();
    const limiteArchivage = new Date(`${decalerJours(aujourdhui, -JOURS_AVANT_ARCHIVAGE)}T00:00:00Z`);
    const limiteAnonymisation = new Date(`${decalerJours(aujourdhui, -JOURS_AVANT_ANONYMISATION)}T00:00:00Z`);

    const archivees = await prisma.commande.updateMany({
      where: { retraitLe: { lt: limiteArchivage }, archiveeLe: null },
      data: { archiveeLe: new Date() },
    });

    // Ce qui reste — date, produits, montants — n'identifie plus personne.
    const anonymisees = await prisma.commande.updateMany({
      where: { retraitLe: { lt: limiteAnonymisation }, anonymiseeLe: null },
      data: { client: MENTION_ANONYME, telephone: '', vendeur: '', anonymiseeLe: new Date() },
    });

    return NextResponse.json({ archivees: archivees.count, anonymisees: anonymisees.count });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'PUT /api/commandes');
    return NextResponse.json(corps, { status: statut });
  }
}

export const dynamic = 'force-dynamic';
