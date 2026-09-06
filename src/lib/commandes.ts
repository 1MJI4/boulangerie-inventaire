// src/lib/commandes.ts
//
// Le module commandes ne remplace pas le papier : il le produit. Le vendeur
// saisit une fois, l'application imprime quatre exemplaires A6 sur une A4, et
// ces feuillets sont accrochés exactement comme avant. Ce que l'application
// apporte, c'est le filet — elle sait que la commande existe, elle le rappelle
// avant l'échéance, et elle vérifie la tarification quand elle le peut.
//
// Deux principes traversent ce fichier :
//   1. Aucun contrôle ne bloque jamais une saisie. Un avertissement s'affiche,
//      le vendeur passe outre s'il le veut — et le fait qu'il soit passé outre
//      est enregistré. Sans cette trace, les avertissements ne servent qu'à
//      se rassurer.
//   2. Les montants sont en centimes. Un entier ne dérive jamais, là où un
//      flottant finit par afficher 78,99999.

import { dateDuJour, decalerJours, type DateISO } from './dateProduction';

/* ------------------------------------------------------------------ Types */

export const STATUTS = ['a_imprimer', 'imprimee', 'remise', 'annulee'] as const;
export type StatutCommande = (typeof STATUTS)[number];

export const LIBELLE_STATUT: Record<StatutCommande, string> = {
  a_imprimer: 'À imprimer',
  imprimee: 'Imprimée',
  remise: 'Remise au client',
  annulee: 'Annulée',
};

export const MODES_PAIEMENT = ['especes', 'virement'] as const;
export type ModePaiement = (typeof MODES_PAIEMENT)[number];

export const LIBELLE_PAIEMENT: Record<ModePaiement, string> = {
  especes: 'Espèces',
  virement: 'Virement',
};

export type Origine = 'comptoir' | 'telephone';

export type LigneCommande = {
  id?: number;
  libelle: string;
  quantite: number;
  prixCentimes: number;
  poste: string | null;
  precision: string | null;
  tarifId: number | null;
  /** Catégorie tarifaire, transportée pour les contrôles. Pas stockée. */
  categorie?: string | null;
};

export type Commande = {
  id: number;
  numero: string;
  client: string;
  telephone: string;
  vendeur: string;
  priseLe: string;
  origine: Origine;
  retraitLe: DateISO;
  retraitHeure: string;
  modePaiement: ModePaiement;
  acompteCentimes: number;
  acompteRecuLe: string | null;
  totalCentimes: number;
  texteGateau: string | null;
  sansEcriture: boolean;
  photoWhatsapp: boolean;
  photoImprimee: boolean;
  gateauComplexe: boolean;
  remarques: string | null;
  statut: StatutCommande;
  imprimeeLe: string | null;
  remiseLe: string | null;
  avertissements: Avertissement[];
  anonymiseeLe: string | null;
  lignes: LigneCommande[];
};

/* ------------------------------------------------------------- Échéances */

/** Une commande dont le retrait est passé depuis ce délai sort des rappels. */
export const JOURS_AVANT_ARCHIVAGE = 2;

/**
 * Les personnes disparaissent au bout d'un mois : assez pour retrouver un
 * client qui revient réclamer, assez court pour ne pas reconstituer un fichier.
 * Ce qui reste — date, produits, montants — n'identifie plus personne.
 */
export const JOURS_AVANT_ANONYMISATION = 30;

export const MENTION_ANONYME = 'anonyme';

/* --------------------------------------------------------------- Montants */

export function formaterEuros(centimes: number): string {
  return `${(centimes / 100).toFixed(2).replace('.', ',')} €`;
}

/** Accepte « 12 », « 12,50 », « 12.5 ». Renvoie null si ce n'est pas un montant. */
export function lireMontant(saisie: string): number | null {
  const nettoye = saisie.replace(/\s/g, '').replace(',', '.');
  if (nettoye === '') return null;
  if (!/^\d+(\.\d{0,2})?$/.test(nettoye)) return null;
  return Math.round(Number(nettoye) * 100);
}

export function totalCentimes(lignes: Pick<LigneCommande, 'quantite' | 'prixCentimes'>[]): number {
  return lignes.reduce((somme, l) => somme + l.quantite * l.prixCentimes, 0);
}

/* --------------------------------------------------------------- Numéro */

/** 2026-0247 : lisible au téléphone, unique, et se met en communication d'un virement. */
export function formaterNumero(annee: number, sequence: number): string {
  return `${annee}-${String(sequence).padStart(4, '0')}`;
}

/* ------------------------------------------------------- Règles de contrôle */

export type Avertissement = {
  code: string;
  message: string;
  /** true quand le vendeur a validé malgré l'avertissement. */
  passeOutre?: boolean;
};

/**
 * Formats de gâteaux qui ont un prix fixe. Sur ces formats l'application
 * applique le tarif et ne compare rien : le bavarois 8P à 31 € est un prix
 * juste, pas une remise à signaler. Le prix par personne baisse volontairement
 * quand le gâteau grandit, et l'affiche ne donne que le tarif d'entrée.
 */
export const FORMATS_TARIFES = [1, 4, 6, 8, 10];

/** Minimums de parts affichés en magasin, hors formats du comptoir. */
export const MINIMUMS_PARTS: { motif: RegExp; parts: number; libelle: string }[] = [
  { motif: /number\s*cake/i, parts: 15, libelle: 'Number cake' },
  { motif: /layer\s*cake/i, parts: 20, libelle: 'Layer cake' },
  { motif: /pi[èe]ce\s*mont[ée]e/i, parts: 40, libelle: 'Pièce montée' },
];

/** Les minis se commandent par dix, pour chaque sorte. */
export const MINIMUM_MINIS = 10;

export const SUPPLEMENT_PHOTO_CENTIMES = 1500;
export const SUPPLEMENT_ECRITURE_CENTIMES = 200;

export const LIBELLE_SUPPLEMENT_PHOTO = 'Supplément impression photo';
export const LIBELLE_SUPPLEMENT_ECRITURE = 'Supplément écriture sur le gâteau';

/**
 * Les suppléments ne se saisissent pas : ils découlent des choix faits plus
 * haut et s'ajoutent d'eux-mêmes au bon, en clair. C'est ce qui évite qu'on
 * les oublie — et ils sont imprimés, donc le client voit ce qu'il paie.
 */
export function supplementsDe({
  photoImprimee,
  texteGateau,
}: {
  photoImprimee: boolean;
  texteGateau: string | null;
}): LigneCommande[] {
  const lignes: LigneCommande[] = [];

  if (photoImprimee) {
    lignes.push({
      libelle: LIBELLE_SUPPLEMENT_PHOTO,
      quantite: 1,
      prixCentimes: SUPPLEMENT_PHOTO_CENTIMES,
      poste: 'patissier',
      precision: null,
      tarifId: null,
    });
  }

  if (texteGateau && texteGateau.trim() !== '') {
    lignes.push({
      libelle: LIBELLE_SUPPLEMENT_ECRITURE,
      quantite: 1,
      prixCentimes: SUPPLEMENT_ECRITURE_CENTIMES,
      poste: 'patissier',
      precision: null,
      tarifId: null,
    });
  }

  return lignes;
}

export function estUnSupplement(libelle: string): boolean {
  return libelle === LIBELLE_SUPPLEMENT_PHOTO || libelle === LIBELLE_SUPPLEMENT_ECRITURE;
}

/** Sous ce nombre de personnes, un gâteau prend un supplément. */
export const PARTS_SANS_SUPPLEMENT = 6;

const CATEGORIES_GATEAU = ['Gâteaux et tartes'];

function estUnGateau(ligne: LigneCommande): boolean {
  if (ligne.categorie && CATEGORIES_GATEAU.includes(ligne.categorie)) return true;
  return /g[âa]teau|bavarois|cr[èe]me fra[îi]che|for[êe]t noire|fraisier|mousse|croûte|tarte|cake|pi[èe]ce mont[ée]e/i.test(
    ligne.libelle
  );
}

/** « Bavarois framboise 6P » → 6. Renvoie null si le libellé ne dit rien. */
export function lireNombreDeParts(libelle: string): number | null {
  const trouve = libelle.match(/(\d+)\s*P\b/i);
  return trouve ? Number(trouve[1]) : null;
}

export type ContexteControle = {
  lignes: LigneCommande[];
  retraitLe: DateISO;
  /** Le client veut son texte écrit sur le gâteau. */
  texteGateau?: string | null;
  /** Choix explicite : il n'y a rien à écrire. */
  sansEcriture?: boolean;
  /** Le vendeur juge la commande complexe : elle demande une confirmation. */
  gateauComplexe?: boolean;
  /** Fournie pour les tests ; par défaut la date du jour. */
  aujourdhui?: DateISO;
};

/**
 * Tous les contrôles sont des avertissements. La commande part quoi qu'il
 * arrive : c'est le vendeur qui a le client en face, pas l'application.
 */
export function controlerCommande(contexte: ContexteControle): Avertissement[] {
  const aujourdhui = contexte.aujourdhui ?? dateDuJour();
  const avertissements: Avertissement[] = [];

  const gateaux = contexte.lignes.filter(estUnGateau);

  // --- Une date déjà passée est presque toujours une faute de frappe.
  if (contexte.retraitLe < aujourdhui) {
    avertissements.push({
      code: 'retrait_passe',
      message: 'La date de retrait est déjà passée — vérifiez le jour.',
    });
  }

  // --- Un prix à zéro se voit mal dans une liste de lignes.
  for (const ligne of contexte.lignes) {
    if (ligne.prixCentimes === 0) {
      avertissements.push({
        code: 'prix_nul',
        message: `${ligne.libelle || 'Une ligne'} : prix à 0 €.`,
      });
    }
  }

  // --- Délai : un gâteau pour demain ou après-demain se confirme au téléphone.
  if (gateaux.length > 0 && contexte.retraitLe <= decalerJours(aujourdhui, 2)) {
    avertissements.push({
      code: 'delai_gateau',
      message:
        'Retrait dans moins de 48 h avec un gâteau : confirmez la faisabilité avec le manager avant de promettre l’heure au client.',
    });
  }

  for (const ligne of contexte.lignes) {
    const parts = lireNombreDeParts(ligne.libelle);

    // --- Minimums de parts annoncés en magasin.
    for (const regle of MINIMUMS_PARTS) {
      if (!regle.motif.test(ligne.libelle)) continue;
      if (parts !== null && parts < regle.parts) {
        avertissements.push({
          code: `minimum_${regle.libelle.toLowerCase().replace(/\s/g, '_')}`,
          message: `${regle.libelle} : minimum ${regle.parts} parts (${parts} demandées).`,
        });
      }
    }

    // --- Les minis se commandent par quinze.
    if (/^mini\b/i.test(ligne.libelle) && ligne.quantite < MINIMUM_MINIS) {
      avertissements.push({
        code: 'minimum_minis',
        message: `${ligne.libelle} : minimum ${MINIMUM_MINIS} pièces (${ligne.quantite} demandées).`,
      });
    }

    if (!estUnGateau(ligne) || parts === null) continue;

    // --- Entre 1 part et 4 parts, il n'y a rien : ni 2, ni 3.
    if (parts > 1 && parts < 4) {
      avertissements.push({
        code: 'format_inexistant',
        message: `${ligne.libelle} : un gâteau se fait à la pièce ou à partir de 4 parts.`,
      });
      continue;
    }

    // --- Moins de 6 personnes : supplément.
    if (parts >= 4 && parts < PARTS_SANS_SUPPLEMENT) {
      avertissements.push({
        code: 'supplement_petit_gateau',
        message: `${ligne.libelle} : moins de ${PARTS_SANS_SUPPLEMENT} personnes, pensez au supplément.`,
      });
    }

  }

  // --- Une commande jugée complexe ne s'annonce pas au client sans accord :
  //     le prix affiché n'est qu'un prix d'appel, et la faisabilité se discute.
  if (contexte.gateauComplexe) {
    avertissements.push({
      code: 'gateau_complexe',
      message:
        'Gâteau complexe : confirmez le prix et la faisabilité avec le manager avant de vous engager.',
    });
  }

  // --- L'écriture sur le gâteau se demande, elle ne se devine pas. Tant que
  //     le vendeur n'a ni écrit le texte ni coché « pas d'écriture », la
  //     question n'a pas été posée au client.
  const aUnTexte = !!contexte.texteGateau && contexte.texteGateau.trim() !== '';
  if (gateaux.length > 0 && !aUnTexte && !contexte.sansEcriture) {
    avertissements.push({
      code: 'ecriture_non_precisee',
      message: 'Écriture sur le gâteau : écrivez le texte, ou cochez « pas d’écriture ».',
    });
  }

  return avertissements;
}

/* ------------------------------------------- Message de confirmation client */

/**
 * Préparé par l'application, envoyé par le manager depuis son WhatsApp.
 * Volontairement sans coordonnées bancaires : un IBAN en base, c'est une
 * donnée sensible de plus à protéger pour gagner deux secondes par appel.
 * Le numéro en communication, lui, permet de rapprocher un virement de la
 * bonne commande même quand trois attendent le même soir.
 */
export function messageConfirmation(commande: {
  numero: string;
  lignes: Pick<LigneCommande, 'libelle' | 'quantite'>[];
  retraitLe: DateISO;
  retraitHeure: string;
  totalCentimes: number;
  acompteCentimes: number;
  texteGateau?: string | null;
  modePaiement: ModePaiement;
}): string {
  const lignes = [
    `PAin PAtisserie — Commande n° ${commande.numero}`,
    '',
    ...commande.lignes.map((l) => `• ${l.quantite} × ${l.libelle}`),
  ];

  if (commande.texteGateau) lignes.push(`• À écrire : « ${commande.texteGateau} »`);

  lignes.push(
    '',
    `À retirer le ${formaterDateMessage(commande.retraitLe)} à ${commande.retraitHeure}`,
    `Total : ${formaterEuros(commande.totalCentimes)}`,
    `Acompte : ${formaterEuros(commande.acompteCentimes)}`,
    `Reste à payer : ${formaterEuros(commande.totalCentimes - commande.acompteCentimes)}`
  );

  if (commande.modePaiement === 'virement') {
    lignes.push(
      '',
      `Merci d’indiquer « ${commande.numero} » en communication du virement.`
    );
  }

  return lignes.join('\n');
}

function formaterDateMessage(date: DateISO): string {
  const [a, m, j] = date.split('-');
  return `${j}/${m}/${a}`;
}

/* ------------------------------------------------------------- Prédicats */

export function attendUnVirement(commande: Pick<Commande, 'modePaiement' | 'acompteRecuLe' | 'statut'>): boolean {
  return (
    commande.modePaiement === 'virement' &&
    !commande.acompteRecuLe &&
    commande.statut !== 'annulee'
  );
}

export function resteAFaire(commande: Pick<Commande, 'statut'>): boolean {
  return commande.statut === 'a_imprimer' || commande.statut === 'imprimee';
}

/** Ce qui alimente la pastille de l'accueil. */
export function compterCeQuiReste(
  commandes: Pick<Commande, 'statut' | 'retraitLe' | 'modePaiement' | 'acompteRecuLe'>[],
  aujourdhui: DateISO = dateDuJour()
): { aImprimer: number; retraitsDuJour: number; virements: number; total: number } {
  const aImprimer = commandes.filter((c) => c.statut === 'a_imprimer').length;
  const retraitsDuJour = commandes.filter(
    (c) => c.retraitLe === aujourdhui && resteAFaire(c)
  ).length;
  const virements = commandes.filter(attendUnVirement).length;
  return { aImprimer, retraitsDuJour, virements, total: aImprimer + retraitsDuJour };
}
