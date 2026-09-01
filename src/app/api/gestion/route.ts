// src/app/api/gestion/route.ts
// Vérifie le code de gestion sans jamais l'exposer au navigateur.

import { NextResponse } from 'next/server';

const CODE_GESTION = process.env.CODE_GESTION ?? '';

/** Comparaison à durée constante : évite de révéler le code caractère par caractère. */
function memeCode(fourni: string, attendu: string): boolean {
  if (fourni.length !== attendu.length) return false;
  let difference = 0;
  for (let i = 0; i < attendu.length; i++) {
    difference |= fourni.charCodeAt(i) ^ attendu.charCodeAt(i);
  }
  return difference === 0;
}

export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    if (!CODE_GESTION) {
      return NextResponse.json(
        { valide: false, erreur: "Le code de gestion n'est pas configuré sur le serveur." },
        { status: 503 }
      );
    }

    // Petit délai fixe : rend une tentative par force brute fastidieuse sans
    // gêner l'usage normal, où l'on saisit le code une fois par appareil.
    await new Promise((resoudre) => setTimeout(resoudre, 400));

    const valide = typeof code === 'string' && memeCode(code, CODE_GESTION);
    return NextResponse.json({ valide }, { status: valide ? 200 : 403 });
  } catch {
    return NextResponse.json({ valide: false }, { status: 400 });
  }
}

export const dynamic = 'force-dynamic';
