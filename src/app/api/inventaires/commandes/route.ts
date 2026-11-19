// src/app/api/inventaires/commandes/route.ts
//
// R72 — Part des commandes clients pour une journée de production : pièces
// commandées par produit du fournil (dérivés compris), plateaux en plus,
// détail par produit commandé. Lu par l'écran des prévisions et la feuille
// du fournil.
//
// Cette lecture RECALCULE et enregistre (rattrapage d'un recalcul manqué
// après une commande) : voir src/lib/serveur/partCommandee.ts. Idempotent.

import { NextResponse } from 'next/server';
import { traiterErreur } from '@/lib/erreurBase';
import { exigerRole } from '@/lib/auth/garde';
import { journeeProduction } from '@/lib/dateProduction';
import { lireDate } from '@/lib/inventaire/lot';
import { recalculerPartCommandee } from '@/lib/serveur/partCommandee';

export async function GET(request: Request) {
  const garde = exigerRole(request, 'tablette', 'consulter un inventaire');
  if (!garde.ok) return garde.reponse;
  try {
    const { searchParams } = new URL(request.url);
    const journee = lireDate(searchParams.get('date') ?? undefined) ?? journeeProduction();
    return NextResponse.json(await recalculerPartCommandee(journee));
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'GET /api/inventaires/commandes');
    return NextResponse.json(corps, { status: statut });
  }
}

/** Lu pendant que les commandes arrivent : jamais de cache. */
export const dynamic = 'force-dynamic';
