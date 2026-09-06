'use client';

// src/components/CarteCommandes.tsx
//
// La pastille de l'accueil. C'est probablement le rappel le plus efficace du
// système : un « 2 » visible sans rien ouvrir se remarque, là où une liste au
// fond d'un écran ne se consulte jamais.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Carte, Puce } from '@/components/ui';
import { compterCeQuiReste, type Commande } from '@/lib/commandes';

type Resume = ReturnType<typeof compterCeQuiReste>;

export function CarteCommandes() {
  const [resume, setResume] = useState<Resume | null>(null);

  useEffect(() => {
    let vivant = true;
    fetch('/api/commandes?statut=en_cours')
      .then((r) => (r.ok ? r.json() : []))
      .then((donnees: (Commande & { retraitLe: string })[]) => {
        if (!vivant) return;
        setResume(
          compterCeQuiReste(
            donnees.map((c) => ({ ...c, retraitLe: c.retraitLe.slice(0, 10) }))
          )
        );
      })
      .catch(() => setResume(null));
    return () => {
      vivant = false;
    };
  }, []);

  return (
    <Link href="/commandes" className="mb-8 block">
      <Carte className="p-4 transition-colors hover:border-accent">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-medium text-ink">Commandes</h2>
            <p className="mt-1.5 text-sm text-ink-2 text-pretty">
              Prendre une commande, l’imprimer, la retrouver au retrait.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {resume === null ? null : resume.total === 0 && resume.virements === 0 ? (
              <span className="text-sm text-ink-3">Rien en attente</span>
            ) : (
              <>
                {resume.aImprimer > 0 ? (
                  <Puce ton="accent">
                    {resume.aImprimer} à imprimer
                  </Puce>
                ) : null}
                {resume.retraitsDuJour > 0 ? (
                  <Puce>{resume.retraitsDuJour} retrait{resume.retraitsDuJour > 1 ? 's' : ''} aujourd’hui</Puce>
                ) : null}
                {resume.virements > 0 ? (
                  <Puce ton="attention">
                    {resume.virements} virement{resume.virements > 1 ? 's' : ''} à vérifier
                  </Puce>
                ) : null}
              </>
            )}
          </div>
        </div>
      </Carte>
    </Link>
  );
}
