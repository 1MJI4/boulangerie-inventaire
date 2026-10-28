// src/lib/commandesHorsLigne.ts
//
// File des commandes gardées sur la tablette faute de réseau (propriétaire :
// `data-offline`). Décision du propriétaire (28/10/2026) : « panne réseau en
// pleine commande : enregistrer sur la tablette puis envoyer automatiquement ».
//
// FONCTIONS PURES uniquement (aucun accès au navigateur ni au réseau) : le
// stockage et l'envoi vivent dans `envoiHorsLigne.ts`. AUCUNE règle métier ici :
// la commande a été contrôlée par le domaine à l'écran, et le serveur rejoue les
// mêmes règles à l'arrivée. Ici, seulement du transport fiable :
//
//  - ordre : les commandes partent dans l'ordre où elles ont été gardées ;
//  - une seule fois : chaque commande porte un identifiant client unique
//    (`idClient`, UUID). La garder à nouveau sous le même identifiant remplace
//    l'entrée, sans jamais créer de doublon dans la file ;
//  - jamais perdue : un refus du serveur (règle rejouée) la laisse sur la
//    tablette, « à reprendre », avec le message du serveur ;
//  - pas de suppression d'une commande non envoyée : « Mettre de côté » l'archive
//    sur la tablette, elle reste lisible et récupérable.
//
// Modèle de données (clé `commandes-en-attente` du stockage local, version 1) :
//   { v: 1, commandes: CommandeEnAttente[] }   — l'ordre du tableau est l'ordre d'envoi.
// Migration : une version inconnue ou un contenu illisible n'est jamais écrasé
// en silence (voir `lireFile` : les entrées lisibles sont gardées).

export const VERSION_FILE = 1;

/**
 * en_attente  : gardée, partira au prochain essai
 * envoi       : envoi en cours (une coupure à ce moment la remet en attente au chargement)
 * a_reprendre : refusée par le serveur — le vendeur doit la rouvrir et la corriger
 * envoyee     : reçue par le serveur (numéro connu) — gardée quelques jours, puis oubliée
 * mise_de_cote: archivée à la main par le vendeur (jamais effacée de force)
 */
export type EtatEnvoi = 'en_attente' | 'envoi' | 'a_reprendre' | 'envoyee' | 'mise_de_cote';

export type RefusServeur = { code: string; message: string; champ?: string; valeurProposee?: unknown };

export type CommandeEnAttente = {
  /** Identifiant unique côté tablette (UUID) : protège contre le double envoi. */
  idClient: string;
  /** Création (POST) ou modification d'une commande existante (PATCH). */
  methode: 'POST' | 'PATCH';
  /** Modification : la commande visée. Création : null tant qu'elle n'est pas envoyée. */
  commandeId: number | null;
  /** Numéro de bon : connu en modification, ou après l'envoi d'une création. */
  numero: string | null;
  /** Pour la liste du voyant : nom du client, jour et heure de retrait. */
  client: string;
  dateRetrait: string | null;
  heureRetrait: string | null;
  /** Qui a pris la commande, et quand (horodatage de la tablette, ISO). */
  vendeur: string;
  priseLe: string;
  /** Instants (ms) : gardée la première fois, dernière mise à jour. */
  gardeeLe: number;
  modifieeLe: number;
  /** Corps exact de la requête, prêt à partir. */
  corps: Record<string, unknown>;
  /** Instantané de l'écran, pour rouvrir la commande telle quelle (opaque ici). */
  ecran: unknown;
  etat: EtatEnvoi;
  essais: number;
  dernierEssaiLe: number | null;
  refus: RefusServeur | null;
  envoyeeLe: number | null;
};

export type FileCommandes = { v: typeof VERSION_FILE; commandes: CommandeEnAttente[] };

export const FILE_VIDE: FileCommandes = { v: VERSION_FILE, commandes: [] };

/** Une commande envoyée reste lisible sur la tablette ce temps-là, puis elle est oubliée (elle est sur le serveur). */
export const OUBLI_ENVOYEE_MS = 7 * 24 * 60 * 60_000;
/** « Envoyée ✓ » reste affiché ce temps-là dans le voyant. */
export const CONFIRMATION_ENVOI_MS = 8_000;
/** Nouvel essai automatique tant que des commandes attendent. */
export const INTERVALLE_ESSAI_MS = 30_000;
/** Au-delà, une requête sans réponse est considérée comme perdue (réseau). */
export const DELAI_REPONSE_MS = 15_000;

/* ------------------------------------------------------------------ Lecture */

const ETATS: readonly EtatEnvoi[] = ['en_attente', 'envoi', 'a_reprendre', 'envoyee', 'mise_de_cote'];

function estEntree(x: unknown): x is CommandeEnAttente {
  const c = x as Partial<CommandeEnAttente> | null;
  return (
    !!c &&
    typeof c.idClient === 'string' &&
    c.idClient.length > 0 &&
    (c.methode === 'POST' || c.methode === 'PATCH') &&
    typeof c.corps === 'object' &&
    c.corps !== null &&
    typeof c.etat === 'string' &&
    ETATS.includes(c.etat as EtatEnvoi)
  );
}

/**
 * Contenu brut du stockage → file. Ce qui est illisible est ignoré, ce qui est
 * lisible est gardé (jamais toute la file jetée pour une entrée abîmée).
 * Une commande restée « envoi » (onglet fermé, batterie vide pendant l'envoi)
 * repasse « en attente » : elle repartira, sous le même identifiant.
 */
export function lireFile(brut: unknown): FileCommandes {
  const liste = Array.isArray((brut as { commandes?: unknown } | null)?.commandes)
    ? (brut as { commandes: unknown[] }).commandes
    : Array.isArray(brut)
      ? brut
      : [];
  const vus = new Set<string>();
  const commandes: CommandeEnAttente[] = [];
  for (const x of liste) {
    if (!estEntree(x) || vus.has(x.idClient)) continue;
    vus.add(x.idClient);
    commandes.push(x.etat === 'envoi' ? { ...x, etat: 'en_attente' } : x);
  }
  return { v: VERSION_FILE, commandes };
}

/* ------------------------------------------------------------------- Ajout */

export type NouvelleEntree = Omit<
  CommandeEnAttente,
  'gardeeLe' | 'modifieeLe' | 'etat' | 'essais' | 'dernierEssaiLe' | 'refus' | 'envoyeeLe'
>;

/**
 * Garde une commande sur la tablette.
 *  - même `idClient` déjà dans la file (commande à reprendre, corrigée puis
 *    revalidée hors ligne) : l'entrée est REMPLACÉE à sa place, jamais doublée ;
 *  - modification d'une commande dont une modification attend encore (pas en
 *    cours d'envoi) : la nouvelle la remplace — le corps porte l'état complet,
 *    l'ancienne n'apporterait rien ;
 *  - sinon : ajoutée en fin de file.
 * Une entrée en cours d'envoi n'est jamais remplacée (son résultat arrive).
 */
export function garder(file: FileCommandes, e: NouvelleEntree, maintenant: number): FileCommandes {
  const fraiche: CommandeEnAttente = {
    ...e,
    gardeeLe: maintenant,
    modifieeLe: maintenant,
    etat: 'en_attente',
    essais: 0,
    dernierEssaiLe: null,
    refus: null,
    envoyeeLe: null,
  };
  const remplacable = (c: CommandeEnAttente) => c.etat !== 'envoi' && c.etat !== 'envoyee';
  const remplacer = (i: number): FileCommandes => ({
    ...file,
    commandes: file.commandes.map((c, j) => (j === i ? { ...fraiche, gardeeLe: c.gardeeLe } : c)),
  });

  const meme = file.commandes.findIndex((c) => c.idClient === e.idClient);
  if (meme >= 0) {
    // Même identifiant déjà envoyé ou en cours d'envoi : jamais un second exemplaire.
    return remplacable(file.commandes[meme]) ? remplacer(meme) : file;
  }
  if (e.methode === 'PATCH' && e.commandeId !== null) {
    const precedente = file.commandes.findIndex(
      (c) => c.methode === 'PATCH' && c.commandeId === e.commandeId && (c.etat === 'en_attente' || c.etat === 'a_reprendre'),
    );
    if (precedente >= 0) return remplacer(precedente);
  }
  return { ...file, commandes: [...file.commandes, fraiche] };
}

/* ------------------------------------------------------------------- Envoi */

/** La prochaine à partir : la plus ancienne en attente (ordre de la file). */
export function prochaine(file: FileCommandes): CommandeEnAttente | null {
  return file.commandes.find((c) => c.etat === 'en_attente') ?? null;
}

function modifier(file: FileCommandes, idClient: string, f: (c: CommandeEnAttente) => CommandeEnAttente): FileCommandes {
  return { ...file, commandes: file.commandes.map((c) => (c.idClient === idClient ? f(c) : c)) };
}

export function debuterEnvoi(file: FileCommandes, idClient: string, maintenant: number): FileCommandes {
  return modifier(file, idClient, (c) =>
    c.etat === 'en_attente' ? { ...c, etat: 'envoi', essais: c.essais + 1, dernierEssaiLe: maintenant, modifieeLe: maintenant } : c,
  );
}

/** Ce que l'envoi a donné, déjà classé par `classerReponse`. */
export type Issue =
  | { type: 'envoyee'; id: number; numero: string }
  | { type: 'reessayer' }
  | { type: 'refusee'; refus: RefusServeur };

export function appliquerIssue(file: FileCommandes, idClient: string, issue: Issue, maintenant: number): FileCommandes {
  return modifier(file, idClient, (c) => {
    // Une entrée remplacée entre-temps (corrigée à l'écran) n'est pas touchée par un vieux résultat.
    if (c.etat !== 'envoi' && c.etat !== 'en_attente' && c.etat !== 'a_reprendre') return c;
    switch (issue.type) {
      case 'envoyee':
        return {
          ...c,
          etat: 'envoyee',
          commandeId: issue.id,
          numero: issue.numero,
          refus: null,
          envoyeeLe: maintenant,
          modifieeLe: maintenant,
        };
      case 'refusee':
        return { ...c, etat: 'a_reprendre', refus: issue.refus, modifieeLe: maintenant };
      case 'reessayer':
        return c.etat === 'envoi' ? { ...c, etat: 'en_attente', modifieeLe: maintenant } : c;
    }
  });
}

/** « Mettre de côté » : archivée sur la tablette, plus comptée dans le voyant, jamais effacée. */
export function mettreDeCote(file: FileCommandes, idClient: string, maintenant: number): FileCommandes {
  return modifier(file, idClient, (c) =>
    c.etat === 'a_reprendre' || c.etat === 'en_attente' ? { ...c, etat: 'mise_de_cote', modifieeLe: maintenant } : c,
  );
}

/** Oublie les commandes envoyées depuis longtemps (elles sont sur le serveur). Rien d'autre n'est retiré. */
export function nettoyer(file: FileCommandes, maintenant: number): FileCommandes {
  const commandes = file.commandes.filter(
    (c) => !(c.etat === 'envoyee' && c.envoyeeLe !== null && maintenant - c.envoyeeLe > OUBLI_ENVOYEE_MS),
  );
  return commandes.length === file.commandes.length ? file : { ...file, commandes };
}

/* --------------------------------------------------------------- Réponses */

/** Réponse lue : refus typé du serveur (format LOI 9) ou succès. */
export type ReponseLue =
  | { type: 'reseau' }
  | { type: 'reponse'; statut: number; ok: true; donnees: unknown }
  | { type: 'reponse'; statut: number; ok: false; refus: RefusServeur };

/**
 * Codes qui disent « le serveur n'a pas pu traiter, pas qu'il refuse » : la
 * commande reste en attente et repartira. Session de la tablette expirée : idem
 * (elle partira quand le code tablette aura été ressaisi).
 */
const CODES_A_REESSAYER: ReadonlySet<string> = new Set([
  'ERR_SERVEUR_INDISPONIBLE',
  'ERR_CONFIGURATION_SERVEUR',
  'ERR_TROP_DE_TENTATIVES',
  'ERR_SESSION_EXPIREE',
]);

/**
 * Classe le résultat d'un envoi automatique.
 *  - réseau coupé, délai dépassé, passerelle injoignable, serveur saturé → réessayer ;
 *  - succès avec un identifiant et un numéro → envoyée ;
 *  - tout autre refus typé (règle métier rejouée, accord du manager manquant,
 *    commande introuvable…) → à reprendre, avec le message du serveur.
 */
export function classerReponse(r: ReponseLue): Issue {
  if (r.type === 'reseau') return { type: 'reessayer' };
  if (r.ok) {
    const d = r.donnees as { id?: unknown; numero?: unknown } | null;
    if (d && typeof d.id === 'number' && typeof d.numero === 'string') return { type: 'envoyee', id: d.id, numero: d.numero };
    // Succès sans numéro lisible : on ne le compte pas envoyé à l'aveugle.
    return { type: 'reessayer' };
  }
  if (CODES_A_REESSAYER.has(r.refus.code) || r.statut >= 502 || r.statut === 408) return { type: 'reessayer' };
  return { type: 'refusee', refus: r.refus };
}

/**
 * À l'écran de commande : l'échec doit-il conduire à garder la commande sur la
 * tablette ? Oui pour une panne de réseau ou de serveur (`reessayer`), sauf la
 * session expirée, que le vendeur règle tout de suite (code tablette).
 */
export function aGarderSurLaTablette(r: ReponseLue): boolean {
  if (r.type === 'reseau') return true;
  if (r.ok) return false;
  return classerReponse(r).type === 'reessayer' && r.refus.code !== 'ERR_SESSION_EXPIREE';
}

/* ------------------------------------------------------------------ Résumé */

export type ResumeFile = {
  enAttente: number;
  enEnvoi: number;
  aReprendre: number;
  /** Envoyées il y a moins de `CONFIRMATION_ENVOI_MS` (pour « Envoyée ✓ »). */
  envoyeesRecentes: CommandeEnAttente[];
};

export function resumer(file: FileCommandes, maintenant: number): ResumeFile {
  const n = (e: EtatEnvoi) => file.commandes.filter((c) => c.etat === e).length;
  return {
    enAttente: n('en_attente'),
    enEnvoi: n('envoi'),
    aReprendre: n('a_reprendre'),
    envoyeesRecentes: file.commandes.filter(
      (c) => c.etat === 'envoyee' && c.envoyeeLe !== null && maintenant - c.envoyeeLe < CONFIRMATION_ENVOI_MS,
    ),
  };
}

/* ------------------------------------------------------------------ Textes */
// LOI 9 — textes destinés au vendeur. HYPOTHÈSE À VALIDER : à reprendre dans le
// catalogue `src/domaine/messages.ts` (propriétaire `gestion-erreurs`).

const NBSP = ' ';

function pluriel(n: number, un: string, plusieurs: string): string {
  return `${n} ${n > 1 ? plusieurs : un}`;
}

export const TEXTES_HORS_LIGNE = {
  gardee: `Pas de connexion${NBSP}: la commande est gardée sur cette tablette et sera envoyée dès le retour du réseau.`,
  gardeeModification: `Pas de connexion${NBSP}: les changements sont gardés sur cette tablette et seront envoyés dès le retour du réseau.`,
  pasDImpression: `Le bon pourra s’imprimer dès que la commande sera arrivée au magasin${NBSP}: elle n’a pas encore de numéro. Merci de patienter un peu.`,
  stockageIndisponible:
    `Pas de connexion, et cette tablette ne peut pas garder la commande. ` +
    `Touchez Réessayer${NBSP}; si cela ne passe pas, notez-la sur papier, s’il vous plaît.`,
  envoi: 'Envoi…',
  enAttente: (n: number) => `${pluriel(n, 'commande', 'commandes')} en attente d’envoi`,
  aReprendre: (n: number) => `${pluriel(n, 'commande', 'commandes')} à reprendre`,
  envoyee: (numero: string | null) => (numero ? `Commande n° ${numero} envoyée ✓` : 'Commande envoyée ✓'),
  aReprendreAide: `Le magasin n’a pas accepté cette commande. Rouvrez-la pour la corriger, s’il vous plaît.`,
  rouvrir: 'Rouvrir pour corriger',
  mettreDeCote: 'Mettre de côté',
  envoyerMaintenant: 'Envoyer maintenant',
} as const;
