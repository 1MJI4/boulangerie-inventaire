// src/lib/cloudprnt.ts — lecture du protocole Star CloudPRNT.

/**
 * L'imprimante confirme un travail par DELETE avec un `code` de style HTTP :
 * « 200 OK » quand le ticket est sorti, « 520 Download failed », « 5xx … »
 * sinon. Réussite = un code 2xx. « OK » seul (anciens firmwares, ou absence
 * de code) vaut aussi réussite.
 * Bug du 18/10/2026 : seul « OK » exact était accepté ; « 200 OK » passait
 * pour un échec, le ticket repartait en file et l'imprimante réimprimait
 * l'exemplaire CLIENT en boucle.
 */
export function confirmationReussie(code: string | null | undefined): boolean {
  const c = String(code ?? 'OK').trim().toUpperCase();
  return c === 'OK' || /^2\d\d\b/.test(c);
}
