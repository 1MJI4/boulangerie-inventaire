// src/components/commande/galerie.test.ts
//
// Galerie de photos de modèles (décision du propriétaire, 26/10/2026) : ce que
// l'ÉCRAN fait d'un toucher sur une photo, et la lecture de l'identifiant par
// la route. Prix des fiches : valeur de test arbitraire (aucun prix du
// catalogue ici, LOI 1).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ajouterAvecPhoto, ficheDePhoto, lirePhotoModele, navigationPourPhoto, retirerPhoto } from './galerie.ts';
import { ligneVide, toucherProduit, SUPPLEMENT_PATE_A_SUCRE, SUPPLEMENT_PHOTO, type CatalogueCommande, type FicheCatalogue, type LigneEcran } from './modele.ts';
import { SUPPLEMENTS_PAR_PERSONNE } from '../../domaine/constantes.ts';
import { PHOTOS_MODELES } from '../../catalogue/photosModeles.ts';

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
  // Chaque rayon de la galerie qui a des photos sans produit a sa navigation (pas de grille vide).
  for (const p of PHOTOS_MODELES.filter((x) => x.produit === null)) {
    assert.notEqual(navigationPourPhoto(p).recherche, p.categorie, `rayon sans navigation : ${p.categorie}`);
  }
});

test('route : identifiant de photo lu au format ET dans la galerie, sinon refus humain (jamais l’erreur de la base)', () => {
  const table = [{ id: 'G043' }];
  assert.deepEqual(lirePhotoModele(undefined, table, 'lignes[0].photoModele'), { ok: true, valeur: null });
  assert.deepEqual(lirePhotoModele(null, table, 'lignes[0].photoModele'), { ok: true, valeur: null });
  assert.deepEqual(lirePhotoModele('', table, 'lignes[0].photoModele'), { ok: true, valeur: null });
  assert.deepEqual(lirePhotoModele('G043', table, 'lignes[0].photoModele'), { ok: true, valeur: 'G043' });
  for (const mauvais of ['g043', 'G43', 'G0433', 'G999', 42, { id: 'G043' }, ' G043']) {
    const r = lirePhotoModele(mauvais, table, 'lignes[2].photoModele');
    assert.equal(r.ok, false, `refusé : ${JSON.stringify(mauvais)}`);
    if (!r.ok) {
      assert.equal(r.code, 'ERR_SAISIE_INVALIDE');
      assert.equal(r.champ, 'lignes[2].photoModele');
      assert.match(r.message, /photo du modèle/);
      assert.doesNotMatch(r.message, /CHECK|constraint|Prisma|violates/i);
    }
  }
  // La vraie galerie : tous ses identifiants passent.
  for (const p of PHOTOS_MODELES) assert.equal(lirePhotoModele(p.id, PHOTOS_MODELES, 'x').ok, true, p.id);
});
