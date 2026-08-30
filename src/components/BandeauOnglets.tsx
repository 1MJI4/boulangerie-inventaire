'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Bande d'onglets défilante.
 *
 * `overflow-x: auto` seul ne suffit pas : au doigt la bande s'arrête n'importe
 * où, à la souris elle ne bouge pas du tout, et rien n'indique qu'il reste des
 * onglets hors écran. On ajoute donc le glissé au pointeur, un calage sur
 * l'onglet le plus proche, un dégradé sur les bords encore parcourables, et le
 * recentrage automatique de l'onglet actif.
 */
export function BandeauOnglets({
  children,
  ariaLabel,
  fond = 'ground',
}: {
  children: React.ReactNode;
  ariaLabel: string;
  /** Couleur derrière la bande, pour que le dégradé des bords se fonde dedans. */
  fond?: 'ground' | 'surface';
}) {
  const degradeGauche = fond === 'surface' ? 'from-surface' : 'from-ground';
  const degradeDroite = fond === 'surface' ? 'from-surface' : 'from-ground';
  const piste = useRef<HTMLDivElement>(null);
  const [debordeGauche, setDebordeGauche] = useState(false);
  const [debordeDroite, setDebordeDroite] = useState(false);

  const mesurer = useCallback(() => {
    const el = piste.current;
    if (!el) return;
    setDebordeGauche(el.scrollLeft > 4);
    setDebordeDroite(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = piste.current;
    if (!el) return;

    mesurer();
    el.addEventListener('scroll', mesurer, { passive: true });

    const observateur = new ResizeObserver(mesurer);
    observateur.observe(el);

    return () => {
      el.removeEventListener('scroll', mesurer);
      observateur.disconnect();
    };
  }, [mesurer]);

  // Recentre l'onglet actif : sans cela, revenir sur une zone lointaine oblige
  // à faire défiler à la main pour la retrouver.
  useEffect(() => {
    const actif = piste.current?.querySelector('[data-actif="true"]');
    actif?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  });

  /* --------------------------------------------- Glissé au pointeur (souris) */

  const glisse = useRef<{ actif: boolean; departX: number; departScroll: number; bouge: boolean }>({
    actif: false,
    departX: 0,
    departScroll: 0,
    bouge: false,
  });

  const auPointerDown = (e: React.PointerEvent) => {
    // Le tactile a déjà son propre défilement, natif et plus fluide.
    if (e.pointerType === 'touch' || !piste.current) return;
    glisse.current = {
      actif: true,
      departX: e.clientX,
      departScroll: piste.current.scrollLeft,
      bouge: false,
    };
  };

  const auPointerMove = (e: React.PointerEvent) => {
    if (!glisse.current.actif || !piste.current) return;
    const delta = e.clientX - glisse.current.departX;
    if (Math.abs(delta) > 3) glisse.current.bouge = true;
    piste.current.scrollLeft = glisse.current.departScroll - delta;
  };

  const finGlisse = () => {
    glisse.current.actif = false;
  };

  // Un glissé ne doit pas déclencher l'onglet survolé au relâchement.
  const auClicCapture = (e: React.MouseEvent) => {
    if (glisse.current.bouge) {
      e.preventDefault();
      e.stopPropagation();
      glisse.current.bouge = false;
    }
  };

  return (
    <div className="sans-impression relative">
      {debordeGauche ? (
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r ${degradeGauche} to-transparent`}
        />
      ) : null}
      {debordeDroite ? (
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l ${degradeDroite} to-transparent`}
        />
      ) : null}

      <div
        ref={piste}
        role="tablist"
        aria-label={ariaLabel}
        onPointerDown={auPointerDown}
        onPointerMove={auPointerMove}
        onPointerUp={finGlisse}
        onPointerLeave={finGlisse}
        onPointerCancel={finGlisse}
        onClickCapture={auClicCapture}
        className="flex snap-x snap-proximity gap-1.5 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: 'touch', cursor: 'grab' }}
      >
        {children}
      </div>
    </div>
  );
}

/** Un onglet de la bande : zone du magasin, ou page de la liste. */
export function Onglet({
  libelle,
  detail,
  actif,
  etat,
  onClick,
}: {
  libelle: string;
  detail?: string;
  actif: boolean;
  etat: 'vide' | 'partiel' | 'complet';
  onClick: () => void;
}) {
  const couleurPoint = {
    vide: 'bg-line-fort',
    partiel: 'bg-attention',
    complet: 'bg-ok',
  }[etat];

  return (
    <button
      type="button"
      role="tab"
      onClick={onClick}
      data-actif={actif}
      aria-selected={actif}
      className={`flex min-h-10 shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-sm transition-colors ${
        actif
          ? 'border-accent bg-accent-doux font-medium text-accent'
          : 'border-line bg-surface text-ink-2 hover:border-line-fort hover:text-ink'
      }`}
    >
      {libelle}
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${couleurPoint}`} />
      {detail ? <span className="chiffres text-xs opacity-70">{detail}</span> : null}
    </button>
  );
}
