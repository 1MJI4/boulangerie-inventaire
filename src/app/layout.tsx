import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { BarreNavigation } from '@/components/BarreNavigation';
import { GardienProfil } from '@/components/GardienProfil';
import { FournisseurProfil } from '@/components/ProfilAppareil';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Inventaire boulangerie',
  description: 'Comptage, production et prévisions quotidiennes de la boulangerie.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // La saisie se fait au doigt : on ne bloque pas le zoom pour autant.
  maximumScale: 5,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}>
        <FournisseurProfil>
          <BarreNavigation />
          <main className="mx-auto max-w-5xl px-4 py-4 sm:py-8">
            <GardienProfil>{children}</GardienProfil>
          </main>
        </FournisseurProfil>
      </body>
    </html>
  );
}
