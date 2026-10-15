// prisma/seed.mjs
// Remplit la table Produit avec tous les articles de la feuille d'inventaire.
// Chaque variante est un produit distinct (Grand / Petit, blanc / gris, etc.)
// Idempotent : peut être relancé sans créer de doublons (upsert sur "nom").
//
// LOI 10 — "Produit" est la liste d'INVENTAIRE, et elle seule : le catalogue
// de commande vit dans "ProduitCatalogue" (import de catalogue-prix), qui
// n'est jamais lu ni écrit ici. Le nom est unique dans la liste
// d'inventaire (index "Produit_nom_key").
// Aucun prix ici : les prix sont ceux du catalogue de commande (PrixProduit).
// Usage : npm run db:seed

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { CATALOGUE } from '../src/lib/catalogue.mjs';

const prisma = new PrismaClient();

async function main() {
  const noms = CATALOGUE.map((p) => p.nom);
  const doublons = noms.filter((n, i) => noms.indexOf(n) !== i);
  if (doublons.length > 0) {
    throw new Error(`Doublons dans le catalogue : ${[...new Set(doublons)].join(', ')}`);
  }

  console.log(`Insertion de ${CATALOGUE.length} produits...`);

  let crees = 0;
  let majs = 0;

  for (let i = 0; i < CATALOGUE.length; i++) {
    const { nom, categorie, poste } = CATALOGUE[i];
    const ordre = (i + 1) * 10; // pas de 10 pour pouvoir intercaler plus tard

    const existant = await prisma.produit.findUnique({ where: { nom }, select: { id: true } });

    await prisma.produit.upsert({
      where: { nom },
      update: { ordre, categorie, poste },
      create: { nom, ordre, categorie, poste },
    });

    existant ? majs++ : crees++;
  }

  const parPoste = await prisma.produit.groupBy({
    by: ['poste'],
    _count: { _all: true },
  });

  console.log(`OK - ${crees} créé(s), ${majs} mis à jour.`);
  for (const p of parPoste) {
    console.log(`   ${p.poste.padEnd(12)} ${p._count._all} produits`);
  }
}

main()
  .catch((e) => {
    console.error('Erreur seed :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
