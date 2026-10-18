// src/lib/serveur/reglages.ts
//
// LOI 11 — chiffres du règlement intérieur, stockés comme DONNÉES dans la
// table "Reglage" (clés « reglement:* », migrations 20261015140000,
// 20261015150000 et 20261018100000), lus et écrits sous la forme attendue par
// le domaine (`ReglementCommande`, propriétaire `regles-metier`) + le délai
// d'un gâteau à étages (`DelaisCommande.gateauAEtages`).
// Propriétaire de ce fichier : `base-donnees`.
//
// AUCUNE règle ici. Valeur par défaut seulement pour une clé ABSENTE (base pas
// encore migrée) et seulement quand le propriétaire a tranché : tailles des
// gâteaux (15/10/2026), heures d'ouverture 06:00–20:00 et délai d'un gâteau à
// étages 0 (18/10/2026). L'acompte minimum absent lève une erreur.
// Une valeur PRÉSENTE mais illisible lève toujours une erreur (la base refuse
// déjà une valeur invalide — CHECK "Reglage_reglement_valide" — et leur
// suppression) : mieux vaut échouer que d'appliquer un horaire inventé.
// Les contrôles de format ci-dessous sont la COPIE côté code du CHECK de la
// base (mêmes bornes) : l'écran des réglages reçoit un refus lisible avant
// d'atteindre la base.
// Pas d'import de Prisma : conversion pure testable avec `node --test`, le
// client est reçu en paramètre (`prisma` de src/lib/prisma.ts le satisfait).

import {
  DELAI_GATEAU_ETAGES_MAX,
  DELAI_GATEAU_ETAGES_MIN,
  DELAIS_PAR_DEFAUT,
  JOURS_ISO_CLES,
  REGLEMENT_COMMANDE,
  type ExceptionOuverture,
  type HorairesOuverture,
  type JourIsoCle,
  type PlageOuverture,
} from '../../domaine/constantes.ts';
import { signaler } from '../../domaine/messages.ts';
import { estPlageOuverture, nomJourIso } from '../../domaine/reglement.ts';
import { succes, type Resultat } from '../../domaine/resultat.ts';

/** Clés lues (= données initiales des migrations). */
export const CLES_REGLEMENT = {
  acomptePourcentageMin: 'reglement:acompte_min_pourcent',
  ouvertureParJour: 'reglement:ouverture_par_jour',
  ouvertureExceptions: 'reglement:ouverture_exceptions',
  taillesGateau: 'reglement:tailles_gateau',
  delaiGateauEtagesJours: 'reglement:delai_gateau_etages_jours',
} as const;

const TOUTES_LES_CLES: string[] = Object.values(CLES_REGLEMENT);

/** Jours ISO « 1 » (lundi) … « 7 » (dimanche) : liste du domaine. */
export const JOURS_ISO = JOURS_ISO_CLES;
export type JourIso = JourIsoCle;

export type { ExceptionOuverture, PlageOuverture };

/** Forme renvoyée dans `reglement` (contrat avec regles-metier / commandes-traiteur). */
export type ReglementLu = {
  acomptePourcentageMin: number;
  /** Heures d'ouverture par jour ISO + dates exceptionnelles (une par date, triées). */
  horairesOuverture: HorairesOuverture;
  /** Tailles standard d'un gâteau simple (parts), entiers 1..200 triés sans doublon. */
  taillesGateau: number[];
};

/** Ce que reçoit l'appelant : le règlement de commande et le délai d'un gâteau à étages. */
export type ReglagesReglement = {
  reglement: ReglementLu;
  /** Jours ouvrés minimum avant le retrait d'un gâteau à étages (0 = aucun délai). */
  delaiGateauEtagesJours: number;
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
// Valeurs si la clé est ABSENTE (décisions du propriétaire)
// ---------------------------------------------------------------------------

/**
 * Tailles standard si `reglement:tailles_gateau` est ABSENT — décision du
 * propriétaire du 15/10/2026, identique à la valeur initiale de la migration.
 */
export const TAILLES_GATEAU_DEFAUT: readonly number[] = REGLEMENT_COMMANDE.taillesGateau;

/** Heures d'ouverture si les clés sont ABSENTES — décision du propriétaire du 18/10/2026. */
export const HORAIRES_OUVERTURE_DEFAUT: HorairesOuverture = REGLEMENT_COMMANDE.horairesOuverture;

/** Délai d'un gâteau à étages si la clé est ABSENTE — décision du propriétaire du 18/10/2026. */
export const DELAI_GATEAU_ETAGES_DEFAUT: number = DELAIS_PAR_DEFAUT.gateauAEtages;

// ---------------------------------------------------------------------------
// Contrôles de format — miroir du CHECK "Reglage_reglement_valide"
// ---------------------------------------------------------------------------

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

/** Plage « HH:MM » stricte, exactement { ouverture, fermeture }, ouverture avant fermeture. */
function estPlage(v: unknown): v is PlageOuverture {
  return (
    estObjet(v) &&
    memesCles(v, ['ouverture', 'fermeture']) &&
    estHeure(v.ouverture) &&
    estHeure(v.fermeture) &&
    estPlageOuverture(v)
  );
}

/** Raison du refus, ou null si la valeur est valide. */
type Controle = (v: unknown) => string | null;

const controlerPourcent: Controle = (v) =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100 ? null : 'entier de 0 à 100 attendu';

const controlerParJour: Controle = (v) =>
  estObjet(v) && memesCles(v, JOURS_ISO) && JOURS_ISO.every((j) => estPlage(v[j]))
    ? null
    : 'objet des jours "1" à "7" avec { ouverture, fermeture } « HH:MM » (ouverture avant fermeture) attendu';

const controlerExceptions: Controle = (v) => {
  if (!Array.isArray(v)) return 'liste de dates exceptionnelles attendue';
  for (const e of v) {
    if (!estObjet(e) || !memesCles(e, ['date', 'ouverture', 'fermeture']) || !estDate(e.date)) {
      return 'date « AAAA-MM-JJ », ouverture et fermeture « HH:MM » attendues';
    }
    if (!estPlage({ ouverture: e.ouverture, fermeture: e.fermeture })) {
      return 'ouverture « HH:MM » avant fermeture « HH:MM » attendue';
    }
  }
  if (new Set(v.map((e) => (e as ExceptionOuverture).date)).size !== v.length) return 'une même date figure deux fois';
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

const controlerDelai: Controle = (v) =>
  typeof v === 'number' && Number.isInteger(v) && v >= DELAI_GATEAU_ETAGES_MIN && v <= DELAI_GATEAU_ETAGES_MAX
    ? null
    : `entier de ${DELAI_GATEAU_ETAGES_MIN} à ${DELAI_GATEAU_ETAGES_MAX} attendu`;

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

/** Lit la clé si elle est présente (contrôlée), sinon la valeur du propriétaire. */
function lireOuDefaut<T>(valeurs: Map<string, string>, cle: string, controle: Controle, defaut: () => T): T {
  return valeurs.has(cle) ? lireControle<T>(valeurs, cle, controle) : defaut();
}

function copierPlage(p: PlageOuverture): PlageOuverture {
  return { ouverture: p.ouverture, fermeture: p.fermeture };
}

function trierExceptions(e: readonly ExceptionOuverture[]): ExceptionOuverture[] {
  return [...e]
    .map(({ date, ouverture, fermeture }) => ({ date, ouverture, fermeture }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function parJourOrdonne(parJour: Record<string, PlageOuverture>): Record<JourIso, PlageOuverture> {
  return Object.fromEntries(JOURS_ISO.map((j) => [j, copierPlage(parJour[j])])) as Record<JourIso, PlageOuverture>;
}

/**
 * Conversion pure lignes "Reglage" → données du domaine.
 * Lève si l'acompte manque ou si une valeur présente est hors format.
 */
export function versReglages(lignes: readonly LigneReglage[]): ReglagesReglement {
  const valeurs = new Map(lignes.map((l) => [l.cle, l.valeur]));
  const c = CLES_REGLEMENT;
  const parJour = lireOuDefaut<Record<string, PlageOuverture>>(
    valeurs,
    c.ouvertureParJour,
    controlerParJour,
    () => HORAIRES_OUVERTURE_DEFAUT.parJour,
  );
  const exceptions = lireOuDefaut<ExceptionOuverture[]>(
    valeurs,
    c.ouvertureExceptions,
    controlerExceptions,
    () => HORAIRES_OUVERTURE_DEFAUT.exceptions,
  );
  return {
    reglement: {
      acomptePourcentageMin: lireControle<number>(valeurs, c.acomptePourcentageMin, controlerPourcent),
      horairesOuverture: { parJour: parJourOrdonne(parJour), exceptions: trierExceptions(exceptions) },
      taillesGateau: [...lireOuDefaut<readonly number[]>(valeurs, c.taillesGateau, controlerTailles, () => TAILLES_GATEAU_DEFAUT)],
    },
    delaiGateauEtagesJours: lireOuDefaut<number>(
      valeurs,
      c.delaiGateauEtagesJours,
      controlerDelai,
      () => DELAI_GATEAU_ETAGES_DEFAUT,
    ),
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
  /** Les sept jours, ou seulement ceux qui changent (fusionnés avec la valeur en base). */
  ouvertureParJour?: Partial<Record<JourIso, PlageOuverture>>;
  /** Liste COMPLÈTE des dates exceptionnelles (remplace l'ancienne). */
  ouvertureExceptions?: ExceptionOuverture[];
  /** Liste complète des tailles ; triée à l'écriture. */
  taillesGateau?: number[];
  /** Jours ouvrés minimum avant le retrait d'un gâteau à étages (0 = aucun). */
  delaiGateauEtagesJours?: number;
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
  ouvertureParJour: { cle: CLES_REGLEMENT.ouvertureParJour, libelle: 'heures d’ouverture par jour', controle: controlerParJour },
  ouvertureExceptions: { cle: CLES_REGLEMENT.ouvertureExceptions, libelle: 'dates exceptionnelles', controle: controlerExceptions },
  taillesGateau: { cle: CLES_REGLEMENT.taillesGateau, libelle: 'tailles de gâteau', controle: controlerTailles },
  delaiGateauEtagesJours: {
    cle: CLES_REGLEMENT.delaiGateauEtagesJours,
    libelle: 'délai d’un gâteau à étages (jours)',
    controle: controlerDelai,
  },
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

    if (champ === 'ouvertureParJour') {
      if (!estObjet(valeur)) return signaler('ERR_SAISIE_INVALIDE', { champLibelle: libelle }, { champ });
      const fusion: Record<string, unknown> = { ...actuel.reglement.horairesOuverture.parJour, ...valeur };
      for (const j of Object.keys(fusion)) {
        if (!(JOURS_ISO as readonly string[]).includes(j) || !estPlage(fusion[j])) {
          const nom = (JOURS_ISO as readonly string[]).includes(j) ? nomJourIso(j as JourIso) : undefined;
          return signaler(
            'ERR_SAISIE_INVALIDE',
            { champLibelle: nom ? `heures d’ouverture du ${nom}` : libelle },
            { champ: nom ? `ouvertureParJour.${j}` : champ },
          );
        }
      }
      valeur = parJourOrdonne(fusion as Record<string, PlageOuverture>);
    } else if (champ === 'ouvertureExceptions' && Array.isArray(valeur)) {
      if (controle(valeur) === null) valeur = trierExceptions(valeur as ExceptionOuverture[]);
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
