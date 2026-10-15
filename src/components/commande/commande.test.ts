// node --test src/components/commande/commande.test.ts
//
// Branchement de l'écran de commande sur le domaine : le contrôle à la saisie
// de la ligne vient bien de `controlerLigne`, et chaque refus a son bouton de
// sortie (libellé du catalogue des messages). Montants fictifs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { controlerLigne } from '../../domaine/commande.ts';
import { validerAcompte } from '../../domaine/coherence.ts';
import { formaterEuros, partMinimale } from '../../domaine/argent.ts';
import { DELAIS_HYPOTHESE, REGLEMENT_COMMANDE } from '../../domaine/constantes.ts';
import { ligneVide, resoudreLocal, versLigneSaisie, indexLigne, champLocal, type CatalogueCommande, type FicheCatalogue } from './modele.ts';
import { sortieDe } from './sorties.ts';

const DATE = '2026-10-15';
const PRIX = 500; // fictif
const layer: FicheCatalogue = {
  produit: { id: 'c/layer', produit: 'Layer Cake', sousCategorie: '', unite: 'piece', regimePrix: 'C', famille: 'patisserie', categorie: 'Gâteaux', estFavori: false },
  prix: { prixCentimes: PRIX, basePrix: 'personne', prixEstPlancher: true, minQuantite: 20, minParSymbole: null, maxParUnite: null },
};
const comptoir: FicheCatalogue = {
  produit: { id: 'a/pain', produit: 'Pain', sousCategorie: '', unite: 'piece', regimePrix: 'A', famille: 'boulangerie', categorie: 'Boulangerie', estFavori: true },
  prix: { prixCentimes: PRIX, basePrix: 'piece', prixEstPlancher: false, minQuantite: null, minParSymbole: null, maxParUnite: null },
};
const catalogue: CatalogueCommande = { date: DATE, fiches: [layer, comptoir] };
const ctx = { resoudre: resoudreLocal(catalogue), delais: DELAIS_HYPOTHESE, reglement: REGLEMENT_COMMANDE };

test('12 parts de Layer Cake : refus à la saisie de la ligne, bouton « Passer à 20 parts »', () => {
  const l = { ...ligneVide('c/layer'), quantite: 12 };
  const r = controlerLigne(versLigneSaisie(l, layer), 3, DATE, ctx);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, 'ERR_QUANTITE_MIN');
  assert.equal(r.valeurProposee, 20);
  assert.equal(indexLigne(r.champ), 3);
  assert.equal(champLocal(r.champ), 'quantite');
  const s = sortieDe(r, 'parts');
  assert.equal(s.avecValeur, true);
  assert.equal(s.libelle, 'Passer à 20 parts');
});

test('régime C : prix pré-rempli au plancher ; A : prix du catalogue transmis pour contrôle, jamais saisi', () => {
  assert.equal(versLigneSaisie({ ...ligneVide('c/layer'), quantite: 20 }, layer).prixUnitaireCentimes, PRIX);
  assert.equal(versLigneSaisie({ ...ligneVide('a/pain'), quantite: 2, prixUnitaireCentimes: 1 }, comptoir).prixUnitaireCentimes, PRIX);
});

test('sous le plancher : refus, sortie « Remettre … par personne »', () => {
  const l = { ...ligneVide('c/layer'), quantite: 20, prixUnitaireCentimes: PRIX - 1 };
  const r = controlerLigne(versLigneSaisie(l, layer), 0, DATE, ctx);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, 'ERR_SOUS_PLANCHER');
  assert.equal(sortieDe(r).libelle, `Remettre ${formaterEuros(PRIX)} par personne`);
});

test('ligne libre sans accord du gérant : refus, sortie « Saisir le code gérant » (action, pas valeur)', () => {
  const l = { ...ligneVide(null), libelleLibre: 'Gâteau licorne', quantite: 1, prixUnitaireCentimes: PRIX };
  const r = controlerLigne(versLigneSaisie(l, null), 0, DATE, ctx);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, 'ERR_DROIT_INSUFFISANT');
  const s = sortieDe(r);
  assert.equal(s.avecValeur, false);
  assert.equal(s.libelle, 'Saisir le code gérant');
});

test('acompte insuffisant : bouton « Mettre l’acompte à X »', () => {
  const total = 9000;
  const r = validerAcompte(0, total, REGLEMENT_COMMANDE.acomptePourcentageMin);
  assert.equal(r.ok, false);
  if (r.ok) return;
  const minimum = partMinimale(total, REGLEMENT_COMMANDE.acomptePourcentageMin);
  assert.equal(sortieDe(r).libelle, `Mettre l’acompte à ${formaterEuros(minimum)}`);
});
