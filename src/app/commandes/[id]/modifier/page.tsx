'use client';

// src/app/commandes/[id]/modifier/page.tsx
//
// « Le vendeur crée et modifie librement » — sans cet écran, un client qui
// rappelle pour changer l'heure obligeait à annuler et à tout refaire.
// Rien n'est effacé : chaque changement s'ajoute à l'historique de la commande.

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Alerte, Chargement } from '@/components/ui';
import { FormulaireCommande } from '@/components/FormulaireCommande';
import { depuisApi, type Commande, type CommandeApi } from '@/lib/commandes';
import { RappelChargement } from '@/components/rappels';
import { echecReseau, lireReponse } from '@/components/commande/modele';

export default function ModifierCommande() {
  const params = useParams<{ id: string }>();
  const [commande, setCommande] = useState<Commande | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const r = await lireReponse<CommandeApi>(await fetch(`/api/commandes?id=${params.id}`));
      if (r.ok) setCommande(depuisApi(r.donnees));
      else setErreur(r.message);
    } catch {
      const e = echecReseau();
      if (!e.ok) setErreur(e.message);
    }
  }, [params.id]);

  useEffect(() => {
    let annule = false;
    (async () => {
      await Promise.resolve();
      if (!annule) await charger();
    })();
    return () => {
      annule = true;
    };
  }, [charger]);

  if (erreur) return <Alerte>{erreur}</Alerte>;
  if (!commande)
    return (
      <>
        <Chargement libelle="Ouverture de la commande…" />
        <RappelChargement />
      </>
    );

  if (commande.statut === 'annulee') {
    return (
      <Alerte ton="info">
        La commande n°&nbsp;{commande.numero} est annulée&nbsp;: elle ne se modifie plus. Créez-en une
        nouvelle, s’il vous plaît.
      </Alerte>
    );
  }

  return <FormulaireCommande commande={commande} />;
}
