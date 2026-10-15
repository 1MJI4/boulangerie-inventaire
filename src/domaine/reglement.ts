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
  formaterDate,
  jourSemaineIso,
  prochainJourOuvert,
  validerDateRetrait,
} from './calendrier.ts';
import type { JourFerme } from './calendrier.ts';
import type { HorairesRetraitPatisserie } from './constantes.ts';
import { deverrouillageValide } from './regimes.ts';
import type { DateISO, Deverrouillage, ProduitRegle } from './types.ts';

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
 * Règle R53 : une commande à retirer le jour même ou le premier jour OUVERT
 * qui suit la prise de commande (« le lendemain ») demande l'accord préalable
 * du responsable.
 * Niveau : BLOQUANT (règlement : « contacter le responsable au préalable »),
 * sorties : code gérant (→ accepté, AVERT_COMMANDE_LENDEMAIN_AUTORISEE tracé)
 * ou `valeurProposee` = premier jour ouvert qui n'est plus « le lendemain ».
 * Le lendemain se compte en jours OUVERTS : prise lundi, mardi fermé → le
 * retrait du mercredi est « le lendemain ».
 * Vérifier que `par` est bien le gérant relève de `securite` (route).
 *
 * HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°49) : cette règle s'AJOUTE au délai
 * minimum (`validerDelai`, délais n°17) ; le plus restrictif s'applique. Le code
 * gérant lève la règle du lendemain, PAS le délai : un gâteau (2 jours ouvrés)
 * pour le lendemain reste refusé même avec l'accord du responsable.
 * HYPOTHÈSE À VALIDER : `aujourdhui` = jour de la saisie ; une modification
 * faite la veille du retrait repasse donc par l'accord du responsable.
 *
 * N'interdit pas : un retrait au-delà du premier jour ouvert suivant.
 */
export function validerLendemain(
  dateRetrait: DateISO,
  aujourdhui: DateISO,
  joursFermes: readonly JourFerme[],
  deverrouillage?: Deverrouillage | null,
  champ = 'dateRetrait',
): Resultat<DateISO> {
  const base = validerDateRetrait(dateRetrait, joursFermes, aujourdhui, champ);
  if (!base.ok) return base;
  const lendemain = prochainJourOuvert(decalerJours(aujourdhui, 1), joursFermes);
  // Aucun jour ouvert dans l'horizon : on ne sait pas dire, on bloque.
  if (lendemain === null) return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'date de retrait' }, { champ });
  if (dateRetrait > lendemain) return succes(dateRetrait);

  if (deverrouillageValide(deverrouillage)) {
    return succes(
      dateRetrait,
      signaler('AVERT_COMMANDE_LENDEMAIN_AUTORISEE', { par: deverrouillage.par.trim() }, { champ }),
    );
  }
  const suivant = prochainJourOuvert(decalerJours(lendemain, 1), joursFermes);
  return signaler(
    'ERR_COMMANDE_LENDEMAIN',
    { dateRetrait: formaterDate(dateRetrait) },
    suivant ? { champ, valeurProposee: suivant } : { champ },
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
 * Le retrait tombe-t-il un « week-end » au sens des horaires pâtisserie ?
 * Jours de week-end = donnée ; un férié ouvert (liste `feriesOuverts`, ou ligne
 * `ferie` de JourFerme) suit l'horaire du week-end.
 * HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°52).
 */
export function estHoraireWeekEnd(
  date: DateISO,
  horaires: HorairesRetraitPatisserie,
  joursFermes: readonly JourFerme[] = [],
): boolean {
  if (horaires.joursWeekEndIso.includes(jourSemaineIso(date))) return true;
  if (horaires.feriesOuverts?.includes(date)) return true;
  return estJourFerie(date, joursFermes);
}

/**
 * Règle R54 : une commande contenant de la pâtisserie se retire à partir de
 * `horaires.semaine` en semaine et `horaires.weekEnd` le week-end (et férié ouvert).
 * Niveau : BLOQUANT, `valeurProposee` = première heure possible (« HH:MM »).
 * Heure illisible → ERR_SAISIE_INVALIDE.
 * HYPOTHÈSE À VALIDER : commande avec pâtisserie SANS heure de retrait →
 * ERR_CHAMP_OBLIGATOIRE (sinon la règle se contourne en laissant le champ vide).
 * HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°50) : ne vaut que pour la pâtisserie.
 * N'interdit pas : toute heure ≥ l'heure minimale ; aucune heure maximale n'est
 * contrôlée (heure de fermeture : non demandée par le règlement).
 * Les horaires mal configurés (illisibles) sont un bug : RangeError.
 */
export function validerHeureRetrait(
  dateRetrait: DateISO,
  heureRetrait: string | null | undefined,
  lignes: readonly { estPatisserie: boolean }[],
  horaires: HorairesRetraitPatisserie,
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

  const weekEnd = estHoraireWeekEnd(dateRetrait, horaires, joursFermes);
  const min = lireHeure(weekEnd ? horaires.weekEnd : horaires.semaine);
  if (min === null) throw new RangeError('reglement.ts : horaires de retrait pâtisserie illisibles.');
  if (minutes >= min) return succes(heure);
  return signaler(
    'ERR_HEURE_RETRAIT_TROP_TOT',
    { heureMin: formaterHeure(min), typeJour: weekEnd ? 'week-end' : 'semaine' },
    { champ, valeurProposee: heureChamp(min) },
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
