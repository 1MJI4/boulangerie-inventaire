// Produits PROPOSÉS par les vendeurs au comptage (21/11/2026). Un vendeur propose (POST) un produit
// compté ce soir mais absent de la liste ; le manager décide (PATCH, accès gérant, comme l'ajout d'un
// produit) : l'ajouter à la liste, le rattacher à un produit existant, ou en faire une exception.
// Tant qu'il n'a pas décidé, rien n'entre dans l'inventaire (LOI 10). Règles : src/domaine/produitsProposes.ts.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigerRole } from '@/lib/auth/garde';
import { reponseEchec, traiterErreur } from '@/lib/erreurBase';
import { dateDuJour } from '@/lib/dateProduction';
import { estPoste, POSTES } from '@/lib/postes';
import { memeNomDeProduit, normaliserNomProduit, validerProposition } from '@/domaine/produitsProposes';
import { notifProduitPropose } from '@/domaine/notifications';
import { notifierManager } from '@/lib/serveur/notifications';

const ROUTE = 'produits-proposes';
const SANS_STOCK = { 'Cache-Control': 'no-store' };

/** Une DATE Postgres se stocke à midi UTC (comme /api/inventaires). */
const versDatePg = (jour: string) => new Date(`${jour}T12:00:00.000Z`);
const nom = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);

function refus(texte: string, statut: number) {
  return NextResponse.json({ ok: false, message: texte, error: texte, erreur: texte }, { status: statut, headers: SANS_STOCK });
}

export async function GET(request: Request) {
  const garde = exigerRole(request, 'tablette', 'consulter les produits proposés');
  if (!garde.ok) return garde.reponse;
  const depuis = new Date(Date.now() - 14 * 86_400_000);
  const [propositions, produits, categories] = await Promise.all([
    prisma.produitPropose.findMany({
      // À valider : sans limite de temps ; décidées : les deux dernières semaines.
      where: { OR: [{ statut: 'a_valider' }, { creeLe: { gte: depuis } }] },
      orderBy: { creeLe: 'desc' },
      take: 200,
    }),
    prisma.produit.findMany({ where: { actif: true }, select: { id: true, nom: true, categorie: true }, orderBy: [{ categorie: 'asc' }, { ordre: 'asc' }] }),
    prisma.produit.findMany({ distinct: ['categorie'], select: { categorie: true }, orderBy: { categorie: 'asc' } }),
  ]);
  return NextResponse.json(
    {
      propositions: propositions.map((p) => ({ ...p, journee: p.journee.toISOString().slice(0, 10) })),
      produits,
      categories: categories.map((c) => c.categorie),
      postes: POSTES,
    },
    { headers: SANS_STOCK },
  );
}

export async function POST(request: Request) {
  const garde = exigerRole(request, 'tablette', 'proposer un produit au manager');
  if (!garde.ok) return garde.reponse;
  try {
    const corps = (await request.json().catch(() => null)) as { nom?: unknown; quantite?: unknown; par?: unknown } | null;
    const par = nom(corps?.par);
    if (!par) return refus('Touchez votre prénom avant d’envoyer la proposition.', 400);
    const v = validerProposition(corps?.nom, corps?.quantite);
    if (!v.ok) {
      const { corps: r, statut } = reponseEchec(v, ROUTE);
      return NextResponse.json(r, { status: statut });
    }
    const { nom: nomPropre, quantite } = v.donnees;

    // Déjà dans la liste (une autre écriture du même nom) : on le dit, on ne crée rien.
    const existants = await prisma.produit.findMany({ where: { actif: true }, select: { id: true, nom: true } });
    const doublon = existants.find((p) => memeNomDeProduit(p.nom, nomPropre));
    if (doublon) {
      return NextResponse.json(
        { ok: false, message: `« ${doublon.nom} » est déjà dans la liste : comptez-le sur sa ligne.`, produitExistant: doublon },
        { status: 409, headers: SANS_STOCK },
      );
    }

    const journee = dateDuJour();
    const normalise = normaliserNomProduit(nomPropre);
    const dejaPropose = await prisma.produitPropose.findFirst({
      where: { nomNormalise: normalise, journee: versDatePg(journee), statut: 'a_valider' },
    });
    if (dejaPropose) return refus('Ce produit a déjà été proposé aujourd’hui : le manager va le voir.', 409);

    const cree = await prisma.produitPropose.create({
      data: { nom: nomPropre, nomNormalise: normalise, quantite, journee: versDatePg(journee), propositionPar: par },
    });
    void notifierManager(notifProduitPropose(cree.id, cree.nom));
    return NextResponse.json({ ok: true, proposition: { id: cree.id, nom: cree.nom } }, { status: 201, headers: SANS_STOCK });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, `POST /api/${ROUTE}`);
    return NextResponse.json(corps, { status: statut });
  }
}

export async function PATCH(request: Request) {
  const garde = exigerRole(request, 'gerant', 'décider d’un produit proposé');
  if (!garde.ok) return garde.reponse;
  try {
    const c = (await request.json().catch(() => null)) as {
      id?: unknown;
      action?: unknown;
      par?: unknown;
      produitId?: unknown;
      categorie?: unknown;
      poste?: unknown;
      nom?: unknown;
    } | null;
    const id = Number(c?.id);
    const par = nom(c?.par);
    if (!Number.isSafeInteger(id) || id <= 0) return refus('Proposition introuvable.', 404);
    const p = await prisma.produitPropose.findUnique({ where: { id } });
    if (!p) return refus('Proposition introuvable.', 404);
    if (p.statut !== 'a_valider') return refus('Cette proposition est déjà traitée.', 409);
    if (!par) return refus('Touchez votre prénom avant de décider.', 400);
    const maintenant = new Date();

    // Le reste compté par le vendeur s'écrit sur la ligne d'inventaire de CE soir-là, s'il n'y en a pas déjà un.
    const ecrireReste = async (produitId: number) => {
      if (p.quantite === null) return;
      const cle = { produitId_dateInventaire: { produitId, dateInventaire: p.journee } };
      const ligne = await prisma.inventaire.findUnique({ where: cle, select: { quantiteRestante: true } });
      if (ligne && ligne.quantiteRestante !== null) return; // un comptage existe : on ne l'écrase jamais
      await prisma.inventaire.upsert({
        where: cle,
        update: { quantiteRestante: p.quantite, nonProduit: false },
        create: { produitId, dateInventaire: p.journee, quantiteRestante: p.quantite, nonProduit: false },
      });
    };

    if (c?.action === 'exception') {
      await prisma.produitPropose.update({ where: { id }, data: { statut: 'exception', traiteLe: maintenant, traitePar: par } });
      return NextResponse.json({ ok: true }, { headers: SANS_STOCK });
    }

    if (c?.action === 'existant') {
      const produitId = Number(c.produitId);
      const cible = Number.isSafeInteger(produitId) ? await prisma.produit.findFirst({ where: { id: produitId, actif: true } }) : null;
      if (!cible) return refus('Choisissez le produit de la liste auquel rattacher celui-ci.', 400);
      await ecrireReste(cible.id);
      await prisma.produitPropose.update({
        where: { id },
        data: { statut: 'ajoute', produitId: cible.id, traiteLe: maintenant, traitePar: par },
      });
      return NextResponse.json({ ok: true, produit: { id: cible.id, nom: cible.nom } }, { headers: SANS_STOCK });
    }

    if (c?.action === 'ajouter') {
      const nomFinal = nom(c.nom) || p.nom;
      const categorie = nom(c.categorie);
      if (!categorie) return refus('Choisissez le rayon du nouveau produit.', 400);
      const poste = typeof c.poste === 'string' ? c.poste : null;
      if (!estPoste(poste)) return refus('Choisissez qui produit ce produit (pâtissier, boulanger ou traiteur).', 400);
      const existants = await prisma.produit.findMany({ select: { nom: true } });
      if (existants.some((e) => memeNomDeProduit(e.nom, nomFinal))) {
        return refus('Un produit de ce nom existe déjà dans la liste : rattachez la proposition à celui-ci.', 409);
      }
      const dernier = await prisma.produit.aggregate({ where: { categorie }, _max: { ordre: true } });
      const produit = await prisma.produit.create({
        data: { nom: nomFinal, categorie, poste, unite: p.unite, ordre: (dernier._max.ordre ?? 0) + 10 },
      });
      await ecrireReste(produit.id);
      await prisma.produitPropose.update({
        where: { id },
        data: { statut: 'ajoute', produitId: produit.id, traiteLe: maintenant, traitePar: par },
      });
      return NextResponse.json({ ok: true, produit: { id: produit.id, nom: produit.nom } }, { status: 201, headers: SANS_STOCK });
    }

    return refus('Action inconnue.', 400);
  } catch (error) {
    const { corps, statut } = traiterErreur(error, `PATCH /api/${ROUTE}`);
    return NextResponse.json(corps, { status: statut });
  }
}
