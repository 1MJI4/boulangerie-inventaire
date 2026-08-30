// src/lib/dateProduction.ts
//
// Tout le métier tourne autour d'une seule notion : la JOURNÉE DE PRODUCTION.
//
// Le manager saisit ses prévisions en fin d'après-midi pour le lendemain ;
// le pâtissier et le boulanger les lisent la nuit, souvent après minuit.
// Un simple "aujourd'hui + 1 jour" donne alors deux réponses différentes
// selon l'heure d'ouverture de la page — c'est ce qui rendait l'écran du
// fournil vide à partir de 2h du matin.
//
// La règle ici : une journée de production bascule à HEURE_BASCULE (heure de
// Bruxelles). Avant 14h, la journée en cours est aujourd'hui ; à partir de 14h,
// c'est déjà celle de demain. Le manager à 18h et le pâtissier à 4h du matin
// désignent ainsi la même journée.

export const FUSEAU = 'Europe/Brussels';

/** Heure (locale Bruxelles) à laquelle on bascule sur la journée suivante. */
export const HEURE_BASCULE = 14;

/**
 * Heure à partir de laquelle un zéro n'est plus une rupture.
 *
 * L'inventaire de fermeture se fait vers 19h-20h : à ce moment-là, un produit
 * à zéro est simplement vendu, pas manquant. Seul un zéro constaté plus tôt
 * dans la journée signale une vraie rupture de stock.
 */
export const HEURE_FERMETURE = 19;

/** Une date métier, toujours au format YYYY-MM-DD. */
export type DateISO = string;

/**
 * Composants calendaires d'un instant, lus dans le fuseau de Bruxelles.
 * Passe par Intl plutôt que par getFullYear() pour donner le même résultat
 * sur le serveur (UTC) et sur la tablette du magasin.
 */
function partsBruxelles(instant: Date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSEAU,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(instant).map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}` as DateISO,
    // Intl peut renvoyer "24" pour minuit selon l'environnement
    heure: Number(parts.hour) % 24,
  };
}

/** Date du jour à Bruxelles (YYYY-MM-DD), quelle que soit l'heure. */
export function dateDuJour(instant: Date = new Date()): DateISO {
  return partsBruxelles(instant).date;
}

/** Heure locale de Bruxelles (0-23) pour cet instant. */
export function heureDuJour(instant: Date = new Date()): number {
  return partsBruxelles(instant).heure;
}

/**
 * Un zéro ne compte comme rupture que s'il est constaté avant la fermeture,
 * et sur la journée en cours — on ne peut pas dater après coup une rupture
 * saisie le lendemain.
 */
export function estUneRupture(journee: DateISO, instant: Date = new Date()): boolean {
  const { date, heure } = partsBruxelles(instant);
  return journee === date && heure < HEURE_FERMETURE;
}

/** Décale une date ISO d'un nombre de jours, sans dérive de fuseau. */
export function decalerJours(date: DateISO, jours: number): DateISO {
  const [a, m, j] = date.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

/**
 * La journée de production que tout le monde désigne quand il dit
 * "la prochaine fournée".
 *
 *   lundi 11h00 -> lundi      (la journée en cours n'est pas finie)
 *   lundi 18h00 -> mardi      (le manager prépare le lendemain)
 *   mardi 04h00 -> mardi      (le pâtissier travaille sur la journée en cours)
 */
export function journeeProduction(instant: Date = new Date()): DateISO {
  const { date, heure } = partsBruxelles(instant);
  return heure >= HEURE_BASCULE ? decalerJours(date, 1) : date;
}

/** true si l'on est dans la fenêtre où le manager prépare le lendemain. */
export function enFenetreSaisiePrevision(instant: Date = new Date()): boolean {
  return partsBruxelles(instant).heure >= HEURE_BASCULE;
}

/** "mardi 1 septembre" */
export function formatDateCourt(date: DateISO): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-BE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** "mardi 1 septembre 2026" */
export function formatDateLong(date: DateISO): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-BE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "aujourd'hui", "demain", "hier" ou la date en toutes lettres. */
export function formatDateRelative(date: DateISO, reference: DateISO = dateDuJour()): string {
  if (date === reference) return "aujourd'hui";
  if (date === decalerJours(reference, 1)) return 'demain';
  if (date === decalerJours(reference, -1)) return 'hier';
  return formatDateCourt(date);
}

/** Les N dernières occurrences du même jour de semaine (pour comparer). */
export function memesJoursPrecedents(date: DateISO, nombre: number): DateISO[] {
  return Array.from({ length: nombre }, (_, i) => decalerJours(date, -7 * (i + 1)));
}
