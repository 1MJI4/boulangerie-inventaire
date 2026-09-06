// prisma/seed-gateaux.mjs
// Remplit familles, parfums et décorations. Idempotent : relancer ne crée pas
// de doublon et n'écrase pas un prix corrigé depuis l'écran de réglages,
// sauf avec --forcer-les-prix.

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { FAMILLES, PARFUMS, DECORATIONS, GARNITURES } from '../src/lib/gateauxParDefaut.mjs';

const prisma = new PrismaClient();
const forcer = process.argv.includes('--forcer-les-prix');

async function main() {
  let crees = 0;

  for (const [i, f] of FAMILLES.entries()) {
    const existante = await prisma.familleGateau.findUnique({ where: { cle: f.cle } });
    const base = {
      genre: f.genre ?? 'gateau',
      unite: f.unite ?? 'personne',
      libelle: f.libelle,
      minimumParts: f.minimumParts ?? null,
      formatsFixes: f.formatsFixes ? JSON.stringify(f.formatsFixes) : null,
      paliers: f.paliers ? JSON.stringify(f.paliers) : null,
      note: f.note ?? null,
      ordre: i * 10,
    };
    if (!existante) {
      await prisma.familleGateau.create({
        data: { cle: f.cle, parPersonneCentimes: f.parPersonneCentimes, ...base },
      });
      crees += 1;
    } else {
      await prisma.familleGateau.update({
        where: { id: existante.id },
        data: forcer ? { ...base, parPersonneCentimes: f.parPersonneCentimes } : base,
      });
    }
  }

  for (const [i, nom] of PARFUMS.entries()) {
    await prisma.optionGateau.upsert({
      where: { genre_nom: { genre: 'parfum', nom } },
      create: { genre: 'parfum', nom, ordre: i * 10 },
      update: { ordre: i * 10 },
    });
  }

  for (const [i, nom] of GARNITURES.entries()) {
    await prisma.optionGateau.upsert({
      where: { genre_nom: { genre: 'garniture', nom } },
      create: { genre: 'garniture', nom, ordre: i * 10 },
      update: { ordre: i * 10 },
    });
  }

  for (const [i, d] of DECORATIONS.entries()) {
    const existante = await prisma.optionGateau.findUnique({
      where: { genre_nom: { genre: 'decoration', nom: d.nom } },
    });
    if (!existante) {
      await prisma.optionGateau.create({
        data: { genre: 'decoration', nom: d.nom, supplementCentimes: d.supplementCentimes, ordre: i * 10 },
      });
    } else {
      await prisma.optionGateau.update({
        where: { id: existante.id },
        data: forcer ? { supplementCentimes: d.supplementCentimes, ordre: i * 10 } : { ordre: i * 10 },
      });
    }
  }

  const [nf, ns, np, ng, nd] = await Promise.all([
    prisma.familleGateau.count({ where: { genre: 'gateau' } }),
    prisma.familleGateau.count({ where: { genre: 'sale' } }),
    prisma.optionGateau.count({ where: { genre: 'parfum' } }),
    prisma.optionGateau.count({ where: { genre: 'garniture' } }),
    prisma.optionGateau.count({ where: { genre: 'decoration' } }),
  ]);
  console.log(
    `Composition : ${nf} familles de gâteaux, ${ns} de salé, ${np} parfums, ${ng} garnitures, ${nd} décorations (${crees} créée(s)).`
  );
  if (!forcer) console.log('Les prix existants ont été conservés. --forcer-les-prix pour les réécrire.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
