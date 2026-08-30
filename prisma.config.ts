import { defineConfig } from "prisma/config";
import "dotenv/config";

// Les migrations passent par la connexion directe (session pooler, port 5432).
// Le pooler transactionnel (6543) ne supporte pas les commandes DDL de Prisma Migrate.
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error("DIRECT_URL (ou DATABASE_URL) doit etre defini dans .env");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: migrationUrl,
  },
});
