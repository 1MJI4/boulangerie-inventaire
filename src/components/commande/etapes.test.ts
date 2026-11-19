// node --test src/components/commande/etapes.test.ts
//
// Écran de commande en trois étapes (propriétaire, 19/11/2026) : Client,
// Produits, Paiement ; à l'étape Paiement, le bon se relit « comme le carnet »,
// regroupé par famille. Affichage seulement : aucune règle ici.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogueDepuisDossier } from '../../catalogue/chargerFichiers.ts';
import { creerApiCatalogue } from '../../catalogue/catalogue.ts';
import {
  etapeDuChamp,
  groupesDuCarnet,
  ligneOuverteDuBon,
  ligneVide,
  SUPPLEMENT_ECRITURE,
  type CatalogueCommande,
  type FicheCatalogue,
  type LigneEcran,
  quantiteDuCarnet,
} from './modele.ts';

const DATE = '2026-11-20';
const api = creerApiCatalogue(chargerCatalogueDepuisDossier().catalogue);
const catalogue: CatalogueCommande = (() => {
  const fiches: FicheCatalogue[] = [];
  for (const p of chargerCatalogueDepuisDossier().catalogue.produits.values()) {
    const x = api.getPrix(p.id, DATE);
    if (x.ok) fiches.push({ produit: p, prix: x.donnees } as unknown as FicheCatalogue);
  }
  return { date: DATE, fiches };
})();
const premier = (famille: string) => {
  const f = catalogue.fiches.find((x) => x.produit.famille === famille);
  assert.ok(f, `aucun produit de la famille ${famille}`);
  return f.produit.id;
};
const l = (id: string | null, p: Partial<LigneEcran> = {}): LigneEcran => ({ ...ligneVide(id), quantite: 1, ...p });

test('carnet : Salé, puis Gâteaux et pâtisserie, puis Autres ; l’ordre du bon est gardé dans chaque groupe', () => {
  const burger = l('sur-commande/mini-burger', { quantite: 10 });
  const fraisier = l('gateaux-et-tartes/fraisier/6p');
  const ecriture = l(SUPPLEMENT_ECRITURE);
  const bavarois = l('gateaux-sur-commande/bavarois', { quantite: 15 });
  const croissant = l(premier('viennoiserie'), { quantite: 12 });
  const pain = l(premier('boulangerie'), { quantite: 3 });
  const pizza = l(premier('sale'), { quantite: 20 });
  const g = groupesDuCarnet([croissant, fraisier, burger, ecriture, pain, bavarois, pizza], catalogue);
  assert.deepEqual(g.map((x) => x.titre), ['Salé', 'Gâteaux et pâtisserie', 'Autres']);
  assert.deepEqual(g[0].lignes.map((x) => x.cle), [burger.cle, pizza.cle]);
  assert.deepEqual(g[1].lignes.map((x) => x.cle), [fraisier.cle, ecriture.cle, bavarois.cle]);
  assert.deepEqual(g[2].lignes.map((x) => x.cle), [croissant.cle, pain.cle]);
});

test('carnet : groupe vide absent ; chaque ligne une seule fois ; bon vide → aucun groupe', () => {
  assert.deepEqual(groupesDuCarnet([], catalogue), []);
  const g = groupesDuCarnet([l('gateaux-et-tartes/fraisier/6p'), l('gateaux-et-tartes/fraisier/6p')], catalogue);
  assert.deepEqual(g.map((x) => [x.titre, x.lignes.length]), [['Gâteaux et pâtisserie', 2]]);
});

test('carnet : « Autre demande » — un gâteau va avec les gâteaux, le reste dans Autres ; produit inconnu : Autres', () => {
  const gateauLibre = l(null, { libelleLibre: 'Gâteau licorne', gateauLibre: true });
  const libre = l(null, { libelleLibre: 'Plateau de fruits', gateauLibre: false });
  const inconnu = l('produit/qui-nexiste-pas');
  const g = groupesDuCarnet([libre, gateauLibre, inconnu], catalogue);
  assert.deepEqual(g.map((x) => [x.titre, x.lignes.map((y) => y.cle)]), [
    ['Gâteaux et pâtisserie', [gateauLibre.cle]],
    ['Autres', [libre.cle, inconnu.cle]],
  ]);
});

test('étape d’un champ : client → 1, ligne du bon → 2, argent et signature → 3', () => {
  for (const c of ['client', 'telephone', 'dateRetrait', 'heureRetrait']) assert.equal(etapeDuChamp(c), 1, c);
  for (const c of ['lignes', 'lignes[0].quantite', 'lignes[3].gouts', 'lignes[1].texteGateau']) assert.equal(etapeDuChamp(c), 2, c);
  for (const c of ['acompte', 'total', 'vendeur', 'remarques']) assert.equal(etapeDuChamp(c), 3, c);
  for (const c of [undefined, '', 'statut', 'inconnu']) assert.equal(etapeDuChamp(c), null, String(c));
});

test('bon en accordéon : une seule ligne ouverte — celle du pavé, sinon la dernière touchée, sinon la dernière du bon', () => {
  const a = l('sur-commande/mini-burger');
  const b = l('gateaux-et-tartes/fraisier/6p');
  const c = l('gateaux-sur-commande/bavarois');
  const lignes = [a, b, c];
  // Rien de choisi : la dernière ligne du bon (celle qu'on vient d'ajouter).
  assert.equal(ligneOuverteDuBon(lignes, null, null), c.cle);
  // Ligne touchée (carte produit, tuile, ligne repliée) : elle s'ouvre.
  assert.equal(ligneOuverteDuBon(lignes, null, a.cle), a.cle);
  // Un champ de ligne ouvert au pavé l'emporte : on voit ce qu'on est en train de saisir.
  assert.equal(ligneOuverteDuBon(lignes, `${b.cle}.quantite`, a.cle), b.cle);
  // Champ qui n'est pas une ligne (acompte, téléphone) : sans effet.
  assert.equal(ligneOuverteDuBon(lignes, 'acompte', a.cle), a.cle);
  // Ligne retirée depuis : on retombe sur la dernière du bon ; bon vide : aucune.
  assert.equal(ligneOuverteDuBon([a, b], null, c.cle), b.cle);
  assert.equal(ligneOuverteDuBon([a, b], `${c.cle}.quantite`, null), b.cle);
  assert.equal(ligneOuverteDuBon([], null, a.cle), null);
});

test('carnet : un gâteau par personne se lit « 1 gâteau · 10 parts », un individuel « 10 × » (propriétaire, 19/11/2026)', () => {
  assert.equal(quantiteDuCarnet({ quantite: 10, unite: 'piece', parPersonne: true, supplement: false }), '1 gâteau · 10 parts');
  assert.equal(quantiteDuCarnet({ quantite: 10, unite: 'piece', parPersonne: false, supplement: false }), '10 ×');
  // Supplément par personne (Pâte à sucre) : il suit les parts du gâteau, ce n'est pas un gâteau.
  assert.equal(quantiteDuCarnet({ quantite: 24, unite: 'piece', parPersonne: true, supplement: true }), '24 parts');
  assert.equal(quantiteDuCarnet({ quantite: 750, unite: 'kg', parPersonne: false, supplement: false }), '0,750 kg');
  assert.equal(quantiteDuCarnet({ quantite: null, unite: 'piece', parPersonne: true, supplement: false }), '—');
});
