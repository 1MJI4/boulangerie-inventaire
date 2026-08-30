// src/lib/rappelsService.ts
//
// Rappels affichés au vendeur en fin de comptage.
// Cette liste est faite pour être modifiée : ajoute, retire ou reformule
// librement, l'écran s'adapte tout seul.

export type GroupeRappels = {
  titre: string;
  /** Court, à l'impératif, une action par ligne. */
  points: string[];
};

export const RAPPELS_FIN_DE_SERVICE: GroupeRappels[] = [
  {
    titre: 'Hygiène',
    points: [
      'Se laver les mains à chaque retour dans le magasin',
      'Se relaver les mains après avoir manipulé de l’argent ou des poubelles',
      'Changer de gants entre le salé et la pâtisserie',
      'Nettoyer le plan de travail et le comptoir',
    ],
  },
  {
    titre: 'Machine à café',
    points: [
      'Vider et rincer le bac à marc',
      'Lancer le cycle de nettoyage',
      'Nettoyer la buse vapeur et le pichet à lait',
      'Essuyer la grille et le bac d’égouttage',
    ],
  },
  {
    titre: 'Frigo et vitrine',
    points: [
      'Relever la température du frigo',
      'Sortir les produits périmés et noter les pertes',
      'Avancer les produits les plus anciens devant',
      'Filmer ou couvrir ce qui reste',
    ],
  },
  {
    titre: 'Réassort du poste',
    points: [
      'Refaire les boîtes',
      'Réapprovisionner les sachets et les sacs',
      'Recharger les serviettes, couverts et touillettes',
      'Vérifier le rouleau de la caisse',
    ],
  },
  {
    titre: 'Fermeture',
    points: [
      'Sortir les poubelles',
      'Balayer et passer la serpillière',
      'Éteindre les vitrines chauffantes et le four',
      'Fermer la caisse et verrouiller',
    ],
  },
];
