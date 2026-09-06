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
import type { Commande } from '@/lib/commandes';

type CommandeApi = Omit<Commande, 'retraitLe' | 'avertissements'> & {
  retraitLe: string;
  avertissements: string | null;
};

export default function ModifierCommande() {
  const params = useParams<{ id: string }>();
  const [commande, setCommande] = useState<Commande | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const reponse = await fetch(`/api/commandes?id=${params.id}`);
      const donnees: CommandeApi = await reponse.json();
      if (!reponse.ok) throw new Error('Commande introuvable.');
      setCommande({
        ...donnees,
        retraitLe: donnees.retraitLe.slice(0, 10),
        avertissements: donnees.avertissements ? JSON.parse(donnees.avertissements) : [],
      });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Commande introuvable.');
    }
  }, [params.id]);

  useEffect(() => {
    void charger();
  }, [charger]);

  if (erreur) return <Alerte>{erreur}</Alerte>;
  if (!commande) return <Chargement libelle="Ouverture de la commande…" />;

  if (commande.statut === 'annulee') {
    return (
      <Alerte>
        La commande {commande.numero} est annulée. Créez-en une nouvelle plutôt que de la rouvrir —
        son historique doit rester intact.
      </Alerte>
    );
  }

  return <FormulaireCommande commande={commande} />;
}
