// src/lib/auth/identite.ts
//
// HYPOTHÈSE À VALIDER : identité déclarée par la tablette, pas de compte individuel (décision 15/10/2026)
//
// Il n'y a plus de compte par employé : le nom du vendeur (ou de l'auteur d'une
// modification) est celui choisi dans la liste de l'écran et envoyé dans la
// requête. Il n'est donc PAS une preuve d'identité — seulement une indication
// pour l'historique. On le nettoie pour qu'il reste un texte simple et court.
// Propriétaire : agent `securite`.

export const LONGUEUR_MAX_NOM_DECLARE = 40;

/**
 * Lettres (accents compris), chiffres, espace, apostrophes, point et trait
 * d'union. Tout le reste (balises, retours à la ligne, caractères de contrôle,
 * emoji…) est remplacé par un espace, puis les espaces sont resserrés.
 * Renvoie '' si rien d'utilisable.
 */
export function nomDeclare(brut: unknown, max = LONGUEUR_MAX_NOM_DECLARE): string {
  if (typeof brut !== 'string') return '';
  return brut
    .slice(0, 200)
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N} '’.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}
