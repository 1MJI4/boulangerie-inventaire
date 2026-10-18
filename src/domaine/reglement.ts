// src/domaine/reglement.ts
//
// LOI 11 — règlement intérieur (docs/REGLEMENT-INTERIEUR.md, points 9, 51, 52, 53)
// et décisions du propriétaire du 15/10/2026 et du 18/10/2026.
// Propriétaire : agent `regles-metier`. Orchestré par `commande.ts`.
//
// Toutes les valeurs (heures d'ouverture jour par jour, dates exceptionnelles)
// sont des DONNÉES passées en paramètre : défauts dans constantes.ts
// (REGLEMENT_COMMANDE), réglages du gérant en base. Aucun jour, aucune heure
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
  formaterDate,
  jourSemaineIso,
  prochainJourOuvert,
  validerDateRetrait,
} from './calendrier.ts';
import type { JourFerme } from './calendrier.ts';
import { JOURS_ISO_CLES } from './constantes.ts';
import type { HorairesOuverture, JourIsoCle, PlageOuverture } from './constantes.ts';
import type { DateISO } from './types.ts';

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
 * N'interdit RIEN. Le jour même n'est pas « le lendemain » : il a sa propre
 * information (`validerJourMeme`). Un gâteau à étages n'est refusé que si le
 * gérant a réglé un délai (`reglement:delai_gateau_etages_jours`, contrôlé avant
 * par `validerDelai` dans `controlerCommande`).
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
// R53b — commande pour le jour même
// ---------------------------------------------------------------------------

/**
 * Règle R53b (décision du propriétaire du 18/10/2026) : une commande à retirer
 * LE JOUR MÊME de la saisie est ACCEPTÉE ; l'employé prévient l'atelier tout
 * de suite.
 * Niveau : INFORMATION (INFO_COMMANDE_JOUR_MEME) — aucune friction, aucun accord.
 * N'interdit RIEN. Reste refusé (contrôlé ici aussi, pour un appel isolé depuis
 * l'écran) : une date passée (ERR_DATE_PASSEE), un jour fermé (ERR_JOUR_FERME),
 * une date illisible (ERR_SAISIE_INVALIDE).
 * `aujourdhui` = jour de la saisie : une commande saisie hors ligne puis
 * synchronisée le lendemain reste « du jour même » de sa prise.
 */
export function validerJourMeme(
  dateRetrait: DateISO,
  aujourdhui: DateISO,
  joursFermes: readonly JourFerme[],
  champ = 'dateRetrait',
): Resultat<DateISO> {
  const base = validerDateRetrait(dateRetrait, joursFermes, aujourdhui, champ);
  if (!base.ok) return base;
  if (dateRetrait !== aujourdhui) return succes(dateRetrait);
  return succes(dateRetrait, signaler('INFO_COMMANDE_JOUR_MEME', {}, { champ }));
}

// ---------------------------------------------------------------------------
// R54 — heure de retrait dans les heures d'ouverture du magasin
// ---------------------------------------------------------------------------

/** Plage lue en minutes ; RangeError si illisible ou si l'ouverture n'est pas avant la fermeture. */
function lirePlage(plage: PlageOuverture | undefined): { ouverture: number; fermeture: number } {
  const ouverture = lireHeure(plage?.ouverture);
  const fermeture = lireHeure(plage?.fermeture);
  if (ouverture === null || fermeture === null || ouverture >= fermeture) {
    throw new RangeError('reglement.ts : heures d’ouverture illisibles.');
  }
  return { ouverture, fermeture };
}

/** Plage en minutes et provenance (date exceptionnelle ou jour de la semaine). */
function plageDuJour(
  date: DateISO,
  horaires: HorairesOuverture,
): { ouverture: number; fermeture: number; exceptionnelle: boolean } {
  if (!estDateISO(date)) throw new RangeError('reglement.ts : date illisible.');
  const exceptions = horaires.exceptions.filter((e) => e.date === date).map(lirePlage);
  if (exceptions.length > 0) {
    // Une même date saisie deux fois (impossible via les réglages, décision du
    // 18/10/2026, n°63 ; défense si la donnée arrive autrement) : la plage
    // COMMUNE, le plus sûr — on ne promet pas un retrait magasin fermé.
    const ouverture = Math.max(...exceptions.map((e) => e.ouverture));
    const fermeture = Math.min(...exceptions.map((e) => e.fermeture));
    if (ouverture >= fermeture) throw new RangeError('reglement.ts : dates exceptionnelles contradictoires.');
    return { ouverture, fermeture, exceptionnelle: true };
  }
  const cle = String(jourSemaineIso(date)) as JourIsoCle;
  return { ...lirePlage(horaires.parJour[cle]), exceptionnelle: false };
}

/**
 * Heures d'ouverture du magasin à `date`, « HH:MM » (réglages du gérant,
 * décision du propriétaire du 18/10/2026) :
 *   1. date exceptionnelle (`exceptions`) si présente — prioritaire ;
 *   2. sinon la plage du jour de la semaine (`parJour`).
 * Ne dit RIEN des jours fermés (LOI 3, `validerDateRetrait`) : un mardi a une
 * plage, mais il est refusé avant.
 * Horaires illisibles (réglage cassé) ou date illisible : RangeError (bug).
 */
export function horairesOuvertureDuJour(date: DateISO, horaires: HorairesOuverture): PlageOuverture {
  const p = plageDuJour(date, horaires);
  return { ouverture: heureChamp(p.ouverture), fermeture: heureChamp(p.fermeture) };
}

/**
 * Vrai si `plage` est une plage d'ouverture valable : deux heures « HH:MM »
 * lisibles, l'ouverture STRICTEMENT avant la fermeture. Sert au contrôle des
 * réglages du gérant (src/lib/serveur/reglages.ts), miroir du CHECK de la base.
 */
export function estPlageOuverture(plage: unknown): plage is PlageOuverture {
  if (typeof plage !== 'object' || plage === null) return false;
  const p = plage as Record<string, unknown>;
  const ouverture = lireHeure(p.ouverture);
  const fermeture = lireHeure(p.fermeture);
  return ouverture !== null && fermeture !== null && ouverture < fermeture;
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
 * Règle R54 (décision du propriétaire du 18/10/2026) : pour TOUT produit, une
 * heure de retrait doit tomber dans les heures d'ouverture du magasin ce
 * jour-là (`horairesOuvertureDuJour`), bornes incluses.
 * Niveau : BLOQUANT (ERR_HEURE_HORS_OUVERTURE), `valeurProposee` = la borne la
 * plus proche (« HH:MM ») : l'ouverture si trop tôt, la fermeture si trop tard.
 * Heure illisible → ERR_SAISIE_INVALIDE.
 * N'interdit pas : une heure VIDE (l'heure de retrait est facultative, pour
 * tous les produits) ; toute heure entre l'ouverture et la fermeture incluses
 * (« 20:00 » passe quand le magasin ferme à 20h00 : c'est la borne proposée).
 * HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°64) : la fermeture est une heure de retrait possible.
 * Les horaires mal configurés (illisibles) sont un bug : RangeError.
 */
export function validerHeureRetrait(
  dateRetrait: DateISO,
  heureRetrait: string | null | undefined,
  horaires: HorairesOuverture,
  champ = 'heureRetrait',
): Resultat<string | null> {
  const vide = heureRetrait === null || heureRetrait === undefined || String(heureRetrait).trim() === '';
  if (vide) return succes(null);
  const minutes = lireHeure(heureRetrait);
  if (minutes === null) return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'heure de retrait' }, { champ });
  if (!estDateISO(dateRetrait)) {
    return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'date de retrait' }, { champ: 'dateRetrait' });
  }
  const plage = plageDuJour(dateRetrait, horaires);
  if (minutes >= plage.ouverture && minutes <= plage.fermeture) return succes(heureChamp(minutes));
  const proposee = minutes < plage.ouverture ? plage.ouverture : plage.fermeture;
  return signaler(
    'ERR_HEURE_HORS_OUVERTURE',
    {
      ouverture: formaterHeure(plage.ouverture),
      fermeture: formaterHeure(plage.fermeture),
      // Date exceptionnelle : la date en clair (« le jeudi 24 décembre ») ; sinon le jour.
      jour: plage.exceptionnelle ? `le ${formaterDate(dateRetrait)}` : `le ${nomJour(dateRetrait)}`,
      heureProposee: formaterHeure(proposee),
    },
    { champ, valeurProposee: heureChamp(proposee) },
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
