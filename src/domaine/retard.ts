// src/domaine/retard.ts
//
// Retrait en retard (décision du propriétaire, 29/10/2026) :
//  - dès que l'heure de retrait est passée, la commande est EN RETARD (orange) ;
//  - à 19h, une commande prévue AVANT 19h et toujours pas retirée passe en
//    ROUGE (le magasin ferme à 20h : il reste une heure pour l'appeler) ;
//  - une commande d'un jour précédent, pas retirée, est en rouge.
// Propriétaire : agent `regles-metier`. Fonction pure : l'instant est donné
// par l'appelant (heure de Bruxelles), jamais lu ici.

/** Heure à partir de laquelle un retard du jour devient rouge (minutes depuis minuit). */
export const HEURE_RETARD_ROUGE = 19 * 60;

export type NiveauRetard = 'retard' | 'retard-rouge';

/** « 14:30 » / « 14h30 » → 870 ; null si illisible ou absent. */
export function minutesDeLHeure(heure: string | null | undefined): number | null {
  const m = /^(\d{1,2})\s*[:h]\s*(\d{2})?$/.exec(String(heure ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/**
 * Niveau de retard d'une commande pas encore retirée, à l'instant donné.
 * null : pas en retard. Sans heure de retrait, la commande est comptée « avant
 * 19h » : en rouge à 19h le jour même (HYPOTHÈSE À VALIDER, question 94).
 */
export function niveauRetard(
  retraitLe: string,
  retraitHeure: string | null | undefined,
  maintenant: { date: string; minutes: number },
): NiveauRetard | null {
  const jour = retraitLe.slice(0, 10);
  if (jour < maintenant.date) return 'retard-rouge';
  if (jour > maintenant.date) return null;
  const prevue = minutesDeLHeure(retraitHeure);
  if (prevue === null) return maintenant.minutes >= HEURE_RETARD_ROUGE ? 'retard-rouge' : null;
  if (maintenant.minutes < prevue) return null;
  return prevue < HEURE_RETARD_ROUGE && maintenant.minutes >= HEURE_RETARD_ROUGE ? 'retard-rouge' : 'retard';
}
