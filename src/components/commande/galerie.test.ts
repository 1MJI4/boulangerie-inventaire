// src/components/commande/galerie.test.ts
//
// Galerie de photos de modèles (décision du propriétaire, 26/10/2026) : ce que
// l'ÉCRAN fait d'un toucher sur une photo. (Lecture de l'identifiant par la
// route : photosGestion.test.ts.) Photos de TEST, jamais la galerie réelle :
// elle vit en base et change quand le gérant la range. Prix des fiches : valeur de test arbitraire (aucun prix du
// catalogue ici, LOI 1).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ajouterAvecPhoto, ficheDePhoto, navigationPourPhoto, retirerPhoto } from './galerie.ts';
import { ligneVide, toucherProduit, SUPPLEMENT_PATE_A_SUCRE, SUPPLEMENT_PHOTO, type CatalogueCommande, type FicheCatalogue, type LigneEcran } from './modele.ts';
import { SUPPLEMENTS_PAR_PERSONNE } from '../../domaine/constantes.ts';
import type { PhotoModele } from '../../catalogue/photosModeles.ts';

const DATE = '2026-10-28';
const PRIX = 123;
const LAYER = 'gateaux-sur-commande/layer-cake';
const MINI = 'sur-commande/mini-pizza-quiche';

function fiche(
  id: string,
  famille: string,
  basePrix: 'personne' | 'forfait' | 'piece',
  regime: 'B' | 'C' = 'C',
  minQuantite: number | null = null,
): FicheCatalogue {
  return {
    produit: { id, produit: id, sousCategorie: '', unite: 'piece', regimePrix: regime, famille, categorie: 'Test', estFavori: false },
    prix: { prixCentimes: PRIX, basePrix, prixEstPlancher: regime === 'C' && basePrix === 'personne' && famille !== 'supplement', minQuantite, minParSymbole: null, maxParUnite: null },
  };
}

const layer = fiche(LAYER, 'patisserie', 'personne', 'C', 20);
const mini = fiche(MINI, 'sale', 'piece', 'B', 10);
const pate = fiche(SUPPLEMENT_PATE_A_SUCRE, 'supplement', 'personne');
const supPhoto = fiche(SUPPLEMENT_PHOTO, 'supplement', 'forfait');
const cat: CatalogueCommande = { date: DATE, fiches: [layer, mini, pate, supPhoto] };
const FAMILLES = ['patisserie'];

/** Photos de test (forme de GET /api/photos-modeles), sans produit unique : bûches, tartes, mini-pâtisseries. */
const photo = (id: string, categorie: string, produit: string | null): PhotoModele => ({
  id,
  url: `/api/modeles/${id}.jpg`,
  produit,
  categorie,
  supplements: [],
  note: null,
  masquee: false,
  ordre: 10,
});
const PHOTOS_SANS_PRODUIT = [photo('B001', 'Bûches', null), photo('T001', 'Tartes', null), photo('M001', 'Mini-pâtisseries', null)];

const ajouter = (lignes: LigneEcran[], f: FicheCatalogue, id: string, supplements?: string[]) =>
  ajouterAvecPhoto(lignes, f, { id, supplements }, cat, FAMILLES, SUPPLEMENTS_PAR_PERSONNE, []);

test('photo d’un gâteau : même ligne qu’un toucher de la carte, avec l’identifiant de la photo', () => {
  const normal = toucherProduit([], layer);
  const t = ajouter([], layer, 'G043');
  assert.equal(t.champ, normal.champ, 'mêmes états (boutons de taille)');
  assert.equal(t.lignes.length, 1);
  assert.equal(t.lignes[0].produitId, LAYER);
  assert.equal(t.lignes[0].quantite, null, 'aucune taille choisie d’office');
  assert.equal(t.lignes[0].photoModele, 'G043');
  assert.equal(t.lignes[0].cle, t.cle);
});

test('photo d’un salé : +1 comme un toucher (le domaine refuse sous le minimum, avec « Passer à 10 »)', () => {
  const t = ajouter([], mini, 'S002');
  assert.equal(t.lignes[0].quantite, 1);
  assert.equal(t.lignes[0].photoModele, 'S002');
});

test('carte touchée puis photo : la photo se pose sur la ligne existante, sans doublon', () => {
  const avant = toucherProduit([], layer).lignes;
  const t = ajouter(avant, layer, 'G043');
  assert.equal(t.lignes.length, 1);
  assert.equal(t.lignes[0].photoModele, 'G043');
});

test('deux photos du même produit : deux lignes, la première photo n’est jamais écrasée', () => {
  const un = ajouter([], layer, 'G043').lignes;
  const deux = ajouter(un, layer, 'G019');
  assert.equal(deux.lignes.length, 2);
  assert.deepEqual(deux.lignes.map((l) => l.photoModele), ['G043', 'G019']);
  assert.equal(deux.cle, deux.lignes[1].cle);
});

test('modèle en Pâte à sucre : la Pâte à sucre est cochée (une ligne) ; le supplément Photo, jamais', () => {
  const t = ajouter([], layer, 'G043', [SUPPLEMENT_PATE_A_SUCRE, SUPPLEMENT_PHOTO]);
  assert.deepEqual(t.lignes.map((l) => l.produitId), [LAYER, SUPPLEMENT_PATE_A_SUCRE]);
  assert.equal(t.lignes[1].photoModele ?? null, null, 'la photo reste sur le gâteau');
  // Deuxième photo en pâte à sucre : pas de deuxième case cochée en double par erreur.
  const encore = ajouter(t.lignes, layer, 'G019', [SUPPLEMENT_PATE_A_SUCRE]);
  assert.equal(encore.lignes.filter((l) => l.produitId === SUPPLEMENT_PATE_A_SUCRE).length, 1);
  assert.equal(encore.lignes.filter((l) => l.produitId === SUPPLEMENT_PHOTO).length, 0);
});

test('retirer la photo : la ligne reste, seule la photo part', () => {
  const t = ajouter([], layer, 'G043');
  const r = retirerPhoto(t.lignes, t.cle);
  assert.equal(r.length, 1);
  assert.equal(r[0].produitId, LAYER);
  assert.equal(r[0].photoModele, null);
});

test('ligne vide : pas de photo', () => {
  assert.equal(ligneVide(LAYER).photoModele, null);
});

test('fiche de la photo : lue au catalogue reçu ; produit null ou absent du tarif → null (la vendeuse choisit)', () => {
  assert.equal(ficheDePhoto(cat, { produit: LAYER }), layer);
  assert.equal(ficheDePhoto(cat, { produit: null }), null);
  assert.equal(ficheDePhoto(cat, { produit: 'gateaux-sur-commande/inconnu' }), null);
  assert.equal(ficheDePhoto(null, { produit: LAYER }), null);
});

test('photo sans produit : recherche et consigne du rayon (« Choisissez la taille de la bûche »)', () => {
  assert.deepEqual(navigationPourPhoto({ categorie: 'Bûches', produit: null }), { recherche: 'bûche', consigne: 'Choisissez la taille de la bûche' });
  const autre = navigationPourPhoto({ categorie: 'Rayon inconnu', produit: null });
  assert.equal(autre.recherche, 'Rayon inconnu');
  assert.match(autre.consigne, /Choisissez/);
  // Les rayons de photos sans produit ont leur navigation (pas de grille vide).
  for (const p of PHOTOS_SANS_PRODUIT) {
    assert.notEqual(navigationPourPhoto(p).recherche, p.categorie, `rayon sans navigation : ${p.categorie}`);
  }
  // Rayon créé par le gérant, photo avec produit : la recherche est le nom du rayon.
  assert.equal(navigationPourPhoto(photo('P001', 'Anniversaire', LAYER)).recherche, 'Anniversaire');
});

// --------------------------------------------- Audit du 28/10/2026 : une photo n'ajoute jamais de pièce

const BUCHE = 'comptoir/buche-6p';
const buche: FicheCatalogue = {
  produit: { id: BUCHE, produit: 'Bûche', sousCategorie: '6P', unite: 'piece', regimePrix: 'A', famille: 'patisserie', categorie: 'Test', estFavori: false },
  prix: { prixCentimes: PRIX, basePrix: 'piece', prixEstPlancher: false, minQuantite: null, minParSymbole: null, maxParUnite: null },
};

test('photo sur un produit DÉJÀ au bon sans photo : la photo s’y pose, quantité inchangée (Bûche 1 → 1, burgers 10 → 10)', () => {
  const avecBuche = toucherProduit([], buche).lignes;
  assert.equal(avecBuche[0].quantite, 1);
  const t = ajouterAvecPhoto(avecBuche, buche, { id: 'B001' }, cat, FAMILLES, SUPPLEMENTS_PAR_PERSONNE, []);
  assert.equal(t.lignes.length, 1);
  assert.equal(t.lignes[0].quantite, 1, 'jamais +1');
  assert.equal(t.lignes[0].photoModele, 'B001');
  assert.equal(t.cle, avecBuche[0].cle);

  const dix: LigneEcran[] = [{ ...ligneVide(MINI), quantite: 10 }];
  const m = ajouter(dix, mini, 'S002');
  assert.equal(m.lignes.length, 1);
  assert.equal(m.lignes[0].quantite, 10, '10 mini-burgers restent 10');
  assert.equal(m.lignes[0].photoModele, 'S002');
});

test('même photo touchée deux fois : rien ne change (ni quantité, ni ligne)', () => {
  const un = ajouter([{ ...ligneVide(MINI), quantite: 10 }], mini, 'S002').lignes;
  const deux = ajouter(un, mini, 'S002');
  assert.equal(deux.lignes.length, 1);
  assert.equal(deux.lignes[0].quantite, 10);
});

test('produit déjà au bon avec une AUTRE photo : nouvelle ligne, la première intacte', () => {
  const un = ajouter([{ ...ligneVide(MINI), quantite: 10 }], mini, 'S002').lignes;
  const deux = ajouter(un, mini, 'S005');
  assert.equal(deux.lignes.length, 2);
  assert.deepEqual(deux.lignes.map((l) => [l.photoModele, l.quantite]), [['S002', 10], ['S005', 1]]);
});

test('photo en attente posée au prochain produit touché (déjà au bon) : quantité inchangée', () => {
  // `toucher` de l'écran appelle `ajouterAvecPhoto` avec la photo en attente : même règle.
  const avecBuche = toucherProduit([], buche).lignes;
  const t = ajouterAvecPhoto(avecBuche, buche, { id: 'B001' }, cat, FAMILLES, SUPPLEMENTS_PAR_PERSONNE, []);
  assert.equal(t.lignes[0].quantite, 1);
});
