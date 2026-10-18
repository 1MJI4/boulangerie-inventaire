// node --test src/components/commande/prixComptoir.test.ts
//
// R60 à l'écran : le bouton de taille d'un gâteau sur commande remplace la
// ligne par le gâteau du COMPTOIR quand il existe à cette taille, et la ligne
// envoyée est celle que le domaine (et le serveur, qui le rejoue) accepte.
// Vrai catalogue : aucun prix en dur (LOI 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogueDepuisDossier } from '../../catalogue/chargerFichiers.ts';
import { creerApiCatalogue } from '../../catalogue/catalogue.ts';
import { CORRESPONDANCES_COMPTOIR } from '../../catalogue/correspondancesComptoir.ts';
import { controlerLigne } from '../../domaine/commande.ts';
import { multiplier } from '../../domaine/argent.ts';
import { DELAIS_PAR_DEFAUT, REGLEMENT_COMMANDE } from '../../domaine/constantes.ts';
import {
  choisirTaille,
  ficheComptoirPourTaille,
  gateauxAuBon,
  ligneVide,
  resoudreLocal,
  tailleChoisie,
  toucherProduit,
  versLigneSaisie,
  ficheDe,
  type CatalogueCommande,
  type FicheCatalogue,
} from './modele.ts';
import { sortieDe } from './sorties.ts';

const DATE = '2026-10-15';
const api = creerApiCatalogue(chargerCatalogueDepuisDossier().catalogue);
const T = CORRESPONDANCES_COMPTOIR;

function ficheCatalogue(id: string): FicheCatalogue {
  const p = api.getProduit(id);
  const x = api.getPrix(id, DATE);
  assert.ok(p.ok && x.ok, `${id} absent du catalogue`);
  return { produit: p.donnees, prix: x.donnees } as unknown as FicheCatalogue;
}

const IDS = [
  'gateaux-sur-commande/bavarois',
  'gateaux-sur-commande/creme-fraiche',
  'gateaux-et-tartes/bavarois/4p',
  'gateaux-et-tartes/bavarois/6p',
  'gateaux-et-tartes/bavarois/8p',
  'gateaux-et-tartes/bavarois/10p',
  'gateaux-et-tartes/creme-fraiche/6p',
  'gateaux-et-tartes/creme-fraiche/8p',
  'gateaux-sur-commande/supplement-photo',
];
const catalogue: CatalogueCommande = { date: DATE, fiches: IDS.map(ficheCatalogue) };
const ctx = { resoudre: resoudreLocal(catalogue), delais: DELAIS_PAR_DEFAUT, reglement: REGLEMENT_COMMANDE, correspondancesComptoir: T };
const prix = (id: string) => ficheCatalogue(id).prix.prixCentimes;

test('bouton « 6 parts » d’un bavarois : prix du comptoir 6P affiché, ligne remplacée par le comptoir', () => {
  const base = toucherProduit([], ficheCatalogue('gateaux-sur-commande/bavarois')).lignes[0];
  assert.equal(ficheComptoirPourTaille(base.produitId, 6, catalogue, T)?.prix.prixCentimes, prix('gateaux-et-tartes/bavarois/6p'));
  assert.equal(ficheComptoirPourTaille(base.produitId, 15, catalogue, T), null, '15 parts : affichage actuel');

  const l = choisirTaille(base, 6, catalogue, T);
  assert.equal(l.produitId, 'gateaux-et-tartes/bavarois/6p');
  assert.equal(l.origineSurCommande, 'gateaux-sur-commande/bavarois');
  assert.equal(l.quantite, 1);
  assert.equal(tailleChoisie(l, T), 6, 'le bouton 6 reste marqué');
  const r = controlerLigne(versLigneSaisie(l, ficheDe(catalogue, l.produitId)), 0, DATE, ctx);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.donnees.totalCentimes, prix('gateaux-et-tartes/bavarois/6p'));
  // Le gâteau du comptoir compte pour les suppléments.
  assert.equal(gateauxAuBon([l], catalogue, ['patisserie']), 1);
  // Un nouveau toucher sur la carte « Bavarois » retrouve la ligne (pas de doublon).
  assert.equal(toucherProduit([l], ficheCatalogue('gateaux-sur-commande/bavarois')).lignes.length, 1);
});

test('repasser à une taille sans équivalent revient au gâteau sur commande ; d’un comptoir à l’autre aussi', () => {
  const base = ligneVide('gateaux-sur-commande/bavarois');
  const huit = choisirTaille(choisirTaille(base, 6, catalogue, T), 8, catalogue, T);
  assert.equal(huit.produitId, 'gateaux-et-tartes/bavarois/8p');
  const quinze = choisirTaille(huit, 15, catalogue, T);
  assert.equal(quinze.produitId, 'gateaux-sur-commande/bavarois');
  assert.equal(quinze.origineSurCommande, null);
  assert.equal(quinze.quantite, 15);
  const r = controlerLigne(versLigneSaisie(quinze, ficheDe(catalogue, quinze.produitId)), 0, DATE, ctx);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.donnees.totalCentimes, multiplier(15, prix('gateaux-sur-commande/bavarois')));
});

test('crème fraîche : 4 parts au prix par personne, 8 parts au comptoir 8P', () => {
  const base = ligneVide('gateaux-sur-commande/creme-fraiche');
  const quatre = choisirTaille(base, 4, catalogue, T);
  assert.equal(quatre.produitId, 'gateaux-sur-commande/creme-fraiche');
  assert.equal(quatre.quantite, 4);
  const r4 = controlerLigne(versLigneSaisie(quatre, ficheDe(catalogue, quatre.produitId)), 0, DATE, ctx);
  assert.ok(r4.ok);
  if (r4.ok) assert.equal(r4.donnees.totalCentimes, multiplier(4, prix('gateaux-sur-commande/creme-fraiche')));
  const huit = choisirTaille(quatre, 8, catalogue, T);
  assert.equal(huit.produitId, 'gateaux-et-tartes/creme-fraiche/8p');
  const r8 = controlerLigne(versLigneSaisie(huit, ficheDe(catalogue, huit.produitId)), 0, DATE, ctx);
  assert.ok(r8.ok);
  if (r8.ok) assert.equal(r8.donnees.totalCentimes, prix('gateaux-et-tartes/creme-fraiche/8p'));
});

test('6 parts saisies au pavé : refus ERR_PRIX_COMPTOIR avec un bouton, qui remplace la ligne', () => {
  const l = { ...ligneVide('gateaux-sur-commande/bavarois'), quantite: 6 };
  const r = controlerLigne(versLigneSaisie(l, ficheDe(catalogue, l.produitId)), 0, DATE, ctx);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, 'ERR_PRIX_COMPTOIR');
  const sortie = sortieDe(r, 'parts');
  assert.equal(sortie.libelle, 'Prendre le gâteau du comptoir');
  assert.equal(sortie.avecValeur, true);
  assert.equal(choisirTaille(l, 6, catalogue, T).produitId, 'gateaux-et-tartes/bavarois/6p');
});
