// src/domaine/resultat.ts
//
// Contrat d'erreur unique de l'application (CLAUDE.md, LOI N°8 et N°9).
// Propriétaire : agent `gestion-erreurs`.
//
// Un seul type traverse domaine → route API → client → écran. Fonctions pures,
// aucune dépendance (ni React, ni Next, ni Prisma).
//
// Choix de modélisation (LOI 8) :
//   - seul un BLOQUANT refuse la saisie → { ok: false, niveau: "bloquant", … }
//   - un AVERTISSEMENT ou une INFORMATION n'empêche rien : la saisie est
//     acceptée → { ok: true, donnees, signalements: [ … ] }
// Un avertissement ne peut donc jamais, par erreur de typage, bloquer une vente.

// ---------------------------------------------------------------------------
// Niveaux et codes
// ---------------------------------------------------------------------------

export type Niveau = 'bloquant' | 'avertissement' | 'information';

/** Codes typés : le préfixe porte le niveau. */
export type CodeBloquant = `ERR_${string}`;
export type CodeAvertissement = `AVERT_${string}`;
export type CodeInformation = `INFO_${string}`;
export type Code = CodeBloquant | CodeAvertissement | CodeInformation;

/** Champs communs à tout signalement, au format de la LOI 9. */
type Base = {
  /** Message en français, destiné à l'employé, qui dit QUOI FAIRE. */
  message: string;
  /** Nom de l'input fautif, pour le pointer à l'écran. */
  champ?: string;
  /** Valeur de sortie (« Passer à 20 parts » → 20). Fournie par la règle. */
  valeurProposee?: unknown;
};

export type Echec = Base & { ok: false; niveau: 'bloquant'; code: CodeBloquant };
export type Avertissement = Base & { niveau: 'avertissement'; code: CodeAvertissement };
export type Information = Base & { niveau: 'information'; code: CodeInformation };

/** Signalement non bloquant, transporté à côté d'un succès. */
export type Signalement = Avertissement | Information;

export type Succes<T> = { ok: true; donnees: T; signalements: Signalement[] };

export type Resultat<T> = Succes<T> | Echec;

/** Options communes aux constructeurs. */
export type Options = { champ?: string; valeurProposee?: unknown };

// ---------------------------------------------------------------------------
// Constructeurs
// ---------------------------------------------------------------------------

function avecOptions<B extends object>(base: B, options?: Options): B & Options {
  const r: B & Options = { ...base };
  if (options?.champ !== undefined) r.champ = options.champ;
  if (options?.valeurProposee !== undefined) r.valeurProposee = options.valeurProposee;
  return r;
}

/** Refus de la saisie. Toujours accompagné, si possible, d'une `valeurProposee`. */
export function bloquant(code: CodeBloquant, message: string, options?: Options): Echec {
  return avecOptions({ ok: false as const, niveau: 'bloquant' as const, code, message }, options);
}

/** Saisie acceptée mais signalée et tracée. */
export function avertir(code: CodeAvertissement, message: string, options?: Options): Avertissement {
  return avecOptions({ niveau: 'avertissement' as const, code, message }, options);
}

/** Affiché sans friction. */
export function informer(code: CodeInformation, message: string, options?: Options): Information {
  return avecOptions({ niveau: 'information' as const, code, message }, options);
}

/** Saisie acceptée, éventuellement accompagnée d'avertissements/informations. */
export function succes<T>(donnees: T, ...signalements: Signalement[]): Succes<T> {
  return { ok: true, donnees, signalements: dedoublonner(signalements) };
}

// ---------------------------------------------------------------------------
// Gardes
// ---------------------------------------------------------------------------

export function estEchec<T>(r: Resultat<T>): r is Echec {
  return r.ok === false;
}

export function estSucces<T>(r: Resultat<T>): r is Succes<T> {
  return r.ok === true;
}

/** Retrouve le niveau d'après le préfixe du code. */
export function niveauDuCode(code: Code): Niveau {
  if (code.startsWith('ERR_')) return 'bloquant';
  if (code.startsWith('AVERT_')) return 'avertissement';
  return 'information';
}

// ---------------------------------------------------------------------------
// Combinaison
// ---------------------------------------------------------------------------

function cle(s: { code: string; champ?: string }): string {
  return `${s.code}|${s.champ ?? ''}`;
}

function dedoublonner(signalements: Signalement[]): Signalement[] {
  const vus = new Set<string>();
  const sortie: Signalement[] = [];
  for (const s of signalements) {
    const k = cle(s);
    if (vus.has(k)) continue;
    vus.add(k);
    sortie.push(s);
  }
  return sortie;
}

/** Tous les blocages d'une liste de résultats, dans l'ordre, sans doublon. */
export function listerBlocages(resultats: readonly Resultat<unknown>[]): Echec[] {
  const vus = new Set<string>();
  const sortie: Echec[] = [];
  for (const r of resultats) {
    if (r.ok) continue;
    const k = cle(r);
    if (vus.has(k)) continue;
    vus.add(k);
    sortie.push(r);
  }
  return sortie;
}

/**
 * Combine plusieurs validations (ex. date + quantité + prix d'une ligne).
 * - Au moins un bloquant → renvoie le PREMIER (l'ordre des validations = ordre
 *   des champs à l'écran). `listerBlocages` donne la liste complète.
 * - Sinon → succès avec le tableau des données et TOUS les signalements
 *   (dédoublonnés par code + champ).
 */
export function combiner<T extends readonly Resultat<unknown>[]>(
  ...resultats: T
): Resultat<{ [K in keyof T]: T[K] extends Resultat<infer D> ? D : never }> {
  const signalements: Signalement[] = [];
  const donnees: unknown[] = [];
  for (const r of resultats) {
    if (!r.ok) return r;
    donnees.push(r.donnees);
    signalements.push(...r.signalements);
  }
  return succes(
    donnees as { [K in keyof T]: T[K] extends Resultat<infer D> ? D : never },
    ...signalements,
  );
}

/** Enchaîne une étape qui dépend de la précédente, en conservant les signalements. */
export function enchainer<A, B>(r: Resultat<A>, suite: (a: A) => Resultat<B>): Resultat<B> {
  if (!r.ok) return r;
  const s = suite(r.donnees);
  if (!s.ok) return s;
  return succes(s.donnees, ...r.signalements, ...s.signalements);
}

// ---------------------------------------------------------------------------
// Sortie vers le client
// ---------------------------------------------------------------------------

/**
 * Ne garde que les champs du contrat. Défense en profondeur : si un appelant a
 * glissé un objet d'erreur, une trace ou une donnée technique dans un échec,
 * elle ne part jamais vers le navigateur.
 */
export function pourClient(e: Echec): Echec {
  const propre: Echec = { ok: false, niveau: 'bloquant', code: e.code, message: e.message };
  if (e.champ !== undefined) propre.champ = e.champ;
  if (e.valeurProposee !== undefined) propre.valeurProposee = e.valeurProposee;
  return propre;
}
