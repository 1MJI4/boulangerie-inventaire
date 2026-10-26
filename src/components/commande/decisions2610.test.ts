// src/components/commande/decisions2610.test.ts
//
// Écran de commande — décisions du propriétaire du 26/10/2026 (R63 forme,
// R64 Pâte à sucre, R65 Matadi 4P) : ce que l'ÉCRAN fait des sorties du
// domaine. Les règles elles-mêmes sont prouvées dans src/domaine/decisions2610.test.ts.
// Prix des fiches : valeur de test arbitraire (aucun prix du catalogue ici, LOI 1).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appliquerRemplacement,
  basculerSupplementParPersonne,
  estSupplement,
  ligneVide,
  remplacementsProposes,
  synchroniserSupplementsParPersonne,
  versLigneSaisie,
  SUPPLEMENT_PATE_A_SUCRE,
  type CatalogueCommande,
  type FicheCatalogue,
  type LigneEcran,
} from './modele.ts';
import { SUPPLEMENTS_PAR_PERSONNE } from '../../domaine/constantes.ts';
import type { CorrespondanceComptoir } from '../../domaine/prixComptoir.ts';
import type { ChoixGout } from '../../domaine/gouts.ts';

const DATE = '2026-10-28';
const PRIX = 123;
const LAYER = 'gateaux-sur-commande/layer-cake';
const BAVAROIS = 'gateaux-sur-commande/bavarois';
const BAVAROIS_6P = 'gateaux-et-tartes/bavarois/6p';

function fiche(id: string, famille: string, basePrix: 'personne' | 'forfait' | 'piece', regime: 'A' | 'C' = 'C'): FicheCatalogue {
  return {
    produit: { id, produit: id, sousCategorie: '', unite: 'piece', regimePrix: regime, famille, categorie: 'Gâteaux', estFavori: false },
    prix: { prixCentimes: PRIX, basePrix, prixEstPlancher: basePrix === 'personne' && famille !== 'supplement', minQuantite: null, minParSymbole: null, maxParUnite: null },
  };
}

const pate = fiche(SUPPLEMENT_PATE_A_SUCRE, 'supplement', 'personne');
const layer = fiche(LAYER, 'patisserie', 'personne');
const bavarois = fiche(BAVAROIS, 'patisserie', 'personne');
const bavarois6 = fiche(BAVAROIS_6P, 'patisserie', 'piece', 'A');
const photo = fiche('gateaux-sur-commande/supplement-photo', 'supplement', 'forfait');
const cat: CatalogueCommande = { date: DATE, fiches: [pate, layer, bavarois, bavarois6, photo] };
const TABLE: CorrespondanceComptoir[] = [{ surCommande: BAVAROIS, parts: 6, comptoir: BAVAROIS_6P } as CorrespondanceComptoir];
const FAMILLES = ['patisserie'];

const l = (produitId: string, quantite: number | null, extra: Partial<LigneEcran> = {}): LigneEcran => ({
  ...ligneVide(produitId),
  quantite,
  ...extra,
});

test('estSupplement : fondé sur la famille « supplement » — la Pâte à sucre (par personne) en est un, le Layer Cake non', () => {
  assert.equal(estSupplement(pate), true);
  assert.equal(estSupplement(photo), true);
  assert.equal(estSupplement(layer), false);
});

test('R63 : la forme part avec la ligne saisie (y compris gâteau du comptoir issu de R60) ; absente → null', () => {
  assert.equal(versLigneSaisie(l(BAVAROIS, 6, { forme: 'rond' }), bavarois).forme, 'rond');
  assert.equal(versLigneSaisie(l(BAVAROIS_6P, 1, { forme: 'carre', origineSurCommande: BAVAROIS }), bavarois6).forme, 'carre');
  assert.equal(versLigneSaisie(l(BAVAROIS, 6), bavarois).forme, null);
});

test('R64 : la case Pâte à sucre crée UNE ligne aux parts du gâteau ; décochée, elle est retirée', () => {
  const avec = basculerSupplementParPersonne([l(LAYER, 25)], SUPPLEMENT_PATE_A_SUCRE, true, cat, FAMILLES, SUPPLEMENTS_PAR_PERSONNE, TABLE);
  assert.equal(avec.length, 2);
  assert.equal(avec[1].produitId, SUPPLEMENT_PATE_A_SUCRE);
  assert.equal(avec[1].quantite, 25);
  // Deuxième toucher : pas de doublon.
  assert.equal(basculerSupplementParPersonne(avec, SUPPLEMENT_PATE_A_SUCRE, true, cat, FAMILLES, SUPPLEMENTS_PAR_PERSONNE, TABLE).length, 2);
  assert.equal(basculerSupplementParPersonne(avec, SUPPLEMENT_PATE_A_SUCRE, false, cat, FAMILLES, SUPPLEMENTS_PAR_PERSONNE, TABLE).length, 1);
  // Sans gâteau au bon, ou absente du tarif : rien.
  assert.equal(basculerSupplementParPersonne([], SUPPLEMENT_PATE_A_SUCRE, true, cat, FAMILLES, SUPPLEMENTS_PAR_PERSONNE, TABLE).length, 0);
  const sansPate: CatalogueCommande = { date: DATE, fiches: [layer] };
  assert.equal(basculerSupplementParPersonne([l(LAYER, 20)], SUPPLEMENT_PATE_A_SUCRE, true, sansPate, FAMILLES, SUPPLEMENTS_PAR_PERSONNE, TABLE).length, 1);
});

test('R64 : les parts de la Pâte à sucre suivent le gâteau ; rien ne change → même tableau (pas de boucle)', () => {
  const bon = [l(LAYER, 30), l(SUPPLEMENT_PATE_A_SUCRE, 20)];
  const suivi = synchroniserSupplementsParPersonne(bon, SUPPLEMENTS_PAR_PERSONNE, TABLE);
  assert.equal(suivi[1].quantite, 30);
  assert.equal(synchroniserSupplementsParPersonne(suivi, SUPPLEMENTS_PAR_PERSONNE, TABLE), suivi);
  // Gâteau devenu gâteau du comptoir (R60, Bavarois 6 parts) : les parts de la correspondance.
  const comptoir = synchroniserSupplementsParPersonne(
    [l(BAVAROIS_6P, 1, { origineSurCommande: BAVAROIS }), l(SUPPLEMENT_PATE_A_SUCRE, 20)],
    SUPPLEMENTS_PAR_PERSONNE,
    TABLE,
  );
  assert.equal(comptoir[1].quantite, 6);
  // Deux gâteaux, deux Pâte à sucre : chacune suit le sien, dans l'ordre du bon.
  const deux = synchroniserSupplementsParPersonne(
    [l(LAYER, 20), l(BAVAROIS, 25), l(SUPPLEMENT_PATE_A_SUCRE, 1), l(SUPPLEMENT_PATE_A_SUCRE, 1)],
    SUPPLEMENTS_PAR_PERSONNE,
    TABLE,
  );
  assert.deepEqual(deux.map((x) => x.quantite), [20, 25, 20, 25]);
  // Sans gâteau porteur : quantité laissée (le domaine refuse, « Supprimer la ligne »).
  const seule = [l(SUPPLEMENT_PATE_A_SUCRE, 20)];
  assert.equal(synchroniserSupplementsParPersonne(seule, SUPPLEMENTS_PAR_PERSONNE, TABLE), seule);
});

test('R63 / R65 : remplacement — nouveau produit et quantité, forme vidée, origine R60 retirée, goûts selon la liste', () => {
  const GOUTS: Record<string, ChoixGout> = {
    [BAVAROIS]: { liste: 'parfum', parEtage: false },
    [LAYER]: { liste: 'parfum', parEtage: false },
    'gateaux-sur-commande/entremet': { liste: 'entremet', parEtage: false },
  };
  const avant = l(BAVAROIS, 10, { forme: 'rond', gouts: ['Framboise'], prixUnitaireCentimes: PRIX + 1 });
  const apres = appliquerRemplacement(avant, { produitId: LAYER, quantite: 20 }, GOUTS);
  assert.equal(apres.produitId, LAYER);
  assert.equal(apres.quantite, 20);
  assert.equal(apres.forme, null);
  assert.equal(apres.prixUnitaireCentimes, null);
  assert.equal(apres.origineSurCommande, null);
  assert.deepEqual(apres.gouts, ['Framboise'], 'même liste de goûts : gardés');
  const autreListe = appliquerRemplacement(avant, { produitId: 'gateaux-sur-commande/entremet', quantite: 20 }, GOUTS);
  assert.deepEqual(autreListe.gouts, [], 'liste différente : vidés');
  const sansListe = appliquerRemplacement(l('gateaux-et-tartes/matadi-chocolat/4p', 2, { gouts: ['x'] }), { produitId: 'gateaux-et-tartes/matadi-chocolat/6p', quantite: 2 }, GOUTS);
  assert.deepEqual(sansListe.gouts, []);
  assert.equal(sansListe.quantite, 2);
  // Ligne du comptoir issue de R60 : l'origine sert à comparer les goûts, puis disparaît.
  const r60 = appliquerRemplacement(l(BAVAROIS_6P, 1, { origineSurCommande: BAVAROIS, gouts: ['Mangue'] }), { produitId: LAYER, quantite: 20 }, GOUTS);
  assert.deepEqual(r60.gouts, ['Mangue']);
  assert.equal(r60.origineSurCommande, null);
});

test('remplacementsProposes : lit R63 ({ forme, remplacements }) et R65 (tableau), ignore le reste', () => {
  const r = { produitId: LAYER, libelle: 'Layer Cake', quantite: 20, bouton: 'Passer en Layer Cake (20 parts)' };
  assert.deepEqual(remplacementsProposes({ forme: 'carre', remplacements: [r] }), [r]);
  assert.deepEqual(remplacementsProposes([r, { produitId: 3 }]), [r]);
  assert.deepEqual(remplacementsProposes({ forme: 'carre', remplacements: [] }), []);
  assert.deepEqual(remplacementsProposes(undefined), []);
  assert.deepEqual(remplacementsProposes(['carre', 'rond']), []);
});
