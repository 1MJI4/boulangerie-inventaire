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
import { DELAIS_PAR_DEFAUT, REGLEMENT_COMMANDE } from '../../domaine/constantes.ts';
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
  boutonsFamilles,
  creneauxRetrait,
  joursProposes,
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
const ctx = { resoudre: resoudreLocal(catalogue), delais: DELAIS_PAR_DEFAUT, reglement: REGLEMENT_COMMANDE, correspondancesComptoir: [] };

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

test('acompte insuffisant : accepté, avertissement avec le bouton « Mettre l’acompte à X »', () => {
  const total = 9000;
  const r = validerAcompte(0, total, REGLEMENT_COMMANDE.acomptePourcentageMin);
  assert.equal(r.ok, true, 'avertissement, plus un refus (18/10/2026)');
  if (!r.ok) return;
  const a = r.signalements.find((s) => s.code === 'AVERT_ACOMPTE_INSUFFISANT');
  assert.ok(a);
  const minimum = partMinimale(total, REGLEMENT_COMMANDE.acomptePourcentageMin);
  const s = sortieDe(a);
  assert.equal(s.libelle, `Mettre l’acompte à ${formaterEuros(minimum)}`);
  assert.equal(s.avecValeur, true);
});

test('heure hors ouverture : bouton « Passer à 6h00 »', () => {
  const s = sortieDe({ ok: false, niveau: 'bloquant', code: 'ERR_HEURE_HORS_OUVERTURE', message: '', champ: 'heureRetrait', valeurProposee: '06:00' });
  assert.equal(s.libelle, 'Passer à 6h00');
  assert.equal(s.avecValeur, true);
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
  delais: DELAIS_PAR_DEFAUT,
  reglement: { ...REGLEMENT_COMMANDE, taillesGateau: [6, 8, 10] },
  correspondancesComptoir: [],
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

test('réserve m3 : accord de taille renvoyé sur une taille STANDARD → non tracé par le domaine, donc ignoré (pas de 403)', async () => {
  const { accordManquant } = await import('./accords.ts');
  const accord = { par: 'Gérant', le: '2026-10-15T10:00:00.000Z' };
  const l = { ...ligneVide('c/bavarois'), quantite: 8, deverrouillageTaille: accord };
  const r = controlerLigne(versLigneSaisie(l, simple), 1, DATE, ctxTailles);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.donnees.autorisationTaille, undefined, 'accord inutile : jamais enregistré');
  assert.equal(accordManquant({ lignes: [{ prix: false, taille: true }], remise: false }, { lignes: [r.donnees] }), null);
  // Même accord, taille hors liste : tracé → sans gérant, code redemandé.
  const hors = controlerLigne(versLigneSaisie({ ...l, quantite: 7 }, simple), 1, DATE, ctxTailles);
  assert.equal(hors.ok, true);
  if (!hors.ok) return;
  assert.deepEqual(
    accordManquant({ lignes: [{ prix: false, taille: true }], remise: false }, { lignes: [hors.donnees] }),
    { type: 'taille', ligne: 0 },
  );
});

// ---------------------------------------------------------------------------
// Familles mises en avant et bande de retrait (demande du propriétaire, 18/10/2026)
// ---------------------------------------------------------------------------

test('familles : « Salé » (rayon tout en régime B) et « Gâteau » (tout en C) en tête, repérés par le régime, pas par le nom', () => {
  const sale: FicheCatalogue = {
    produit: { ...layer.produit, id: 'b/burger', produit: 'Mini burger', regimePrix: 'B', famille: 'sale', categorie: 'Rayon traiteur' },
    prix: { ...layer.prix, basePrix: 'piece', prixEstPlancher: false, minQuantite: 10 },
  };
  const autreComptoir: FicheCatalogue = { ...comptoir, produit: { ...comptoir.produit, id: 'a/croissant', categorie: 'Viennoiserie' } };
  const cat: CatalogueCommande = { date: DATE, fiches: [comptoir, autreComptoir, layer, sale] };
  const b = boutonsFamilles(cat);
  assert.deepEqual(
    b.map((x) => [x.libelle, x.rayon, x.enAvant]),
    [
      ['Salé', 'Rayon traiteur', true],
      ['Gâteau', 'Gâteaux', true],
      ['Boulangerie', 'Boulangerie', false],
      ['Viennoiserie', 'Viennoiserie', false],
    ],
  );
  // Le libellé de bouton ne change rien au filtre : la catégorie reste celle du catalogue (LOI 5).
  assert.deepEqual(fichesVisibles(cat, '', b[0].rayon).map((f) => f.produit.id), ['b/burger']);
  // « Tout » (aucun rayon) : sur-commande + favoris du comptoir.
  assert.deepEqual(fichesVisibles(cat, '', null).map((f) => f.produit.id).sort(), ['a/croissant', 'a/pain', 'b/burger', 'c/layer']);
});

test('familles : un rayon mêlant plusieurs régimes n’est jamais mis en avant', () => {
  const mele: FicheCatalogue = { ...comptoir, produit: { ...comptoir.produit, id: 'a/x', categorie: 'Gâteaux' } };
  const b = boutonsFamilles({ date: DATE, fiches: [layer, mele] });
  assert.deepEqual(b.map((x) => x.enAvant), [false]);
});

test('bande de retrait : créneaux entre ouverture et fermeture incluses, heure choisie hors grille conservée', () => {
  assert.deepEqual(creneauxRetrait({ ouverture: '09:00', fermeture: '10:00' }, 15, ''), ['09:00', '09:15', '09:30', '09:45', '10:00']);
  assert.deepEqual(creneauxRetrait({ ouverture: '09:10', fermeture: '09:40' }, 15, ''), ['09:10', '09:15', '09:30', '09:40']);
  assert.deepEqual(creneauxRetrait({ ouverture: '09:00', fermeture: '09:30' }, 15, '18:05'), ['09:00', '09:15', '09:30', '18:05']);
  assert.deepEqual(creneauxRetrait(null, 15, ''), []);
});

test('bande de retrait : jours depuis aujourd’hui, jour choisi hors fenêtre ajouté à sa place', () => {
  const j = joursProposes('2026-10-18', 3, null);
  assert.deepEqual(j, ['2026-10-18', '2026-10-19', '2026-10-20']);
  assert.deepEqual(joursProposes('2026-10-18', 2, '2026-12-24'), ['2026-10-18', '2026-10-19', '2026-12-24']);
  assert.deepEqual(joursProposes('2026-10-18', 2, '2026-10-19'), ['2026-10-18', '2026-10-19']);
});
