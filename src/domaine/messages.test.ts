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

import { APPELER_LE_GERANT, CATALOGUE, estCodeCatalogue, messagePour, sortiePour, type CodeCatalogue } from './messages.ts';
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
  ERR_JOUR_FERME: { jour: 'mardi' },
  ERR_PERIODE_CONGES: {},
  ERR_DATE_PASSEE: { premiereDate: 'jeudi 16 octobre' },
  ERR_DELAI_TROP_COURT: { delaiJoursOuvres: 2, premiereDate: 'jeudi 23 octobre' },
  ERR_QUANTITE_MIN: { produit: 'P', minimum: 10, unite: 'pièces' },
  ERR_QUANTITE_INVALIDE: { unite: 'kg', proposition: '1' },
  ERR_QUANTITE_NEGATIVE: { produit: 'P' },
  ERR_NB_SYMBOLES_MANQUANT: { produit: 'Number Cake' },
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
  ERR_STATUT_INCOHERENT: { de: 'Remise au client', vers: 'À imprimer' },
  ERR_COMMANDE_FIGEE: { etat: 'annulée' },
  ERR_ACOMPTE_INSUFFISANT: { acompteFormate: 'A €', minimumFormate: 'M €', pourcentage: 50 },
  ERR_COMMANDE_LENDEMAIN: { dateRetrait: 'jeudi 16 octobre' },
  ERR_HEURE_RETRAIT_TROP_TOT: { heureMin: 'Hh', jour: 'samedi' },
  ERR_TAILLE_NON_STANDARD: { parts: 7, inferieure: 6, superieure: 8 },
  AVERT_TAILLE_NON_STANDARD_AUTORISEE: { par: 'Karim' },
  ERR_DECOMPTE_INCOMPLET: { restants: 2 },
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
  INFO_COMMANDE_LENDEMAIN: { dateRetrait: 'vendredi 16 octobre' },
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

const JARGON = /prisma|database|http|\b[45]\d\d\b|undefined|null|NaN|error|failed|validation|\btu\b|\bton\b|\bta\b/i;

test('tous les messages : français, sans « ! », sans jargon, terminés, niveau = préfixe', () => {
  for (const [code, entree] of Object.entries(CATALOGUE)) {
    const m = (entree.message as (p: unknown) => string)(exemple(code as CodeCatalogue));
    assert.ok(m.length > 10, code);
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
  assert.deepEqual(correction('ERR_DROIT_INSUFFISANT'), { type: 'correction', libelle: 'Saisir le code gérant' });
  assert.deepEqual(correction('ERR_SESSION_EXPIREE'), { type: 'correction', libelle: 'Réinstaller la tablette' });
  assert.deepEqual(correction('ERR_PRODUIT_INCONNU'), { type: 'correction', libelle: 'Choisir un autre produit' });
  assert.deepEqual(correction('ERR_TARIF_ABSENT'), { type: 'correction', libelle: 'Choisir un autre produit' });
  assert.deepEqual(correction('ERR_SAISIE_INVALIDE'), { type: 'correction', libelle: 'Corriger « Téléphone »' });
  for (const c of ['ERR_UNITE_FIGEE', 'ERR_REGIME_FIGE', 'ERR_TARIF_IMMUABLE', 'ERR_TARIF_PASSE', 'ERR_TARIF_CHEVAUCHEMENT', 'ERR_TARIF_INCOHERENT'] as const) {
    assert.equal(correction(c)?.type, 'correction', c);
  }
  // Aucune action possible depuis l'écran : l'écran affiche « Appeler le gérant ».
  for (const c of ['ERR_CONFIGURATION_SERVEUR', 'ERR_CATALOGUE_ABSENT', 'ERR_TROP_DE_TENTATIVES'] as const) {
    assert.deepEqual(correction(c), { type: 'autre', libelle: APPELER_LE_GERANT }, c);
  }
});

test('accès : messages du catalogue (anciennement locaux à codes.ts et proxy.ts)', () => {
  assert.equal(
    messagePour('ERR_SESSION_EXPIREE', {}),
    'Cette tablette doit être réinstallée : saisissez le code de la tablette.',
  );
  assert.equal(messagePour('ERR_TROP_DE_TENTATIVES', { minutes: 1 }), 'Trop d’essais. Réessayez dans 1 minute, ou demandez au gérant.');
  assert.match(messagePour('ERR_TROP_DE_TENTATIVES', { minutes: 7 }), /dans 7 minutes/);
  assert.match(messagePour('ERR_CODE_INCORRECT', {}), /gérant/);
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
  const acompte = { acompteFormate: 'A €', minimumFormate: 'M €', pourcentage: 37 };
  assert.equal(
    messagePour('ERR_ACOMPTE_INSUFFISANT', acompte),
    'L’acompte doit être d’au moins 37 % du total pour valider la commande (A € saisi). ' +
      'Demandez au client un acompte de M € au minimum.',
  );
  assert.deepEqual(sortiePour('ERR_ACOMPTE_INSUFFISANT', acompte), { type: 'correction', libelle: 'Mettre l’acompte à M €' });

  // R53 (15/10/2026) : le lendemain est accepté, simple information sans friction.
  const lendemain = { dateRetrait: 'vendredi 16 octobre' };
  assert.equal(messagePour('INFO_COMMANDE_LENDEMAIN', lendemain), 'Commande pour demain : prévenez l’atelier.');
  assert.equal(CATALOGUE.INFO_COMMANDE_LENDEMAIN.niveau, 'information');
  assert.equal(niveauDuCode('INFO_COMMANDE_LENDEMAIN'), 'information');
  assert.ok(!estCodeCatalogue('AVERT_COMMANDE_LENDEMAIN_AUTORISEE'), 'plus d’accord gérant pour le lendemain');
  // ERR_COMMANDE_LENDEMAIN : obsolète, gardé tant que la base le produit encore.
  assert.match(messagePour('ERR_COMMANDE_LENDEMAIN', { dateRetrait: 'jeudi 16 octobre' }), /^Retrait le jeudi 16 octobre : .*responsable/);

  assert.equal(
    messagePour('ERR_HEURE_RETRAIT_TROP_TOT', { heureMin: 'Hs', jour: 'samedi' }),
    'Les commandes pâtisserie sont disponibles à partir de Hs ce samedi. Choisissez une heure de retrait à partir de Hs.',
  );
  assert.deepEqual(sortiePour('ERR_HEURE_RETRAIT_TROP_TOT', { heureMin: 'Hw', jour: 'dimanche' }), {
    type: 'correction',
    libelle: 'Passer à Hw',
  });

  // Tailles standard : les deux tailles proches citées, sortie vers la supérieure.
  assert.equal(
    messagePour('ERR_TAILLE_NON_STANDARD', { parts: 7, inferieure: 6, superieure: 8 }),
    'Ce gâteau se fait en 6 ou 8 parts, pas en 7. Choisissez une taille standard ou demandez au gérant de déverrouiller.',
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
  assert.match(messagePour('AVERT_TAILLE_NON_STANDARD_AUTORISEE', { par: 'Karim' }), /autorisée par Karim.*enregistré/);

  assert.deepEqual(sortiePour('AVERT_COMMANDE_INHABITUELLE', {}), {
    type: 'autre',
    libelle: 'Appeler le responsable ou proposer WhatsApp',
  });
  assert.match(messagePour('AVERT_COMMANDE_INHABITUELLE', {}), /responsable.*WhatsApp/);

  const inventaire = messagePour('AVERT_INVENTAIRE_AVANT_FERMETURE', { heureFermeture: 'Hf' });
  assert.equal(inventaire, 'L’inventaire se fait à partir de Hf, pour un comptage juste. Vous pouvez continuer si c’est voulu.');
  assert.doesNotMatch(inventaire, /interdit|jamais|erreur|faute|devez/i, 'ton neutre, non culpabilisant');

  assert.equal(
    messagePour('ERR_DECOMPTE_INCOMPLET', { restants: 1 }),
    'Il reste 1 article à remettre au client. Faites le décompte devant lui avant de valider.',
  );
  assert.match(messagePour('ERR_DECOMPTE_INCOMPLET', { restants: 3 }), /Il reste 3 articles/);
  assert.deepEqual(sortiePour('ERR_DECOMPTE_INCOMPLET', { restants: 3 }), { type: 'correction', libelle: 'Cocher les articles remis' });

  // Aucun chiffre en dur : sans chiffre dans les paramètres, aucun chiffre dans le texte.
  for (const m of [
    messagePour('ERR_COMMANDE_LENDEMAIN', { dateRetrait: 'demain' }),
    messagePour('INFO_COMMANDE_LENDEMAIN', { dateRetrait: 'demain' }),
    messagePour('ERR_HEURE_RETRAIT_TROP_TOT', { heureMin: 'H', jour: 'samedi' }),
    messagePour('AVERT_TAILLE_NON_STANDARD_AUTORISEE', { par: 'Karim' }),
    messagePour('AVERT_INVENTAIRE_AVANT_FERMETURE', { heureFermeture: 'H' }),
    messagePour('AVERT_COMMANDE_INHABITUELLE', {}),
  ]) assert.doesNotMatch(m, /\d|€|%/, m);

  // Refus métier : requête comprise, règle qui refuse.
  for (const code of ['ERR_ACOMPTE_INSUFFISANT', 'ERR_COMMANDE_LENDEMAIN', 'ERR_HEURE_RETRAIT_TROP_TOT', 'ERR_DECOMPTE_INCOMPLET', 'ERR_TAILLE_NON_STANDARD'] as const) {
    assert.equal(statutHttp({ code }), 422, code);
  }
});

test('refus venus de la base : paramètres absents → variante générique, jamais « undefined »', () => {
  // Codes dont la base peut ne transmettre aucun paramètre (src/lib/erreurBase.ts).
  const sansParametre = [
    'ERR_COMMANDE_LENDEMAIN', 'ERR_DATE_PASSEE', 'ERR_ACOMPTE_INSUFFISANT', 'ERR_ACOMPTE_SUPERIEUR_TOTAL',
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
  // Variantes partielles (base : minimum et pourcentage seulement).
  assert.equal(
    messagePour('ERR_ACOMPTE_INSUFFISANT', { minimumFormate: 'M €', pourcentage: 30 }),
    'L’acompte doit être d’au moins 30 % du total pour valider la commande. Demandez au client un acompte de M € au minimum.',
  );
  assert.deepEqual(sortiePour('ERR_ACOMPTE_INSUFFISANT', { minimumFormate: 'M €' }), { type: 'correction', libelle: 'Mettre l’acompte à M €' });
  assert.equal(messagePour('ERR_QUANTITE_MIN', { minimum: 20 }), 'Minimum 20 pour ce produit. Passez à 20 pour continuer.');
  assert.deepEqual(sortiePour('ERR_QUANTITE_MIN', { minimum: 20 }), { type: 'correction', libelle: 'Passer à 20' });
  // Paramètres complets : textes historiques inchangés.
  assert.equal(
    messagePour('ERR_QUANTITE_MIN', { produit: 'Layer Cake', minimum: 20, unite: 'parts' }),
    'Minimum 20 parts pour « Layer Cake ». Passez à 20 parts pour continuer.',
  );
  assert.equal(
    messagePour('ERR_DROIT_INSUFFISANT', { action: 'modifier un tarif', role: 'gérant' }),
    'Seul le gérant peut modifier un tarif. Demandez-lui de le faire ou de saisir son code.',
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
  for (const champLibelle of ['nom du client', 'heure de retrait', 'date de retrait', 'acompte', 'téléphone', 'libellé']) {
    const m = messagePour('ERR_CHAMP_OBLIGATOIRE', { champLibelle });
    assert.equal(m, `Le champ « ${champLibelle} » est obligatoire : remplissez-le pour continuer.`);
    assert.doesNotMatch(m, /\ble [aeiouéèêh]/i, m);
  }
  assert.deepEqual(sortiePour('ERR_CHAMP_OBLIGATOIRE', { champLibelle: 'heure de retrait' }), {
    type: 'correction',
    libelle: 'Remplir « heure de retrait »',
  });
});
