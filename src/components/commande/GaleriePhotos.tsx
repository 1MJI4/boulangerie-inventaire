'use client';

// src/components/commande/GaleriePhotos.tsx
//
// Galerie plein écran des photos de modèles (décision du propriétaire,
// 26/10/2026 ; propriétaire : `commandes-traiteur`). Le client montre une
// photo, la vendeuse la touche : `onChoisir` ajoute le produit au bon.
//
// Tablette, mains occupées, réseau faible :
// - montée SEULEMENT quand la galerie est ouverte : aucune image chargée avant ;
// - un rayon à la fois (le premier par défaut), images en `loading="lazy"` :
//   seules les vignettes à l'écran se téléchargent ;
// - rayons en gros boutons en haut (152 photos : il faut un filtre — c'est la
//   seule exception aux « pas d'onglets catégorie », limitée à la galerie) ;
// - fermeture d'un geste : « Fermer » (grand bouton), ou la touche Échap.
// Aucun prix ici : les photos sont une donnée du catalogue (photosModeles.ts).

import { useEffect, useState } from 'react';
import { categoriesPhotosModeles, PHOTOS_MODELES, type PhotoModele } from '@/catalogue/photosModeles';

export function GaleriePhotos({ onChoisir, onFermer }: { onChoisir: (p: PhotoModele) => void; onFermer: () => void }) {
  const rayons = categoriesPhotosModeles();
  const [rayon, setRayon] = useState<string>(rayons[0] ?? '');
  const photos = PHOTOS_MODELES.filter((p) => p.categorie === rayon);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
    };
    window.addEventListener('keydown', touche);
    // La page derrière ne défile pas pendant que la galerie est ouverte.
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', touche);
      document.body.style.overflow = avant;
    };
  }, [onFermer]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="galerie-photos-titre"
      className="fixed inset-0 z-50 flex flex-col bg-surface"
    >
      <div className="flex flex-none items-center gap-3 border-b border-line px-3 pb-2 pt-3">
        <h2 id="galerie-photos-titre" className="min-w-0 flex-1 text-xl font-bold text-ink">
          Photos des modèles
          <span className="ml-2 text-base font-normal text-ink-2">Touchez la photo que montre le client</span>
        </h2>
        <button
          type="button"
          onClick={onFermer}
          className="min-h-14 shrink-0 rounded-xl border-2 border-line-fort bg-surface px-6 text-lg font-semibold text-ink"
        >
          ✕ Fermer
        </button>
      </div>

      <div role="group" aria-label="Rayons" className="flex flex-none flex-wrap gap-2 border-b border-line px-3 py-2">
        {rayons.map((r) => {
          const actif = r === rayon;
          return (
            <button
              key={r}
              type="button"
              aria-pressed={actif}
              onClick={() => setRayon(r)}
              className={`min-h-12 rounded-xl border-2 px-4 text-base font-semibold ${
                actif ? 'border-accent bg-accent text-white shadow' : 'border-line-fort bg-surface text-ink'
              }`}
            >
              {r}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onChoisir(p)}
                aria-label={`Photo ${p.id}${p.note ? ` — ${p.note}` : ''}`}
                className="block w-full overflow-hidden rounded-xl border-2 border-line bg-surface-2 text-left active:scale-[0.98] active:border-accent"
              >
                {/* Images déjà allégées (640 px) : servies telles quelles, sans passage par l'optimiseur. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.fichier}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full object-cover"
                />
                <span className="flex items-baseline gap-2 px-2 py-1.5">
                  <span className="chiffres shrink-0 text-xs text-ink-2">{p.id}</span>
                  {p.note ? <span className="min-w-0 text-sm leading-tight text-ink">{p.note}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
