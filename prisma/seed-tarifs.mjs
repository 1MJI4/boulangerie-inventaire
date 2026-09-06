// prisma/seed-tarifs.mjs
// Remplit la grille tarifaire. Idempotent : relancer ne cree pas de doublon
// et n'ecrase pas un prix corrige a la main depuis l'ecran des tarifs — sauf
// si on passe --forcer-les-prix.
//
//   node prisma/seed-tarifs.mjs
//   node prisma/seed-tarifs.mjs --forcer-les-prix

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { TARIFS } from '../src/lib/tarifs.mjs';

const prisma = new PrismaClient();
const forcerLesPrix = process.argv.includes('--forcer-les-prix');

async function main() {
  let crees = 0;
  let majs = 0;
  let inchanges = 0;

  for (const [index, article] of TARIFS.entries()) {
    const existant = await prisma.tarif.findUnique({ where: { nom: article.nom } });

    if (!existant) {
      await prisma.tarif.create({
        data: {
          nom: article.nom,
          categorie: article.categorie,
          prixCentimes: article.prixCentimes,
          poste: article.poste,
          ordre: index * 10,
        },
      });
      crees += 1;
      continue;
    }

    // Le prix appartient au manager : on ne l'ecrase pas sans le demander.
    const donnees = { categorie: article.categorie, poste: article.poste, ordre: index * 10 };
    if (forcerLesPrix) donnees.prixCentimes = article.prixCentimes;

    const identique =
      existant.categorie === donnees.categorie &&
      existant.poste === donnees.poste &&
      existant.ordre === donnees.ordre &&
      (!forcerLesPrix || existant.prixCentimes === article.prixCentimes);

    if (identique) {
      inchanges += 1;
      continue;
    }

    await prisma.tarif.update({ where: { id: existant.id }, data: donnees });
    majs += 1;
  }

  console.log(`Tarifs : ${crees} cree(s), ${majs} mis a jour, ${inchanges} inchange(s).`);
  if (!forcerLesPrix && majs + crees < TARIFS.length) {
    console.log('Les prix existants ont ete conserves. --forcer-les-prix pour les reecrire.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
