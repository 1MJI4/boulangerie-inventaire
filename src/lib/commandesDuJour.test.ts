// node --test src/lib/commandesDuJour.test.ts
//
// Bloc « Commandes pour demain » des prévisions (propriétaire, 19/11/2026) :
// « 22 × Bavarois » était faux — c'étaient DEUX gâteaux, de 10 et 12 personnes.
// Un gâteau vendu par personne ne s'additionne jamais en pièces.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { LigneCommande } from './commandes.ts';
import { resumeCommandesDuJour } from './commandesDuJour.ts';

const ligne = (libelle: string, quantite: number, base: 'piece' | 'personne' | 'kg', partiel: Partial<LigneCommande> = {}): LigneCommande =>
  ({
    libelle,
    quantite,
    prixCentimes: 100,
    unite: base === 'kg' ? 'kg' : 'piece',
    poste: null,
    precision: null,
    produitCatalogue: null,
    prixProduit: { basePrix: base },
    ...partiel,
  }) as LigneCommande;
const commande = (...lignes: LigneCommande[]) => ({ lignes });
const lu = (r: { quantite: string; libelle: string }[]) => r.map((x) => `${x.quantite} ${x.libelle}`.replace(/ /g, ' ').trim());

test('deux Bavarois de tailles différentes : deux lignes « 1 gâteau », jamais « 22 × Bavarois »', () => {
  const r = lu(resumeCommandesDuJour([commande(ligne('Bavarois', 10, 'personne')), commande(ligne('Bavarois', 12, 'personne'))]));
  assert.deepEqual(r, ['1 gâteau Bavarois — 10 personnes', '1 gâteau Bavarois — 12 personnes']);
});

test('deux gâteaux identiques : « 2 gâteaux … — 20 personnes chacun »', () => {
  const r = lu(resumeCommandesDuJour([commande(ligne('Layer Cake', 20, 'personne')), commande(ligne('Layer Cake', 20, 'personne'))]));
  assert.deepEqual(r, ['2 gâteaux Layer Cake — 20 personnes chacun']);
});

test('à la pièce : les mêmes produits de plusieurs commandes s’additionnent ; au kilo : le poids', () => {
  const r = lu(
    resumeCommandesDuJour([
      commande(ligne('Crêpe facie poulet', 4, 'piece'), ligne('Corne de gazelle', 750, 'kg')),
      commande(ligne('Crêpe facie poulet', 2, 'piece'), ligne('Corne de gazelle', 500, 'kg'), ligne('Bavarois framboise 6P', 1, 'piece')),
    ]),
  );
  assert.deepEqual(r, ['6 × Crêpe facie poulet', '1,250 kg Corne de gazelle', '1 × Bavarois framboise 6P']);
});

test('le goût qui donne son nom au gâteau est gardé : deux goûts = deux lignes', () => {
  const r = lu(
    resumeCommandesDuJour([
      commande(ligne('Entremet', 10, 'personne', { gouts: ['Saint-Michel'] }), ligne('Entremet', 10, 'personne', { gouts: ['Javanais'] })),
    ]),
  );
  assert.deepEqual(r, ['1 gâteau Entremet (Saint-Michel) — 10 personnes', '1 gâteau Entremet (Javanais) — 10 personnes']);
});
