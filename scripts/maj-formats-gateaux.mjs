// scripts/maj-formats-gateaux.mjs
//
// Met a jour UNIQUEMENT les formats fixes des familles de gateaux, d'apres la
// grille de septembre 2026. Rien d'autre n'est touche : ni le prix par
// personne, ni les paliers, ni les minimums, ni les parfums.
//
// Pourquoi un script separe plutot que « seed-gateaux --forcer-les-prix » :
// le seed reecrirait toute la famille avec les valeurs du fichier, donc
// effacerait les reglages que le manager a pu corriger depuis l'ecran. Ici on
// ne remplace que les quatre grilles de prix que le nouveau tarif redefinit.
//
//   node scripts/maj-formats-gateaux.mjs            (montre ce qui changerait)
//   node scripts/maj-formats-gateaux.mjs --appliquer

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();
const appliquer = process.argv.includes('--appliquer');

// Repris tel quel du fichier « Prix PP 9-2026.xlsx ».
const NOUVEAUX = {
  bavarois: { 4: 2000, 6: 3100, 8: 3600, 10: 3900 },
  classique: { 4: 2000, 6: 3100, 8: 3600 },
  'creme-fraiche': { 6: 2600, 8: 3100 },
  tarte: { 6: 1800 },
};

const euros = (c) => (c / 100).toFixed(2).replace('.', ',');

async function main() {
  for (const [cle, formats] of Object.entries(NOUVEAUX)) {
    const famille = await prisma.familleGateau.findUnique({ where: { cle } });
    if (!famille) {
      console.log(`${cle} : famille absente de la base, ignoree.`);
      continue;
    }
    let avant = {};
    try {
      avant = famille.formatsFixes ? JSON.parse(famille.formatsFixes) : {};
    } catch {
      avant = {};
    }

    const lignes = [];
    for (const [parts, centimes] of Object.entries(formats)) {
      const ancien = avant[parts];
      if (ancien === centimes) continue;
      lignes.push(`    ${parts}P : ${ancien ? euros(ancien) : 'absent'} -> ${euros(centimes)}`);
    }

    if (!lignes.length) {
      console.log(`${famille.libelle} : deja a jour.`);
      continue;
    }
    console.log(`${famille.libelle} :`);
    for (const l of lignes) console.log(l);

    if (appliquer) {
      await prisma.familleGateau.update({
        where: { cle },
        data: { formatsFixes: JSON.stringify({ ...avant, ...formats }) },
      });
    }
  }

  console.log(
    appliquer
      ? '\nApplique.'
      : '\nRien n a ete ecrit. Relancez avec --appliquer pour enregistrer.'
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
