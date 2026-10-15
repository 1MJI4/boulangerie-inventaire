// node --test src/lib/serveur/reglages.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CLES_REGLEMENT, lireReglages, versReglages, type LigneReglage } from './reglages.ts';
import type { ReglementCommande } from '../../domaine/constantes.ts';

// Données de TEST (valeurs volontairement différentes du règlement réel) :
// la seule source des chiffres est la table "Reglage".
const LIGNES: LigneReglage[] = [
  { cle: CLES_REGLEMENT.acomptePourcentageMin, valeur: '30' },
  { cle: CLES_REGLEMENT.heureFermeture, valeur: '"19:30"' },
  { cle: CLES_REGLEMENT.retraitSemaine, valeur: '"08:15"' },
  { cle: CLES_REGLEMENT.retraitWeekEnd, valeur: '"10:45"' },
  { cle: CLES_REGLEMENT.joursWeekEndIso, valeur: '[7]' },
  { cle: CLES_REGLEMENT.famillesPatisserie, valeur: '["famille test"]' },
];

function sans(cle: string): LigneReglage[] {
  return LIGNES.filter((l) => l.cle !== cle);
}
function avec(cle: string, valeur: string): LigneReglage[] {
  return LIGNES.map((l) => (l.cle === cle ? { cle, valeur } : l));
}

test('conversion : forme ReglementCommande du domaine + heure de fermeture', () => {
  const r = versReglages(LIGNES);
  const pourLeDomaine: ReglementCommande = r.reglement;
  assert.deepEqual(pourLeDomaine, {
    acomptePourcentageMin: 30,
    horairesRetraitPatisserie: {
      familles: ['famille test'],
      semaine: '08:15',
      weekEnd: '10:45',
      joursWeekEndIso: [7],
      feriesOuverts: [],
    },
  });
  assert.equal(r.heureFermeture, '19:30');
});

test('clé absente : refus (jamais de valeur par défaut)', () => {
  for (const cle of Object.values(CLES_REGLEMENT)) {
    assert.throws(() => versReglages(sans(cle)), new RegExp(cle));
  }
});

test('valeurs hors format : refus', () => {
  const p = CLES_REGLEMENT.acomptePourcentageMin;
  for (const v of ['101', '-1', '50.5', '"50"', 'x']) assert.throws(() => versReglages(avec(p, v)));
  for (const v of ['"24:00"', '"9:00"', '"9h00"', '900']) {
    assert.throws(() => versReglages(avec(CLES_REGLEMENT.retraitSemaine, v)));
    assert.throws(() => versReglages(avec(CLES_REGLEMENT.heureFermeture, v)));
  }
  for (const v of ['[0]', '[8]', '[6,6]', '6', '["6"]']) {
    assert.throws(() => versReglages(avec(CLES_REGLEMENT.joursWeekEndIso, v)));
  }
  for (const v of ['[]', '[""]', '"patisserie"', '[1]']) {
    assert.throws(() => versReglages(avec(CLES_REGLEMENT.famillesPatisserie, v)));
  }
});

test('plusieurs familles (forme initiale : pâtisserie + viennoiserie)', () => {
  const r = versReglages(avec(CLES_REGLEMENT.famillesPatisserie, '["famille a","famille b"]'));
  assert.deepEqual(r.reglement.horairesRetraitPatisserie.familles, ['famille a', 'famille b']);
});

test('bornes acceptées : 0 et 100 %, aucun jour de week-end', () => {
  assert.equal(versReglages(avec(CLES_REGLEMENT.acomptePourcentageMin, '0')).reglement.acomptePourcentageMin, 0);
  assert.equal(versReglages(avec(CLES_REGLEMENT.acomptePourcentageMin, '100')).reglement.acomptePourcentageMin, 100);
  assert.deepEqual(
    versReglages(avec(CLES_REGLEMENT.joursWeekEndIso, '[]')).reglement.horairesRetraitPatisserie.joursWeekEndIso,
    [],
  );
});

test('lecture : une seule requête, clés du règlement uniquement', async () => {
  const appels: unknown[] = [];
  const r = await lireReglages({
    reglage: {
      async findMany(args) {
        appels.push(args);
        return LIGNES;
      },
    },
  });
  assert.equal(appels.length, 1);
  assert.deepEqual((appels[0] as { where: { cle: { in: string[] } } }).where.cle.in.sort(), Object.values(CLES_REGLEMENT).sort());
  assert.equal(r.reglement.acomptePourcentageMin, 30);
});
