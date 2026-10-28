// node --test src/lib/ticketCanvas.test.ts
// Formatage pur des tickets (sans canvas). Prix FICTIFS, propres aux tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Commande, LigneCommande } from './commandes.ts';
import {
  dateHeureCourte,
  formeAImprimer,
  photoModeleAImprimer,
  formesAImprimer,
  modifieeApresImpression,
  goutsAImprimer,
  TAILLE_PRODUIT,
  couperTexte,
  dateRetraitTicket,
  demandeAConfirmer,
  dessinerSurContexte,
  DESTINATIONS,
  LARGEUR,
  formaterLigneTicket,
  mentionHeureRetrait,
  MENTION_LIGNE_LIBRE,
  zoneDessinImprimee,
  bandeauModification,
  basePrixDeLigne,
  chiffresOuLettresAImprimer,
  consignesDeLigne,
  goutsLignesAImprimer,
  INSECABLE,
  lectureQuantite,
} from './ticketCanvas.ts';
import { nomJour } from '../domaine/reglement.ts';
import { LIBELLES_FORME } from '../domaine/messages.ts';

/** Les étiquettes sont collées par des insécables : on compare le texte lu. */
const lu = (s: string | null | undefined) => (s ?? '').replaceAll(INSECABLE, ' ');

/**
 * Rayon de l'affiche « gâteaux simples » tel qu'il est stocké sur le produit
 * (`ProduitCatalogue.categorie`) : c'est lui, avec le nom, qui désigne la Pâte
 * à sucre comme supplément dans la table explicite de familles.ts.
 */
const RAYON_GATEAUX = 'Tarifs (minimum) pour les Gâteaux SIMPLES sur commande';

function ligne(partiel: Partial<LigneCommande>): LigneCommande {
  return { libelle: 'Produit test', quantite: 1, prixCentimes: 1000, poste: null, precision: null, ...partiel };
}

test('kg : 750 g à 1000 c/kg → « 0,750 kg » et 7,50 € (jamais 7500)', () => {
  const l = formaterLigneTicket(ligne({ unite: 'kg', quantite: 750, prixCentimes: 1000 }), 'ATELIER');
  assert.equal(l.quantite, '0,750 kg');
  assert.equal(l.prix, '7,50 €');
});

test('kg : 750 g à 1234 c/kg (fictif) → 9,26 € half-up, pas 9255,00 (cas du KO-A)', () => {
  assert.equal(formaterLigneTicket(ligne({ unite: 'kg', quantite: 750, prixCentimes: 1234 }), 'ATELIER').prix, '9,26 €');
});

test('kg : arrondi half-up au centime (333 g à 1000 c/kg → 3,33 €, 335 g à 1001 c/kg → 3,35 €)', () => {
  assert.equal(formaterLigneTicket(ligne({ unite: 'kg', quantite: 333, prixCentimes: 1000 }), 'ATELIER').prix, '3,33 €');
  assert.equal(formaterLigneTicket(ligne({ unite: 'kg', quantite: 335, prixCentimes: 1001 }), 'ATELIER').prix, '3,35 €');
});

test('pièce : « 3 × » et 3 × 1000 c = 30,00 €', () => {
  const l = formaterLigneTicket(ligne({ unite: 'piece', quantite: 3, prixCentimes: 1000 }), 'ATELIER');
  assert.equal(l.quantite, '3 ×');
  assert.equal(l.prix, '30,00 €');
  assert.equal(l.aConfirmer, false);
});

test('ligne sans unité (antérieure au lot 2) : traitée à la pièce', () => {
  assert.equal(formaterLigneTicket(ligne({ quantite: 2, prixCentimes: 1000 }), 'ATELIER').quantite, '2 ×');
});

test('total incalculable : jamais un montant faux, « à confirmer »', () => {
  assert.equal(formaterLigneTicket(ligne({ quantite: 2, prixCentimes: 0 }), 'ATELIER').prix, 'à confirmer');
});

test('ligne libre : « à confirmer par le pâtissier » sur les exemplaires internes, jamais sur le CLIENT', () => {
  const libre = ligne({ ligneLibreAutoriseePar: 'Gérant' });
  for (const d of ['BUREAU', 'MAGASIN', 'ATELIER'] as const) {
    assert.equal(formaterLigneTicket(libre, d).aConfirmer, true, d);
  }
  assert.equal(formaterLigneTicket(libre, 'CLIENT').aConfirmer, false);
  assert.equal(MENTION_LIGNE_LIBRE, 'à confirmer par le pâtissier');
});

test('heure de retrait null ou vide : aucune mention (ni « à null » ni « à  »)', () => {
  assert.equal(mentionHeureRetrait(null), null);
  assert.equal(mentionHeureRetrait(undefined), null);
  assert.equal(mentionHeureRetrait('  '), null);
  assert.equal(mentionHeureRetrait('14h30'), 'à 14h30');
});

test('demande à confirmer : nouveau champ, ou ancien drapeau en repli', () => {
  assert.equal(demandeAConfirmer({ demandeInhabituelle: true }, 'ATELIER'), true);
  assert.equal(demandeAConfirmer({ gateauComplexe: true }, 'BUREAU'), true);
  assert.equal(demandeAConfirmer({ demandeInhabituelle: false, gateauComplexe: false }, 'ATELIER'), false);
  assert.equal(demandeAConfirmer({}, 'MAGASIN'), false);
});

test('demande à confirmer : jamais sur l’exemplaire CLIENT', () => {
  assert.equal(demandeAConfirmer({ demandeInhabituelle: true }, 'CLIENT'), false);
  assert.equal(demandeAConfirmer({ gateauComplexe: true }, 'CLIENT'), false);
});

/* ------------------------------------------------ Demande du 19/10/2026 */

test('date de retrait : jour en toutes lettres et en capitales, tiré du domaine (nomJour)', () => {
  const d = dateRetraitTicket('2026-10-24');
  assert.equal(d.longue, `${nomJour('2026-10-24').toUpperCase()} 24 OCTOBRE 2026`);
  assert.equal(d.courte, `${nomJour('2026-10-24').toUpperCase()} 24/10`);
  assert.equal(d.longue, d.longue.toUpperCase());
});

test('date de retrait : chaque jour de la semaine suit le domaine, « 1ER » le premier du mois', () => {
  for (let i = 0; i < 7; i += 1) {
    const iso = `2026-10-${String(19 + i).padStart(2, '0')}`;
    assert.ok(dateRetraitTicket(iso).longue.startsWith(`${nomJour(iso).toUpperCase()} `), iso);
  }
  assert.equal(dateRetraitTicket('2026-11-01').longue, `${nomJour('2026-11-01').toUpperCase()} 1ER NOVEMBRE 2026`);
  // Une date venue de l'API avec l'heure (ISO complet) donne le même résultat.
  assert.equal(dateRetraitTicket('2026-10-24T00:00:00.000Z').longue, d24());
});

test('heure de retrait : « 14:30 » stockée s’imprime « à 14h30 »', () => {
  assert.equal(mentionHeureRetrait('14:30'), 'à 14h30');
  assert.equal(mentionHeureRetrait('09:00'), 'à 9h00');
  // Illisible : imprimée telle quelle plutôt que perdue.
  assert.equal(mentionHeureRetrait('midi'), 'à midi');
});

test('découpe des libellés : toujours entre deux mots, jamais plus large que la colonne', () => {
  const mesurer = (s: string) => s.length * 10;
  const lignes = couperTexte('Bavarois fraise framboise 24 parts', 120, mesurer);
  assert.deepEqual(lignes, ['Bavarois', 'fraise', 'framboise 24', 'parts']);
  for (const l of lignes) assert.ok(mesurer(l) <= 120, l);
  assert.equal(lignes.join(' '), 'Bavarois fraise framboise 24 parts');
});

test('découpe : un mot trop long pour la colonne se coupe après son trait d’union, sans déborder', () => {
  const mesurer = (s: string) => s.length * 10;
  const lignes = couperTexte('Mini-sandwichs-garnis', 100, mesurer);
  assert.deepEqual(lignes, ['Mini-', 'sandwichs-', 'garnis']);
  for (const l of couperTexte('Abcdefghijklmnop', 50, mesurer)) assert.ok(mesurer(l) <= 50, l);
  assert.deepEqual(couperTexte('', 100, mesurer), ['']);
});

test('corps des produits agrandi d’au moins 20 % (ancien : 22 points)', () => {
  assert.ok(TAILLE_PRODUIT >= 22 * 1.2 && TAILLE_PRODUIT <= 22 * 1.3, String(TAILLE_PRODUIT));
});

/* --------------------------- Le ticket réellement dessiné (contexte factice) */

const d24 = () => `${nomJour('2026-10-24').toUpperCase()} 24 OCTOBRE 2026`;

type Trace = { texte: string; x: number; largeur: number; taille: number };

/** Contexte 2D minimal : enregistre chaque texte tracé, mesure ≈ 0,6 × corps par caractère. */
function contexteFactice() {
  const traces: Trace[] = [];
  const taille = (font: string) => Number(/(\d+)px/.exec(font)?.[1] ?? 10);
  const ctx = {
    font: '10px sans-serif',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    textBaseline: 'top',
    save() {},
    restore() {},
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    setLineDash() {},
    measureText(t: string) {
      return { width: t.length * taille(ctx.font) * 0.6 };
    },
    fillText(t: string, x: number) {
      traces.push({ texte: t, x, largeur: t.length * taille(ctx.font) * 0.6, taille: taille(ctx.font) });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, traces };
}

function commande(partiel: Partial<Commande> = {}): Commande {
  return {
    id: 1,
    numero: 'C-2026-0042',
    client: 'Client test',
    telephone: '0470 00 00 00',
    vendeur: 'Vendeur test',
    priseLe: '2026-10-19T10:00:00.000Z',
    origine: 'comptoir',
    retraitLe: '2026-10-24',
    retraitHeure: '14:30',
    modePaiement: 'virement',
    acompteCentimes: 500,
    acompteRecuLe: null,
    totalCentimes: 1000,
    texteGateau: null,
    sansEcriture: false,
    photoWhatsapp: true,
    photoImprimee: false,
    demandeInhabituelle: true,
    remarques: 'Remarque interne',
    statut: 'enregistree',
    imprimeeLe: null,
    remiseLe: null,
    avertissements: [],
    anonymiseeLe: null,
    lignes: [
      ligne({ libelle: 'Produit test au libellé très long qui doit passer à la ligne proprement', quantite: 12 }),
      ligne({ libelle: 'Produit libre', ligneLibreAutoriseePar: 'Gérant' }),
    ],
    ...partiel,
  } as Commande;
}

function textes(destination: (typeof DESTINATIONS)[number], c: Commande) {
  const { ctx, traces } = contexteFactice();
  dessinerSurContexte(ctx, destination, c);
  return traces;
}

test('ticket : date de retrait en capitales avec le jour du domaine, et l’heure « à 14h30 »', () => {
  for (const d of DESTINATIONS) {
    const t = textes(d, commande()).map((x) => x.texte);
    assert.ok(t.includes(d24()), d);
    assert.ok(t.includes('à 14h30'), d);
  }
});

test('ticket : sans heure de retrait, aucune mention d’heure (ni « à null »)', () => {
  for (const heure of [null, '']) {
    const t = textes('CLIENT', commande({ retraitHeure: heure })).map((x) => x.texte);
    assert.ok(!t.some((x) => /^à /.test(x) || x.includes('null')), JSON.stringify(t));
  }
});

test('ticket : numéro de commande présent sur les 4 exemplaires, en petit', () => {
  for (const d of DESTINATIONS) {
    const n = textes(d, commande()).find((x) => x.texte.includes('C-2026-0042') && x.texte.startsWith('Commande'));
    assert.ok(n, d);
    assert.ok(n.taille <= 20, `${d} : ${n.taille}`);
  }
});

test('ticket : aucun texte ne sort des 576 points, libellés coupés entre deux mots', () => {
  const c = commande();
  for (const d of DESTINATIONS) {
    for (const x of textes(d, c)) assert.ok(x.x >= 0 && x.x + x.largeur <= LARGEUR, `${d} : « ${x.texte} »`);
  }
  // Les morceaux du libellé long, remis bout à bout, redonnent le libellé à la lettre (LOI 5).
  const libelle = c.lignes[0].libelle;
  const mots = new Set(libelle.split(' '));
  const morceaux = textes('ATELIER', c).filter((x) => x.texte.split(' ').every((m) => mots.has(m)) && x.taille >= 22);
  assert.ok(morceaux.length >= 2);
  assert.equal(morceaux.map((x) => x.texte).join(' '), libelle);
});

test('ticket : mentions internes jamais sur l’exemplaire CLIENT, présentes sur les autres', () => {
  const internes = ['À CONFIRMER — PRIX ET FAISABILITÉ', MENTION_LIGNE_LIBRE.toUpperCase(), 'Remarque interne'];
  const client = textes('CLIENT', commande()).map((x) => x.texte).join(' | ');
  for (const m of internes) assert.ok(!client.includes(m), m);
  for (const d of ['BUREAU', 'MAGASIN', 'ATELIER'] as const) {
    const t = textes(d, commande()).map((x) => x.texte).join(' | ');
    for (const m of internes) assert.ok(t.includes(m), `${d} : ${m}`);
  }
});

/* ------------------------- Zone de dessin optionnelle (21/10/2026) */

const ZONE = 'ZONE LIBRE — DESSIN, PRÉCISIONS';

function hauteur(destination: (typeof DESTINATIONS)[number], c: Commande): number {
  return dessinerSurContexte(contexteFactice().ctx, destination, c);
}

test('zone de dessin : seulement si demandée, sur les exemplaires internes, jamais sur CLIENT', () => {
  for (const d of ['BUREAU', 'MAGASIN', 'ATELIER'] as const) {
    assert.equal(zoneDessinImprimee({ zoneDessin: true }, d), true, d);
    assert.equal(zoneDessinImprimee({ zoneDessin: false }, d), false, d);
    // Ancienne commande, sans le champ : pas de zone.
    assert.equal(zoneDessinImprimee({}, d), false, d);
  }
  assert.equal(zoneDessinImprimee({ zoneDessin: true }, 'CLIENT'), false);
});

test('ticket : zone de dessin imprimée sur BUREAU / MAGASIN / ATELIER seulement si demandée', () => {
  for (const d of ['BUREAU', 'MAGASIN', 'ATELIER'] as const) {
    assert.ok(textes(d, commande({ zoneDessin: true })).some((x) => x.texte === ZONE), d);
    assert.ok(!textes(d, commande({ zoneDessin: false })).some((x) => x.texte === ZONE), d);
    assert.ok(!textes(d, commande()).some((x) => x.texte === ZONE), `${d} (champ absent)`);
  }
});

test('ticket : jamais de zone de dessin sur l’exemplaire CLIENT, même demandée', () => {
  assert.ok(!textes('CLIENT', commande({ zoneDessin: true })).some((x) => x.texte === ZONE));
  assert.equal(hauteur('CLIENT', commande({ zoneDessin: true })), hauteur('CLIENT', commande({ zoneDessin: false })));
});

test('ticket : sans zone demandée, le ticket interne est plus court (pas d’espace vide)', () => {
  for (const d of ['BUREAU', 'MAGASIN', 'ATELIER'] as const) {
    const avec = hauteur(d, commande({ zoneDessin: true }));
    const sans = hauteur(d, commande({ zoneDessin: false }));
    // ≈ 60 mm de cadre (480 points) en moins.
    assert.ok(avec - sans >= 480, `${d} : ${avec} / ${sans}`);
  }
});

test('Number Cake : formes en capitales espacées (« 25 » → « 2  5 »), autre forme telle quelle', () => {
  assert.equal(formesAImprimer('25'), '2  5');
  assert.equal(formesAImprimer(' am '), 'A  M');
  assert.equal(formesAImprimer('cœur + 1'), 'cœur + 1');
  assert.equal(formesAImprimer(''), null);
  assert.equal(formesAImprimer(null), null);
});

test('R62 : goût en capitales ; pièce montée, un goût par étage', () => {
  assert.equal(goutsAImprimer(['Framboise']), 'GOÛT : FRAMBOISE');
  assert.equal(goutsAImprimer(['Chocolat', 'Vanille']), 'ÉTAGE 1 : CHOCOLAT · ÉTAGE 2 : VANILLE');
  assert.equal(goutsAImprimer([]), null);
});

test('commande modifiée après impression : la dernière modification « à réimprimer » est retenue', () => {
  assert.equal(modifieeApresImpression({ evenements: [] }), null);
  assert.equal(
    modifieeApresImpression({ evenements: [{ quand: '2026-10-22T16:49:36Z', action: 'modification', detail: 'aucun changement' }] }),
    null,
  );
  const quand = modifieeApresImpression({
    evenements: [
      { quand: '2026-10-22T15:00:00Z', action: 'modification', detail: 'produits…, à réimprimer' },
      { quand: '2026-10-22T16:40:00Z', action: 'modification', detail: 'date de retrait…, à réimprimer' },
      { quand: '2026-10-22T14:00:00Z', action: 'creation', detail: null },
    ],
  });
  assert.equal(quand, '2026-10-22T16:40:00Z');
  assert.equal(dateHeureCourte(quand!), '22/10 à 18h40');
});

/* ------------------------- R63 : forme du gâteau (propriétaire, 26/10/2026) */

/** Ligne telle que renvoyée par l'API : `forme` vient de la ligne Prisma. */
function ligneAvecForme(forme: string | null, partiel: Partial<LigneCommande> = {}): LigneCommande {
  return { ...ligne({ libelle: 'Gâteau test', quantite: 6, ...partiel }), forme } as LigneCommande;
}

test('R63 : « FORME : CARRÉ » / « FORME : ROND », libellés du domaine en capitales', () => {
  assert.equal(formeAImprimer('carre'), `FORME : ${LIBELLES_FORME.carre.toUpperCase()}`);
  assert.equal(formeAImprimer('carre'), 'FORME : CARRÉ');
  assert.equal(formeAImprimer('rond'), 'FORME : ROND');
  assert.equal(formeAImprimer(null), null);
  assert.equal(formeAImprimer(undefined), null);
  assert.equal(formeAImprimer(''), null);
  // Valeur anormale (la base la refuse) : visible, jamais perdue.
  assert.equal(formeAImprimer('ovale'), 'FORME : OVALE');
});

test('R63 : la forme passe par la ligne du ticket ; rien sans forme ; distincte des formes du Number Cake', () => {
  assert.equal(lu(formaterLigneTicket(ligneAvecForme('rond'), 'ATELIER').forme), 'FORME : ROND');
  assert.equal(formaterLigneTicket(ligneAvecForme(null), 'ATELIER').forme, null);
  assert.equal(formaterLigneTicket(ligne({}), 'ATELIER').forme, null, 'ligne antérieure, sans le champ');
  const nc = formaterLigneTicket(ligne({ formes: '25' }), 'ATELIER');
  assert.equal(nc.forme, null);
  assert.equal(lu(nc.formes), 'CHIFFRES OU LETTRES : 2  5');
});

test('ticket : « FORME : CARRÉ » en gras sur les 4 exemplaires, dans la colonne ; rien si forme null', () => {
  const avec = commande({ lignes: [ligneAvecForme('carre')] });
  for (const d of DESTINATIONS) {
    const { ctx, traces } = contexteFactice();
    const polices: string[] = [];
    const tracer = ctx.fillText.bind(ctx);
    ctx.fillText = (texte: string, x: number, y: number) => {
      if (lu(texte) === 'FORME : CARRÉ') polices.push(ctx.font);
      tracer(texte, x, y);
    };
    dessinerSurContexte(ctx, d, avec);
    const t = traces.find((x) => lu(x.texte) === 'FORME : CARRÉ');
    assert.ok(t, d);
    assert.ok(polices.length > 0 && polices.every((f) => f.startsWith('700 ')), `${d} : gras (${polices.join()})`);
    assert.ok(t.x + t.largeur <= LARGEUR, d);
  }
  const sans = commande({ lignes: [ligneAvecForme(null)] });
  for (const d of DESTINATIONS) assert.ok(!textes(d, sans).some((x) => lu(x.texte).startsWith('FORME ')), d);
});

test('Pâte à sucre : supplément par personne — « Pâte à sucre — 24 parts », sans « × », ni forme ni goût', () => {
  // Prix FICTIF (LOI 1) : seul compte le calcul parts × prix par personne, par le domaine.
  const pate = ligne({
    libelle: 'Pâte à sucre',
    quantite: 24,
    prixCentimes: 1000,
    produitCatalogue: { cleCatalogue: 'gateaux-sur-commande/supplement-pate-a-sucre', categorie: RAYON_GATEAUX, nom: 'Pâte à sucre', regimePrix: 'C' },
  });
  const l = formaterLigneTicket(pate, 'CLIENT');
  assert.equal(l.libelle, 'Pâte à sucre');
  assert.equal(l.quantite, '');
  assert.equal(lu(l.complementLibelle), '— 24 parts');
  assert.equal(l.parts, null, 'un supplément n’est pas « 1 gâteau »');
  assert.equal(l.prix, '240,00 €');
  assert.equal(l.forme, null);
  assert.equal(l.formes, null);
  assert.equal(l.gouts, null);
  const t = textes('ATELIER', commande({ lignes: [ligneAvecForme('carre', { libelle: 'Bavarois' }), pate] })).map((x) => lu(x.texte));
  assert.ok(t.includes('Pâte à sucre — 24 parts'), t.join(' | '));
  assert.ok(!t.includes('24 ×'));
  assert.ok(t.includes('240,00 €'));
  assert.equal(t.filter((x) => x.startsWith('FORME ')).length, 1, 'la forme reste sur le gâteau, pas sur le supplément');
});

/* --------------- Photo modèle de la galerie (propriétaire, 26/10/2026) */

/** Ligne telle que renvoyée par l'API : `photoModele` vient de la ligne Prisma. */
function ligneAvecPhoto(photoModele: string | null, partiel: Partial<LigneCommande> = {}): LigneCommande {
  return { ...ligne({ libelle: 'Gâteau test', quantite: 6, ...partiel }), photoModele } as LigneCommande;
}

test('photo modèle : « Photo sélectionnée : G043 », rien si null / vide / absent', () => {
  assert.equal(photoModeleAImprimer('G043'), 'Photo sélectionnée : G043');
  assert.equal(photoModeleAImprimer('  G043 '), 'Photo sélectionnée : G043');
  assert.equal(photoModeleAImprimer(null), null);
  assert.equal(photoModeleAImprimer(undefined), null);
  assert.equal(photoModeleAImprimer('  '), null);
  assert.equal(lu(formaterLigneTicket(ligneAvecPhoto('G043'), 'CLIENT').photoModele), 'Photo sélectionnée : G043');
  assert.equal(formaterLigneTicket(ligneAvecPhoto(null), 'CLIENT').photoModele, null);
  assert.equal(formaterLigneTicket(ligne({}), 'ATELIER').photoModele, null, 'ligne antérieure, sans le champ');
});

test('ticket : « Photo sélectionnée : G043 » en gras sur les 4 exemplaires (CLIENT compris), après la forme, dans 576 points', () => {
  const attendu = 'Photo sélectionnée : G043';
  const avec = commande({ lignes: [{ ...ligneAvecForme('carre'), photoModele: 'G043' } as LigneCommande] });
  for (const d of DESTINATIONS) {
    const { ctx, traces } = contexteFactice();
    const polices: string[] = [];
    const tracer = ctx.fillText.bind(ctx);
    ctx.fillText = (texte: string, x: number, y: number) => {
      polices.push(ctx.font);
      tracer(texte, x, y);
    };
    dessinerSurContexte(ctx, d, avec);
    // Colonne étroite : le texte peut passer à la ligne, entre les mots
    // seulement — le code « G043 » n'est jamais coupé.
    const i = traces.findIndex((x) => x.texte.startsWith('Photo'));
    assert.ok(i >= 0, d);
    // Sur toute la largeur et étiquette collée : une seule ligne, jamais « Photo / sélectionnée : / G043 ».
    const j = i;
    assert.equal(lu(traces[i].texte), attendu, d);
    for (let k = i; k <= j; k += 1) {
      assert.ok(polices[k].startsWith('700 '), `${d} : gras (${polices[k]})`);
      assert.ok(traces[k].x >= 0 && traces[k].x + traces[k].largeur <= LARGEUR, `${d} : tient dans ${LARGEUR} points`);
    }
    const iForme = traces.findIndex((x) => lu(x.texte) === 'FORME : CARRÉ');
    assert.ok(iForme >= 0 && iForme < i, `${d} : juste après la forme`);
  }
  const sans = commande({ lignes: [ligneAvecPhoto(null)] });
  for (const d of DESTINATIONS) assert.ok(!textes(d, sans).some((x) => x.texte.startsWith('Photo sélectionnée')), d);
});

/* ------------------- Champs vides : rien d'imprimé (propriétaire, 26/10/2026) */

test('ticket : champ vide jamais imprimé — ni « NOM » / « TÉLÉPHONE » seuls, ni tiret « — »', () => {
  for (const d of DESTINATIONS) {
    const plein = textes(d, commande()).map((x) => x.texte);
    assert.ok(plein.includes('NOM') && plein.includes('TÉLÉPHONE'), d);
    const vide = textes(d, commande({ client: '', telephone: '  ' })).map((x) => x.texte);
    assert.ok(!vide.includes('NOM') && !vide.includes('TÉLÉPHONE') && !vide.includes('—'), `${d} : ${vide.join(' | ')}`);
  }
});

test('ticket : sans photo, sans modèle WhatsApp, sans remarque, sans demande inhabituelle → aucune de ces lignes', () => {
  const nue = commande({ photoImprimee: false, photoWhatsapp: false, remarques: null, demandeInhabituelle: false, texteGateau: null, sansEcriture: false });
  for (const d of DESTINATIONS) {
    const t = textes(d, nue).map((x) => x.texte.toUpperCase()).join(' | ');
    for (const m of ['PHOTO', 'MODÈLE', 'REMARQUES', 'DEMANDE INHABITUELLE', 'ÉCRITURE', 'SUR LE GÂTEAU']) assert.ok(!t.includes(m), `${d} : ${m}`);
  }
});

test('ticket : « sans écriture » jamais imprimé, sur aucun exemplaire (propriétaire, 26/10/2026)', () => {
  const c = commande({ texteGateau: null, sansEcriture: true });
  for (const d of DESTINATIONS) {
    const t = textes(d, c).map((x) => x.texte.toUpperCase()).join(' | ');
    assert.ok(!t.includes('ÉCRITURE') && !t.includes('DEMANDÉ AU CLIENT'), d);
  }
});

/* ------------- Le bon lu par le pâtissier (propriétaire, 28/10/2026) */

/** Gâteau vendu par personne : la base vient de la version de tarif appliquée (API), jamais du nom. */
function gateauParPersonne(partiel: Partial<LigneCommande> = {}, base: string | null = 'personne'): LigneCommande {
  return {
    ...ligne({
      libelle: 'Layer Cake',
      quantite: 20,
      prixCentimes: 1000, // FICTIF (LOI 1)
      produitCatalogue: { cleCatalogue: 'gateaux-sur-commande/test', categorie: 'Gâteaux test', nom: 'Layer Cake', regimePrix: 'C' },
      ...partiel,
    }),
    ...(base ? { prixProduit: { basePrix: base } } : {}),
  } as LigneCommande;
}

/** Contexte factice qui note aussi la police de chaque texte tracé. */
function tracesAvecPolices(destination: (typeof DESTINATIONS)[number], c: Commande) {
  const { ctx, traces } = contexteFactice();
  const polices: string[] = [];
  const tracer = ctx.fillText.bind(ctx);
  ctx.fillText = (texte: string, x: number, y: number) => {
    polices.push(ctx.font);
    tracer(texte, x, y);
  };
  dessinerSurContexte(ctx, destination, c);
  return traces.map((t, i) => ({ ...t, texte: lu(t.texte), gras: polices[i].startsWith('700 ') }));
}

test('gâteau par personne : « 1 gâteau — 20 PARTS » en gras, plus jamais « 20 × Layer Cake »', () => {
  const l = formaterLigneTicket(gateauParPersonne(), 'ATELIER');
  assert.equal(lectureQuantite(gateauParPersonne()), 'gateau-par-personne');
  assert.equal(l.quantite, '');
  assert.equal(lu(l.parts), '1 gâteau — 20 PARTS');
  // Le calcul reste lisible, sans « × » : total par le domaine, prix par personne de la ligne.
  assert.equal(l.prix, '200,00 €');
  assert.equal(l.prixUnitaire, '10,00 € par personne');
  for (const d of DESTINATIONS) {
    const t = tracesAvecPolices(d, commande({ lignes: [gateauParPersonne()] }));
    const parts = t.find((x) => x.texte === '1 gâteau — 20 PARTS');
    assert.ok(parts, d);
    assert.ok(parts.gras && parts.taille >= TAILLE_PRODUIT, `${d} : gras, gros`);
    assert.ok(!t.some((x) => x.texte.includes('20 ×')), `${d} : aucun « 20 × »`);
    assert.ok(t.some((x) => x.texte === 'Layer Cake'), d);
    assert.ok(t.some((x) => x.texte === '200,00 €'), `${d} : prix gardé (ATELIER compris)`);
  }
});

test('à la pièce : « 10 × » conservé (base pièce transmise, ou ligne sans base)', () => {
  const mini = ligne({ libelle: 'Mini burger', quantite: 10, prixCentimes: 1000 });
  assert.equal(formaterLigneTicket({ ...mini, prixProduit: { basePrix: 'piece' } } as LigneCommande, 'ATELIER').quantite, '10 ×');
  assert.equal(formaterLigneTicket(mini, 'ATELIER').quantite, '10 ×');
  const t = textes('ATELIER', commande({ lignes: [mini] })).map((x) => x.texte);
  assert.ok(t.includes('10 ×'));
  assert.ok(!t.some((x) => /PARTS|gâteau/.test(lu(x))));
});

test('LOI 6 : la base ne se déduit jamais du nom — régime C sans base transmise reste « N × »', () => {
  const sansBase = gateauParPersonne({}, null);
  assert.equal(basePrixDeLigne(sansBase), null);
  assert.equal(formaterLigneTicket(sansBase, 'ATELIER').quantite, '20 ×');
  assert.equal(formaterLigneTicket(sansBase, 'ATELIER').parts, null);
  // Même nom, base « personne » transmise : seule la donnée change l'impression.
  assert.equal(basePrixDeLigne(gateauParPersonne()), 'personne');
  // Base aberrante : ignorée, jamais devinée.
  assert.equal(basePrixDeLigne(gateauParPersonne({}, 'parts')), null);
});

test('au kilo : « 0,750 kg » sans « × » orphelin, ni parts', () => {
  const l = formaterLigneTicket(ligne({ unite: 'kg', quantite: 750, prixCentimes: 1000 }), 'ATELIER');
  assert.equal(l.quantite, '0,750 kg');
  assert.equal(l.parts, null);
  assert.equal(l.prixUnitaire, null);
  const t = textes('ATELIER', commande({ lignes: [ligne({ unite: 'kg', quantite: 750, prixCentimes: 1000 })] })).map((x) => x.texte);
  assert.ok(t.includes('0,750 kg'));
  assert.ok(!t.some((x) => x.includes('kg ×')));
});

test('pièce montée : une ligne par étage, « ÉTAGE 1 : CHOCOLAT » puis « ÉTAGE 2 : VANILLE »', () => {
  assert.deepEqual(goutsLignesAImprimer(['Chocolat', 'Vanille'])?.map(lu), ['ÉTAGE 1 : CHOCOLAT', 'ÉTAGE 2 : VANILLE']);
  assert.deepEqual(goutsLignesAImprimer(['Framboise'])?.map(lu), ['GOÛT : FRAMBOISE']);
  assert.equal(goutsLignesAImprimer([' ', '']), null);
  const pm = gateauParPersonne({ libelle: 'Pièce montée 2 étages', quantite: 40, gouts: ['Chocolat', 'Vanille'] });
  for (const d of DESTINATIONS) {
    const t = tracesAvecPolices(d, commande({ lignes: [pm] }));
    const i1 = t.findIndex((x) => x.texte === 'ÉTAGE 1 : CHOCOLAT');
    const i2 = t.findIndex((x) => x.texte === 'ÉTAGE 2 : VANILLE');
    assert.ok(i1 >= 0 && i2 === i1 + 1, `${d} : deux lignes entières, dans l’ordre`);
    assert.ok(t[i1].gras && t[i2].gras, d);
    assert.ok(!t.some((x) => x.texte.startsWith('ÉTAGE') && x.texte.includes('·')), `${d} : plus de « · » entre les étages`);
  }
});

test('étiquette jamais coupée en deux, même dans une colonne étroite', () => {
  const mesurer = (s: string) => s.length * 10;
  for (const texte of goutsLignesAImprimer(['Mousse chocolat blanc', 'Vanille']) ?? []) {
    const lignes = couperTexte(texte, 120, mesurer).map(lu);
    assert.ok(lignes[0].startsWith('ÉTAGE '), lignes.join(' / '));
    assert.ok(/^ÉTAGE \d : \S/.test(lignes[0]), `étiquette collée au goût : ${lignes.join(' / ')}`);
  }
});

test('consigne longue sur toute la largeur : « GOÛT : MOUSSE CHOCOLAT », « Photo sélectionnée : G006 », « Pièce montée 2 étages » d’un seul tenant', () => {
  const pm = {
    ...gateauParPersonne({ libelle: 'Pièce montée 2 étages', quantite: 40, gouts: ['Mousse chocolat'] }),
    photoModele: 'G006',
  } as LigneCommande;
  for (const d of DESTINATIONS) {
    const t = tracesAvecPolices(d, commande({ lignes: [pm] }));
    for (const attendu of ['GOÛT : MOUSSE CHOCOLAT', 'Photo sélectionnée : G006', 'Pièce montée 2 étages', '1 gâteau — 40 PARTS']) {
      const x = t.find((y) => y.texte === attendu);
      assert.ok(x, `${d} : « ${attendu} » sur une seule ligne (${t.map((y) => y.texte).join(' | ')})`);
      assert.ok(x.x >= 0 && x.x + x.largeur <= LARGEUR, `${d} : tient dans ${LARGEUR} points`);
    }
    // Les consignes ne sont plus dans la colonne étroite du libellé : elles partent du bord.
    const gout = t.find((y) => y.texte === 'GOÛT : MOUSSE CHOCOLAT')!;
    assert.ok(gout.x < 60, `${d} : consigne à gauche (x = ${gout.x})`);
  }
});

test('décorations et précisions en gras, lisibles (24 points)', () => {
  const l = ligne({ libelle: 'Gâteau test', decorations: ['Oreo', 'Kinder'], precision: 'Bougie à part' });
  assert.deepEqual(consignesDeLigne(formaterLigneTicket(l, 'ATELIER')).map((c) => lu(c.texte)), ['Déco : Oreo, Kinder', 'Bougie à part']);
  const t = tracesAvecPolices('ATELIER', commande({ lignes: [l] }));
  for (const attendu of ['Déco : Oreo, Kinder', 'Bougie à part']) {
    const x = t.find((y) => y.texte === attendu);
    assert.ok(x && x.gras && x.taille >= 22, attendu);
  }
});

test('Number Cake : « CHIFFRES OU LETTRES : 2  5 », double espace conservé jusqu’au tracé', () => {
  assert.equal(lu(chiffresOuLettresAImprimer('25')), 'CHIFFRES OU LETTRES : 2  5');
  assert.equal(chiffresOuLettresAImprimer(''), null);
  // La découpe ne réduit plus les espaces entre deux mots.
  assert.deepEqual(couperTexte('2  5', 1000, (s) => s.length), ['2  5']);
  const nc = gateauParPersonne({ libelle: 'Number Cake', quantite: 30, formes: '25', nbSymboles: 2 });
  for (const d of DESTINATIONS) {
    const t = tracesAvecPolices(d, commande({ lignes: [nc] }));
    const x = t.find((y) => y.texte.startsWith('CHIFFRES OU LETTRES'));
    assert.ok(x, d);
    assert.equal(x.texte, 'CHIFFRES OU LETTRES : 2  5', d);
    assert.ok(x.gras, d);
    assert.ok(!t.some((y) => y.texte.includes('FORMES')), `${d} : plus le mot « formes »`);
  }
});

test('bandeau « MODIFIÉE » : même règle pour les trois formats ; CLIENT : « Version du … » sans consigne', () => {
  const evenements = [{ quand: '2026-10-22T16:40:00Z', action: 'modification', detail: 'produits, à réimprimer' }];
  assert.equal(bandeauModification({ evenements: [] }, 'ATELIER'), null);
  for (const d of ['BUREAU', 'MAGASIN', 'ATELIER'] as const) {
    assert.deepEqual(bandeauModification({ evenements }, d), { titre: 'MODIFIÉE le 22/10 à 18h40', consigne: 'Jetez l’ancien ticket' });
    const t = textes(d, commande({ evenements })).map((x) => x.texte);
    assert.ok(t.includes('MODIFIÉE le 22/10 à 18h40') && t.includes('Jetez l’ancien ticket'), d);
  }
  assert.deepEqual(bandeauModification({ evenements }, 'CLIENT'), { titre: 'Version du 22/10 à 18h40', consigne: null });
  const client = textes('CLIENT', commande({ evenements })).map((x) => x.texte);
  assert.ok(client.includes('Version du 22/10 à 18h40') && !client.some((x) => x.startsWith('MODIFIÉE')));
});

test('écriture : rien d’imprimé sans écriture, l’écriture si elle existe', () => {
  for (const d of DESTINATIONS) {
    const sans = textes(d, commande({ texteGateau: null })).map((x) => x.texte.toUpperCase()).join(' | ');
    assert.ok(!sans.includes('SUR LE GÂTEAU'), d);
    const avec = textes(d, commande({ texteGateau: 'Joyeux anniversaire Léa' })).map((x) => x.texte);
    assert.ok(avec.includes('SUR LE GÂTEAU') && avec.join(' ').includes('Joyeux anniversaire Léa'), d);
  }
});
