// src/lib/serveur/notifications.ts
//
// Envoi des notifications du manager (Web Push, VAPID) : tablette et téléphone,
// application fermée. Serveur uniquement.
//
// Réglages (jamais dans le dépôt) :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUJET (« mailto:… » ou https://…)
//   générés une fois par `npm run notifications:cles`.
// Un réglage absent désactive les notifications SANS jamais gêner une commande :
// aucune erreur d'envoi ne remonte à la route qui l'a déclenchée.

import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { journaliser } from '@/lib/journal';
import { maintenantBruxelles } from '@/lib/dateProduction';
import { alerteExpirationDue } from '@/domaine/brouillons';
import { notifBrouillonNonPaye, rappelsDus, type Notification } from '@/domaine/notifications';

const ROUTE = 'notifications';

let configure: boolean | null = null;

function pret(): boolean {
  if (configure !== null) return configure;
  const publique = process.env.VAPID_PUBLIC_KEY;
  const privee = process.env.VAPID_PRIVATE_KEY;
  const sujet = process.env.VAPID_SUJET;
  if (!publique || !privee || !sujet) {
    configure = false;
    journaliser({
      niveau: 'info',
      code: 'INFO_HYPOTHESE',
      route: ROUTE,
      piste: 'VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY ou VAPID_SUJET absent : notifications du manager désactivées.',
    });
    return false;
  }
  webpush.setVapidDetails(sujet, publique, privee);
  configure = true;
  return true;
}

/** Clé publique donnée au navigateur pour s'abonner (null : notifications non configurées). */
export function cleVapidPublique(): string | null {
  return pret() ? (process.env.VAPID_PUBLIC_KEY as string) : null;
}

export type AbonnementPush = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Forme attendue d'un abonnement venu du navigateur, ou null. */
export function lireAbonnement(valeur: unknown): AbonnementPush | null {
  const v = valeur as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  if (!v || typeof v.endpoint !== 'string' || !/^https:\/\//.test(v.endpoint) || v.endpoint.length > 1000) return null;
  const p256dh = v.keys?.p256dh;
  const auth = v.keys?.auth;
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 200 || auth.length > 100) return null;
  return { endpoint: v.endpoint, keys: { p256dh, auth } };
}

export async function enregistrerAbonnement(a: AbonnementPush): Promise<void> {
  await prisma.abonnementNotification.upsert({
    where: { endpoint: a.endpoint },
    create: { endpoint: a.endpoint, p256dh: a.keys.p256dh, auth: a.keys.auth },
    update: { p256dh: a.keys.p256dh, auth: a.keys.auth },
  });
}

/** Le serveur connaît-il cet appareil ? (l'appareil peut être abonné chez lui sans l'être ici : activation interrompue). */
export async function abonnementConnu(endpoint: string): Promise<boolean> {
  return (await prisma.abonnementNotification.count({ where: { endpoint } })) > 0;
}

export async function retirerAbonnement(endpoint: string): Promise<void> {
  await prisma.abonnementNotification.deleteMany({ where: { endpoint } });
}

/**
 * Envoie une notification à tous les appareils du manager. Une clé déjà envoyée
 * est ignorée (reprise après redémarrage, double déclenchement). Ne lève jamais.
 */
export async function notifierManager(n: Notification): Promise<void> {
  try {
    if (!pret()) return;
    // Réservation de la clé : la contrainte UNIQUE tranche la course entre deux envois.
    const reserve = await prisma.notificationEnvoyee.createMany({ data: [{ cle: n.cle }], skipDuplicates: true });
    if (reserve.count === 0) return;
    const abonnements = await prisma.abonnementNotification.findMany();
    const charge = JSON.stringify({ titre: n.titre, corps: n.corps, url: n.url, urgente: n.urgente, tag: n.cle });
    await Promise.all(
      abonnements.map(async (a) => {
        try {
          await webpush.sendNotification(
            { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
            charge,
            { TTL: 60 * 60, urgency: n.urgente ? 'high' : 'normal' },
          );
        } catch (e) {
          const statut = (e as { statusCode?: number }).statusCode;
          // Appareil désinscrit ou abonnement expiré : on l'oublie.
          if (statut === 404 || statut === 410) await retirerAbonnement(a.endpoint);
          else journaliser({ niveau: 'avertissement', code: 'INFO_HYPOTHESE', route: ROUTE, piste: `Envoi refusé (${statut ?? 'réseau'}).` });
        }
      }),
    );
  } catch {
    journaliser({ niveau: 'avertissement', code: 'INFO_HYPOTHESE', route: ROUTE, piste: 'Envoi impossible (base ou réglage).' });
  }
}

/**
 * Rappels horaires : retrait dans 1 h, à l'heure, 2 h après. Appelée chaque
 * minute par le serveur (src/instrumentation.ts). Idempotente.
 */
export async function verifierRappels(instant: Date = new Date()): Promise<void> {
  try {
    if (!pret()) return;
    const maintenant = maintenantBruxelles(instant);
    const hier = new Date(`${maintenant.date}T12:00:00Z`);
    hier.setUTCDate(hier.getUTCDate() - 1);
    const commandes = await prisma.commande.findMany({
      where: {
        statut: { in: ['a_imprimer', 'imprimee'] },
        retraitHeure: { not: null },
        retraitLe: { gte: new Date(`${hier.toISOString().slice(0, 10)}T00:00:00Z`), lte: new Date(`${maintenant.date}T00:00:00Z`) },
      },
      select: { id: true, numero: true, retraitLe: true, retraitHeure: true },
    });
    // Demain 00h00-01h00 : une commande de ce soir peut avoir son rappel « dans 1 h » après minuit.
    const demain = await prisma.commande.findMany({
      where: {
        statut: { in: ['a_imprimer', 'imprimee'] },
        retraitHeure: { not: null },
        retraitLe: new Date(`${new Date(Date.parse(`${maintenant.date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)}T00:00:00Z`),
      },
      select: { id: true, numero: true, retraitLe: true, retraitHeure: true },
    });
    for (const c of [...commandes, ...demain]) {
      for (const n of rappelsDus({ ...c, retraitLe: c.retraitLe.toISOString().slice(0, 10) }, maintenant)) {
        await notifierManager(n);
      }
    }
    // Brouillons WhatsApp non payés : prévenir le manager 5 minutes après l'expiration, une seule fois.
    const brouillons = await prisma.brouillonCommande.findMany({
      where: { statut: 'en_attente', expireNotifieLe: null, echeanceLe: { lt: instant } },
      select: { id: true, reference: true, echeanceLe: true, expireNotifieLe: true, statut: true },
    });
    for (const b of brouillons) {
      if (!alerteExpirationDue({ statut: 'en_attente', echeanceLe: b.echeanceLe, expireNotifieLe: b.expireNotifieLe }, instant)) continue;
      await notifierManager(notifBrouillonNonPaye(b, b.echeanceLe.getTime()));
      await prisma.brouillonCommande.update({ where: { id: b.id }, data: { expireNotifieLe: instant } });
    }
    // Journal d'envoi : on ne garde que 3 jours.
    await prisma.notificationEnvoyee.deleteMany({ where: { envoyeLe: { lt: new Date(instant.getTime() - 3 * 86_400_000) } } });
  } catch {
    journaliser({ niveau: 'avertissement', code: 'INFO_HYPOTHESE', route: ROUTE, piste: 'Vérification des rappels impossible.' });
  }
}
