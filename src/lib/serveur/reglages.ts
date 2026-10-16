// src/lib/serveur/reglages.ts
//
// LOI 11 — chiffres du règlement intérieur, stockés comme DONNÉES dans la
// table "Reglage" (clés « reglement:* », migrations 20261015140000 et
// 20261015150000), lus et écrits sous la forme attendue par le domaine
// (`ReglementCommande`, propriétaire `regles-metier`) + l'heure de fermeture
// (verifierHeureInventaire).
// Propriétaire de ce fichier : `base-donnees`.
//
// AUCUNE règle ici et AUCUNE valeur par défaut (seule exception :
// `taillesGateau`, décision du propriétaire du 15/10/2026) : une clé absente ou
// illisible lève une erreur (la base refuse déjà une valeur invalide —
// CHECK "Reglage_reglement_valide" — et leur suppression). Mieux vaut
// échouer que d'appliquer un acompte ou un horaire inventé.
// Les contrôles de format ci-dessous sont la COPIE côté code du CHECK de la
// base (même bornes) : l'écran des réglages reçoit un refus lisible avant
// d'atteindre la base.
// Pas d'import de Prisma : conversion pure testable avec `node --test`, le
// client est reçu en paramètre (`prisma` de src/lib/prisma.ts le satisfait).

import { JOURS_ISO_CLES, type JourIsoCle } from '../../domaine/constantes.ts';
import { signaler } from '../../domaine/messages.ts';
import { nomJourIso } from '../../domaine/reglement.ts';
import { succes, type Resultat } from '../../domaine/resultat.ts';

/** Clés lues (= données initiales des migrations). */
export const CLES_REGLEMENT = {
  acomptePourcentageMin: 'reglement:acompte_min_pourcent',
  heureFermeture: 'reglement:heure_fermeture',
  famillesPatisserie: 'reglement:familles_patisserie',
  retraitParJour: 'reglement:patisserie_retrait_par_jour',
  retraitExceptions: 'reglement:patisserie_retrait_exceptions',
  taillesGateau: 'reglement:tailles_gateau',
} as const;

/**
 * OBSOLÈTES (remplacées par retraitParJour, migration 20261015150000).
 * Lues seulement si `retraitParJour` manque (base pas encore migrée).
 * À supprimer en deux temps quand plus aucune base ne les porte seules.
 */
export const CLES_REGLEMENT_OBSOLETES = {
  retraitSemaine: 'reglement:patisserie_retrait_semaine',
  retraitWeekEnd: 'reglement:patisserie_retrait_week_end',
  joursWeekEndIso: 'reglement:jours_week_end_iso',
} as const;

const TOUTES_LES_CLES: string[] = [...Object.values(CLES_REGLEMENT), ...Object.values(CLES_REGLEMENT_OBSOLETES)];

/** Jours ISO « 1 » (lundi) … « 7 » (dimanche) : liste du domaine. */
export const JOURS_ISO = JOURS_ISO_CLES;
export type JourIso = JourIsoCle;

/** Une date exceptionnelle : première heure de retrait ce jour-là. */
export type ExceptionRetrait = { date: string /* AAAA-MM-JJ */; heure: string /* HH:MM */ };

export type HorairesRetraitLus = {
  /** Familles de vente (`Produit.famille`) soumises aux horaires. */
  familles: string[];
  /** Première heure de retrait par jour ISO (1 = lundi … 7 = dimanche). */
  parJour: Record<JourIso, string>;
  /** Dates exceptionnelles (une par date), triées par date. */
  exceptions: ExceptionRetrait[];
};

/** Forme renvoyée dans `reglement` (contrat avec regles-metier / commandes-traiteur). */
export type ReglementLu = {
  acomptePourcentageMin: number;
  horairesRetraitPatisserie: HorairesRetraitLus;
  /** Tailles standard d'un gâteau simple (parts), entiers 1..200 triés sans doublon. */
  taillesGateau: number[];
};

/** Ce que reçoit l'appelant : le règlement de commande et l'heure de fermeture. */
export type ReglagesReglement = {
  reglement: ReglementLu;
  /** « HH:MM » — inventaire « jamais avant » (AVERT_INVENTAIRE_AVANT_FERMETURE). */
  heureFermeture: string;
};

/** Forme d'une ligne Prisma `Reglage` (seuls les champs lus). */
export type LigneReglage = { cle: string; valeur: string };

/** Client minimal (lecture). */
export type LecteurReglages = {
  reglage: {
    findMany(args: {
      where: { cle: { in: string[] } };
      select: { cle: true; valeur: true };
    }): Promise<LigneReglage[]>;
  };
};

// ---------------------------------------------------------------------------
// Contrôles de format — miroir du CHECK "Reglage_reglement_valide"
// ---------------------------------------------------------------------------

/**
 * Tailles standard si `reglement:tailles_gateau` est ABSENT (base sans la
 * migration 20261015150000) — décision du propriétaire du 15/10/2026,
 * identique à la valeur initiale de la migration. Une valeur PRÉSENTE mais
 * invalide reste refusée.
 */
export const TAILLES_GATEAU_DEFAUT: readonly number[] = [4, 6, 8, 10, 15, 20, 25, 30];

/** Bornes des tailles de gâteau (identiques au CHECK de la base). */
export const TAILLE_GATEAU_MIN = 1;
export const TAILLE_GATEAU_MAX = 200;

const FORMAT_HEURE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const FORMAT_DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;

export function estHeure(v: unknown): v is string {
  return typeof v === 'string' && FORMAT_HEURE.test(v);
}

/** Date calendaire réelle « AAAA-MM-JJ » (refuse 2026-02-30). */
export function estDate(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = FORMAT_DATE.exec(v);
  if (!m) return false;
  const [a, mo, j] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || j < 1) return false;
  const d = new Date(Date.UTC(2000, mo - 1, j)); // année fixe d'abord, puis l'année réelle
  d.setUTCFullYear(a);
  return d.getUTCFullYear() === a && d.getUTCMonth() === mo - 1 && d.getUTCDate() === j;
}

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function memesCles(o: Record<string, unknown>, attendues: readonly string[]): boolean {
  const cles = Object.keys(o).sort();
  const voulues = [...attendues].sort();
  return cles.length === voulues.length && cles.every((c, i) => c === voulues[i]);
}

/** Raison du refus, ou null si la valeur est valide. */
type Controle = (v: unknown) => string | null;

const controlerPourcent: Controle = (v) =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100 ? null : 'entier de 0 à 100 attendu';

const controlerHeure: Controle = (v) => (estHeure(v) ? null : 'heure « HH:MM » attendue');

const controlerFamilles: Controle = (v) =>
  Array.isArray(v) && v.length > 0 && v.every((f) => typeof f === 'string' && f.trim().length > 0)
    ? null
    : 'liste de familles non vide attendue';

const controlerParJour: Controle = (v) =>
  estObjet(v) && memesCles(v, JOURS_ISO) && JOURS_ISO.every((j) => estHeure(v[j]))
    ? null
    : 'objet des jours "1" à "7" avec une heure « HH:MM » chacun attendu';

const controlerExceptions: Controle = (v) => {
  if (!Array.isArray(v)) return 'liste de dates exceptionnelles attendue';
  for (const e of v) {
    if (!estObjet(e) || !memesCles(e, ['date', 'heure']) || !estDate(e.date) || !estHeure(e.heure)) {
      return 'date « AAAA-MM-JJ » et heure « HH:MM » attendues';
    }
  }
  if (new Set(v.map((e) => (e as ExceptionRetrait).date)).size !== v.length) return 'une même date figure deux fois';
  return null;
};

const controlerTailles: Controle = (v) => {
  if (!Array.isArray(v) || v.length === 0) return 'liste de tailles non vide attendue';
  let precedent = 0;
  for (const t of v) {
    if (typeof t !== 'number' || !Number.isInteger(t) || t < TAILLE_GATEAU_MIN || t > TAILLE_GATEAU_MAX) {
      return `entiers de ${TAILLE_GATEAU_MIN} à ${TAILLE_GATEAU_MAX} attendus`;
    }
    if (t <= precedent) return 'tailles croissantes sans doublon attendues';
    precedent = t;
  }
  return null;
};

const controlerJoursWeekEnd: Controle = (v) =>
  Array.isArray(v) && v.every((j) => Number.isInteger(j) && j >= 1 && j <= 7) && new Set(v).size === v.length
    ? null
    : 'liste de jours 1 à 7 sans doublon attendue';

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

function erreur(cle: string, raison: string): Error {
  return new Error(`Reglage ${cle} : ${raison}.`);
}

function lireJson(valeurs: Map<string, string>, cle: string): unknown {
  const brut = valeurs.get(cle);
  if (brut === undefined) throw erreur(cle, 'absent');
  try {
    return JSON.parse(brut);
  } catch {
    throw erreur(cle, 'illisible');
  }
}

function lireControle<T>(valeurs: Map<string, string>, cle: string, controle: Controle): T {
  const v = lireJson(valeurs, cle);
  const raison = controle(v);
  if (raison) throw erreur(cle, raison);
  return v as T;
}

function trierExceptions(e: readonly ExceptionRetrait[]): ExceptionRetrait[] {
  return [...e].map(({ date, heure }) => ({ date, heure })).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Compatibilité : « par jour » reconstruit depuis semaine / week-end / jours de week-end. */
function parJourDepuisAnciennes(valeurs: Map<string, string>): Record<JourIso, string> {
  const o = CLES_REGLEMENT_OBSOLETES;
  const semaine = lireControle<string>(valeurs, o.retraitSemaine, controlerHeure);
  const weekEnd = lireControle<string>(valeurs, o.retraitWeekEnd, controlerHeure);
  const jours = lireControle<number[]>(valeurs, o.joursWeekEndIso, controlerJoursWeekEnd);
  return Object.fromEntries(JOURS_ISO.map((j) => [j, jours.includes(Number(j)) ? weekEnd : semaine])) as Record<
    JourIso,
    string
  >;
}

/**
 * Conversion pure lignes "Reglage" → données du domaine.
 * Lève si une clé manque ou si une valeur est hors format.
 * Si `patisserie_retrait_par_jour` manque mais que les anciennes clés sont
 * là (base sans la migration 20261015150000), « par jour » en est déduit et
 * les exceptions valent [] (elles n'existaient pas).
 */
export function versReglages(lignes: readonly LigneReglage[]): ReglagesReglement {
  const valeurs = new Map(lignes.map((l) => [l.cle, l.valeur]));
  const c = CLES_REGLEMENT;

  const nouvelleForme = valeurs.has(c.retraitParJour);
  const parJour = nouvelleForme
    ? lireControle<Record<JourIso, string>>(valeurs, c.retraitParJour, controlerParJour)
    : parJourDepuisAnciennes(valeurs);
  const exceptions =
    nouvelleForme || valeurs.has(c.retraitExceptions)
      ? lireControle<ExceptionRetrait[]>(valeurs, c.retraitExceptions, controlerExceptions)
      : [];

  return {
    reglement: {
      acomptePourcentageMin: lireControle<number>(valeurs, c.acomptePourcentageMin, controlerPourcent),
      horairesRetraitPatisserie: {
        familles: lireControle<string[]>(valeurs, c.famillesPatisserie, controlerFamilles),
        parJour: Object.fromEntries(JOURS_ISO.map((j) => [j, parJour[j]])) as Record<JourIso, string>,
        exceptions: trierExceptions(exceptions),
      },
      taillesGateau: valeurs.has(c.taillesGateau)
        ? lireControle<number[]>(valeurs, c.taillesGateau, controlerTailles)
        : [...TAILLES_GATEAU_DEFAUT],
    },
    heureFermeture: lireControle<string>(valeurs, c.heureFermeture, controlerHeure),
  };
}

/** Lit les réglages du règlement (une requête). */
export async function lireReglages(client: LecteurReglages): Promise<ReglagesReglement> {
  const lignes = await client.reglage.findMany({
    where: { cle: { in: TOUTES_LES_CLES } },
    select: { cle: true, valeur: true },
  });
  return versReglages(lignes);
}

// ---------------------------------------------------------------------------
// Écriture validée (écran des réglages du gérant)
// ---------------------------------------------------------------------------

/** Ce que l'écran des réglages peut modifier ; chaque champ absent est laissé tel quel. */
export type ReglagesPartiels = {
  acomptePourcentageMin?: number;
  heureFermeture?: string;
  famillesPatisserie?: string[];
  /** Les sept jours, ou seulement ceux qui changent (fusionnés avec la valeur en base). */
  retraitParJour?: Partial<Record<JourIso, string>>;
  /** Liste COMPLÈTE des dates exceptionnelles (remplace l'ancienne). */
  retraitExceptions?: ExceptionRetrait[];
  /** Liste complète des tailles ; triée à l'écriture. */
  taillesGateau?: number[];
};

type Upsert = {
  where: { cle: string };
  create: { cle: string; valeur: string };
  update: { valeur: string };
};

/** Client minimal (écriture) : `prisma` de src/lib/prisma.ts le satisfait. */
export type EcrivainReglages = LecteurReglages & {
  reglage: LecteurReglages['reglage'] & { upsert(args: Upsert): PromiseLike<unknown> };
  $transaction(operations: PromiseLike<unknown>[]): PromiseLike<unknown>;
};

const CHAMPS: Record<keyof ReglagesPartiels, { cle: string; libelle: string; controle: Controle }> = {
  acomptePourcentageMin: { cle: CLES_REGLEMENT.acomptePourcentageMin, libelle: 'acompte minimum (%)', controle: controlerPourcent },
  heureFermeture: { cle: CLES_REGLEMENT.heureFermeture, libelle: 'heure de fermeture', controle: controlerHeure },
  famillesPatisserie: { cle: CLES_REGLEMENT.famillesPatisserie, libelle: 'familles soumises aux horaires', controle: controlerFamilles },
  retraitParJour: { cle: CLES_REGLEMENT.retraitParJour, libelle: 'horaires de retrait par jour', controle: controlerParJour },
  retraitExceptions: { cle: CLES_REGLEMENT.retraitExceptions, libelle: 'dates exceptionnelles', controle: controlerExceptions },
  taillesGateau: { cle: CLES_REGLEMENT.taillesGateau, libelle: 'tailles de gâteau', controle: controlerTailles },
};

/**
 * Prépare les valeurs JSON à écrire (pure). `actuel` = réglages lus en base,
 * pour fusionner un « par jour » partiel. Refus : ERR_SAISIE_INVALIDE avec le
 * champ fautif (même contrôle que le CHECK de la base).
 */
export function preparerEcriture(
  partiel: ReglagesPartiels,
  actuel: ReglagesReglement,
): Resultat<{ cle: string; valeur: string }[]> {
  const ecritures: { cle: string; valeur: string }[] = [];
  for (const champ of Object.keys(partiel) as (keyof ReglagesPartiels)[]) {
    if (!Object.prototype.hasOwnProperty.call(CHAMPS, champ)) {
      return signaler('ERR_SAISIE_INVALIDE', {}, { champ: String(champ) });
    }
    let valeur: unknown = partiel[champ];
    if (valeur === undefined) continue;
    const { cle, libelle, controle } = CHAMPS[champ];

    if (champ === 'retraitParJour') {
      if (!estObjet(valeur)) return signaler('ERR_SAISIE_INVALIDE', { champLibelle: libelle }, { champ });
      const fusion: Record<string, unknown> = { ...actuel.reglement.horairesRetraitPatisserie.parJour, ...valeur };
      for (const j of Object.keys(fusion)) {
        if (!(JOURS_ISO as readonly string[]).includes(j) || !estHeure(fusion[j])) {
          const nom = (JOURS_ISO as readonly string[]).includes(j) ? nomJourIso(j as JourIso) : undefined;
          return signaler(
            'ERR_SAISIE_INVALIDE',
            { champLibelle: nom ? `heure de retrait du ${nom}` : libelle },
            { champ: nom ? `retraitParJour.${j}` : champ },
          );
        }
      }
      valeur = Object.fromEntries(JOURS_ISO.map((j) => [j, fusion[j]]));
    } else if (champ === 'retraitExceptions' && Array.isArray(valeur)) {
      if (controle(valeur) === null) valeur = trierExceptions(valeur as ExceptionRetrait[]);
    } else if (champ === 'taillesGateau' && Array.isArray(valeur)) {
      valeur = [...valeur].sort((a, b) => Number(a) - Number(b));
    }

    if (controle(valeur) !== null) return signaler('ERR_SAISIE_INVALIDE', { champLibelle: libelle }, { champ });
    ecritures.push({ cle, valeur: JSON.stringify(valeur) });
  }
  return succes(ecritures);
}

/**
 * Écrit les réglages modifiés en UNE transaction, puis renvoie les réglages
 * relus. Refus de saisie → `Echec` (ERR_SAISIE_INVALIDE, 422 via
 * reponseEchec) sans rien écrire. Une erreur de la base (refus du CHECK si
 * le code et la base divergent, panne) est LEVÉE : la route la passe à
 * traiterErreur.
 */
export async function ecrireReglages(
  client: EcrivainReglages,
  partiel: ReglagesPartiels,
): Promise<Resultat<ReglagesReglement>> {
  const actuel = await lireReglages(client);
  const prep = preparerEcriture(partiel, actuel);
  if (!prep.ok) return prep;
  if (prep.donnees.length > 0) {
    await client.$transaction(
      prep.donnees.map(({ cle, valeur }) =>
        client.reglage.upsert({ where: { cle }, create: { cle, valeur }, update: { valeur } }),
      ),
    );
  }
  return succes(await lireReglages(client));
}
