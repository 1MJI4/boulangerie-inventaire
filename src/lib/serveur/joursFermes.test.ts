// node --test src/lib/serveur/joursFermes.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { lireJoursFermes, versDonneeJourFerme, type LigneJourFerme } from './joursFermes.ts';
import type { JourFerme } from '../../domaine/calendrier.ts';

// Les valeurs ci-dessous sont des données de test, pas la règle : la seule
// source du jour de fermeture est la table JourFerme.
const HEBDO: LigneJourFerme = { id: 1, nature: 'hebdomadaire', jourSemaineIso: 2, dateDebut: null, dateFin: null, libelle: 'jour test' };

test('hebdomadaire : jour ISO conservé, pas de dates', () => {
  // Typage : la sortie est directement consommable par le domaine.
  const pourLeDomaine: JourFerme = versDonneeJourFerme(HEBDO);
  assert.deepEqual(pourLeDomaine, {
    id: 1, nature: 'hebdomadaire', jourSemaineIso: 2, dateDebut: null, dateFin: null, libelle: 'jour test',
  });
});

test('période : colonne @db.Date (minuit UTC) → jour calendaire AAAA-MM-JJ', () => {
  const d = versDonneeJourFerme({
    id: 3, nature: 'conges', jourSemaineIso: null,
    dateDebut: new Date('2026-07-20T00:00:00.000Z'), dateFin: new Date('2026-08-10T00:00:00.000Z'),
    libelle: 'Congés annuels',
  });
  assert.equal(d.dateDebut, '2026-07-20');
  assert.equal(d.dateFin, '2026-08-10');
  assert.equal(d.jourSemaineIso, null);
});

test('libellé repris à la lettre', () => {
  assert.equal(versDonneeJourFerme({ ...HEBDO, libelle: '  Noël ' }).libelle, '  Noël ');
});

test('nature inconnue ou jour hors 1..7 : refus (jamais ouvert à tort)', () => {
  assert.throws(() => versDonneeJourFerme({ ...HEBDO, nature: 'vacances' }));
  assert.throws(() => versDonneeJourFerme({ ...HEBDO, jourSemaineIso: 0 }));
  assert.throws(() => versDonneeJourFerme({ ...HEBDO, jourSemaineIso: 8 }));
  assert.throws(() => versDonneeJourFerme({ ...HEBDO, jourSemaineIso: 2.5 }));
  assert.throws(() => versDonneeJourFerme({ ...HEBDO, nature: 'ferie', jourSemaineIso: null, dateDebut: new Date('x') }));
});

test('lecture : une seule requête, lignes actives seulement, ordre de création', async () => {
  const appels: unknown[] = [];
  const client = {
    jourFerme: {
      async findMany(args: unknown) {
        appels.push(args);
        return [HEBDO, { id: 2, nature: 'ferie', jourSemaineIso: null, dateDebut: new Date('2026-12-25T00:00:00Z'), dateFin: null, libelle: 'Noël' }];
      },
    },
  };
  const r = await lireJoursFermes(client);
  assert.equal(appels.length, 1);
  assert.deepEqual(appels[0], {
    where: { actif: true },
    select: { id: true, nature: true, jourSemaineIso: true, dateDebut: true, dateFin: true, libelle: true },
    orderBy: { id: 'asc' },
  });
  assert.equal(r.length, 2);
  assert.deepEqual(r[1], { id: 2, nature: 'ferie', jourSemaineIso: null, dateDebut: '2026-12-25', dateFin: null, libelle: 'Noël' });
});
