// node --test src/components/fiche/historiqueCommande.test.ts
//
// Historique d'une commande à l'écran (propriétaire, 11/11/2026). Les détails
// sont fabriqués par les VRAIES fonctions d'écriture (`changementsLisibles`,
// `detailModification`) : si leur format change, ces tests le disent.
// Montants : fixtures fictives.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { changementsLisibles, detailModification, MARQUEUR_REIMPRESSION, type Apres, type Existante, type LigneTexte } from '../commande/historique.ts';
import { dateHeureCourte } from '../../lib/ticketCanvas.ts';
import {
  auteurLisible,
  decouperChangements,
  libelleAction,
  ligneHistorique,
  lignesHistorique,
  lireMarqueur,
  MOTIFS_ANNULATION,
  resumeHistorique,
  texteAnnulation,
  texteModifications,
  titreDepli,
} from './historiqueCommande.ts';

const QUAND = '2026-11-10T13:32:00.000Z'; // 14h32 à Bruxelles

const LIGNE: LigneTexte = { libelle: 'Gâteau d’essai', quantite: 20, prixCentimes: 450, unite: 'piece', gouts: ['Vanille', 'Fraise'], decorations: ['Oreo', 'Kinder'], precision: 'sans noix, bien frais' };

const AVANT: Existante = {
  client: 'Dupont',
  telephone: '0470000000',
  retraitLe: new Date('2026-11-12T00:00:00Z'),
  retraitHeure: '10:00',
  texteGateau: null,
  zoneDessin: false,
  totalCentimes: 9000,
  acompteCentimes: 4500,
  remarques: null,
  photoImprimee: false,
  photoWhatsapp: false,
  demandeInhabituelle: false,
  modePaiement: 'especes',
  lignes: [LIGNE],
};

const APRES: Apres = {
  client: 'Dupont',
  telephone: '0470000000',
  dateRetrait: '2026-11-12',
  heureRetrait: '10:00',
  texteGateau: null,
  zoneDessin: false,
  totalCentimes: 9000,
  acompteCentimes: 4500,
  remarques: null,
  photoImprimee: false,
  photoWhatsapp: false,
  demandeInhabituelle: false,
  modePaiement: 'especes',
};

/** Détail tel que la route l'écrit. */
function detail(apres: Partial<Apres>, lignesApres: readonly LigneTexte[] = [LIGNE], aReimprimer = false): string {
  return detailModification(changementsLisibles(AVANT, { ...APRES, ...apres }, lignesApres), aReimprimer);
}

/* ---------------------------------------------------------------- Libellés */

test('libellé humain de chaque action', () => {
  assert.equal(libelleAction('creation'), 'Commande prise');
  assert.equal(libelleAction('modification', 'heure : 10h → 11h'), 'Modifiée');
  assert.equal(libelleAction('modification', 'aucun changement'), 'Enregistrée sans changement');
  assert.equal(libelleAction('impression'), 'Bon imprimé');
  assert.equal(libelleAction('remise'), 'Retirée par le client');
  assert.equal(libelleAction('acompte'), 'Virement reçu');
  assert.equal(libelleAction('annulation'), 'Annulée');
  assert.equal(libelleAction('autre-chose'), 'Mise à jour');
});

test('auteur : prénom, imprimante, inconnu, manager — jamais un mot technique', () => {
  assert.equal(auteurLisible('Sara'), 'par Sara');
  assert.equal(auteurLisible('imprimante'), 'par l’imprimante');
  assert.equal(auteurLisible('comptoir'), 'au comptoir');
  assert.equal(auteurLisible('inconnu'), null);
  assert.equal(auteurLisible(''), null);
  assert.equal(auteurLisible(undefined), null);
  assert.equal(auteurLisible('Gérant'), 'par le manager');
  assert.equal(auteurLisible('manager'), 'par le manager');
});

test('résumé d’une ligne : action, auteur, date et heure de Bruxelles', () => {
  const l = ligneHistorique({ quand: QUAND, action: 'modification', auteur: 'Sara', detail: detail({ heureRetrait: '11:30' }) });
  assert.equal(l.quand, dateHeureCourte(QUAND));
  assert.equal(l.resume, `Modifiée par Sara · ${dateHeureCourte(QUAND)}`);
  assert.match(l.resume, /10\/11 à 14h32/);
  const inconnu = ligneHistorique({ quand: QUAND, action: 'impression', auteur: 'inconnu', detail: 'Feuillets sortis' });
  assert.equal(inconnu.resume, `Bon imprimé · ${dateHeureCourte(QUAND)}`);
  assert.equal(inconnu.bloc, 'Feuillets sortis');
});

/* --------------------------------------------------------------- Découpage */

test('un changement par ligne, « avant → après »', () => {
  const l = ligneHistorique({ quand: QUAND, action: 'modification', auteur: 'Sara', detail: detail({ heureRetrait: '11:30', dateRetrait: '2026-11-14', totalCentimes: 12000, modePaiement: 'virement' }) });
  assert.equal(l.bloc, null);
  assert.deepEqual(l.changements, [
    { libelle: 'Jour de retrait', avant: '12/11/2026', apres: '14/11/2026' },
    { libelle: 'Heure de retrait', avant: '10h00', apres: '11h30' },
    { libelle: 'Paiement', avant: 'espèces', apres: 'virement' },
    { libelle: 'Total', avant: '90,00 €', apres: '120,00 €' },
  ]);
});

test('virgules DANS un changement (client, remarques, produits) : jamais coupé au mauvais endroit', () => {
  const l = ligneHistorique({
    quand: QUAND,
    action: 'modification',
    auteur: 'Sara',
    detail: detail(
      { client: 'Dupont, Marie', remarques: 'Allergie aux noix, aux œufs, livrer à 10h', acompteCentimes: 5000 },
      [{ ...LIGNE, quantite: 25 }],
    ),
  });
  assert.equal(l.bloc, null);
  assert.deepEqual(l.changements.map((c) => c.libelle), ['Client', 'Remarques', 'Produits avant la modification', 'Acompte']);
  assert.equal(l.changements[0].apres, 'Dupont, Marie');
  assert.equal(l.changements[1].apres, 'Allergie aux noix, aux œufs, livrer à 10h');
  // L'ancienne ligne entière, avec ses virgules (déco, précision).
  assert.equal(l.changements[2].textes?.length, 1);
  assert.match(l.changements[2].textes![0], /déco Oreo, Kinder/);
  assert.match(l.changements[2].textes![0], /sans noix, bien frais/);
});

test('plusieurs anciens produits : une ligne par produit', () => {
  const croissant: LigneTexte = { libelle: 'Produit d’essai', quantite: 12, prixCentimes: 130, unite: 'piece' };
  const d = detailModification(changementsLisibles({ ...AVANT, lignes: [LIGNE, croissant] }, APRES, [LIGNE]), false);
  const l = ligneHistorique({ quand: QUAND, action: 'modification', detail: d });
  assert.equal(l.changements.length, 1);
  assert.equal(l.changements[0].textes?.length, 2);
  assert.match(l.changements[0].textes![1], /^12 × Produit d’essai/);
});

test('texte saisi qui imite un libellé : détail en un bloc plutôt que coupé faux', () => {
  // La remarque contient « , total : » ET le total change vraiment : deux « total », pas sûr.
  const d = detail({ remarques: 'à voir, total : à revoir', totalCentimes: 12000 });
  assert.equal(decouperChangements(d), null);
  const l = ligneHistorique({ quand: QUAND, action: 'modification', detail: d });
  assert.deepEqual(l.changements, []);
  assert.equal(l.bloc, d);
  // Faux « total » sans la forme d'un montant : refusé aussi.
  assert.equal(decouperChangements(detail({ remarques: 'à voir, total : à revoir' })), null);
  // Libellé hors de l'ordre d'écriture (un « client : » après les remarques).
  assert.equal(decouperChangements(detail({ remarques: 'rappeler, client : pressé' })), null);
  // Détail d'un autre format (ancien, tronqué au milieu d'un montant…).
  assert.equal(decouperChangements('quelque chose a changé'), null);
  assert.equal(decouperChangements('total : 90,00 € → 12'), null);
});

test('flèche dans un texte saisi : le texte entier, sans faux « avant → après »', () => {
  const l = ligneHistorique({ quand: QUAND, action: 'modification', detail: detail({ remarques: 'entrée → dessert' }) });
  assert.deepEqual(l.changements, [{ libelle: 'Remarques', textes: ['aucune → entrée → dessert'] }]);
});

test('téléphone : le changement est dit, jamais le numéro', () => {
  const l = ligneHistorique({ quand: QUAND, action: 'modification', detail: detail({ telephone: '0471111111' }) });
  assert.deepEqual(l.changements, [{ libelle: 'Téléphone', textes: ['Numéro changé'] }]);
});

/* ---------------------------------------------------------------- Marqueur */

test('« à réimprimer » : une étiquette, pas du texte dans le détail', () => {
  const d = detail({ heureRetrait: '11:30' }, [LIGNE], true);
  assert.ok(d.startsWith(`${MARQUEUR_REIMPRESSION} — `), 'format écrit inchangé');
  const l = ligneHistorique({ quand: QUAND, action: 'modification', detail: d });
  assert.equal(l.aReimprimer, true);
  assert.deepEqual(l.changements, [{ libelle: 'Heure de retrait', avant: '10h00', apres: '11h30' }]);
  assert.doesNotMatch(JSON.stringify(l.changements), /réimprimer/);
  // Ancien format : marqueur en fin de texte.
  assert.deepEqual(lireMarqueur('heure : 10h → 11h30, à réimprimer'), { aReimprimer: true, corps: 'heure : 10h → 11h30' });
  assert.deepEqual(lireMarqueur('heure : 10h → 11h30'), { aReimprimer: false, corps: 'heure : 10h → 11h30' });
});

test('modification sans changement : dite telle quelle, sans détail', () => {
  const l = ligneHistorique({ quand: QUAND, action: 'modification', auteur: 'Sara', detail: detailModification([], false) });
  assert.equal(l.libelle, 'Enregistrée sans changement');
  assert.deepEqual(l.changements, []);
  assert.equal(l.bloc, null);
});

/* ------------------------------------------------------- Données personnelles */

test('commande anonymisée : action et date seulement — ni auteur, ni détail', () => {
  const evenements = [
    { quand: QUAND, action: 'modification', auteur: 'Sara', detail: detail({ client: 'Dupont, Marie' }, [LIGNE], true) },
    { quand: '2026-11-09T08:00:00.000Z', action: 'annulation', auteur: 'Karim', detail: 'Le client Dupont a annulé' },
  ];
  const lignes = lignesHistorique(evenements, { anonymisee: true });
  for (const l of lignes) {
    assert.equal(l.auteur, null);
    assert.equal(l.bloc, null);
    assert.deepEqual(l.changements, []);
    assert.doesNotMatch(JSON.stringify(l), /Dupont|Sara|Karim/);
  }
  assert.equal(lignes[0].resume, `Modifiée · ${dateHeureCourte(QUAND)}`);
  assert.equal(texteAnnulation({ annuleeLe: QUAND, motif: 'Le client Dupont a annulé', anonymiseeLe: QUAND }), `Annulée le ${dateHeureCourte(QUAND)}`);
});

/* ------------------------------------------------------------------ Résumé */

test('du plus récent au plus ancien ; la dernière action en clair', () => {
  const r = resumeHistorique([
    { quand: '2026-11-08T09:00:00.000Z', action: 'creation', auteur: 'Lina', detail: null },
    { quand: QUAND, action: 'modification', auteur: 'Sara', detail: detail({ heureRetrait: '11:30' }) },
  ]);
  assert.deepEqual(r.lignes.map((l) => l.action), ['modification', 'creation']);
  assert.equal(r.derniere?.resume, `Modifiée par Sara · ${dateHeureCourte(QUAND)}`);
  assert.equal(r.derniereModification, null, 'déjà la dernière action : pas dite deux fois');
  assert.equal(r.nbModifications, 1);
});

test('modifiée puis réimprimée : la modification reste visible sans rien déplier', () => {
  const r = resumeHistorique([
    { quand: '2026-11-08T09:00:00.000Z', action: 'creation', auteur: 'Lina', detail: null },
    { quand: '2026-11-09T09:00:00.000Z', action: 'modification', auteur: 'Lina', detail: detailModification([], false) },
    { quand: QUAND, action: 'modification', auteur: 'Sara', detail: detail({ heureRetrait: '11:30' }, [LIGNE], true) },
    { quand: '2026-11-10T14:00:00.000Z', action: 'impression', auteur: 'imprimante', detail: 'Feuillets sortis' },
  ]);
  assert.equal(r.derniere?.libelle, 'Bon imprimé');
  assert.equal(r.derniereModification?.resume, `Modifiée par Sara · ${dateHeureCourte(QUAND)}`);
  assert.equal(r.nbModifications, 1, '« sans changement » ne compte pas');
  assert.equal(texteModifications(r.nbModifications), 'Modifiée 1 fois');
  assert.equal(titreDepli(r.lignes.length), 'Tout l’historique (4)');
});

test('aucun événement : rien à montrer, sans erreur', () => {
  const r = resumeHistorique(undefined);
  assert.deepEqual(r, { lignes: [], derniere: null, derniereModification: null, nbModifications: 0 });
});

/* -------------------------------------------------------------- Annulation */

test('fiche annulée : « Annulée le … — motif : … »', () => {
  assert.equal(texteAnnulation({ annuleeLe: QUAND, motif: ' Le client a annulé ' }), `Annulée le ${dateHeureCourte(QUAND)} — motif : Le client a annulé`);
  assert.equal(texteAnnulation({ annuleeLe: null, motif: null }), 'Annulée');
  assert.ok(MOTIFS_ANNULATION.length >= 3);
  for (const m of MOTIFS_ANNULATION) assert.doesNotMatch(m, /gérant|responsable/i);
});
