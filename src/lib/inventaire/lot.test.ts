// node --test src/lib/inventaire/lot.test.ts
// Rejeu serveur des contrôles d'inventaire (POST /api/inventaires).
// LOI 10 : aucun import de src/catalogue, la liste d'inventaire est une donnée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { idsDuLot, preparerLot, versProduitInventaire } from './lot.ts';

const PRODUITS = [
  versProduitInventaire({ id: 1, nom: 'Baguette blanche', unite: 'piece', actif: true }),
  versProduitInventaire({ id: 2, nom: 'Halwa arbia', unite: 'kg', actif: true }),
  versProduitInventaire({ id: 3, nom: 'Ancien produit', unite: 'piece', actif: false }),
];
const JOUR = '2026-10-15';
const UUID_A = '0b6f2f0e-1c1d-4c55-9a43-2f1d8a7c0a01';
const UUID_B = '0b6f2f0e-1c1d-4c55-9a43-2f1d8a7c0a02';

test('id inconnu de la liste d’inventaire → ERR_PRODUIT_INCONNU (liste inventaire), champ produit:<id>', () => {
  const r = preparerLot([{ produitId: 999, saisieId: UUID_A, unite: 'piece', quantiteRestante: 4 }], PRODUITS, JOUR);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_PRODUIT_INCONNU');
    assert.equal(r.champ, 'produit:999');
    assert.match(r.message, /liste d’inventaire/);
  }
});

test('produit retiré, identifiant illisible → ERR_PRODUIT_INCONNU', () => {
  for (const produitId of [3, 'abc', -1, 1.5]) {
    const r = preparerLot([{ produitId, unite: 'piece', quantiteRestante: 1 }], PRODUITS, JOUR);
    assert.equal(r.ok, false, String(produitId));
    if (!r.ok) assert.equal(r.code, 'ERR_PRODUIT_INCONNU');
  }
});

test('produit au kilo envoyé à la pièce (ou sans unité) → ERR_UNITE_INCOHERENTE', () => {
  for (const unite of ['piece', undefined, 'g']) {
    const r = preparerLot([{ produitId: 2, unite, quantiteRestante: 3 }], PRODUITS, JOUR);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, 'ERR_UNITE_INCOHERENTE');
  }
  const ok = preparerLot([{ produitId: 2, unite: 'kg', quantiteRestante: 1250 }], PRODUITS, JOUR);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.lignes[0].valeurs.quantiteRestante, 1250);
});

test('quantité négative refusée (plus de remise silencieuse à 0)', () => {
  const r = preparerLot([{ produitId: 1, unite: 'piece', quantiteRestante: -3 }], PRODUITS, JOUR);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_QUANTITE_NEGATIVE');
    assert.equal(r.champ, 'produit:1');
  }
});

test('null efface (pas de 0 inventé), champ absent non touché', () => {
  const r = preparerLot([{ produitId: 1, unite: 'piece', quantiteRestante: null }], PRODUITS, JOUR);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.lignes[0].valeurs, { quantiteRestante: null });
  }
  const vide = preparerLot([{ produitId: 1, unite: 'piece' }], PRODUITS, JOUR);
  assert.equal(vide.ok, true);
  if (vide.ok) assert.equal(vide.lignes.length, 0);
});

test('même saisieId rejoué → compté une fois ; deux saisies du même produit → addition + AVERT_DOUBLE_SCAN', () => {
  const rejeu = preparerLot(
    [
      { produitId: 1, saisieId: UUID_A, unite: 'piece', quantiteRestante: 5 },
      { produitId: 1, saisieId: UUID_A, unite: 'piece', quantiteRestante: 5 },
    ],
    PRODUITS,
    JOUR,
  );
  assert.equal(rejeu.ok, true);
  if (rejeu.ok) {
    assert.equal(rejeu.lignes[0].valeurs.quantiteRestante, 5);
    assert.equal(rejeu.signalements.length, 0);
  }

  const double = preparerLot(
    [
      { produitId: 1, saisieId: UUID_A, unite: 'piece', quantiteRestante: 5 },
      { produitId: 1, saisieId: UUID_B, unite: 'piece', quantiteRestante: 2 },
    ],
    PRODUITS,
    JOUR,
  );
  assert.equal(double.ok, true);
  if (double.ok) {
    assert.equal(double.lignes.length, 1);
    assert.equal(double.lignes[0].valeurs.quantiteRestante, 7);
    assert.equal(double.signalements[0]?.code, 'AVERT_DOUBLE_SCAN');
    assert.equal(double.signalements[0]?.champ, 'produit:1');
    assert.deepEqual(double.lignes[0].saisieIds, [UUID_A, UUID_B]);
  }

  const conflit = preparerLot(
    [
      { produitId: 1, saisieId: UUID_A, unite: 'piece', quantiteRestante: 5 },
      { produitId: 1, saisieId: UUID_A, unite: 'piece', quantiteRestante: 6 },
    ],
    PRODUITS,
    JOUR,
  );
  assert.equal(conflit.ok, false);
  if (!conflit.ok) assert.equal(conflit.code, 'ERR_CONFLIT_COMPTAGE');
});

test('idsDuLot ne garde que des identifiants entiers positifs', () => {
  assert.deepEqual(idsDuLot([{ produitId: 1 }, { produitId: '2' }, { produitId: 'x' }, { produitId: 1 }]), [1, 2]);
});

test('LOI 10 : les fichiers d’inventaire n’importent jamais src/catalogue', () => {
  const fichiers = [
    'src/lib/inventaire/lot.ts',
    'src/lib/inventaire/controles.ts',
    'src/app/api/inventaires/route.ts',
    'src/app/api/produits/route.ts',
    'src/app/api/releves/route.ts',
    'src/lib/useSaisieJournee.ts',
    'src/app/saisie-vendeur/page.tsx',
    'src/app/saisie-production/page.tsx',
    'src/app/saisie-prevue/page.tsx',
    'src/app/inventaire/page.tsx',
  ];
  for (const f of fichiers) {
    const source = readFileSync(f, 'utf8');
    assert.doesNotMatch(source, /from ['"][^'"]*\/catalogue(\/|['"])/, f);
    assert.doesNotMatch(source, /produitCatalogue/i, f);
  }
});
