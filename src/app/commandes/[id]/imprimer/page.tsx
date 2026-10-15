'use client';

// src/app/commandes/[id]/imprimer/page.tsx
//
// Le bon actuel est un quart d'A4, soit de l'A6 : 105 × 148 mm. Les quatre
// exemplaires nécessaires tiennent donc exactement sur une feuille — une
// commande = une feuille, imprimée en quatre, coupée en deux fois.
//
// Tout est en noir et blanc pur : rendu identique sur n'importe quelle laser
// monochrome, pas de gris baveux, pas de cartouche couleur à acheter.

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Alerte, Bouton, Chargement, Entete, Puce } from '@/components/ui';
import { useEquipe } from '@/lib/vendeurs';
import { useMemoireLocale } from '@/lib/memoireLocale';
import { CSS_TICKET, Ticket, reglesPagesTicket } from '@/components/TicketCommande';
import { ApercuReseau } from '@/components/ApercuReseau';
import {
  formaterEuros,
  messageConfirmation,
  type Commande,
  type ModePaiement,
} from '@/lib/commandes';

/** Les quatre destinations, dans l'ordre où elles sortent de l'imprimante. */
const DESTINATIONS = ['CLIENT', 'BUREAU', 'MAGASIN', 'ATELIER'] as const;
type Destination = (typeof DESTINATIONS)[number];

type CommandeApi = Omit<Commande, 'retraitLe' | 'avertissements'> & {
  retraitLe: string;
  avertissements: string | null;
};

export default function ImprimerCommande() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { vendeur } = useEquipe();
  const [commande, setCommande] = useState<Commande | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const [deborde, setDeborde] = useState(false);
  // Les longueurs de page du rouleau, mesurées après affichage.
  const [pagesTicket, setPagesTicket] = useState('');
  // Le format vit sur l'appareil : la tablette du comptoir imprime en ticket,
  // un poste de secours peut rester en A6 sans qu'on touche au code.
  const [format, setFormat, formatPret] = useMemoireLocale<'a6' | 'ticket' | 'reseau'>(
    'boulangerie:format-bon',
    'a6'
  );

  const charger = useCallback(async () => {
    try {
      const reponse = await fetch(`/api/commandes?id=${params.id}`);
      const donnees: CommandeApi = await reponse.json();
      if (!reponse.ok) throw new Error('Commande introuvable.');
      setCommande({
        ...donnees,
        retraitLe: donnees.retraitLe.slice(0, 10),
        avertissements: donnees.avertissements ? JSON.parse(donnees.avertissements) : [],
      });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Commande introuvable.');
    }
  }, [params.id]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Le bon fait 148 mm : au-delà d'un certain nombre de lignes, le pied sort
  // de la feuille et l'imprimante coupe. On le mesure plutôt que de l'estimer,
  // parce que la hauteur dépend des mentions présentes.
  useEffect(() => {
    // Sur rouleau, rien ne peut déborder : le papier s'allonge.
    if (!commande || format !== 'a6') {
      setDeborde(false);
      return;
    }
    const mesurer = () => {
      const bon = document.querySelector('.bon');
      const pied = bon?.querySelector('.bon-pied');
      if (!bon || !pied) return;
      const trop = pied.getBoundingClientRect().bottom > bon.getBoundingClientRect().bottom + 1;
      setDeborde(trop);
    };
    const minuteur = setTimeout(mesurer, 120);
    window.addEventListener('resize', mesurer);
    return () => {
      clearTimeout(minuteur);
      window.removeEventListener('resize', mesurer);
    };
  }, [commande, format]);

  // Sur rouleau, chaque exemplaire doit sortir à sa propre longueur : celui du
  // client n'a pas de zone de dessin et fait 90 mm de moins que celui de
  // l'atelier. On mesure, puis on donne à chaque ticket sa page nommée.
  useEffect(() => {
    if (!commande || format !== 'ticket') {
      setPagesTicket('');
      return;
    }
    const mesurer = () => {
      const tickets = Array.from(document.querySelectorAll<HTMLElement>('.ticket'));
      if (!tickets.length) return;
      // 1 mm = 96/25.4 px CSS, quel que soit le zoom de l'aperçu.
      const parMm = 96 / 25.4;
      const hauteurs = tickets.map((t) => t.getBoundingClientRect().height / parMm);
      setPagesTicket(reglesPagesTicket(hauteurs));
    };
    const minuteur = setTimeout(mesurer, 150);
    window.addEventListener('resize', mesurer);
    return () => {
      clearTimeout(minuteur);
      window.removeEventListener('resize', mesurer);
    };
  }, [commande, format]);

  const imprimer = async () => {
    // Le statut passe à « imprimée » : c'est ce qui éteint le rappel du soir.
    // Rien d'autre à cocher — sortir le feuillet suffit.
    await fetch('/api/commandes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: Number(params.id), action: 'impression', auteur: vendeur ?? 'comptoir' }),
    }).catch(() => {});
    window.print();
    void charger();
  };

  const copierConfirmation = async () => {
    if (!commande) return;
    const texte = messageConfirmation({
      numero: commande.numero,
      lignes: commande.lignes,
      retraitLe: commande.retraitLe,
      retraitHeure: commande.retraitHeure,
      totalCentimes: commande.totalCentimes,
      acompteCentimes: commande.acompteCentimes,
      texteGateau: commande.texteGateau,
      modePaiement: commande.modePaiement as ModePaiement,
    });
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      setTimeout(() => setCopie(false), 3000);
    } catch {
      setErreur('Copie impossible : sélectionnez le texte à la main.');
    }
  };

  if (erreur && !commande) return <Alerte>{erreur}</Alerte>;
  if (!commande) return <Chargement libelle="Préparation du bon…" />;

  return (
    <>
      <style>{format === 'a6' ? CSS_IMPRESSION : CSS_TICKET}</style>
      {format === 'ticket' && pagesTicket ? <style>{pagesTicket}</style> : null}

      <div className="ecran-seulement">
        <Entete
          titre={`Bon n° ${commande.numero}`}
          sousTitre={
            format === 'reseau'
              ? 'Envoyé directement à l’imprimante Star. Rien à faire sur la tablette.'
              : format === 'ticket'
                ? 'Quatre tickets 80 mm à la suite. L’imprimante coupe entre chaque.'
                : 'Quatre exemplaires A6 sur une feuille A4. Deux coups de massicot.'
          }
          actions={
            <>
              <Bouton onClick={() => router.push('/commandes')}>Retour</Bouton>
              <Bouton onClick={() => router.push(`/commandes/${params.id}/modifier`)}>
                Modifier
              </Bouton>
              {format === 'reseau' ? null : (
                <Bouton variante="principal" onClick={() => void imprimer()}>
                  Imprimer
                </Bouton>
              )}
            </>
          }
        />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-ink-3">Format</span>
          <Bouton
            variante={format === 'a6' ? 'principal' : 'secondaire'}
            onClick={() => setFormat('a6')}
          >
            A4 découpé en 4
          </Bouton>
          <Bouton
            variante={format === 'ticket' ? 'principal' : 'secondaire'}
            onClick={() => setFormat('ticket')}
          >
            Ticket 80 mm
          </Bouton>
          <Bouton
            variante={format === 'reseau' ? 'principal' : 'secondaire'}
            onClick={() => setFormat('reseau')}
          >
            Imprimante Star (réseau)
          </Bouton>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Puce ton={commande.statut === 'a_imprimer' ? 'accent' : 'ok'}>
            {commande.statut === 'a_imprimer' ? 'Pas encore imprimée' : 'Imprimée'}
          </Puce>
          {commande.modePaiement === 'virement' && !commande.acompteRecuLe ? (
            <Puce ton="attention">Virement à vérifier</Puce>
          ) : null}
          <Bouton onClick={() => void copierConfirmation()}>
            {copie ? 'Copié — collez dans WhatsApp' : 'Copier la confirmation'}
          </Bouton>
        </div>

        {erreur ? <div className="mb-4"><Alerte>{erreur}</Alerte></div> : null}

        {deborde ? (
          <div className="mb-4">
            <Alerte>
              Ce bon ne tient pas sur un A6 : les dernières lignes seront coupées à l’impression.
              Regroupez des lignes, ou faites deux commandes — n’imprimez pas tel quel.
            </Alerte>
          </div>
        ) : null}

        {format === 'ticket' ? (
          <p className="mb-4 max-w-prose text-sm text-ink-2">
            Pour essayer sans imprimante à tickets&nbsp;: imprimez sur votre A4 habituelle, la
            bande de 80 mm sortira sur le bord de la feuille et vous jugerez la lisibilité. Sur une
            vraie imprimante de caisse, réglez le format papier sur « rouleau
            80&nbsp;mm » et les marges sur « aucune ». L’application donne à chaque exemplaire sa
            longueur exacte, l’imprimante coupe juste après le dernier trait.
          </p>
        ) : null}

        <p className="mb-4 max-w-prose text-sm text-ink-2">
          Le message de confirmation ne contient pas vos coordonnées bancaires — ajoutez-les
          vous-même dans WhatsApp. Le numéro <span className="chiffres">{commande.numero}</span> y
          figure comme communication du virement, c’est ce qui permet de le rapprocher de la bonne
          commande.
        </p>
      </div>

      {!formatPret ? null : format === 'reseau' ? (
        <ApercuReseau commande={commande} onImprime={() => void charger()} />
      ) : format === 'ticket' ? (
        <div className="rouleau">
          {DESTINATIONS.map((destination, rang) => (
            <Ticket
              key={destination}
              rang={rang}
              destination={destination}
              commande={commande}
            />
          ))}
        </div>
      ) : (
        <div className="apercu">
          <div className="feuille">
            {DESTINATIONS.map((destination) => (
              <Bon key={destination} destination={destination} commande={commande} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* --------------------------------------------------------------- Un bon A6 */

function Bon({ destination, commande }: { destination: Destination; commande: Commande }) {
  const pourLeClient = destination === 'CLIENT';
  const nombreLignes = commande.lignes.length;
  const densite = nombreLignes > 16 ? ' tres-dense' : nombreLignes > 10 ? ' dense' : '';
  const reste = commande.totalCentimes - commande.acompteCentimes;

  return (
    <div className={`bon${densite}`}>
      <div className="bon-bandeau">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="PAin PAtisserie" />
        <div className="bon-coord">
          +32 472 25 05 78
          <br />
          PAINPATISSERIE
        </div>
      </div>
      <div className="bon-dest">{destination}</div>
      <div className="bon-adresse">Chaussée de Louvain 906 — 1140 Evere</div>

      <div className="bon-id">
        <div>
          <small>Commande n°</small>
          <b>{commande.numero}</b>
        </div>
        <div className="bon-prise">
          Prise le {formaterDate(commande.priseLe)}
          {!pourLeClient && commande.vendeur ? (
            <>
              <br />
              Vendeur : {commande.vendeur}
            </>
          ) : null}
        </div>
      </div>

      <div className="bon-grille2">
        <div className="bon-champ">
          <span>Nom</span>
          <b>{commande.client}</b>
        </div>
        <div className="bon-champ">
          <span>Téléphone</span>
          <b>{commande.telephone}</b>
        </div>
      </div>

      <div className="bon-retrait">
        <span>Pour le</span>
        <b>{formaterDateCourte(commande.retraitLe)}</b>
        <span>à</span>
        <b className="chiffres">{commande.retraitHeure}</b>
      </div>

      <div className="bon-produits">
        <div className="bon-soustitre">Produits commandés</div>
        {commande.lignes.map((ligne, index) => (
          <div className="bon-ligne" key={index}>
            <span>{ligne.quantite} ×</span>
            <span>
              {ligne.libelle}
              {ligne.precision ? ` — ${ligne.precision}` : ''}
            </span>
            <span>{(ligne.quantite * ligne.prixCentimes / 100).toFixed(2).replace('.', ',')}</span>
          </div>
        ))}
        <div className="bon-libre">{pourLeClient ? null : 'Zone libre — dessin, précisions'}</div>
      </div>

      {commande.texteGateau ? (
        <div className="bon-mention">
          <span>Sur le gâteau</span>
          <b>{commande.texteGateau}</b>
        </div>
      ) : commande.sansEcriture && !pourLeClient ? (
        <div className="bon-mention pointille">
          <span>Écriture</span>
          <em>Aucune — demandé au client</em>
        </div>
      ) : null}

      {commande.gateauComplexe ? (
        <div className="bon-mention">
          <span>Complexe</span>
          <b>À CONFIRMER — PRIX ET FAISABILITÉ</b>
        </div>
      ) : null}

      {commande.photoImprimee ? (
        <div className="bon-mention">
          <span>Photo</span>
          <b>À IMPRIMER SUR LE GÂTEAU</b>
        </div>
      ) : null}

      {commande.photoWhatsapp && !pourLeClient ? (
        <div className="bon-mention pointille">
          <span>Modèle</span>
          <em>Photo d’exemple envoyée sur WhatsApp — à réclamer au manager</em>
        </div>
      ) : null}

      <div className="bon-pied">
        <div className="bon-remarques">
          <span>{pourLeClient ? 'À présenter au retrait' : 'Remarques'}</span>
          <i>{!pourLeClient && commande.remarques ? commande.remarques : ''}</i>
          <hr />
          {pourLeClient ? null : <hr />}
        </div>
        <div className="bon-montants">
          <div className="total">
            <span>Total</span>
            <b>{formaterEuros(commande.totalCentimes)}</b>
          </div>
          <div>
            <span>Acompte</span>
            <b>{formaterEuros(commande.acompteCentimes)}</b>
          </div>
          <div>
            <span>Restant</span>
            <b>{formaterEuros(Math.max(0, reste))}</b>
          </div>
        </div>
      </div>

      {pourLeClient ? (
        <div className="bon-merci">
          Merci de votre confiance — une question ? +32 472 25 05 78
          {commande.modePaiement === 'virement' ? (
            <>
              <br />
              Communication du virement : {commande.numero}
            </>
          ) : null}
        </div>
      ) : null}
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

const CSS_IMPRESSION = `
@page { size: A4 portrait; margin: 0; }

.feuille {
  width: 210mm; height: 297mm; background: #fff; color: #000; margin: 0 auto;
  display: grid; grid-template-columns: 105mm 105mm; grid-template-rows: 148.5mm 148.5mm;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  box-shadow: 0 2px 24px rgba(0,0,0,.18);
}
.bon {
  width: 105mm; height: 148.5mm; padding: 4.5mm 5mm 4mm;
  display: flex; flex-direction: column; overflow: hidden; box-sizing: border-box;
  border-right: .2mm dashed #bbb; border-bottom: .2mm dashed #bbb; color: #000;
}
.bon:nth-child(2n) { border-right: none; }
.bon:nth-child(n+3) { border-bottom: none; }

.bon-bandeau { background:#000; color:#fff; display:flex; align-items:center; justify-content:space-between; padding:1.6mm 2.4mm; gap:2mm; }
.bon-bandeau img { height:7.4mm; width:auto; filter: brightness(0) invert(1); }
.bon-coord { font-size:5.4pt; line-height:1.35; text-align:right; }
.bon-dest { background:#000; color:#fff; font-weight:700; font-size:10pt; letter-spacing:.18em; padding:1.1mm 0; text-align:center; margin-top:.6mm; }
.bon-adresse { font-size:5.6pt; text-align:center; padding-top:.9mm; color:#333; }

.bon-id { display:flex; justify-content:space-between; align-items:flex-end; gap:2mm; margin-top:2mm; }
.bon-id small { display:block; font-size:5.4pt; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:#555; }
.bon-id b { font-size:11pt; font-weight:700; letter-spacing:-.01em; }
.bon-prise { font-size:6pt; color:#444; text-align:right; line-height:1.5; }

.bon-grille2 { display:grid; grid-template-columns:1fr 1fr; gap:0 3mm; margin-top:1.8mm; }
.bon-champ { border-bottom:.25mm solid #000; padding-bottom:.5mm; }
.bon-champ span { display:block; font-size:5.4pt; font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:#555; }
.bon-champ b { display:block; font-size:8.5pt; font-weight:500; min-height:3.6mm; }

.bon-retrait { border:.5mm solid #000; margin-top:1.6mm; padding:1.4mm 2mm; display:flex; justify-content:space-between; align-items:baseline; gap:2mm; }
.bon-retrait span { font-size:5.6pt; font-weight:700; letter-spacing:.14em; text-transform:uppercase; }
.bon-retrait b { font-size:11pt; font-weight:700; }

/* Sans « min-height:auto », le bloc produits se laissait écraser et rognait
   les dernières lignes sans que rien ne le montre. C'est la zone libre qui
   doit céder la place, jamais un produit commandé. */
.bon-produits { flex:1 1 auto; display:flex; flex-direction:column; margin-top:2mm; }
.bon-soustitre { font-size:5.4pt; font-weight:700; letter-spacing:.14em; text-transform:uppercase; border-bottom:.25mm solid #000; padding-bottom:.5mm; margin-bottom:1mm; }
.bon-ligne { display:grid; grid-template-columns:9mm 1fr 13mm; gap:1mm; font-size:8pt; padding:.35mm 0; align-items:baseline; }
.bon-ligne span:first-child { font-weight:700; }
.bon-ligne span:last-child { text-align:right; }
.bon-libre { flex:1 1 auto; min-height:0; font-size:5.2pt; color:#999; letter-spacing:.1em; text-transform:uppercase; padding-top:1mm; }

.bon-mention { display:flex; gap:2mm; align-items:baseline; margin-top:1mm; border:.25mm solid #000; padding:1mm 1.6mm; }
.bon-mention.pointille { border-style:dashed; }
.bon-mention span { font-size:5.4pt; font-weight:700; letter-spacing:.1em; text-transform:uppercase; white-space:nowrap; }
.bon-mention b { font-size:8pt; font-weight:700; }
.bon-mention em { font-size:7pt; font-style:normal; }

.bon-pied { display:grid; grid-template-columns:1fr 34mm; gap:2.5mm; margin-top:1.6mm; align-items:end; }
.bon-remarques span { font-size:5.4pt; font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:#555; }
.bon-remarques i { display:block; font-style:normal; font-size:7pt; min-height:3mm; }
.bon-remarques hr { border:none; border-bottom:.2mm solid #999; margin:2.6mm 0 0; }
.bon-montants { border:.25mm solid #000; }
.bon-montants div { display:flex; justify-content:space-between; padding:.7mm 1.4mm; font-size:6.6pt; border-bottom:.2mm solid #000; }
.bon-montants div:last-child { border-bottom:none; }
.bon-montants span { font-weight:600; letter-spacing:.06em; text-transform:uppercase; }
.bon-montants b { font-size:7.6pt; }
.bon-montants .total { background:#000; color:#fff; }

.bon-merci { font-size:5.6pt; text-align:center; margin-top:1.4mm; color:#333; }

/* Au-delà d'une dizaine de lignes, le bon se resserre plutôt que de déborder. */
.bon.dense .bon-ligne { font-size:7pt; padding:.1mm 0; }
.bon.dense .bon-champ b { font-size:7.5pt; min-height:3mm; }
.bon.dense .bon-retrait { padding:1mm 2mm; }
.bon.dense .bon-retrait b { font-size:10pt; }
.bon.tres-dense .bon-ligne { font-size:6pt; padding:0; line-height:1.25; }
.bon.tres-dense .bon-champ b { font-size:7pt; min-height:2.6mm; }
.bon.tres-dense .bon-mention { padding:.6mm 1.4mm; }
.bon.tres-dense .bon-mention b { font-size:7pt; }
.bon.tres-dense .bon-retrait { padding:.8mm 2mm; }
.bon.tres-dense .bon-retrait b { font-size:9.5pt; }

@media print {
  .ecran-seulement, header, nav, footer { display: none !important; }
  body { background: #fff !important; }
  /* Sans ça, le gabarit de l'application décale la feuille et l'imprimante
     sort une seconde page vide. */
  html, body, main { margin: 0 !important; padding: 0 !important; max-width: none !important; }
  .apercu { overflow: visible !important; }
  .feuille { box-shadow: none; margin: 0; zoom: 1 !important; }
  .bon { border-color: #ddd; }
}

/* L'aperçu à l'écran : la feuille fait 210 mm de large, on la réduit pour
   qu'elle tienne au lieu d'être coupée. */
@media screen {
  .apercu { overflow-x: auto; overscroll-behavior-x: contain; }
}
@media screen and (max-width: 1100px) { .feuille { zoom: 0.62; } }
@media screen and (max-width: 700px) { .feuille { zoom: 0.42; } }
`;
