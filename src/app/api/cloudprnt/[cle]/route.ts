// src/app/api/cloudprnt/[cle]/route.ts
//
// Route de SECOURS du dialogue avec l'imprimante Star. En production, l'adresse
// /api/cloudprnt/<clé> est servie par la fonction Netlify dédiée
// (netlify/functions/imprimante.mts), qui démarre vite même « à froid » et
// n'est jamais en concurrence avec la tablette. Cette route sert en
// développement et prend le relais si la fonction n'est pas déployée.
// Toute la logique est dans src/lib/serveur/cloudprnt.ts.
//
// Accès : exception au proxy (src/lib/auth/chemins.ts) ; la clé de l'adresse
// est vérifiée par repondreImprimante.

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cleValide as cleConforme, repondreImprimante } from '@/lib/serveur/cloudprnt';
import { depotPrisma } from '@/lib/serveur/depotImprimante';

const depot = depotPrisma(prisma);

type Contexte = { params: Promise<{ cle: string }> };

/** La clé de l'adresse, comparée à CLOUDPRNT_CLE. Vérifiée en tête de chaque méthode. */
function cleValide(cle: string): boolean {
  return cleConforme(cle, process.env.CLOUDPRNT_CLE);
}

const refus = () => new Response(null, { status: 403, headers: { 'Cache-Control': 'no-store' } });

export async function POST(requete: NextRequest, { params }: Contexte) {
  const { cle } = await params;
  if (!cleValide(cle)) return Response.json({ jobReady: false }, { status: 403 });
  return repondreImprimante(requete, cle, depot, process.env.CLOUDPRNT_CLE);
}

export async function GET(requete: NextRequest, { params }: Contexte) {
  const { cle } = await params;
  if (!cleValide(cle)) return refus();
  return repondreImprimante(requete, cle, depot, process.env.CLOUDPRNT_CLE);
}

export async function DELETE(requete: NextRequest, { params }: Contexte) {
  const { cle } = await params;
  if (!cleValide(cle)) return refus();
  return repondreImprimante(requete, cle, depot, process.env.CLOUDPRNT_CLE);
}
