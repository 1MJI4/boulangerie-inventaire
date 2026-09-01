// src/app/api/inventaires/route.ts
//
// Règles de saisie appliquées ici :
//   - un champ absent du corps de la requête n'est PAS touché en base ;
//   - un champ à null est explicitement effacé ;
//   - null et 0 sont deux choses différentes : null = "pas encore compté",
//     0 = "il n'en reste plus". C'est ce qui permet de savoir ce qui reste à faire.

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { diagnostiquer } from '@/lib/erreurBase';
import { estUneRupture, journeeProduction } from '@/lib/dateProduction';
import { estPoste } from '@/lib/postes';

const CHAMPS_QUANTITE = ['quantiteRestante', 'quantiteProduite', 'quantitePrevue'] as const;
type ChampQuantite = (typeof CHAMPS_QUANTITE)[number];

type LigneEntrante = {
  produitId: number | string;
  dateInventaire?: string;
  date?: string; // ancien nom, accepté pour ne pas casser un onglet resté ouvert
  faitLe?: string | null;
} & Partial<Record<ChampQuantite, number | string | null>>;

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Deux comptages identiques rapprochés ne sont qu'une correction de frappe :
 * on ne garde pas deux relevés. Au-delà, c'est un vrai second passage.
 */
const FENETRE_ANTI_DOUBLON_MS = 15 * 60 * 1000;

/** Convertit vers un entier positif. Renvoie undefined si le champ est absent. */
function lireQuantite(valeur: unknown): number | null | undefined {
  if (valeur === undefined) return undefined;
  if (valeur === null || valeur === '') return null;
  const n = Number(valeur);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.trunc(n));
}

function lireDate(...candidats: (string | undefined)[]): string | null {
  for (const c of candidats) {
    if (typeof c === 'string' && FORMAT_DATE.test(c)) return c;
  }
  return null;
}

/** Une DATE Postgres se stocke à midi UTC : à l'abri de tout décalage de fuseau. */
function versDatePg(dateISO: string): Date {
  return new Date(`${dateISO}T12:00:00.000Z`);
}

type Comptage = {
  produitId: number;
  date: string;
  valeurs: { quantiteRestante?: number | null };
};

/**
 * Ajoute au journal les comptages qui apportent une information nouvelle.
 *
 * Effacer une valeur n'est pas un comptage : on ne journalise que des
 * quantités. Et retaper le même chiffre dans la foulée est une correction,
 * pas un second passage — d'où la fenêtre anti-doublon.
 */
async function journaliserComptages(comptages: Comptage[], instant: Date): Promise<number> {
  const aJournaliser = comptages.filter(
    (c) => typeof c.valeurs.quantiteRestante === 'number'
  );
  if (aJournaliser.length === 0) return 0;

  const derniers = await prisma.releve.findMany({
    where: {
      OR: aJournaliser.map((c) => ({
        produitId: c.produitId,
        journee: versDatePg(c.date),
      })),
    },
    orderBy: { releveA: 'desc' },
    select: { produitId: true, journee: true, quantiteRestante: true, releveA: true },
  });

  // On ne garde que le relevé le plus récent de chaque couple produit/journée.
  const dernierPar = new Map<string, { quantiteRestante: number; releveA: Date }>();
  for (const d of derniers) {
    const k = `${d.produitId}|${d.journee.toISOString().slice(0, 10)}`;
    if (!dernierPar.has(k)) dernierPar.set(k, d);
  }

  const nouveaux = aJournaliser.filter((c) => {
    const dernier = dernierPar.get(`${c.produitId}|${c.date}`);
    if (!dernier) return true;
    const memeValeur = dernier.quantiteRestante === c.valeurs.quantiteRestante;
    const recent = instant.getTime() - dernier.releveA.getTime() < FENETRE_ANTI_DOUBLON_MS;
    return !(memeValeur && recent);
  });

  if (nouveaux.length === 0) return 0;

  const { count } = await prisma.releve.createMany({
    data: nouveaux.map((c) => ({
      produitId: c.produitId,
      journee: versDatePg(c.date),
      quantiteRestante: c.valeurs.quantiteRestante as number,
      releveA: instant,
    })),
  });

  return count;
}

export async function POST(request: Request) {
  try {
    const corps = await request.json();
    const lignes: LigneEntrante[] = corps?.inventaires;

    if (!Array.isArray(lignes)) {
      return NextResponse.json(
        { error: 'Format invalide. Attendu : { inventaires: [...] }' },
        { status: 400 }
      );
    }
    if (lignes.length === 0) {
      return NextResponse.json({ message: 'Rien à enregistrer', enregistres: 0 });
    }
    if (lignes.length > 500) {
      return NextResponse.json(
        { error: 'Trop de lignes en une fois (maximum 500).' },
        { status: 400 }
      );
    }

    // Date par défaut du lot, sinon la journée de production en cours.
    const dateLot = lireDate(corps?.dateInventaire, corps?.date) ?? journeeProduction();
    const maintenant = new Date();
    const modeAddition = corps?.modeAddition === true;

    const erreurs: string[] = [];
    const preparees: {
      produitId: number;
      date: string;
      valeurs: Partial<Record<ChampQuantite, number | null>>;
      faitLe?: Date | null;
    }[] = [];

    for (const ligne of lignes) {
      const produitId = Number(ligne?.produitId);
      if (!Number.isInteger(produitId) || produitId <= 0) {
        erreurs.push(`Produit « ${ligne?.produitId} » : identifiant invalide`);
        continue;
      }

      const valeurs: Partial<Record<ChampQuantite, number | null>> = {};
      for (const champ of CHAMPS_QUANTITE) {
        const v = lireQuantite(ligne[champ]);
        if (v !== undefined) valeurs[champ] = v;
      }

      const faitLe =
        ligne.faitLe === undefined
          ? undefined
          : ligne.faitLe === null
            ? null
            : new Date(ligne.faitLe);

      // Une ligne sans aucune valeur n'a rien à dire : on l'ignore au lieu
      // d'écrire une ligne vide (c'est ce qui écrasait les saisies avec des 0).
      if (Object.keys(valeurs).length === 0 && faitLe === undefined) continue;

      preparees.push({
        produitId,
        date: lireDate(ligne.dateInventaire, ligne.date) ?? dateLot,
        valeurs,
        faitLe,
      });
    }

    if (preparees.length === 0) {
      return NextResponse.json({
        message: 'Aucune valeur à enregistrer',
        enregistres: 0,
        erreurs: erreurs.length ? erreurs : undefined,
      });
    }

    // Les produits doivent exister : une seule requête pour tout le lot.
    const idsDemandes = [...new Set(preparees.map((p) => p.produitId))];
    const produitsConnus = new Set(
      (
        await prisma.produit.findMany({
          where: { id: { in: idsDemandes } },
          select: { id: true },
        })
      ).map((p) => p.id)
    );

    const aEcrire = preparees.filter((p) => {
      if (produitsConnus.has(p.produitId)) return true;
      erreurs.push(`Produit ${p.produitId} introuvable`);
      return false;
    });

    if (aEcrire.length === 0) {
      return NextResponse.json(
        { error: 'Aucun produit valide dans la requête', erreurs },
        { status: 400 }
      );
    }

    // Les comptages alimentent aussi le journal des relevés : il faut donc
    // savoir où en était chaque ligne avant l'écriture.
    const comptages = aEcrire.filter((p) => p.valeurs.quantiteRestante !== undefined);
    const besoinEtatPrecedent = modeAddition || comptages.length > 0;

    const cle = (produitId: number, date: string) => `${produitId}|${date}`;

    let dejaEnBase = new Map<string, { quantiteProduite: number | null; rupture: Date | null }>();
    if (besoinEtatPrecedent) {
      const existants = await prisma.inventaire.findMany({
        where: {
          OR: aEcrire.map((p) => ({
            produitId: p.produitId,
            dateInventaire: versDatePg(p.date),
          })),
        },
        select: {
          produitId: true,
          dateInventaire: true,
          quantiteProduite: true,
          rupturePremiereA: true,
        },
      });
      dejaEnBase = new Map(
        existants.map((e) => [
          cle(e.produitId, e.dateInventaire.toISOString().slice(0, 10)),
          { quantiteProduite: e.quantiteProduite, rupture: e.rupturePremiereA },
        ])
      );
    }

    // Un seul aller-retour réseau pour tout le lot, au lieu d'un par produit.
    const operations = aEcrire.map((p) => {
      const valeurs = { ...p.valeurs };

      const precedent = dejaEnBase.get(cle(p.produitId, p.date));

      if (modeAddition && typeof valeurs.quantiteProduite === 'number') {
        if (typeof precedent?.quantiteProduite === 'number') {
          valeurs.quantiteProduite = precedent.quantiteProduite + valeurs.quantiteProduite;
        }
      }

      // Heure de rupture : on retient le PREMIER zéro de la journée.
      //
      // Trois garde-fous. Un réassort (valeur repassée au-dessus de zéro)
      // l'annule, sinon on lirait une rupture à midi sur un produit refait à
      // 14h. Un zéro constaté après la fermeture n'en est pas une : c'est
      // l'inventaire du soir, où tout ce qui s'est bien vendu est à zéro. Et
      // un zéro saisi pour une journée passée n'est pas datable.
      const comptage = valeurs.quantiteRestante;
      const rupture =
        comptage === undefined
          ? {}
          : comptage === 0
            ? estUneRupture(p.date, maintenant)
              ? { rupturePremiereA: precedent?.rupture ?? maintenant }
              : {} // on ne pose rien, mais on n'efface pas une rupture déjà notée
            : { rupturePremiereA: null };

      const donnees = {
        ...valeurs,
        ...rupture,
        ...(p.faitLe !== undefined ? { faitLe: p.faitLe } : {}),
      };

      return prisma.inventaire.upsert({
        where: {
          produitId_dateInventaire: {
            produitId: p.produitId,
            dateInventaire: versDatePg(p.date),
          },
        },
        update: donnees,
        create: {
          produitId: p.produitId,
          dateInventaire: versDatePg(p.date),
          ...donnees,
        },
        select: { id: true, produitId: true },
      });
    });

    const resultats = await prisma.$transaction(operations);

    // Journal des comptages, écrit après coup : s'il échoue, l'inventaire
    // reste juste — on perd une ligne de statistiques, pas une saisie.
    let relevesEcrits = 0;
    if (comptages.length > 0) {
      try {
        relevesEcrits = await journaliserComptages(comptages, maintenant);
      } catch (e) {
        console.error('journal des relevés', e);
      }
    }

    return NextResponse.json({
      message: `${resultats.length} ligne(s) enregistrée(s)`,
      enregistres: resultats.length,
      releves: relevesEcrits,
      dateInventaire: dateLot,
      erreurs: erreurs.length ? erreurs : undefined,
    });
  } catch (error) {
    console.error('POST /api/inventaires', error);
    return NextResponse.json(
      { error: "L'enregistrement a échoué. Les saisies n'ont pas été perdues, réessayez." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const date = lireDate(searchParams.get('date') ?? undefined);
    const debut = lireDate(searchParams.get('debut') ?? undefined);
    const fin = lireDate(searchParams.get('fin') ?? undefined);
    const produitId = searchParams.get('produitId');
    const poste = searchParams.get('poste');
    const limite = Number(searchParams.get('limit'));
    const seulementPrevus = searchParams.get('avecPrevision') === '1';

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

    const inventaires = await prisma.inventaire.findMany({
      where,
      include: {
        produit: {
          select: { id: true, nom: true, ordre: true, categorie: true, poste: true },
        },
      },
      orderBy: [{ dateInventaire: 'desc' }, { produit: { ordre: 'asc' } }],
      take,
    });

    return NextResponse.json(inventaires);
  } catch (error) {
    console.error('GET /api/inventaires', error);
    return NextResponse.json(diagnostiquer(error), { status: 500 });
  }
}

/** Ces écrans lisent la saisie en cours : jamais de cache. */
export const dynamic = 'force-dynamic';
