// node --test src/domaine/beignets.test.ts
//
// Beignet (propriétaire, 21/11/2026) : « au choix du client, soit sucré soit nature ».
// Même mécanisme que la viande du burger (R73), avec les mots « sorte ». Vrai catalogue.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogueDepuisDossier } from '../catalogue/chargerFichiers.ts';
import { creerApiCatalogue } from '../catalogue/catalogue.ts';
import { GOUTS_SUR_COMMANDE, goutsPropres } from '../catalogue/goutsSurCommande.ts';
import { GOUT_AU_CHOIX, motDuChoix, validerGouts } from './gouts.ts';
import { ficheDe, ligneVide, motDeLaLigne, type CatalogueCommande, type FicheCatalogue } from '../components/commande/modele.ts';
import { libelleManque, texteChampVide } from '../components/commande/manques.ts';
import { goutsLignesAImprimer } from '../lib/ticketCanvas.ts';

const DATE = '2026-11-20';
const BEIGNET = 'viennoiserie/beignet';

const api = creerApiCatalogue(chargerCatalogueDepuisDossier().catalogue);
const p = api.getProduit(BEIGNET);
const x = api.getPrix(BEIGNET, DATE);
assert.ok(p.ok && x.ok, 'Beignet absent du catalogue');
const fiche = { produit: p.donnees, prix: x.donnees } as unknown as FicheCatalogue;
const catalogue: CatalogueCommande = { date: DATE, fiches: [fiche] };

test('donnée : le beignet demande une sorte, Sucré ou Nature, comme choix fermé', () => {
  const c = GOUTS_SUR_COMMANDE[BEIGNET];
  assert.ok(c && c.liste === 'propre' && c.viande === true && c.sorte === true);
  assert.deepEqual([...c.gouts], ['Sucré', 'Nature']);
  assert.equal(motDuChoix(c), 'sorte');
  assert.equal(goutsPropres(BEIGNET), null, 'pas une colonne du tarif');
  // Le burger garde ses mots.
  assert.equal(motDuChoix(GOUTS_SUR_COMMANDE['sales/burger']), 'viande');
});

test('sans sorte : refus en français, sortie = les deux sortes, jamais « au choix du pâtissier »', () => {
  const r = validerGouts(GOUTS_SUR_COMMANDE[BEIGNET], fiche, []);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, 'ERR_VIANDE_MANQUANTE');
  assert.match(r.message, /la sorte/);
  assert.doesNotMatch(r.message, /viande/);
  assert.deepEqual(r.valeurProposee, ['Sucré', 'Nature']);
  const au = validerGouts(GOUTS_SUR_COMMANDE[BEIGNET], fiche, [GOUT_AU_CHOIX]);
  assert.equal(au.ok, false);
});

test('une sorte de la liste est acceptée, sans casse', () => {
  const r = validerGouts(GOUTS_SUR_COMMANDE[BEIGNET], fiche, [' nature ']);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.donnees, ['Nature']);
});

test('écran et bon : « Sorte », jamais « Viande »', () => {
  const ligne = { ...ligneVide(BEIGNET), quantite: 12 };
  assert.equal(motDeLaLigne(ligne), 'sorte');
  const vide = { message: 'x', champ: 'lignes[0].gouts', code: 'ERR_VIANDE_MANQUANTE' };
  assert.match(texteChampVide(vide, [ligne]), /sorte/);
  assert.match(texteChampVide(vide), /viande/i, 'sans ligne connue, mot par défaut');
  const manque = libelleManque(
    { code: 'ERR_VIANDE_MANQUANTE', message: 'Choisissez la sorte', champ: 'lignes[0].gouts' } as never,
    [ligne],
    catalogue,
  );
  assert.match(manque.titre, /^Sorte/);
  assert.deepEqual(goutsLignesAImprimer(['Sucré'], true, true), [goutsLignesAImprimer(['Sucré'], true, true)![0]]);
  assert.match(goutsLignesAImprimer(['Sucré'], true, true)![0], /SORTE\s*:\s*SUCRÉ/);
  assert.match(goutsLignesAImprimer(['Kefta'], true)![0], /VIANDE/);
  assert.ok(ficheDe(catalogue, BEIGNET));
});
