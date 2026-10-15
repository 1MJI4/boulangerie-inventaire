// src/app/api/gateaux/route.ts
//
// Familles, parfums et décorations. Tout le monde peut les lire — le vendeur en
// a besoin à chaque commande — mais seul le gérant connecté les modifie,
// comme pour le catalogue.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { traiterErreur } from '@/lib/erreurBase';
import { COUPES_PAR_DEFAUT, type ReglageCoupes } from '@/lib/gateaux';
import { exigerRole } from '@/lib/auth/garde';

// Droits : voir src/lib/auth/matrice.ts (lecture : toute tablette installée ; écriture : gérant).

function texte(valeur: unknown, max = 80): string {
  return typeof valeur === 'string' ? valeur.trim().slice(0, max) : '';
}

function entierPositif(valeur: unknown): number | null {
  const n = Number(valeur);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/** Les paliers voyagent en JSON ; on ne les rend qu'une fois analysés. */
function lirePaliers(brut: string | null): { aPartirDe: number; centimes: number }[] | null {
  if (!brut) return null;
  try {
    const liste = JSON.parse(brut) as { aPartirDe: number; centimes: number }[];
    if (!Array.isArray(liste)) return null;
    const propre = liste
      .map((p) => ({ aPartirDe: Math.round(Number(p.aPartirDe)), centimes: Math.round(Number(p.centimes)) }))
      .filter((p) => Number.isFinite(p.aPartirDe) && Number.isFinite(p.centimes) && p.centimes >= 0)
      .sort((a, b) => a.aPartirDe - b.aPartirDe);
    return propre.length > 0 ? propre : null;
  } catch {
    return null;
  }
}

/** Les formats fixes voyagent en JSON ; on ne les rend qu'une fois analysés. */
function lireFormats(brut: string | null): Record<number, number> | null {
  if (!brut) return null;
  try {
    const objet = JSON.parse(brut) as Record<string, number>;
    const propre: Record<number, number> = {};
    for (const [parts, centimes] of Object.entries(objet)) {
      const p = Number(parts);
      const c = Number(centimes);
      if (Number.isFinite(p) && Number.isFinite(c)) propre[p] = Math.round(c);
    }
    return Object.keys(propre).length > 0 ? propre : null;
  } catch {
    return null;
  }
}

const CLE_COUPES = 'coupes';

function lireCoupes(brut: string | null | undefined): ReglageCoupes {
  if (!brut) return COUPES_PAR_DEFAUT;
  try {
    const objet = JSON.parse(brut) as Partial<ReglageCoupes>;
    return {
      mode:
        objet.mode === 'libre' || objet.mode === 'interdire' || objet.mode === 'avertir'
          ? objet.mode
          : COUPES_PAR_DEFAUT.mode,
      conseillees: Array.isArray(objet.conseillees)
        ? [...new Set(objet.conseillees.map(Number).filter((n) => Number.isFinite(n) && n > 0))].sort(
            (a, b) => a - b
          )
        : COUPES_PAR_DEFAUT.conseillees,
      tolererPairs: objet.tolererPairs !== false,
      exceptions: Array.isArray(objet.exceptions)
        ? [...new Set(objet.exceptions.map(Number).filter((n) => Number.isFinite(n) && n > 0))].sort(
            (a, b) => a - b
          )
        : COUPES_PAR_DEFAUT.exceptions,
    };
  } catch {
    return COUPES_PAR_DEFAUT;
  }
}

export async function GET(request: Request) {
  const garde = exigerRole(request, 'tablette', 'consulter les gâteaux');
  if (!garde.ok) return garde.reponse;
  try {
    const { searchParams } = new URL(request.url);
    const inclureInactifs = searchParams.get('inclureInactifs') === '1';
    const filtre = inclureInactifs ? {} : { actif: true };

    const [familles, options, reglage] = await Promise.all([
      prisma.familleGateau.findMany({ where: filtre, orderBy: [{ ordre: 'asc' }, { libelle: 'asc' }] }),
      prisma.optionGateau.findMany({ where: filtre, orderBy: [{ ordre: 'asc' }, { nom: 'asc' }] }),
      prisma.reglage.findUnique({ where: { cle: CLE_COUPES } }),
    ]);

    return NextResponse.json({
      coupes: lireCoupes(reglage?.valeur),
      familles: familles.map((f) => ({
        id: f.id,
        cle: f.cle,
        genre: f.genre,
        unite: f.unite,
        libelle: f.libelle,
        parPersonneCentimes: f.parPersonneCentimes,
        minimumParts: f.minimumParts,
        formatsFixes: lireFormats(f.formatsFixes),
        paliers: lirePaliers(f.paliers),
        note: f.note,
        actif: f.actif,
      })),
      garnitures: options
        .filter((o) => o.genre === 'garniture')
        .map((o) => ({ id: o.id, nom: o.nom, supplementCentimes: o.supplementCentimes, actif: o.actif })),
      parfums: options
        .filter((o) => o.genre === 'parfum')
        .map((o) => ({ id: o.id, nom: o.nom, supplementCentimes: o.supplementCentimes, actif: o.actif })),
      decorations: options
        .filter((o) => o.genre === 'decoration')
        .map((o) => ({ id: o.id, nom: o.nom, supplementCentimes: o.supplementCentimes, actif: o.actif })),
    });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'GET /api/gateaux');
    return NextResponse.json(corps, { status: statut });
  }
}

/** Ajout d'une famille, d'un parfum ou d'une décoration. */
export async function POST(request: Request) {
  const garde = exigerRole(request, 'gerant', 'ajouter une option de gâteau');
  if (!garde.ok) return garde.reponse;
  try {
    const corps = await request.json();

    if (corps.type === 'famille') {
      const libelle = texte(corps.libelle, 60);
      const parPersonneCentimes = entierPositif(corps.parPersonneCentimes);
      if (!libelle) return NextResponse.json({ error: 'Le nom est obligatoire.' }, { status: 400 });
      if (parPersonneCentimes === null) {
        return NextResponse.json({ error: 'Indiquez un prix par personne.' }, { status: 400 });
      }
      const cle = libelle
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const famille = await prisma.familleGateau.create({
        data: {
          cle: `${cle}-${Date.now().toString(36).slice(-4)}`,
          genre: corps.genre === 'sale' ? 'sale' : 'gateau',
          unite: corps.unite === 'piece' ? 'piece' : 'personne',
          libelle,
          parPersonneCentimes,
          minimumParts: entierPositif(corps.minimumParts) || null,
          note: texte(corps.note, 200) || null,
          ordre: 900,
        },
      });
      return NextResponse.json(famille, { status: 201 });
    }

    const genre =
      corps.type === 'decoration' ? 'decoration' : corps.type === 'garniture' ? 'garniture' : 'parfum';
    const nom = texte(corps.nom, 60);
    if (!nom) return NextResponse.json({ error: 'Le nom est obligatoire.' }, { status: 400 });

    const option = await prisma.optionGateau.upsert({
      where: { genre_nom: { genre, nom } },
      create: { genre, nom, supplementCentimes: entierPositif(corps.supplementCentimes) ?? 0, ordre: 900 },
      update: { actif: true },
    });
    return NextResponse.json(option, { status: 201 });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'POST /api/gateaux');
    return NextResponse.json(corps, { status: statut });
  }
}

/** Correction d'un prix, d'un nom, d'un minimum, ou mise hors service. */
export async function PATCH(request: Request) {
  const garde = exigerRole(request, 'gerant', 'modifier les gâteaux');
  if (!garde.ok) return garde.reponse;
  try {
    const corps = await request.json();

    // Les coupes sont un réglage de boutique, pas une ligne de liste.
    if (corps.type === 'coupes') {
      const coupes = lireCoupes(JSON.stringify(corps.coupes ?? {}));
      await prisma.reglage.upsert({
        where: { cle: CLE_COUPES },
        create: { cle: CLE_COUPES, valeur: JSON.stringify(coupes) },
        update: { valeur: JSON.stringify(coupes) },
      });
      return NextResponse.json(coupes);
    }

    const id = Number(corps.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Élément invalide' }, { status: 400 });
    }

    if (corps.type === 'famille') {
      const donnees: Record<string, unknown> = {};
      if (texte(corps.libelle, 60)) donnees.libelle = texte(corps.libelle, 60);
      if (entierPositif(corps.parPersonneCentimes) !== null) {
        donnees.parPersonneCentimes = entierPositif(corps.parPersonneCentimes);
      }
      if ('minimumParts' in corps) donnees.minimumParts = entierPositif(corps.minimumParts) || null;
      if ('note' in corps) donnees.note = texte(corps.note, 200) || null;
      if (typeof corps.actif === 'boolean') donnees.actif = corps.actif;
      if ('formatsFixes' in corps) {
        donnees.formatsFixes =
          corps.formatsFixes && typeof corps.formatsFixes === 'object'
            ? JSON.stringify(corps.formatsFixes)
            : null;
      }
      if ('paliers' in corps) {
        // Un seul palier ne dit rien de plus que le tarif de base : on le
        // range plutôt que de garder une liste d'un élément.
        const paliers = Array.isArray(corps.paliers)
          ? corps.paliers
              .map((p: { aPartirDe?: unknown; centimes?: unknown }) => ({
                aPartirDe: Math.max(1, Math.round(Number(p.aPartirDe) || 1)),
                centimes: Math.max(0, Math.round(Number(p.centimes) || 0)),
              }))
              .sort((a: { aPartirDe: number }, b: { aPartirDe: number }) => a.aPartirDe - b.aPartirDe)
          : [];
        donnees.paliers = paliers.length > 1 ? JSON.stringify(paliers) : null;
        if (paliers.length > 0) donnees.parPersonneCentimes = paliers[0].centimes;
      }
      const famille = await prisma.familleGateau.update({ where: { id }, data: donnees });
      return NextResponse.json(famille);
    }

    const donnees: Record<string, unknown> = {};
    if (texte(corps.nom, 60)) donnees.nom = texte(corps.nom, 60);
    if (entierPositif(corps.supplementCentimes) !== null) {
      donnees.supplementCentimes = entierPositif(corps.supplementCentimes);
    }
    if (typeof corps.actif === 'boolean') donnees.actif = corps.actif;

    const option = await prisma.optionGateau.update({ where: { id }, data: donnees });
    return NextResponse.json(option);
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'PATCH /api/gateaux');
    return NextResponse.json(corps, { status: statut });
  }
}

export const dynamic = 'force-dynamic';
