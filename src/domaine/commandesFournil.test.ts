// node --test src/domaine/commandesFournil.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  TOLERANCE_SANS_PLATEAU,
  controlerLiensFournil,
  formaterDerives,
  formaterResumePlateaux,
  totalAProduire,
  partCommandeeParBase,
  plateauxEnPlus,
  plateauxParSorte,
  partDuManager,
  type LienFournil,
  type LigneCommandee,
} from './commandesFournil.ts';
import { BASES_FOURNIL, basesSuivies, clesSuivies } from '../catalogue/basesFournil.ts';
import { identifiantProduit } from '../catalogue/normaliser.ts';

const PATE_AMANDE = 'viennoiserie/croissant-a-la-pate-damande';
const CROISSANT = 'viennoiserie/croissant';
const PAIN_CHOCOLAT = 'viennoiserie/pain-chocolat';
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

test('« Croissant aux amandes » et « Croissant au chocolat » ne sont PAS des dérivés', () => {
  const parts = partCommandeeParBase(
    [
      ligne('viennoiserie/croissant-aux-amandes', 'Croissant aux amandes', 12),
      ligne('viennoiserie/croissant-au-chocolat', 'Croissant au chocolat', 12),
    ],
    LIENS_COMPLETS,
  );
  assert.deepEqual(parts, []);
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

const sortes = (croissants: number, couques: number) => [
  { fournil: 'Croissant', pieces: croissants },
  { fournil: 'Couque au chocolat', pieces: couques },
];

test('la tolérance est de 4 pièces', () => {
  assert.equal(TOLERANCE_SANS_PLATEAU, 4);
});

test('jusqu’à 4 pièces : pas de plateau en plus, pris sur la vente normale', () => {
  for (const n of [1, 2, 3, 4]) {
    const p = plateauxEnPlus(sortes(n, 0), 16);
    assert.equal(p.plateaux, 0, String(n));
    assert.equal(p.prisesSurVente, n, String(n));
    assert.deepEqual(p.repartition.map((r) => r.aSortir), [0, 0], String(n));
  }
});

test('5 pièces : un plateau en plus, complété à 16', () => {
  const p = plateauxEnPlus(sortes(5, 0), 16);
  assert.equal(p.plateaux, 1);
  assert.equal(p.prisesSurVente, 0);
  assert.equal(p.complement, 11);
  assert.equal(p.sorteDuComplement, 'Croissant');
  assert.deepEqual(p.repartition.map((r) => r.aSortir), [16, 0]);
});

test('16 → 1 plateau juste ; 20 → 1 plateau et 4 sur la vente ; 21 → 2 plateaux', () => {
  const seize = plateauxEnPlus(sortes(16, 0), 16);
  assert.deepEqual([seize.plateaux, seize.prisesSurVente, seize.complement], [1, 0, 0]);
  const vingt = plateauxEnPlus(sortes(20, 0), 16);
  assert.deepEqual([vingt.plateaux, vingt.prisesSurVente, vingt.complement], [1, 4, 0]);
  assert.deepEqual(vingt.repartition.map((r) => r.aSortir), [16, 0]);
  const vingtEtUn = plateauxEnPlus(sortes(21, 0), 16);
  assert.deepEqual([vingtEtUn.plateaux, vingtEtUn.prisesSurVente, vingtEtUn.complement], [2, 0, 11]);
});

test('plateau partagé entre sortes : 7 croissants + 2 couques = 1 seul plateau', () => {
  const p = plateauxEnPlus(sortes(7, 2), 16);
  assert.equal(p.totalCommandees, 9);
  assert.equal(p.plateaux, 1);
  // Complété par la sorte la plus commandée.
  assert.deepEqual(p.repartition, [
    { fournil: 'Croissant', commandees: 7, aSortir: 14 },
    { fournil: 'Couque au chocolat', commandees: 2, aSortir: 2 },
  ]);
  assert.equal(formaterResumePlateaux(p), '9 pièces commandées → 1 plateau en plus : 14 Croissant + 2 Couque au chocolat');
});

test('deux sortes qui tiennent ensemble : 6 + 6 = 1 plateau, pas 2', () => {
  const p = plateauxEnPlus(sortes(6, 6), 16);
  assert.equal(p.plateaux, 1);
  assert.equal(p.sorteDuComplement, 'Croissant'); // égalité : la première de la liste
  assert.deepEqual(p.repartition.map((r) => r.aSortir), [10, 6]);
});

test('3 + 2 = 5 : chaque sorte seule resterait sous le seuil, ensemble un plateau', () => {
  assert.equal(plateauxEnPlus(sortes(3, 2), 16).plateaux, 1);
});

test('les pièces à sortir font toujours des plateaux entiers', () => {
  for (let a = 0; a <= 40; a++) {
    for (let b = 0; b <= 40; b++) {
      const p = plateauxEnPlus(sortes(a, b), 16);
      const sorties = p.repartition.reduce((s, r) => s + r.aSortir, 0);
      assert.equal(sorties, p.plateaux * 16, `${a}+${b}`);
      assert.equal(sorties, a + b - p.prisesSurVente + p.complement, `${a}+${b}`);
      assert.ok(p.prisesSurVente <= 4, `${a}+${b}`);
      assert.ok(p.repartition.every((r) => r.aSortir >= 0), `${a}+${b}`);
    }
  }
});

test('résumé : rien, sous le seuil, avec reste pris sur la vente', () => {
  assert.equal(formaterResumePlateaux(plateauxEnPlus(sortes(0, 0), 16)), '');
  assert.equal(
    formaterResumePlateaux(plateauxEnPlus(sortes(1, 0), 16)),
    '1 pièce commandée — à prendre sur les plateaux prévus, pas de plateau en plus',
  );
  assert.equal(
    formaterResumePlateaux(plateauxEnPlus(sortes(12, 8), 16)),
    '20 pièces commandées → 1 plateau en plus : 8 Croissant + 8 Couque au chocolat · 4 à prendre sur les plateaux prévus',
  );
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
  assert.deepEqual(clesSuivies(), [CROISSANT, PATE_AMANDE, PAIN_CHOCOLAT]);
  assert.deepEqual(basesSuivies(), ['Croissant', 'Couque au chocolat']);
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

/* ---- Prévisions : les plateaux des commandes déjà dans le champ (propriétaire, 19/11/2026) */

test('plateaux des commandes par sorte : 55 couques → 4 plateaux sur la Couque, rien sur le Croissant', () => {
  assert.deepEqual(plateauxParSorte(sortes(0, 55), 16), new Map([['Croissant', 0], ['Couque au chocolat', 4]]));
  // Plateau partagé : il s'affiche sur la sorte la plus commandée, une seule fois.
  assert.deepEqual(plateauxParSorte(sortes(7, 2), 16), new Map([['Croissant', 1], ['Couque au chocolat', 0]]));
  // Sous le seuil : aucun plateau en plus.
  assert.deepEqual(plateauxParSorte(sortes(3, 0), 16), new Map([['Croissant', 0], ['Couque au chocolat', 0]]));
  // Chaque sorte remplit ses plateaux : 32 + 16 = 2 et 1.
  assert.deepEqual(plateauxParSorte(sortes(32, 16), 16), new Map([['Croissant', 2], ['Couque au chocolat', 1]]));
  // 20 + 20 = 40 → 3 plateaux (8 en trop > 4) : 1 chacun, le 3e à la première des deux.
  assert.deepEqual(plateauxParSorte(sortes(20, 20), 16), new Map([['Croissant', 2], ['Couque au chocolat', 1]]));
});

test('champ des prévisions : le manager modifie le total, sa part = total tapé − plateaux des commandes', () => {
  assert.equal(partDuManager(7, 4), 3);
  assert.equal(partDuManager(4, 4), 0);
  // Il ne descend pas sous ce que les commandes demandent : sa part reste à 0.
  assert.equal(partDuManager(2, 4), 0);
  assert.equal(partDuManager(5, 0), 5);
});
