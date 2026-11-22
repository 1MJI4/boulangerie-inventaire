// src/lib/pdfImages.ts
//
// Assemble un PDF A4 à partir d'images JPEG (une par page), sans dépendance :
// la feuille est dessinée sur un canvas (accents, polices, rendu identiques
// partout) puis posée sur la page. Fonction pure, testée.

export type PageJpeg = { jpeg: Uint8Array; largeur: number; hauteur: number };

const A4_LARGEUR_PT = 595;
const A4_HAUTEUR_PT = 842;

export function pdfDepuisJpegs(pages: readonly PageJpeg[]): Uint8Array {
  const enc = new TextEncoder();
  const morceaux: Uint8Array[] = [];
  const decalages: number[] = [];
  let position = 0;
  const ajouter = (u: Uint8Array) => {
    morceaux.push(u);
    position += u.length;
  };
  const texte = (s: string) => ajouter(enc.encode(s));
  const objet = (numero: number, corps: () => void) => {
    decalages[numero] = position;
    texte(`${numero} 0 obj\n`);
    corps();
    texte('\nendobj\n');
  };

  ajouter(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const nombre = 2 + pages.length * 3;
  objet(1, () => texte('<< /Type /Catalog /Pages 2 0 R >>'));
  objet(2, () => {
    const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
    texte(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  });
  pages.forEach((p, i) => {
    const page = 3 + i * 3;
    const contenu = page + 1;
    const image = page + 2;
    objet(page, () =>
      texte(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_LARGEUR_PT} ${A4_HAUTEUR_PT}] ` +
          `/Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${contenu} 0 R >>`,
      ),
    );
    const flux = `q ${A4_LARGEUR_PT} 0 0 ${A4_HAUTEUR_PT} 0 0 cm /Im0 Do Q`;
    objet(contenu, () => texte(`<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`));
    objet(image, () => {
      texte(
        `<< /Type /XObject /Subtype /Image /Width ${p.largeur} /Height ${p.hauteur} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
      );
      ajouter(p.jpeg);
      texte('\nendstream');
    });
  });

  const debutXref = position;
  texte(`xref\n0 ${nombre + 1}\n0000000000 65535 f \n`);
  for (let n = 1; n <= nombre; n++) texte(`${String(decalages[n]).padStart(10, '0')} 00000 n \n`);
  texte(`trailer\n<< /Size ${nombre + 1} /Root 1 0 R >>\nstartxref\n${debutXref}\n%%EOF\n`);

  const sortie = new Uint8Array(position);
  let o = 0;
  for (const m of morceaux) {
    sortie.set(m, o);
    o += m.length;
  }
  return sortie;
}
