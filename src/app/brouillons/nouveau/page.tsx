'use client';

// src/app/brouillons/nouveau/page.tsx
// Brouillon d'une commande reçue par WhatsApp (profil Manager). Même fiche qu'une commande :
// les contrôles sont ceux du serveur ; à la fin, « Créer le brouillon » au lieu de « Valider ».

import { FormulaireCommande } from '@/components/FormulaireCommande';

export default function NouveauBrouillon() {
  return <FormulaireCommande brouillon />;
}
