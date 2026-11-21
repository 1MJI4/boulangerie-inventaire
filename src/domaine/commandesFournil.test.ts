// node --test src/domaine/commandesFournil.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  controlerLiensFournil,
  formaterDerives,
  totalAProduire,
  partCommandeeParBase,
  preremplirCommandes,
  type LienFournil,
  type LigneCommandee,
} from './commandesFournil.ts';
import { BASES_FOURNIL, basesSuivies, clesSuivies } from '../catalogue/basesFournil.ts';
import { identifiantProduit } from '../catalogue/normaliser.ts';

const PATE_AMANDE = 'viennoiserie/croissant-a-la-pate-damande';
const CROISSANT = 'viennoiserie/croissant';
const PAIN_CHOCOLAT = 'viennoiserie/pain-chocolat';
const COUQUE_BEURRE = 'viennoiserie/couque-au-beurre';
const DOUBLE = 'viennoiserie/couque-au-chocolat-double';

/** La table telle qu'elle sera quand la Couque au chocolat double sera au tarif. */
const LIENS_COMPLETS: LienFournil[] = BASES_FOURNIL.map((l) => ({ ...l, aVenir: false }));

function ligne(cleCatalogue: string, libelle: string, quantite: number, statutCommande = 'a_imprimer'): LigneCommandee {
  return { cleCatalogue, libelle, quantite, unite: 'piece', statutCommande };
}

/* ------------------------------------------------------ part commandée */

test('une commande de dérivé augmente sa base, sans ligne à part', () => {
  const parts = partCommandeeParBase([ligne(PATE_AMANDE, "Croissant à la pâte d'amande", 7)], BASES_FOURNIL);
  assert.deepEqual(parts, [
    { fournil: 'Croissant', pieces: 7, detail: [{ libelle: "Croissant à la pâte d'amande", pieces: 7, derive: true }] },
  ]);
});

test('6 couques au beurre commandées : la feuille du fournil les ajoute à la Couque au beurre, à la pièce', () => {
  const parts = partCommandeeParBase([ligne(COUQUE_BEURRE, 'Couque au beurre', 6)], BASES_FOURNIL);
  assert.deepEqual(parts, [{ fournil: 'Couque au beurre', pieces: 6, detail: [{ libelle: 'Couque au beurre', pieces: 6, derive: false }] }]);
});

test('beignets : la sorte choisie (sucré / nature) désigne la ligne du fournil', () => {
  const b = 'viennoiserie/beignet';
  const parts = partCommandeeParBase(
    [{ ...ligne(b, 'Beignet', 15), gouts: ['Sucré'] }, { ...ligne(b, 'Beignet', 10), gouts: ['nature'] }, { ...ligne(b, 'Beignet', 3), gouts: ['Sucré'] }],
    BASES_FOURNIL,
  );
  assert.deepEqual(parts.map((p) => [p.fournil, p.pieces]), [['Beignet sucré', 18], ['Beignet nature', 10]]);
  // Sans sorte (ne peut pas arriver : elle est obligatoire) : rien n'est deviné.
  assert.deepEqual(partCommandeeParBase([ligne(b, 'Beignet', 5)], BASES_FOURNIL), []);
});

test('deux dérivés de bases différentes : chacun augmente la sienne', () => {
  const parts = partCommandeeParBase(
    [ligne(PATE_AMANDE, "Croissant à la pâte d'amande", 7), ligne(DOUBLE, 'Couque au chocolat double', 2)],
    LIENS_COMPLETS,
  );
  assert.deepEqual(parts.map((p) => [p.fournil, p.pieces]), [['Croissant', 7], ['Couque au chocolat', 2]]);
});

test('le produit simple et son dérivé s’additionnent sur la même base, détail gardé', () => {
  const parts = partCommandeeParBase(
    [
      ligne(CROISSANT, 'Croissant', 10),
      ligne(PATE_AMANDE, "Croissant à la pâte d'amande", 4),
      ligne(PATE_AMANDE, "Croissant à la pâte d'amande", 3, 'imprimee'),
    ],
    BASES_FOURNIL,
  );
  assert.equal(parts.length, 1);
  assert.equal(parts[0].pieces, 17);
  assert.deepEqual(parts[0].detail, [
    { libelle: 'Croissant', pieces: 10, derive: false },
    { libelle: "Croissant à la pâte d'amande", pieces: 7, derive: true },
  ]);
});

test('une commande annulée ne compte plus', () => {
  const parts = partCommandeeParBase(
    [ligne(PATE_AMANDE, "Croissant à la pâte d'amande", 7, 'annulee'), ligne(PAIN_CHOCOLAT, 'Pain chocolat', 5)],
    BASES_FOURNIL,
  );
  assert.deepEqual(parts.map((p) => [p.fournil, p.pieces]), [['Couque au chocolat', 5]]);
});

test('« Croissant aux amandes » et « Croissant au chocolat » ne sont PAS des dérivés : chacun augmente SA ligne, jamais le Croissant', () => {
  const parts = partCommandeeParBase(
    [
      ligne('viennoiserie/croissant-aux-amandes', 'Croissant aux amandes', 12),
      ligne('viennoiserie/croissant-au-chocolat', 'Croissant au chocolat', 12),
    ],
    LIENS_COMPLETS,
  );
  assert.deepEqual(parts.map((p) => [p.fournil, p.pieces]), [['Croissant au chocolat', 12], ['Croissant aux amandes', 12]]);
  assert.ok(parts.every((p) => p.detail.every((d) => !d.derive)));
  assert.ok(!parts.some((p) => p.fournil === 'Croissant'));
});

test('une entrée « à venir » ne sert pas tant que le produit n’est pas au tarif', () => {
  assert.deepEqual(partCommandeeParBase([ligne(DOUBLE, 'Couque au chocolat double', 6)], BASES_FOURNIL), []);
});

test('lignes ignorées : au kilo, sans produit du catalogue, quantité invalide', () => {
  const parts = partCommandeeParBase(
    [
      { cleCatalogue: CROISSANT, libelle: 'Croissant', quantite: 500, unite: 'kg', statutCommande: 'a_imprimer' },
      { cleCatalogue: null, libelle: 'Croissant', quantite: 5, unite: 'piece', statutCommande: 'a_imprimer' },
      ligne(CROISSANT, 'Croissant', 0),
      ligne(CROISSANT, 'Croissant', 2.5),
    ],
    BASES_FOURNIL,
  );
  assert.deepEqual(parts, []);
});

/* ------------------------------------------------------------ plateaux */

test('préremplissage : 6 → + 6, 7 → + 7, 10 → + 10, rien de complété ni de toléré', () => {
  assert.deepEqual(preremplirCommandes(6, 16), { plateaux: 0, plus: 6 });
  assert.deepEqual(preremplirCommandes(7, 16), { plateaux: 0, plus: 7 });
  assert.deepEqual(preremplirCommandes(10, 16), { plateaux: 0, plus: 10 });
  assert.deepEqual(preremplirCommandes(15, 16), { plateaux: 0, plus: 15 });
});

test('préremplissage : 16 → directement 1 plateau ; 20 → 1 plateau et + 4 ; 32 → 2 plateaux', () => {
  assert.deepEqual(preremplirCommandes(16, 16), { plateaux: 1, plus: 0 });
  assert.deepEqual(preremplirCommandes(20, 16), { plateaux: 1, plus: 4 });
  assert.deepEqual(preremplirCommandes(32, 16), { plateaux: 2, plus: 0 });
});

test('préremplissage : rien commandé, valeur invalide ou produit sans plateau', () => {
  assert.deepEqual(preremplirCommandes(0, 16), { plateaux: 0, plus: 0 });
  assert.deepEqual(preremplirCommandes(-3, 16), { plateaux: 0, plus: 0 });
  assert.deepEqual(preremplirCommandes(1.5, 16), { plateaux: 0, plus: 0 });
  assert.deepEqual(preremplirCommandes(9, 0), { plateaux: 0, plus: 9 });
});

test('total à produire : prévu 48 + 16 pour les commandes = 64', () => {
  assert.equal(totalAProduire(48, 16), 64);
  assert.equal(totalAProduire(null, 16), 16);
  assert.equal(totalAProduire(48, null), 48);
  assert.equal(totalAProduire(undefined, undefined), 0);
});

test('détail des dérivés : seuls les produits finis après cuisson sont cités', () => {
  assert.equal(
    formaterDerives([
      { libelle: 'Croissant', pieces: 10, derive: false },
      { libelle: "Croissant à la pâte d'amande", pieces: 7, derive: true },
    ]),
    "dont 7 Croissant à la pâte d'amande",
  );
  assert.equal(formaterDerives([{ libelle: 'Croissant', pieces: 10, derive: false }]), '');
});

/* --------------------------------------------------------------- table */

/** Clés des produits à la pièce du tarif comptoir en vigueur (hors « Favoris », LOI 4). */
function clesDuTarif(fichier: string): Set<string> {
  const cles = new Set<string>();
  const lignes = readFileSync(new URL(`../../data/${fichier}`, import.meta.url), 'utf8').split(/\r?\n/).slice(1);
  for (const l of lignes) {
    const c = l.split(',');
    if (c.length < 7 || c[0] === 'Favoris' || c[5] !== 'piece') continue;
    cles.add(identifiantProduit(c[0], c[1], c[2]));
  }
  return cles;
}

test('la table ne cite que des produits à la pièce du tarif (hors entrées à venir)', () => {
  const cles = clesDuTarif('catalogue_prix_2026-11.csv');
  assert.deepEqual(controlerLiensFournil(BASES_FOURNIL, (cle) => cles.has(cle)), []);
  assert.deepEqual(clesSuivies(), BASES_FOURNIL.filter((l) => !l.aVenir).map((l) => l.commande));
  assert.ok(clesSuivies().includes(COUQUE_BEURRE) && clesSuivies().includes(CROISSANT) && clesSuivies().includes(PAIN_CHOCOLAT));
  assert.deepEqual(basesSuivies().slice(0, 3), ['Croissant', 'Couque au chocolat', 'Couque au beurre']);
  assert.equal(new Set(basesSuivies()).size, basesSuivies().length);
});

test('contrôle de la table : clé inconnue ou citée deux fois', () => {
  const erreurs = controlerLiensFournil(
    [
      { commande: 'viennoiserie/inconnu', fournil: 'Croissant', derive: true },
      { commande: CROISSANT, fournil: 'Croissant', derive: false },
      { commande: CROISSANT, fournil: 'Couque au chocolat', derive: false },
    ],
    (cle) => cle === CROISSANT,
  );
  assert.equal(erreurs.length, 2);
});
