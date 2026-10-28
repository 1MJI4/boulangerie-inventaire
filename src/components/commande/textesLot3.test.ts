// node --test src/components/commande/textesLot3.test.ts
// Lot 3 (28/10/2026) : textes du formulaire — heures « 14h30 », « heure à fixer »,
// pas de capitales criées dans la fenêtre « Il manque », espaces insécables.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HEURE_A_FIXER, texteHeure, texteHeureRetrait } from './saisieEnCours.ts';
import { MOTS_MANQUANTS, texteChampVide } from './manques.ts';
import { changementsLisibles } from './historique.ts';

test('heures : « 14:30 » s’affiche « 14h30 », jamais « 14:30 » ; sans heure : « heure à fixer »', () => {
  assert.equal(texteHeure('14:30'), '14h30');
  assert.equal(texteHeure('09:05'), '9h05');
  assert.equal(texteHeure(''), null);
  assert.equal(texteHeure(null), null);
  assert.equal(texteHeureRetrait('14:30'), 'à 14h30');
  assert.equal(texteHeureRetrait(''), HEURE_A_FIXER);
  assert.equal(HEURE_A_FIXER, 'heure à fixer');
});

test('historique : l’heure changée se lit « 14h30 », sans heure « heure à fixer »', () => {
  const existante = {
    client: 'A',
    telephone: '1',
    retraitLe: new Date('2026-10-30T00:00:00Z'),
    retraitHeure: null,
    texteGateau: null,
    zoneDessin: false,
    remarques: null,
    photoImprimee: false,
    photoWhatsapp: false,
    demandeInhabituelle: false,
    modePaiement: 'especes',
    lignes: [],
    totalCentimes: 0,
    acompteCentimes: 0,
  };
  const apres = { ...existante, dateRetrait: '2026-10-30', heureRetrait: '14:30' };
  const c = changementsLisibles(existante as never, apres as never, []);
  assert.ok(c.includes('heure : heure à fixer → 14h30'), c.join(' | '));
});

test('fenêtre « Il manque » : aucun mot en capitales criées', () => {
  for (const [champ, mot] of Object.entries(MOTS_MANQUANTS)) {
    assert.doesNotMatch(mot, /[A-ZÀ-Ý]{2,}/, `${champ} : « ${mot} »`);
  }
  assert.equal(MOTS_MANQUANTS.client, 'Nom du client');
});

test('sous un champ : « À remplir : goût », avec espace insécable avant les deux-points', () => {
  assert.equal(texteChampVide({ message: 'x', champ: 'lignes[0].gouts' }), 'À remplir : goût');
});
