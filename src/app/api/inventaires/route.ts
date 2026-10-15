// src/app/api/inventaires/route.ts
//
// Règles de saisie appliquées ici :
//   - un champ absent du corps de la requête n'est PAS touché en base ;
//   - un champ à null est explicitement effacé ;
//   - null et 0 sont deux choses différentes : null = "pas encore compté",
//     0 = "il n'en reste plus". C'est ce qui permet de savoir ce qui reste à faire.
//
// Rejeu serveur (offline-first) : chaque quantité repasse par le domaine
// (`preparerLot` → `validerSaisieProduit` / `totalInventaire`). Un refus
// répond au format LOI 9 (`reponseEchec`), jamais par un texte technique.
//
// LOI 10 : seule la table "Produit" (liste d'INVENTAIRE) est lue ici ; un
// identifiant inconnu de cette liste → ERR_PRODUIT_INCONNU (422).
//
// Idempotence : chaque geste porte un `saisieId` (UUID de la tablette),
// enregistré sur le relevé ("Releve".saisieId, unique). Un comptage déjà
// reçu n'est pas réappliqué — sinon un vieux geste rejoué après un plus
// récent écraserait la bonne valeur.

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { reponseEchec, traiterErreur } from '@/lib/erreurBase';
import { journaliser } from '@/lib/journal';
import { estUneRupture, journeeProduction } from '@/lib/dateProduction';
import { estPoste } from '@/lib/postes';
import { exigerRole } from '@/lib/auth/garde';
import { lireReglages } from '@/lib/serveur/reglages';
import {
  CHAMPS_QUANTITE,
  idsDuLot,
  lireDate,
  preparerLot,
  versProduitInventaire,
  type ChampQuantite,
  type LigneEntrante,
  type LignePreparee,
} from '@/lib/inventaire/lot';
import { signaler } from '@/domaine/messages';
import { totalInventaire } from '@/domaine/inventaire';
import type { Unite } from '@/domaine/types';
import type { Echec } from '@/domaine/resultat';

const ROUTE_POST = 'POST /api/inventaires';

/** Taille maximale d'un lot (garde-fou de charge, pas une règle métier). */
const LIGNES_MAX = 500;

/**
 * Deux comptages identiques rapprochés ne sont qu'une correction de frappe :
 * on ne garde pas deux relevés. Au-delà, c'est un vrai second passage.
 * Ne s'applique qu'aux écrans sans saisieId (anciens onglets) : avec un
 * saisieId, chaque geste est un relevé distinct, enregistré une seule fois.
 */
const FENETRE_ANTI_DOUBLON_MS = 15 * 60 * 1000;

/** Écart toléré entre l'horloge de la tablette et celle du serveur. */
const DERIVE_HORLOGE_MAX_MS = 24 * 60 * 60 * 1000;

/** Une DATE Postgres se stocke à midi UTC : à l'abri de tout décalage de fuseau. */
function versDatePg(dateISO: string): Date {
  return new Date(`${dateISO}T12:00:00.000Z`);
}

/** Horodatage du geste sur la tablette (R57), sinon l'heure du serveur. */
function lireInstant(valeur: unknown, maintenant: Date): Date {
  if (typeof valeur !== 'string') return maintenant;
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return maintenant;
  return Math.abs(d.getTime() - maintenant.getTime()) > DERIVE_HORLOGE_MAX_MS ? maintenant : d;
}

type Comptage = {
  produitId: number;
  date: string;
  unite: Unite;
  saisieId: string | null;
  quantiteRestante: number;
  releveA: Date;
};

/**
 * Ajoute au journal les comptages qui apportent une information nouvelle.
 * Effacer une valeur n'est pas un comptage : on ne journalise que des quantités.
 */
async function journaliserComptages(comptages: Comptage[]): Promise<number> {
  if (comptages.length === 0) return 0;

  const sansGeste = comptages.filter((c) => c.saisieId === null);
  const dernierPar = new Map<string, { quantiteRestante: number; releveA: Date }>();
  if (sansGeste.length > 0) {
    const derniers = await prisma.releve.findMany({
      where: { OR: sansGeste.map((c) => ({ produitId: c.produitId, journee: versDatePg(c.date) })) },
      orderBy: { releveA: 'desc' },
      select: { produitId: true, journee: true, quantiteRestante: true, releveA: true },
    });
    for (const d of derniers) {
      const k = `${d.produitId}|${d.journee.toISOString().slice(0, 10)}`;
      if (!dernierPar.has(k)) dernierPar.set(k, d);
    }
  }

  const nouveaux = comptages.filter((c) => {
    if (c.saisieId !== null) return true;
    const dernier = dernierPar.get(`${c.produitId}|${c.date}`);
    if (!dernier) return true;
    const memeValeur = dernier.quantiteRestante === c.quantiteRestante;
    const recent = c.releveA.getTime() - dernier.releveA.getTime() < FENETRE_ANTI_DOUBLON_MS;
    return !(memeValeur && recent);
  });
  if (nouveaux.length === 0) return 0;

  const { count } = await prisma.releve.createMany({
    data: nouveaux.map((c) => ({
      produitId: c.produitId,
      journee: versDatePg(c.date),
      quantiteRestante: c.quantiteRestante,
      unite: c.unite,
      releveA: c.releveA,
      saisieId: c.saisieId,
    })),
    // Course entre deux envois du même geste : le second est ignoré.
    skipDuplicates: true,
  });
  return count;
}

/**
 * Comptages déjà reçus (même saisieId en base). Même valeur → déjà appliqué,
 * on ne le rejoue pas ; valeur différente → ERR_CONFLIT_COMPTAGE (domaine).
 */
async function dejaRecus(
  lignes: LignePreparee[],
  produits: ReturnType<typeof versProduitInventaire>[],
): Promise<{ ok: true; ids: Set<string> } | Echec> {
  const ids = lignes.flatMap((l) => (typeof l.valeurs.quantiteRestante === 'number' ? l.saisieIds : []));
  if (ids.length === 0) return { ok: true, ids: new Set() };

  const existants = await prisma.releve.findMany({
    where: { saisieId: { in: ids } },
    select: { saisieId: true, produitId: true, quantiteRestante: true, unite: true },
  });
  const recus = new Set<string>();
  for (const e of existants) {
    if (!e.saisieId) continue;
    const ligne = lignes.find((l) => l.saisieIds.includes(e.saisieId!));
    if (!ligne || typeof ligne.valeurs.quantiteRestante !== 'number') continue;
    const verdict = totalInventaire(produits, [
      { saisieId: e.saisieId, produitId: String(e.produitId), unite: e.unite, quantite: e.quantiteRestante },
      {
        saisieId: e.saisieId,
        produitId: String(ligne.produitId),
        unite: ligne.unite,
        quantite: ligne.valeurs.quantiteRestante,
      },
    ]);
    if (!verdict.ok) return { ...verdict, champ: `produit:${ligne.produitId}` };
    recus.add(e.saisieId);
  }
  return { ok: true, ids: recus };
}

export async function POST(request: Request) {
  // HYPOTHÈSE À VALIDER : pas de clôture d'inventaire distincte (rôle « responsable » supprimé le 15/10/2026).
  const garde = exigerRole(request, 'tablette', 'saisir un inventaire');
  if (!garde.ok) return garde.reponse;
  try {
    const corps = await request.json().catch(() => null);
    const lignes: unknown = corps?.inventaires;

    if (!Array.isArray(lignes) || lignes.length > LIGNES_MAX) {
      const { corps: refus, statut } = reponseEchec(
        signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'liste des quantités' }, { champ: 'inventaires' }),
        ROUTE_POST,
      );
      return NextResponse.json(refus, { status: statut });
    }
    if (lignes.length === 0) {
      return NextResponse.json({ ok: true, message: 'Rien à enregistrer', enregistres: 0, signalements: [] });
    }

    // Date par défaut du lot, sinon la journée de production en cours.
    const dateLot = lireDate(corps?.dateInventaire, corps?.date) ?? journeeProduction();
    const maintenant = new Date();
    const modeAddition = corps?.modeAddition === true;
    const entrees = lignes as LigneEntrante[];

    // LOI 10 — la liste d'INVENTAIRE uniquement (table "Produit"), une requête pour tout le lot.
    const produits = (
      await prisma.produit.findMany({
        where: { id: { in: idsDuLot(entrees) } },
        select: { id: true, nom: true, unite: true, actif: true },
      })
    ).map(versProduitInventaire);

    const lot = preparerLot(entrees, produits, dateLot);
    if (!lot.ok) {
      const { corps: refus, statut } = reponseEchec(lot, ROUTE_POST);
      return NextResponse.json(refus, { status: statut });
    }

    const recus = await dejaRecus(lot.lignes, produits);
    if (!recus.ok) {
      const { corps: refus, statut } = reponseEchec(recus, ROUTE_POST);
      return NextResponse.json(refus, { status: statut });
    }

    // Un geste déjà appliqué n'est pas rejoué : il ne doit pas écraser un comptage plus récent.
    const aEcrire = lot.lignes.filter(
      (l) => !(typeof l.valeurs.quantiteRestante === 'number' && l.saisieIds.some((id) => recus.ids.has(id))),
    );
    const dejaTraites = lot.lignes.length - aEcrire.length;

    if (aEcrire.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'Déjà enregistré',
        enregistres: 0,
        dejaTraites,
        dateInventaire: dateLot,
        signalements: lot.signalements,
      });
    }

    const cle = (produitId: number, date: string) => `${produitId}|${date}`;
    const comptages = aEcrire.filter((p) => p.valeurs.quantiteRestante !== undefined);
    const besoinEtatPrecedent = modeAddition || comptages.length > 0;

    let dejaEnBase = new Map<string, { quantiteProduite: number | null; rupture: Date | null }>();
    if (besoinEtatPrecedent) {
      const existants = await prisma.inventaire.findMany({
        where: {
          OR: aEcrire.map((p) => ({ produitId: p.produitId, dateInventaire: versDatePg(p.date) })),
        },
        select: { produitId: true, dateInventaire: true, quantiteProduite: true, rupturePremiereA: true },
      });
      dejaEnBase = new Map(
        existants.map((e) => [
          cle(e.produitId, e.dateInventaire.toISOString().slice(0, 10)),
          { quantiteProduite: e.quantiteProduite, rupture: e.rupturePremiereA },
        ]),
      );
    }

    // Un seul aller-retour réseau pour tout le lot, au lieu d'un par produit.
    const operations = aEcrire.map((p) => {
      const valeurs: Partial<Record<ChampQuantite, number | null>> = {};
      for (const champ of CHAMPS_QUANTITE) {
        if (p.valeurs[champ] !== undefined) valeurs[champ] = p.valeurs[champ];
      }
      const precedent = dejaEnBase.get(cle(p.produitId, p.date));

      // HYPOTHÈSE À VALIDER : le mode addition (deuxième fournée) n'a pas
      // d'idempotence par saisieId — "Inventaire" n'a pas de colonne saisieId.
      if (modeAddition && typeof valeurs.quantiteProduite === 'number') {
        if (typeof precedent?.quantiteProduite === 'number') {
          valeurs.quantiteProduite = precedent.quantiteProduite + valeurs.quantiteProduite;
        }
      }

      // Heure de rupture : on retient le PREMIER zéro de la journée.
      // Un réassort l'annule ; un zéro après la fermeture (inventaire du soir)
      // ou pour une journée passée n'en est pas une.
      const comptage = valeurs.quantiteRestante;
      const rupture =
        comptage === undefined
          ? {}
          : comptage === 0
            ? estUneRupture(p.date, maintenant)
              ? { rupturePremiereA: precedent?.rupture ?? maintenant }
              : {}
            : { rupturePremiereA: null };

      const donnees = {
        ...valeurs,
        ...rupture,
        ...(p.faitLe !== undefined ? { faitLe: p.faitLe } : {}),
      };

      return prisma.inventaire.upsert({
        where: {
          produitId_dateInventaire: { produitId: p.produitId, dateInventaire: versDatePg(p.date) },
        },
        update: donnees,
        create: { produitId: p.produitId, dateInventaire: versDatePg(p.date), unite: p.unite, ...donnees },
        select: { id: true, produitId: true },
      });
    });

    const resultats = await prisma.$transaction(operations);

    // Journal des comptages, écrit après coup : s'il échoue, l'inventaire
    // reste juste — on perd une ligne de statistiques, pas une saisie.
    let relevesEcrits = 0;
    const instants = new Map<string, Date>();
    for (const l of entrees) {
      if (typeof l?.saisieId === 'string') instants.set(l.saisieId, lireInstant(l.saisiLe, maintenant));
    }
    const aJournaliser: Comptage[] = comptages.flatMap((c) =>
      typeof c.valeurs.quantiteRestante === 'number'
        ? [
            {
              produitId: c.produitId,
              date: c.date,
              unite: c.unite,
              saisieId: c.saisieId,
              quantiteRestante: c.valeurs.quantiteRestante,
              releveA: (c.saisieId && instants.get(c.saisieId)) || maintenant,
            },
          ]
        : [],
    );
    try {
      relevesEcrits = await journaliserComptages(aJournaliser);
    } catch (e) {
      journaliser({ niveau: 'erreur', code: 'ERR_INATTENDUE', route: ROUTE_POST, piste: 'Journal des relevés non écrit (inventaire enregistré).', detail: e });
    }

    return NextResponse.json({
      ok: true,
      message: `${resultats.length} ligne(s) enregistrée(s)`,
      enregistres: resultats.length,
      dejaTraites,
      releves: relevesEcrits,
      dateInventaire: dateLot,
      signalements: lot.signalements,
    });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, ROUTE_POST);
    return NextResponse.json(corps, { status: statut });
  }
}

/**
 * Heure de fermeture (LOI 11, R57) pour l'avertissement « inventaire avant
 * fermeture ». Lue seulement si l'écran la demande (`reglages=1`), en
 * parallèle de la requête principale : aucun aller-retour ajouté.
 * Réglage absent ou illisible → pas d'en-tête, l'écran retombe sur
 * HEURE_FERMETURE_HYPOTHESE (jamais d'échec de l'inventaire pour un avertissement).
 */
async function heureFermeture(): Promise<string | null> {
  try {
    return (await lireReglages(prisma)).heureFermeture;
  } catch (e) {
    journaliser({ niveau: 'avertissement', code: 'ERR_CONFIGURATION_SERVEUR', route: 'GET /api/inventaires', piste: 'Réglage reglement:heure_fermeture illisible : heure par défaut utilisée.', detail: e });
    return null;
  }
}

export async function GET(request: Request) {
  const garde = exigerRole(request, 'tablette', 'consulter un inventaire');
  if (!garde.ok) return garde.reponse;
  try {
    const { searchParams } = new URL(request.url);

    const date = lireDate(searchParams.get('date') ?? undefined);
    const debut = lireDate(searchParams.get('debut') ?? undefined);
    const fin = lireDate(searchParams.get('fin') ?? undefined);
    const produitId = searchParams.get('produitId');
    const poste = searchParams.get('poste');
    const limite = Number(searchParams.get('limit'));
    const seulementPrevus = searchParams.get('avecPrevision') === '1';
    const avecReglages = searchParams.get('reglages') === '1';

    const where: Prisma.InventaireWhereInput = {};

    if (date) {
      where.dateInventaire = versDatePg(date);
    } else if (debut || fin) {
      where.dateInventaire = {
        ...(debut ? { gte: versDatePg(debut) } : {}),
        ...(fin ? { lte: versDatePg(fin) } : {}),
      };
    }

    if (produitId && Number.isInteger(Number(produitId))) {
      where.produitId = Number(produitId);
    }
    if (estPoste(poste)) {
      where.produit = { poste };
    }
    if (seulementPrevus) {
      where.quantitePrevue = { gt: 0 };
    }

    // Filet de sécurité : sans borne, cette route finirait par renvoyer
    // des dizaines de milliers de lignes au bout d'un an d'exploitation.
    const take = Number.isFinite(limite) && limite > 0 ? Math.min(limite, 2000) : 1000;

    const [inventaires, fermeture] = await Promise.all([
      prisma.inventaire.findMany({
        where,
        include: {
          produit: {
            select: { id: true, nom: true, ordre: true, categorie: true, poste: true, unite: true },
          },
        },
        orderBy: [{ dateInventaire: 'desc' }, { produit: { ordre: 'asc' } }],
        take,
      }),
      avecReglages ? heureFermeture() : Promise.resolve(null),
    ]);

    return NextResponse.json(inventaires, {
      headers: fermeture ? { 'X-Heure-Fermeture': fermeture } : undefined,
    });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'GET /api/inventaires');
    return NextResponse.json(corps, { status: statut });
  }
}

/** Ces écrans lisent la saisie en cours : jamais de cache. */
export const dynamic = 'force-dynamic';
