// src/lib/serveur/depotImprimante.ts — les deux façons d'atteindre la file
// d'impression (voir DepotImprimante dans cloudprnt.ts).
//
// - depotPrisma : route Next de secours, réutilise le client Prisma de l'app.
// - depotPostgres : fonction Netlify dédiée. Le moteur Prisma (~17 Mo de code
//   natif) met ~5 s à se charger quand la fonction se réveille ; la TSP100IV
//   abandonne au-delà (« 520 Download failed ») et se met en retrait. Le client
//   `postgres` (JavaScript pur) se réveille en une fraction de seconde.
//   Mêmes tables, mêmes effets que Prisma — y compris les déclencheurs en base.

import type { PrismaClient } from '@prisma/client';
import type { Sql } from 'postgres';
import type { DepotImprimante, TravailEnFile, TravailRemis } from './cloudprnt.ts';

const CLE_ETAT = 'imprimante:etat';
const DETAIL_IMPRESSION = 'quatre exemplaires sortis sur le rouleau';

export function depotPrisma(prisma: PrismaClient): DepotImprimante {
  return {
    async noterEtat(valeur) {
      await prisma.reglage.upsert({ where: { cle: CLE_ETAT }, create: { cle: CLE_ETAT, valeur }, update: { valeur } });
    },
    async mediaEnAttente() {
      const t = await prisma.travailImpression.findFirst({ where: { statut: 'en_attente' }, orderBy: { id: 'asc' }, select: { media: true } });
      return t?.media ?? null;
    },
    async travailEnAttente() {
      return prisma.travailImpression.findFirst({
        where: { statut: 'en_attente' },
        orderBy: { id: 'asc' },
        select: { id: true, media: true, contenu: true },
      });
    },
    async marquerRemis(id) {
      await prisma.travailImpression.update({ where: { id }, data: { statut: 'remis', remisLe: new Date() } });
    },
    async premierRemis() {
      return prisma.travailImpression.findFirst({ where: { statut: 'remis' }, orderBy: { id: 'asc' }, select: { id: true, commandeId: true } });
    },
    async marquerImprime(id) {
      await prisma.travailImpression.update({ where: { id }, data: { statut: 'imprime', imprimeLe: new Date(), erreur: null } });
    },
    async remettreEnFile(id, erreur) {
      await prisma.travailImpression.update({ where: { id }, data: { statut: 'en_attente', remisLe: null, erreur } });
    },
    async resteAImprimer(commandeId) {
      return prisma.travailImpression.count({ where: { commandeId, statut: { not: 'imprime' } } });
    },
    async conclureCommande(commandeId) {
      const commande = await prisma.commande.findUnique({ where: { id: commandeId }, select: { statut: true } });
      if (!commande || commande.statut !== 'a_imprimer') return;
      await prisma.commande.update({ where: { id: commandeId }, data: { statut: 'imprimee', imprimeeLe: new Date() } });
      await prisma.evenementCommande.create({
        data: { commandeId, auteur: 'imprimante', action: 'impression', detail: DETAIL_IMPRESSION },
      });
    },
  };
}

export function depotPostgres(sql: Sql): DepotImprimante {
  return {
    async noterEtat(valeur) {
      // « modifieLe » est rempli par Prisma (@updatedAt), pas par la base.
      await sql`
        INSERT INTO "Reglage" ("cle", "valeur", "modifieLe") VALUES (${CLE_ETAT}, ${valeur}, now())
        ON CONFLICT ("cle") DO UPDATE SET "valeur" = EXCLUDED."valeur", "modifieLe" = now()`;
    },
    async mediaEnAttente() {
      const [t] = await sql<{ media: string }[]>`
        SELECT "media" FROM "TravailImpression" WHERE "statut" = 'en_attente' ORDER BY "id" LIMIT 1`;
      return t?.media ?? null;
    },
    async travailEnAttente() {
      const [t] = await sql<TravailEnFile[]>`
        SELECT "id", "media", "contenu" FROM "TravailImpression" WHERE "statut" = 'en_attente' ORDER BY "id" LIMIT 1`;
      return t ?? null;
    },
    async marquerRemis(id) {
      await sql`UPDATE "TravailImpression" SET "statut" = 'remis', "remisLe" = now() WHERE "id" = ${id}`;
    },
    async premierRemis() {
      const [t] = await sql<TravailRemis[]>`
        SELECT "id", "commandeId" FROM "TravailImpression" WHERE "statut" = 'remis' ORDER BY "id" LIMIT 1`;
      return t ?? null;
    },
    async marquerImprime(id) {
      await sql`UPDATE "TravailImpression" SET "statut" = 'imprime', "imprimeLe" = now(), "erreur" = NULL WHERE "id" = ${id}`;
    },
    async remettreEnFile(id, erreur) {
      await sql`UPDATE "TravailImpression" SET "statut" = 'en_attente', "remisLe" = NULL, "erreur" = ${erreur} WHERE "id" = ${id}`;
    },
    async resteAImprimer(commandeId) {
      const [r] = await sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM "TravailImpression" WHERE "commandeId" = ${commandeId} AND "statut" <> 'imprime'`;
      return r?.n ?? 0;
    },
    async conclureCommande(commandeId) {
      // Une seule transaction : la commande et son événement, ou rien.
      await sql.begin(async (tx) => {
        const maj = await tx`
          UPDATE "Commande" SET "statut" = 'imprimee', "imprimeeLe" = now()
          WHERE "id" = ${commandeId} AND "statut" = 'a_imprimer' RETURNING "id"`;
        if (maj.length === 0) return;
        await tx`
          INSERT INTO "EvenementCommande" ("commandeId", "auteur", "action", "detail")
          VALUES (${commandeId}, 'imprimante', 'impression', ${DETAIL_IMPRESSION})`;
      });
    },
  };
}
