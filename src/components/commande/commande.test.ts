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
import {
  ligneVide,
  resoudreLocal,
  versLigneSaisie,
  indexLigne,
  champLocal,
  toucherProduit,
  quantiteAuBon,
  fichesVisibles,
  gateauxAuBon,
  estSupplement,
  majLigneEcran,
  type CatalogueCommande,
  type FicheCatalogue,
  type LigneEcran,
} from './modele.ts';
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

// --- Grille unique et « toucher = +1 » (retour du propriétaire, 15/10/2026) ---

const corne: FicheCatalogue = {
  produit: { id: 'a/corne', produit: 'Corne de gazelle', sousCategorie: '', unite: 'kg', regimePrix: 'A', famille: 'patisserie', categorie: 'Oriental', estFavori: false },
  prix: { prixCentimes: PRIX, basePrix: 'kg', prixEstPlancher: false, minQuantite: null, minParSymbole: null, maxParUnite: null },
};
const number: FicheCatalogue = {
  produit: { id: 'c/number', produit: 'Number Cake', sousCategorie: '', unite: 'piece', regimePrix: 'C', famille: 'patisserie', categorie: 'Gâteaux', estFavori: false },
  prix: { prixCentimes: PRIX, basePrix: 'personne', prixEstPlancher: true, minQuantite: null, minParSymbole: 15, maxParUnite: null },
};

test('1 toucher = 1 ; 5 touchers = 5 sur la même ligne, sans pré-remplir au minimum', () => {
  let lignes: LigneEcran[] = [];
  const premier = toucherProduit(lignes, layer);
  lignes = premier.lignes;
  assert.equal(lignes.length, 1);
  assert.equal(lignes[0].quantite, 1);
  for (let k = 0; k < 4; k += 1) lignes = toucherProduit(lignes, layer).lignes;
  assert.equal(lignes.length, 1);
  assert.equal(lignes[0].quantite, 5);
  assert.equal(quantiteAuBon(lignes, 'c/layer'), 5);
  // 5 parts de Layer Cake : refus à la saisie de la ligne, avec la sortie en un geste.
  const r = controlerLigne(versLigneSaisie(lignes[0], layer), 0, DATE, ctx);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, 'ERR_QUANTITE_MIN');
  assert.equal(sortieDe(r, 'parts').libelle, 'Passer à 20 parts');
});

test('produit au kilo : un toucher n’ajoute jamais « +1 », il ouvre le pavé du poids (LOI 2)', () => {
  const t1 = toucherProduit([], corne);
  assert.equal(t1.lignes[0].quantite, null);
  assert.equal(t1.champ, 'quantite');
  const avecPoids = t1.lignes.map((l) => ({ ...l, quantite: 1250 }));
  const t2 = toucherProduit(avecPoids, corne);
  assert.equal(t2.lignes.length, 1);
  assert.equal(t2.lignes[0].quantite, 1250);
});

test('Number Cake : le toucher ouvre d’abord le nombre de symboles', () => {
  assert.equal(toucherProduit([], number).champ, 'symboles');
});

test('grille unique : comptoir réduit aux favoris sans recherche ; la recherche trouve tout, sans accents', () => {
  const cat: CatalogueCommande = { date: DATE, fiches: [layer, comptoir, corne] };
  assert.deepEqual(fichesVisibles(cat, '', null).map((f) => f.produit.id), ['c/layer', 'a/pain']);
  assert.deepEqual(fichesVisibles(cat, 'gazelle', null).map((f) => f.produit.id), ['a/corne']);
  assert.deepEqual(fichesVisibles(cat, 'CORNE GAZÉLLE', null).map((f) => f.produit.id), ['a/corne']);
  assert.deepEqual(fichesVisibles(cat, '', 'Oriental').map((f) => f.produit.id), ['a/corne']);
});

test('suppléments (Photo…) : pas offerts sans gâteau au bon ; un gâteau même sous le minimum les ouvre', () => {
  const photo: FicheCatalogue = {
    produit: { id: 'c/photo', produit: 'Photo', sousCategorie: '', unite: 'piece', regimePrix: 'C', famille: 'supplement', categorie: 'Gâteaux', estFavori: false },
    prix: { prixCentimes: PRIX, basePrix: 'forfait', prixEstPlancher: false, minQuantite: null, minParSymbole: null, maxParUnite: null },
  };
  const cat: CatalogueCommande = { date: DATE, fiches: [layer, comptoir, photo] };
  assert.equal(estSupplement(photo), true);
  assert.equal(estSupplement(layer), false);
  assert.equal(gateauxAuBon([], cat, ['patisserie']), 0);
  assert.equal(gateauxAuBon([{ ...ligneVide('a/pain'), quantite: 3 }], cat, ['patisserie']), 0);
  assert.equal(gateauxAuBon([{ ...ligneVide('c/layer'), quantite: 1 }], cat, ['patisserie']), 1);
  assert.equal(gateauxAuBon([{ ...ligneVide('c/photo'), quantite: 1 }], cat, ['patisserie']), 0);
});

// --- LOI 11 : tailles standard d'un gâteau simple (liste = donnée des réglages) ---
const simple: FicheCatalogue = {
  produit: { id: 'c/bavarois', produit: 'Bavarois', sousCategorie: '', unite: 'piece', regimePrix: 'C', famille: 'patisserie', categorie: 'Gâteaux', estFavori: false },
  prix: { prixCentimes: PRIX, basePrix: 'personne', prixEstPlancher: true, minQuantite: null, minParSymbole: null, maxParUnite: null },
};
const ctxTailles = {
  resoudre: resoudreLocal({ date: DATE, fiches: [simple] }),
  delais: DELAIS_HYPOTHESE,
  reglement: { ...REGLEMENT_COMMANDE, taillesGateau: [6, 8, 10] },
};

test('gâteau simple : un toucher ajoute la ligne SANS quantité, la taille se choisit aux boutons', () => {
  const t = toucherProduit([], simple);
  assert.equal(t.champ, 'taille');
  assert.equal(t.lignes[0].quantite, null);
  const t2 = toucherProduit(t.lignes, simple);
  assert.equal(t2.lignes.length, 1, 'pas de seconde ligne');
  assert.equal(t2.lignes[0].quantite, null, 'pas de +1');
});

test('7 parts hors des tailles 6/8/10 : ERR_TAILLE_NON_STANDARD ; accordé par le gérant : accepté et tracé', () => {
  const l = { ...ligneVide('c/bavarois'), quantite: 7 };
  const r = controlerLigne(versLigneSaisie(l, simple), 1, DATE, ctxTailles);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, 'ERR_TAILLE_NON_STANDARD');
  assert.equal(champLocal(r.champ), 'quantite');
  // Chaque bouton de sortie porte SA taille (l'écran en montre deux : 6 et 8).
  assert.equal(sortieDe({ ...r, valeurProposee: 6 }, 'parts').libelle, 'Passer à 6 parts');
  assert.equal(sortieDe({ ...r, valeurProposee: 8 }, 'parts').libelle, 'Passer à 8 parts');

  const accord = { par: 'Gérant', le: '2026-10-15T10:00:00.000Z' };
  const ok = controlerLigne(versLigneSaisie({ ...l, deverrouillageTaille: accord }, simple), 1, DATE, ctxTailles);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.donnees.autorisationTaille?.par, 'Gérant');
  // Un accord de PRIX n'autorise pas une taille.
  const prixSeul = controlerLigne(versLigneSaisie({ ...l, deverrouillage: accord }, simple), 1, DATE, ctxTailles);
  assert.equal(prixSeul.ok, false);
});

test('accord de taille : tombe si la quantité change, reste sinon', () => {
  const accord = { par: 'Gérant', le: '2026-10-15T10:00:00.000Z' };
  const l: LigneEcran = { ...ligneVide('c/bavarois'), quantite: 7, deverrouillageTaille: accord };
  assert.equal(majLigneEcran(l, { quantite: 9 }).deverrouillageTaille, null);
  assert.deepEqual(majLigneEcran(l, { precision: 'fraise' }).deverrouillageTaille, accord);
  assert.deepEqual(majLigneEcran(l, { quantite: 7 }).deverrouillageTaille, accord);
  assert.deepEqual(majLigneEcran({ ...l, deverrouillageTaille: null }, { quantite: 9, deverrouillageTaille: accord }).deverrouillageTaille, accord);
});
