// src/app/api/calendrier/route.ts
//
// Lecture seule, pour l'écran de commande : jours fermés (LOI 3, une DONNÉE),
// règlement intérieur (LOI 11 : acompte minimum ; heure minimale de retrait
// pâtisserie par jour `reglement.horairesRetraitPatisserie.parJour` et par date
// `…exceptions` ; tailles standard `reglement.taillesGateau`), délais
// en jours ouvrés, date du jour du magasin, et si l'accès gérant est ouvert
// sur cette tablette. L'écran rejoue le domaine avec ces données ; le serveur
// les rejoue de toute façon à l'enregistrement (POST /api/commandes).
// Droits : src/lib/auth/matrice.ts (toute tablette installée, GET seulement).

import { NextResponse } from 'next/server';
import { exigerRole, gerantActif } from '@/lib/auth/garde';
import { traiterErreur } from '@/lib/erreurBase';
import { chargerContexte, priseBruxelles } from '@/app/api/commandes/contexteServeur';

export async function GET(request: Request) {
  const garde = exigerRole(request, 'tablette', 'consulter le calendrier');
  if (!garde.ok) return garde.reponse;
  try {
    const contexte = await chargerContexte('GET /api/calendrier');
    const { datePrise, heurePrise } = priseBruxelles(new Date());
    return NextResponse.json(
      {
        aujourdhui: datePrise,
        heure: heurePrise,
        joursFermes: contexte.joursFermes,
        reglement: contexte.reglement,
        delais: contexte.delais,
        gerant: gerantActif(request, garde.tablette),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'GET /api/calendrier');
    return NextResponse.json(corps, { status: statut });
  }
}

export const dynamic = 'force-dynamic';
