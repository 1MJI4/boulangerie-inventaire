'use client';

// src/components/TicketCommande.tsx
//
// Le bon en rouleau 80 mm, pour une imprimante de caisse.
//
// Trois différences de fond avec l'A6 découpé :
//   • le rouleau est continu, donc un bon de trente lignes sort simplement
//     plus long — plus rien ne peut être tronqué ;
//   • l'imprimante coupe elle-même entre deux exemplaires, il n'y a plus de
//     massicot ;
//   • la largeur utile tombe à ~72 mm : tout passe en colonne unique, et la
//     zone de dessin devient une bande haute plutôt qu'un carré.
//
// Une contrainte propre au thermique : les grands aplats noirs chauffent la
// tête, ralentissent l'impression et l'usent. On n'en garde qu'un, la bande de
// destination, parce que c'est ce qui se lit à un mètre sur une porte.

import { formaterEuros, type Commande } from '@/lib/commandes';

export const DESTINATIONS = ['CLIENT', 'BUREAU', 'MAGASIN', 'ATELIER'] as const;
export type Destination = (typeof DESTINATIONS)[number];

export function Ticket({
  destination,
  commande,
  rang = 0,
}: {
  destination: Destination;
  commande: Commande;
  /** Position dans le rouleau : sert à donner sa propre longueur de page à
      chaque exemplaire (voir reglesPagesTicket). */
  rang?: number;
}) {
  const pourLeClient = destination === 'CLIENT';
  const reste = commande.totalCentimes - commande.acompteCentimes;

  return (
    <div className={`ticket tk-p${rang}`}>
      <div className="tk-entete">
        <div className="tk-marque">PAin PAtisserie</div>
        <div className="tk-coord">
          Chaussée de Louvain 906 — 1140 Evere
          <br />
          +32 472 25 05 78
        </div>
      </div>

      <div className="tk-dest">{destination}</div>

      <div className="tk-numero">
        <span>Commande n°</span>
        <b>{commande.numero}</b>
      </div>

      <div className="tk-meta">
        Prise le {formaterDate(commande.priseLe)}
        {!pourLeClient && commande.vendeur ? ` · ${commande.vendeur}` : ''}
      </div>

      <div className="tk-champ">
        <span>Nom</span>
        <b>{commande.client}</b>
      </div>
      <div className="tk-champ">
        <span>Téléphone</span>
        <b>{commande.telephone}</b>
      </div>

      <div className="tk-retrait">
        <span>Pour le</span>
        <b>{formaterDateCourte(commande.retraitLe)}</b>
        <i>à {commande.retraitHeure}</i>
      </div>

      <div className="tk-titre">Produits commandés</div>
      {commande.lignes.map((ligne, index) => (
        <div className="tk-ligne" key={index}>
          <span className="q">{ligne.quantite} ×</span>
          <span className="n">
            {ligne.libelle}
            {ligne.precision ? <em>{ligne.precision}</em> : null}
          </span>
          <span className="p">
            {((ligne.quantite * ligne.prixCentimes) / 100).toFixed(2).replace('.', ',')}
          </span>
        </div>
      ))}

      {commande.texteGateau ? (
        <div className="tk-mention">
          <span>Sur le gâteau</span>
          <b>{commande.texteGateau}</b>
        </div>
      ) : commande.sansEcriture && !pourLeClient ? (
        <div className="tk-mention discret">
          <span>Écriture</span>
          <i>aucune — demandé au client</i>
        </div>
      ) : null}

      {commande.gateauComplexe ? (
        <div className="tk-mention">
          <span>Complexe</span>
          <b>À CONFIRMER — PRIX ET FAISABILITÉ</b>
        </div>
      ) : null}

      {commande.photoImprimee ? (
        <div className="tk-mention">
          <span>Photo</span>
          <b>À IMPRIMER SUR LE GÂTEAU</b>
        </div>
      ) : null}

      {commande.photoWhatsapp && !pourLeClient ? (
        <div className="tk-mention discret">
          <span>Modèle</span>
          <i>photo d’exemple sur WhatsApp — à réclamer au manager</i>
        </div>
      ) : null}

      {!pourLeClient && commande.remarques ? (
        <div className="tk-mention discret">
          <span>Remarques</span>
          <i>{commande.remarques}</i>
        </div>
      ) : null}

      <div className="tk-montants">
        <div className="total">
          <span>Total</span>
          <b>{formaterEuros(commande.totalCentimes)}</b>
        </div>
        <div>
          <span>Acompte</span>
          <b>{formaterEuros(commande.acompteCentimes)}</b>
        </div>
        <div>
          <span>Restant dû</span>
          <b>{formaterEuros(Math.max(0, reste))}</b>
        </div>
      </div>

      {/* La zone libre : le rouleau ne coûte presque rien, autant laisser de
          quoi dessiner. Elle n'a pas de sens sur l'exemplaire du client. */}
      {pourLeClient ? (
        <div className="tk-pied">
          À présenter au retrait
          <br />
          Merci de votre confiance
          {commande.modePaiement === 'virement' ? (
            <>
              <br />
              Communication du virement : {commande.numero}
            </>
          ) : null}
        </div>
      ) : (
        <div className="tk-libre">
          <span>Zone libre — dessin, précisions</span>
        </div>
      )}
    </div>
  );
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

/* ------------------------------------------------------------------- CSS */

/**
 * « size: 80mm auto » n'existe pas : la propriété accepte une longueur, deux,
 * ou un nom de format — pas un mélange. Le navigateur jette la déclaration
 * entière en silence et repart sur de l'A4, ce qui donne une bande de 80 mm
 * perdue sur le bord d'une page de 297 mm : le rouleau avance dans le vide
 * entre chaque exemplaire.
 *
 * On mesure donc chaque ticket une fois affiché et on lui fabrique sa propre
 * page nommée, à sa longueur exacte. Chrome et Edge (donc la tablette et le
 * poste du comptoir) gèrent les pages nommées ; ailleurs, le @page par défaut
 * ci-dessous prend le relais avec une longueur généreuse.
 */
export function reglesPagesTicket(hauteursMm: number[]): string {
  return hauteursMm
    .map((mm, rang) => {
      // 2 mm de marge : un arrondi au pixel près suffirait à déclencher une
      // deuxième page presque vide, soit un ticket coupé en deux.
      const hauteur = Math.max(60, Math.ceil(mm) + 2);
      return `@page tk${rang} { size: 80mm ${hauteur}mm; margin: 0 }\n.tk-p${rang} { page: tk${rang} }`;
    })
    .join('\n');
}

export const CSS_TICKET = `
@page { size: 80mm 297mm; margin: 0; }

.rouleau { display: flex; flex-direction: column; align-items: center; gap: 6mm; }

.ticket {
  width: 80mm; padding: 4mm; box-sizing: border-box; background: #fff; color: #000;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  break-after: page; page-break-after: always;
}
.ticket:last-child { break-after: auto; page-break-after: auto; }

.tk-entete { text-align: center; padding-bottom: 2mm; border-bottom: .4mm solid #000; }
.tk-marque { font-size: 15pt; font-weight: 700; letter-spacing: -.02em; }
.tk-coord { font-size: 7pt; line-height: 1.4; margin-top: .6mm; }

.tk-dest {
  background: #000; color: #fff; text-align: center; font-weight: 700;
  font-size: 13pt; letter-spacing: .2em; padding: 1.4mm 0; margin-top: 2mm;
}

.tk-numero { display: flex; justify-content: space-between; align-items: baseline; margin-top: 2.5mm; }
.tk-numero span { font-size: 7.5pt; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; }
.tk-numero b { font-size: 14pt; font-weight: 700; }
.tk-meta { font-size: 7pt; margin-top: .4mm; }

.tk-champ { display: flex; justify-content: space-between; align-items: baseline; gap: 2mm; border-bottom: .2mm dotted #000; padding: 1.2mm 0 .6mm; }
.tk-champ span { font-size: 7pt; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
.tk-champ b { font-size: 10pt; font-weight: 600; text-align: right; }

.tk-retrait { border: .6mm solid #000; margin-top: 2.5mm; padding: 1.6mm 2mm; text-align: center; }
.tk-retrait span { display: block; font-size: 7pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
.tk-retrait b { display: block; font-size: 13pt; font-weight: 700; line-height: 1.15; }
.tk-retrait i { display: block; font-style: normal; font-size: 13pt; font-weight: 700; }

.tk-titre { font-size: 7pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; border-bottom: .4mm solid #000; padding-bottom: .6mm; margin-top: 3mm; }
.tk-ligne { display: grid; grid-template-columns: 9mm 1fr 13mm; gap: 1mm; font-size: 9pt; padding: .8mm 0; align-items: baseline; border-bottom: .15mm dotted #999; }
.tk-ligne .q { font-weight: 700; }
.tk-ligne .n em { display: block; font-style: normal; font-size: 7.5pt; }
.tk-ligne .p { text-align: right; font-variant-numeric: tabular-nums; }

.tk-mention { border: .4mm solid #000; padding: 1.2mm 1.6mm; margin-top: 1.6mm; }
.tk-mention.discret { border-style: dashed; border-width: .25mm; }
.tk-mention span { display: block; font-size: 6.5pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.tk-mention b { display: block; font-size: 10pt; font-weight: 700; line-height: 1.2; }
.tk-mention i { display: block; font-style: normal; font-size: 8pt; line-height: 1.3; }

.tk-montants { border: .4mm solid #000; margin-top: 2.5mm; }
.tk-montants div { display: flex; justify-content: space-between; padding: 1mm 1.6mm; font-size: 8.5pt; border-bottom: .2mm solid #000; }
.tk-montants div:last-child { border-bottom: none; }
.tk-montants span { font-weight: 600; letter-spacing: .05em; text-transform: uppercase; }
.tk-montants b { font-size: 10pt; font-variant-numeric: tabular-nums; }
.tk-montants .total { background: #000; color: #fff; }

.tk-libre { border: .25mm dashed #000; margin-top: 2.5mm; height: 70mm; padding: 1.2mm; }
.tk-libre span { font-size: 6.5pt; letter-spacing: .12em; text-transform: uppercase; }

.tk-pied { text-align: center; font-size: 7.5pt; line-height: 1.5; margin-top: 3mm; padding-top: 2mm; border-top: .2mm dotted #000; }

@media screen {
  .rouleau { padding: 4mm 0; }
  .ticket { box-shadow: 0 2px 18px rgba(0,0,0,.2); }
}
@media print {
  .ecran-seulement, header, nav, footer { display: none !important; }
  html, body, main { margin: 0 !important; padding: 0 !important; max-width: none !important; background: #fff !important; }
  .rouleau { display: block; gap: 0; padding: 0; }
  .ticket { box-shadow: none; }
}
`;
