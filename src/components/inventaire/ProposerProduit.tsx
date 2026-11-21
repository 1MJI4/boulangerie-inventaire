'use client';

// src/components/inventaire/ProposerProduit.tsx
//
// Comptage du soir (propriétaire, 21/11/2026) : « un produit qui n'est pas dans la liste ? ». Le vendeur le
// propose (nom + ce qu'il en reste) ; le manager reçoit une notification et décide : l'ajouter à la liste,
// le rattacher à un produit déjà listé, ou en faire une exception. Rien n'entre dans l'inventaire avant sa
// décision. Aucune règle ici : le serveur contrôle (nom lisible, déjà dans la liste, déjà proposé).

import { useState } from 'react';
import { Bouton } from '@/components/ui';
import { useEquipe } from '@/lib/vendeurs';

export function ProposerProduit({ className = '', court = false }: { className?: string; /** Libellé réduit (barre du comptage plein écran). */ court?: boolean }) {
  const { equipe, prete } = useEquipe();
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState('');
  const [reste, setReste] = useState('');
  const [par, setPar] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const fermer = () => {
    setOuvert(false);
    setMessage(null);
  };

  const envoyer = async () => {
    setOccupe(true);
    setMessage(null);
    try {
      const r = await fetch('/api/produits-proposes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom, quantite: reste.trim() === '' ? null : Number(reste), par }),
      });
      const corps = (await r.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!r.ok) {
        setMessage(corps?.message ?? 'La proposition n’a pas pu partir. Réessayez dans un instant.');
        return;
      }
      setEnvoye(nom.trim());
      setTimeout(() => setEnvoye(null), 6000);
      setNom('');
      setReste('');
      setOuvert(false);
    } catch {
      setMessage('Pas de réseau : la proposition n’a pas pu partir. Réessayez dans un instant.');
    } finally {
      setOccupe(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setEnvoye(null);
          setOuvert(true);
        }}
        className={`sans-impression inline-flex min-h-11 items-center rounded-2xl bg-segment-fond px-3 text-xs font-medium text-ink ${className}`}
      >
        {court ? '＋ Hors liste' : 'Produit pas dans la liste ?'}
      </button>
      {envoye ? (
        <p role="status" className="sans-impression fixed inset-x-3 bottom-24 z-50 rounded-2xl bg-surface p-3 text-sm font-medium text-ok shadow-lg">
          « {envoye} » envoyé au manager.
        </p>
      ) : null}

      {ouvert ? (
        <div role="dialog" aria-modal="true" aria-label="Proposer un produit au manager" className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-4 shadow-xl sm:max-w-md sm:rounded-3xl">
            <h2 className="text-lg font-semibold text-ink">Un produit qui n’est pas dans la liste</h2>
            <p className="mb-3 text-sm text-ink-2">
              Écrivez son nom et ce qu’il en reste. Le manager décidera de l’ajouter à la liste, ou si c’était une exception.
            </p>

            <label className="mb-3 block">
              <span className="mb-1 block text-sm text-ink-2">Nom du produit</span>
              <input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                autoComplete="off"
                maxLength={80}
                className="min-h-12 w-full rounded-2xl border-2 border-transparent bg-segment-fond px-3 text-lg text-ink"
              />
            </label>
            <label className="mb-3 block">
              <span className="mb-1 block text-sm text-ink-2">Combien en reste-t-il ? (facultatif)</span>
              <input
                value={reste}
                onChange={(e) => setReste(e.target.value.replace(/\D/g, '').slice(0, 5))}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="—"
                className="min-h-12 w-32 rounded-2xl border-2 border-transparent bg-segment-fond px-3 text-center text-lg text-ink"
              />
            </label>

            <div className="mb-3">
              <span className="mb-1 block text-sm text-ink-2">Qui propose ?</span>
              <div className="flex flex-wrap items-center gap-2">
                {prete
                  ? equipe.map((n) => (
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
                  : null}
                <input
                  value={equipe.includes(par) ? '' : par}
                  onChange={(e) => setPar(e.target.value)}
                  placeholder="Votre prénom"
                  aria-label="Votre prénom"
                  className="min-h-11 w-40 rounded-xl border-2 border-transparent bg-segment-fond px-3 text-sm text-ink placeholder:text-ink-3"
                />
              </div>
            </div>

            {message ? <p role="alert" className="mb-3 text-sm font-medium text-bloquant">{message}</p> : null}

            <div className="flex gap-2">
              <Bouton variante="secondaire" className="min-h-12 flex-1" onClick={fermer}>
                Annuler
              </Bouton>
              <Bouton variante="principal" className="min-h-12 flex-1" disabled={occupe || nom.trim().length < 2 || !par.trim()} onClick={() => void envoyer()}>
                Envoyer au manager
              </Bouton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
