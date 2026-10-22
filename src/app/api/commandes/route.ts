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

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { reponseEchec, traiterErreur } from '@/lib/erreurBase';
import { JOURS_AVANT_ANONYMISATION, MENTION_ANONYME, STATUTS, formaterNumero } from '@/lib/commandes';
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
import { decalerJours, estDateISO } from '@/domaine/calendrier';
import { JOURS_AVANT_ARCHIVAGE } from '@/domaine/constantes';
import { formaterEuros } from '@/domaine/argent';
import { formaterQuantite } from '@/domaine/unites';
import { signaler } from '@/domaine/messages';
import type { Echec } from '@/domaine/resultat';
import type { Deverrouillage } from '@/domaine/types';
import { chargerContexte, correspondancesServeur, priseBruxelles, resoudreServeur } from './contexteServeur';
import { GOUTS_SUR_COMMANDE } from '@/catalogue/goutsSurCommande';

const inclusions = {
  lignes: { orderBy: { ordre: 'asc' } as const, include: { produitCatalogue: { select: { cleCatalogue: true, categorie: true, nom: true, regimePrix: true } } } },
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

/** Nombre entier tel quel, sinon null (le domaine refuse ce qui n'est pas un entier). */
function entierOuNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : v === null || v === undefined || v === '' ? null : Number.NaN;
}

function jourIso(d: Date): string {
  return d.toISOString().slice(0, 10);
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
  return par || le ? { par: par || 'gérant', le } : null;
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
  const nonConfirmes: AccordsNonConfirmes = { lignes: [], remise: false };
  for (const [i, l] of lignesBrutes.entries()) {
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
      nbObjets: entierOuNull(l.nbObjets),
      gouts: listeDeMots(l.gouts),
      origineSurCommande: texte(l.origineSurCommande, 200) || null,
      deverrouillage: accord,
      deverrouillageTaille,
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
    // R56 : date et heure de prise posées par le serveur (Bruxelles), jamais lues du client.
    datePrise: prise.datePrise,
    heurePrise: prise.heurePrise,
    dateRetrait: texte(corps.dateRetrait, 10),
    heureRetrait: texte(corps.heureRetrait, 5) || null,
    lignes,
    acompteCentimes: entierOuNull(corps.acompteCentimes) ?? 0,
    totalConvenuCentimes: entierOuNull(corps.totalConvenuCentimes),
    remise,
    texteGateau: texte(corps.texteGateau, 200) || null,
    sansEcriture: corps.sansEcriture === true,
    demandeInhabituelle: corps.demandeInhabituelle === true,
  };
  return { ok: true, saisie, precisions, formes, decorations, quand, remiseConservee, nonConfirmes };
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
    return signaler('ERR_DROIT_INSUFFISANT', { action: 'accorder une remise sur le total', role: 'gérant' }, { champ: 'total' });
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
    { action: libre ? 'fixer le prix d’une ligne libre' : 'déverrouiller un prix sous le plancher', role: 'gérant' },
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
  if (!correspondances.ok) return { resultat: correspondances, fiches };
  const resultat = controlerCommande(saisie, {
    resoudre,
    joursFermes: contexte.joursFermes,
    delais: contexte.delais,
    reglement: contexte.reglement,
    correspondancesComptoir: correspondances.donnees,
    goutsSurCommande: GOUTS_SUR_COMMANDE,
    aujourdhui,
    existante,
    joursAvantArchivage: JOURS_AVANT_ARCHIVAGE,
  });
  return { resultat, fiches };
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
      gouts: [...(prep.saisie.lignes[ordre].gouts ?? [])],
      decorations: prep.decorations[ordre],
      nbObjets: prep.saisie.lignes[ordre].nbObjets ?? null,
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
    // HYPOTHÈSE À VALIDER : identité déclarée par la tablette, pas de compte individuel (décision 15/10/2026)
    const vendeur = nomDeclare(corps.vendeur);
    if (!vendeur) {
      return refus(signaler('ERR_CHAMP_OBLIGATOIRE', { champLibelle: 'nom du vendeur' }, { champ: 'vendeur' }), route);
    }

    const maintenant = new Date();
    const prise = priseBruxelles(maintenant);
    const prep = preparer(corps, prise, gerantActif(request, garde.tablette), maintenant, []);
    if (!prep.ok) return refus(prep.echec, route);

    const { resultat, fiches } = await controler(prep.saisie, route, prise.datePrise, null);
    if (!resultat.ok) return refus(resultat, route);
    const manque = refusAccordManquant(prep, resultat);
    if (manque) return refus(manque, route);

    const origine = corps.origine === 'telephone' ? 'telephone' : 'comptoir';
    const modePaiement = corps.modePaiement === 'virement' ? 'virement' : 'especes';
    const annee = Number(resultat.donnees.dateRetrait.slice(0, 4));

    // Numérotation dans la transaction : deux vendeurs qui valident en même
    // temps n'obtiennent jamais le même numéro (communication du virement).
    const commande = await prisma.$transaction(async (tx) => {
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
          priseLe: maintenant,
          modePaiement,
          // Au comptoir l'argent est là ; au téléphone il arrive par virement.
          acompteRecuLe: modePaiement === 'especes' && resultat.donnees.acompteCentimes > 0 ? maintenant : null,
          texteGateau: prep.saisie.texteGateau ?? null,
          sansEcriture: prep.saisie.sansEcriture === true,
          photoWhatsapp: corps.photoWhatsapp === true,
          photoImprimee: corps.photoImprimee === true,
          demandeInhabituelle: prep.saisie.demandeInhabituelle === true,
          // Zone « dessin, précisions » sur les exemplaires internes : seulement si demandée (21/10/2026).
          zoneDessin: corps.zoneDessin === true,
          remarques: texte(corps.remarques, 500) || null,
          ...champsCommande(resultat, prep),
          lignes: { create: lignesAEnregistrer(resultat, fiches, prep) },
          evenements: {
            create: { auteur: vendeur, action: 'creation', detail: origine === 'telephone' ? 'Prise par téléphone' : null },
          },
        },
        include: inclusions,
      });
    });

    return NextResponse.json(commande, { status: 201 });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, route);
    return NextResponse.json(corps, { status: statut });
  }
}

/* ------------------------------------------------------------------ PATCH */

type LigneTexte = { libelle: string; quantite: number; prixCentimes: number; unite: string };

/** État de la commande après modification, pour l'historique. */
type Apres = {
  client: string;
  telephone: string;
  dateRetrait: string;
  heureRetrait: string | null;
  texteGateau: string | null;
  zoneDessin: boolean;
  totalCentimes: number;
  acompteCentimes: number;
};

/** Historique lisible : ce qui a changé, et l'ancienne version des lignes (litige, R31). */
function changementsLisibles(
  existante: {
    client: string;
    telephone: string;
    retraitLe: Date;
    retraitHeure: string | null;
    texteGateau: string | null;
    zoneDessin: boolean;
    totalCentimes: number;
    acompteCentimes: number;
    lignes: LigneTexte[];
  },
  apres: Apres,
  lignesApres: LigneTexte[],
): string[] {
  const changements: string[] = [];
  if (apres.client !== existante.client) changements.push(`client : ${existante.client} → ${apres.client}`);
  if (apres.telephone !== existante.telephone) changements.push('téléphone');
  const avantRetrait = jourIso(existante.retraitLe);
  if (apres.dateRetrait !== avantRetrait) changements.push(`retrait : ${avantRetrait} → ${apres.dateRetrait}`);
  if ((apres.heureRetrait ?? '') !== (existante.retraitHeure ?? '')) {
    changements.push(`heure : ${existante.retraitHeure ?? '—'} → ${apres.heureRetrait ?? '—'}`);
  }
  if (apres.texteGateau !== existante.texteGateau) {
    changements.push(`écriture : ${existante.texteGateau ?? 'aucune'} → ${apres.texteGateau ?? 'aucune'}`);
  }
  // Le bon imprimé change (zone ajoutée ou retirée) : tracé, donc réimprimé.
  if (apres.zoneDessin !== existante.zoneDessin) {
    changements.push(`zone dessin : ${existante.zoneDessin ? 'oui' : 'non'} → ${apres.zoneDessin ? 'oui' : 'non'}`);
  }
  const versTexte = (ls: LigneTexte[]) =>
    ls.map((l) => `${formaterQuantite(l.unite === 'kg' ? 'kg' : 'piece', l.quantite)} × ${l.libelle} à ${formaterEuros(l.prixCentimes)}`).join(' ; ');
  const avant = versTexte(existante.lignes);
  if (avant !== versTexte(lignesApres)) changements.push(`produits — avant : ${avant}`);
  if (apres.totalCentimes !== existante.totalCentimes) {
    changements.push(`total : ${formaterEuros(existante.totalCentimes)} → ${formaterEuros(apres.totalCentimes)}`);
  }
  if (apres.acompteCentimes !== existante.acompteCentimes) {
    changements.push(`acompte : ${formaterEuros(existante.acompteCentimes)} → ${formaterEuros(apres.acompteCentimes)}`);
  }
  return changements;
}

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
    const existante = await prisma.commande.findUnique({
      where: { id },
      include: { lignes: { orderBy: { ordre: 'asc' }, include: { produitCatalogue: { select: { cleCatalogue: true, categorie: true, nom: true, regimePrix: true } } } } },
    });
    if (!existante) return introuvable(route);

    const maintenant = new Date();
    const statut = existante.statut as StatutCommande;
    const donnees: Prisma.CommandeUpdateInput = {};
    let detail: string | null = null;
    let nouvellesLignes: ReturnType<typeof lignesAEnregistrer> | null = null;

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
          const texteGateau = texte(corps.texteGateau, 200) || null;
          Object.assign(donnees, {
            client: client.donnees,
            telephone: telephone.donnees,
            retraitHeure: heure.donnees,
            texteGateau,
            sansEcriture: corps.sansEcriture === true,
            demandeInhabituelle: corps.demandeInhabituelle === true,
            photoWhatsapp: corps.photoWhatsapp === true,
            photoImprimee: corps.photoImprimee === true,
            zoneDessin: corps.zoneDessin === true,
            remarques: texte(corps.remarques, 500) || null,
            modePaiement: corps.modePaiement === 'virement' ? 'virement' : 'especes',
          });
          apres = {
            client: client.donnees,
            telephone: telephone.donnees,
            dateRetrait: etatExistant.retraitLe,
            heureRetrait: heure.donnees,
            texteGateau,
            zoneDessin: corps.zoneDessin === true,
            totalCentimes: existante.totalCentimes,
            acompteCentimes: existante.acompteCentimes,
          };
          lignesApres = existante.lignes;
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

          const prep = preparer(corps, prise, gerant, maintenant, accords);
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
              signaler('ERR_DROIT_INSUFFISANT', { action: 'accorder une remise sur le total', role: 'gérant' }, { champ: 'total' }),
              route,
            );
          }

          nouvellesLignes = lignesAEnregistrer(resultat, fiches, prep);
          Object.assign(donnees, champsCommande(resultat, prep), {
            client: prep.saisie.client,
            telephone: prep.saisie.telephone,
            texteGateau: prep.saisie.texteGateau ?? null,
            sansEcriture: prep.saisie.sansEcriture === true,
            demandeInhabituelle: prep.saisie.demandeInhabituelle === true,
            photoWhatsapp: corps.photoWhatsapp === true,
            photoImprimee: corps.photoImprimee === true,
            zoneDessin: corps.zoneDessin === true,
            remarques: texte(corps.remarques, 500) || null,
            modePaiement: corps.modePaiement === 'virement' ? 'virement' : 'especes',
          });
          apres = {
            client: prep.saisie.client,
            telephone: prep.saisie.telephone,
            dateRetrait: resultat.donnees.dateRetrait,
            heureRetrait: resultat.donnees.heureRetrait,
            texteGateau: prep.saisie.texteGateau ?? null,
            zoneDessin: corps.zoneDessin === true,
            totalCentimes: resultat.donnees.totalCentimes,
            acompteCentimes: resultat.donnees.acompteCentimes,
          };
          lignesApres = nouvellesLignes;
        }

        const changements = changementsLisibles(existante, apres, lignesApres);

        // Une commande modifiée repasse par l'imprimante : le feuillet accroché ne dit plus la vérité.
        if (changements.length > 0 && statut === 'imprimee') {
          const r = transition('a_imprimer');
          if (r) return refus(r, route);
          donnees.statut = 'a_imprimer';
          donnees.imprimeeLe = null;
          changements.push('à réimprimer');
        }
        detail = changements.join(', ').slice(0, 2000) || 'aucun changement';
        break;
      }

      default:
        return refus(signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'action' }, { champ: 'action' }), route);
    }

    const lignes = nouvellesLignes;
    const commande = await prisma.$transaction(async (tx) => {
      if (lignes) {
        await tx.ligneCommande.deleteMany({ where: { commandeId: id } });
        await tx.ligneCommande.createMany({ data: lignes.map((l) => ({ ...l, commandeId: id })) });
      }
      return tx.commande.update({
        where: { id },
        data: { ...donnees, evenements: { create: { auteur, action, detail } } },
        include: inclusions,
      });
    });

    return NextResponse.json(commande);
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
