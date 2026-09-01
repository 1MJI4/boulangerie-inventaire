'use client';

import { useState } from 'react';
import type { Parcours } from '@/lib/parcours';

/**
 * L'application observe en silence l'ordre dans lequel le vendeur compte.
 * Ce panneau lui permet de garder ce trajet, de le nommer, et d'en faire
 * l'ordre d'affichage par défaut. Rien n'est imposé : tant qu'il n'enregistre
 * rien, l'ordre de la feuille reste en place.
 */
export function GestionParcours({
  ordreEnCours,
  parcours,
  idParDefaut,
  nombreProduits,
  onEnregistrer,
  onRemplacer,
  onSupprimer,
  onDefinirParDefaut,
  onReinitialiserOrdre,
  onAppliquer,
}: {
  ordreEnCours: number[];
  parcours: Parcours[];
  idParDefaut: string | null;
  nombreProduits: number;
  onEnregistrer: (nom: string) => void;
  onRemplacer: (id: string) => void;
  onSupprimer: (id: string) => void;
  onDefinirParDefaut: (id: string | null) => void;
  onReinitialiserOrdre: () => void;
  onAppliquer: (id: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState('');

  const enregistrable = ordreEnCours.length >= 3;

  const valider = () => {
    if (!enregistrable) return;
    onEnregistrer(nom);
    setNom('');
  };

  return (
    <section className="sans-impression mt-4 rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="text-sm font-medium text-ink">Mon parcours dans le magasin</span>
          <span className="ml-2 text-xs text-ink-3">
            {ordreEnCours.length > 0
              ? `${ordreEnCours.length} produit${ordreEnCours.length > 1 ? 's' : ''} dans l’ordre où vous les avez comptés`
              : 'commencez à compter, l’ordre s’enregistre tout seul'}
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-ink-3">
          {ouvert ? '▴' : '▾'}
        </span>
      </button>

      {ouvert ? (
        <div className="space-y-5 border-t border-line px-4 py-4">
          {/* ------------------------------------------- Trajet du jour */}
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-3">
              Trajet d’aujourd’hui
            </h3>

            {ordreEnCours.length === 0 ? (
              <p className="text-sm text-ink-2 text-pretty">
                Comptez quelques produits : l’ordre que vous suivez est retenu automatiquement, et
                vous pourrez l’enregistrer ici.
              </p>
            ) : (
              <>
                <p className="mb-3 text-sm text-ink-2 text-pretty">
                  <span className="chiffres font-medium text-ink">{ordreEnCours.length}</span> produit
                  {ordreEnCours.length > 1 ? 's' : ''} sur {nombreProduits} comptés.{' '}
                  {enregistrable
                    ? 'Enregistrez ce trajet pour le retrouver demain.'
                    : 'Encore un ou deux produits avant de pouvoir l’enregistrer.'}
                </p>

                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && valider()}
                    placeholder="Nom du parcours (ex. tour du matin)"
                    aria-label="Nom du parcours"
                    className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={valider}
                    disabled={!enregistrable}
                    className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-fort disabled:bg-ink-3 disabled:opacity-60"
                  >
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    onClick={onReinitialiserOrdre}
                    className="inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-sm text-ink-2 hover:bg-surface-2"
                  >
                    Repartir de zéro
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ------------------------------------- Parcours enregistrés */}
          {parcours.length > 0 ? (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-3">
                Parcours enregistrés
              </h3>

              <ul className="space-y-2">
                {parcours.map((p) => {
                  const parDefaut = p.id === idParDefaut;
                  return (
                    <li
                      key={p.id}
                      className={`rounded-lg border p-3 ${
                        parDefaut ? 'border-accent bg-accent-doux/40' : 'border-line'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-ink">{p.nom}</div>
                          <div className="chiffres text-xs text-ink-3">
                            {p.produitIds.length} produits ·{' '}
                            {new Date(p.creeLe).toLocaleDateString('fr-BE', {
                              day: 'numeric',
                              month: 'short',
                            })}
                            {parDefaut ? ' · utilisé par défaut' : ''}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onAppliquer(p.id)}
                            className="min-h-9 rounded-lg border border-line px-2.5 text-xs font-medium text-ink-2 hover:border-line-fort hover:text-ink"
                          >
                            Utiliser
                          </button>
                          <button
                            type="button"
                            onClick={() => onDefinirParDefaut(parDefaut ? null : p.id)}
                            className={`min-h-9 rounded-lg border px-2.5 text-xs font-medium ${
                              parDefaut
                                ? 'border-accent bg-accent text-white'
                                : 'border-line text-ink-2 hover:border-line-fort hover:text-ink'
                            }`}
                          >
                            {parDefaut ? 'Par défaut' : 'Par défaut'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemplacer(p.id)}
                            disabled={!enregistrable}
                            title="Remplacer par le trajet d’aujourd’hui"
                            className="min-h-9 rounded-lg border border-line px-2.5 text-xs text-ink-2 hover:border-line-fort hover:text-ink disabled:opacity-40"
                          >
                            Mettre à jour
                          </button>
                          <button
                            type="button"
                            onClick={() => onSupprimer(p.id)}
                            aria-label={`Supprimer ${p.nom}`}
                            className="min-h-9 rounded-lg border border-line px-2.5 text-xs text-ink-3 hover:border-alerte hover:text-alerte"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-3 text-xs text-ink-3 text-pretty">
                Un produit absent du parcours reste affiché, à la fin, dans l’ordre de la feuille.
                Les parcours sont propres à cet appareil.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
