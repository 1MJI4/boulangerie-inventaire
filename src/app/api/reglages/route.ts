// src/app/api/reglages/route.ts
//
// Réglages du règlement intérieur modifiables par le gérant (LOI 11, décisions
// du 15/10/2026 et du 18/10/2026) : heures d'ouverture du magasin jour par jour
// et par date exceptionnelle (bornes de l'heure de retrait), tailles standard
// des gâteaux simples, délai minimum d'un gâteau à étages (jours ouvrés).
// Lecture : toute tablette (l'écran de commande en a besoin, via aussi
// GET /api/calendrier). Écriture : gérant seulement.
// Le format est contrôlé par `ecrireReglages` (src/lib/serveur/reglages.ts,
// propriétaire `base-donnees`) puis par le CHECK de la base ; un refus est
// renvoyé au format LOI 9 (ERR_SAISIE_INVALIDE + champ).
// Droits : src/lib/auth/matrice.ts.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigerRole } from '@/lib/auth/garde';
import { reponseEchec, traiterErreur } from '@/lib/erreurBase';
import { ecrireReglages, lireReglages, type ReglagesPartiels, type ReglagesReglement } from '@/lib/serveur/reglages';
import { signaler } from '@/domaine/messages';

/** Ce que voit l'écran : seulement ce qui se règle ici. */
function vue(r: ReglagesReglement) {
  const h = r.reglement.horairesOuverture;
  return {
    parJour: h.parJour,
    exceptions: h.exceptions,
    taillesGateau: r.reglement.taillesGateau,
    delaiGateauEtagesJours: r.delaiGateauEtagesJours,
  };
}

export async function GET(request: Request) {
  const garde = exigerRole(request, 'tablette', 'consulter les réglages');
  if (!garde.ok) return garde.reponse;
  try {
    return NextResponse.json(vue(await lireReglages(prisma)), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'GET /api/reglages');
    return NextResponse.json(corps, { status: statut });
  }
}

/**
 * Corps accepté (chaque champ facultatif) :
 *   { parJour?: { "1": { ouverture: "HH:MM", fermeture: "HH:MM" }, … },
 *     exceptions?: [{ date: "AAAA-MM-JJ", ouverture: "HH:MM", fermeture: "HH:MM" }],
 *     taillesGateau?: number[], delaiGateauEtagesJours?: number }
 * `parJour` peut ne contenir que les jours modifiés ; `exceptions` et
 * `taillesGateau` remplacent la liste entière.
 */
export async function PUT(request: Request) {
  const garde = exigerRole(request, 'gerant', 'modifier les réglages');
  if (!garde.ok) return garde.reponse;
  try {
    let corps: Record<string, unknown> | null = null;
    try {
      const brut: unknown = await request.json();
      corps = brut && typeof brut === 'object' && !Array.isArray(brut) ? (brut as Record<string, unknown>) : null;
    } catch {
      corps = null;
    }
    if (!corps) {
      const { corps: c, statut } = reponseEchec(signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'réglages' }), 'PUT /api/reglages');
      return NextResponse.json(c, { status: statut });
    }
    const partiel: ReglagesPartiels = {};
    if (corps.parJour !== undefined) partiel.ouvertureParJour = corps.parJour as ReglagesPartiels['ouvertureParJour'];
    if (corps.exceptions !== undefined) partiel.ouvertureExceptions = corps.exceptions as ReglagesPartiels['ouvertureExceptions'];
    if (corps.taillesGateau !== undefined) partiel.taillesGateau = corps.taillesGateau as ReglagesPartiels['taillesGateau'];
    if (corps.delaiGateauEtagesJours !== undefined) {
      partiel.delaiGateauEtagesJours = corps.delaiGateauEtagesJours as ReglagesPartiels['delaiGateauEtagesJours'];
    }

    const r = await ecrireReglages(prisma, partiel);
    if (!r.ok) {
      const { corps: c, statut } = reponseEchec(r, 'PUT /api/reglages');
      return NextResponse.json(c, { status: statut });
    }
    return NextResponse.json(vue(r.donnees));
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'PUT /api/reglages');
    return NextResponse.json(corps, { status: statut });
  }
}

export const dynamic = 'force-dynamic';
