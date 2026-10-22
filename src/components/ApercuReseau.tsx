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
  en_attente: 'en file',
  remis: 'en train d’imprimer',
  imprime: 'sorti',
};

/** Sans progrès pendant ce délai, on rend la main au vendeur pour relancer. */
const BLOQUE_APRES_MS = 45_000;

/** Petite imprimante dont le papier sort en boucle pendant l'impression. */
function ImprimanteAnimee({ active }: { active: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className={`imprimante-animee h-12 w-12 shrink-0 ${active ? 'active' : ''}`}>
      {/* Le papier est dessiné d'abord : caché derrière le corps, il sort par le bas. */}
      <g className="papier">
        <rect x="14" y="26" width="20" height="18" fill="#fff" stroke="currentColor" strokeWidth="2" />
        <path d="M18 35h12M18 39h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </g>
      <rect x="13" y="6" width="22" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <rect x="6" y="14" width="36" height="16" rx="3" fill="currentColor" />
      <circle cx="36" cy="20" r="1.8" fill="#fff" className="voyant" />
    </svg>
  );
}

function Rouet() {
  return (
    <span
      aria-hidden
      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
    />
  );
}

export function ApercuReseau({ commande, onImprime }: { commande: Commande; onImprime?: () => void }) {
  const conteneur = useRef<HTMLDivElement>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [travaux, setTravaux] = useState<Travail[]>([]);
  const [imprimante, setImprimante] = useState<EtatImprimante>(null);
  const [suivi, setSuivi] = useState(false);
  // Dernier moment où l'impression a avancé : sert à détecter un blocage.
  const [dernierProgres, setDernierProgres] = useState(0);
  const [, setHorloge] = useState(0);
  // Le bandeau « ✓ sortis » ne s'affiche qu'après une impression suivie ici,
  // pas pour une commande imprimée hier qu'on rouvre.
  const [vuEnDirect, setVuEnDirect] = useState(false);

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

  // À l'ouverture : si des tickets de cette commande sont encore en route
  // (envoyés depuis une autre tablette, ou page rechargée), on les suit.
  useEffect(() => {
    void rafraichir().then((liste) => {
      if (liste.some((t) => t.statut !== 'imprime')) {
        setDernierProgres(Date.now());
        setVuEnDirect(true);
        setSuivi(true);
      }
    });
  }, [rafraichir]);

  // Tant que tout n'est pas sorti, on regarde chaque seconde (un ticket sort
  // en quelques secondes : à 2 s l'écran paraissait en retard sur le papier).
  // Une fois terminé, on arrête : la tablette reste allumée toute la journée.
  useEffect(() => {
    if (!suivi) return;
    let avancementAvant = -1;
    const minuteur = setInterval(async () => {
      const liste = await rafraichir();
      // en file → en train d'imprimer → sorti : chaque pas compte comme un progrès.
      const avancement = liste.reduce((n, t) => n + (t.statut === 'imprime' ? 2 : t.statut === 'remis' ? 1 : 0), 0);
      if (avancement !== avancementAvant) {
        if (avancementAvant !== -1) setDernierProgres(Date.now());
        avancementAvant = avancement;
      }
      setHorloge(Date.now());
      if (liste.length && liste.every((t) => t.statut === 'imprime')) {
        setSuivi(false);
        onImprime?.();
      }
    }, 1000);
    return () => clearInterval(minuteur);
  }, [suivi, rafraichir, onImprime]);

  // Un double toucher rapide arrive avant que le bouton soit désactivé à l'écran.
  const envoiEnVol = useRef(false);

  const envoyer = async () => {
    const hote = conteneur.current;
    if (!hote || envoiEnVol.current) return;
    envoiEnVol.current = true;
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
      // Affichage immédiat des 4 tickets « en file », sans attendre le premier tour.
      setTravaux(
        DESTINATIONS.map((destination, index) => ({
          id: -1 - index,
          destination,
          statut: 'en_attente',
          erreur: null,
          imprimeLe: null,
        })),
      );
      setDernierProgres(Date.now());
      setVuEnDirect(true);
      setSuivi(true);
      void rafraichir();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Envoi impossible.');
    } finally {
      envoiEnVol.current = false;
      setEnvoi(false);
    }
  };

  const enLigne = imprimante ? Date.now() - Date.parse(imprimante.vueLe) < 45_000 : false;
  const probleme = imprimante && imprimante.statusCode && !/^200/.test(imprimante.statusCode);
  const tousSortis = travaux.length > 0 && travaux.every((t) => t.statut === 'imprime');
  const sortis = travaux.filter((t) => t.statut === 'imprime').length;
  const enCours = suivi && !tousSortis;
  // Bloqué : rien n'a bougé depuis un moment. On rend le bouton pour relancer.
  const bloque = enCours && dernierProgres > 0 && Date.now() - dernierProgres > BLOQUE_APRES_MS;
  const verrouille = envoi || (enCours && !bloque);

  return (
    <div className="ecran-seulement">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Bouton
          variante={tousSortis && !envoi ? 'secondaire' : 'principal'}
          disabled={verrouille}
          aria-busy={verrouille}
          className="min-h-14 px-6 text-base"
          onClick={() => void envoyer()}
        >
          {envoi ? (
            <>
              <Rouet /> Envoi en cours…
            </>
          ) : enCours && !bloque ? (
            <>
              <Rouet /> Impression en cours… {sortis}/{travaux.length}
            </>
          ) : bloque ? (
            'Relancer l’impression'
          ) : tousSortis ? (
            'Réimprimer'
          ) : (
            'Envoyer à l’imprimante'
          )}
        </Bouton>
        <Puce ton={enLigne ? 'ok' : 'attention'}>
          {imprimante
            ? enLigne
              ? 'Imprimante en ligne'
              : `Imprimante silencieuse depuis ${depuis(imprimante.vueLe)}`
            : 'Imprimante jamais vue'}
        </Puce>
      </div>

      {erreur ? <div className="mb-4"><Alerte>{erreur}</Alerte></div> : null}

      {travaux.length > 0 && vuEnDirect ? (
        <div
          role="status"
          aria-live="polite"
          className={`mb-4 max-w-md rounded-xl border p-4 ${tousSortis ? 'border-ok/40 bg-ok-doux' : 'border-accent/40 bg-accent-doux'}`}
        >
          <div className="flex items-center gap-3">
            <span className={tousSortis ? 'text-ok' : 'text-accent'}>
              <ImprimanteAnimee active={enCours && !bloque} />
            </span>
            <div>
              <p className="text-base font-semibold text-ink">
                {tousSortis
                  ? `✓ Les ${travaux.length} tickets sont sortis`
                  : bloque
                    ? 'L’impression n’avance plus'
                    : `Ça imprime — ${sortis} sur ${travaux.length} sortis`}
              </p>
              {!tousSortis && !bloque ? (
                <p className="mt-0.5 text-sm text-ink-2">Pas besoin de recliquer : les tickets sortent l’un après l’autre.</p>
              ) : null}
            </div>
          </div>
          {bloque ? (
            <p className="mt-0.5 text-sm text-ink-2">
              Vérifiez le papier et le capot de l’imprimante, puis touchez « Relancer l’impression ».
            </p>
          ) : null}
          <ul className="mt-3 space-y-1.5 text-sm">
            {travaux.map((travail) => (
              <li key={travail.id} className="flex items-center gap-2">
                <span aria-hidden className="w-5 text-center">
                  {travail.statut === 'imprime' ? '✓' : travail.statut === 'remis' ? '⟳' : '·'}
                </span>
                <span className="w-24 font-medium text-ink">{travail.destination}</span>
                <span className={travail.statut === 'imprime' ? 'text-ok' : 'text-ink-2'}>
                  {LIBELLE_STATUT[travail.statut] ?? travail.statut}
                  {travail.erreur ? ` (${travail.erreur})` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
        points. Le premier ticket sort en quelques secondes, les suivants s’enchaînent.
      </p>

      <div ref={conteneur} className="rouleau-apercu" />

      <style>{`
        .rouleau-apercu { display: flex; flex-direction: column; align-items: flex-start; gap: 18px; }
        .ticket-apercu { background: #fff; box-shadow: 0 2px 18px rgba(0,0,0,.25); image-rendering: auto; }
        .imprimante-animee .papier { transform: translateY(-8px); }
        .imprimante-animee .voyant { opacity: .4; }
        .imprimante-animee.active .papier { animation: papier-sort 1.6s ease-in-out infinite; }
        .imprimante-animee.active .voyant { animation: voyant 0.8s steps(2) infinite; }
        @keyframes papier-sort { 0% { transform: translateY(-14px); opacity: 1; } 70% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(3px); opacity: 0; } }
        @keyframes voyant { 0% { opacity: .2; } 100% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .imprimante-animee.active .papier, .imprimante-animee.active .voyant { animation: none; } }
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
