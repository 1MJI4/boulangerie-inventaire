// src/lib/qrCode.ts
//
// Matrice d'un QR code, pure : le ticket thermique la dessine sur son canvas,
// le ticket HTML en fait un SVG. Niveau de correction « M » : le papier
// thermique bave un peu, « L » se lirait mal.

import qrcode from 'qrcode-generator';

export function matriceQr(contenu: string): boolean[][] {
  const qr = qrcode(0, 'M'); // 0 = version la plus petite qui convient
  qr.addData(contenu, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => qr.isDark(y, x)));
}

/** Chemin SVG (un carré par module sombre), en unités de module. */
export function cheminSvgQr(matrice: boolean[][]): string {
  let d = '';
  matrice.forEach((ligne, y) =>
    ligne.forEach((sombre, x) => {
      if (sombre) d += `M${x} ${y}h1v1h-1z`;
    })
  );
  return d;
}
