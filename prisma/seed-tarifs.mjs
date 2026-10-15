// prisma/seed-tarifs.mjs
// Remplit la grille tarifaire. Idempotent : relancer ne cree pas de doublon
// et n'ecrase pas un prix corrige a la main depuis l'ecran des tarifs — sauf
// si on passe --forcer-les-prix.
//
//   npm run db:seed-tarifs
//   npm run db:seed-tarifs -- --forcer-les-prix
//
// La version precedente lisait puis ecrivait article par article : 600 allers
// -retours vers la base pour 300 produits. Avec une base hebergee outre-
// Atlantique, chaque aller-retour coute ~100 ms de latence pure et le seed
// prenait plusieurs minutes. Ici on lit tout d'un coup, on compare en memoire,
// et on n'ecrit que ce qui change, par lots.

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { TARIFS } from '../src/lib/tarifs.mjs';

const prisma = new PrismaClient();
const forcerLesPrix = process.argv.includes('--forcer-les-prix');

/** Au-dela, certaines bases refusent la requete groupee. */
const LOT = 100;

async function main() {
  const debut = Date.now();

  const existants = new Map((await prisma.tarif.findMany()).map((t) => [t.nom, t]));

  const aCreer = [];
  const aMettreAJour = [];
  let inchanges = 0;

  for (const [index, article] of TARIFS.entries()) {
    const ordre = index * 10;
    const existant = existants.get(article.nom);

    if (!existant) {
      aCreer.push({
        nom: article.nom,
        categorie: article.categorie,
        prixCentimes: article.prixCentimes,
        poste: article.poste,
        ordre,
      });
      continue;
    }

    // Le prix appartient au manager : on ne l'ecrase pas sans le demander.
    const donnees = { categorie: article.categorie, poste: article.poste, ordre };
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
    aMettreAJour.push({ id: existant.id, donnees });
  }

  if (aCreer.length) {
    for (let i = 0; i < aCreer.length; i += LOT) {
      await prisma.tarif.createMany({ data: aCreer.slice(i, i + LOT) });
    }
  }

  // Un tableau passe a $transaction part en un seul echange avec la base,
  // la ou une boucle d'await en ferait un par ligne.
  for (let i = 0; i < aMettreAJour.length; i += LOT) {
    await prisma.$transaction(
      aMettreAJour
        .slice(i, i + LOT)
        .map((m) => prisma.tarif.update({ where: { id: m.id }, data: m.donnees }))
    );
  }

  const secondes = ((Date.now() - debut) / 1000).toFixed(1);
  console.log(
    `Tarifs : ${aCreer.length} cree(s), ${aMettreAJour.length} mis a jour, ${inchanges} inchange(s) en ${secondes}s.`
  );
  if (!forcerLesPrix) {
    console.log('Les prix existants ont ete conserves. --forcer-les-prix pour les reecrire.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
