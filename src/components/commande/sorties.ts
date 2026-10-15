// src/components/commande/sorties.ts
//
// Libellé du bouton de sortie d'un signalement (LOI 7 et 8 : « tout refus
// propose la sortie »). Le TEXTE vient du catalogue des messages
// (`sortiePour`, propriétaire `gestion-erreurs`) ; ce fichier ne fait que
// reconstituer ses paramètres à partir de `valeurProposee`, qui voyage avec le
// signalement. Aucune règle, aucun seuil, aucun prix.
//
// Imports relatifs avec extension : module exécuté tel quel par `node --test`.

import type { Avertissement, Echec, Information } from '../../domaine/resultat.ts';
import { CATALOGUE, estCodeCatalogue, sortiePour, type CodeCatalogue, type ParametresMessages } from '../../domaine/messages.ts';
import { formaterEuros } from '../../domaine/argent.ts';
import { estDateISO, formaterDate } from '../../domaine/calendrier.ts';
import { formaterHeure, lireHeure } from '../../domaine/reglement.ts';
import { champLocal } from './modele.ts';
import { LIBELLE_STATUT, STATUTS, type StatutCommande } from '../../lib/commandes.ts';

type S = Echec | Avertissement | Information;

/** Nom humain d'un champ du domaine, pour « Remplir « … » ». */
const LIBELLES_CHAMPS: Record<string, string> = {
  client: 'nom du client',
  telephone: 'téléphone du client',
  dateRetrait: 'date de retrait',
  heureRetrait: 'heure de retrait',
  acompte: 'acompte',
  quantite: 'quantité',
  prixCentimes: 'prix',
  nbSymboles: 'nombre de chiffres ou lettres',
  produitId: 'produit',
  total: 'total',
};

/**
 * Statut lisible pour « Laisser « à imprimer » » (LOI 9 : jamais le code brut
 * « a_imprimer »). `valeurProposee` d'ERR_STATUT_INCOHERENT est le code du statut.
 */
function statutLisible(v: unknown): string {
  if (typeof v !== 'string' || !(STATUTS as readonly string[]).includes(v)) return 'le statut actuel';
  const l = LIBELLE_STATUT[v as StatutCommande];
  return l.charAt(0).toLowerCase() + l.slice(1);
}

const entier = (v: unknown): number | null => (typeof v === 'number' && Number.isSafeInteger(v) ? v : null);

/** Montant proposé formaté, ou chaîne vide si la valeur n'est pas un montant. */
const euros = (v: unknown): string => {
  const n = entier(v);
  return n === null ? '' : formaterEuros(n);
};

function parametres(s: S, uniteQuantite: string): Record<string, unknown> {
  const v = s.valeurProposee;
  const champLibelle = LIBELLES_CHAMPS[champLocal(s.champ)] ?? 'champ';
  switch (s.code) {
    case 'ERR_QUANTITE_MIN':
      return { produit: '', minimum: entier(v) ?? '', unite: uniteQuantite };
    case 'ERR_QUANTITE_INVALIDE':
      return { unite: 'piece', proposition: entier(v) === null ? undefined : String(v) };
    case 'ERR_DELAI_TROP_COURT':
      return { delaiJoursOuvres: 0, premiereDate: estDateISO(v) ? formaterDate(v) : '' };
    case 'ERR_ACOMPTE_INSUFFISANT':
      return { acompteFormate: '', minimumFormate: euros(v), pourcentage: 0 };
    case 'ERR_ACOMPTE_SUPERIEUR_TOTAL':
      return { acompteFormate: '', totalFormate: euros(v) };
    case 'ERR_REMISE_NON_AUTORISEE':
    case 'ERR_TOTAL_INCOHERENT':
      return { totalFormate: euros(v) };
    case 'ERR_SOUS_PLANCHER':
      return entier(v) === null ? {} : { plancherFormate: euros(v) };
    case 'ERR_HEURE_RETRAIT_TROP_TOT': {
      const m = lireHeure(v);
      return { heureMin: m === null ? String(v ?? '') : formaterHeure(m), typeJour: 'semaine' };
    }
    case 'ERR_CHAMP_OBLIGATOIRE':
    case 'ERR_SAISIE_INVALIDE':
      return { champLibelle };
    case 'ERR_SUPPLEMENT_TROP_NOMBREUX':
      return { max: entier(v) ?? '' };
    case 'ERR_SUPPLEMENT_SANS_GATEAU':
      return {};
    case 'ERR_DROIT_INSUFFISANT':
      return { action: '', role: 'gérant' };
    case 'ERR_STATUT_INCOHERENT':
      return { de: statutLisible(v), vers: '' };
    default:
      return {};
  }
}

export type SortieAffichable = {
  /** Bouton qui corrige (avec `valeurProposee`) ou qui ouvre l'action à faire. */
  libelle?: string;
  /** true : le bouton applique `valeurProposee` ; false : il ouvre une action (code gérant, champ…). */
  avecValeur: boolean;
  /** Issue de secours quand l'écran ne peut rien corriger (« Appeler le gérant »). */
  autre?: string;
};

/**
 * Sortie d'un signalement, d'après le catalogue des messages.
 * `uniteQuantite` : « parts » ou « pièces » pour ERR_QUANTITE_MIN (donnée de la ligne).
 */
export function sortieDe(s: S, uniteQuantite = 'pièces'): SortieAffichable {
  if (!estCodeCatalogue(s.code)) return { avecValeur: false };
  // Supplément : plus aucune place (max 0, les autres lignes du même supplément
  // ont tout pris) → « Passer à 0 » n'a pas de sens, la sortie est de retirer la
  // ligne (texte du catalogue, `valeurProposee` 0 = retrait côté écran).
  if (s.code === 'ERR_SUPPLEMENT_TROP_NOMBREUX' && s.valeurProposee === 0) {
    const retrait = sortiePour('ERR_SUPPLEMENT_SANS_GATEAU', {});
    if (retrait) return { libelle: retrait.libelle, avecValeur: true };
  }
  const code = s.code as CodeCatalogue;
  const p = parametres(s, uniteQuantite) as ParametresMessages[typeof code];
  let sortie: ReturnType<typeof sortiePour> | undefined;
  try {
    sortie = sortiePour(code, p);
  } catch {
    sortie = undefined;
  }
  if (!sortie) return { avecValeur: false };
  if (sortie.type === 'autre') return { avecValeur: false, autre: sortie.libelle };
  // ERR_COMMANDE_LENDEMAIN : le bouton du catalogue est « Saisir le code gérant »,
  // la date proposée est une autre sortie (bouton séparé, cf. écran).
  const avecValeur = s.valeurProposee !== undefined && s.code !== 'ERR_COMMANDE_LENDEMAIN';
  return { libelle: sortie.libelle, avecValeur, autre: CATALOGUE[code].autreSortie };
}
