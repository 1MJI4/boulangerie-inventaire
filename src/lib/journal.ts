// src/lib/journal.ts
//
// Journalisation SERVEUR. Propriétaire : agent `gestion-erreurs`.
//
// Objectif : pouvoir répondre à « l'application a bugué hier vers 15 h » sans
// deviner — et sans jamais écrire de donnée client (nom, téléphone, e-mail,
// adresse) ni de secret dans un journal (audit sécurité M3).
//
// Les erreurs Prisma embarquent les VALEURS de la requête dans leur message
// (« Invalid `prisma.commande.create()` invocation: { data: { nomClient: … } } »).
// On n'en garde donc que le nom, le code Pxxxx et les métadonnées structurelles.
//
// Aucun import de Prisma ni de Next : module testable avec `node --test`.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NiveauJournal = 'erreur' | 'avertissement' | 'info';

export type EntreeJournal = {
  niveau: NiveauJournal;
  /** Code typé (ERR_*, AVERT_*, INFO_*). */
  code: string;
  /** Ex. « POST /api/commandes ». */
  route?: string;
  /** Référence courte affichée à l'employé, pour retrouver la ligne. */
  reference?: string;
  /** Identifiant (jamais le nom) de l'utilisateur ou du profil. */
  utilisateur?: string;
  /** Identifiant du poste / appareil. */
  appareil?: string;
  /** Piste de résolution pour l'administrateur (jamais renvoyée au client). */
  piste?: string;
  /** Détail technique : erreur, contexte… Filtré avant écriture. */
  detail?: unknown;
};

export type LigneJournal = Omit<EntreeJournal, 'detail'> & { horodatage: string; detail?: unknown };

type Destination = (ligne: LigneJournal) => void;

// ---------------------------------------------------------------------------
// Filtrage des données personnelles et des secrets
// ---------------------------------------------------------------------------

export const MASQUE = '[masqué]';

/**
 * Clés dont la VALEUR n'est jamais écrite. Comparaison sans accents, sans
 * casse, sur des fragments (« nomClient », « telephone_client », « clientEmail »…).
 */
const FRAGMENTS_SENSIBLES = [
  'nom', 'prenom', 'client', 'telephone', 'tel', 'phone', 'gsm', 'mobile',
  'mail', 'adresse', 'address', 'rue', 'note', 'commentaire', 'remarque',
  'message', 'texte', 'ecriture', 'inscription',
  'password', 'motdepasse', 'mdp', 'secret', 'token', 'jeton', 'cookie',
  'authorization', 'session', 'apikey', 'database', 'url', 'dsn',
  'code',
];

/** Clés techniques autorisées malgré un fragment ci-dessus. */
const CLES_AUTORISEES = new Set([
  'code', 'codeerreur', 'name', 'nom_erreur', 'modelname', 'clientversion',
  'reference', 'route', 'target', 'field_name', 'champ',
]);

function normaliser(cle: string): string {
  return cle.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function cleSensible(cle: string): boolean {
  const n = normaliser(cle);
  if (CLES_AUTORISEES.has(n)) return false;
  const compacte = n.replace(/[^a-z]/g, '');
  return FRAGMENTS_SENSIBLES.some((f) => compacte.includes(f));
}

const MOTIFS_TEXTE: [RegExp, string][] = [
  // Chaînes de connexion (postgres://user:mdp@hote:port/base…). Les chemins
  // `file://` des traces de pile ne portent ni identifiant ni secret : gardés.
  [/\b(?!file:)[a-z][a-z0-9+.-]*:\/\/[^\s'"`]+/gi, '[url masquée]'],
  // Adresses e-mail. Le domaine ne contient ni « / » ni « _ » : un chemin de
  // pile (« …/.pnpm/next@16.0.11_react-dom@19.2.8/node_modules/…/x.js ») n'est
  // pas une adresse. Une vraie adresse, même collée à un chemin, reste masquée.
  [/[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi, '[e-mail masqué]'],
  // Numéros de téléphone : commence par +, 00 ou 0, au moins 9 chiffres
  // (une date jj/mm/aaaa n'en a que 8 et n'est donc pas masquée).
  [/(?:\+|\b0)\d(?:[\s./-]?\d){7,}/g, '[numéro masqué]'],
  // Contenu entre guillemets : dans un message Prisma, ce sont des valeurs saisies
  [/"(?:[^"\\]|\\.)*"/g, '"…"'],
  [/'(?:[^'\\]|\\.)*'/g, "'…'"],
];

const LONGUEUR_MAX = 300;

/** Retire d'un texte libre tout ce qui ressemble à une donnée personnelle ou un secret. */
export function nettoyerTexte(texte: string): string {
  let t = texte;
  for (const [motif, remplacement] of MOTIFS_TEXTE) t = t.replace(motif, remplacement);
  return t.length > LONGUEUR_MAX ? `${t.slice(0, LONGUEUR_MAX)}…` : t;
}

function estErreurPrisma(e: { name?: unknown; code?: unknown }): boolean {
  return (
    (typeof e.name === 'string' && e.name.startsWith('Prisma')) ||
    (typeof e.code === 'string' && /^P\d{4}$/.test(e.code))
  );
}

function premieresLignesDePile(pile: unknown): string[] | undefined {
  if (typeof pile !== 'string') return undefined;
  // Seules les lignes « at … » : la première ligne d'une pile répète le message.
  return pile
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('at '))
    .slice(0, 5)
    .map(nettoyerTexte);
}

/** Réduit une erreur à ce qui est utile au diagnostic, sans aucune valeur saisie. */
function resumerErreur(e: Error & { code?: unknown; meta?: unknown; clientVersion?: unknown }, profondeur: number) {
  if (estErreurPrisma(e)) {
    const meta = e.meta && typeof e.meta === 'object' ? (e.meta as Record<string, unknown>) : undefined;
    return {
      name: e.name,
      code: typeof e.code === 'string' ? e.code : undefined,
      clientVersion: typeof e.clientVersion === 'string' ? e.clientVersion : undefined,
      // Métadonnées STRUCTURELLES uniquement (nom de modèle, colonnes visées).
      meta: meta
        ? nettoyer(
            {
              modelName: meta.modelName,
              target: meta.target,
              field_name: meta.field_name,
            },
            profondeur + 1,
          )
        : undefined,
      // Le message Prisma n'est JAMAIS recopié : il contient les valeurs.
      pile: premieresLignesDePile(e.stack),
    };
  }
  return {
    name: e.name,
    code: typeof e.code === 'string' || typeof e.code === 'number' ? e.code : undefined,
    message: nettoyerTexte(e.message ?? ''),
    pile: premieresLignesDePile(e.stack),
    cause: e.cause !== undefined ? nettoyer(e.cause, profondeur + 1) : undefined,
  };
}

const PROFONDEUR_MAX = 5;

/** Copie filtrée, sûre à écrire dans un journal. Ne modifie pas l'original. */
export function nettoyer(valeur: unknown, profondeur = 0): unknown {
  if (profondeur > PROFONDEUR_MAX) return '[…]';
  if (valeur === null || valeur === undefined) return valeur;
  if (typeof valeur === 'string') return nettoyerTexte(valeur);
  if (typeof valeur === 'number' || typeof valeur === 'boolean') return valeur;
  if (typeof valeur === 'bigint') return valeur.toString();
  if (typeof valeur === 'function' || typeof valeur === 'symbol') return undefined;
  if (valeur instanceof Date) return valeur.toISOString();
  if (valeur instanceof Error) return resumerErreur(valeur, profondeur);
  if (Array.isArray(valeur)) return valeur.slice(0, 20).map((v) => nettoyer(v, profondeur + 1));
  if (typeof valeur === 'object') {
    const sortie: Record<string, unknown> = {};
    for (const [cle, v] of Object.entries(valeur as Record<string, unknown>)) {
      sortie[cle] = cleSensible(cle) ? MASQUE : nettoyer(v, profondeur + 1);
    }
    return sortie;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Référence courte
// ---------------------------------------------------------------------------

// Sans 0/O, 1/I/L : lisible au téléphone.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Référence courte de type « K7Q-3MD », à citer au téléphone. */
export function nouvelleReference(): string {
  const octets = new Uint8Array(6);
  globalThis.crypto.getRandomValues(octets);
  const c = Array.from(octets, (o) => ALPHABET[o % ALPHABET.length]).join('');
  return `${c.slice(0, 3)}-${c.slice(3)}`;
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

/** Par défaut : une ligne JSON sur la sortie d'erreur (journaux de fonctions de l'hébergeur). */
const destinationConsole: Destination = (ligne) => {
  const texte = JSON.stringify(ligne);
  if (ligne.niveau === 'erreur') console.error(texte);
  else if (ligne.niveau === 'avertissement') console.warn(texte);
  else console.info(texte);
};

let destination: Destination = destinationConsole;

/**
 * Remplace la destination (tests, ou future table `JournalErreur` côté base).
 * Renvoie une fonction qui rétablit la destination précédente.
 */
export function definirDestination(d: Destination): () => void {
  const precedente = destination;
  destination = d;
  return () => {
    destination = precedente;
  };
}

/**
 * Écrit une ligne filtrée. Ne lève jamais : un journal en panne ne doit pas
 * transformer une erreur gérée en plantage.
 */
export function journaliser(entree: EntreeJournal): LigneJournal {
  const ligne: LigneJournal = {
    horodatage: new Date().toISOString(),
    niveau: entree.niveau,
    code: entree.code,
  };
  if (entree.route) ligne.route = nettoyerTexte(entree.route);
  if (entree.reference) ligne.reference = entree.reference;
  if (entree.utilisateur) ligne.utilisateur = nettoyerTexte(entree.utilisateur);
  if (entree.appareil) ligne.appareil = nettoyerTexte(entree.appareil);
  if (entree.piste) ligne.piste = entree.piste;
  if (entree.detail !== undefined) ligne.detail = nettoyer(entree.detail);
  try {
    destination(ligne);
  } catch {
    try {
      destinationConsole({ ...ligne, detail: '[destination du journal en échec]' });
    } catch {
      // Plus rien à faire : la console elle-même est indisponible.
    }
  }
  return ligne;
}
