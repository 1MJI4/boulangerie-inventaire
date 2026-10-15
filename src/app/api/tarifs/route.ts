// src/app/api/tarifs/route.ts
//
// GET : le CATALOGUE DE COMMANDE (tables ProduitCatalogue / PrixProduit, lues
// par src/catalogue/serveur.ts) à une date de prise — c'est la seule source
// des prix de l'écran de commande (LOI 1). L'ancienne grille « Tarif » n'y
// sert plus. Une commande garde le prix de sa date de prise (R4) : l'écran
// de modification demande donc le catalogue à cette date (`?date=`).
//
// L'ancienne table « Tarif » ne sert plus qu'à une chose : la liste des
// produits SIGNALÉS au comptoir comme manquants au tarif (« à ranger »), que le
// gérant fait ajouter au prochain import du catalogue (agent `catalogue-prix`).
// Elle n'est jamais lue comme un prix de vente.
//   GET ?aRanger=1 : cette liste · POST : signaler un produit · PATCH : ranger
//
// Droits : src/lib/auth/matrice.ts (lecture : toute tablette ; écriture : gérant).

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reponseEchec, traiterErreur } from '@/lib/erreurBase';
import { exigerRole } from '@/lib/auth/garde';
import { listerParCategorieServeur } from '@/catalogue/serveur';
import { signaler } from '@/domaine/messages';
import { estDateISO } from '@/domaine/calendrier';
import { priseBruxelles } from '@/app/api/commandes/contexteServeur';

function texte(valeur: unknown, max = 120): string {
  return typeof valeur === 'string' ? valeur.trim().slice(0, max) : '';
}

function refus(echec: Parameters<typeof reponseEchec>[0], route: string) {
  const { corps, statut } = reponseEchec(echec, route);
  return NextResponse.json(corps, { status: statut });
}

export async function GET(request: Request) {
  const garde = exigerRole(request, 'tablette', 'consulter les tarifs');
  if (!garde.ok) return garde.reponse;
  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get('aRanger') === '1') {
      const signales = await prisma.tarif.findMany({
        where: { creeAuComptoir: true, actif: true },
        orderBy: [{ modifieLe: 'desc' }],
        select: { id: true, nom: true, prixCentimes: true, modifieLe: true },
      });
      return NextResponse.json(signales);
    }

    const demandee = searchParams.get('date');
    const date = demandee && estDateISO(demandee) ? demandee : priseBruxelles(new Date()).datePrise;
    const rayons = await listerParCategorieServeur(date);
    if (!rayons.ok) return refus(rayons, 'GET /api/tarifs');

    // Forme FicheCatalogue (src/components/commande/modele.ts) : ce que le domaine lit.
    const fiches = rayons.donnees.flatMap((r) =>
      r.produits.map(({ produit, prix }) => ({
        produit: {
          id: produit.id,
          produit: produit.produit,
          sousCategorie: produit.sousCategorie,
          categorie: produit.categorie,
          unite: produit.unite,
          regimePrix: produit.regimePrix,
          famille: produit.famille,
          estFavori: produit.estFavori,
        },
        prix: {
          prixCentimes: prix.prixCentimes,
          basePrix: prix.basePrix,
          prixEstPlancher: prix.prixEstPlancher,
          minQuantite: prix.minQuantite,
          minParSymbole: prix.minParSymbole,
          typeMin: prix.typeMin,
          maxParUnite: prix.maxParUnite,
          etages: prix.etages,
          versionCode: prix.versionCode,
          valideDu: prix.valideDu,
        },
      })),
    );
    return NextResponse.json({ date, fiches }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'GET /api/tarifs');
    return NextResponse.json(corps, { status: statut });
  }
}

/**
 * Signaler au gérant un produit qui manque au tarif (« Retenir pour le tarif »
 * de l'écran de commande). HYPOTHÈSE À VALIDER : réservé au gérant.
 * Le prix indiqué est une PROPOSITION pour le prochain import : il n'est
 * jamais appliqué à une commande.
 */
export async function POST(request: Request) {
  const garde = exigerRole(request, 'gerant', 'créer un tarif');
  if (!garde.ok) return garde.reponse;
  try {
    const corps = await request.json();
    const nom = texte(corps.nom, 120);
    const prixCentimes = Number(corps.prixCentimes);

    if (!nom) {
      return refus(signaler('ERR_CHAMP_OBLIGATOIRE', { champLibelle: 'libellé' }, { champ: 'nom' }), 'POST /api/tarifs');
    }
    if (!Number.isSafeInteger(prixCentimes) || prixCentimes <= 0) {
      return refus(
        signaler('ERR_MONTANT_NUL', { objet: `« ${nom} »` }, { champ: 'prixCentimes' }),
        'POST /api/tarifs',
      );
    }

    const existant = await prisma.tarif.findFirst({ where: { nom: { equals: nom, mode: 'insensitive' } } });
    if (existant) {
      // Déjà signalé : on le remet dans la liste « à ranger » plutôt que d'en créer un jumeau.
      const remis = await prisma.tarif.update({ where: { id: existant.id }, data: { creeAuComptoir: true, actif: true } });
      return NextResponse.json(remis);
    }

    const tarif = await prisma.tarif.create({
      data: { nom, categorie: 'À ranger', prixCentimes, creeAuComptoir: true, ordre: 9000 },
    });
    return NextResponse.json(tarif, { status: 201 });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'POST /api/tarifs');
    return NextResponse.json(corps, { status: statut });
  }
}

/** Ranger un produit signalé (le gérant l'a fait ajouter au catalogue, ou l'écarte). */
export async function PATCH(request: Request) {
  const garde = exigerRole(request, 'gerant', 'modifier un tarif');
  if (!garde.ok) return garde.reponse;
  try {
    const corps = await request.json();
    const id = Number(corps.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return refus(signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'produit signalé' }, { champ: 'id' }), 'PATCH /api/tarifs');
    }
    const tarif = await prisma.tarif.update({ where: { id }, data: { creeAuComptoir: false } });
    return NextResponse.json(tarif);
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'PATCH /api/tarifs');
    return NextResponse.json(corps, { status: statut });
  }
}

export const dynamic = 'force-dynamic';
