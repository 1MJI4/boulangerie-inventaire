// node --test src/domaine/postes.test.ts
//
// R74 — un papier par poste de production (propriétaire, 19/11/2026) :
// pâtissier, atelier (salé), boulanger. Qui fait quoi est une DONNÉE
// (src/catalogue/postesProduction.ts) ; le boulanger a son échéance, 2 heures
// avant le retrait. Vrai catalogue : aucun produit ne doit être « à personne ».
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogueDepuisDossier } from '../catalogue/chargerFichiers.ts';
import { POSTES_PRODUCTION } from '../catalogue/postesProduction.ts';
import { AVANCE_POSTE_MINUTES } from './constantes.ts';
import { echeancePoste, repartirParPoste, tachesDuProduit, type LignePoste, type Poste } from './postes.ts';

const produits = [...chargerCatalogueDepuisDossier().catalogue.produits.values()];
const produit = (id: string) => {
  const p = produits.find((x) => x.id === id);
  assert.ok(p, `${id} absent du catalogue`);
  return p;
};
const postesDe = (id: string): Poste[] => {
  const p = produit(id);
  const t = tachesDuProduit(p.id, p.categorie, POSTES_PRODUCTION);
  assert.ok(t, `${id} : rayon « ${p.categorie} » sans poste`);
  return t.filter((x) => !x.auDela).map((x) => x.poste);
};
const ligne = (id: string, quantite: number): LignePoste => ({ cle: id, rayon: produit(id).categorie, quantite });

test('donnée : chaque rayon du catalogue a ses postes — aucun produit vendable n’est « à personne » sans le dire', () => {
  const sansPoste: string[] = [];
  for (const p of produits) {
    if (p.regimePrix === null) continue;
    const t = tachesDuProduit(p.id, p.categorie, POSTES_PRODUCTION);
    assert.ok(t !== null, `rayon « ${p.categorie} » absent de POSTES_PRODUCTION (${p.id})`);
    if (t.length === 0) sansPoste.push(p.categorie);
  }
  // Rien à produire : la revente (boissons, café) et les suppléments, qui suivent leur gâteau.
  assert.deepEqual([...new Set(sansPoste)].sort(), ['Café', 'Frigo-Boisson']);
  // Chaque produit nommé dans la donnée existe au catalogue (pas de faute de frappe).
  for (const cle of Object.keys(POSTES_PRODUCTION.parProduit)) assert.ok(produits.some((p) => p.id === cle), `${cle} inconnu du catalogue`);
});

test('qui fait quoi (réponses du propriétaire, 19/11/2026)', () => {
  // Pâtissier : gâteaux, minis sucrés, viennoiserie.
  assert.deepEqual(postesDe('gateaux-et-tartes/fraisier/6p'), ['patissier']);
  assert.deepEqual(postesDe('gateaux-sur-commande/layer-cake'), ['patissier']);
  assert.deepEqual(postesDe('gateaux-sur-commande/mini-tartelette'), ['patissier']);
  assert.deepEqual(postesDe(produits.find((p) => p.categorie === 'Viennoiserie' && p.produit === 'Croissant')!.id), ['patissier']);
  // Atelier : traiteur salé.
  assert.deepEqual(postesDe('sur-commande/mini-wrap'), ['atelier']);
  // Burger : l'atelier monte, le boulanger fait le pain.
  for (const id of ['sales/burger', 'sales/mini-burger', 'sur-commande/mini-burger']) assert.deepEqual(postesDe(id), ['atelier', 'boulanger'], id);
  // Msemen, Meloui : le boulanger (pâte, cuits). Batbout : pâte du boulanger, cuisson à l'atelier (20/11/2026).
  for (const p of produits.filter((x) => x.categorie === 'Oriental' && /^(Msemen|Meloui)/.test(x.produit))) assert.deepEqual(postesDe(p.id), ['atelier', 'boulanger'], p.id);
  for (const id of ['oriental/grand-makla', 'oriental/petit-makla']) assert.deepEqual(postesDe(id), ['atelier', 'boulanger'], id);
  assert.deepEqual(postesDe(produits.find((p) => p.produit === 'Petit Batbout')!.id), ['atelier', 'boulanger']);
  assert.deepEqual(postesDe('sales/batbout-healthy'), ['atelier', 'boulanger']);
  assert.deepEqual(postesDe('sales/batbout-farci'), ['atelier', 'boulanger']);
  assert.deepEqual(postesDe('sur-commande/mini-batbout-farci'), ['atelier', 'boulanger']);
  // Harcha, Baghrir (avec ou sans confiture) : l'atelier seul (20/11/2026).
  for (const p of produits.filter((x) => x.categorie === 'Oriental' && /^(Harcha|Baghrer)/.test(x.produit))) assert.deepEqual(postesDe(p.id), ['atelier'], p.id);
  // Beignet (21/11/2026) : atelier, pâte du boulanger — pas le pâtissier de son rayon.
  assert.deepEqual(postesDe('viennoiserie/beignet'), ['atelier', 'boulanger']);
  // Pains : le boulanger.
  assert.deepEqual(postesDe(produits.find((p) => p.categorie === 'Boulangerie')!.id), ['boulanger']);
});

test('rôle imprimé : le boulanger sait ce qu’il doit faire pour un burger, un msemen', () => {
  const role = (id: string, poste: Poste) => {
    const p = produit(id);
    return tachesDuProduit(p.id, p.categorie, POSTES_PRODUCTION)!.find((t) => t.poste === poste)?.role ?? null;
  };
  assert.equal(role('sur-commande/mini-burger', 'boulanger'), 'le pain');
  assert.equal(role('sales/batbout-farci', 'boulanger'), 'la pâte');
  assert.equal(role('sales/batbout-farci', 'atelier'), 'la cuisson et la garniture');
  assert.equal(role('oriental/petit-batbout', 'atelier'), 'la cuisson');
  assert.equal(role(produits.find((p) => p.produit === 'Meloui')!.id, 'boulanger'), 'la pâte');
  assert.equal(role('oriental/petit-makla', 'atelier'), 'la cuisson');
  assert.equal(role('sur-commande/mini-wrap', 'atelier'), null);
});

test('crêpes farcies : le boulanger est prévenu au-delà de 5, sur le TOTAL de la commande', () => {
  const crepes = produits.filter((p) => p.produit === 'Crêpe facie').map((p) => p.id);
  assert.ok(crepes.length >= 2);
  const postes = (lignes: LignePoste[]) => repartirParPoste(lignes, POSTES_PRODUCTION).map((b) => b.poste);
  assert.deepEqual(postes([ligne(crepes[0], 5)]), ['atelier'], '5 : pas le boulanger');
  assert.deepEqual(postes([ligne(crepes[0], 6)]), ['atelier', 'boulanger'], '6 d’un parfum');
  assert.deepEqual(postes([ligne(crepes[0], 3), ligne(crepes[1], 3)]), ['atelier', 'boulanger'], '3 + 3 = 6 sur la commande');
  assert.deepEqual(postes([ligne(crepes[0], 3), ligne(crepes[1], 2)]), ['atelier'], '3 + 2 = 5');
  // Le boulanger reçoit alors TOUTES les crêpes de la commande, pas seulement la 6e.
  const b = repartirParPoste([ligne(crepes[0], 3), ligne('sur-commande/mini-wrap', 10), ligne(crepes[1], 3)], POSTES_PRODUCTION);
  assert.deepEqual(b.find((x) => x.poste === 'boulanger')!.lignes.map((l) => l.index), [0, 2]);
});

test('répartition : seuls les postes concernés, dans l’ordre pâtissier, atelier, boulanger ; chaque ligne à sa place', () => {
  const lignes = [
    ligne('sur-commande/mini-burger', 15), // 0 : atelier + boulanger
    ligne('gateaux-et-tartes/fraisier/6p', 1), // 1 : pâtissier
    ligne('sur-commande/mini-wrap', 10), // 2 : atelier
    ligne(produits.find((p) => p.categorie === 'Frigo-Boisson')!.id, 6), // 3 : personne
  ];
  const b = repartirParPoste(lignes, POSTES_PRODUCTION);
  assert.deepEqual(b.map((x) => [x.poste, x.lignes.map((l) => l.index)]), [
    ['patissier', [1]],
    ['atelier', [0, 2]],
    ['boulanger', [0]],
  ]);
  assert.equal(b.find((x) => x.poste === 'boulanger')!.lignes[0].role, 'le pain');
  // Pâtisserie seule : un seul papier de production. Boissons seules : aucun.
  assert.deepEqual(repartirParPoste([lignes[1]], POSTES_PRODUCTION).map((x) => x.poste), ['patissier']);
  assert.deepEqual(repartirParPoste([lignes[3]], POSTES_PRODUCTION), []);
});

test('ligne libre (« Autre demande ») : un gâteau va au pâtissier, le reste à l’atelier ; rayon inconnu : tous les postes', () => {
  const postes = (l: LignePoste) => repartirParPoste([l], POSTES_PRODUCTION).map((x) => x.poste);
  assert.deepEqual(postes({ cle: null, rayon: null, quantite: 1, gateauLibre: true }), ['patissier']);
  assert.deepEqual(postes({ cle: null, rayon: null, quantite: 1, gateauLibre: false }), ['atelier']);
  // Produit d'un rayon que la donnée ne connaît pas : personne ne doit le manquer.
  assert.deepEqual(postes({ cle: 'nouveau-rayon/produit', rayon: 'Nouveau rayon', quantite: 1 }), ['patissier', 'atelier', 'boulanger']);
});

test('échéance du boulanger : 2 heures avant le retrait ; les autres postes n’en ont pas', () => {
  assert.equal(AVANCE_POSTE_MINUTES.boulanger, 120);
  assert.deepEqual(echeancePoste('boulanger', '2026-11-21', '10:00'), { date: '2026-11-21', heure: '08:00' });
  assert.deepEqual(echeancePoste('boulanger', '2026-11-21', '06:00'), { date: '2026-11-21', heure: '04:00' }, 'le boulanger travaille la nuit');
  assert.deepEqual(echeancePoste('boulanger', '2026-11-21', '07:30'), { date: '2026-11-21', heure: '05:30' });
  // Passage de minuit : la veille.
  assert.deepEqual(echeancePoste('boulanger', '2026-11-21', '01:00'), { date: '2026-11-20', heure: '23:00' });
  // Sans heure de retrait lisible : pas d'échéance inventée.
  assert.equal(echeancePoste('boulanger', '2026-11-21', null), null);
  assert.equal(echeancePoste('boulanger', '2026-11-21', 'midi'), null);
  assert.equal(echeancePoste('patissier', '2026-11-21', '10:00'), null);
  assert.equal(echeancePoste('atelier', '2026-11-21', '10:00'), null);
  // Réglage : une autre avance.
  assert.deepEqual(echeancePoste('boulanger', '2026-11-21', '10:00', { boulanger: 180 }), { date: '2026-11-21', heure: '07:00' });
});
