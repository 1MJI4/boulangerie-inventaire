// node --test src/domaine/decisions2610.test.ts
//
// Décisions du propriétaire du 26/10/2026 :
//   R63 — forme du gâteau (carré ou rond), rond jusqu'à 8 parts, au-delà Layer Cake ;
//   R64 — Pâte à sucre : supplément PAR PERSONNE, gâteau d'au moins 20 parts ;
//   R65 — Matadi chocolat 4P : ne se fait pas → Matadi 6P ou Mousse chocolat 4P.
// Sur le VRAI catalogue (data/) : aucun prix écrit en dur (LOI 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogueDepuisDossier } from '../catalogue/chargerFichiers.ts';
import { creerApiCatalogue } from '../catalogue/catalogue.ts';
import { CORRESPONDANCES_COMPTOIR } from '../catalogue/correspondancesComptoir.ts';
import { GOUTS_SUR_COMMANDE } from '../catalogue/goutsSurCommande.ts';

import { multiplier, somme } from './argent.ts';
import type { JourFerme } from './calendrier.ts';
import {
  DELAIS_PAR_DEFAUT,
  FAMILLE_SUPPLEMENT,
  REGLEMENT_COMMANDE,
  REGLES_FORME,
  SUPPLEMENTS_PAR_PERSONNE,
  TAILLES_INTERDITES,
} from './constantes.ts';
import {
  blocagesCommande,
  controlerCommande,
  controlerLigne,
  resoudreDepuisCatalogue,
  type CommandeSaisie,
  type ContexteCommande,
  type LigneSaisie,
} from './commande.ts';
import { formesPossibles, validerForme, type SortiesRondImpossible } from './formes.ts';
import { gateauxDeLigne } from './supplements.ts';
import { estGateauSimpleSurCommande, taillesAPartirDuMinimum } from './minimums.ts';
import { validerTailleAutorisee } from './taillesInterdites.ts';
import { messagePour, sortiePour } from './messages.ts';
import type { FicheTarifee, SortieRemplacement } from './types.ts';

const charge = chargerCatalogueDepuisDossier();
const api = creerApiCatalogue(charge.catalogue);
const resoudre = resoudreDepuisCatalogue(api);

const PRISE = '2026-10-28'; // mercredi, Pâte à sucre au tarif depuis le 26/10/2026
const RETRAIT = '2026-10-30'; // vendredi
const FERMES: JourFerme[] = [{ id: 1, nature: 'hebdomadaire', jourSemaineIso: 2, libelle: 'mardi' }];

const ID = {
  bavarois: 'gateaux-sur-commande/bavarois',
  entremet: 'gateaux-sur-commande/entremet',
  creme: 'gateaux-sur-commande/creme-fraiche',
  cake: 'gateaux-sur-commande/cake-nature',
  layer: 'gateaux-sur-commande/layer-cake',
  number: 'gateaux-sur-commande/number-cake',
  pieceMontee: 'gateaux-sur-commande/piece-montee',
  pate: 'gateaux-sur-commande/supplement-pate-a-sucre',
  photo: 'gateaux-sur-commande/supplement-photo',
  bavarois6p: 'gateaux-et-tartes/bavarois/6p',
  bavarois10p: 'gateaux-et-tartes/bavarois/10p',
  matadi4p: 'gateaux-et-tartes/matadi-chocolat/4p',
  matadi6p: 'gateaux-et-tartes/matadi-chocolat/6p',
  matadi8p: 'gateaux-et-tartes/matadi-chocolat/8p',
  mousse4p: 'gateaux-et-tartes/mousse-chocolat/4p',
};

/** Contexte complet, tel que la route doit le passer une fois l'écran prêt. */
const ctx: ContexteCommande = {
  resoudre,
  joursFermes: FERMES,
  delais: DELAIS_PAR_DEFAUT,
  reglement: { ...REGLEMENT_COMMANDE, acomptePourcentageMin: 0 },
  correspondancesComptoir: CORRESPONDANCES_COMPTOIR,
  goutsSurCommande: GOUTS_SUR_COMMANDE,
  formes: REGLES_FORME,
  supplementsParPersonne: SUPPLEMENTS_PAR_PERSONNE,
  taillesInterdites: TAILLES_INTERDITES,
};

function fiche(id: string, date = PRISE): FicheTarifee {
  const r = resoudre(id, date);
  assert.ok(r.ok, `${id} introuvable au catalogue le ${date}`);
  return r.donnees;
}
const prixDe = (id: string) => fiche(id).prix.prixCentimes;

const G = ['Framboise'];
const ligne = (produitId: string, quantite: number, extra: Partial<LigneSaisie> = {}): LigneSaisie => ({
  produitId,
  quantite,
  gouts: GOUTS_SUR_COMMANDE[produitId] ? G : undefined,
  ...extra,
});

function commande(lignes: LigneSaisie[], extra: Partial<CommandeSaisie> = {}): CommandeSaisie {
  return {
    client: 'Dupont',
    telephone: '0470 12 34 56',
    datePrise: PRISE,
    heurePrise: '10:15',
    dateRetrait: RETRAIT,
    heureRetrait: '14:00',
    lignes,
    ...extra,
  };
}

function refus(l: LigneSaisie, c: Partial<ContexteCommande> = {}) {
  const r = controlerLigne(l, 0, PRISE, { ...ctx, ...c });
  assert.equal(r.ok, false, 'la ligne devait être refusée');
  if (r.ok) throw new Error('inatteignable');
  return r;
}
function accepte(l: LigneSaisie, c: Partial<ContexteCommande> = {}) {
  const r = controlerLigne(l, 0, PRISE, { ...ctx, ...c });
  assert.ok(r.ok, r.ok ? '' : `${r.code} : ${r.message}`);
  return r.donnees;
}

// ===========================================================================
// R63 — forme du gâteau
// ===========================================================================

test('R63 : Entremet 6 parts sans forme → ERR_FORME_MANQUANTE, boutons Carré / Rond', () => {
  const r = refus(ligne(ID.entremet, 6));
  assert.equal(r.code, 'ERR_FORME_MANQUANTE');
  assert.equal(r.niveau, 'bloquant');
  assert.equal(r.champ, 'lignes[0].forme');
  assert.deepEqual(r.valeurProposee, ['carre', 'rond']);
  assert.match(r.message, /« Entremet ».*carré ou rond/);
});

test('R63 : 4 à 8 parts → carré OU rond acceptés (8 inclus)', () => {
  for (const parts of [4, 6, 8]) {
    for (const forme of ['carre', 'rond'] as const) {
      // Entremet : aucune taille au comptoir (R60), la ligne reste au prix par personne.
      assert.equal(accepte(ligne(ID.entremet, parts, { forme })).forme, forme, `${parts} parts ${forme}`);
    }
  }
  assert.equal(accepte(ligne(ID.creme, 4, { forme: 'rond' })).forme, 'rond');
  assert.equal(accepte(ligne(ID.cake, 4, { forme: 'carre' })).forme, 'carre');
});

test('R63 : au-dessus de 8 parts, forme absente → carré d’office (rien à demander)', () => {
  assert.equal(accepte(ligne(ID.entremet, 10)).forme, 'carre');
  assert.equal(accepte(ligne(ID.bavarois, 15)).forme, 'carre');
  assert.equal(accepte(ligne(ID.bavarois, 15, { forme: '' })).forme, 'carre');
  assert.equal(accepte(ligne(ID.bavarois, 15, { forme: 'carre' })).forme, 'carre');
});

test('R63 : Entremet rond de 10 parts → refus, « Passer en carré » ou « Passer en Layer Cake (20 parts) »', () => {
  const r = refus(ligne(ID.entremet, 10, { forme: 'rond' }));
  assert.equal(r.code, 'ERR_FORME_ROND_IMPOSSIBLE');
  assert.equal(r.champ, 'lignes[0].forme');
  const v = r.valeurProposee as SortiesRondImpossible;
  assert.equal(v.forme, 'carre');
  // Le minimum du Layer Cake est LU au catalogue (LOI 7), jamais écrit ici.
  const minLayer = fiche(ID.layer).prix.minQuantite!;
  assert.deepEqual(v.remplacements, [
    { produitId: ID.layer, libelle: 'Layer Cake', quantite: minLayer, bouton: `Passer en Layer Cake (${minLayer} parts)` },
  ]);
  assert.match(r.message, /rond jusqu’à 8 parts.*en 10 parts, il est carré.*« Layer Cake » \(minimum 20 parts\)/);
  assert.equal(sortiePour('ERR_FORME_ROND_IMPOSSIBLE', { produit: 'Entremet', parts: 10, partsMaxRond: 8 })?.libelle, 'Passer en carré');
});

test('R63 : rond de 25 parts → Layer Cake à 25 parts (max(parts, minimum)), pas 20', () => {
  const r = refus(ligne(ID.bavarois, 25, { forme: 'rond' }));
  const v = r.valeurProposee as SortiesRondImpossible;
  assert.equal(v.remplacements[0].quantite, 25);
  assert.equal(v.remplacements[0].bouton, 'Passer en Layer Cake (25 parts)');
  assert.doesNotMatch(r.message, /minimum/);
});

test('R63 : les deux sorties appliquées passent (carré, ou Layer Cake avec son goût)', () => {
  accepte(ligne(ID.entremet, 10, { forme: 'carre', gouts: ['Javanais'] }));
  const v = refus(ligne(ID.bavarois, 15, { forme: 'rond' })).valeurProposee as SortiesRondImpossible;
  const layer = v.remplacements[0];
  // L'écran remplace produit et quantité ; le goût (même liste « parfum ») est gardé ; la forme n'est plus demandée.
  const l = accepte(ligne(layer.produitId, layer.quantite, { forme: 'rond' }));
  assert.equal(l.forme, undefined);
  assert.equal(l.quantite, 20);
});

test('R63 : Layer Cake sans tarif à la date → seule la sortie « Passer en carré »', () => {
  const sansLayer = (id: string, date: string) => (id === ID.layer ? resoudre('inconnu', date) : resoudre(id, date));
  const r = refus(ligne(ID.entremet, 10, { forme: 'rond' }), { resoudre: sansLayer });
  assert.equal(r.code, 'ERR_FORME_ROND_IMPOSSIBLE');
  assert.deepEqual((r.valeurProposee as SortiesRondImpossible).remplacements, []);
  assert.match(r.message, /Passez en carré\.$/);
});

test('R63 : gâteau devenu gâteau du comptoir (R60) — forme du gâteau commandé, à SES parts', () => {
  const origine = { origineSurCommande: ID.bavarois, gouts: G };
  const sans = refus({ produitId: ID.bavarois6p, quantite: 1, ...origine });
  assert.equal(sans.code, 'ERR_FORME_MANQUANTE');
  assert.equal(accepte({ produitId: ID.bavarois6p, quantite: 1, ...origine, forme: 'rond' }).forme, 'rond');
  // Bavarois 10P : 10 parts (correspondance), pas 1 → carré d'office, rond refusé.
  assert.equal(accepte({ produitId: ID.bavarois10p, quantite: 1, ...origine }).forme, 'carre');
  assert.equal(refus({ produitId: ID.bavarois10p, quantite: 1, ...origine, forme: 'rond' }).code, 'ERR_FORME_ROND_IMPOSSIBLE');
});

test('R63 n’interdit pas : vitrine sans origine, Layer Cake, Number Cake, pièce montée, minis', () => {
  assert.equal(accepte({ produitId: ID.bavarois6p, quantite: 1 }).forme, undefined);
  assert.equal(accepte(ligne(ID.layer, 20)).forme, undefined);
  assert.equal(accepte(ligne(ID.layer, 20, { forme: 'rond' })).forme, undefined);
  assert.equal(accepte(ligne(ID.number, 15, { nbSymboles: 1 })).forme, undefined);
  assert.equal(accepte(ligne(ID.pieceMontee, 60, { gouts: ['A', 'B', 'C'] })).forme, undefined);
  assert.equal(accepte(ligne('gateaux-sur-commande/mini-bavarois', 15)).forme, undefined);
});

test('R63 : forme illisible (donnée altérée, synchro) → ERR_SAISIE_INVALIDE', () => {
  const r = refus(ligne(ID.entremet, 6, { forme: 'ovale' }));
  assert.equal(r.code, 'ERR_SAISIE_INVALIDE');
  assert.equal(r.champ, 'lignes[0].forme');
  assert.deepEqual(r.valeurProposee, ['carre', 'rond']);
  assert.equal(refus(ligne(ID.entremet, 15, { forme: 'RECTANGLE' })).code, 'ERR_SAISIE_INVALIDE');
});

test('R63 : le seuil est une donnée (gérant à 10 → rond de 10 accepté) ; seuil illisible → jamais de rond', () => {
  const a10 = { formes: { ...REGLES_FORME, partsMaxRond: 10 } };
  assert.equal(accepte(ligne(ID.entremet, 10, { forme: 'rond' }), a10).forme, 'rond');
  const casse = { formes: { ...REGLES_FORME, partsMaxRond: Number.NaN } };
  assert.equal(refus(ligne(ID.entremet, 4, { forme: 'rond' }), casse).code, 'ERR_FORME_ROND_IMPOSSIBLE');
  assert.equal(accepte(ligne(ID.entremet, 4), casse).forme, 'carre');
});

test('R63 : contexte sans `formes` → règle non contrôlée (activation par la route, comme R62)', () => {
  assert.equal(accepte(ligne(ID.entremet, 6), { formes: undefined }).forme, undefined);
});

test('R63 : formesPossibles pour l’écran', () => {
  assert.deepEqual(formesPossibles(ID.entremet, 8, REGLES_FORME), ['carre', 'rond']);
  assert.deepEqual(formesPossibles(ID.entremet, 9, REGLES_FORME), ['carre']);
  assert.deepEqual(formesPossibles(ID.layer, 20, REGLES_FORME), []);
  assert.deepEqual(formesPossibles(null, 6, REGLES_FORME), []);
});

test('R63 : saisie hors ligne d’un rond 15 parts, rejouée au serveur → refusée à l’arrivée', () => {
  const c = commande([ligne(ID.entremet, 15, { forme: 'rond' })]);
  const tablette = blocagesCommande(c, ctx);
  const serveur = blocagesCommande(JSON.parse(JSON.stringify(c)), ctx);
  assert.deepEqual(serveur, tablette);
  assert.equal(serveur[0]?.code, 'ERR_FORME_ROND_IMPOSSIBLE');
});

test('R63 : validerForme est pure (gâteau non concerné → null)', () => {
  assert.deepEqual(validerForme(ID.layer, 'Layer Cake', 30, 'rond', REGLES_FORME, null), { ok: true, donnees: null, signalements: [] });
});

// ===========================================================================
// R64 — Pâte à sucre, supplément par personne
// ===========================================================================

test('R64 : Layer Cake 20 parts + Pâte à sucre 20 parts → total = 20 × Layer + 20 × Pâte à sucre', () => {
  const r = controlerCommande(commande([ligne(ID.layer, 20), ligne(ID.pate, 20)]), ctx);
  assert.ok(r.ok, r.ok ? '' : r.message);
  const [layer, pate] = r.donnees.lignes;
  assert.equal(pate.totalCentimes, multiplier(20, prixDe(ID.pate)));
  assert.equal(pate.supplementParPersonne, true);
  assert.equal(pate.nbGateaux, 0);
  assert.equal(r.donnees.totalCentimes, somme([multiplier(20, prixDe(ID.layer)), multiplier(20, prixDe(ID.pate))]));
  assert.equal(layer.nbGateaux, 1);
  assert.notEqual(pate.totalCentimes, prixDe(ID.pate));
});

test('R64 : Pâte à sucre seule → ERR_SUPPLEMENT_SANS_GATEAU, « Supprimer la ligne »', () => {
  const b = blocagesCommande(commande([ligne(ID.pate, 20)]), ctx);
  assert.equal(b.length, 1);
  assert.equal(b[0].code, 'ERR_SUPPLEMENT_SANS_GATEAU');
  assert.equal(b[0].champ, 'lignes[0].produitId');
  assert.equal(b[0].valeurProposee, 0);
});

test('R64 : gâteau de 15 parts → ERR_QUANTITE_MIN sur le GÂTEAU, « Passer à 20 parts », puis parts à recopier', () => {
  const b = blocagesCommande(commande([ligne(ID.entremet, 15), ligne(ID.pate, 15)]), ctx);
  assert.equal(b.length, 1);
  assert.equal(b[0].code, 'ERR_QUANTITE_MIN');
  assert.equal(b[0].champ, 'lignes[0].quantite');
  assert.equal(b[0].valeurProposee, 20);
  assert.match(b[0].message, /Minimum 20 parts pour « Entremet » \(avec « Pâte à sucre »\)/);
  // Sortie appliquée : le gâteau passe à 20 ; la Pâte à sucre doit suivre.
  const b2 = blocagesCommande(commande([ligne(ID.entremet, 20), ligne(ID.pate, 15)]), ctx);
  assert.equal(b2.length, 1);
  assert.equal(b2[0].code, 'ERR_SUPPLEMENT_PARTS');
  assert.equal(b2[0].champ, 'lignes[1].quantite');
  assert.equal(b2[0].valeurProposee, 20);
  assert.ok(controlerCommande(commande([ligne(ID.entremet, 20), ligne(ID.pate, 20)]), ctx).ok);
});

test('R64 : Pâte à sucre sur un gâteau carré/rectangle (pas forcément un Layer Cake)', () => {
  for (const id of [ID.bavarois, ID.creme, ID.cake, ID.entremet]) {
    const r = controlerCommande(commande([ligne(id, 20), ligne(ID.pate, 20)]), ctx);
    assert.ok(r.ok, `${id} : ${r.ok ? '' : r.message}`);
    assert.equal(r.donnees.lignes[0].forme, 'carre');
  }
});

test('R64 : Number Cake, pièce montée → ERR_SUPPLEMENT_NON_ADMIS (liste en clair, minimum cité)', () => {
  const b = blocagesCommande(commande([ligne(ID.number, 30, { nbSymboles: 2 }), ligne(ID.pate, 30)]), ctx);
  assert.equal(b.length, 1);
  assert.equal(b[0].code, 'ERR_SUPPLEMENT_NON_ADMIS');
  assert.equal(b[0].valeurProposee, 1);
  assert.match(b[0].message, /seulement sur : Layer Cake, Bavarois, Crème fraîche, Entremet, Cake nature \(20 parts au moins\)/);
  const pm = blocagesCommande(commande([ligne(ID.pieceMontee, 60, { gouts: ['A', 'B', 'C'] }), ligne(ID.pate, 60)]), ctx);
  assert.equal(pm[0].code, 'ERR_SUPPLEMENT_NON_ADMIS');
});

test('R64 : deux Pâte à sucre pour un seul gâteau → ERR_SUPPLEMENT_TROP_NOMBREUX, sortie = retirer (0)', () => {
  const b = blocagesCommande(commande([ligne(ID.layer, 20), ligne(ID.pate, 20), ligne(ID.pate, 20)]), ctx);
  assert.equal(b.length, 1);
  assert.equal(b[0].code, 'ERR_SUPPLEMENT_TROP_NOMBREUX');
  assert.equal(b[0].champ, 'lignes[2].quantite');
  assert.equal(b[0].valeurProposee, 0);
});

test('R64 : deux gâteaux (20 et 25 parts), deux Pâte à sucre dans l’autre ordre → appariées par les parts', () => {
  const r = controlerCommande(
    commande([ligne(ID.layer, 20), ligne(ID.layer, 25), ligne(ID.pate, 25), ligne(ID.pate, 20)]),
    ctx,
  );
  assert.ok(r.ok, r.ok ? '' : r.message);
});

test('R64 : la Pâte à sucre n’est jamais un gâteau (photo, goût, tailles standard)', () => {
  const pate = fiche(ID.pate);
  assert.equal(pate.produit.famille, FAMILLE_SUPPLEMENT);
  assert.equal(gateauxDeLigne({ regimePrix: 'C', basePrix: 'personne', quantite: 20, famille: FAMILLE_SUPPLEMENT }, ['gateau']), 0);
  assert.equal(estGateauSimpleSurCommande(pate), false);
  assert.deepEqual(taillesAPartirDuMinimum(pate), []);
  // 2 photos pour 1 Layer Cake + Pâte à sucre : la Pâte à sucre n'ouvre pas une 2e photo.
  const b = blocagesCommande(commande([ligne(ID.layer, 20), ligne(ID.pate, 20), ligne(ID.photo, 2)]), ctx);
  assert.equal(b[0]?.code, 'ERR_SUPPLEMENT_TROP_NOMBREUX');
  assert.equal(b[0]?.valeurProposee, 1);
  // 22 parts : pas une taille standard, mais ni le Layer Cake ni la Pâte à sucre n'y sont soumis ; aucun goût demandé.
  assert.ok(controlerCommande(commande([ligne(ID.layer, 22), ligne(ID.pate, 22)]), ctx).ok);
});

test('R64 n’interdit pas : Pâte à sucre + Photo + Écriture sur le même gâteau', () => {
  const r = controlerCommande(
    commande([ligne(ID.layer, 30), ligne(ID.pate, 30), ligne(ID.photo, 1), ligne('gateaux-sur-commande/supplement-ecriture-simple', 1)]),
    ctx,
  );
  assert.ok(r.ok, r.ok ? '' : r.message);
});

test('R64 : cas limites — prix modifié, quantité décimale, date avant le tarif, contexte par défaut', () => {
  assert.equal(refus(ligne(ID.pate, 20, { prixUnitaireCentimes: prixDe(ID.pate) - 100 })).code, 'ERR_TARIF_INCOHERENT');
  assert.equal(refus(ligne(ID.pate, 20.5)).code, 'ERR_QUANTITE_INVALIDE');
  assert.equal(refus(ligne(ID.pate, 0)).code, 'ERR_QUANTITE_INVALIDE');
  assert.equal(refus(ligne(ID.pate, -20)).code, 'ERR_QUANTITE_INVALIDE');
  const avant = controlerLigne(ligne(ID.pate, 20), 0, '2026-10-20', ctx);
  assert.equal(avant.ok ? null : avant.code, 'ERR_TARIF_ABSENT');
  // Sans `supplementsParPersonne` dans le contexte : la donnée par défaut s'applique quand même.
  const b = blocagesCommande(commande([ligne(ID.pate, 20)]), { ...ctx, supplementsParPersonne: undefined });
  assert.equal(b[0]?.code, 'ERR_SUPPLEMENT_SANS_GATEAU');
});

// ===========================================================================
// R65 — Matadi chocolat 4P
// ===========================================================================

test('R65 : Matadi chocolat 4P → ERR_TAILLE_INTERDITE, « Passer en Matadi chocolat 6P » / « Prendre Mousse chocolat 4P »', () => {
  const r = refus({ produitId: ID.matadi4p, quantite: 1 });
  assert.equal(r.code, 'ERR_TAILLE_INTERDITE');
  assert.equal(r.niveau, 'bloquant');
  assert.equal(r.champ, 'lignes[0].produitId');
  assert.deepEqual(r.valeurProposee as SortieRemplacement[], [
    { produitId: ID.matadi6p, libelle: 'Matadi chocolat 6P', quantite: 1, bouton: 'Passer en Matadi chocolat 6P' },
    { produitId: ID.mousse4p, libelle: 'Mousse chocolat 4P', quantite: 1, bouton: 'Prendre Mousse chocolat 4P' },
  ]);
  assert.equal(r.message, '« Matadi chocolat 4P » ne se fait pas. Proposez au client « Matadi chocolat 6P » ou « Mousse chocolat 4P ».');
});

test('R65 : 2 Matadi chocolat 4P → les remplaçants gardent la quantité (2)', () => {
  const v = refus({ produitId: ID.matadi4p, quantite: 2 }).valeurProposee as SortieRemplacement[];
  assert.deepEqual(v.map((x) => x.quantite), [2, 2]);
});

test('R65 n’interdit pas : Matadi chocolat 6P et 8P, Mousse chocolat 4P ; le tarif comptoir garde sa ligne 4P', () => {
  for (const id of [ID.matadi6p, ID.matadi8p, ID.mousse4p]) accepte({ produitId: id, quantite: 1 });
  // LOI 5 : la ligne du tarif n'est pas supprimée (le refus est celui de la commande).
  assert.ok(api.getProduit(ID.matadi4p).ok);
});

test('R65 : remplaçant sans tarif → non proposé ; aucun → « Choisir un autre produit »', () => {
  const f = fiche(ID.matadi4p);
  const sansMousse = (id: string) => (id === ID.mousse4p ? null : fiche(id));
  const un = validerTailleAutorisee(f, 1, TAILLES_INTERDITES, sansMousse);
  assert.ok(!un.ok);
  if (!un.ok) assert.equal((un.valeurProposee as SortieRemplacement[]).length, 1);
  const aucun = validerTailleAutorisee(f, 1, TAILLES_INTERDITES, () => null);
  assert.ok(!aucun.ok);
  if (!aucun.ok) {
    assert.deepEqual(aucun.valeurProposee, []);
    assert.match(aucun.message, /Choisissez un autre produit\.$/);
  }
  assert.equal(sortiePour('ERR_TAILLE_INTERDITE', { produit: 'P', remplacements: [] })?.libelle, 'Choisir un autre produit');
});

test('R65 : contexte sans `taillesInterdites` → non contrôlé (activation par la route) ; refus rejoué au serveur', () => {
  accepte({ produitId: ID.matadi4p, quantite: 1 }, { taillesInterdites: undefined });
  const c = commande([{ produitId: ID.matadi4p, quantite: 1 }]);
  assert.equal(blocagesCommande(JSON.parse(JSON.stringify(c)), ctx)[0]?.code, 'ERR_TAILLE_INTERDITE');
});

// ===========================================================================
// Les données du 26/10/2026 citent de vrais produits
// ===========================================================================

test('données : chaque clé de REGLES_FORME, SUPPLEMENTS_PAR_PERSONNE et TAILLES_INTERDITES existe au catalogue', () => {
  for (const id of REGLES_FORME.produits) {
    assert.ok(estGateauSimpleSurCommande(fiche(id)), `${id} : gâteau simple sur commande attendu`);
  }
  const rond = fiche(REGLES_FORME.gateauRondGrand!);
  assert.equal(rond.produit.regimePrix, 'C');
  assert.equal(rond.prix.basePrix, 'personne');
  for (const [id, regle] of Object.entries(SUPPLEMENTS_PAR_PERSONNE)) {
    const f = fiche(id);
    assert.equal(f.produit.famille, FAMILLE_SUPPLEMENT, id);
    assert.equal(f.prix.basePrix, 'personne', id);
    assert.equal(f.prix.prixEstPlancher, false, `${id} : prix fixe`);
    for (const g of regle.gateaux) assert.equal(fiche(g).prix.basePrix, 'personne', g);
    assert.ok(Number.isSafeInteger(regle.partsMin) && regle.partsMin > 0);
  }
  for (const t of TAILLES_INTERDITES) {
    fiche(t.produit);
    for (const r of t.remplacements) fiche(r.produitId);
  }
});

test('messages du 26/10 : français, disent quoi faire', () => {
  assert.equal(messagePour('ERR_FORME_MANQUANTE', { produit: 'Bavarois' }), 'Choisissez la forme de « Bavarois » : carré ou rond.');
  assert.equal(
    messagePour('ERR_SUPPLEMENT_PARTS', { produit: 'Pâte à sucre', gateau: 'Layer Cake', parts: 25 }),
    '« Pâte à sucre » se compte par part du gâteau : « Layer Cake » fait 25 parts. Mettez 25 parts de « Pâte à sucre ».',
  );
});
