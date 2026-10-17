// src/domaine/reglement.ts
//
// LOI 11 — règlement intérieur (docs/REGLEMENT-INTERIEUR.md, points 9, 51, 52, 53).
// Propriétaire : agent `regles-metier`. Orchestré par `commande.ts`.
//
// Toutes les valeurs (heures, week-end, fériés ouverts, heure de fermeture)
// sont des DONNÉES passées en paramètre : défauts dans constantes.ts
// (REGLEMENT_COMMANDE, HEURE_FERMETURE_HYPOTHESE). Aucun jour, aucune heure
// n'est écrit dans une fonction.
//
// L'acompte minimum (R52) est dans coherence.ts (`validerAcompte`) ;
// l'heure de début d'inventaire (R57) dans inventaire.ts (`verifierHeureInventaire`).

import type { Resultat, Signalement } from './resultat.ts';
import { succes } from './resultat.ts';
import { signaler } from './messages.ts';
import {
  decalerJours,
  estDateISO,
  estJourFerie,
  jourSemaineIso,
  prochainJourOuvert,
  validerDateRetrait,
} from './calendrier.ts';
import type { JourFerme } from './calendrier.ts';
import { JOURS_ISO_CLES } from './constantes.ts';
import type {
  HorairesRetraitAncienneForme,
  HorairesRetraitPatisserie,
  JourIsoCle,
  ReglementCommande,
} from './constantes.ts';
import type { DateISO, ProduitRegle } from './types.ts';

// ---------------------------------------------------------------------------
// Heures « HH:MM »
// ---------------------------------------------------------------------------

const MINUTES_PAR_HEURE = 60;
const HEURES_PAR_JOUR = 24;

/**
 * Lit une heure locale « HH:MM » (ou « H:MM », « 9h00 ») en minutes depuis
 * minuit. `null` si illisible ou hors 00:00–23:59 (« 24:00 » est refusé).
 */
export function lireHeure(texte: unknown): number | null {
  if (typeof texte !== 'string') return null;
  const m = /^(\d{1,2})[:hH](\d{2})$/.exec(texte.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h >= HEURES_PAR_JOUR || min >= MINUTES_PAR_HEURE) return null;
  return h * MINUTES_PAR_HEURE + min;
}

/** « 9h00 » — format des messages. */
export function formaterHeure(minutes: number): string {
  const min = minutes % MINUTES_PAR_HEURE;
  return `${(minutes - min) / MINUTES_PAR_HEURE}h${String(min).padStart(2, '0')}`;
}

/** « 09:00 » — format d'un champ `<input type="time">` (valeurProposee). */
export function heureChamp(minutes: number): string {
  const min = minutes % MINUTES_PAR_HEURE;
  return `${String((minutes - min) / MINUTES_PAR_HEURE).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// R53 — commande pour le lendemain
// ---------------------------------------------------------------------------

/**
 * Règle R53 (LOI 11, décision du propriétaire du 15/10/2026) : une commande à
 * retirer le premier jour OUVERT qui suit la prise de commande (« le
 * lendemain ») est ACCEPTÉE ; l'employé est simplement invité à prévenir
 * l'atelier.
 * Niveau : INFORMATION (INFO_COMMANDE_LENDEMAIN) — aucune friction, aucun code
 * gérant, aucun accord à tracer : le propriétaire accepte ces commandes.
 * Le lendemain se compte en jours OUVERTS : prise lundi, mardi fermé → le
 * retrait du mercredi est « le lendemain ». Le message ne dit « pour demain »
 * que si c'est le lendemain CALENDAIRE ; sinon il nomme le jour réel
 * (« Commande pour mercredi, le prochain jour d'ouverture… »), tiré de la date.
 *
 * N'interdit RIEN. Le jour même n'est pas « le lendemain » (aucune information
 * ici) : il est refusé par le délai minimum (`validerDelai`, ERR_DELAI_TROP_COURT),
 * contrôlé avant par `controlerCommande`. Un gâteau à étages pour le lendemain
 * reste refusé par son délai (DELAIS_HYPOTHESE).
 * HYPOTHÈSE À VALIDER : `aujourdhui` = jour de la saisie (une modification faite
 * la veille du retrait affiche donc l'information).
 */
export function validerLendemain(
  dateRetrait: DateISO,
  aujourdhui: DateISO,
  joursFermes: readonly JourFerme[],
  champ = 'dateRetrait',
): Resultat<DateISO> {
  const base = validerDateRetrait(dateRetrait, joursFermes, aujourdhui, champ);
  if (!base.ok) return base;
  const lendemain = prochainJourOuvert(decalerJours(aujourdhui, 1), joursFermes);
  if (lendemain === null || dateRetrait !== lendemain) return succes(dateRetrait);
  return succes(
    dateRetrait,
    signaler(
      'INFO_COMMANDE_LENDEMAIN',
      // « demain » seulement si c'est vraiment le lendemain calendaire ; sinon le
      // jour réel (prise lundi, mardi fermé → « pour mercredi »).
      { jour: nomJour(dateRetrait), demain: dateRetrait === decalerJours(aujourdhui, 1) },
      { champ },
    ),
  );
}

// ---------------------------------------------------------------------------
// R54 — heure de retrait d'une commande de pâtisserie
// ---------------------------------------------------------------------------

export type ReperePatisserie = Pick<ProduitRegle, 'famille'>;

/**
 * Un produit est-il soumis aux horaires de retrait pâtisserie ? Lu dans la
 * DONNÉE `famille` du catalogue (tirée du rayon), comparée à la liste
 * `familles` (donnée, REGLEMENT_COMMANDE) — jamais dans le nom ni le régime.
 * HYPOTHÈSE À VALIDER : famille vide/inconnue, ou ligne libre (`null`) →
 * soumise aux horaires (on ne sait pas ce qu'elle contient : le plus sûr).
 */
export function estPatisserie(produit: ReperePatisserie | null, familles: readonly string[]): boolean {
  if (produit === null) return true;
  if (typeof produit.famille !== 'string' || produit.famille === '') return true;
  return familles.includes(produit.famille);
}

/**
 * Compatibilité : convertit l'ANCIENNE forme des horaires (semaine / weekEnd /
 * joursWeekEndIso / feriesOuverts) en la forme jour par jour. Les jours listés
 * en week-end prennent `weekEnd`, les autres `semaine` ; chaque férié ouvert
 * connu devient une date exceptionnelle à l'heure du week-end (comportement
 * d'avant inchangé).
 */
export function convertirHorairesAncienneForme(ancienne: HorairesRetraitAncienneForme): HorairesRetraitPatisserie {
  const parJour = {} as Record<JourIsoCle, string>;
  for (const cle of JOURS_ISO_CLES) {
    parJour[cle] = ancienne.joursWeekEndIso.includes(Number(cle)) ? ancienne.weekEnd : ancienne.semaine;
  }
  return {
    familles: [...ancienne.familles],
    parJour,
    exceptions: (ancienne.feriesOuverts ?? []).map((date) => ({ date, heure: ancienne.weekEnd })),
  };
}

/** Ce que les fonctions d'horaires acceptent : le règlement entier, ou ses horaires (nouvelle ou ancienne forme). */
export type SourceHoraires =
  | Pick<ReglementCommande, 'horairesRetraitPatisserie'>
  | HorairesRetraitPatisserie
  | HorairesRetraitAncienneForme;

function horairesDe(source: SourceHoraires): HorairesRetraitPatisserie {
  const h = 'horairesRetraitPatisserie' in source ? source.horairesRetraitPatisserie : source;
  if ('parJour' in h) return h;
  return convertirHorairesAncienneForme(h);
}

/**
 * Première heure de retrait d'une commande de pâtisserie à `date`, « HH:MM ».
 * Ordre (réglages du gérant, décision du 15/10/2026) :
 *   1. date exceptionnelle (`exceptions`) si présente — prioritaire sur tout ;
 *   2. jour férié OUVERT (ligne `ferie` de JourFerme rouverte) → horaire du
 *      DIMANCHE. HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°52) : comportement
 *      d'avant (un férié ouvert suit le week-end), le plus prudent ;
 *   3. sinon l'horaire du jour de la semaine (`parJour`).
 * Si une date figure plusieurs fois dans `exceptions`, la plus TARDIVE
 * s'applique (le plus sûr : on ne promet pas une pâtisserie trop tôt).
 * Horaires illisibles (réglage cassé) ou date illisible : RangeError (bug).
 */
export function heureMinRetrait(
  date: DateISO,
  reglement: SourceHoraires,
  joursFermes: readonly JourFerme[] = [],
): string {
  if (!estDateISO(date)) throw new RangeError('reglement.ts : date de retrait illisible.');
  const horaires = horairesDe(reglement);
  const lire = (texte: string): number => {
    const m = lireHeure(texte);
    if (m === null) throw new RangeError('reglement.ts : horaires de retrait pâtisserie illisibles.');
    return m;
  };
  const exceptions = horaires.exceptions.filter((e) => e.date === date).map((e) => lire(e.heure));
  if (exceptions.length > 0) return heureChamp(Math.max(...exceptions));
  const cleDimanche = JOURS_ISO_CLES[JOURS_ISO_CLES.length - 1] as JourIsoCle;
  const cle = estJourFerie(date, joursFermes) ? cleDimanche : (String(jourSemaineIso(date)) as JourIsoCle);
  return heureChamp(lire(horaires.parJour[cle]));
}

/** « samedi » — nom du jour d'une date, pour les messages (Intl, jamais écrit dans le code). */
export function nomJour(date: DateISO): string {
  return new Intl.DateTimeFormat('fr-BE', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

/**
 * « lundi » … « dimanche » pour un jour ISO 1 … 7 (écran des réglages : libellés
 * de `parJour`). Évite d'écrire les noms de jours hors du domaine (invariant 2).
 */
export function nomJourIso(jourIso: number | JourIsoCle): string {
  const n = Number(jourIso);
  if (!Number.isInteger(n) || n < 1 || n > JOURS_ISO_CLES.length) throw new RangeError('reglement.ts : jour ISO hors 1 à 7.');
  // Le 2 janvier 2023 (UTC) est un lundi : point de départ fixe, sans calcul de jour.
  return nomJour(decalerJours('2023-01-02', n - 1));
}

/**
 * Règle R54 : une commande contenant de la pâtisserie se retire à partir de
 * `heureMinRetrait(date)` (horaires réglables jour par jour et par date
 * exceptionnelle).
 * Niveau : BLOQUANT, `valeurProposee` = première heure possible (« HH:MM »).
 * Heure illisible → ERR_SAISIE_INVALIDE.
 * HYPOTHÈSE À VALIDER : commande avec pâtisserie SANS heure de retrait →
 * ERR_CHAMP_OBLIGATOIRE (sinon la règle se contourne en laissant le champ vide).
 * HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°50) : ne vaut que pour la pâtisserie.
 * N'interdit pas : toute heure ≥ l'heure minimale ; aucune heure maximale n'est
 * contrôlée (heure de fermeture : non demandée par le règlement).
 * Les horaires mal configurés (illisibles) sont un bug : RangeError.
 * `horaires` : nouvelle forme, ancienne forme (convertie) ou règlement entier.
 */
export function validerHeureRetrait(
  dateRetrait: DateISO,
  heureRetrait: string | null | undefined,
  lignes: readonly { estPatisserie: boolean }[],
  horaires: SourceHoraires,
  joursFermes: readonly JourFerme[] = [],
  champ = 'heureRetrait',
): Resultat<string | null> {
  const patisserie = lignes.some((l) => l.estPatisserie);
  const vide = heureRetrait === null || heureRetrait === undefined || String(heureRetrait).trim() === '';
  if (vide) {
    if (!patisserie) return succes(null);
    return signaler('ERR_CHAMP_OBLIGATOIRE', { champLibelle: 'heure de retrait' }, { champ });
  }
  const minutes = lireHeure(heureRetrait);
  if (minutes === null) return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'heure de retrait' }, { champ });
  const heure = heureChamp(minutes);
  if (!patisserie) return succes(heure);
  if (!estDateISO(dateRetrait)) {
    return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'date de retrait' }, { champ: 'dateRetrait' });
  }

  const minimum = heureMinRetrait(dateRetrait, horaires, joursFermes);
  const min = lireHeure(minimum) as number;
  if (minutes >= min) return succes(heure);
  return signaler(
    'ERR_HEURE_RETRAIT_TROP_TOT',
    { heureMin: formaterHeure(min), jour: nomJour(dateRetrait) },
    { champ, valeurProposee: minimum },
  );
}

// ---------------------------------------------------------------------------
// R55 — commande inhabituelle
// ---------------------------------------------------------------------------

/**
 * Règle R55 : une commande inhabituelle (case « demande inhabituelle » cochée,
 * ou ligne libre hors catalogue) se valide après l'accord du responsable.
 * Niveau : AVERTISSEMENT (règlement : « demandez d'abord » — la vente n'est pas
 * refusée), sortie « Appeler le responsable ou proposer WhatsApp ».
 * Remplace AVERT_GATEAU_COMPLEXE (un gâteau complexe EST une commande
 * inhabituelle) : un seul signalement, même si les deux causes sont présentes.
 */
export function controlerCommandeInhabituelle(entree: {
  demandeInhabituelle?: boolean | null;
  contientLigneLibre?: boolean;
}): Signalement[] {
  if (!entree.demandeInhabituelle && !entree.contientLigneLibre) return [];
  return [signaler('AVERT_COMMANDE_INHABITUELLE', {}, { champ: 'demandeInhabituelle' })];
}

// ---------------------------------------------------------------------------
// R58 — décompte à la remise
// ---------------------------------------------------------------------------

export type ArticleRemise = { id: string; remis: boolean };

/**
 * Règle R58 (point 53) : une commande n'est remise que lorsque TOUS ses
 * articles ont été cochés comme remis, devant le client.
 * Niveau : BLOQUANT (un oubli = un client qui revient, ou un produit perdu),
 * sortie « Cocher les articles remis », `valeurProposee` = ids restants.
 * Liste vide ou absente : aucun décompte fait → refusé (le plus sûr).
 * N'interdit pas : cocher dans n'importe quel ordre.
 */
export function validerRemise(
  articles: readonly ArticleRemise[] | null | undefined,
  champ = 'articles',
): Resultat<readonly ArticleRemise[]> {
  if (!articles || articles.length === 0) {
    // HYPOTHÈSE À VALIDER : sans liste, on ne sait pas combien restent ; 1 au minimum.
    return signaler('ERR_DECOMPTE_INCOMPLET', { restants: 1 }, { champ, valeurProposee: [] });
  }
  const restants = articles.filter((a) => a.remis !== true).map((a) => a.id);
  if (restants.length === 0) return succes(articles);
  return signaler('ERR_DECOMPTE_INCOMPLET', { restants: restants.length }, { champ, valeurProposee: restants });
}
