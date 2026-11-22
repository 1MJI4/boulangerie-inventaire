'use client';

// Photos de référence d'un article du stock (plusieurs angles). Toucher une
// vignette l'ouvre ici : on reconnaît l'article avant de compter. Le manager en
// ajoute (appareil photo de la tablette) et en retire ; la collection servira
// plus tard à entraîner une IA — d'où le conseil de varier les angles.

import { useState } from 'react';
import { Bouton } from '@/components/ui';
import { reduirePhoto } from '@/components/commande/reduirePhoto';

export type ArticlePhotos = { id: number; nom: string; photos: number[] };

export function PopupPhotos({
  article,
  peutPhotographier,
  onFermer,
  onChange,
}: {
  article: ArticlePhotos | null;
  peutPhotographier: boolean;
  onFermer: () => void;
  onChange: (articleId: number, photos: number[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  if (!article) return null;
  const photos = article.photos;
  const courant = Math.min(index, Math.max(0, photos.length - 1));

  async function ajouter(fichier: File | undefined) {
    if (!fichier || !article) return;
    setOccupe(true);
    setMessage(null);
    try {
      const reduite = await reduirePhoto(fichier);
      if (!reduite.ok) {
        setMessage(reduite.message);
        return;
      }
      const f = new FormData();
      f.append('articleId', String(article.id));
      f.append('image', reduite.donnees, 'photo.jpg');
      const r = await fetch('/api/stock/photos', { method: 'POST', body: f });
      const corps = (await r.json().catch(() => null)) as { id?: number; message?: string } | null;
      if (!r.ok || typeof corps?.id !== 'number') {
        setMessage(corps?.message ?? "La photo n'a pas pu être enregistrée. Réessayez.");
        return;
      }
      onChange(article.id, [...photos, corps.id]);
      setIndex(photos.length);
    } catch {
      setMessage("Pas de connexion : la photo n'a pas été enregistrée.");
    } finally {
      setOccupe(false);
    }
  }

  async function retirer() {
    if (!article || photos.length === 0) return;
    const id = photos[courant];
    setOccupe(true);
    setMessage(null);
    try {
      const r = await fetch(`/api/stock/photos/${id}`, { method: 'DELETE' });
      if (!r.ok) {
        setMessage("La photo n'a pas pu être retirée. Réessayez.");
        return;
      }
      onChange(
        article.id,
        photos.filter((p) => p !== id),
      );
      setIndex(0);
      setConfirmer(false);
    } catch {
      setMessage("Pas de connexion : la photo n'a pas été retirée.");
    } finally {
      setOccupe(false);
    }
  }

  const aller = (i: number) => {
    setIndex((i + photos.length) % photos.length);
    setConfirmer(false);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-voile sm:items-center" role="dialog" aria-modal="true" aria-label={`Photos : ${article.nom}`}>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-4 shadow-xl sm:rounded-3xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">{article.nom}</h2>
          <Bouton onClick={onFermer}>Fermer</Bouton>
        </div>

        {photos.length > 0 ? (
          <>
            <div className="overflow-hidden rounded-2xl bg-segment-fond">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={photos[courant]}
                src={`/api/stock/photos/${photos[courant]}`}
                alt={`${article.nom}, photo ${courant + 1}`}
                className="mx-auto max-h-[55dvh] w-full object-contain"
              />
            </div>
            {photos.length > 1 ? (
              <div className="mt-2 flex items-center justify-center gap-3">
                <Bouton onClick={() => aller(courant - 1)} aria-label="Photo précédente">
                  ‹
                </Bouton>
                <span className="chiffres text-sm text-ink-2">
                  {courant + 1} / {photos.length}
                </span>
                <Bouton onClick={() => aller(courant + 1)} aria-label="Photo suivante">
                  ›
                </Bouton>
              </div>
            ) : null}
          </>
        ) : (
          <p className="rounded-2xl bg-segment-fond p-6 text-center text-base text-ink-2">Pas encore de photo de cet article.</p>
        )}

        {peutPhotographier ? (
          <div className="mt-4 grid gap-2">
            <label
              className={`inline-flex min-h-12 cursor-pointer items-center justify-center rounded-2xl bg-accent px-4 text-base font-semibold text-accent-texte ${occupe ? 'opacity-60' : ''}`}
            >
              {occupe ? 'Envoi…' : photos.length === 0 ? 'Prendre une photo' : 'Ajouter un autre angle'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={occupe}
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  void ajouter(f);
                }}
              />
            </label>
            {photos.length > 0 ? (
              confirmer ? (
                <Bouton variante="danger" onClick={() => void retirer()} disabled={occupe}>
                  Confirmer : retirer cette photo
                </Bouton>
              ) : (
                <Bouton onClick={() => setConfirmer(true)} disabled={occupe}>
                  Retirer cette photo
                </Bouton>
              )
            ) : null}
            <p className="text-sm text-ink-2">Plusieurs angles aident à reconnaître l’article : face, côté, dessus, et sur l’étagère. 8 photos au plus.</p>
            {message ? <p className="text-sm text-alerte">{message}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
