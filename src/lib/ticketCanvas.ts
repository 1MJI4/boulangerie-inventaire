// src/lib/ticketCanvas.ts
//
// Le ticket dessiné au point près, sur un canvas de 576 points de large —
// la définition exacte de la tête thermique d'une 80 mm (203 dpi sur 72 mm
// imprimables).
//
// Pourquoi abandonner le HTML imprimé par le navigateur : parce qu'il n'y a
// alors aucun moyen de savoir ce qui sortira vraiment. La largeur dépend du
// pilote, la hauteur de page d'une propriété CSS que les navigateurs
// interprètent chacun à leur façon, et l'aperçu écran ment. Ici le même
// dessin sert d'aperçu et de fichier envoyé à l'imprimante : ce que le
// vendeur voit est, au point près, ce que la machine imprimera.
//
// Tout est en noir pur, sans gris : une tête thermique ne connaît que deux
// états, et un gris tramé sort baveux.

import { formaterEuros, type Commande } from './commandes';

export const DESTINATIONS = ['CLIENT', 'BUREAU', 'MAGASIN', 'ATELIER'] as const;
export type Destination = (typeof DESTINATIONS)[number];

/** 72 mm imprimables à 203 dpi. Ne pas changer sans changer de matériel. */
export const LARGEUR = 576;
/** Marge intérieure : en dessous, le massicot mord sur le texte. */
const MARGE = 16;
const UTILE = LARGEUR - MARGE * 2;

/** Hauteur de la zone de dessin libre, en points (≈ 60 mm). */
const ZONE_LIBRE = 480;

const SANS = 'Arial, Helvetica, sans-serif';

type Contexte = CanvasRenderingContext2D;

/* --------------------------------------------------------------- Outils */

/**
 * Le dessin se fait en deux passes : une pour mesurer, une pour tracer. Sans
 * ça il faudrait deviner la hauteur du canvas avant de connaître le nombre de
 * lignes que prendra un libellé une fois coupé, et une commande de vingt
 * produits déborderait en silence — exactement le défaut qu'on vient de
 * corriger sur la version papier.
 */
class Plume {
  y = MARGE;
  constructor(
    readonly ctx: Contexte | null,
    public largeur = LARGEUR
  ) {}

  private avec(police: string, action: (ctx: Contexte) => void) {
    if (!this.ctx) return;
    this.ctx.save();
    this.ctx.font = police;
    this.ctx.fillStyle = '#000';
    this.ctx.strokeStyle = '#000';
    this.ctx.textBaseline = 'top';
    action(this.ctx);
    this.ctx.restore();
  }

  /** Découpe un texte pour qu'il tienne dans une largeur donnée. */
  private couper(texte: string, police: string, largeurMax: number): string[] {
    if (!this.ctx) {
      // Passe de mesure sans contexte : approximation par le nombre de
      // caractères. Jamais utilisée en pratique — on mesure toujours avec un
      // canvas — mais évite un plantage si quelqu'un appelle sans.
      const parLigne = Math.max(1, Math.floor(largeurMax / 9));
      const lignes: string[] = [];
      for (let i = 0; i < texte.length; i += parLigne) lignes.push(texte.slice(i, i + parLigne));
      return lignes.length ? lignes : [''];
    }
    this.ctx.save();
    this.ctx.font = police;
    const mots = texte.split(/\s+/).filter(Boolean);
    const lignes: string[] = [];
    let courante = '';
    for (const mot of mots) {
      const essai = courante ? `${courante} ${mot}` : mot;
      if (this.ctx.measureText(essai).width <= largeurMax || !courante) {
        courante = essai;
      } else {
        lignes.push(courante);
        courante = mot;
      }
    }
    if (courante) lignes.push(courante);
    this.ctx.restore();
    return lignes.length ? lignes : [''];
  }

  texte(
    contenu: string,
    options: {
      taille?: number;
      gras?: boolean;
      align?: 'gauche' | 'centre' | 'droite';
      interligne?: number;
      x?: number;
      largeurMax?: number;
      espacement?: number;
    } = {}
  ) {
    const taille = options.taille ?? 22;
    const police = `${options.gras ? '700 ' : ''}${taille}px ${SANS}`;
    const largeurMax = options.largeurMax ?? UTILE;
    const interligne = options.interligne ?? Math.round(taille * 1.25);
    const lignes = this.couper(contenu, police, largeurMax);
    for (const ligne of lignes) {
      this.avec(police, (ctx) => {
        let x = options.x ?? MARGE;
        if (options.align === 'centre') {
          x = (this.largeur - ctx.measureText(ligne).width) / 2;
        } else if (options.align === 'droite') {
          x = MARGE + largeurMax - ctx.measureText(ligne).width;
        }
        ctx.fillText(ligne, x, this.y);
      });
      this.y += interligne;
    }
  }

  /** Une étiquette en petites capitales, comme sur le bon papier. */
  etiquette(contenu: string) {
    this.texte(contenu.toUpperCase(), { taille: 15, gras: true, interligne: 19 });
  }

  /** La bande noire de destination : le seul aplat, il se lit à un mètre. */
  bandeau(contenu: string) {
    const hauteur = 54;
    if (this.ctx) {
      this.ctx.save();
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(MARGE, this.y, UTILE, hauteur);
      this.ctx.fillStyle = '#fff';
      this.ctx.font = `700 34px ${SANS}`;
      this.ctx.textBaseline = 'middle';
      const espace = contenu.split('').join(' ');
      const l = this.ctx.measureText(espace).width;
      this.ctx.fillText(espace, (this.largeur - l) / 2, this.y + hauteur / 2 + 1);
      this.ctx.restore();
    }
    this.y += hauteur;
  }

  trait(epaisseur = 2, pointille = false) {
    if (this.ctx) {
      this.ctx.save();
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = epaisseur;
      if (pointille) this.ctx.setLineDash([4, 5]);
      this.ctx.beginPath();
      this.ctx.moveTo(MARGE, this.y + epaisseur / 2);
      this.ctx.lineTo(LARGEUR - MARGE, this.y + epaisseur / 2);
      this.ctx.stroke();
      this.ctx.restore();
    }
    this.y += epaisseur;
  }

  /**
   * Encadre une zone déjà dessinée. Le haut est passé explicitement : se fier
   * à la position courante revient à encadrer le bloc suivant, ce qui ne se
   * voit qu'à l'impression.
   */
  cadre(haut: number, bas: number, epaisseur = 3, pointille = false) {
    if (!this.ctx) return;
    this.ctx.save();
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = epaisseur;
    if (pointille) this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(MARGE, haut, UTILE, bas - haut);
    this.ctx.restore();
  }

  espace(points: number) {
    this.y += points;
  }
}

/* ------------------------------------------------- Le dessin d'un ticket */

function dessiner(plume: Plume, destination: Destination, commande: Commande) {
  const pourLeClient = destination === 'CLIENT';
  const reste = Math.max(0, commande.totalCentimes - commande.acompteCentimes);

  plume.texte('PAin PAtisserie', { taille: 40, gras: true, align: 'centre' });
  plume.espace(4);
  plume.texte('Chaussée de Louvain 906 — 1140 Evere', { taille: 17, align: 'centre', interligne: 21 });
  plume.texte('+32 472 25 05 78', { taille: 17, align: 'centre', interligne: 21 });
  plume.espace(8);
  plume.trait(3);
  plume.espace(10);

  plume.bandeau(destination);
  plume.espace(14);

  // Numéro : c'est la clé de tout — communication du virement, recherche dans
  // l'application, rapprochement avec le feuillet accroché au bureau.
  plume.etiquette('Commande n°');
  plume.texte(commande.numero, { taille: 38, gras: true });
  plume.espace(2);
  const prise = formaterDate(commande.priseLe);
  plume.texte(
    pourLeClient ? `Prise le ${prise}` : `Prise le ${prise}${commande.vendeur ? ` · ${commande.vendeur}` : ''}`,
    { taille: 16, interligne: 20 }
  );
  plume.espace(12);

  champ(plume, 'Nom', commande.client);
  champ(plume, 'Téléphone', commande.telephone);
  plume.espace(12);

  // Le retrait encadré : c'est l'information qu'on cherche du regard sur un
  // feuillet accroché parmi trente autres.
  const hautRetrait = plume.y;
  plume.espace(10);
  plume.texte('POUR LE', { taille: 16, gras: true, align: 'centre', interligne: 22 });
  plume.texte(formaterDateCourte(commande.retraitLe), {
    taille: 34,
    gras: true,
    align: 'centre',
    interligne: 40,
  });
  plume.texte(`à ${commande.retraitHeure}`, { taille: 34, gras: true, align: 'centre', interligne: 40 });
  plume.espace(10);
  plume.cadre(hautRetrait, plume.y, 4);
  plume.espace(16);

  plume.etiquette('Produits commandés');
  plume.espace(2);
  plume.trait(3);
  plume.espace(6);
  for (const ligne of commande.lignes) {
    produit(plume, ligne);
  }
  plume.espace(8);

  if (commande.texteGateau) {
    mention(plume, 'Sur le gâteau', commande.texteGateau);
  } else if (commande.sansEcriture && !pourLeClient) {
    mention(plume, 'Écriture', 'Aucune — demandé au client', true);
  }
  if (commande.photoImprimee) {
    mention(plume, 'Photo', 'À IMPRIMER SUR LE GÂTEAU');
  }
  // « À confirmer » n'a de sens qu'en interne : le client qui vient de verser
  // un acompte n'a pas à lire que sa commande n'est pas sûre.
  if (commande.gateauComplexe && !pourLeClient) {
    mention(plume, 'Complexe', 'À CONFIRMER — PRIX ET FAISABILITÉ');
  }
  if (commande.photoWhatsapp && !pourLeClient) {
    mention(plume, 'Modèle', 'Photo d’exemple sur WhatsApp — à réclamer au manager', true);
  }
  if (commande.remarques && !pourLeClient) {
    mention(plume, 'Remarques', commande.remarques, true);
  }

  plume.espace(10);
  montant(plume, 'Total', formaterEuros(commande.totalCentimes), true);
  montant(plume, 'Acompte', formaterEuros(commande.acompteCentimes));
  montant(plume, 'Restant dû', formaterEuros(reste));
  plume.espace(16);

  if (pourLeClient) {
    plume.trait(1, true);
    plume.espace(10);
    plume.texte('À présenter au retrait', { taille: 18, align: 'centre', interligne: 24 });
    plume.texte('Merci de votre confiance', { taille: 18, align: 'centre', interligne: 24 });
    if (commande.modePaiement === 'virement') {
      plume.texte(`Communication du virement : ${commande.numero}`, {
        taille: 16,
        align: 'centre',
        interligne: 22,
      });
    }
  } else {
    // Le rouleau ne coûte presque rien : autant laisser de quoi dessiner le
    // gâteau, c'est ce que les vendeurs font depuis toujours.
    const haut = plume.y;
    plume.espace(8);
    plume.texte('ZONE LIBRE — DESSIN, PRÉCISIONS', { taille: 14, x: MARGE + 10, interligne: 18 });
    plume.y = haut + ZONE_LIBRE;
    plume.cadre(haut, plume.y, 2, true);
  }

  plume.espace(MARGE);
}

function champ(plume: Plume, etiquette: string, valeur: string) {
  plume.texte(etiquette.toUpperCase(), { taille: 15, gras: true, interligne: 0 });
  plume.texte(valeur || '—', {
    taille: 24,
    gras: true,
    align: 'droite',
    interligne: 30,
  });
  plume.espace(4);
  plume.trait(1, true);
  plume.espace(8);
}

function produit(plume: Plume, ligne: Commande['lignes'][number]) {
  const prix = ((ligne.quantite * ligne.prixCentimes) / 100).toFixed(2).replace('.', ',');
  const colQuantite = 64;
  const colPrix = 96;
  const colNom = UTILE - colQuantite - colPrix - 12;
  const haut = plume.y;

  plume.texte(`${ligne.quantite} ×`, { taille: 22, gras: true, interligne: 0 });
  const apresQuantite = plume.y;
  plume.y = haut;
  plume.texte(ligne.libelle, {
    taille: 22,
    x: MARGE + colQuantite,
    largeurMax: colNom,
    interligne: 27,
  });
  if (ligne.precision) {
    plume.texte(ligne.precision, {
      taille: 17,
      x: MARGE + colQuantite,
      largeurMax: colNom,
      interligne: 21,
    });
  }
  const bas = plume.y;
  plume.y = haut;
  plume.texte(prix, { taille: 22, align: 'droite', interligne: 0 });
  plume.y = Math.max(bas, apresQuantite + 27);
  plume.espace(3);
  plume.trait(1, true);
  plume.espace(6);
}

function mention(plume: Plume, etiquette: string, valeur: string, discret = false) {
  const haut = plume.y;
  plume.espace(8);
  plume.texte(etiquette.toUpperCase(), { taille: 14, gras: true, x: MARGE + 10, interligne: 18 });
  plume.texte(valeur, {
    taille: discret ? 19 : 24,
    gras: !discret,
    x: MARGE + 10,
    largeurMax: UTILE - 20,
    interligne: discret ? 24 : 29,
  });
  plume.espace(8);
  plume.cadre(haut, plume.y, discret ? 2 : 3, discret);
  plume.espace(10);
}

function montant(plume: Plume, etiquette: string, valeur: string, inverse = false) {
  const hauteur = 40;
  const ctx = plume.ctx;
  if (ctx) {
    ctx.save();
    if (inverse) {
      ctx.fillStyle = '#000';
      ctx.fillRect(MARGE, plume.y, UTILE, hauteur);
      ctx.fillStyle = '#fff';
    } else {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeRect(MARGE, plume.y, UTILE, hauteur);
      ctx.fillStyle = '#000';
    }
    ctx.textBaseline = 'middle';
    ctx.font = `700 20px ${SANS}`;
    ctx.fillText(etiquette.toUpperCase(), MARGE + 12, plume.y + hauteur / 2 + 1);
    ctx.font = `700 26px ${SANS}`;
    const l = ctx.measureText(valeur).width;
    ctx.fillText(valeur, LARGEUR - MARGE - 12 - l, plume.y + hauteur / 2 + 1);
    ctx.restore();
  }
  plume.y += hauteur;
}

/* ------------------------------------------------------------- Interface */

function nouveauCanvas(largeur: number, hauteur: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = largeur;
  canvas.height = hauteur;
  return canvas;
}

/**
 * Dessine un exemplaire et renvoie le canvas. Deux passes : la première
 * mesure la hauteur réelle, la seconde dessine pour de bon.
 */
export function dessinerTicket(destination: Destination, commande: Commande): HTMLCanvasElement {
  const mesure = nouveauCanvas(LARGEUR, 10);
  const ctxMesure = mesure.getContext('2d');
  const plumeMesure = new Plume(ctxMesure);
  dessiner(plumeMesure, destination, commande);
  const hauteur = Math.ceil(plumeMesure.y);

  const canvas = nouveauCanvas(LARGEUR, hauteur);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, LARGEUR, hauteur);
  }
  dessiner(new Plume(ctx), destination, commande);
  return canvas;
}

/** Le PNG à envoyer à l'imprimante, en base64 sans le préfixe data:. */
export function ticketEnPng(destination: Destination, commande: Commande): string {
  const canvas = dessinerTicket(destination, commande);
  return canvas.toDataURL('image/png').split(',')[1] ?? '';
}

function formaterDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formaterDateCourte(date: string): string {
  const [a, m, j] = date.split('-');
  const jour = new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-BE', { weekday: 'short' });
  return `${jour} ${j}/${m}/${a.slice(2)}`;
}
