// src/domaine/inventaire.ts
//
// Règles du COMPTAGE d'inventaire. Propriétaire : agent `regles-metier`.
//
// L'inventaire a SES PROPRES produits (aujourd'hui src/lib/catalogue.mjs /
// table Produit : Pains, Salé, Makla…), distincts du catalogue de COMMANDE
// (CSV + affiches, src/catalogue). Les deux ne se mélangent jamais : ce
// fichier reçoit la liste des produits d'inventaire EN DONNÉE et n'importe
// pas src/catalogue. Un produit de commande inconnu de cette liste est refusé.
//
// « Un id = une ligne » : le total regroupe par identifiant de produit
// d'inventaire. Un produit affiché à deux endroits de l'écran (accès rapide et
// rayon) a UN identifiant, il ne peut donc pas produire deux lignes.
// Chaque saisie porte un `saisieId` unique (geste de l'employé) :
//   - même saisieId reçu deux fois, même valeur → compté UNE fois (rejeu de la
//     synchronisation hors ligne, double envoi d'un écran) ;
//   - même saisieId, valeurs différentes → BLOQUANT (on ne choisit pas) ;
//   - deux saisieId pour le même produit → ADDITION + AVERT_DOUBLE_SCAN (R21).
//
// Hors périmètre (décision du 15/10/2026) : valorisation du stock en euros (R27).

import type { Resultat, Signalement } from './resultat.ts';
import { succes } from './resultat.ts';
import { signaler } from './messages.ts';
import type { SeuilsComptage } from './constantes.ts';
import { formaterQuantite } from './unites.ts';
import { formaterHeure, heureChamp, lireHeure } from './reglement.ts';
import type { Unite } from './types.ts';

/** Un produit de la liste d'INVENTAIRE (donnée fournie par l'appelant). */
export type ProduitInventaire = { id: string; nom: string; unite: Unite; actif?: boolean };

export type SaisieInventaire = {
  /** Identifiant unique du geste de saisie (UUID généré sur la tablette). */
  saisieId: string;
  produitId: string;
  /** Unité dans laquelle l'écran a saisi la valeur. */
  unite: Unite;
  /** Pièces, ou GRAMMES pour un produit au kilo. */
  quantite: number;
};

export type LigneInventaire = { produitId: string; nom: string; unite: Unite; quantite: number };

export type TotalInventaire = {
  /** Une ligne par produit, dans l'ordre de première saisie. */
  lignes: LigneInventaire[];
  totalPieces: number;
  totalGrammes: number;
};

/**
 * Règle : une quantité COMPTÉE est un entier ≥ 0 dans l'unité du produit
 * (pièces, ou grammes pour un produit au kilo). Zéro est permis : rayon vide.
 * Niveau : BLOQUANT. Négatif → sortie « mettre 0 » ; décimal à la pièce →
 * sortie « l'entier le plus proche ».
 */
export function validerSaisieInventaire(unite: Unite, valeur: number, champ = 'quantite'): Resultat<number> {
  if (Number.isSafeInteger(valeur) && valeur >= 0) return succes(valeur);
  if (Number.isFinite(valeur) && valeur < 0) {
    return signaler('ERR_QUANTITE_NEGATIVE', {}, { champ, valeurProposee: 0 });
  }
  if (unite === 'piece' && Number.isFinite(valeur)) {
    const proposee = Math.round(valeur);
    return signaler(
      'ERR_QUANTITE_INVALIDE',
      { unite, proposition: String(proposee), zeroAccepte: true },
      { champ, valeurProposee: proposee },
    );
  }
  return signaler('ERR_QUANTITE_INVALIDE', { unite, zeroAccepte: true }, { champ });
}

/**
 * Règle : une saisie d'inventaire porte sur un produit ACTIF de la liste
 * d'inventaire, dans SON unité.
 * Niveau : BLOQUANT — produit inconnu (ex. produit du catalogue de commande)
 * → ERR_PRODUIT_INCONNU ; produit au kilo saisi à la pièce (ou l'inverse)
 * → ERR_UNITE_INCOHERENTE (LOI 2 : l'erreur silencieuse à empêcher).
 */
export function validerSaisieProduit(
  produits: readonly ProduitInventaire[],
  saisie: SaisieInventaire,
): Resultat<{ produit: ProduitInventaire; quantite: number }> {
  const produit = produits.find((p) => p.id === saisie.produitId && p.actif !== false);
  if (!produit) return signaler('ERR_PRODUIT_INCONNU', {}, { champ: 'produitId' });
  if (saisie.unite !== produit.unite) {
    return signaler('ERR_UNITE_INCOHERENTE', {}, { champ: 'unite' });
  }
  const q = validerSaisieInventaire(produit.unite, saisie.quantite);
  if (!q.ok) return q;
  return succes({ produit, quantite: q.donnees });
}

/**
 * Total d'un inventaire, sans double comptage (voir en-tête).
 * Niveau : le premier blocage arrête (produit inconnu, unité, quantité,
 * conflit de saisie) ; un produit compté par deux saisies → AVERTISSEMENT
 * AVERT_DOUBLE_SCAN, quantités additionnées.
 */
export function totalInventaire(
  produits: readonly ProduitInventaire[],
  saisies: readonly SaisieInventaire[],
): Resultat<TotalInventaire> {
  const vues = new Map<string, SaisieInventaire>();
  const parProduit = new Map<string, LigneInventaire & { saisies: number }>();
  const signalements: Signalement[] = [];

  for (const s of saisies) {
    const deja = vues.get(s.saisieId);
    if (deja) {
      if (deja.produitId === s.produitId && deja.unite === s.unite && deja.quantite === s.quantite) continue;
      const nom = produits.find((p) => p.id === s.produitId)?.nom ?? s.produitId;
      return signaler('ERR_CONFLIT_COMPTAGE', { produit: nom }, { champ: 'quantite' });
    }
    vues.set(s.saisieId, s);

    const v = validerSaisieProduit(produits, s);
    if (!v.ok) return v;
    const { produit, quantite } = v.donnees;
    const ligne = parProduit.get(produit.id);
    if (!ligne) {
      parProduit.set(produit.id, { produitId: produit.id, nom: produit.nom, unite: produit.unite, quantite, saisies: 1 });
      continue;
    }
    ligne.quantite += quantite;
    ligne.saisies += 1;
    if (ligne.saisies === 2) {
      signalements.push(
        signaler('AVERT_DOUBLE_SCAN', { produit: produit.nom }, { champ: `produit:${produit.id}`, valeurProposee: ligne.quantite }),
      );
    }
  }

  const lignes = [...parProduit.values()].map(({ saisies: _s, ...l }) => l);
  let totalPieces = 0;
  let totalGrammes = 0;
  for (const l of lignes) {
    if (l.unite === 'kg') totalGrammes += l.quantite;
    else totalPieces += l.quantite;
  }
  return succes({ lignes, totalPieces, totalGrammes }, ...signalements);
}

/**
 * Règle : un comptage invraisemblable est signalé au moment de la frappe
 * (repris de l'ancien src/lib/coherence.ts, sans jamais bloquer).
 * Niveau : AVERTISSEMENT — l'employé a l'étagère sous les yeux, c'est lui qui
 * tranche ; un stock de la veille peut dépasser la production du jour.
 *  - au-delà du plafond en pièces → « un chiffre de trop ? » ;
 *  - plus que la quantité produite → « vérifiez le comptage » ;
 *  - au-delà de facteur × moyenne historique → « au-dessus de l'habitude ».
 * Seuils fournis en paramètre (SEUILS_COMPTAGE_HYPOTHESE, HYPOTHÈSE À VALIDER).
 */
export function verifierComptage(
  entree: {
    produit: ProduitInventaire;
    quantite: number;
    produite?: number | null;
    moyenneHistorique?: number | null;
  },
  seuils: SeuilsComptage,
): Signalement[] {
  const { produit, quantite, produite, moyenneHistorique } = entree;
  const champ = 'quantite';
  if (produit.unite === 'piece' && quantite > seuils.plafondPieces) {
    return [signaler('AVERT_QUANTITE_INHABITUELLE', { produit: produit.nom }, { champ })];
  }
  if (produite != null && quantite > produite) {
    return [
      signaler(
        'AVERT_PLUS_QUE_PRODUIT',
        { produit: produit.nom, produite: formaterQuantite(produit.unite, produite) },
        { champ },
      ),
    ];
  }
  if (
    moyenneHistorique != null &&
    moyenneHistorique > seuils.moyenneMinimale &&
    quantite > moyenneHistorique * seuils.facteurSuspect
  ) {
    return [
      signaler(
        'AVERT_QUANTITE_INHABITUELLE',
        { produit: produit.nom, reference: formaterQuantite(produit.unite, Math.round(moyenneHistorique)) },
        { champ },
      ),
    ];
  }
  return [];
}

/**
 * Règle : une production très éloignée de la quantité demandée est signalée,
 * dans les deux sens (400 tapé pour 40, ou 4 pour 40).
 * Niveau : AVERTISSEMENT (repris de l'ancien src/lib/coherence.ts).
 */
export function verifierProduction(
  entree: { produit: ProduitInventaire; produite: number; demandee?: number | null },
  seuils: SeuilsComptage,
): Signalement[] {
  const { produit, produite, demandee } = entree;
  const champ = 'produite';
  if (produit.unite === 'piece' && produite > seuils.plafondPieces) {
    return [signaler('AVERT_QUANTITE_INHABITUELLE', { produit: produit.nom }, { champ })];
  }
  if (demandee == null || demandee <= seuils.moyenneMinimale) return [];
  const d = formaterQuantite(produit.unite, demandee);
  if (produite > demandee * seuils.facteurSuspect) {
    return [signaler('AVERT_PRODUCTION_INHABITUELLE', { produit: produit.nom, demandee: d, sens: 'dessus' }, { champ })];
  }
  if (produite * seuils.facteurSuspect < demandee) {
    return [signaler('AVERT_PRODUCTION_INHABITUELLE', { produit: produit.nom, demandee: d, sens: 'dessous' }, { champ })];
  }
  return [];
}

/**
 * Règle R57 (règlement intérieur, point 9) : l'inventaire se fait à l'heure
 * de fermeture, « jamais avant ».
 * Niveau : AVERTISSEMENT (LOI 11) — un inventaire commencé plus tôt est
 * accepté et signalé (un comptage anticipé voulu par le responsable existe).
 * `heureDebut` : heure LOCALE de la tablette au début du comptage (« HH:MM »),
 * fournie par l'appelant ; `heureFermeture` : DONNÉE (HEURE_FERMETURE_HYPOTHESE,
 * question n°51). Heure de début illisible → ERR_SAISIE_INVALIDE.
 * Comparaison sur la journée : un inventaire commencé après minuit (00:30)
 * est « avant 20:00 » et donc signalé (le plus prudent).
 * Une heure de fermeture illisible est un bug de configuration : RangeError.
 */
export function verifierHeureInventaire(heureDebut: string, heureFermeture: string): Resultat<string> {
  const debut = lireHeure(heureDebut);
  if (debut === null) return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'heure de début' }, { champ: 'heureDebut' });
  const fermeture = lireHeure(heureFermeture);
  if (fermeture === null) throw new RangeError('inventaire.ts : heure de fermeture illisible.');
  const heure = heureChamp(debut);
  if (debut >= fermeture) return succes(heure);
  return succes(
    heure,
    signaler('AVERT_INVENTAIRE_AVANT_FERMETURE', { heureFermeture: formaterHeure(fermeture) }, { champ: 'heureDebut' }),
  );
}
