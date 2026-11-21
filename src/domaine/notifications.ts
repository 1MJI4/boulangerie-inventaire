// src/domaine/notifications.ts
//
// Notifications (demande du propriétaire, 21/11/2026). Deux publics :
//  - le MANAGER, sur sa tablette et son téléphone (notification système, même
//    application fermée) : commande prise, commande modifiée, inventaire
//    terminé, retrait dans 1 h, retrait à l'heure, retrait toujours pas remis
//    2 h après ;
//  - les VENDEURS, sur la tablette du comptoir : alarme sonore forte quand une
//    commande approche de son échéance (1 h avant) et quand elle est en retard
//    (à l'heure, puis 2 h après) — mêmes rappels, voir `rappelsDus`.
//
// Fonctions pures : l'instant est donné par l'appelant (heure de Bruxelles).
// Aucun nom de client dans un texte : une notification transite par le service
// de notification du navigateur (RGPD) ; le numéro de commande suffit.
// Propriétaire : agent `regles-metier` (quand), `gestion-erreurs` (comment).

import { ecartJours, minutesDeLHeure } from './retard.ts';

export type TypeNotification =
  | 'commande_creee'
  | 'commande_modifiee'
  | 'inventaire_termine'
  | 'retrait_dans_1h'
  | 'retrait_maintenant'
  | 'retrait_retard_2h';

export type Notification = {
  type: TypeNotification;
  /** Identifiant d'envoi : une même clé n'est jamais envoyée deux fois (reprise après redémarrage). */
  cle: string;
  titre: string;
  corps: string;
  /** Page ouverte au toucher. */
  url: string;
  /** Rouge, vibration longue, reste affichée jusqu'au toucher. */
  urgente: boolean;
};

/** Avance du rappel « le retrait approche » (minutes). Réglage, pas une constante d'écran. */
export const AVANCE_RAPPEL_MINUTES = 60;
/** Retard au bout duquel le rappel final part (minutes) — le même que l'état « urgent ». */
export const RETARD_RAPPEL_FINAL_MINUTES = 120;
/** Un rappel manqué (serveur arrêté, tablette fermée) n'est plus envoyé passé ce délai : il serait périmé. */
const PEREMPTION_MINUTES = 60;

type CommandeRappel = {
  id: number;
  numero: string;
  /** « AAAA-MM-JJ » (ou ISO complet). */
  retraitLe: string;
  retraitHeure: string | null | undefined;
};

/** « 14:30 » → « 14h30 ». */
function heureCourte(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

/** « 2026-11-21 » → « 21/11 ». */
function jourCourt(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/**
 * Minutes écoulées depuis l'heure de retrait (négatif : pas encore l'heure),
 * à travers minuit. null : pas d'heure de retrait lisible.
 */
export function minutesDepuisRetrait(
  retraitLe: string,
  retraitHeure: string | null | undefined,
  maintenant: { date: string; minutes: number },
): number | null {
  const prevue = minutesDeLHeure(retraitHeure);
  if (prevue === null) return null;
  return ecartJours(maintenant.date, retraitLe.slice(0, 10)) * 24 * 60 + maintenant.minutes - prevue;
}

function rappel(
  type: Extract<TypeNotification, 'retrait_dans_1h' | 'retrait_maintenant' | 'retrait_retard_2h'>,
  c: CommandeRappel,
  heure: number,
  corps: string,
  titre: string,
  urgente: boolean,
): Notification {
  return {
    type,
    cle: `${type}:${c.id}:${c.retraitLe.slice(0, 10)}:${heure}`,
    titre,
    corps,
    url: '/commandes',
    urgente,
  };
}

/**
 * Rappels de retrait à envoyer maintenant pour une commande pas encore remise :
 *  - 1 h avant l'heure de retrait      → « retrait dans 1 h »
 *  - à l'heure de retrait              → « retrait maintenant » (elle passe en retard)
 *  - 2 h après, toujours pas remise    → URGENT
 * Sans heure de retrait : aucun rappel. Chaque rappel n'est dû que dans une
 * fenêtre courte (périmé sinon) ; la clé garantit qu'il ne part qu'une fois.
 */
export function rappelsDus(commande: CommandeRappel, maintenant: { date: string; minutes: number }): Notification[] {
  const r = minutesDepuisRetrait(commande.retraitLe, commande.retraitHeure, maintenant);
  const prevue = minutesDeLHeure(commande.retraitHeure);
  if (r === null || prevue === null) return [];
  const h = heureCourte(prevue);
  const quand = `${jourCourt(commande.retraitLe.slice(0, 10))} à ${h}`;
  const sortie: Notification[] = [];
  if (r >= -AVANCE_RAPPEL_MINUTES && r < -AVANCE_RAPPEL_MINUTES + PEREMPTION_MINUTES) {
    sortie.push(
      rappel('retrait_dans_1h', commande, prevue, `Commande n° ${commande.numero} : retrait ${quand}.`, 'Retrait dans 1 h', false),
    );
  }
  if (r >= 0 && r < PEREMPTION_MINUTES) {
    sortie.push(
      rappel('retrait_maintenant', commande, prevue, `Commande n° ${commande.numero} : c’est l’heure du retrait (${h}).`, 'Retrait maintenant', false),
    );
  }
  if (r >= RETARD_RAPPEL_FINAL_MINUTES && r < RETARD_RAPPEL_FINAL_MINUTES + PEREMPTION_MINUTES) {
    sortie.push(
      rappel(
        'retrait_retard_2h',
        commande,
        prevue,
        `Commande n° ${commande.numero} prévue à ${h} : toujours pas remise, 2 h de retard. Appelez le client.`,
        'URGENT — commande en retard',
        true,
      ),
    );
  }
  return sortie;
}

/** Rappels qui font sonner la tablette du comptoir : l'échéance qui approche et le retard. */
export function sonneEnSalle(n: Pick<Notification, 'type'>): boolean {
  return n.type === 'retrait_dans_1h' || n.type === 'retrait_maintenant' || n.type === 'retrait_retard_2h';
}

/* ------------------------------------------------- Événements du manager */

export function notifCommandeCreee(c: CommandeRappel): Notification {
  const quand = c.retraitHeure
    ? `retrait ${jourCourt(c.retraitLe.slice(0, 10))} à ${heureCourte(minutesDeLHeure(c.retraitHeure) ?? 0)}`
    : `retrait le ${jourCourt(c.retraitLe.slice(0, 10))}`;
  return {
    type: 'commande_creee',
    cle: `creation:${c.id}`,
    titre: 'Nouvelle commande',
    corps: `Commande n° ${c.numero} prise : ${quand}.`,
    url: '/commandes',
    urgente: false,
  };
}

/** `evenementId` : identifiant de l'événement d'historique, pour qu'une 2e modification notifie aussi. */
export function notifCommandeModifiee(c: CommandeRappel, evenementId: number | string): Notification {
  return {
    type: 'commande_modifiee',
    cle: `modification:${c.id}:${evenementId}`,
    titre: 'Commande modifiée',
    corps: `La commande n° ${c.numero} a été modifiée (retrait ${jourCourt(c.retraitLe.slice(0, 10))}${
      c.retraitHeure ? ` à ${heureCourte(minutesDeLHeure(c.retraitHeure) ?? 0)}` : ''
    }).`,
    url: '/commandes',
    urgente: false,
  };
}

export function notifInventaireTermine(date: string): Notification {
  return {
    type: 'inventaire_termine',
    cle: `inventaire:${date}`,
    titre: 'Inventaire terminé',
    corps: `Le comptage du ${jourCourt(date)} est fini.`,
    url: '/inventaire',
    urgente: false,
  };
}

/** Date « AAAA-MM-JJ » valide (aucun calcul : format seulement). */
export function dateIsoValide(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valeur) && !Number.isNaN(Date.parse(`${valeur}T12:00:00Z`));
}
