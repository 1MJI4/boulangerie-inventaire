// src/catalogue/csv.ts
// Lecteur CSV minimal (RFC 4180) : champs entre guillemets, virgules et
// guillemets doublés à l'intérieur, fins de ligne LF ou CRLF, BOM éventuel.
// Les champs sont rendus TELS QUELS (aucun trim) : LOI 5.

export interface LigneCsv {
  /** Numéro de ligne physique où commence l'enregistrement (1 = en-tête). */
  ligne: number;
  champs: string[];
}

export function analyserCsv(texte: string): LigneCsv[] {
  const src = texte.charCodeAt(0) === 0xfeff ? texte.slice(1) : texte;
  const resultat: LigneCsv[] = [];
  let champs: string[] = [];
  let champ = "";
  let entreGuillemets = false;
  let ligneCourante = 1;
  let debutEnregistrement = 1;

  const finEnregistrement = () => {
    champs.push(champ);
    const vide = champs.length === 1 && champs[0] === "";
    if (!vide) resultat.push({ ligne: debutEnregistrement, champs });
    champs = [];
    champ = "";
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (entreGuillemets) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          champ += '"';
          i++;
        } else {
          entreGuillemets = false;
        }
      } else {
        if (c === "\n") ligneCourante++;
        champ += c;
      }
      continue;
    }
    if (c === '"') entreGuillemets = true;
    else if (c === ",") {
      champs.push(champ);
      champ = "";
    } else if (c === "\r" && src[i + 1] === "\n") {
      // ignoré : le \n suivant termine l'enregistrement
    } else if (c === "\n") {
      finEnregistrement();
      ligneCourante++;
      debutEnregistrement = ligneCourante;
    } else champ += c;
  }
  if (champ !== "" || champs.length > 0) finEnregistrement();
  return resultat;
}
