'use client';

// src/app/commandes/nouvelle/page.tsx
// Prise d'une commande au comptoir. Toute la mécanique vit dans
// FormulaireCommande, partagée avec l'écran de correction.

import { FormulaireCommande } from '@/components/FormulaireCommande';

export default function NouvelleCommande() {
  return <FormulaireCommande />;
}
