// node --test src/domaine/viandes.test.ts
//
// R73 — viande obligatoire sur les burgers (propriétaire, 19/11/2026) :
// « éviter qu'on mette un burger sans viande ». Une viande par ligne (15 kefta
// et 15 tenders = deux lignes) ; le minimum se compte sur le TOTAL des lignes
// du même burger. Vrai catalogue : aucun prix en dur (LOI 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogueDepuisDossier } from '../catalogue/chargerFichiers.ts';
import { creerApiCatalogue } from '../catalogue/catalogue.ts';
import { CORRESPONDANCES_COMPTOIR } from '../catalogue/correspondancesComptoir.ts';
import { GOUTS_SUR_COMMANDE, goutsPropres } from '../catalogue/goutsSurCommande.ts';
import { blocagesCommande, controlerCommande, controlerLigne, type CommandeSaisie, type ContexteCommande } from './commande.ts';
import { DELAIS_PAR_DEFAUT, REGLEMENT_COMMANDE } from './constantes.ts';
import { GOUT_AU_CHOIX, validerGouts } from './gouts.ts';
import {
  ficheDe,
  ligneVide,
  resoudreLocal,
  versLigneSaisie,
  SUPPLEMENT_ECRITURE,
  SUPPLEMENT_PHOTO,
  type CatalogueCommande,
  type FicheCatalogue,
  type LigneEcran,
} from '../components/commande/modele.ts';
import { consignesDeLigne, lignesDuBon } from '../lib/ticketCanvas.ts';
import type { LigneCommande } from '../lib/commandes.ts';

const DATE = '2026-11-20'; // vendredi
const RETRAIT = '2026-11-21';
const MINI = 'sur-commande/mini-burger';
const BURGER = 'sales/burger';
const MINI_COMPTOIR = 'sales/mini-burger';
const VIANDES = ['Poulet tenders', 'Kefta', 'Viande hachée de poulet'];

const charge = chargerCatalogueDepuisDossier();
const api = creerApiCatalogue(charge.catalogue);
function fiche(id: string): FicheCatalogue {
  const p = api.getProduit(id);
  const x = api.getPrix(id, DATE);
  assert.ok(p.ok && x.ok, `${id} absent du catalogue`);
  return { produit: p.donnees, prix: x.donnees } as unknown as FicheCatalogue;
}
const catalogue: CatalogueCommande = { date: DATE, fiches: [MINI, BURGER, MINI_COMPTOIR, 'sur-commande/mini-wrap', SUPPLEMENT_PHOTO, SUPPLEMENT_ECRITURE].map(fiche) };
const ctx: ContexteCommande = {
  resoudre: resoudreLocal(catalogue),
  joursFermes: [],
  delais: DELAIS_PAR_DEFAUT,
  reglement: { ...REGLEMENT_COMMANDE, acomptePourcentageMin: 0 },
  correspondancesComptoir: CORRESPONDANCES_COMPTOIR,
  goutsSurCommande: GOUTS_SUR_COMMANDE,
  supplementEcriture: SUPPLEMENT_ECRITURE,
  supplementPhoto: SUPPLEMENT_PHOTO,
};
const l = (id: string, quantite: number, viande?: string): LigneEcran => ({ ...ligneVide(id), quantite, gouts: viande ? [viande] : [] });
const saisie = (lignes: readonly LigneEcran[]): CommandeSaisie => ({
  client: 'Client test',
  telephone: '0470123456',
  datePrise: DATE,
  heurePrise: '10:00',
  dateRetrait: RETRAIT,
  heureRetrait: '12:00',
  lignes: lignes.map((x) => versLigneSaisie(x, ficheDe(catalogue, x.produitId))),
  acompteCentimes: 0,
});
const controler = (lignes: readonly LigneEcran[], i = 0) =>
  controlerLigne(versLigneSaisie(lignes[i], ficheDe(catalogue, lignes[i].produitId)), i, DATE, ctx, saisie(lignes).lignes);

test('donnée : les trois burgers du tarif demandent une viande, dans la liste du propriétaire', () => {
  for (const id of [MINI, BURGER, MINI_COMPTOIR]) {
    const c = GOUTS_SUR_COMMANDE[id];
    assert.ok(c && c.liste === 'propre' && c.viande === true, id);
    assert.deepEqual([...c.gouts], VIANDES, id);
    // Ce ne sont pas des goûts écrits sur le tarif : l'import ne doit pas les y chercher.
    assert.equal(goutsPropres(id), null, id);
  }
  assert.equal(charge.ok, true, 'le catalogue se charge toujours');
  assert.equal(GOUTS_SUR_COMMANDE['sur-commande/mini-wrap'], undefined, 'les autres salés ne demandent rien');
});

test('validerGouts : burger sans viande → ERR_VIANDE_MANQUANTE, les trois viandes en sortie', () => {
  const choix = GOUTS_SUR_COMMANDE[MINI];
  const r = validerGouts(choix, fiche(MINI), []);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.niveau, 'bloquant');
  assert.equal(r.code, 'ERR_VIANDE_MANQUANTE');
  assert.equal(r.champ, 'gouts');
  assert.deepEqual(r.valeurProposee, VIANDES);
  assert.match(r.message, /viande/);
  for (const v of VIANDES) assert.ok(r.message.includes(v), v);
  assert.doesNotMatch(r.message, /pâtissier/, 'pas de « au choix du pâtissier » pour une viande');
});

test('validerGouts : une viande de la liste est acceptée (sans casse ni espaces) ; hors liste ou « au choix » : refusée', () => {
  const choix = GOUTS_SUR_COMMANDE[MINI];
  const ok = validerGouts(choix, fiche(MINI), [' kefta ']);
  assert.ok(ok.ok);
  if (ok.ok) assert.deepEqual(ok.donnees, ['Kefta'], 'libellé de la liste, à la lettre');
  for (const v of [GOUT_AU_CHOIX, 'Bœuf', '   ']) {
    const r = validerGouts(choix, fiche(MINI), [v]);
    assert.equal(r.ok, false, v);
    if (!r.ok) assert.equal(r.code, 'ERR_VIANDE_MANQUANTE', v);
  }
});

test('ligne : 10 mini burgers sans viande refusés à la saisie ; avec Kefta, total = 10 × prix du tarif', () => {
  const sans = controler([l(MINI, 10)]);
  assert.equal(sans.ok, false);
  if (!sans.ok) {
    assert.equal(sans.code, 'ERR_VIANDE_MANQUANTE');
    assert.equal(sans.champ, 'lignes[0].gouts');
  }
  const avec = controler([l(MINI, 10, 'Kefta')]);
  assert.ok(avec.ok, JSON.stringify(avec));
  assert.equal(avec.donnees.totalCentimes, 10 * fiche(MINI).prix.prixCentimes);
  // Burger et Mini-Burger du comptoir : même exigence.
  for (const id of [BURGER, MINI_COMPTOIR]) {
    const r = controler([l(id, 2)]);
    assert.equal(r.ok, false, id);
    if (!r.ok) assert.equal(r.code, 'ERR_VIANDE_MANQUANTE', id);
    assert.ok(controler([l(id, 2, 'Poulet tenders')]).ok, id);
  }
});

test('minimum de 10 : compté sur le TOTAL des lignes du même burger, pas par viande', () => {
  // 15 kefta + 5 tenders : 20 en tout, les deux lignes passent.
  const quinzeCinq = [l(MINI, 15, 'Kefta'), l(MINI, 5, 'Poulet tenders')];
  assert.ok(controler(quinzeCinq, 0).ok);
  assert.ok(controler(quinzeCinq, 1).ok, '5 tenders acceptés : le burger atteint 20');
  const c = controlerCommande(saisie(quinzeCinq), ctx);
  assert.ok(c.ok, JSON.stringify(c));
  assert.equal(c.donnees.totalCentimes, 20 * fiche(MINI).prix.prixCentimes);
  // 3 + 3 = 6 : refusé, la sortie complète CETTE ligne jusqu'au minimum (3 → 7).
  const troisTrois = [l(MINI, 3, 'Kefta'), l(MINI, 3, 'Poulet tenders')];
  const r = controler(troisTrois, 1);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_QUANTITE_MIN');
    assert.equal(r.valeurProposee, 7);
  }
  assert.ok(blocagesCommande(saisie(troisTrois), ctx).some((e) => e.code === 'ERR_QUANTITE_MIN'));
  // Une seule ligne de 9 : comme avant, « Passer à 10 ».
  const neuf = controler([l(MINI, 9, 'Kefta')]);
  assert.equal(neuf.ok, false);
  if (!neuf.ok) assert.equal(neuf.valeurProposee, 10);
  // Un autre produit ne profite pas du total : 5 mini wraps + 15 mini burgers → wraps refusés.
  const wrap = controler([l(MINI, 15, 'Kefta'), l('sur-commande/mini-wrap', 5)], 1);
  assert.equal(wrap.ok, false);
});

test('doublons : deux lignes du même burger à deux viandes ne sont pas « à fusionner » ; même viande deux fois : si', () => {
  const deuxViandes = controlerCommande(saisie([l(MINI, 15, 'Kefta'), l(MINI, 15, 'Poulet tenders')]), ctx);
  assert.ok(deuxViandes.ok, JSON.stringify(deuxViandes));
  assert.ok(!deuxViandes.signalements.some((s) => s.code === 'AVERT_PRODUIT_EN_DOUBLE'));
  const memeViande = controlerCommande(saisie([l(MINI, 10, 'Kefta'), l(MINI, 10, 'kefta')]), ctx);
  assert.ok(memeViande.ok, JSON.stringify(memeViande));
  assert.ok(memeViande.signalements.some((s) => s.code === 'AVERT_PRODUIT_EN_DOUBLE'));
});

test('bon : « VIANDE : KEFTA » sous la ligne, jamais « GOÛT »', () => {
  const f = fiche(MINI);
  const ligne: LigneCommande = {
    libelle: f.produit.produit,
    quantite: 15,
    prixCentimes: f.prix.prixCentimes,
    unite: 'piece',
    poste: null,
    precision: null,
    gouts: ['Kefta'],
    produitCatalogue: { cleCatalogue: MINI, categorie: f.produit.categorie, nom: f.produit.produit, regimePrix: 'B' },
    prixProduit: { basePrix: 'piece' },
  } as LigneCommande;
  const c = { texteGateau: null, sansEcriture: true, photoImprimee: false, lignes: [ligne] };
  for (const d of ['CLIENT', 'ATELIER'] as const) {
    const textes = lignesDuBon(c, d).flatMap((x) => consignesDeLigne(x).map((y) => y.texte.replace(/ /g, ' ')));
    assert.ok(textes.includes('VIANDE : KEFTA'), `${d} : ${JSON.stringify(textes)}`);
    assert.ok(!textes.some((t) => t.startsWith('GOÛT')), d);
  }
});
