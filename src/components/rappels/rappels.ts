// src/components/rappels/rappels.ts
//
// Rappels équipe (CLAUDE.md, LOI N°11, « Rappels équipe ») : petits rappels
// bienveillants du règlement intérieur, montés dans des moments qui existent
// déjà (chargement, commande validée, inventaire terminé). Jamais bloquants,
// jamais de temps d'attente ajouté.
//
// Fonctions pures, sans React ni réseau. Propriétaire : design-ux.
// Textes : `data/rappels-equipe.json` (documentation-gerant).

export const MOMENTS = ['chargement', 'apres_commande', 'apres_inventaire'] as const;
export type MomentRappel = (typeof MOMENTS)[number];

export const TITRE_MAX = 30;
export const TEXTE_MAX = 140;

export type Rappel = {
  id: string;
  /** Numéros des points du règlement intérieur concernés. */
  regle: number[];
  moments: MomentRappel[];
  /** ≤ 30 caractères. */
  titre: string;
  /** ≤ 140 caractères. */
  texte: string;
  emoji: string;
};

export type FichierRappels = { version: 1; rappels: Rappel[] };

/** Un rappel mal formé ou un problème du fichier. */
export type DefautRappel = { index: number; id?: string; raison: string };

function estRappel(x: unknown): { ok: true; rappel: Rappel } | { ok: false; raison: string } {
  if (typeof x !== 'object' || x === null) return { ok: false, raison: 'entrée non objet' };
  const r = x as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id.trim() === '') return { ok: false, raison: 'id manquant' };
  if (!Array.isArray(r.regle) || !r.regle.every((n) => Number.isInteger(n))) {
    return { ok: false, raison: 'regle doit être une liste de numéros' };
  }
  if (
    !Array.isArray(r.moments) ||
    r.moments.length === 0 ||
    !r.moments.every((m) => (MOMENTS as readonly unknown[]).includes(m))
  ) {
    return { ok: false, raison: `moments doit contenir ${MOMENTS.join(' | ')}` };
  }
  if (typeof r.titre !== 'string' || r.titre.trim() === '' || [...r.titre].length > TITRE_MAX) {
    return { ok: false, raison: `titre vide ou plus de ${TITRE_MAX} caractères` };
  }
  if (typeof r.texte !== 'string' || r.texte.trim() === '' || [...r.texte].length > TEXTE_MAX) {
    return { ok: false, raison: `texte vide ou plus de ${TEXTE_MAX} caractères` };
  }
  if (typeof r.emoji !== 'string' || r.emoji.trim() === '') return { ok: false, raison: 'emoji manquant' };
  return {
    ok: true,
    rappel: {
      id: r.id,
      regle: r.regle as number[],
      moments: r.moments as MomentRappel[],
      titre: r.titre,
      texte: r.texte,
      emoji: r.emoji,
    },
  };
}

/**
 * Valide le contenu du fichier. Un rappel mal formé est ÉCARTÉ (et listé dans
 * `defauts`), jamais fatal : un rappel raté ne doit pas casser l'application.
 * Les identifiants en double sont écartés aussi (le premier gagne).
 */
export function validerRappels(donnees: unknown): { rappels: Rappel[]; defauts: DefautRappel[] } {
  const defauts: DefautRappel[] = [];
  if (typeof donnees !== 'object' || donnees === null) {
    return { rappels: [], defauts: [{ index: -1, raison: 'fichier illisible' }] };
  }
  const f = donnees as Record<string, unknown>;
  if (f.version !== 1) defauts.push({ index: -1, raison: `version ${String(f.version)} inconnue (attendu 1)` });
  if (!Array.isArray(f.rappels)) {
    return { rappels: [], defauts: [...defauts, { index: -1, raison: 'liste « rappels » absente' }] };
  }
  if (f.version !== 1) return { rappels: [], defauts };

  const rappels: Rappel[] = [];
  const ids = new Set<string>();
  f.rappels.forEach((x, index) => {
    const v = estRappel(x);
    const id = typeof (x as { id?: unknown })?.id === 'string' ? (x as { id: string }).id : undefined;
    if (!v.ok) defauts.push({ index, id, raison: v.raison });
    else if (ids.has(v.rappel.id)) defauts.push({ index, id, raison: 'id en double' });
    else {
      ids.add(v.rappel.id);
      rappels.push(v.rappel);
    }
  });
  return { rappels, defauts };
}

/** Nombre de rappels récents à ne pas reproposer, selon la taille du choix. */
export function tailleMemoire(nbCandidats: number): number {
  return Math.max(0, Math.min(5, nbCandidats - 1));
}

/**
 * Tire un rappel pour ce moment en évitant les derniers vus.
 * `dejaVus` : ids du plus ancien au plus récent. `aleatoire` : [0, 1[ (injecté pour les tests).
 * Tous récemment vus → le moins récemment vu. Aucun rappel pour ce moment → null.
 */
export function choisirRappel(
  rappels: readonly Rappel[],
  moment: MomentRappel,
  dejaVus: readonly string[],
  aleatoire: () => number = Math.random,
): Rappel | null {
  const candidats = rappels.filter((r) => r.moments.includes(moment));
  if (candidats.length === 0) return null;

  const k = tailleMemoire(candidats.length);
  const recents = new Set(k === 0 ? [] : dejaVus.slice(-k));
  const frais = candidats.filter((r) => !recents.has(r.id));

  if (frais.length === 0) {
    // Le moins récemment vu.
    const rang = (r: Rappel) => dejaVus.lastIndexOf(r.id);
    return [...candidats].sort((a, b) => rang(a) - rang(b))[0];
  }
  const i = Math.min(frais.length - 1, Math.floor(aleatoire() * frais.length));
  return frais[i];
}

/** Ajoute un id vu en fin de liste, sans doublon, en gardant les `max` derniers. */
export function noterVu(dejaVus: readonly string[], id: string, max = 20): string[] {
  return [...dejaVus.filter((v) => v !== id), id].slice(-max);
}
