// src/components/saisie/dates.ts
//
// Arithmétique de dates ISO (AAAA-MM-JJ) pour le sélecteur de date de retrait.
// Fonctions pures. AUCUNE notion de jour de fermeture ici (invariant 2) :
// savoir si un jour est fermé est une question posée au domaine, via la prop
// `estJourFerme` du sélecteur.

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Vrai si la chaîne est une date calendaire valide au format AAAA-MM-JJ. */
export function estDateIso(texte: string): boolean {
  const m = ISO.exec(texte);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === texte;
}

/** Date ISO + n jours (n peut être négatif). Calcul en UTC : pas de piège d'heure d'été. */
export function ajouterJours(iso: string, n: number): string {
  const m = ISO.exec(iso);
  if (!m) throw new Error(`Date ISO attendue : ${iso}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n));
  return d.toISOString().slice(0, 10);
}

/** Date du jour, dans le fuseau de l'appareil (celui du magasin). */
export function aujourdhuiIso(maintenant: Date = new Date()): string {
  const a = maintenant.getFullYear();
  const m = String(maintenant.getMonth() + 1).padStart(2, '0');
  const j = String(maintenant.getDate()).padStart(2, '0');
  return `${a}-${m}-${j}`;
}

/** Liste de `nombre` dates consécutives à partir de `debut` (inclus). */
export function joursSuccessifs(debut: string, nombre: number): string[] {
  const sortie: string[] = [];
  for (let i = 0; i < nombre; i++) sortie.push(ajouterJours(debut, i));
  return sortie;
}

/** « 2026-10-21 » → objet Date à midi UTC, pour Intl (jamais pour calculer). */
function pourAffichage(iso: string): Date {
  const m = ISO.exec(iso);
  if (!m) throw new Error(`Date ISO attendue : ${iso}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
}

const FMT_JOUR = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', timeZone: 'UTC' });
const FMT_NUMERO = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', timeZone: 'UTC' });
const FMT_MOIS_COURT = new Intl.DateTimeFormat('fr-BE', { month: 'short', timeZone: 'UTC' });
const FMT_MOIS = new Intl.DateTimeFormat('fr-BE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const FMT_LONG = new Intl.DateTimeFormat('fr-BE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Morceaux d'affichage d'une case du sélecteur : « mer. » / « 22 » / « oct. ». */
export function morceauxDate(iso: string): { jour: string; numero: string; mois: string } {
  const d = pourAffichage(iso);
  return { jour: FMT_JOUR.format(d), numero: FMT_NUMERO.format(d), mois: FMT_MOIS_COURT.format(d) };
}

/** « octobre 2026 » — en-tête de groupe. */
export function libelleMois(iso: string): string {
  return FMT_MOIS.format(pourAffichage(iso));
}

/** « mercredi 22 octobre 2026 » — pour l'accessibilité et le rappel du choix. */
export function libelleLong(iso: string): string {
  return FMT_LONG.format(pourAffichage(iso));
}
