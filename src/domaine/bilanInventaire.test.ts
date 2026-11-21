// Bilan d'une journée d'inventaire : inconnu ≠ zéro, reste seul utile, vendu seulement si tout est connu.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bilanJournee, ecartDeRestes, etatLigne, plusGrosRestes, tauxDeLaLigne, venduDeLaLigne, type LigneBilan } from './bilanInventaire.ts';

const ligne = (nom: string, reste: number | null, produit: number | null, unite?: string): LigneBilan => ({
  nom,
  quantiteRestante: reste,
  quantiteProduite: produit,
  unite,
});

test('état d’une ligne : reste compté sans production = « production manquante », pas « non compté »', () => {
  assert.equal(etatLigne(ligne('Baguette blanche', 38, null)), 'production_manquante');
  assert.equal(etatLigne(ligne('Pistolet gris', 0, null)), 'production_manquante');
  assert.equal(etatLigne(ligne('Croissant', null, 48)), 'reste_manquant');
  assert.equal(etatLigne(ligne('Huit', null, null)), 'rien');
  assert.equal(etatLigne(ligne('Baguette grise', 7, 40)), 'complet');
});

test('vendu et taux : inconnus tant qu’il manque la production ou le reste', () => {
  assert.equal(venduDeLaLigne(ligne('Baguette blanche', 38, null)), null);
  assert.equal(tauxDeLaLigne(ligne('Baguette blanche', 38, null)), null);
  assert.equal(venduDeLaLigne(ligne('Baguette grise', 7, 40)), 33);
  assert.equal(tauxDeLaLigne(ligne('Baguette grise', 7, 40)), 83);
  // Plus de restes que de production (erreur de saisie) : jamais un vendu négatif.
  assert.equal(venduDeLaLigne(ligne('Piccolo', 12, 10)), 0);
  // Production saisie à zéro : pas de taux (division par zéro), le vendu reste 0.
  assert.equal(tauxDeLaLigne(ligne('Pain français', 0, 0)), null);
});

test('journée sans production saisie (cas réel du 18/11/2026) : restes utiles, vendu inconnu', () => {
  const b = bilanJournee([
    ligne('Pain marocain blanc', 5, null),
    ligne('Pain français', 0, null),
    ligne('Baguette blanche', 38, null),
    ligne('Pistolet gris', 0, null),
    ligne('Huit', null, null),
  ]);
  assert.equal(b.produits, 5);
  assert.equal(b.restesComptes, 4);
  assert.equal(b.productionsSaisies, 0);
  assert.equal(b.resteTotalPieces, 43);
  assert.deepEqual(b.aZero, ['Pain français', 'Pistolet gris']);
  // Rien d'inventé : ni « Produit 0 », ni « Vendu 0 », ni 100 %.
  assert.equal(b.produitTotalPieces, null);
  assert.equal(b.venduTotalPieces, null);
  assert.equal(b.tauxVente, null);
});

test('journée complète : vendu et taux sur les seules lignes où tout est connu', () => {
  const b = bilanJournee([ligne('Baguette grise', 7, 40), ligne('Croissant', 2, 32), ligne('Baguette blanche', 38, null)]);
  assert.equal(b.productionsSaisies, 2);
  assert.equal(b.produitTotalPieces, 72);
  assert.equal(b.venduTotalPieces, 63);
  assert.equal(b.tauxVente, 88);
  assert.equal(b.resteTotalPieces, 47);
});

test('aucun reste compté : le total des restes est inconnu, pas zéro', () => {
  const b = bilanJournee([ligne('Huit', null, null), ligne('Croissant', null, 32)]);
  assert.equal(b.resteTotalPieces, null);
  assert.deepEqual(b.aZero, []);
});

test('LOI 2 : un produit au poids (grammes) n’entre jamais dans un total de pièces', () => {
  const lignes = [ligne('Baguette blanche', 38, 60), ligne('Corne de gazelle', 1500, 4000, 'kg')];
  const b = bilanJournee(lignes);
  assert.equal(b.resteTotalPieces, 38);
  assert.equal(b.produitTotalPieces, 60);
  assert.equal(b.venduTotalPieces, 22);
  assert.equal(b.restesComptes, 2);
  assert.deepEqual(plusGrosRestes(lignes, 5).map((l) => l.nom), ['Baguette blanche']);
});

test('plus gros restes : triés, sans les zéros ni les non comptés', () => {
  const lignes = [ligne('Pistolet blanc', 16, null), ligne('Baguette blanche', 38, null), ligne('Pain français', 0, null), ligne('Huit', null, null), ligne('Piccolo blanc', 17, null)];
  assert.deepEqual(plusGrosRestes(lignes, 2).map((l) => l.nom), ['Baguette blanche', 'Piccolo blanc']);
  assert.deepEqual(plusGrosRestes(lignes, 0), []);
});

test('écart avec la semaine précédente : seulement si les deux journées ont des restes comptés', () => {
  const jour = bilanJournee([ligne('Baguette blanche', 38, null)]);
  const avant = bilanJournee([ligne('Baguette blanche', 30, null)]);
  const vide = bilanJournee([ligne('Baguette blanche', null, null)]);
  assert.equal(ecartDeRestes(jour, avant), 8);
  assert.equal(ecartDeRestes(avant, jour), -8);
  assert.equal(ecartDeRestes(jour, vide), null);
  assert.equal(ecartDeRestes(jour, null), null);
});

test('« 0 barré » : compté (l’inventaire peut finir) mais jamais « à zéro » ni compté dans les restes', () => {
  const lignes: LigneBilan[] = [
    { ...ligne('Baguette blanche', 0, null) },
    { ...ligne('Cougnou', 0, null), nonProduit: true },
    { ...ligne('Huit', 12, null) },
    ligne('Torsade', null, null),
  ];
  const b = bilanJournee(lignes);
  assert.equal(b.restesComptes, 3, 'le 0 barré est bien un produit compté');
  assert.deepEqual(b.aZero, ['Baguette blanche'], 'un produit pas produit n’est pas « à zéro » (rien n’a pu se vendre)');
  assert.deepEqual(b.nonProduits, ['Cougnou']);
  assert.equal(b.resteTotalPieces, 12);
});
