'use client';

// src/app/commandes/reglages/page.tsx
//
// Réglages des commandes, réservés au gérant (code gérant, POST /api/gestion).
// Depuis le lot 2, AUCUN prix ne se règle ici : prix, minimums et formats
// viennent du catalogue de commande, mis à jour par l'import du tarif (agent
// `catalogue-prix`). Restent :
//   - les mots proposés au vendeur (parfums, garnitures, décorations) ;
//   - les produits signalés au comptoir comme absents du tarif, à faire
//     ajouter au prochain import puis à « ranger ».
// Le message du serveur est affiché tel quel (jamais « Code incorrect » en dur),
// et le code est redemandé dès que l'accès gérant a expiré (403).

import { useCallback, useEffect, useState } from 'react';
import { Bouton, Carte, Chargement, Entete, Puce } from '@/components/ui';
import { ListeSignalements } from '@/components/signalement';
import { RappelChargement } from '@/components/rappels';
import { AccesGerant } from '@/components/commande/AccesGerant';
import { echecReseau, lireReponse } from '@/components/commande/modele';
import { formaterEuros } from '@/domaine/argent';
import type { Echec } from '@/domaine/resultat';
import type { GenreOption, OptionGateau, OptionsGateau } from '@/lib/gateaux';

type ProduitSignale = { id: number; nom: string; prixCentimes: number };

const CHAMP = 'min-h-12 rounded-xl border-2 border-line-fort bg-surface px-3 text-base text-ink placeholder:text-ink-3';

export default function ReglagesCommandes() {
  const [acces, setAcces] = useState<'inconnu' | 'ferme' | 'ouvert'>('inconnu');
  const [refus, setRefus] = useState<Echec | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [options, setOptions] = useState<OptionsGateau | null>(null);
  const [signales, setSignales] = useState<ProduitSignale[]>([]);

  const charger = useCallback(async () => {
    try {
      const [o, t] = await Promise.all([
        lireReponse<OptionsGateau>(await fetch('/api/gateaux?inclureInactifs=1')),
        lireReponse<ProduitSignale[]>(await fetch('/api/tarifs?aRanger=1')),
      ]);
      if (o.ok) setOptions(o.donnees);
      else setRefus(o);
      if (t.ok) setSignales(Array.isArray(t.donnees) ? t.donnees : []);
      else setRefus(t);
    } catch {
      const e = echecReseau();
      if (!e.ok) setRefus(e);
    }
  }, []);

  // L'accès gérant est-il déjà ouvert sur cette tablette ?
  useEffect(() => {
    let annule = false;
    fetch('/api/calendrier')
      .then((r) => lireReponse<{ gerant: boolean }>(r))
      .then((r) => {
        if (annule) return;
        setAcces(r.ok && r.donnees.gerant ? 'ouvert' : 'ferme');
      })
      .catch(() => {
        if (!annule) setAcces('ferme');
      });
    return () => {
      annule = true;
    };
  }, []);

  useEffect(() => {
    if (acces !== 'ouvert') return;
    let annule = false;
    (async () => {
      await Promise.resolve();
      if (!annule) await charger();
    })();
    return () => {
      annule = true;
    };
  }, [acces, charger]);

  const envoyer = async (url: string, methode: 'POST' | 'PATCH', corps: Record<string, unknown>) => {
    try {
      const r = await lireReponse(
        await fetch(url, { method: methode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }),
      );
      if (!r.ok) {
        setRefus(r);
        // Accès gérant expiré : on redemande le code au lieu de laisser l'écran muet.
        if (r.code === 'ERR_DROIT_INSUFFISANT' || r.code === 'ERR_SESSION_EXPIREE') setAcces('ferme');
        return false;
      }
      setRefus(null);
      setMessage('Enregistré');
      setTimeout(() => setMessage(null), 2500);
      await charger();
      return true;
    } catch {
      const e = echecReseau();
      if (!e.ok) setRefus(e);
      return false;
    }
  };

  const refusAffiche = refus ? (
    <ListeSignalements
      className="mb-4"
      signalements={[refus]}
      autreSortiePour={() => (
        <Bouton onClick={() => setRefus(null)}>{acces === 'ferme' ? 'Ressaisir le code' : 'Fermer'}</Bouton>
      )}
    />
  ) : null;

  if (acces === 'inconnu') {
    return (
      <>
        <Chargement />
        <RappelChargement />
      </>
    );
  }

  if (acces === 'ferme') {
    return (
      <>
        <Entete titre="Réglages des commandes" sousTitre="Réservé au gérant." />
        {refusAffiche}
        <div className="max-w-xl">
          <AccesGerant
            raison="Saisissez le code gérant pour ouvrir les réglages."
            onAccorde={() => {
              setRefus(null);
              setAcces('ouvert');
            }}
            onAnnuler={() => history.back()}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Entete
        titre="Réglages des commandes"
        sousTitre="Les prix, minimums et formats viennent du tarif importé : ils ne se changent pas ici."
        actions={message ? <Puce ton="ok">{message}</Puce> : undefined}
      />
      {refusAffiche}

      {options === null ? (
        <>
          <Chargement />
          <RappelChargement />
        </>
      ) : (
        <div className="grid gap-6">
          <ListeOptions titre="Parfums" detail="Proposés pour décrire un gâteau sur commande." genre="parfum" liste={options.parfums} envoyer={envoyer} />
          <ListeOptions titre="Garnitures" detail="Proposées pour le salé sur commande." genre="garniture" liste={options.garnitures} envoyer={envoyer} />
          <ListeOptions titre="Décorations" detail="Mots seulement : un supplément payant passe par le tarif." genre="decoration" liste={options.decorations} envoyer={envoyer} />

          <section>
            <h2 className="text-base font-semibold text-ink">Produits signalés au comptoir</h2>
            <p className="mb-2 mt-0.5 text-sm text-ink-2">
              Demandes absentes du tarif, retenues par un vendeur. Faites-les ajouter au prochain import du tarif, puis
              rangez-les. Le prix indiqué est une proposition, jamais appliqué à une commande.
            </p>
            <Carte className="grid gap-1 p-3">
              {signales.length === 0 ? (
                <p className="text-base text-ink-2">Rien à ranger.</p>
              ) : (
                signales.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 border-b border-line py-2 last:border-b-0">
                    <span className="min-w-0 flex-1 text-base text-ink">{p.nom}</span>
                    <span className="chiffres text-base text-ink-2">{formaterEuros(p.prixCentimes)}</span>
                    <Bouton onClick={() => void envoyer('/api/tarifs', 'PATCH', { id: p.id })}>Ranger</Bouton>
                  </div>
                ))
              )}
            </Carte>
          </section>
        </div>
      )}
    </>
  );
}

function ListeOptions({
  titre,
  detail,
  genre,
  liste,
  envoyer,
}: {
  titre: string;
  detail: string;
  genre: GenreOption;
  liste: OptionGateau[];
  envoyer: (url: string, methode: 'POST' | 'PATCH', corps: Record<string, unknown>) => Promise<boolean>;
}) {
  const [nom, setNom] = useState('');
  return (
    <section>
      <h2 className="text-base font-semibold text-ink">{titre}</h2>
      <p className="mb-2 mt-0.5 text-sm text-ink-2">{detail}</p>
      <Carte className="p-3">
        <div className="flex flex-wrap gap-1.5">
          {liste.map((o) => (
            <button
              key={o.id}
              type="button"
              title="Retirer ou remettre"
              onClick={() => void envoyer('/api/gateaux', 'PATCH', { id: o.id, actif: o.actif === false })}
              className={`min-h-11 rounded-full border px-3 text-sm ${
                o.actif === false ? 'border-line bg-surface text-ink-3 line-through' : 'border-line-fort bg-surface text-ink'
              }`}
            >
              {o.nom}
            </button>
          ))}
        </div>
        <form
          className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!nom.trim()) return;
            if (await envoyer('/api/gateaux', 'POST', { type: genre, nom: nom.trim() })) setNom('');
          }}
        >
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ajouter…" className={`${CHAMP} min-w-0 flex-1`} />
          <Bouton type="submit">Ajouter</Bouton>
        </form>
      </Carte>
    </section>
  );
}
