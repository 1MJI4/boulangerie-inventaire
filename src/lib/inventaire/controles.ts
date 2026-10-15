// src/lib/inventaire/controles.ts
//
// Branchement des écrans d'inventaire sur le DOMAINE (remplace l'ancien
// src/lib/coherence.ts, dont les règles vivent désormais dans
// src/domaine/inventaire.ts). Propriétaire : `inventaire-scan`.
//
// AUCUNE règle ici : on convertit la saisie de l'écran (texte d'entiers :
// pièces, ou GRAMMES pour un produit au kilo) vers les fonctions du domaine,
// et on renvoie leurs signalements tels quels, à afficher avec <Signalement>.
//
// LOI 10 : les produits sont ceux de la liste d'INVENTAIRE (table "Produit"),
// jamais ceux du catalogue de commande.

import {
  totalInventaire,
  validerSaisieInventaire,
  verifierComptage,
  verifierProduction,
  verifierHeureInventaire,
  type ProduitInventaire,
} from '@/domaine/inventaire';
import { HEURE_FERMETURE_HYPOTHESE, SEUILS_COMPTAGE_HYPOTHESE } from '@/domaine/constantes';
import type { Avertissement, Echec, Information, Resultat } from '@/domaine/resultat';
import type { Unite } from '@/domaine/types';

export type SignalementLigne = Echec | Avertissement | Information;

type ProduitEcran = { id: number; nom: string; unite: Unite };

export function versProduitDomaine(p: ProduitEcran): ProduitInventaire {
  return { id: String(p.id), nom: p.nom, unite: p.unite };
}

/** Texte de l'écran → quantité (pièces ou grammes) ; '' = pas encore compté. */
export function lireValeur(valeur: string | undefined): number | null {
  if (valeur === undefined || valeur === '') return null;
  return Number(valeur);
}

/** Contrôles à la frappe d'un comptage (restant en rayon). Jamais bloquant sauf saisie invalide. */
export function controlesComptage(
  produit: ProduitEcran,
  valeur: string | undefined,
  produite: number | null | undefined,
): SignalementLigne[] {
  const quantite = lireValeur(valeur);
  if (quantite === null) return [];
  const v = validerSaisieInventaire(produit.unite, quantite);
  if (!v.ok) return [v];
  return verifierComptage(
    { produit: versProduitDomaine(produit), quantite, produite: produite ?? null },
    SEUILS_COMPTAGE_HYPOTHESE,
  );
}

/** Contrôles à la frappe d'une production (sortie du four). */
export function controlesProduction(
  produit: ProduitEcran,
  valeur: string | undefined,
  demandee: number | null | undefined,
): SignalementLigne[] {
  const produite = lireValeur(valeur);
  if (produite === null) return [];
  const v = validerSaisieInventaire(produit.unite, produite, 'produite');
  if (!v.ok) return [v];
  return verifierProduction(
    { produit: versProduitDomaine(produit), produite, demandee: demandee ?? null },
    SEUILS_COMPTAGE_HYPOTHESE,
  );
}

/**
 * Produit recompté (R21) : le second comptage s'ADDITIONNE au premier, par le
 * domaine (`totalInventaire`), qui renvoie AVERT_DOUBLE_SCAN.
 */
export function additionnerRecomptage(
  produit: ProduitEcran,
  dejaCompte: number,
  ajout: number,
): Resultat<number> {
  const p = versProduitDomaine(produit);
  const total = totalInventaire(
    [p],
    [
      { saisieId: 'deja-compte', produitId: p.id, unite: p.unite, quantite: dejaCompte },
      { saisieId: 'recomptage', produitId: p.id, unite: p.unite, quantite: ajout },
    ],
  );
  if (!total.ok) return total;
  return { ok: true, donnees: total.donnees.lignes[0]?.quantite ?? dejaCompte, signalements: total.signalements };
}

/** « HH:MM » de l'horloge LOCALE de la tablette. */
export function heureLocale(instant: Date): string {
  return `${String(instant.getHours()).padStart(2, '0')}:${String(instant.getMinutes()).padStart(2, '0')}`;
}

/**
 * LOI 11 (R57) : inventaire commencé avant l'heure de fermeture → avertissement
 * non bloquant. `heureFermeture` : réglage en base (en-tête de
 * GET /api/inventaires), sinon HEURE_FERMETURE_HYPOTHESE.
 */
export function controleDebutInventaire(instant: Date, heureFermeture: string | null): SignalementLigne[] {
  try {
    const r = verifierHeureInventaire(heureLocale(instant), heureFermeture ?? HEURE_FERMETURE_HYPOTHESE);
    return r.ok ? r.signalements : [];
  } catch {
    // Réglage reçu illisible : on retombe sur l'hypothèse plutôt que de casser le comptage.
    const r = verifierHeureInventaire(heureLocale(instant), HEURE_FERMETURE_HYPOTHESE);
    return r.ok ? r.signalements : [];
  }
}

/**
 * Identifiant d'un geste de saisie (UUID v4), pour l'idempotence de la
 * synchronisation. `randomUUID` n'existe qu'en contexte sécurisé (https) :
 * sur le réseau du magasin en http, repli sur `getRandomValues`.
 */
export function nouvelIdSaisie(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const o = new Uint8Array(16);
  c.getRandomValues(o);
  o[6] = (o[6] & 0x0f) | 0x40;
  o[8] = (o[8] & 0x3f) | 0x80;
  const h = Array.from(o, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
