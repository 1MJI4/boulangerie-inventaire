'use client';

// src/components/ApercuReseau.tsx
//
// L'aperçu et l'envoi vers l'imprimante réseau.
//
// Le point important : l'image affichée à l'écran est exactement celle qui
// part à l'imprimante. Pas une maquette HTML qui lui ressemble — le même
// canvas, le même fichier. Ce que le vendeur voit avant de cliquer est ce
// qu'il ira décrocher du rouleau.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alerte, Bouton, Puce } from '@/components/ui';
import { DESTINATIONS, dessinerTicket, type Destination } from '@/lib/ticketCanvas';
import { enBase64, pngMonochrome, zlibNavigateur } from '@/lib/pngMonochrome';
import type { Commande } from '@/lib/commandes';

type Travail = {
  id: number;
  destination: string;
  statut: string;
  erreur: string | null;
  imprimeLe: string | null;
};

type EtatImprimante = { statusCode: string; vueLe: string } | null;

const LIBELLE_STATUT: Record<string, string> = {
  en_attente: 'en attente',
  remis: 'en cours',
  imprime: 'sorti',
};

export function ApercuReseau({ commande, onImprime }: { commande: Commande; onImprime?: () => void }) {
  const conteneur = useRef<HTMLDivElement>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [travaux, setTravaux] = useState<Travail[]>([]);
  const [imprimante, setImprimante] = useState<EtatImprimante>(null);
  const [suivi, setSuivi] = useState(false);

  // Le dessin se fait une fois, à l'affichage. Les canvas sont insérés tels
  // quels dans la page : aucune conversion, donc aucune occasion de diverger.
  useEffect(() => {
    const hote = conteneur.current;
    if (!hote) return;
    hote.replaceChildren();
    for (const destination of DESTINATIONS) {
      const canvas = dessinerTicket(destination, commande);
      canvas.className = 'ticket-apercu';
      // 80 mm à l'écran, quelle que soit la densité de l'écran.
      canvas.style.width = '302px';
      canvas.style.height = 'auto';
      hote.appendChild(canvas);
    }
  }, [commande]);

  const rafraichir = useCallback(async () => {
    try {
      const reponse = await fetch(`/api/impression?commandeId=${commande.id}`, { cache: 'no-store' });
      const donnees = await reponse.json();
      setImprimante(donnees.imprimante ?? null);
      setTravaux(Array.isArray(donnees.travaux) ? donnees.travaux : []);
      return Array.isArray(donnees.travaux) ? (donnees.travaux as Travail[]) : [];
    } catch {
      return [];
    }
  }, [commande.id]);

  useEffect(() => {
    void rafraichir();
  }, [rafraichir]);

  // Tant que tout n'est pas sorti, on regarde. Une fois terminé, on arrête :
  // inutile de faire tourner une requête toutes les deux secondes sur une
  // tablette qui reste allumée toute la journée.
  useEffect(() => {
    if (!suivi) return;
    const minuteur = setInterval(async () => {
      const liste = await rafraichir();
      if (liste.length && liste.every((t) => t.statut === 'imprime')) {
        setSuivi(false);
        onImprime?.();
      }
    }, 2000);
    return () => clearInterval(minuteur);
  }, [suivi, rafraichir, onImprime]);

  const envoyer = async () => {
    const hote = conteneur.current;
    if (!hote) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const canvases = Array.from(hote.querySelectorAll('canvas'));
      // PNG noir et blanc 1 bit, pas toDataURL (couleur 32 bits) : décodé,
      // un long ticket en couleur dépasse la mémoire de l'imprimante
      // (« 511 Media Decoding Error », voir src/lib/pngMonochrome.ts).
      const tickets = await Promise.all(
        canvases.map(async (canvas, index) => {
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Ticket illisible : rechargez la page.');
          const points = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          const png = await pngMonochrome(points, canvas.width, canvas.height, zlibNavigateur);
          return { destination: DESTINATIONS[index] as Destination, png: enBase64(png) };
        }),
      );
      const reponse = await fetch('/api/impression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandeId: commande.id, numero: commande.numero, tickets }),
      });
      if (!reponse.ok) {
        const donnees = await reponse.json().catch(() => ({}));
        throw new Error(donnees.erreur ?? 'Envoi refusé.');
      }
      setSuivi(true);
      await rafraichir();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Envoi impossible.');
    } finally {
      setEnvoi(false);
    }
  };

  const enLigne = imprimante ? Date.now() - Date.parse(imprimante.vueLe) < 45_000 : false;
  const probleme = imprimante && imprimante.statusCode && !/^200/.test(imprimante.statusCode);
  const tousSortis = travaux.length > 0 && travaux.every((t) => t.statut === 'imprime');

  return (
    <div className="ecran-seulement">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Bouton variante="principal" onClick={() => void envoyer()}>
          {envoi ? 'Envoi…' : 'Envoyer à l’imprimante'}
        </Bouton>
        <Puce ton={enLigne ? 'ok' : 'attention'}>
          {imprimante
            ? enLigne
              ? 'Imprimante en ligne'
              : `Imprimante silencieuse depuis ${depuis(imprimante.vueLe)}`
            : 'Imprimante jamais vue'}
        </Puce>
        {travaux.length ? (
          <Puce ton={tousSortis ? 'ok' : 'accent'}>
            {travaux.filter((t) => t.statut === 'imprime').length}/{travaux.length} exemplaires sortis
          </Puce>
        ) : null}
      </div>

      {erreur ? <div className="mb-4"><Alerte>{erreur}</Alerte></div> : null}

      {probleme ? (
        <div className="mb-4">
          <Alerte>
            L’imprimante signale un problème (code {imprimante?.statusCode}). Le plus souvent :
            plus de papier, ou le capot est resté ouvert. Les tickets restent en file et sortiront
            tout seuls une fois le rouleau remis.
          </Alerte>
        </div>
      ) : null}

      {!imprimante ? (
        <div className="mb-4">
          <Alerte>
            L’imprimante ne s’est encore jamais manifestée. Vérifiez qu’elle est allumée, sur le
            réseau, et que l’URL CloudPRNT est bien renseignée dans ses réglages.
          </Alerte>
        </div>
      ) : null}

      <p className="mb-4 max-w-prose text-sm text-ink-2">
        Ce que vous voyez ci-dessous est l’image exacte envoyée à l’imprimante — même largeur, mêmes
        points. L’imprimante vient chercher son travail toutes les dix secondes&nbsp;: le ticket sort
        peu après le clic, pas à la seconde.
      </p>

      <div ref={conteneur} className="rouleau-apercu" />

      {travaux.length ? (
        <ul className="mt-4 space-y-1 text-sm text-ink-2">
          {travaux.map((travail) => (
            <li key={travail.id}>
              {travail.destination} — {LIBELLE_STATUT[travail.statut] ?? travail.statut}
              {travail.erreur ? ` (${travail.erreur})` : ''}
            </li>
          ))}
        </ul>
      ) : null}

      <style>{`
        .rouleau-apercu { display: flex; flex-direction: column; align-items: flex-start; gap: 18px; }
        .ticket-apercu { background: #fff; box-shadow: 0 2px 18px rgba(0,0,0,.25); image-rendering: auto; }
      `}</style>
    </div>
  );
}

function depuis(iso: string): string {
  const secondes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (secondes < 120) return `${secondes} s`;
  const minutes = Math.round(secondes / 60);
  if (minutes < 120) return `${minutes} min`;
  return `${Math.round(minutes / 60)} h`;
}
