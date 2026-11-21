// src/domaine/retard.ts
//
// Retrait en retard (décisions du propriétaire, 29/10/2026 puis 21/11/2026) :
//  - dès que l'heure de retrait est passée, la commande est EN RETARD (orange) ;
//  - après 2 h de retard, elle n'est plus « en retard » : elle devient URGENTE
//    (rouge) — notification en tête de l'accueil, à traiter (appeler le client).
//    L'application ne montre ainsi que ce qui demande une action.
// Propriétaire : agent `regles-metier`. Fonction pure : l'instant est donné
// par l'appelant (heure de Bruxelles), jamais lu ici.

/** Retard au bout duquel la commande devient urgente (minutes). Réglage, pas une constante de composant. */
export const DELAI_URGENT_MINUTES = 2 * 60;

/** Sans heure de retrait : urgente à cette heure le jour même (minutes depuis minuit). HYPOTHÈSE À VALIDER, question 94. */
export const HEURE_URGENT_SANS_HEURE = 19 * 60;

export type NiveauRetard = 'retard' | 'urgent';

/** « 14:30 » / « 14h30 » → 870 ; null si illisible ou absent. */
export function minutesDeLHeure(heure: string | null | undefined): number | null {
  const m = /^(\d{1,2})\s*[:h]\s*(\d{2})?$/.exec(String(heure ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** Nombre de jours entre deux dates « AAAA-MM-JJ » (positif si `a` est après `b`). */
export function ecartJours(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000);
}

/**
 * Niveau de retard d'une commande pas encore retirée, à l'instant donné.
 * null : pas en retard. 'retard' : de l'heure de retrait à 2 h après.
 * 'urgent' : 2 h de retard atteintes (compté à travers minuit).
 */
export function niveauRetard(
  retraitLe: string,
  retraitHeure: string | null | undefined,
  maintenant: { date: string; minutes: number },
): NiveauRetard | null {
  const jour = retraitLe.slice(0, 10);
  const ecart = ecartJours(maintenant.date, jour);
  if (ecart < 0) return null;
  const prevue = minutesDeLHeure(retraitHeure);
  if (prevue === null) {
    if (ecart > 0) return 'urgent';
    return maintenant.minutes >= HEURE_URGENT_SANS_HEURE ? 'urgent' : null;
  }
  const retard = ecart * 24 * 60 + maintenant.minutes - prevue;
  if (retard < 0) return null;
  return retard >= DELAI_URGENT_MINUTES ? 'urgent' : 'retard';
}
