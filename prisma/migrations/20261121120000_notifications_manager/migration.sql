-- =====================================================================
-- Notifications du manager (21/11/2026) : abonnements push des appareils
-- du manager et journal d'envoi (anti-doublon).
-- AJOUT SIMPLE, NON DESTRUCTIF : deux tables neuves, rien d'existant touche.
-- Migration NOUVELLE : les precedentes ne sont JAMAIS modifiees.
-- Retour arriere : DROP TABLE "NotificationEnvoyee"; DROP TABLE "AbonnementNotification";
-- =====================================================================

CREATE TABLE "AbonnementNotification" (
  "id" SERIAL NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AbonnementNotification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AbonnementNotification_endpoint_key" ON "AbonnementNotification"("endpoint");

CREATE TABLE "NotificationEnvoyee" (
  "cle" TEXT NOT NULL,
  "envoyeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationEnvoyee_pkey" PRIMARY KEY ("cle")
);
CREATE INDEX "NotificationEnvoyee_envoyeLe_idx" ON "NotificationEnvoyee"("envoyeLe");
