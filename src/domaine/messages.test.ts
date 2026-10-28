// node --test src/domaine/messages.test.ts
//
// Catalogue des messages (gestion-erreurs) :
//   1. exhaustivité — tout code écrit dans le code serveur existe au catalogue ;
//   2. style — chaque message est français, sans « ! », sans jargon, terminé ;
//   3. sortie — tout bloquant propose une correction ou une autre issue (LOI 7/8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { APPELER_LE_GERANT, CATALOGUE, estCodeCatalogue, messagePour, sortiePour, typographier, type CodeCatalogue } from './messages.ts';
import { niveauDuCode } from './resultat.ts';
import { statutHttp } from '../lib/erreurBase.ts';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Zones où un code d'erreur peut être produit ou transporté. */
const ZONES = ['domaine', 'catalogue', 'lib', 'proxy.ts', join('app', 'api')];
const EXTENSIONS = /\.(ts|tsx|mts|js|mjs)$/;
/** Un code écrit comme littéral : 'ERR_X', "AVERT_Y", `INFO_Z`. */
const LITTERAL = /['"`]((?:ERR|AVERT|INFO)_[A-Z0-9_]+)['"`]/g;

function fichiers(chemin: string): string[] {
  let st;
  try {
    st = statSync(chemin);
  } catch {
    return [];
  }
  if (st.isFile()) return EXTENSIONS.test(chemin) ? [chemin] : [];
  return readdirSync(chemin).flatMap((n) => fichiers(join(chemin, n)));
}

/** code → fichiers qui l'utilisent (tests exclus : ils inventent des codes fictifs). */
function codesUtilises(): Map<string, string[]> {
  const trouves = new Map<string, string[]>();
  for (const zone of ZONES) {
    for (const f of fichiers(join(SRC, zone))) {
      if (/\.test\.[a-z]+$/.test(f)) continue;
      for (const m of readFileSync(f, 'utf8').matchAll(LITTERAL)) {
        const liste = trouves.get(m[1]) ?? [];
        liste.push(relative(SRC, f));
        trouves.set(m[1], liste);
      }
    }
  }
  return trouves;
}

test('exhaustivité : chaque code ERR_/AVERT_/INFO_ utilisé dans src/ existe au catalogue', () => {
  const utilises = codesUtilises();
  assert.ok(utilises.size > 50, `balayage suspect : ${utilises.size} codes seulement`);
  const manquants = [...utilises].filter(([c]) => !estCodeCatalogue(c)).map(([c, f]) => `${c} (${[...new Set(f)].join(', ')})`);
  assert.deepEqual(manquants, [], `Codes absents de src/domaine/messages.ts :\n  ${manquants.join('\n  ')}`);
});

test('le balayage voit bien les zones attendues', () => {
  const utilises = codesUtilises();
  for (const [code, zone] of [
    ['ERR_ORIGINE_REFUSEE', 'proxy.ts'],
    ['ERR_TROP_DE_TENTATIVES', 'lib'],
    ['ERR_TARIF_ABSENT', 'catalogue'],
    ['ERR_DATE_PASSEE', 'domaine'],
  ] as const) {
    assert.ok((utilises.get(code) ?? []).some((f) => f.startsWith(zone)), `${code} non trouvé dans ${zone}`);
  }
});

// ---------------------------------------------------------------------------
// Un exemple de paramètres par code (les codes du rapport d'import partagent le leur)
// ---------------------------------------------------------------------------

const EXEMPLE_IMPORT = { ou: 'Ligne 12 « Croissant »', precision: '7 colonnes au lieu de 8' };

const EXEMPLES: Partial<Record<CodeCatalogue, unknown>> = {
  ERR_ECRITURE_SANS_SUPPLEMENT: { produit: 'Écriture simple' },
  ERR_PHOTO_SANS_SUPPLEMENT: { produit: 'Photo' },
  ERR_SUPPLEMENT_EN_TROP: { attendus: 2, objet: 'une écriture', produit: 'Écriture simple' },
  ERR_JOUR_FERME: { jour: 'mardi' },
  ERR_PERIODE_CONGES: {},
  ERR_DATE_PASSEE: { premiereDate: 'jeudi 16 octobre' },
  ERR_DELAI_TROP_COURT: { delaiJoursOuvres: 2, premiereDate: 'jeudi 23 octobre' },
  ERR_QUANTITE_MIN: { produit: 'P', minimum: 10, unite: 'pièces' },
  ERR_QUANTITE_INVALIDE: { unite: 'kg', proposition: '1' },
  ERR_QUANTITE_NEGATIVE: { produit: 'P' },
  ERR_NB_SYMBOLES_MANQUANT: { produit: 'Number Cake' },
  ERR_GOUT_MANQUANT: { produit: 'Pièce montée 3 étages', objet: 'le goût', etage: 3 },
  ERR_CONFLIT_COMPTAGE: { produit: 'P' },
  ERR_SUPPLEMENT_TROP_NOMBREUX: { max: 3, produit: 'P' },
  ERR_SUPPLEMENT_SANS_GATEAU: { produit: 'P' },
  ERR_SOUS_PLANCHER: { produit: 'P', plancherFormate: 'X €' },
  ERR_MONTANT_NUL: { objet: 'la commande' },
  ERR_ACOMPTE_SUPERIEUR_TOTAL: { acompteFormate: 'A €', totalFormate: 'T €' },
  ERR_REMISE_NON_AUTORISEE: { totalFormate: 'T €' },
  ERR_TOTAL_INCOHERENT: { totalFormate: 'T €' },
  ERR_CHAMP_OBLIGATOIRE: { champLibelle: 'nom du client' },
  ERR_COMMANDE_VIDE: {},
  ERR_LIGNE_SANS_PRODUIT: {},
  ERR_PHOTO_EN_ATTENTE: { photo: 'G047' },
  ERR_STATUT_INCOHERENT: { de: 'Retirée par le client', vers: 'À imprimer' },
  ERR_COMMANDE_FIGEE: { etat: 'annulée' },
  AVERT_ACOMPTE_INSUFFISANT: { acompteFormate: 'A €', minimumFormate: 'M €', pourcentage: 50 },
  ERR_COMMANDE_LENDEMAIN: { dateRetrait: 'jeudi 16 octobre' },
  ERR_HEURE_HORS_OUVERTURE: { ouverture: 'Ho', fermeture: 'Hf', jour: 'le samedi', heureProposee: 'Hp' },
  ERR_TAILLE_NON_STANDARD: { parts: 7, inferieure: 6, superieure: 8 },
  ERR_PRIX_COMPTOIR: { produit: 'P', parts: 6 },
  ERR_FORME_MANQUANTE: { produit: 'Bavarois' },
  ERR_FORME_ROND_IMPOSSIBLE: { produit: 'Bavarois', parts: 12, partsMaxRond: 8, gateauRond: 'Layer Cake', partsRond: 20 },
  ERR_TAILLE_INTERDITE: {
    produit: 'Matadi chocolat 4P',
    remplacements: [
      { libelle: 'Matadi chocolat 6P', action: 'passer' },
      { libelle: 'Mousse chocolat 4P', action: 'prendre' },
    ],
  },
  ERR_SUPPLEMENT_PARTS: { produit: 'Pâte à sucre', gateau: 'Layer Cake', parts: 25 },
  ERR_SUPPLEMENT_NON_ADMIS: { produit: 'Pâte à sucre', gateaux: 'Layer Cake, Bavarois' },
  AVERT_TAILLE_NON_STANDARD_AUTORISEE: { par: 'Karim' },
  ERR_DECOMPTE_INCOMPLET: { restants: 2 },
  ERR_BON_ILLISIBLE: {},
  ERR_FORMAT_PHOTO: {},
  ERR_PHOTO_TROP_LOURDE: { maxMo: 10 },
  ERR_PHOTO_MASQUEE: { photo: 'G019' },
  ERR_IMPRESSION_NON_ENVOYEE: {},
  INFO_COMMANDE_GARDEE_SUR_TABLETTE: {},
  AVERT_COMMANDE_INHABITUELLE: {},
  AVERT_INVENTAIRE_AVANT_FERMETURE: { heureFermeture: 'Hh' },
  ERR_DROIT_INSUFFISANT: { action: 'modifier un tarif', role: 'gérant' },
  ERR_CODE_INCORRECT: {},
  ERR_TROP_DE_TENTATIVES: { minutes: 3 },
  ERR_ORIGINE_REFUSEE: {},
  ERR_SESSION_EXPIREE: {},
  AVERT_PAIN_SUPPLEMENTAIRE: { maximum: 20, demande: 21 },
  AVERT_DOUBLE_SCAN: { produit: 'P' },
  AVERT_DLC_PROCHE: { produit: 'P', date: '17/10' },
  AVERT_TELEPHONE_IMPROBABLE: {},
  AVERT_PRODUIT_EN_DOUBLE: { produit: 'P' },
  AVERT_ECRITURE_NON_PRECISEE: {},
  AVERT_GATEAU_COMPLEXE: {},
  AVERT_COMMANDE_DEJA_IMPRIMEE: {},
  AVERT_SOUS_PLANCHER_AUTORISE: { produit: 'P', par: 'Karim' },
  AVERT_REMISE_AUTORISEE: { par: 'Karim' },
  AVERT_QUANTITE_INHABITUELLE: { produit: 'P', reference: '12' },
  AVERT_PLUS_QUE_PRODUIT: { produit: 'P', produite: '12' },
  AVERT_PRODUCTION_INHABITUELLE: { produit: 'P', demandee: '12', sens: 'dessus' },
  INFO_TARIF_EN_VIGUEUR: { dateEffet: '01/09/2026' },
  INFO_EN_ATTENTE_ENVOI: { nombre: 3 },
  INFO_COMMANDE_LENDEMAIN: { jour: 'vendredi', demain: true },
  INFO_COMMANDE_JOUR_MEME: {},
  ERR_TARIF_ABSENT: { produit: 'P', date: '15/10/2026' },
  ERR_CATALOGUE_ABSENT: {},
  ERR_PRODUIT_SANS_REGIME: { produit: 'P' },
  ERR_PRODUIT_INCONNU: {},
  ERR_SAISIE_INVALIDE: { champLibelle: 'Téléphone' },
  ERR_UNITE_INCOHERENTE: {},
  ERR_UNITE_FIGEE: {},
  ERR_REGIME_FIGE: {},
  ERR_TARIF_IMMUABLE: {},
  ERR_TARIF_PASSE: {},
  ERR_TARIF_CHEVAUCHEMENT: {},
  ERR_TARIF_INCOHERENT: {},
  ERR_PRODUIT_EN_DOUBLE: {},
  ERR_SERVEUR_INDISPONIBLE: { reference: 'ABC-DEF' },
  ERR_CONFIGURATION_SERVEUR: { reference: 'ABC-DEF' },
  ERR_DONNEE_INTROUVABLE: { reference: 'ABC-DEF' },
  ERR_DEJA_ENREGISTRE: { reference: 'ABC-DEF' },
  ERR_INATTENDUE: { reference: 'ABC-DEF' },
};

function exemple(code: CodeCatalogue): unknown {
  return code in EXEMPLES ? EXEMPLES[code] : EXEMPLE_IMPORT;
}

// Jargon et vocabulaire interdits à l'écran (propriétaire, 28/10/2026) : le chef
// est « le manager », le papier est « le bon », « remise » ne désigne plus le
// retrait, et l'employé ne lit jamais « serveur », « requête », « URL »,
// « déverrouiller » ni un code HTTP.
const JARGON =
  /prisma|database|http|\b[45]\d\d\b|undefined|null|NaN|error|failed|fetch|validation|\btu\b|\bton\b|\bta\b|serveur|\bURL\b|requête|déverrouill|gérant|responsable|remise au client|cloudprnt|\btickets?\b|exemplaire/i;

/**
 * Longueur raisonnable, lisible debout (audit 28/10/2026, 3.10 : 208 caractères
 * pour « demande inhabituelle »). Le rapport d'import, lu au calme par le
 * manager et complété du repère et de la précision, n'est pas concerné.
 */
const LONGUEUR_MAX = 170;
const LONGUEUR_MAX_BOUTON = 40;

test('tous les messages : français, sans « ! », sans jargon, terminés, niveau = préfixe', () => {
  for (const [code, entree] of Object.entries(CATALOGUE)) {
    const m = (entree.message as (p: unknown) => string)(exemple(code as CodeCatalogue));
    assert.ok(m.length > 10, code);
    const auComptoir = !/^Import du catalogue/.test(entree.cas);
    if (auComptoir) {
      assert.ok(m.length <= LONGUEUR_MAX, `${code} : ${m.length} caractères, trop long pour être lu debout`);
    }
    const sortie = sortiePour(code as CodeCatalogue, exemple(code as CodeCatalogue) as never);
    if (sortie && auComptoir) {
      assert.ok(sortie.libelle.length <= LONGUEUR_MAX_BOUTON, `${code} : bouton trop long « ${sortie.libelle} »`);
      assert.doesNotMatch(sortie.libelle, JARGON, `${code} : bouton`);
    }
    assert.ok(!m.includes('!'), `${code} : pas de point d’exclamation`);
    assert.ok(/[.]$/.test(m), `${code} : phrase terminée`);
    assert.doesNotMatch(m, JARGON, code);
    assert.equal(entree.niveau, niveauDuCode(code as `ERR_${string}`), `${code} : niveau = préfixe`);
    assert.ok(entree.cas.length > 5, `${code} : cas documenté`);
  }
});

test('les codes sans exemple dédié sont bien ceux du rapport d’import (paramètres ou / precision)', () => {
  for (const code of Object.keys(CATALOGUE) as CodeCatalogue[]) {
    if (code in EXEMPLES) continue;
    assert.match(CATALOGUE[code].cas, /^Import du catalogue/, `${code} : ajoutez un exemple dans EXEMPLES`);
    // Sans repère ni précision, le message reste complet.
    const nu = (CATALOGUE[code].message as (p: unknown) => string)({});
    assert.doesNotMatch(nu, /undefined|\(\)|^ — /, code);
  }
});

test('tout bloquant propose une sortie : correction, sinon autre issue (LOI 7/8)', () => {
  for (const code of Object.keys(CATALOGUE) as CodeCatalogue[]) {
    if (!code.startsWith('ERR_')) continue;
    const s = sortiePour(code, exemple(code) as never);
    assert.ok(s && s.libelle.length > 3, `${code} : ni correction ni autreSortie`);
    assert.ok(!s.libelle.endsWith('.'), `${code} : un libellé de bouton ne finit pas par un point`);
  }
});

test('sorties en un geste relevées par design-ux', () => {
  const correction = (code: CodeCatalogue) => sortiePour(code, exemple(code) as never);
  assert.deepEqual(correction('ERR_DROIT_INSUFFISANT'), { type: 'correction', libelle: 'Saisir le code du manager' });
  assert.deepEqual(correction('ERR_SESSION_EXPIREE'), { type: 'correction', libelle: 'Saisir le code de la tablette' });
  assert.deepEqual(correction('ERR_PRODUIT_INCONNU'), { type: 'correction', libelle: 'Choisir un autre produit' });
  assert.deepEqual(correction('ERR_TARIF_ABSENT'), { type: 'correction', libelle: 'Choisir un autre produit' });
  assert.deepEqual(correction('ERR_SAISIE_INVALIDE'), { type: 'correction', libelle: 'Corriger « Téléphone »' });
  for (const c of ['ERR_UNITE_FIGEE', 'ERR_REGIME_FIGE', 'ERR_TARIF_IMMUABLE', 'ERR_TARIF_PASSE', 'ERR_TARIF_CHEVAUCHEMENT', 'ERR_TARIF_INCOHERENT'] as const) {
    assert.equal(correction(c)?.type, 'correction', c);
  }
  // Aucune action possible depuis l'écran : l'écran affiche « Appeler le manager ».
  assert.equal(APPELER_LE_GERANT, 'Appeler le manager');
  for (const c of ['ERR_CONFIGURATION_SERVEUR', 'ERR_CATALOGUE_ABSENT', 'ERR_TROP_DE_TENTATIVES'] as const) {
    assert.deepEqual(correction(c), { type: 'autre', libelle: APPELER_LE_GERANT }, c);
  }
});

test('accès : messages du catalogue (anciennement locaux à codes.ts et proxy.ts)', () => {
  assert.equal(messagePour('ERR_SESSION_EXPIREE', {}), 'Saisissez le code de la tablette pour continuer, s’il vous plaît.');
  assert.equal(messagePour('ERR_TROP_DE_TENTATIVES', { minutes: 1 }), 'Trop d’essais. Réessayez dans 1 minute, ou demandez au manager.');
  assert.match(messagePour('ERR_TROP_DE_TENTATIVES', { minutes: 7 }), /dans 7 minutes/);
  assert.match(messagePour('ERR_CODE_INCORRECT', {}), /manager/);
  assert.match(messagePour('ERR_ORIGINE_REFUSEE', {}), /Rouvrez l’application/);
});

test('catalogue absent ≠ tarif absent ; produit sans régime ; produit hors liste d’inventaire', () => {
  assert.notEqual(messagePour('ERR_CATALOGUE_ABSENT', {}), messagePour('ERR_TARIF_ABSENT', { produit: 'P', date: 'd' }));
  assert.match(messagePour('ERR_PRODUIT_SANS_REGIME', { produit: 'Bavarois' }), /« Bavarois »/);
  assert.match(messagePour('ERR_PRODUIT_SANS_REGIME', {}), /^Ce produit/);
  assert.match(messagePour('ERR_PRODUIT_INCONNU', { liste: 'inventaire' }), /liste d’inventaire/);
  assert.match(messagePour('ERR_PRODUIT_INCONNU', {}), /catalogue/);
});

test('aucun montant ni jour en dur dans les messages migrés de regles-metier', () => {
  const sansMontant = [
    messagePour('ERR_MONTANT_NUL', { objet: 'la commande' }),
    messagePour('ERR_QUANTITE_INVALIDE', { unite: 'kg' }),
    messagePour('ERR_QUANTITE_INVALIDE', { unite: 'piece' }),
    messagePour('ERR_QUANTITE_NEGATIVE', {}),
    messagePour('ERR_DATE_PASSEE', {}),
    messagePour('ERR_CHAMP_OBLIGATOIRE', { champLibelle: 'acompte' }),
  ];
  for (const m of sansMontant) assert.doesNotMatch(m, /€|\d|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche/, m);
  // Les montants viennent formatés de l'appelant.
  assert.match(messagePour('ERR_ACOMPTE_SUPERIEUR_TOTAL', { acompteFormate: 'A', totalFormate: 'T' }), /\(A\).*\(T\).*à T au maximum/);
});

test('rapport d’import : repère et précision insérés, sinon message sans trou', () => {
  assert.equal(
    messagePour('ERR_LIGNE_MALFORMEE', EXEMPLE_IMPORT),
    'Ligne 12 « Croissant » — Cette ligne n’a pas le bon nombre de colonnes (7 colonnes au lieu de 8). ' +
      'Vérifiez les virgules et les guillemets de la ligne puis relancez l’import.',
  );
  assert.equal(
    messagePour('ERR_PRIX_VIDE', {}),
    'Prix vide. Indiquez le prix du produit puis relancez l’import.',
  );
});

test('règlement intérieur (LOI 11) : un exemple par code, sortie et statut', () => {
  // Montants, pourcentage et heures arrivent en paramètre : rien en dur.
  // R52 (18/10/2026) : acompte faible = avertissement bienveillant, sortie conservée.
  const acompte = { acompteFormate: 'A €', minimumFormate: 'M €', pourcentage: 37 };
  assert.equal(
    messagePour('AVERT_ACOMPTE_INSUFFISANT', acompte),
    'Essayez d’obtenir au moins 37 % d’acompte (M €) : A € saisi. La commande reste acceptée.',
  );
  assert.equal(
    messagePour('AVERT_ACOMPTE_INSUFFISANT', { minimumFormate: 'M €', pourcentage: 50 }),
    'Essayez d’obtenir au moins 50 % d’acompte (M €). La commande reste acceptée.',
  );
  assert.deepEqual(sortiePour('AVERT_ACOMPTE_INSUFFISANT', acompte), { type: 'correction', libelle: 'Mettre l’acompte à M €' });
  assert.equal(CATALOGUE.AVERT_ACOMPTE_INSUFFISANT.niveau, 'avertissement');
  assert.ok(!estCodeCatalogue('ERR_ACOMPTE_INSUFFISANT'), 'un acompte faible ne bloque plus');

  // R53b (18/10/2026) : le jour même est accepté, simple information.
  assert.equal(messagePour('INFO_COMMANDE_JOUR_MEME', {}), 'Commande pour aujourd’hui : prévenez l’atelier tout de suite.');
  assert.equal(niveauDuCode('INFO_COMMANDE_JOUR_MEME'), 'information');

  // R53 (15/10/2026) : le lendemain est accepté, simple information sans friction.
  const lendemain = { jour: 'vendredi', demain: true };
  assert.equal(messagePour('INFO_COMMANDE_LENDEMAIN', lendemain), 'Commande pour demain : prévenez l’atelier.');
  // Réserve qa-metier m1 : prise lundi, mardi fermé → « pour mercredi », jamais « pour demain ».
  assert.equal(
    messagePour('INFO_COMMANDE_LENDEMAIN', { jour: 'JOUR', demain: false }),
    'Commande pour JOUR, le prochain jour d’ouverture : prévenez l’atelier dès aujourd’hui.',
  );
  assert.equal(CATALOGUE.INFO_COMMANDE_LENDEMAIN.niveau, 'information');
  assert.equal(niveauDuCode('INFO_COMMANDE_LENDEMAIN'), 'information');
  assert.ok(!estCodeCatalogue('AVERT_COMMANDE_LENDEMAIN_AUTORISEE'), 'plus d’accord gérant pour le lendemain');
  // ERR_COMMANDE_LENDEMAIN : obsolète, gardé tant que la base le produit encore.
  assert.match(messagePour('ERR_COMMANDE_LENDEMAIN', { dateRetrait: 'jeudi 16 octobre' }), /^Retrait le jeudi 16 octobre : .*accord du manager/);

  // R54 (18/10/2026) : heures d'ouverture du magasin, pour tous les produits.
  const horaires = { ouverture: 'Ho', fermeture: 'Hf', jour: 'le samedi', heureProposee: 'Hp' };
  assert.equal(
    messagePour('ERR_HEURE_HORS_OUVERTURE', horaires),
    'Le magasin est ouvert de Ho à Hf le samedi — choisissez une heure dans ces horaires.',
  );
  assert.deepEqual(sortiePour('ERR_HEURE_HORS_OUVERTURE', horaires), { type: 'correction', libelle: 'Passer à Hp' });
  assert.ok(!estCodeCatalogue('ERR_HEURE_RETRAIT_TROP_TOT'), 'règle pâtisserie 9h/12h supprimée');

  // Tailles standard : les deux tailles proches citées, sortie vers la supérieure.
  assert.equal(
    messagePour('ERR_TAILLE_NON_STANDARD', { parts: 7, inferieure: 6, superieure: 8 }),
    'Ce gâteau se fait en 6 ou 8 parts, pas en 7. Choisissez une de ces tailles, ou demandez l’accord du manager.',
  );
  assert.deepEqual(sortiePour('ERR_TAILLE_NON_STANDARD', { parts: 7, inferieure: 6, superieure: 8 }), {
    type: 'correction',
    libelle: 'Passer à 8 parts',
  });
  assert.match(messagePour('ERR_TAILLE_NON_STANDARD', { parts: 3, inferieure: null, superieure: 4 }), /^Ce gâteau se fait en 4 parts, pas en 3\./);
  assert.deepEqual(sortiePour('ERR_TAILLE_NON_STANDARD', { parts: 20, inferieure: 15, superieure: null }), {
    type: 'correction',
    libelle: 'Passer à 15 parts',
  });
  assert.equal(CATALOGUE.ERR_TAILLE_NON_STANDARD.niveau, 'bloquant');
  assert.equal(CATALOGUE.AVERT_TAILLE_NON_STANDARD_AUTORISEE.niveau, 'avertissement');
  assert.match(messagePour('AVERT_TAILLE_NON_STANDARD_AUTORISEE', { par: 'Karim' }), /acceptée par Karim.*accord du manager est enregistré/);

  assert.deepEqual(sortiePour('AVERT_COMMANDE_INHABITUELLE', {}), {
    type: 'autre',
    libelle: 'Appeler le manager ou proposer WhatsApp',
  });
  assert.match(messagePour('AVERT_COMMANDE_INHABITUELLE', {}), /accord du manager.*WhatsApp/);

  const inventaire = messagePour('AVERT_INVENTAIRE_AVANT_FERMETURE', { heureFermeture: 'Hf' });
  assert.equal(inventaire, 'L’inventaire se fait à partir de Hf, pour un comptage juste. Vous pouvez continuer si c’est voulu.');
  assert.doesNotMatch(inventaire, /interdit|jamais|erreur|faute|devez/i, 'ton neutre, non culpabilisant');

  assert.equal(
    messagePour('ERR_DECOMPTE_INCOMPLET', { restants: 1 }),
    'Il reste 1 article à cocher. Vérifiez-le devant le client avant de valider.',
  );
  assert.match(messagePour('ERR_DECOMPTE_INCOMPLET', { restants: 3 }), /Il reste 3 articles/);
  assert.doesNotMatch(messagePour('ERR_DECOMPTE_INCOMPLET', { restants: 3 }), /remise|remettre/, '« remise » ne désigne plus le retrait');
  assert.deepEqual(sortiePour('ERR_DECOMPTE_INCOMPLET', { restants: 3 }), { type: 'correction', libelle: 'Aller aux articles à cocher' });

  // Aucun chiffre en dur : sans chiffre dans les paramètres, aucun chiffre dans le texte.
  for (const m of [
    messagePour('ERR_COMMANDE_LENDEMAIN', { dateRetrait: 'demain' }),
    messagePour('INFO_COMMANDE_LENDEMAIN', { jour: 'J', demain: true }),
    messagePour('INFO_COMMANDE_LENDEMAIN', { jour: 'J', demain: false }),
    messagePour('ERR_HEURE_HORS_OUVERTURE', { ouverture: 'H', fermeture: 'H', jour: 'le samedi', heureProposee: 'H' }),
    messagePour('INFO_COMMANDE_JOUR_MEME', {}),
    messagePour('AVERT_TAILLE_NON_STANDARD_AUTORISEE', { par: 'Karim' }),
    messagePour('AVERT_INVENTAIRE_AVANT_FERMETURE', { heureFermeture: 'H' }),
    messagePour('AVERT_COMMANDE_INHABITUELLE', {}),
  ]) assert.doesNotMatch(m, /\d|€|%/, m);

  // Refus métier : requête comprise, règle qui refuse.
  for (const code of ['ERR_COMMANDE_LENDEMAIN', 'ERR_HEURE_HORS_OUVERTURE', 'ERR_DECOMPTE_INCOMPLET', 'ERR_TAILLE_NON_STANDARD'] as const) {
    assert.equal(statutHttp({ code }), 422, code);
  }
});

test('refus venus de la base : paramètres absents → variante générique, jamais « undefined »', () => {
  // Codes dont la base peut ne transmettre aucun paramètre (src/lib/erreurBase.ts).
  const sansParametre = [
    'ERR_COMMANDE_LENDEMAIN', 'ERR_DATE_PASSEE', 'ERR_ACOMPTE_SUPERIEUR_TOTAL',
    'ERR_TOTAL_INCOHERENT', 'ERR_REMISE_NON_AUTORISEE', 'ERR_QUANTITE_MIN', 'ERR_NB_SYMBOLES_MANQUANT',
    'ERR_DROIT_INSUFFISANT', 'ERR_MONTANT_NUL', 'ERR_SAISIE_INVALIDE',
  ] as const;
  for (const code of sansParametre) {
    const m = messagePour(code, {});
    assert.doesNotMatch(m, JARGON, code);
    assert.doesNotMatch(m, /\(\)|«\s*»|\s\.|\s{2}/, `${code} : trou dans « ${m} »`);
    assert.ok(/[.]$/.test(m), code);
    const s = sortiePour(code, {});
    assert.ok(s && s.libelle.length > 3 && !/undefined/.test(s.libelle), code);
  }
  // Le bouton « Passer à 20 » est à côté : le message ne le répète pas (audit 28/10/2026, 3.10).
  assert.equal(messagePour('ERR_QUANTITE_MIN', { minimum: 20 }), 'Minimum 20 pour ce produit.');
  assert.deepEqual(sortiePour('ERR_QUANTITE_MIN', { minimum: 20 }), { type: 'correction', libelle: 'Passer à 20' });
  // Paramètres complets : textes historiques inchangés.
  assert.equal(
    messagePour('ERR_QUANTITE_MIN', { produit: 'Layer Cake', minimum: 20, unite: 'parts' }),
    'Minimum 20 parts pour « Layer Cake ».',
  );
  // Le rôle technique « gérant » se dit « manager » (propriétaire, 28/10/2026).
  assert.equal(
    messagePour('ERR_DROIT_INSUFFISANT', { action: 'modifier un tarif', role: 'gérant' }),
    'Seul le manager peut modifier un tarif. Demandez-lui de saisir son code, s’il vous plaît.',
  );
});

test('suppléments : une fois par gâteau, sortie en un geste ; jamais sans gâteau', () => {
  assert.equal(
    messagePour('ERR_SUPPLEMENT_TROP_NOMBREUX', { max: 2, produit: 'Bougie' }),
    'Un supplément « Bougie » se compte une fois par gâteau : 2 au maximum.',
  );
  assert.equal(
    messagePour('ERR_SUPPLEMENT_TROP_NOMBREUX', { max: 2 }),
    'Un supplément se compte une fois par gâteau : 2 au maximum.',
  );
  assert.deepEqual(sortiePour('ERR_SUPPLEMENT_TROP_NOMBREUX', { max: 2 }), { type: 'correction', libelle: 'Passer à 2' });
  assert.equal(CATALOGUE.ERR_SUPPLEMENT_TROP_NOMBREUX.niveau, 'bloquant');

  assert.match(messagePour('ERR_SUPPLEMENT_SANS_GATEAU', { produit: 'Bougie' }), /^Un supplément « Bougie » .*gâteau/);
  const nu = messagePour('ERR_SUPPLEMENT_SANS_GATEAU', {});
  assert.doesNotMatch(nu, /«\s*»|\s{2}|undefined/, nu);
  assert.deepEqual(sortiePour('ERR_SUPPLEMENT_SANS_GATEAU', {}), { type: 'correction', libelle: 'Supprimer la ligne' });
  assert.equal(CATALOGUE.ERR_SUPPLEMENT_SANS_GATEAU.niveau, 'bloquant');
});

test('quantité invalide : « positif ou zéro » en inventaire, « supérieur à zéro » ailleurs', () => {
  assert.equal(messagePour('ERR_QUANTITE_INVALIDE', { unite: 'piece' }), 'Indiquez un nombre entier de pièces supérieur à zéro.');
  assert.equal(
    messagePour('ERR_QUANTITE_INVALIDE', { unite: 'piece', zeroAccepte: true }),
    'Indiquez un nombre entier de pièces positif ou zéro.',
  );
  assert.equal(
    messagePour('ERR_QUANTITE_INVALIDE', { unite: 'kg', zeroAccepte: true }),
    'Indiquez un poids positif ou zéro, en kilos, lu sur la balance.',
  );
  assert.match(messagePour('ERR_QUANTITE_INVALIDE', { unite: 'kg', zeroAccepte: false }), /supérieur à zéro/);
});

test('champ obligatoire : accord correct quel que soit le libellé (masculin, féminin, voyelle, h muet)', () => {
  for (const champLibelle of ['acompte', 'heure de prise', 'téléphone', 'libellé', 'adresse']) {
    const m = messagePour('ERR_CHAMP_OBLIGATOIRE', { champLibelle });
    assert.equal(m, `Le champ « ${champLibelle} » est obligatoire : remplissez-le pour continuer.`);
    assert.doesNotMatch(m, /\ble [aeiouéèêh]/i, m);
  }
  // Champs de l'écran de commande : phrase courte sous le champ (propriétaire, 28/10/2026).
  const consignes: [string, string][] = [
    ['nom du client', 'Indiquez le nom du client.'],
    ['téléphone du client', 'Indiquez un numéro de téléphone.'],
    ['date de retrait', 'Choisissez le jour de retrait.'],
    ['heure de retrait', 'Choisissez l’heure de retrait.'],
    ['Description de la demande', 'Décrivez ce que veut le client.'],
  ];
  for (const [champLibelle, attendu] of consignes) assert.equal(messagePour('ERR_CHAMP_OBLIGATOIRE', { champLibelle }), attendu);
  assert.deepEqual(sortiePour('ERR_CHAMP_OBLIGATOIRE', { champLibelle: 'heure de retrait' }), {
    type: 'correction',
    libelle: 'Remplir « heure de retrait »',
  });
});

test('typographie : espaces insécables avant « : ; ? % € », dans « … », ordinal 2ᵉ ; idempotent', () => {
  assert.equal(
    typographier('Essayez d’obtenir 50 % : « Bavarois » ; 12,00 € ? Ajoutez un 2e pain.'),
    'Essayez d’obtenir 50 % : « Bavarois » ; 12,00 € ? Ajoutez un 2ᵉ pain.',
  );
  assert.equal(typographier('Commande n° 2026-0016'), 'Commande n° 2026-0016');
  for (const [code, entree] of Object.entries(CATALOGUE)) {
    const m = typographier((entree.message as (p: unknown) => string)(exemple(code as CodeCatalogue)));
    assert.doesNotMatch(m, / [:;?!%»]|« /, `${code} : espace sécable restante dans « ${m} »`);
    assert.equal(typographier(m), m, `${code} : typographier est idempotent`);
  }
});

test('panne réseau : le vendeur sait que rien n’est enregistré, sans « serveur » ni délai irréaliste', () => {
  const avec = messagePour('ERR_SERVEUR_INDISPONIBLE', { reference: 'K7Q-3MD' });
  assert.match(avec, /^Pas de connexion : rien n’a été enregistré\./);
  assert.match(avec, /manager \(référence K7Q-3MD\)\.$/);
  assert.doesNotMatch(avec, /quelques minutes|serveur/i);
  // Sans référence (réseau coupé avant toute réponse) : jamais de « référence . ».
  const sans = messagePour('ERR_SERVEUR_INDISPONIBLE', { reference: '' });
  assert.equal(sans, 'Pas de connexion : rien n’a été enregistré. Réessayez dans un instant.');
  assert.ok(!sans.includes(' ; '), 'modele.ts coupe au « ; » : la variante sans référence n’en a pas');
  assert.match(messagePour('ERR_CONFIGURATION_SERVEUR', { reference: '' }), /Prévenez le manager\.$/);
  // Commande gardée sur la tablette (texte posé par le formulaire, lot 3).
  assert.equal(
    messagePour('INFO_COMMANDE_GARDEE_SUR_TABLETTE', {}),
    'Pas de connexion : la commande est gardée sur cette tablette et sera envoyée dès le retour du réseau.',
  );
  // Impression : la commande reste enregistrée, les bons ne sont pas partis.
  assert.match(messagePour('ERR_IMPRESSION_NON_ENVOYEE', {}), /bons ne sont pas partis.*reste enregistrée/);
});
