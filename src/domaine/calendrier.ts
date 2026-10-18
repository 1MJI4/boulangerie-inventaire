// src/domaine/calendrier.ts
//
// LOI 3 — jours de fermeture et délais en JOURS OUVRÉS.
// Propriétaire : agent `regles-metier`.
//
// La liste des fermetures est une DONNÉE (table `JourFerme`), passée en
// paramètre à chaque fonction. Ce fichier ne contient aucun jour de semaine,
// aucun numéro de jour, aucun nom de jour : seulement le mécanisme.
//
// Même priorité que la fonction SQL `fermeture_du_jour` (migration
// 20261015120000_jours_fermes), pour que le domaine (écran, hors ligne) et la
// base (persistance) rendent TOUJOURS le même verdict :
//   1. une `ouverture_exceptionnelle` active couvrant la date → ouvert ;
//   2. sinon une période de `conges` → fermé (ERR_PERIODE_CONGES) ;
//   3. sinon toute autre fermeture active (hebdomadaire, férié, exceptionnel),
//      la plus ancienne (id le plus petit, puis ordre de la liste).
//
// Dates civiles « AAAA-MM-JJ » calculées en UTC : aucun changement d'heure,
// aucun fuseau ne peut décaler un jour.

import type { Echec, Resultat } from './resultat.ts';
import { succes } from './resultat.ts';
import { signaler } from './messages.ts';
import { HORIZON_RECHERCHE_JOURS } from './constantes.ts';
import type { DateISO } from './types.ts';

export type NatureFermeture =
  | 'hebdomadaire'
  | 'ferie'
  | 'exceptionnel'
  | 'conges'
  | 'ouverture_exceptionnelle';

/**
 * Une ligne de la table `JourFerme`, dates converties en « AAAA-MM-JJ ».
 *  - hebdomadaire : `jourSemaineIso` 1 (lundi) … 7 (dimanche), période
 *    `dateDebut`/`dateFin` facultative ;
 *  - autres : `dateDebut` obligatoire, `dateFin` incluse (absente = un seul jour).
 */
export type JourFerme = {
  id?: number;
  nature: NatureFermeture;
  jourSemaineIso?: number | null;
  dateDebut?: DateISO | null;
  dateFin?: DateISO | null;
  libelle: string;
  /** Absent = actif. Une ligne n'est jamais supprimée, seulement désactivée. */
  actif?: boolean;
};

// ---------------------------------------------------------------------------
// Dates civiles
// ---------------------------------------------------------------------------

const MS_PAR_JOUR = 86_400_000;

/** Vrai si `date` est une date civile réelle (« 2026-02-29 » est refusée, 2028-02-29 acceptée). */
export function estDateISO(date: unknown): date is DateISO {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [a, m, j] = date.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j;
}

function versUtc(date: DateISO): number {
  const [a, m, j] = date.split('-').map(Number);
  return Date.UTC(a, m - 1, j);
}

function depuisUtc(ms: number): DateISO {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Décale une date civile d'un nombre de jours calendaires. */
export function decalerJours(date: DateISO, jours: number): DateISO {
  return depuisUtc(versUtc(date) + jours * MS_PAR_JOUR);
}

/** Jour de semaine ISO : 1 = lundi … 7 = dimanche. */
export function jourSemaineIso(date: DateISO): number {
  const j = new Date(versUtc(date)).getUTCDay();
  return j === 0 ? 7 : j;
}

/** « mercredi 21 octobre » — pour les messages. Le nom du jour vient d'Intl, pas du code. */
export function formaterDate(date: DateISO): string {
  return new Intl.DateTimeFormat('fr-BE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(versUtc(date)));
}

/** « 25 décembre » — pour nommer un jour férié ou une fermeture ponctuelle. */
function formaterJourMois(date: DateISO): string {
  return new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(versUtc(date)),
  );
}

// ---------------------------------------------------------------------------
// Fermetures
// ---------------------------------------------------------------------------

function couvre(f: JourFerme, date: DateISO): boolean {
  if (f.nature === 'hebdomadaire') {
    if (typeof f.jourSemaineIso !== 'number' || f.jourSemaineIso !== jourSemaineIso(date)) return false;
    if (f.dateDebut && date < f.dateDebut) return false;
    if (f.dateFin && date > f.dateFin) return false;
    return true;
  }
  // Ligne sans date de début : forme refusée par la base (CHECK JourFerme_forme),
  // ignorée ici faute de pouvoir dire ce qu'elle ferme.
  if (!f.dateDebut) return false;
  return f.dateDebut <= date && date <= (f.dateFin ?? f.dateDebut);
}

/**
 * La fermeture qui s'applique à `date`, ou `null` si le magasin est ouvert.
 * Miroir exact de la fonction SQL `fermeture_du_jour`.
 */
export function fermetureDuJour(date: DateISO, joursFermes: readonly JourFerme[]): JourFerme | null {
  const actives = joursFermes.filter((f) => f.actif !== false && couvre(f, date));
  if (actives.some((f) => f.nature === 'ouverture_exceptionnelle')) return null;
  const fermetures = actives
    .map((f, rang) => ({ f, rang }))
    .filter(({ f }) => f.nature !== 'ouverture_exceptionnelle')
    .sort((x, y) => {
      const conges = Number(y.f.nature === 'conges') - Number(x.f.nature === 'conges');
      if (conges !== 0) return conges;
      const ids = (x.f.id ?? Number.MAX_SAFE_INTEGER) - (y.f.id ?? Number.MAX_SAFE_INTEGER);
      return ids !== 0 ? ids : x.rang - y.rang;
    });
  return fermetures[0]?.f ?? null;
}

/** Règle : le magasin est-il fermé ce jour-là ? (LOI 3 — la liste est une donnée.) */
export function estJourFerme(date: DateISO, joursFermes: readonly JourFerme[]): boolean {
  return fermetureDuJour(date, joursFermes) !== null;
}

/** Premier jour ouvert à partir de `date` INCLUSE, ou `null` si aucun dans l'horizon. */
export function prochainJourOuvert(date: DateISO, joursFermes: readonly JourFerme[]): DateISO | null {
  let d = date;
  for (let i = 0; i <= HORIZON_RECHERCHE_JOURS; i++) {
    if (!estJourFerme(d, joursFermes)) return d;
    d = decalerJours(d, 1);
  }
  return null;
}

/** Le refus adapté à une fermeture : congés → ERR_PERIODE_CONGES, sinon ERR_JOUR_FERME. */
function refusFermeture(
  date: DateISO,
  f: JourFerme,
  joursFermes: readonly JourFerme[],
  champ: string,
): Echec {
  const suivant = prochainJourOuvert(decalerJours(date, 1), joursFermes);
  const options = suivant ? { champ, valeurProposee: suivant } : { champ };
  if (f.nature === 'conges') {
    return signaler('ERR_PERIODE_CONGES', { periode: f.libelle }, options);
  }
  const jour = f.nature === 'hebdomadaire' ? f.libelle : formaterJourMois(date);
  return signaler('ERR_JOUR_FERME', { jour }, options);
}

/**
 * Règle R1 / R1b / R1c : une date de retrait ne peut pas tomber un jour de fermeture.
 * Niveau : BLOQUANT, à la saisie, avec le prochain jour ouvert en `valeurProposee`.
 *
 * `aujourdhui` = date de PRISE de la commande. Côté serveur (rejeu à la
 * synchronisation), c'est la date de saisie sur la tablette, pas la date
 * d'arrivée : une commande saisie hors ligne lundi pour lundi reste valable
 * si elle arrive deux jours plus tard ; une commande posée un jour fermé est refusée à
 * l'arrivée quel que soit le jour où elle arrive.
 *
 * N'interdit pas : une date lointaine, une date le jour même (le délai est
 * contrôlé par `validerDelai`), un jour normalement fermé rouvert par une
 * `ouverture_exceptionnelle`.
 */
export function validerDateRetrait(
  date: DateISO,
  joursFermes: readonly JourFerme[],
  aujourdhui: DateISO,
  champ = 'dateRetrait',
): Resultat<DateISO> {
  if (!estDateISO(date) || !estDateISO(aujourdhui)) {
    return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'date de retrait' }, { champ });
  }
  if (date < aujourdhui) {
    // HYPOTHÈSE À VALIDER : une date de retrait passée est refusée (le plus sûr ;
    // l'ancien code se contentait d'avertir).
    const suivant = prochainJourOuvert(aujourdhui, joursFermes);
    return signaler(
      'ERR_DATE_PASSEE',
      suivant ? { premiereDate: formaterDate(suivant) } : {},
      suivant ? { champ, valeurProposee: suivant } : { champ },
    );
  }
  const f = fermetureDuJour(date, joursFermes);
  if (f) return refusFermeture(date, f, joursFermes, champ);
  return succes(date);
}

/**
 * Le n-ième jour OUVERT strictement après `date` (n = 0 → `date` elle-même).
 * Les jours fermés ne comptent pas. `null` si la table ferme tout l'horizon.
 */
export function ajouterJoursOuvres(
  date: DateISO,
  n: number,
  joursFermes: readonly JourFerme[],
): DateISO | null {
  if (!Number.isInteger(n) || n < 0) throw new RangeError('calendrier.ts : n doit être un entier ≥ 0.');
  let d = date;
  let restants = n;
  for (let i = 0; restants > 0; i++) {
    if (i > HORIZON_RECHERCHE_JOURS + n) return null;
    d = decalerJours(d, 1);
    if (!estJourFerme(d, joursFermes)) restants--;
  }
  return d;
}

/**
 * Règle R2d — cascade de production : on produit la veille OUVERTE du retrait.
 * Retrait le lendemain d'un jour fermé → production l'avant-veille (ou avant).
 * `null` si aucun jour ouvert dans l'horizon.
 * Ne tient pas compte de la date de prise : voir `dateProduction`.
 */
export function veilleOuvree(date: DateISO, joursFermes: readonly JourFerme[]): DateISO | null {
  let d = date;
  for (let i = 0; i < HORIZON_RECHERCHE_JOURS; i++) {
    d = decalerJours(d, -1);
    if (!estJourFerme(d, joursFermes)) return d;
  }
  return null;
}

/**
 * Règle R2d (suite, décision du propriétaire du 18/10/2026 : retrait le jour
 * même autorisé) : jour de production d'une commande = veille ouverte du
 * retrait, mais JAMAIS avant le jour de la prise — une commande prise le jour
 * même (ou la veille d'un retrait qui suit un jour fermé) se produit le jour de
 * la prise ; sinon elle tomberait sur une fiche de production déjà passée.
 * `null` si aucun jour ouvert dans l'horizon.
 */
export function dateProduction(
  dateRetrait: DateISO,
  datePrise: DateISO,
  joursFermes: readonly JourFerme[],
): DateISO | null {
  const veille = veilleOuvree(dateRetrait, joursFermes);
  if (veille === null) return null;
  return veille < datePrise && datePrise <= dateRetrait ? datePrise : veille;
}

/**
 * Règle R2 : le retrait doit laisser au moins `delaiJoursOuvres` jours ouvrés
 * après la prise de commande (jours fermés exclus, jamais en heures calendaires).
 * Niveau : BLOQUANT, avec la première date possible en `valeurProposee`.
 *
 * Le délai est une DONNÉE fournie par l'appelant : 0 pour tous les régimes
 * (retrait le jour même autorisé, décision du propriétaire du 18/10/2026) ;
 * gâteau à étages = réglage du gérant (`reglement:delai_gateau_etages_jours`).
 * Avec un délai 0, la production d'un retrait du jour même se fait le jour
 * même : voir `dateProduction` (cascade R2d).
 */
export function validerDelai(
  dateRetrait: DateISO,
  aujourdhui: DateISO,
  delaiJoursOuvres: number,
  joursFermes: readonly JourFerme[],
  champ = 'dateRetrait',
): Resultat<DateISO> {
  if (!estDateISO(dateRetrait) || !estDateISO(aujourdhui)) {
    return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'date de retrait' }, { champ });
  }
  const premiere = ajouterJoursOuvres(aujourdhui, delaiJoursOuvres, joursFermes);
  if (premiere === null) {
    return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'date de retrait' }, { champ });
  }
  // Le premier jour possible doit lui-même être ouvert (délai 0 un jour fermé).
  const premiereOuverte = prochainJourOuvert(premiere, joursFermes) ?? premiere;
  if (dateRetrait < premiereOuverte) {
    return signaler(
      'ERR_DELAI_TROP_COURT',
      { delaiJoursOuvres, premiereDate: formaterDate(premiereOuverte) },
      { champ, valeurProposee: premiereOuverte },
    );
  }
  return succes(dateRetrait);
}
