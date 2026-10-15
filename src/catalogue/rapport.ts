// src/catalogue/rapport.ts
// Entrées du rapport d'import (lu par le gérant). Propriétaire : `catalogue-prix`.
//
// Ce module décide QUAND un import échoue et OÙ (ligne, produit) ; le texte
// vient TOUJOURS du catalogue unique de `gestion-erreurs`
// (src/domaine/messages.ts, codes à paramètres { ou?, precision? }).
// Aucun message n'est rédigé dans src/catalogue.

import { signaler, type ParametresMessages } from "../domaine/messages.ts";
import type { Signalement } from "./types.ts";

/** Codes du rapport d'import : ceux dont les paramètres sont { ou?, precision? }. */
export type CodeRapport = {
  [K in keyof ParametresMessages]: string extends keyof ParametresMessages[K]
    ? never // Record<string, never> : codes sans paramètre
    : "ou" extends keyof ParametresMessages[K]
      ? K
      : never;
}[keyof ParametresMessages];

export interface ParametresRapport {
  /** Repère dans le fichier, ex. « Ligne 12 « Croissant » (Viennoiserie) ». */
  ou?: string;
  /** Précision factuelle, ex. « 7 colonnes au lieu de 8 ». */
  precision?: string;
}

/** Repère technique de l'entrée (non affiché tel quel). */
export interface RepereRapport {
  ligne?: number;
  produitId?: string;
}

/** Construit une entrée du rapport depuis le catalogue des messages. */
export function entreeRapport(code: CodeRapport, params: ParametresRapport = {}, repere: RepereRapport = {}): Signalement {
  const s = (signaler as (c: string, p: ParametresRapport) => { niveau: Signalement["niveau"]; code: string; message: string })(
    code,
    params,
  );
  const entree: Signalement = { niveau: s.niveau, code: s.code, message: s.message };
  if (repere.ligne !== undefined) entree.ligne = repere.ligne;
  if (repere.produitId !== undefined) entree.produitId = repere.produitId;
  return entree;
}

/** Libellé d'un produit pour le champ `ou` : « Croissant — sous-catégorie » (rayon). */
export function libelleProduit(l: { categorie: string; produit: string; sousCategorie: string }): string {
  return `« ${l.produit}${l.sousCategorie ? " — " + l.sousCategorie : ""} » (${l.categorie})`;
}

/** Repère « Ligne N « produit » (rayon) ». */
export function ouLigne(ligne: number, l?: { categorie: string; produit: string; sousCategorie: string }): string {
  return l ? `Ligne ${ligne} ${libelleProduit(l)}` : `Ligne ${ligne}`;
}

/**
 * Erreur levée quand un fichier de configuration du tarif (registre des
 * versions) est inutilisable. Porte l'entrée du rapport ; son `message` est
 * celui du catalogue des messages.
 */
export class ErreurImport extends Error {
  readonly signalement: Signalement;
  constructor(signalement: Signalement) {
    super(signalement.message);
    this.name = "ErreurImport";
    this.signalement = signalement;
  }
}
