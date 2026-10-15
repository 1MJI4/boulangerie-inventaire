// src/components/saisie/mecanique.ts
//
// Mécanique de FRAPPE des pavés de l'application : quelle chaîne produit une
// touche. Fonctions pures. AUCUNE règle métier ici : ce qu'un texte VAUT
// (grammes, pièces, centimes) et s'il est acceptable est décidé par le domaine
// (`lirePoids`, `lirePieces`, `lireMontant`, `validerQuantite`,
// `validerTelephone`), passé en paramètre `lisible`.
//
// Propriétaire : design-ux.

/** Le pavé écrit toujours la virgule française. */
export const VIRGULE = ',';

/** Vrai si le domaine sait lire ce texte (ex. `t => lirePoids(t).ok`). */
export type Lisible = (texte: string) => boolean;

/**
 * Texte à transmettre au domaine. « 1, » est un état de frappe (la virgule
 * vient d'être tapée) : on le lit comme « 1 ». Adaptation du PAVÉ, pas de la règle.
 */
export function texteALire(texte: string): string {
  return texte.endsWith(VIRGULE) ? texte.slice(0, -1) : texte;
}

export type OptionsTouche = {
  /** true = pavé avec virgule (kg, euros). */
  virgule: boolean;
  /** Garde-fou de frappe sur la partie entière (ergonomie, pas une règle). */
  chiffresEntiersMax: number;
  /** Le domaine sait-il lire le résultat ? Sinon la touche est ignorée. */
  lisible: Lisible;
};

/**
 * Applique une touche ('0'…'9', ',' ou '.') au texte en cours. Une touche qui
 * produirait un texte illisible par le domaine (ex. une 4e décimale de poids,
 * une 3e décimale d'euros) est ignorée : le pavé ne fabrique jamais une saisie
 * que la règle refuserait pour une raison de format.
 *   - virgule en premier → « 0, » (lirePoids / lireMontant refusent « ,5 »)
 *   - pas de zéro de tête : « 0 » puis « 5 » → « 5 »
 */
export function appliquerTouche(texte: string, touche: string, options: OptionsTouche): string {
  const { virgule, chiffresEntiersMax, lisible } = options;
  let candidat: string;

  if (touche === ',' || touche === '.') {
    if (!virgule || texte.includes(VIRGULE)) return texte;
    candidat = texte === '' ? `0${VIRGULE}` : `${texte}${VIRGULE}`;
  } else if (/^\d$/.test(touche)) {
    const [entier, decimales] = texte.split(VIRGULE);
    if (decimales !== undefined) candidat = `${texte}${touche}`;
    else if (entier === '0') candidat = touche;
    else if (entier.length >= chiffresEntiersMax) return texte;
    else candidat = `${entier}${touche}`;
  } else {
    return texte;
  }

  return lisible(texteALire(candidat)) ? candidat : texte;
}

/** Retire le dernier caractère (« 0, » redevient « 0 », puis vide). */
export function effacerDernier(texte: string): string {
  return texte.slice(0, -1);
}

/** Longueur maximale d'un numéro tapé (espaces compris) : garde-fou de frappe. */
export const TELEPHONE_LONGUEUR_MAX = 20;

/**
 * Pavé téléphone : chiffres, espace, « + » (seulement en première position).
 * Pas deux espaces de suite, pas d'espace en tête. Le domaine
 * (`validerTelephone`) dit ensuite si le numéro est plausible.
 */
export function appliquerToucheTelephone(texte: string, touche: string, longueurMax = TELEPHONE_LONGUEUR_MAX): string {
  if (texte.length >= longueurMax) return texte;
  if (touche === '+') return texte === '' ? '+' : texte;
  if (touche === ' ') return texte === '' || texte.endsWith(' ') || texte === '+' ? texte : `${texte} `;
  if (/^\d$/.test(touche)) return `${texte}${touche}`;
  return texte;
}

/** Jeux de touches des pavés (pour le clavier physique). */
export type JeuTouches = 'entier' | 'decimal' | 'telephone';

/** Clavier physique (tablette avec clavier, douchette) → touche du pavé. */
export function toucheDepuisClavier(cle: string, jeu: JeuTouches): string | 'effacer' | 'valider' | null {
  if (/^\d$/.test(cle)) return cle;
  if (jeu === 'decimal' && (cle === ',' || cle === '.' || cle === 'Decimal')) return VIRGULE;
  if (jeu === 'telephone' && (cle === '+' || cle === ' ')) return cle;
  if (cle === 'Backspace') return 'effacer';
  if (cle === 'Enter') return 'valider';
  return null;
}
