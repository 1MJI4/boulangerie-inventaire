'use client';

// src/app/brouillons/page.tsx
//
// Brouillons de commande WhatsApp (propriétaire, 21/11/2026) — écran du profil Manager.
// Un brouillon attend le paiement : 5 minutes pour un retrait le jour même, 1 heure sinon.
// Passé le délai il reste ici, dans « Expirés », et se relance en un geste. Le paiement
// confirmé, il devient une vraie commande (bon imprimé, prévisions). Aucune règle ici :
// délais, état et message viennent du domaine, les contrôles du serveur.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alerte, Bouton, Carte, Chargement, Entete, EtatVide, LienBouton } from '@/components/ui';
import { Segmente } from '@/components/fiche/ElementsCommande';
import { lireReponse, echecReseau } from '@/components/commande/modele';
import { formaterEuros } from '@/domaine/argent';
import { formaterCompteARebours, secondesRestantes } from '@/domaine/brouillons';
import { formatDateLong } from '@/lib/dateProduction';
import { useEquipe } from '@/lib/vendeurs';
import type { BrouillonVue } from '@/lib/serveur/brouillons';
import type { Echec } from '@/domaine/resultat';

type Onglet = 'attente' | 'expires' | 'traites';

const LIBELLE_ONGLET: Record<Onglet, string> = {
  attente: 'En attente',
  expires: 'Expirés',
  traites: 'Traités',
};

export default function Brouillons() {
  const router = useRouter();
  const { equipe, prete } = useEquipe();
  const [liste, setListe] = useState<BrouillonVue[] | null>(null);
  const [decalage, setDecalage] = useState(0); // heure du serveur − heure de la tablette
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [onglet, setOnglet] = useState<Onglet>('attente');
  const [refus, setRefus] = useState<Echec | null>(null);
  const [occupe, setOccupe] = useState<number | null>(null);
  const [par, setPar] = useState('');
  const [copie, setCopie] = useState<number | null>(null);

  const charger = useCallback(async () => {
    try {
      const r = await lireReponse<{ maintenant: string; brouillons: BrouillonVue[] }>(
        await fetch('/api/brouillons', { cache: 'no-store' }),
      );
      if (!r.ok) {
        setRefus(r);
        setListe((avant) => avant ?? []);
        return;
      }
      setDecalage(new Date(r.donnees.maintenant).getTime() - Date.now());
      setListe(r.donnees.brouillons);
      setRefus(null);
    } catch {
      const e = echecReseau();
      if (!e.ok) setRefus(e);
      setListe((avant) => avant ?? []);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(charger);
    const rafraichir = setInterval(() => {
      if (document.visibilityState === 'visible') void charger();
    }, 15_000);
    const seconde = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => {
      clearInterval(rafraichir);
      clearInterval(seconde);
    };
  }, [charger]);

  const heureServeur = new Date(maintenant + decalage);
  // « Expiré » dès que le compte à rebours tombe à zéro, sans attendre le prochain rafraîchissement.
  const etatLocal = (b: BrouillonVue) =>
    b.etat === 'en_attente' && secondesRestantes(new Date(b.echeanceLe), heureServeur) === 0 ? 'expire' : b.etat;

  const parOnglet = useMemo(() => {
    const t: Record<Onglet, BrouillonVue[]> = { attente: [], expires: [], traites: [] };
    for (const b of liste ?? []) {
      const e = etatLocal(b);
      if (e === 'en_attente') t.attente.push(b);
      else if (e === 'expire') t.expires.push(b);
      else t.traites.push(b);
    }
    t.attente.sort((a, b) => a.echeanceLe.localeCompare(b.echeanceLe));
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- etatLocal dépend de l'heure (maintenant)
  }, [liste, maintenant, decalage]);

  const agir = async (b: BrouillonVue, action: 'relancer' | 'abandonner' | 'confirmer') => {
    if (action === 'confirmer' && !par) {
      setRefus({
        ok: false,
        niveau: 'bloquant',
        code: 'ERR_CHAMP_OBLIGATOIRE',
        message: 'Touchez votre prénom (« Qui confirme ? ») avant de confirmer le paiement.',
        champ: 'par',
      } as Echec);
      return;
    }
    setOccupe(b.id);
    setRefus(null);
    try {
      const r = await lireReponse<{ commande?: { id: number; numero: string } }>(
        await fetch('/api/brouillons', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: b.id, action, par }),
        }),
      );
      if (!r.ok) {
        setRefus(r);
        return;
      }
      await charger();
      if (action === 'confirmer') setOnglet('traites');
    } catch {
      const e = echecReseau();
      if (!e.ok) setRefus(e);
    } finally {
      setOccupe(null);
    }
  };

  const copier = async (b: BrouillonVue) => {
    if (!b.message) return;
    try {
      await navigator.clipboard.writeText(b.message);
      setCopie(b.id);
      setTimeout(() => setCopie((c) => (c === b.id ? null : c)), 2500);
    } catch {
      /* presse-papiers refusé : le message reste lisible dans « Voir le message » */
    }
  };

  const sansCompte = (liste ?? []).some((b) => b.message === null);
  const visibles = parOnglet[onglet];

  return (
    <>
      <Entete
        titre="Brouillons WhatsApp"
        sousTitre="Commandes en attente du paiement. Elles ne comptent pour rien avant la confirmation."
        actions={
          <LienBouton href="/brouillons/nouveau" variante="principal">
            Nouveau brouillon
          </LienBouton>
        }
      />

      {refus ? <Alerte>{refus.message}</Alerte> : null}
      {sansCompte ? (
        <Alerte ton="attention">
          Le numéro de compte n’est pas encore réglé sur le serveur : les messages ne peuvent pas être préparés. Prévenez la
          personne qui s’occupe de l’application.
        </Alerte>
      ) : null}

      <div className="mb-3">
        <Segmente<Onglet>
          libelle="Catégorie de brouillons"
          valeur={onglet}
          onChange={setOnglet}
          options={(Object.keys(LIBELLE_ONGLET) as Onglet[]).map((o) => ({
            valeur: o,
            libelle: LIBELLE_ONGLET[o],
            nombre: parOnglet[o].length,
          }))}
        />
      </div>

      {onglet !== 'traites' && visibles.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-ink">Qui confirme ?</span>
          {prete && equipe.length > 0 ? (
            equipe.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={par === n}
                onClick={() => setPar(par === n ? '' : n)}
                className={`min-h-11 rounded-xl border-2 px-3 text-sm font-medium ${
                  par === n ? 'border-transparent bg-accent-doux text-accent' : 'border-transparent bg-segment-fond text-ink'
                }`}
              >
                {n}
              </button>
            ))
          ) : null}
          <input
            value={equipe.includes(par) ? '' : par}
            onChange={(e) => setPar(e.target.value)}
            placeholder="Votre prénom"
            aria-label="Votre prénom"
            className="min-h-11 w-40 rounded-xl border-2 border-transparent bg-segment-fond px-3 text-sm text-ink placeholder:text-ink-3"
          />
        </div>
      ) : null}

      {liste === null ? (
        <Chargement libelle="Chargement des brouillons…" />
      ) : visibles.length === 0 ? (
        <Carte>
          <EtatVide
            titre={
              onglet === 'attente'
                ? 'Aucun brouillon en attente'
                : onglet === 'expires'
                  ? 'Aucun brouillon expiré'
                  : 'Aucun brouillon traité ces derniers jours'
            }
            detail={
              onglet === 'attente'
                ? 'Créez un brouillon quand une commande arrive par WhatsApp : le message de paiement est prêt à envoyer.'
                : undefined
            }
          />
        </Carte>
      ) : (
        <ul className="grid gap-3">
          {visibles.map((b) => {
            const etat = etatLocal(b);
            const reste = secondesRestantes(new Date(b.echeanceLe), heureServeur);
            return (
              <li key={b.id}>
                <Carte className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-ink">
                        {b.client} <span className="chiffres text-sm font-normal text-ink-2">· {b.reference}</span>
                      </p>
                      <p className="text-sm text-ink-2">
                        Retrait <span className="first-letter:uppercase">{formatDateLong(b.retraitLe)}</span>
                        {b.retraitHeure ? ` à ${b.retraitHeure.replace(':', 'h')}` : ''} · {b.langue === 'en' ? 'English' : 'Français'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="chiffres text-xl font-bold text-ink">{formaterEuros(b.totalCentimes)}</p>
                      {etat === 'en_attente' ? (
                        <p className={`chiffres text-sm font-semibold ${reste <= 60 ? 'text-alerte' : 'text-attention'}`}>
                          {formaterCompteARebours(reste)}
                        </p>
                      ) : etat === 'expire' ? (
                        <p className="text-sm font-semibold text-alerte">Délai dépassé</p>
                      ) : etat === 'confirme' ? (
                        <p className="text-sm font-semibold text-ok">Payé · commande créée</p>
                      ) : (
                        <p className="text-sm text-ink-2">Écarté</p>
                      )}
                    </div>
                  </div>

                  {etat === 'en_attente' || etat === 'expire' ? (
                    <>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {b.lienWhatsApp ? (
                          <a
                            href={b.lienWhatsApp}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 items-center rounded-2xl bg-segment-fond px-4 text-[15px] font-semibold text-ink"
                          >
                            Envoyer sur WhatsApp
                          </a>
                        ) : null}
                        <Bouton variante="secondaire" disabled={!b.message} onClick={() => void copier(b)}>
                          {copie === b.id ? 'Message copié' : 'Copier le message'}
                        </Bouton>
                        <Bouton variante="principal" disabled={occupe === b.id} onClick={() => void agir(b, 'confirmer')}>
                          Paiement reçu
                        </Bouton>
                        {etat === 'expire' ? (
                          <Bouton variante="secondaire" disabled={occupe === b.id} onClick={() => void agir(b, 'relancer')}>
                            Relancer le délai
                          </Bouton>
                        ) : null}
                        <Bouton variante="danger" disabled={occupe === b.id} onClick={() => void agir(b, 'abandonner')}>
                          Écarter
                        </Bouton>
                      </div>
                      {b.message ? (
                        <details className="mt-2">
                          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-accent">Voir le message</summary>
                          <pre className="whitespace-pre-wrap rounded-xl bg-segment-fond p-3 text-sm text-ink">{b.message}</pre>
                        </details>
                      ) : null}
                    </>
                  ) : etat === 'confirme' && b.commandeId ? (
                    <div className="mt-3">
                      <Bouton variante="secondaire" onClick={() => router.push(`/commandes?q=${encodeURIComponent(b.client)}`)}>
                        Voir dans les commandes
                      </Bouton>
                    </div>
                  ) : null}
                </Carte>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
