import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { BarreNavigation } from '@/components/BarreNavigation';
import { GardienProfil } from '@/components/GardienProfil';
import { FournisseurProfil } from '@/components/ProfilAppareil';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PAin PAtisserie — Inventaire',
  description: 'Comptage, production et prévisions quotidiennes de la boulangerie.',
  // Nom affiché sous l'icône une fois l'application posée sur l'écran d'accueil.
  applicationName: 'PAin PAtisserie',
  appleWebApp: {
    capable: true,
    title: 'PAin PAtisserie',
    // L'en-tête de l'application passe sous la barre d'état iOS.
    statusBarStyle: 'default',
  },
  // L'application n'a pas vocation à être référencée : c'est un outil interne.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // La saisie se fait au doigt : on ne bloque pas le zoom pour autant.
  maximumScale: 5,
  // Couleur de la barre système, adaptée au thème de l'appareil.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f4f2' },
    { media: '(prefers-color-scheme: dark)', color: '#14130f' },
  ],
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
